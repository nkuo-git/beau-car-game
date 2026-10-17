// 3D McLaren Senna（2018）：輪子（十根細輻條、中央鎖）、大尾翼（兩根鵝頸支架、雙片翼）、後照鏡、下巴、側裙、擴散器、頂出排氣管、相機、車庫選項
// 遊戲裡的名字是自己編的（SN8 大尾翼），沒有真的品牌名字、標誌、字。
// 拉花「紅黑雙色」（照片 1）：引擎蓋中間、車頂、車門前面的黑色在 senna-look.js 畫；這裡是跟著拉花換色的零件（尾翼端板、下巴和側裙的細邊）
import * as THREE from 'three';
import { SENNA_LOOK } from './senna-look.js';

// 一片有厚度的板子：給四個角（依序），往板子法線兩邊各長 th/2
function SENNA_slab(pts, th) {
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
// 側面輪廓（x, y）往 z 拉厚 th，中心放在 z0（回傳幾何）
function SENNA_plate(pts, th, z0, bevel = 0.003) {
  const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, z0 - th / 2); return g;
}
// 很多塊幾何併成一塊（同材質少一點 draw call）：全部轉成沒有 index 的，位置、法線接起來
function SENNA_merge(list) {
  const pos = [], nor = [];
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return m;
}
const SENNA_at = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
};

// 拉花點綴：材質跟著拉花換（拉花開＝車身顏色，關＝碳纖維黑）；車漆 shader 編譯時把 uLiv 抓過來
function SENNA_accent(mats, paint) {
  if (mats.sennaAcc) return mats.sennaAcc;
  const m = new THREE.MeshPhysicalMaterial({ color: paint.color.clone(), roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const liv = { u: null };
  m.userData.liv = liv;
  m.userData.update = () => { const on = liv.u ? liv.u.value > 0.5 : true; if (on) m.color.copy(paint.color); else m.color.set(0x17181b); };
  mats.sennaAcc = m;
  return m;
}
const SENNA_tag = (mesh, mats) => { mesh.onBeforeRender = () => mats.sennaAcc.userData.update(); return mesh; };

// ---- 輪框：十根細輻條（五組 V 字，靠中間併在一起、到輪緣分開），中央鎖螺帽 ----
function SENNA_rim(rim, w, mats) {
  const ro = rim - 0.012, rh = 0.07, zo = w / 2 - 0.028, zi = w / 2 - 0.08;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  const zAt = (r) => zi + (zo - zi) * Math.min(1, (r - rh) / (ro - rh)) ** 0.7;
  const list = [];
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.10, ao = a + s * 0.27, rm = (rh + ro) / 2, am = a + s * 0.19;
      list.push(SENNA_slab([P(rh, ai, zi, -0.011), P(rm, am, zAt(rm), -0.0085), P(rm, am, zAt(rm), 0.0085), P(rh, ai, zi, 0.011)], 0.02));
      list.push(SENNA_slab([P(rm - 0.004, am, zAt(rm), -0.0085), P(ro, ao, zo, -0.007), P(ro, ao, zo, 0.007), P(rm - 0.004, am, zAt(rm), 0.0085)], 0.018));
    }
  }
  const hub = new THREE.CylinderGeometry(0.075, 0.085, 0.04, 36); hub.rotateX(Math.PI / 2); hub.translate(0, 0, zi + 0.004); list.push(hub);
  const ring = new THREE.TorusGeometry(ro + 0.002, 0.005, 6, 80); ring.translate(0, 0, zo + 0.004); list.push(ring);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(SENNA_merge(list), mats.chrome));
  // 中央鎖螺帽（銀色）
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.05, 6), mats.alu);
  nut.geometry.rotateX(Math.PI / 2); nut.position.z = zi + 0.035; g.add(nut);
  return g;
}
SENNA_rim.capInset = 0.07;

// ---- 大尾翼：主翼＋後面往上翹的副翼，兩邊大端板，兩根鵝頸支架從後甲板往上彎過來勾在翼的上面 ----
export const SENNA_WING = { span: 0.917, x0: -1.715, y0: 1.105, c0: 0.31, x1: -1.985, y1: 1.12, c1: 0.24, pylonZ: 0.36 };
function SENNA_foil(le, y, c, aoa, span, th = 0.11, camber = -0.05) {
  const N = 16, pts = [];
  const up = [], lo = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const tk = th * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4), cm = camber * Math.sin(Math.PI * xc);
    const X = (yy) => [le - xc * c * Math.cos(aoa) - yy * c * Math.sin(aoa), y + xc * c * Math.sin(aoa) + yy * c * Math.cos(aoa)];
    up.push(X(cm + tk)); lo.push(X(cm - tk));
  }
  pts.push(...up, ...lo.slice(1, -1).reverse());
  const pos = [], idx = [], n = pts.length;
  for (const z of [-span, span]) for (const [x, yy] of pts) pos.push(x, yy, z);
  for (let j = 0; j < n; j++) { const a = j, b = (j + 1) % n, c2 = n + j, d = n + ((j + 1) % n); idx.push(a, b, c2, b, d, c2); }
  // 兩端封起來
  for (let j = 1; j < n - 1; j++) { idx.push(0, j + 1, j); idx.push(n, n + j, n + j + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function SENNA_wingMesh(paint, mats, W = SENNA_WING) {
  const g = new THREE.Group(), acc = SENNA_accent(mats, paint), carbon = [];
  carbon.push(SENNA_foil(W.x0, W.y0, W.c0, 0.10, W.span));
  carbon.push(SENNA_foil(W.x1, W.y1, W.c1, 0.42, W.span, 0.10, -0.04));
  // 端板：圓角的長方形，外面一片拉花色（照片 1 是紅的；不畫標誌）
  const EP = [];
  for (let i = 0; i < 24; i++) { // 圓角長方形（x −1.69…−2.20、y 0.975…1.235，圓角 0.05）
    const k = Math.floor(i / 6), a = (i % 6) / 5 * Math.PI / 2 + k * Math.PI / 2, cx = k === 0 || k === 3 ? -1.74 : -2.15, cy = k < 2 ? 1.185 : 1.025;
    EP.push([cx + Math.cos(a) * 0.05, cy + Math.sin(a) * 0.05]);
  }
  for (const s of [-1, 1]) {
    carbon.push(SENNA_plate(EP, 0.01, s * (W.span + 0.006), 0.003));
    g.add(SENNA_tag(new THREE.Mesh(SENNA_plate(EP.map(([x, y]) => [-1.945 + (x + 1.945) * 0.95, 1.105 + (y - 1.105) * 0.9]), 0.004, s * (W.span + 0.014), 0.002), acc), mats));
  }
  // 鵝頸支架：從後甲板往上、往後彎，勾在主翼上面
  for (const s of [-1, 1]) {
    const neck = [[-1.58, 0.80], [-1.62, 0.92], [-1.68, 1.04], [-1.76, 1.135], [-1.84, 1.175], [-1.93, 1.185], [-1.98, 1.16], [-1.96, 1.135],
      [-1.86, 1.135], [-1.79, 1.10], [-1.73, 1.02], [-1.69, 0.92], [-1.67, 0.80]];
    carbon.push(SENNA_plate(neck, 0.022, s * W.pylonZ, 0.004));
  }
  const m = new THREE.Mesh(SENNA_merge(carbon), mats.carbon); m.name = 'senna-wing'; g.add(m);
  // 副翼後緣的小擾流片（賽道套件才看得到）
  const fl = new THREE.Mesh(SENNA_at(new THREE.BoxGeometry(0.01, 0.035, 2 * W.span - 0.02), W.x1 - W.c1 * Math.cos(0.42) - 0.002, W.y1 + W.c1 * Math.sin(0.42) + 0.012, 0), mats.carbon);
  fl.name = 'flap'; fl.visible = false; g.add(fl);
  return g;
}

// ---- 後照鏡：細細的支架從車門上緣伸出去，碳纖維鏡殼，鏡面朝後 ----
function SENNA_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI), mats.carbon);
  head.scale.set(0.12, 0.052, 0.085); head.rotation.y = s * 0.10; head.position.set(0.575, 0.872, s * 0.965); g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mats.mirrorGlass);
  glass.scale.set(0.07, 0.042, 1); glass.rotation.y = -Math.PI / 2; glass.position.set(0.505, 0.872, s * 0.965); g.add(glass);
  g.add(new THREE.Mesh(SENNA_slab([[0.68, 0.755, s * 0.84], [0.62, 0.86, s * 0.93], [0.57, 0.86, s * 0.93], [0.63, 0.755, s * 0.84]], 0.016), mats.carbon));
  return g;
}

// ---- 下巴、側裙、擴散器、車尾網子、排氣管（原廠就有）----
const SENNA_FRONT = [[2.335, 0], [2.33, 0.30], [2.30, 0.50], [2.24, 0.64], [2.14, 0.75], [2.0, 0.84], [1.86, 0.90], [1.72, 0.93]];
function SENNA_base(paint, mats) {
  const g = new THREE.Group(), acc = SENNA_accent(mats, paint), carbon = [], black = [], stripe = [];
  // 下巴：大片碳纖維，往前伸到車頭最前面
  const sh = new THREE.Shape(), F = SENNA_FRONT, zb = F[F.length - 1][1];
  sh.moveTo(1.55, -zb); sh.lineTo(F[F.length - 1][0], -zb);
  sh.splineThru(F.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(F.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(1.55, zb); sh.closePath();
  const sp = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 24 });
  sp.rotateX(Math.PI / 2); sp.translate(0, 0.104, 0); carbon.push(sp);
  // 下巴前緣一條拉花色細邊（照片 1 是紅的）
  const half = F.map(([x, z]) => [x + 0.004, z]);
  const edge = [...half.slice(1).reverse().map(([x, z]) => new THREE.Vector3(x, 0.084, -z)), ...half.map(([x, z]) => new THREE.Vector3(x, 0.084, z))];
  stripe.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 90, 0.006, 5, false));
  for (const s of [-1, 1]) {
    // 下巴兩端的直立小鰭
    carbon.push(SENNA_slab([[2.22, 0.09, s * 0.80], [2.02, 0.09, s * 0.93], [2.02, 0.20, s * 0.93], [2.16, 0.17, s * 0.82]], 0.012));
    // 側裙：碳纖維刀片＋上緣拉花色細邊
    carbon.push(SENNA_slab([[-1.12, 0.115, s * 0.90], [0.72, 0.115, s * 0.90], [0.70, 0.115, s * 0.975], [-1.10, 0.115, s * 0.972]], 0.014));
    carbon.push(SENNA_slab([[-1.12, 0.12, s * 0.955], [0.72, 0.12, s * 0.955], [0.70, 0.22, s * 0.935], [-1.10, 0.20, s * 0.935]], 0.012));
    stripe.push(SENNA_at(new THREE.CylinderGeometry(0.005, 0.005, 1.80, 5), -0.20, 0.205, s * 0.945, 0, 0, Math.PI / 2 - 0.009));
  }
  // 擴散器：底板往後上翹＋八片直立鰭片（往下伸、很高）
  carbon.push(SENNA_slab([[-1.85, 0.12, -0.80], [-1.85, 0.12, 0.80], [-2.38, 0.33, 0.80], [-2.38, 0.33, -0.80]], 0.012));
  for (const z of [-0.70, -0.52, -0.34, -0.14, 0.14, 0.34, 0.52, 0.70]) {
    const k = 1 - Math.abs(z) / 0.9;
    carbon.push(SENNA_plate([[-1.92, 0.125], [-2.37, 0.17 + 0.03 * (1 - k)], [-2.39, 0.35], [-2.30, 0.35], [-2.08, 0.22]], 0.012, z, 0.002));
  }
  // 車尾碳纖維橫樑（掛車牌那條）的兩端：往後伸的角
  for (const s of [-1, 1]) carbon.push(SENNA_slab([[-2.22, 0.36, s * 0.90], [-2.37, 0.36, s * 0.84], [-2.37, 0.50, s * 0.84], [-2.24, 0.50, s * 0.91]], 0.02));
  // 頂出排氣管：後甲板中間、兩根大大的橢圓管子併在一起，外面一圈碳纖維框
  const sur = new THREE.TorusGeometry(1, 0.2, 8, 36); sur.scale(0.20, 0.10, 0.06); sur.rotateY(Math.PI / 2); sur.rotateZ(0.95); sur.translate(-2.07, 0.79, 0); carbon.push(sur);
  const back = new THREE.CircleGeometry(1, 36); back.scale(0.19, 0.095, 1); back.rotateY(-Math.PI / 2); back.rotateZ(0.95); back.translate(-2.055, 0.78, 0); black.push(back);
  g.add(new THREE.Mesh(SENNA_merge(carbon), mats.carbon), new THREE.Mesh(SENNA_merge(black), mats.black));
  for (const z of [-0.08, 0.08]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.07, 28, 1, true), mats.alu);
    p.material.side = THREE.DoubleSide; p.geometry.rotateZ(Math.PI / 2); p.geometry.scale(1, 0.72, 1);
    p.rotation.z = 0.95; p.position.set(-2.07, 0.79, z); g.add(p);
  }
  g.add(SENNA_tag(new THREE.Mesh(SENNA_merge(stripe), acc), mats));
  return g;
}
// 賽道套件：下巴兩邊多兩片風刀、側裙下多一片刀片（尾翼副翼後緣的 Gurney 小擾流在尾翼裡，名字 flap）
function SENNA_track(mats) {
  const list = [];
  for (const s of [-1, 1]) {
    for (const [y, dx] of [[0.30, 0], [0.38, -0.04]]) list.push(SENNA_slab([[2.20 + dx, y, s * 0.72], [2.04 + dx, y + 0.035, s * 0.88], [2.0 + dx, y + 0.035, s * 0.95], [2.14 + dx, y, s * 0.80]], 0.008));
    list.push(SENNA_slab([[-1.05, 0.105, s * 0.975], [0.66, 0.105, s * 0.975], [0.62, 0.105, s * 1.02], [-1.0, 0.105, s * 1.02]], 0.008));
  }
  return new THREE.Mesh(SENNA_merge(list), mats.carbon);
}

export const SENNA_SPEC = {
  look: SENNA_LOOK, paint: '#c8101c', metal: 0.08, seat: 0x1b1c1f,
  wheels: { xf: 1.092, xr: -1.578, RF: 0.327, RR: 0.3485, rimF: 0.2413, rimR: 0.254, trackF: 0.84, trackR: 0.815, wF: 0.245, wR: 0.315, style: SENNA_rim },
  mirror: (paint, mats, s) => SENNA_mirror(paint, mats, s),
  wings: { stock: (paint, mats) => SENNA_wingMesh(paint, mats) },
  wing: 'stock',
  interior: { dx: 0.12, cage: false, wheelZ: -0.33, dashX: 0.55, dashY: 0.80, shelf: false, seatDy: -0.06 },
  build(body, paint, mats) {
    // 車漆補丁：拉花「紅黑雙色」的上面那張（引擎蓋黑帶、車頂）畫在朝上、朝前的面；側面拉花貼圖左上角有記號才畫（通用拉花沒有）
    const acc = SENNA_accent(mats, paint), ob = paint.onBeforeCompile, ok = paint.customProgramCacheKey;
    const topTex = new THREE.CanvasTexture(SENNA_LOOK.topLivery()); topTex.colorSpace = THREE.SRGBColorSpace; topTex.anisotropy = 8;
    paint.onBeforeCompile = (sh, r) => {
      ob(sh, r);
      acc.userData.liv.u = sh.uniforms.uLiv;
      sh.uniforms.tSennaTop = { value: topTex };
      sh.fragmentShader = 'uniform sampler2D tSennaTop;\nfloat sennaLT;\n' + sh.fragmentShader.replace('diffuseColor.rgb = mix(diffuseColor.rgb, LV.rgb, LV.a * sideW * uLiv);', `$&
  { float mk = vP.z > 0.0 ? texture2D(tLivR, vec2(0.003, 0.99)).a : texture2D(tLivL, vec2(0.003, 0.99)).a;
    vec4 LT = texture2D(tSennaTop, uvTop(vP));
    sennaLT = LT.a * (1.0 - sideW) * uLiv * step(0.5, mk);
    diffuseColor.rgb = mix(diffuseColor.rgb, LT.rgb, sennaLT); }`)
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.clearcoat *= 1.0 - 0.75 * sennaLT;')
        // 側面貼圖的 A 通道（共用的 shader 沒用到）＝霧面黑：側面進氣口裡面那些不朝側面的壁，亮黑會反光變成銀色
        .replace('matte = max(matte, max(well, under));', '$&\n  matte = max(matte, S.a * step(0.55, abs(vP.z)));');
    };
    paint.customProgramCacheKey = () => (ok ? ok() : '') + '+senna';
    body.add(SENNA_base(paint, mats));
    const track = SENNA_track(mats); track.visible = false; body.add(track);
    const flap = body.getObjectByName('wing-stock')?.getObjectByName('flap');
    return (kit) => { track.visible = kit === 'track'; if (flap) flap.visible = kit === 'track'; };
  },
  kit: 'stock',
};
// 照片相機（senna3d/ba.mjs：五張照片一起解，輪子、地平線、後照鏡、尾翼端板、下車窗角、車頭徽章位置、前後車牌）
export const SENNA_CAMS = {
  photo1: { a: 51.168, d: 5.836, h: 1.421, tx: 0.239, ty: 0.336, fov: 23.216, rl: -2.539 },
  photo2: { a: 40.697, d: 6.969, h: 1.579, tx: 0.312, ty: 0.54, fov: 20.009, rl: -1.005 },
  photo3: { a: 134.981, d: 5.287, h: 1.481, tx: -0.746, ty: 0.405, fov: 25.75, rl: -0.089 },
  x1: { a: -32.014, d: 3.943, h: 1.468, tx: 0.776, ty: 0.536, fov: 35.205, rl: 0.59 },
  x3: { a: -151.401, d: 4.409, h: 1.508, tx: -1.211, ty: 0.472, fov: 23.719, rl: -1.113 },
};
export const SENNA_GARAGE = {
  name: 'SN8 大尾翼', sub: '紅黑大尾翼超跑 · 3D 試做版',
  paints: [['#c8101c', '賽道紅（照片 1）'], ['#16171a', '碳纖維黑（照片 2）'], ['#1f2f8f', '寶石藍'], ['#f2f3f4', '白'], ['#ff7a10', '木瓜橘'], ['#9aa0a6', '銀灰'], ['#1d6b3c', '英國綠'], ['#e8c21a', '黃']],
  opts: {
    wing: [['stock', '原廠大尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['duo', '紅黑雙色'], ['none', '不要']],
  },
  state: { paint: '#c8101c', rim: 'black', caliper: '#c8101c', wing: 'stock', kit: 'stock', height: '0', livery: 'duo', tint: 'light' },
};
