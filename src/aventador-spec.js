// 3D Lamborghini Aventador S（車庫名字「AV12 剪刀門」）：輪子（十根往外分叉的細輻條）、主動式尾翼（收起來／升起來）、
// 後照鏡、碳纖維下巴、側裙、擴散器、中間六角形排氣管、相機、車庫選項
// 拉花「黃色細線」同時決定下巴、側裙邊緣那條細線的顏色（跟 Jesko 的點綴色一樣做法）
import * as THREE from 'three';
import { slab, aeroKit } from './parts.js';
import { AVENTADOR_LOOK } from './aventador-look.js';

// 側面輪廓（x, y）往 z 拉厚 th，放在 z0
function AVENTADOR_plate(pts, th, z0, mat, bevel = 0.004) {
  const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 }), mat);
  m.position.z = z0 - th / 2; return m;
}
// 拉花點綴色：車漆編譯時抓 uLiv；拉花 'none' 時變回碳纖維黑
function AVENTADOR_accent(mats) {
  if (mats.avAcc) return mats.avAcc;
  const m = new THREE.MeshPhysicalMaterial({ color: AVENTADOR_LOOK.accent(), roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
  const liv = { u: null };
  m.userData.liv = liv;
  m.userData.update = () => { const on = liv.u ? liv.u.value > 0.5 : true; m.color.set(on ? AVENTADOR_LOOK.accent() : 0x17181b); };
  mats.avAcc = m;
  return m;
}
const AVENTADOR_tag = (mesh, mats) => { mesh.onBeforeRender = () => mats.avAcc.userData.update(); return mesh; };

// ---- 輪框：十根輻條從中間出來、快到輪緣分成兩叉（照片那兩台的多輻鍛造框），往中間凹 ----
function AVENTADOR_rim(rim, w, mats) {
  const g = new THREE.Group(), list = [];
  const ro = rim - 0.012, rs = rim * 0.62, rh = 0.072, zo = w / 2 - 0.03, zi = w / 2 - 0.085;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  const zAt = (r) => zi + (zo - zi) * Math.min(1, ((r - rh) / (ro - rh)) ** 0.7);
  for (let j = 0; j < 10; j++) {
    const a = (j * 2 * Math.PI) / 10, tw = 0.10; // 輻條稍微扭一點
    list.push(slab([P(rh, a, zi, -0.013), P(rs, a + tw, zAt(rs), -0.010), P(rs, a + tw, zAt(rs), 0.010), P(rh, a, zi, 0.013)], 0.02));
    for (const s of [-1, 1]) {
      const ao = a + tw + s * 0.115;
      list.push(slab([P(rs - 0.01, a + tw + s * 0.012, zAt(rs), -0.007), P(ro, ao, zo, -0.006), P(ro, ao, zo, 0.006), P(rs - 0.01, a + tw + s * 0.012, zAt(rs), 0.007)], 0.016));
    }
  }
  const geo = AVENTADOR_merge(list);
  g.add(new THREE.Mesh(geo, mats.chrome));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.092, 0.04, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.004; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
AVENTADOR_rim.capInset = 0.07;
// 幾何合成一個（只留 position、normal），輻條很多，合起來 draw call 才少
function AVENTADOR_merge(list) {
  const P = [], N = []; let n = 0;
  for (let q of list) { if (q.index) q = q.toNonIndexed(); P.push(q.attributes.position.array); N.push(q.attributes.normal.array); n += q.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}

// ---- 後照鏡：有角的鏡殼（車色）、黑色細支架從車門上緣伸出去、鏡面朝後 ----
function AVENTADOR_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); // 側面看的鏡殼：前面尖、後面平
  sh.moveTo(0.075, 0.0); sh.lineTo(0.02, 0.042); sh.lineTo(-0.075, 0.040); sh.lineTo(-0.085, -0.025); sh.lineTo(0.0, -0.040); sh.closePath();
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), paint);
  head.position.set(0.56, 0.935, s > 0 ? 0.955 : -0.955 - 0.11); g.add(head);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.06), mats.mirrorGlass);
  glass.rotation.y = -Math.PI / 2; glass.position.set(0.56 - 0.098, 0.935, s * 1.01); g.add(glass);
  g.add(new THREE.Mesh(slab([[0.64, 0.85, s * 0.84], [0.58, 0.91, s * 0.965], [0.53, 0.91, s * 0.965], [0.58, 0.85, s * 0.84]], 0.018), mats.black));
  return g;
}

// ---- 主動式尾翼：收起來＝平平的貼在車尾兩個尾燈中間；升起來＝往上升 9 公分、前緣朝下一點 ----
function AVENTADOR_wing(paint, mats, up) {
  const g = new THREE.Group();
  const chord = 0.29, span = 1.20, x = -2.205, y = up ? 1.04 : 0.938;
  const s = new THREE.Shape(), N = 16, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.07 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const cam = -0.03 * Math.sin(Math.PI * xc);
    top.push([xc, cam + th]); bot.push([xc, cam - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 }), paint);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = up ? 0.12 : 0.17; blade.position.set(x, y, 0); g.add(blade);
  // 尾翼下緣的黑邊（尾緣）
  const te = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, span), mats.black);
  te.position.set(x - chord * 0.48, y - 0.012 + (up ? 0.012 : 0.02), 0); g.add(te);
  if (up) for (const sz of [-1, 1]) { // 兩根黑色支架
    const st = new THREE.Shape(), hh = y - 0.92;
    st.moveTo(-0.06, 0); st.lineTo(0.07, 0); st.lineTo(0.04, hh); st.lineTo(-0.05, hh); st.closePath();
    const p = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), mats.black);
    p.position.set(x, 0.92, sz * 0.42 - 0.008); g.add(p);
  }
  return g;
}

// ---- 原廠：碳纖維下巴（黃邊）、側裙（黃邊）、擴散器、中間六角形排氣管 ----
function AVENTADOR_splitter(mats) {
  const g = new THREE.Group(), acc = AVENTADOR_accent(mats);
  const front = [[2.31, 0], [2.30, 0.25], [2.26, 0.46], [2.18, 0.62], [2.06, 0.75], [1.93, 0.83]], back = 1.85;
  const shape = (F, k) => {
    const sh = new THREE.Shape(), zb = F[F.length - 1][1];
    sh.moveTo(back, -zb); sh.lineTo(F[F.length - 1][0], -zb);
    sh.splineThru(F.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
    sh.splineThru(F.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
    sh.lineTo(back, zb); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: k, bevelEnabled: false, curveSegments: 24 });
  };
  const sp = new THREE.Mesh(shape(front, 0.016), mats.black); sp.rotation.x = Math.PI / 2; sp.position.y = 0.112; g.add(sp);
  // 前緣一條細細的點綴色（往外多 6 公釐）
  const edge = AVENTADOR_tag(new THREE.Mesh(shape(front.map(([x, z]) => [x + 0.006, z * 1.004]), 0.006), acc), mats);
  edge.rotation.x = Math.PI / 2; edge.position.y = 0.106; g.add(edge);
  // 側裙：碳纖維刀片，外緣點綴色
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(slab([[-1.18, 0.112, s * 0.86], [0.80, 0.112, s * 0.86], [0.78, 0.112, s * 0.935], [-1.16, 0.112, s * 0.96]], 0.014), mats.carbon));
    g.add(AVENTADOR_tag(new THREE.Mesh(slab([[-1.16, 0.112, s * 0.96], [0.78, 0.112, s * 0.935], [0.78, 0.112, s * 0.942], [-1.16, 0.112, s * 0.967]], 0.016), acc), mats));
  }
  return g;
}
function AVENTADOR_diffuser(mats) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(slab([[-1.95, 0.14, -0.84], [-1.95, 0.14, 0.84], [-2.40, 0.32, 0.84], [-2.40, 0.32, -0.84]], 0.014), mats.black));
  for (const z of [-0.78, -0.56, 0.56, 0.78]) g.add(AVENTADOR_plate([[-1.98, 0.145], [-2.42, 0.33], [-2.44, 0.42], [-2.34, 0.42], [-2.14, 0.30]], 0.012, z, mats.carbon, 0.002));
  return g;
}
function AVENTADOR_exhaust(mats) {
  const g = new THREE.Group(), x = -2.34, y = 0.315, hw = 0.215, hh = 0.062;
  const hex = (k) => { const s = new THREE.Shape(); s.moveTo(-hw * k, 0); s.lineTo(-hw * k + hh * k * 0.8, hh * k); s.lineTo(hw * k - hh * k * 0.8, hh * k); s.lineTo(hw * k, 0); s.lineTo(hw * k - hh * k * 0.8, -hh * k); s.lineTo(-hw * k + hh * k * 0.8, -hh * k); s.closePath(); return s; };
  const ring = hex(1); ring.holes.push(hex(0.84));
  const bez = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 }), mats.alu);
  bez.rotation.y = -Math.PI / 2; bez.position.set(x + 0.06, y, 0); g.add(bez);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(hex(0.86)), mats.black);
  back.rotation.y = -Math.PI / 2; back.position.set(x + 0.04, y, 0); g.add(back);
  for (const z of [-0.115, 0, 0.115]) { // 裡面三根圓管
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.05, 24, 1, true), mats.alu);
    p.material = mats.alu; p.geometry.rotateZ(Math.PI / 2); p.position.set(x + 0.02, y, z); g.add(p);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.029, 24), mats.black);
    hole.rotation.y = -Math.PI / 2; hole.position.set(x + 0.01, y, z); g.add(hole);
  }
  return g;
}

// 車門後面大進氣口裡的兩片斜的導流片（跟進氣口前緣平行）
function AVENTADOR_strakes(mats) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) for (const [xb, xt, yt] of [[-0.55, -0.915, 0.82], [-0.70, -0.995, 0.705]]) {
    const pts = [[xb, 0.30, s * 0.85], [xt, yt, s * 0.85], [xt, yt, s * 0.965], [xb, 0.30, s * 0.965]];
    g.add(new THREE.Mesh(slab(s > 0 ? pts : pts.reverse(), 0.012), mats.carbon));
  }
  return g;
}

// 賽道套件：碳纖維大下巴、保桿角的風刀、側裙刀片、大一點的擴散器（parts.js aeroKit）
const AVENTADOR_AERO = {
  front: [[2.47, 0], [2.46, 0.28], [2.40, 0.52], [2.29, 0.71], [2.14, 0.85], [1.97, 0.95]], back: 1.90, y: 0.095, rods: [2.40, 0.14],
  canard: { S: [2.16, 0.84], t: [-0.6, 0.8], ys: [0.33, 0.26] },
  skirt: { y: 0.10, x0: -1.16, x1: 0.78, z0: 0.88, z1: 1.01 },
  diff: { x0: -1.92, x1: -2.25, x2: -2.46, y0: 0.13, y1: 0.16, y2: 0.27, w: 0.70, fin0: -1.98 },
};

export const AVENTADOR_SPEC = {
  look: AVENTADOR_LOOK, paint: '#1f3fae', metal: 0.45, seat: 0x16171a,
  wheels: { xf: 1.15, xr: -1.55, RF: 0.3305, RR: 0.3555, rimF: 0.254, rimR: 0.2667, trackF: 0.86, trackR: 0.84, wF: 0.255, wR: 0.355, style: AVENTADOR_rim },
  mirror: (paint, mats, s) => AVENTADOR_mirror(paint, mats, s),
  wings: {
    stock: (paint, mats) => AVENTADOR_wing(paint, mats, false),
    up: (paint, mats) => AVENTADOR_wing(paint, mats, true),
  },
  wing: 'stock',
  interior: { dx: -0.12, cage: false, wheelZ: -0.36, dashX: 0.42, dashY: 0.74, seatDy: -0.12, shelf: false },
  build(body, paint, mats) {
    const acc = AVENTADOR_accent(mats), ob = paint.onBeforeCompile;
    paint.onBeforeCompile = (sh, r) => { ob(sh, r); acc.userData.liv.u = sh.uniforms.uLiv; };
    body.add(AVENTADOR_splitter(mats), AVENTADOR_diffuser(mats), AVENTADOR_exhaust(mats), AVENTADOR_strakes(mats));
    const aero = aeroKit(mats, AVENTADOR_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};
// 照片相機（aventador3d/silfit.mjs：輪子＋車身輪廓＋照片 3 的車牌反推）
export const AVENTADOR_CAMS = {
  photo1: { a: 29.096, d: 6.208, h: 1.692, tx: 0.605, ty: 0.41, fov: 18.959, rl: -2.888 },
  photo2: { a: -36.238, d: 6.258, h: 1.284, tx: 0.499, ty: 0.468, fov: 18.87, rl: 4.593 },
  photo3: { a: -151.995, d: 7.064, h: 1.909, tx: -0.76, ty: 0.307, fov: 17.803, rl: -1.59 },
};
export const AVENTADOR_GARAGE = {
  name: 'AV12 剪刀門', sub: '藍色剪刀門超跑 · 3D 試做版',
  paints: [['#1f3fae', '深海藍（照片 1）'], ['#121316', '黑（照片 2）'], ['#5b5e63', '鈦灰（照片 3）'], ['#7ac70c', '螢光綠'], ['#f2c40c', '黃'], ['#f26a0c', '橘'], ['#f4f5f6', '白'], ['#c8141e', '紅']],
  opts: {
    wing: [['stock', '原廠（收起來）'], ['up', '尾翼升起來'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.025', '降低'], ['-0.045', '貼地']],
    livery: [['stripe', '黃色細線'], ['ys', 'Y 字條紋'], ['none', '不要']],
  },
  state: { paint: '#1f3fae', rim: 'black', caliper: '#f2b705', wing: 'stock', kit: 'stock', height: '0', livery: 'stripe', tint: 'light' },
};
