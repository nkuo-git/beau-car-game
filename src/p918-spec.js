// 3D Porsche 918 Spyder：車身以外的零件（輪框、後照鏡、主動尾翼、頂出排氣管、賽道套件）和車庫選項
// 車漆：照片兩台都是消光（霧面）的，車庫只會換顏色，所以這裡每一幀照顏色去查該用消光還是亮面（P918_FINISH）。
import * as THREE from 'three';
import { aeroKit } from './parts.js';
import { P918_LOOK } from './p918-look.js';

// 各車色的漆面：[粗糙度, 金屬感, 清漆]（清漆不能是 0，patchPaint 的 shader 要用到 clearcoat）
export const P918_FINISH = {
  '5a5e63': [0.55, 0.35, 0.02], '1c1d20': [0.6, 0.1, 0.02], 'c5c9ce': [0.1, 1.0, 1], 'a9acb0': [0.28, 0.75, 1],
  'f1f1ee': [0.3, 0.0, 1], 'c30f24': [0.3, 0.05, 1], 'a4cc1e': [0.3, 0.1, 1],
};
function P918_sync(paint, parts) { // 照目前的顏色套漆面，零件跟著車身同色同漆面；車庫選了別的漆面（setFinish，paint.userData.finish 不是 stock）就不照顏色改
  const fin = paint.userData.finish;
  if (!fin || fin === 'stock') {
    const f = P918_FINISH[paint.color.getHexString()] || [0.3, 0.12, 1];
    paint.roughness = f[0]; paint.metalness = f[1]; paint.clearcoat = f[2]; paint.clearcoatRoughness = f[2] < 0.5 ? 0.6 : 0.03;
  }
  for (const m of parts) {
    m.color.copy(paint.color); m.roughness = paint.roughness; m.metalness = paint.metalness; m.clearcoat = paint.clearcoat; m.clearcoatRoughness = paint.clearcoatRoughness;
    m.iridescence = paint.iridescence; m.iridescenceIOR = paint.iridescenceIOR; m.iridescenceThicknessRange = paint.iridescenceThicknessRange;
  }
}
const P918_parts = []; // 跟車身同色的零件材質（尾翼、後照鏡殼）
function P918_partMat(paint) {
  const m = new THREE.MeshPhysicalMaterial({ color: paint.color.clone(), roughness: 0.55, metalness: 0.35, clearcoat: 0.02 });
  P918_parts.push(m); return m;
}
// 一片有厚度的板子（四個角，往法線兩邊長 th/2）
function P918_slab(pts, th) {
  const v = pts.map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[3].clone().sub(v[0])).normalize().multiplyScalar(th / 2);
  const T = v.map((p) => p.clone().add(n)), B = v.map((p) => p.clone().sub(n));
  const quads = [[T[0], T[1], T[2], T[3]], [B[3], B[2], B[1], B[0]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quads.push([B[i], B[j], T[j], T[i]]); }
  const a = [];
  for (const [p, q, r, w] of quads) a.push(...p.toArray(), ...q.toArray(), ...r.toArray(), ...p.toArray(), ...r.toArray(), ...w.toArray());
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals();
  return g;
}

const P918_red = new THREE.MeshPhysicalMaterial({ color: 0xc8141e, roughness: 0.3, metalness: 0.4, clearcoat: 1 });
// 輪框：10 組 V 形雙輻（照片兩台都是細的多輻），中間紅色中央螺帽
function P918_spokes(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.014, rh = 0.075, zo = w / 2 - 0.025, zi = w / 2 - 0.09 - (w - 0.265) * 0.5;
  for (let j = 0; j < 10; j++) {
    const a = (j * 2 * Math.PI) / 10;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.075, ao = a + s * 0.15;
      const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
      g.add(new THREE.Mesh(P918_slab([P(rh, ai, zi, -0.0085), P(ro, ao, zo, -0.006), P(ro, ao, zo, 0.006), P(rh, ai, zi, 0.0085)], 0.018), mats.chrome));
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.096, 0.045, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.004; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.006, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.03, 6), P918_red);
  nut.geometry.rotateX(Math.PI / 2); nut.position.z = zi + 0.03; g.add(nut);
  return g;
}
P918_spokes.capInset = 0.06;

// 後照鏡：碳纖維的水滴形殼，細支架從車門上緣伸出去
function P918_mirror(paint, mats, s) {
  const g = new THREE.Group(), head = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, Math.PI / 2, Math.PI), mats.carbon); // 前半個橢球，後面開口放鏡子
  shell.scale.set(0.12, 0.052, 0.075); head.add(shell);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mats.mirrorGlass);
  glass.scale.set(0.068, 0.047, 1); glass.rotation.y = -Math.PI / 2; glass.position.x = 0.004; head.add(glass);
  head.position.set(0.40, 0.845, s * 0.965); head.rotation.y = s * 0.10; g.add(head);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.17, 10), mats.carbon);
  arm.rotation.x = s * -1.25; arm.rotation.z = 0.25; arm.position.set(0.50, 0.825, s * 0.885); g.add(arm);
  return g;
}

// 主動尾翼（升起來）：車尾上面一片寬翼片，兩根支架
function P918_wing(paint, mats) {
  const g = new THREE.Group(), m = P918_partMat(paint);
  const chord = 0.27, span = 1.52, x = -2.12, y = 1.03;
  const s = new THREE.Shape(), N = 20, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.10 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const cam = -0.04 * Math.sin(Math.PI * xc);
    top.push([xc, cam + th]); bot.push([xc, cam - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 }), m);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = 0.07; blade.position.set(x, y, 0); g.add(blade);
  for (const sz of [-1, 1]) {
    const st = new THREE.Shape(), hh = y - 0.87;
    st.moveTo(-0.07, 0); st.lineTo(0.09, 0); st.lineTo(0.05, hh); st.lineTo(-0.06, hh); st.closePath();
    const p = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), mats.black);
    p.position.set(x, 0.87, sz * 0.38 - 0.011); g.add(p);
  }
  return g;
}

// 頂出排氣管：引擎蓋上兩根往上的管口（外面鈦色、裡面黑）
function P918_pipes(mats) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.12, 32, 1, true), mats.alu);
    t.position.set(-1.02, 0.935, s * 0.285); t.rotation.z = 0.25; g.add(t);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.052, 32), mats.black);
    inner.rotation.x = -Math.PI / 2; inner.rotation.y = 0.25; inner.position.set(-1.03, 0.975, s * 0.285); g.add(inner);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 8, 32), mats.alu);
    lip.rotation.x = Math.PI / 2; lip.rotation.y = 0.25; lip.position.set(-1.005, 0.992, s * 0.285); g.add(lip);
  }
  return g;
}

// 前車蓋上的條紋：從車身網格挑出車蓋那幾塊三角形，貼一層薄片，顏色從側面拉花貼圖 y＞1.2 那條讀（換拉花會一起換）
function P918_lidDecal(body, paint) {
  const shell = body.getObjectByName('paint');
  const fake = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <lights_physical_fragment>' };
  paint.onBeforeCompile(fake); // 借車漆 shader 的 uniform（拉花貼圖、uLiv）
  const U = fake.uniforms;
  if (!shell || !U.tLivR) return null;
  const G = shell.geometry, P = G.attributes.position, N = G.attributes.normal, I = G.index.array;
  const pos = [], nor = [];
  const ok = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return x > 0.68 && y > 0.45 && N.getY(i) > 0.3 && z > -0.10 && z < 0.36; };
  for (let t = 0; t < I.length; t += 3) {
    if (!ok(I[t]) || !ok(I[t + 1]) || !ok(I[t + 2])) continue;
    for (let k = 0; k < 3; k++) { const i = I[t + k]; pos.push(P.getX(i) + N.getX(i) * 0.002, P.getY(i) + N.getY(i) * 0.002, P.getZ(i) + N.getZ(i) * 0.002); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.1, clearcoat: 0.02, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tLivR = U.tLivR; sh.uniforms.uLiv = U.uLiv;
    sh.vertexShader = 'varying vec3 vPd;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPd = position;');
    sh.fragmentShader = 'uniform sampler2D tLivR; uniform float uLiv; varying vec3 vPd;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  vec4 L = texture2D(tLivR, vec2((vPd.x + 2.35) / 4.7, (1.2 + (vPd.z + 0.2) / 3.0) / 1.4));
  if (L.a * uLiv < 0.03) discard;
  diffuseColor = vec4(L.rgb, L.a);`);
  };
  m.customProgramCacheKey = () => 'p918-lid';
  const mesh = new THREE.Mesh(geo, m); mesh.name = 'p918-lid'; mesh.renderOrder = 1;
  return mesh;
}

// 賽道套件的位置（前下巴、風刀、側裙刀片、後擴散器）
export const P918_AERO = {
  front: [[2.35, 0], [2.34, 0.30], [2.285, 0.50], [2.19, 0.67], [2.06, 0.80], [1.94, 0.87]], back: 1.90, y: 0.098, rods: [2.27, 0.15],
  canard: { S: [2.16, 0.69], t: [-0.62, 0.78], ys: [0.30, 0.22] },
  skirt: { y: 0.105, x0: -0.95, x1: 0.82, z0: 0.90, z1: 0.99 },
  diff: { x0: -1.85, x1: -2.10, x2: -2.34, y0: 0.13, y1: 0.15, y2: 0.225, w: 0.62, fin0: -1.95 },
};

export const P918_SPEC = {
  look: P918_LOOK, paint: '#5a5e63', metal: 0.35, seat: 0x1c1d20,
  wheels: { xf: 1.3135, xr: -1.4165, RF: 0.347, RR: 0.364, rimF: 0.254, rimR: 0.2667, trackF: 0.832, trackR: 0.806, wF: 0.265, wR: 0.325, style: P918_spokes },
  mirror: (paint, mats, s) => P918_mirror(paint, mats, s),
  wings: { stock: (paint, mats) => P918_wing(paint, mats) },
  wing: 'stock',
  interior: { dx: 0.02, cage: false, wheelZ: -0.37, dashX: 0.44, dashY: 0.80 },
  build(body, paint, mats) { // 套件：原廠（什麼都不加）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    body.add(P918_pipes(mats));
    const lid = P918_lidDecal(body, paint); if (lid) body.add(lid);
    const aero = aeroKit(mats, P918_AERO); aero.visible = false; body.add(aero);
    const parts = P918_parts.splice(0); // 這台車的同色零件
    const shell = body.getObjectByName('paint');
    if (shell) shell.onBeforeRender = () => P918_sync(paint, parts);
    P918_sync(paint, parts);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（camfit：照片 1 從左前方很低的地方拍、照片 2 從左後方用長鏡頭拍）
export const P918_CAMS = {
  photo1: { a: 44.5258, d: 5.4243, h: 0.0759, tx: 0.853, ty: 1.0959, fov: 31.8075, rl: -0.8837 },
  photo2: { a: 151.0019, d: 23.3041, h: 2.711, tx: -0.2796, ty: 0.619, fov: 5.4432, rl: 0.8802 },
};

export const P918_GARAGE = {
  name: 'Porsche 918 Spyder', sub: '照片那台消光灰 Weissach · 3D 試做版',
  paints: [['#5a5e63', '消光灰'], ['#1c1d20', '消光黑'], ['#c5c9ce', '液態金屬銀'], ['#a9acb0', 'GT 銀'], ['#f1f1ee', '白'], ['#c30f24', '紅'], ['#a4cc1e', '螢光綠']],
  opts: {
    wing: [['stock', '原廠（升起）'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['stripes', '紅藍條紋 6 號'], ['salzburg', '紅白 25 號'], ['none', '不要']],
  },
  state: { paint: '#5a5e63', rim: 'gunmetal', caliper: '#9bd400', wing: 'stock', kit: 'stock', height: '0', livery: 'stripes', tint: 'light' },
};
