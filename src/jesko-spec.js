// 3D Koenigsegg Jesko Attack：輪子（五根 Y 字輻條）、迴力鏢大尾翼（鵝頸支架）、後照鏡、下巴、側裙、擴散器、排氣管、相機、車庫選項
// 拉花顏色（紅／綠／不要）同時決定尾翼端板、下巴翼片、側裙尖端、擴散器邊條、支架飾條的顏色
import * as THREE from 'three';
import { interior } from './parts.js';
import { JESKO_LOOK } from './jesko-look.js';

// 一片有厚度的板子：給四個角（依序），往板子法線兩邊各長 th/2
function JESKO_slab(pts, th) {
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
// 側面輪廓（x, y）往 z 拉厚 th，放在 z0
function JESKO_plate(pts, th, z0, mat, bevel = 0.004) {
  const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 }), mat);
  m.position.z = z0 - th / 2; return m;
}
// 拉花點綴色：材質跟著拉花換（車漆材質編譯時抓 uLiv；'none' 時變回碳纖維黑）
function JESKO_accent(mats) {
  if (mats.jeskoAcc) return mats.jeskoAcc;
  const m = new THREE.MeshPhysicalMaterial({ color: JESKO_LOOK.accent(), roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
  const liv = { u: null };
  m.userData.liv = liv;
  m.userData.update = () => { const on = liv.u ? liv.u.value > 0.5 : true; m.color.set(on ? JESKO_LOOK.accent() : 0x17181b); };
  mats.jeskoAcc = m;
  return m;
}
const JESKO_tag = (mesh, mats) => { mesh.onBeforeRender = () => mats.jeskoAcc.userData.update(); return mesh; };

// ---- 輪框：五根 Y 字輻條（中間一根、快到輪緣分成兩叉），往中間凹 ----
function JESKO_rim(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, rs = rim * 0.55, rh = 0.075, zo = w / 2 - 0.03, zi = w / 2 - 0.075;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  const zAt = (r) => zi + (zo - zi) * Math.min(1, (r - rh) / (ro - rh));
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    g.add(new THREE.Mesh(JESKO_slab([P(rh, a, zi, -0.032), P(rs, a, zAt(rs), -0.028), P(rs, a, zAt(rs), 0.028), P(rh, a, zi, 0.032)], 0.024), mats.chrome));
    for (const s of [-1, 1]) {
      const ao = a + s * 0.20;
      g.add(new THREE.Mesh(JESKO_slab([P(rs - 0.015, a + s * 0.02, zAt(rs), -0.016), P(ro, ao, zo, -0.013), P(ro, ao, zo, 0.013), P(rs - 0.015, a + s * 0.02, zAt(rs), 0.016)], 0.02), mats.chrome));
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.045, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.004; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
JESKO_rim.capInset = 0.07;

// ---- 迴力鏢大尾翼：翼片兩端往前掠、中間往後；兩根鵝頸支架從上面勾住翼片；小端板 ----
const JESKO_WING = { x0: -1.60, sweep: 0.12, y0: 1.13, rise: 0.03, c0: 0.31, c1: 0.25, span: 1.0, pylonZ: 0.37 };
function JESKO_wingMesh(mats, W) {
  const g = new THREE.Group();
  const N = 18, sec = [], pos = [], idx = [];
  const foil = [];
  for (let i = 0; i <= N; i++) { const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2; foil.push(xc); }
  const secPts = (z) => {
    const u = Math.abs(z) / W.span, le = W.x0 + W.sweep * u ** 1.6, c = W.c0 + (W.c1 - W.c0) * u, y = W.y0 + W.rise * u * u, aoa = 0.16;
    const up = [], lo = [];
    for (const xc of foil) {
      const th = 0.11 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
      const cam = -0.05 * Math.sin(Math.PI * xc);
      const X = (yy) => [le - xc * c * Math.cos(aoa) - yy * c * Math.sin(aoa), y + xc * c * Math.sin(aoa) + yy * c * Math.cos(aoa)];
      up.push(X(cam + th)); lo.push(X(cam - th));
    }
    return [...up, ...lo.slice(1, -1).reverse()];
  };
  const S = 24;
  for (let i = 0; i <= S; i++) { const z = -W.span + (2 * W.span * i) / S; sec.push({ z, pts: secPts(z) }); }
  const n = sec[0].pts.length;
  sec.forEach((s) => s.pts.forEach(([x, y]) => pos.push(x, y, s.z)));
  for (let i = 0; i < S; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + ((j + 1) % n), c = (i + 1) * n + j, d = (i + 1) * n + ((j + 1) % n);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mats.carbon));
  // 端板（拉花色）
  const acc = JESKO_accent(mats);
  for (const s of [-1, 1]) {
    const u = 1, le = W.x0 + W.sweep, c = W.c1, y = W.y0 + W.rise;
    g.add(JESKO_plate([[le + 0.03, y + 0.03], [le - c - 0.03, y + 0.05], [le - c - 0.05, y - 0.03], [le - c * 0.5, y - 0.12], [le + 0.02, y - 0.08]], 0.012, s * (W.span + 0.008), mats.carbon, 0.003));
    g.add(JESKO_tag(JESKO_plate([[le + 0.03, y + 0.03], [le - c - 0.03, y + 0.05], [le - c - 0.036, y + 0.0], [le + 0.026, y - 0.012]], 0.018, s * (W.span + 0.008), acc, 0.002), mats));
  }
  // 尾緣的小擾流片（賽道套件才看得到）
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 2 * W.span - 0.06), mats.carbon);
  fl.name = 'flap'; fl.visible = false; fl.position.set(W.x0 - W.c0 * 0.97, W.y0 + 0.085, 0); g.add(fl);
  // 鵝頸支架：從引擎蓋往上、往後彎，勾在翼片上面；前緣一條拉花色飾條
  for (const s of [-1, 1]) {
    const z = s * W.pylonZ, u = W.pylonZ / W.span, le = W.x0 + W.sweep * u ** 1.6, yT = W.y0 + W.rise * u * u + 0.035;
    const neck = [[-1.26, 0.88], [-1.31, 1.00], [-1.39, 1.11], [-1.49, 1.18], [le - 0.04, yT + 0.035], [le - 0.19, yT + 0.03], [le - 0.21, yT - 0.012],
      [le - 0.08, yT - 0.012], [-1.53, 1.12], [-1.48, 1.02], [-1.46, 0.88]];
    g.add(JESKO_plate(neck, 0.024, z, mats.carbon, 0.004));
    const strip = [[-1.26, 0.90], [-1.31, 1.00], [-1.39, 1.11], [-1.49, 1.18], [-1.53, 1.165], [-1.43, 1.095], [-1.355, 0.99], [-1.305, 0.90]];
    g.add(JESKO_tag(JESKO_plate(strip, 0.028, z, acc, 0.002), mats));
  }
  return g;
}

// ---- 後照鏡：細支架從車門上緣伸出去，水滴形鏡殼（同車色），鏡面朝後 ----
function JESKO_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), mats.carbon);
  head.scale.set(0.10, 0.045, 0.056); head.rotation.y = s * 0.12; head.position.set(0.50, 0.915, s * 1.0); g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mats.mirrorGlass);
  glass.scale.set(0.045, 0.058, 1); glass.rotation.y = -Math.PI / 2; glass.position.set(0.44, 0.915, s * 1.0); g.add(glass);
  const stalk = new THREE.Mesh(JESKO_slab([[0.62, 0.74, s * 0.87], [0.55, 0.90, s * 0.99], [0.50, 0.90, s * 0.99], [0.57, 0.74, s * 0.87]], 0.016), mats.carbon);
  g.add(stalk);
  return g;
}

// ---- 下巴、側裙、擴散器、排氣管（原廠就有）；賽道套件多風刀、側裙小翼、尾翼擾流片 ----
function JESKO_splitter(mats) {
  const g = new THREE.Group(), acc = JESKO_accent(mats), k = 0;
  const front = [[2.335 + k, 0], [2.32 + k, 0.30], [2.26 + k, 0.52], [2.15 + k, 0.72], [2.02, 0.88], [1.92, 0.955]];
  const sh = new THREE.Shape(), zb = front[front.length - 1][1];
  sh.moveTo(1.80, -zb); sh.lineTo(front[front.length - 1][0], -zb);
  sh.splineThru(front.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(front.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(1.80, zb); sh.closePath();
  const sp = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 24 }), mats.carbon);
  sp.rotation.x = Math.PI / 2; sp.position.y = 0.092; g.add(sp);
  for (const s of [-1, 1]) {
    // 下巴兩端的小翼（拉花色），往後上翹
    g.add(JESKO_tag(new THREE.Mesh(JESKO_slab([[2.06, 0.09, s * 0.90], [1.95, 0.09, s * 0.965], [1.95, 0.16, s * 0.97], [2.01, 0.14, s * 0.92]], 0.012), acc), mats));
    // 中間的直立導流片（拉花色）
    g.add(JESKO_tag(new THREE.Mesh(JESKO_slab([[2.28, 0.09, s * 0.055], [2.14, 0.09, s * 0.065], [2.14, 0.20, s * 0.065], [2.22, 0.18, s * 0.057]], 0.012), acc), mats));
    // 側裙：碳纖維刀片，前端拉花色
    g.add(new THREE.Mesh(JESKO_slab([[-0.98, 0.108, s * 0.93], [0.84, 0.108, s * 0.93], [0.80, 0.108, s * 1.005], [-0.94, 0.108, s * 1.0]], 0.012), mats.carbon));
    g.add(JESKO_tag(new THREE.Mesh(JESKO_slab([[0.84, 0.112, s * 0.93], [0.96, 0.112, s * 0.93], [0.92, 0.112, s * 1.0], [0.80, 0.112, s * 1.005]], 0.014), acc), mats));
  }
  return g;
}
function JESKO_diffuser(mats) {
  const g = new THREE.Group(), acc = JESKO_accent(mats);
  // 底板往後上翹
  g.add(new THREE.Mesh(JESKO_slab([[-1.90, 0.115, -0.78], [-1.90, 0.115, 0.78], [-2.34, 0.30, 0.78], [-2.34, 0.30, -0.78]], 0.012), mats.carbon));
  for (const z of [-0.62, -0.38, -0.13, 0.13, 0.38, 0.62]) {
    const f = [[-1.92, 0.118], [-2.34, 0.30], [-2.36, 0.40], [-2.27, 0.40], [-2.08, 0.28]];
    g.add(JESKO_plate(f, 0.012, z, mats.carbon, 0.002));
  }
  // 最外側兩片（拉花色的下緣）
  for (const s of [-1, 1]) g.add(JESKO_tag(new THREE.Mesh(JESKO_slab([[-2.00, 0.13, s * 0.80], [-2.30, 0.13, s * 0.80], [-2.30, 0.20, s * 0.84], [-2.05, 0.19, s * 0.84]], 0.014), acc), mats));
  return g;
}
function JESKO_exhaust(mats) {
  const g = new THREE.Group();
  const bez = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 10, 48), mats.alu);
  bez.scale.set(0.13, 0.036, 0.3); bez.rotation.y = Math.PI / 2; bez.position.set(-2.225, 0.575, 0); g.add(bez);
  const back = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mats.black);
  back.scale.set(0.12, 0.034, 1); back.rotation.y = -Math.PI / 2; back.position.set(-2.215, 0.575, 0); g.add(back);
  for (const z of [-0.075, 0, 0.075]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 24, 1, true), mats.alu);
    p.material = mats.alu; p.geometry.rotateZ(Math.PI / 2); p.position.set(-2.235, 0.575, z); g.add(p);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), mats.black);
    hole.rotation.y = -Math.PI / 2; hole.position.set(-2.262, 0.575, z); g.add(hole);
  }
  return g;
}
function JESKO_pinstripe(mats) {
  const half = [[1.25, 0.752, 0.495], [1.60, 0.752, 0.498], [1.80, 0.724, 0.49], [1.90, 0.70, 0.44], [1.955, 0.678, 0.32], [1.968, 0.674, 0.15], [1.97, 0.674, 0]];
  const pts = [...half, ...half.slice(0, -1).reverse().map(([x, y, z]) => [x, y, -z])].map(([x, y, z]) => new THREE.Vector3(x, y + 0.004, z));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.006, 6, false), JESKO_accent(mats));
  return JESKO_tag(m, mats);
}
function JESKO_canards(mats) {
  const g = new THREE.Group(), acc = JESKO_accent(mats);
  for (const s of [-1, 1]) for (const [y, dx] of [[0.30, 0], [0.40, -0.03]]) {
    g.add(JESKO_tag(new THREE.Mesh(JESKO_slab([[2.08 + dx, y, s * 0.86], [1.94 + dx, y + 0.04, s * 0.96], [1.90 + dx, y + 0.04, s * 1.03], [2.02 + dx, y, s * 0.97]], 0.008), acc), mats));
  }
  // 側裙往外多一片小翼
  for (const s of [-1, 1]) g.add(new THREE.Mesh(JESKO_slab([[-0.90, 0.14, s * 1.0], [0.70, 0.14, s * 1.0], [0.66, 0.16, s * 1.04], [-0.86, 0.16, s * 1.04]], 0.008), mats.carbon));
  return g;
}

export const JESKO_SPEC = {
  look: JESKO_LOOK, paint: '#f1f2f3', metal: 0.12, seat: 0xc4c7cc,
  wheels: { xf: 1.35, xr: -1.35, RF: 0.347, RR: 0.364, rimF: 0.254, rimR: 0.2667, trackF: 0.85, trackR: 0.825, wF: 0.265, wR: 0.325, style: JESKO_rim },
  mirror: (paint, mats, s) => JESKO_mirror(paint, mats, s),
  wings: { stock: (paint, mats) => JESKO_wingMesh(mats, JESKO_WING) },
  wing: 'stock',
  interior: { dx: 0.02, cage: false, wheelZ: -0.36, dashX: 0.62, dashY: 0.74 },
  build(body, paint, mats) {
    // 拉花點綴色：車漆編譯時把 uLiv 抓出來，零件每次畫之前照它換色
    const acc = JESKO_accent(mats), ob = paint.onBeforeCompile;
    paint.onBeforeCompile = (sh, r) => { ob(sh, r); acc.userData.liv.u = sh.uniforms.uLiv; };
    // 車內的後置物板會穿出引擎蓋兩側，拿掉
    body.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.position.y > 0.9 && o.position.x < -1.0) o.visible = false; });
    body.add(JESKO_splitter(mats), JESKO_diffuser(mats), JESKO_exhaust(mats), JESKO_pinstripe(mats));
    const can = JESKO_canards(mats), flap = body.getObjectByName('wing-stock')?.getObjectByName('flap');
    can.visible = false; body.add(can);
    return (kit) => { can.visible = kit === 'track'; if (flap) flap.visible = kit === 'track'; };
  },
  kit: 'stock',
};
export const JESKO_CAMS = {
  photo1: { a: -29.79, d: 7.58, h: 0.8, tx: 0.605, ty: 0.519, fov: 17.58, rl: -0.775 },
  photo2: { a: 147.25, d: 8.22, h: 0.25, tx: -0.284, ty: 0.733, fov: 19.24, rl: 0.5 },
};
export const JESKO_GARAGE = {
  name: 'Koenigsegg Jesko Attack', sub: '白色紅點綴那台 · 3D 試做版',
  paints: [['#f1f2f3', '白（照片 1）'], ['#c5c9ce', '月光銀（照片 2）'], ['#ff6a13', '柑橘橘'], ['#16171a', '碳黑'], ['#1c3f9e', '藍'], ['#0e6b4b', '翡翠綠'], ['#c8141e', '紅'], ['#d6b25c', '金']],
  opts: {
    wing: [['stock', '原廠大尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['red', '紅色點綴'], ['green', '綠色點綴'], ['none', '不要']],
  },
  state: { paint: '#f1f2f3', rim: 'black', caliper: '#c8141e', wing: 'stock', kit: 'stock', height: '0', livery: 'red', tint: 'light' },
};
