// 3D Corolla Altis（E210，台灣小黃）：輪子（原廠 16 吋十輻，五組 V 形寬輻條）、車身色後照鏡、車頂計程車燈、小尾翼、
// 後保桿的灰色貼片（小黃拉花）、賽道套件。車身是 altis-body.mjs 切出來的 body-altis(-q).glb，表面細節在 altis-look.js。
import * as THREE from 'three';
import { mirror, aeroKit, slab } from './parts.js';
import { ALTIS_LOOK } from './altis-look.js';

// 輪框：原廠 16 吋，十根寬寬的扁輻條兩兩一組（五組 V 形），在輪轂那邊靠在一起、到外緣分開，輻條中間有一條稜線（兩片斜面）
function ALTIS_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.01, rh = 0.075, zo = w / 2 - 0.03, zi = w / 2 - 0.07;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.10, ao = a + s * 0.25; // 輪轂那邊靠近、外緣分開
      const wi = 0.016, wo = 0.026; // 外緣比較寬
      for (const side of [-1, 1]) { // 兩片斜面：中間稜線高一點（往外 6 公釐）
        const q = [P(rh, ai, zi + 0.006, 0), P(ro, ao, zo + 0.006, 0), P(ro, ao, zo, side * wo), P(rh, ai, zi, side * wi)];
        g.add(new THREE.Mesh(slab(side > 0 ? q : q.reverse(), 0.012), mats.chrome));
      }
    }
  }
  // 中間的輪轂（跟輪框同色）；中心蓋（沒有標誌）和五顆螺帽是 parts.js rimFace 加的（capInset）
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.088, 0.04, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.003, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
ALTIS_wheel.capInset = 0.045;

// 車頂計程車燈：白色的「帽子」形燈箱（下面寬、上面圓），前後兩面寫 TAXI（自己的字，沒有車行名字、電話），黑色底座
// 位置照兩張小黃照片三角定位：中心 x −0.20、底 y 1.37、寬 0.34、高 0.14
function ALTIS_sign(mats) {
  const g = new THREE.Group();
  const X = -0.20, Y = 1.372, D = 0.14; // D：前後厚度
  const sh = new THREE.Shape(); // 正面形狀（z, y）
  sh.moveTo(-0.17, 0); sh.lineTo(0.17, 0); sh.lineTo(0.17, 0.03); sh.quadraticCurveTo(0.17, 0.05, 0.148, 0.056);
  sh.lineTo(0.115, 0.064); sh.bezierCurveTo(0.10, 0.14, -0.10, 0.14, -0.115, 0.064); sh.lineTo(-0.148, 0.056);
  sh.quadraticCurveTo(-0.17, 0.05, -0.17, 0.03); sh.closePath();
  const box = new THREE.ExtrudeGeometry(sh, { depth: D - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
  box.translate(0, 0, -(D - 0.02) / 2); box.rotateY(Math.PI / 2); // 形狀的 x → 車的 z，厚度 → 車的 x
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f2, roughness: 0.35, metalness: 0, clearcoat: 0.6, emissive: 0x222220 });
  const m = new THREE.Mesh(box, white); m.position.set(X, Y + 0.012, 0); g.add(m);
  const base = new THREE.Mesh(new THREE.BoxGeometry(D + 0.02, 0.014, 0.37), mats.black);
  base.position.set(X, Y + 0.006, 0); g.add(base);
  // 前後兩面的字（透明貼圖的薄片）
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const k = c.getContext('2d');
    k.fillStyle = '#d4121e'; k.font = '900 104px "Arial Black", Arial, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.fillText('TAXI', 256, 92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const tm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.072), tm);
      p.rotation.y = s * Math.PI / 2; p.position.set(X + s * (D / 2 + 0.0015), Y + 0.06, 0); g.add(p);
    }
  }
  return g;
}

// 小尾翼：行李箱蓋後緣一片薄薄的車身色鴨尾（選配）；後緣沿著行李箱蓋的邊（車身 SDF 在 y 1.0 量的）往兩邊往前彎
const ALTIS_DECK_EDGE = [[0, -2.184], [0.2, -2.184], [0.35, -2.148], [0.45, -2.052], [0.53, -1.975]];
function ALTIS_lip(paint) {
  const sh = new THREE.Shape(); // 側面（x, y），往 z 拉
  sh.moveTo(-2.07, 1.037); sh.lineTo(-2.175, 1.036); sh.quadraticCurveTo(-2.195, 1.04, -2.20, 1.062); sh.lineTo(-2.182, 1.058); sh.quadraticCurveTo(-2.12, 1.049, -2.07, 1.045); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -0.5);
  const E = ALTIS_DECK_EDGE, xe = (u) => { for (let i = 1; i < E.length; i++) if (u <= E[i][0]) { const t = (u - E[i - 1][0]) / (E[i][0] - E[i - 1][0]); return E[i - 1][1] + (E[i][1] - E[i - 1][1]) * t; } return E[E.length - 1][1]; };
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(0.53, Math.abs(pos.getZ(i)) * 1.0);
    pos.setX(i, pos.getX(i) + xe(u) - E[0][1]); pos.setY(i, pos.getY(i) - 0.016 * (u / 0.53) ** 2);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, paint);
}

// 後保桿的灰色（小黃拉花）：車身朝後的那幾塊三角形貼一層薄片，灰色只在保桿上半部線以下；
// 有沒有小黃拉花看側面拉花貼圖右上角的保留小格子（altis-look.js livery 畫的），尾燈、反光片、黑色下緣的地方挖掉
function ALTIS_rearDecal(body, paint) {
  const shell = body.getObjectByName('paint');
  const fake = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <lights_physical_fragment>' };
  paint.onBeforeCompile(fake); // 借車漆 shader 的 uniform（拉花貼圖、uLiv、後面的遮罩）
  const U = fake.uniforms;
  if (!shell || !U.tLivR) return null;
  const G = shell.geometry, Pp = G.attributes.position, N = G.attributes.normal, I = G.index.array;
  const pos = [], nor = [];
  const ok = (i) => Pp.getX(i) < -1.70 && Pp.getY(i) < 0.83 && Pp.getY(i) > 0.12 && N.getX(i) < 0.05;
  for (let t = 0; t < I.length; t += 3) {
    if (!ok(I[t]) || !ok(I[t + 1]) || !ok(I[t + 2])) continue;
    for (let k = 0; k < 3; k++) { const i = I[t + k]; pos.push(Pp.getX(i) + N.getX(i) * 0.0015, Pp.getY(i) + N.getY(i) * 0.0015, Pp.getZ(i) + N.getZ(i) * 0.0015); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.MeshPhysicalMaterial({ color: ALTIS_LOOK.GREY, roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tLivR: U.tLivR, uLiv: U.uLiv, tRear: U.tRear });
    sh.vertexShader = 'varying vec3 vPd; varying vec3 vNd;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPd = position; vNd = normal;');
    sh.fragmentShader = 'uniform sampler2D tLivR, tRear; uniform float uLiv; varying vec3 vPd; varying vec3 vNd;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  if (texture2D(tLivR, vec2((2.325 + 2.35) / 4.7, 1.365 / 1.4)).a * uLiv < 0.5) discard;
  float u = abs(vPd.z);
  float top = u < 0.44 ? mix(0.585, 0.605, smoothstep(0.25, 0.44, u)) : (u < 0.515 ? mix(0.605, 0.76, (u - 0.44) / 0.075) : 0.775 + max(0.0, u - 0.6) * 0.45);
  if (vPd.y > top) discard; // 朝側面的地方（|nz| > 0.6）側面拉花已經畫了
  vec4 Rr = texture2D(tRear, vec2((vPd.z + 1.0) / 2.0, vPd.y / 1.3));
  if (abs(vNd.z) > 0.6 || Rr.r > 0.5 || Rr.g > 0.5 || Rr.b > 0.5) discard;
  diffuseColor.rgb *= 1.0 - 0.85 * Rr.a;`);
  };
  m.customProgramCacheKey = () => 'altis-rear';
  const mesh = new THREE.Mesh(geo, m); mesh.name = 'altis-liv'; mesh.renderOrder = 1;
  return mesh;
}

// 賽道套件的位置（前下巴、風刀、側裙刀片、後擴散器）：照車身 SDF 在下緣量的
export const ALTIS_AERO = {
  front: [[2.25, 0], [2.245, 0.30], [2.19, 0.50], [2.095, 0.65], [2.01, 0.75], [1.92, 0.82]], back: 1.85, y: 0.15, rods: [2.17, 0.185],
  canard: { S: [1.985, 0.755], t: [-0.685, 0.728], ys: [0.33, 0.26] },
  skirt: { y: 0.155, x0: -0.90, x1: 0.82, z0: 0.80, z1: 0.90 },
  diff: { x0: -1.75, x1: -2.05, x2: -2.22, y0: 0.17, y1: 0.19, y2: 0.26, w: 0.62, fin0: -1.85 },
};

export const ALTIS_SPEC = {
  look: ALTIS_LOOK, paint: '#f2b80f', metal: 0.08, seat: 0x2a2b2e,
  wheels: { xf: 1.385, xr: -1.315, R: 0.316, rim: 0.2032, trackF: 0.7655, trackR: 0.772, wF: 0.205, wR: 0.205, style: ALTIS_wheel },
  mirror: (paint, mats, s) => { const m = mirror(paint, mats, s); m.position.set(0.76, 0.985, s * 0.82); m.scale.setScalar(1.2); return m; },
  wings: { lip: (paint) => ALTIS_lip(paint) },
  wing: 'none',
  interior: { dx: 0.12, cage: false, wheelZ: -0.37, dashX: 0.72, dashY: 0.93, bench: { x: -0.95, shelfX: -1.40, shelfY: 1.0 } },
  build(body, paint, mats) { // 套件：小黃（原廠＋車頂計程車燈）、原廠（什麼都不加）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    const dec = ALTIS_rearDecal(body, paint); if (dec) body.add(dec);
    const sign = ALTIS_sign(mats); body.add(sign);
    const aero = aeroKit(mats, ALTIS_AERO); aero.visible = false; body.add(aero);
    return (kit) => { sign.visible = kit === 'taxi'; aero.visible = kit === 'track'; };
  },
  kit: 'taxi',
};

// 照片相機（altis3d/fit2.mjs：車牌 32×15 公分的四個角＋輪框外緣整圈橢圓；photo5 是另外找的白色側面照片，只用輪框）
// photo1＝小黃左前、photo2＝小黃左後、photo4＝白色左後（altis-4），photo5＝白色正側面
export const ALTIS_CAMS = {
  photo1: { a: 37.475, d: 3.74, h: 1.57, tx: 0.689, ty: 0.421, fov: 34.621, rl: 1.58 },
  photo2: { a: 152.415, d: 5.471, h: 1.571, tx: -0.599, ty: 0.566, fov: 21.411, rl: -1.029 },
  photo4: { a: 148.394, d: 5.485, h: 1.873, tx: -0.61, ty: 0.48, fov: 20.947, rl: 1.006 },
  photo5: { a: 86.763, d: 6.576, h: 1.201, tx: 0.055, ty: 0.726, fov: 30.585, rl: -1.678 },
};

export const ALTIS_GARAGE = {
  name: '小黃 計程車', sub: '黃色計程車 · 3D 試做版',
  paints: [['#f2b80f', '計程車黃'], ['#eceeef', '珍珠白'], ['#b9bdc2', '銀'], ['#5b5f66', '鐵灰'], ['#101114', '黑'], ['#a3121f', '紅'], ['#1d3f8f', '藍']],
  opts: {
    wing: [['none', '原廠（沒有）'], ['lip', '小尾翼']],
    kit: [['taxi', '小黃（車頂燈）'], ['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['taxi', '小黃'], ['none', '不要']],
  },
  state: { paint: '#f2b80f', rim: 'chrome', caliper: '#8a8d92', wing: 'none', kit: 'taxi', height: '0', livery: 'taxi', tint: 'light' },
};
