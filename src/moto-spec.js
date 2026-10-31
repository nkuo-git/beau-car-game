// 摩托車（第 59 批）的零件：F6 仿賽、N4 街車共用（自己設計的，沒有真的牌子）。
// 車殼＝moto-body.mjs 切出來的 body-f6(-q).glb／body-n4(-q).glb（公尺座標）。這裡做：車架（鋁合金雙翼樑）、後搖臂、倒立式前叉＋三角台、前土除、後土除、
// 把手（仿賽分離式、街車一字把）＋握把、拉桿、後照鏡、引擎（直四：曲軸箱、往前傾的汽缸、側蓋）、水箱、排氣管（四合一到右邊的尾段）、腳踏、鏈條＋齒盤、
// 側柱、座墊、油箱蓋、風鏡（仿賽）、圓燈（街車）、大燈的燈片、尾燈、車牌架、兩個輪子（圓胎、輪框、碟盤、卡鉗）；騎的人（跟 Z2 一樣：character.js 的 sit）。
import * as THREE from 'three';
import { rimFace } from './parts.js';
import { MOTO } from './moto-body.mjs';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
function box(sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}
const tube = (pts, r, seg = 40, rs = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2), seg, r, rs, false);
function rod(a, b, r, seg = 12, r2 = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r2, r, d.length(), seg);
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
function side(pts, z0, z1, bevel = 0.008, smooth = false) { // 側面的形狀（[x, y]）往 z 拉
  const sh = new THREE.Shape(); sh.moveTo(...pts[0]);
  if (smooth) sh.splineThru(pts.slice(1).map((p) => new THREE.Vector2(...p))); else for (const p of pts.slice(1)) sh.lineTo(...p);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0, z0 + bevel);
  return geo;
}
const mirrorZ = (geo) => { const g = geo.clone(); g.scale(1, 1, -1); const ix = g.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const at of [p, n]) { for (let c = 0; c < 3; c++) { const t = at.getComponent(i + 1, c); at.setComponent(i + 1, c, at.getComponent(i + 2, c)); at.setComponent(i + 2, c, t); } } } return g; };
const both = (geo) => [geo, mirrorZ(geo)];
// 輪子上面的弧形土除：半徑 r，角度 a0～a1（度，0＝車頭方向、90＝正上方），寬 ±hw，厚 t
function arcFender(cx, cy, r, a0, a1, hw, t = 0.01) {
  const sh = new THREE.Shape(), n = 24;
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; const p = [Math.cos(a) * (r + t), Math.sin(a) * (r + t)]; if (i) sh.lineTo(...p); else sh.moveTo(...p); }
  for (let i = n; i >= 0; i--) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 2 * hw - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 });
  geo.translate(cx, cy, -hw + 0.008);
  const p = geo.attributes.position; // 兩邊往下包一點（圓的）
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), k = (Math.abs(z) / hw) ** 2; p.setY(i, p.getY(i) - 0.035 * k * (p.getY(i) > cy ? 1 : 0.3)); }
  geo.computeVertexNormals();
  return geo;
}
// 圓胎：剖面是圓的（半徑 w/2 的弧），胎壁到輪框
function tyreGeo(R, w, rim) {
  const pts = [], hw = w / 2, c = R - hw * 0.9; // 胎冠的圓心
  pts.push(new THREE.Vector2(rim + 0.004, -hw * 0.92), new THREE.Vector2(rim + 0.03, -hw * 0.98));
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; pts.push(new THREE.Vector2(c + Math.cos(a) * hw * 0.9 + 0.0001 * i, Math.sin(a) * hw)); }
  pts.push(new THREE.Vector2(rim + 0.03, hw * 0.98), new THREE.Vector2(rim + 0.004, hw * 0.92));
  const g = new THREE.LatheGeometry(pts, 96); g.rotateX(Math.PI / 2); // 輪軸＝z
  return g;
}
// 一個輪子：圓胎、輪框（兩面都有輻條）、碟盤（兩邊）
export function motoWheel({ R, w, rim, mats, style = 'five', discs = 2, discR = 0.15 }) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tyreGeo(R, w, rim), mats.rubber));
  const bp = [[rim - 0.012, -w / 2 + 0.006], [rim + 0.006, -w / 2 + 0.002], [rim + 0.012, -w / 2 + 0.012], [rim + 0.012, w / 2 - 0.012], [rim + 0.006, w / 2 - 0.002], [rim - 0.012, w / 2 - 0.006]].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(bp, 96), mats.chrome); barrel.geometry.rotateX(Math.PI / 2); g.add(barrel);
  const f1 = rimFace(style, rim, w, mats, 1); f1.position.z = 0.02; g.add(f1); // 輻條：兩面（摩托車兩邊都看得到）
  const f2 = rimFace(style, rim, w, mats, -1); f2.rotation.y = Math.PI; f2.position.z = -0.02; g.add(f2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, w + 0.06, 24), mats.alu); hub.geometry.rotateX(Math.PI / 2); g.add(hub);
  // 碟盤：打洞的環（薄）
  const disc = new THREE.Shape(); disc.absarc(0, 0, discR, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, discR - 0.038, 0, Math.PI * 2, true); disc.holes.push(hole);
  for (let j = 0; j < 24; j++) { const a = j * Math.PI / 12, r = discR - 0.019; const h = new THREE.Path(); h.absarc(Math.cos(a) * r, Math.sin(a) * r, 0.004, 0, Math.PI * 2, true); disc.holes.push(h); }
  const dg = new THREE.ExtrudeGeometry(disc, { depth: 0.005, bevelEnabled: false, curveSegments: 48 });
  for (let k = 0; k < discs; k++) { const s = k ? -1 : 1, m = new THREE.Mesh(dg, mats.disc); m.position.z = s * (w / 2 + 0.018) - 0.0025; g.add(m); const car = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 24), mats.alu); car.geometry.rotateX(Math.PI / 2); car.position.z = s * (w / 2 + 0.012); g.add(car); }
  return g;
}

// 騎的人（跟 z2-spec.js 的 Z2_RIDE 一樣的欄位）：at＝屁股下面（座墊面 0.81 − 0.446）、grip 右手握把、foot 右腳的腳踝（腳踏上面 7 公分）、piv／ax 把手繞的龍頭軸（倒 24 度）
const U = [-Math.sin(MOTO.rake), Math.cos(MOTO.rake), 0];
export const MOTO_RIDE = {
  f6: { at: [-0.27, 0.364, 0], grip: [0.325, 0.99, 0.31], foot: [-0.13, 0.49, 0.225], piv: [0.42, 0.90, 0], ax: U, max: 0.4, view: { eye: [0.0, 1.45, 0], look: [3.2, 0.7, 0], fov: 72 } },
  n4: { at: [-0.25, 0.364, 0], grip: [0.31, 1.065, 0.345], foot: [-0.08, 0.47, 0.225], piv: [0.42, 0.90, 0], ax: U, max: 0.5, view: { eye: [0.0, 1.55, 0], look: [3.2, 0.7, 0], fov: 72 } },
};
const QS = new THREE.Quaternion(), VS = new THREE.Vector3(), PV = new THREE.Vector3(), AX = new THREE.Vector3();
export function motoSteer(body, s, key) {
  const b = body.userData.bars || (body.userData.bars = body.getObjectByName('bars')); if (!b) return;
  const R = MOTO_RIDE[key]; PV.fromArray(R.piv); AX.fromArray(R.ax).normalize();
  b.quaternion.setFromAxisAngle(AX, -s * R.max);
  b.position.copy(PV).sub(VS.copy(PV).applyQuaternion(b.quaternion));
}
const HD = [[0, 0, 0], [0, 0, 0]], FT = [0, 0, 0], UP = { state: 'sit', hands: HD, feet: FT };
export function motoRide(C, s, dt, key) {
  const R = MOTO_RIDE[key], at = R.at, G = R.grip; PV.fromArray(R.piv); AX.fromArray(R.ax).normalize();
  QS.setFromAxisAngle(AX, -s * R.max);
  for (let k = 0; k < 2; k++) {
    VS.set(G[0], G[1], (k ? 1 : -1) * G[2]).sub(PV).applyQuaternion(QS).add(PV);
    HD[k][0] = VS.x - at[0]; HD[k][1] = VS.y - at[1]; HD[k][2] = VS.z - at[2];
  }
  FT[0] = R.foot[0] - at[0]; FT[1] = R.foot[1] - at[1]; FT[2] = R.foot[2];
  C.update(dt, UP);
}

// 零件：key＝'f6'（仿賽）／'n4'（街車）；body＝車殼（paint 材質）；回傳 { setKit }
export function motoBuild(key, body, paint, mats) {
  const fair = key === 'f6';
  const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.55, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, metalness: 0.6 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.85, metalness: 0 });
  const aluF = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.4, metalness: 0.85 }); // 車架、搖臂（鑄鋁）
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.25, metalness: 1 }); // 前叉內管（鍍鈦金色）
  const brushed = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 1 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8f7f66, roughness: 0.35, metalness: 1 });
  const fin = new THREE.MeshStandardMaterial({ color: 0x8e9298, roughness: 0.45, metalness: 0.9 });
  const seatM = new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.9 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd4202a, roughness: 0.2, metalness: 0.2, emissive: 0xaa0a10, emissiveIntensity: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, clearcoat: 1, side: THREE.DoubleSide });
  const spring = new THREE.MeshStandardMaterial({ color: 0xe0c020, roughness: 0.35, metalness: 0.3 });
  const chainM = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.8 });
  const screenM = new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, roughness: 0.08, metalness: 0, clearcoat: 1, emissive: 0x0b3346, emissiveIntensity: 0.35 });
  const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }); shell.color = paint.color;
  const A = [MOTO.xf, MOTO.RF], u = U, fk = (t) => [A[0] + u[0] * t, A[1] + u[1] * t]; // 前叉線上（從前軸往上 t 公尺）
  const tL = 0.613, tT = 0.766; // 下三角台 y 0.86、上三角台 y 1.00
  // ---- 車架：雙翼樑（兩片鑄鋁，從龍頭到搖臂樞軸）＋副車架 ----
  const sparP = [[0.40, 0.95], [0.32, 0.93], [0.04, 0.78], [-0.15, 0.60], [-0.245, 0.47], [-0.245, 0.37], [-0.145, 0.37], [-0.12, 0.49], [0.06, 0.66], [0.36, 0.835], [0.43, 0.86]];
  const spars = [side(sparP, 0.118, 0.148, 0.006), side(sparP, -0.148, -0.118, 0.006)];
  spars.push(rod([-0.19, 0.42, -0.15], [-0.19, 0.42, 0.15], 0.018, 12), rod([0.0, 0.73, -0.12], [0.0, 0.73, 0.12], 0.014, 10)); // 樞軸、橫樑
  const head = rod(fk(0.58).concat([0]), fk(0.80).concat([0]), 0.032, 16); spars.push(head); // 龍頭管
  body.add(new THREE.Mesh(merge(spars), aluF));
  const sub = []; for (const s of [1, -1]) { sub.push(tube([[-0.08, 0.74, s * 0.115], [-0.45, 0.76, s * 0.10], [-0.80, 0.80, s * 0.06]], 0.011, 20, 8), tube([[-0.20, 0.58, s * 0.12], [-0.50, 0.70, s * 0.10]], 0.009, 10, 8)); }
  body.add(new THREE.Mesh(merge(sub), steel));
  // ---- 後搖臂（鋁、兩邊）＋後土除＋後避震 ----
  const swP = [[-0.20, 0.49], [-0.20, 0.40], [-0.64, 0.345], [-0.72, 0.345], [-0.72, 0.285], [-0.64, 0.285], [-0.24, 0.36]];
  const sw = [side(swP, 0.108, 0.14, 0.006), side(swP, -0.14, -0.108, 0.006), box(0.08, 0.08, 0.26, -0.30, 0.43, 0), box(0.025, 0.05, 0.05, -0.69, 0.315, 0.165), box(0.025, 0.05, 0.05, -0.69, 0.315, -0.165)];
  body.add(new THREE.Mesh(merge(sw), aluF));
  body.add(new THREE.Mesh(arcFender(MOTO.xr, MOTO.RR, 0.355, 50, 130, 0.105), plastic)); // 後土除（搖臂上）
  { // 後避震：筒（鋁）＋黃色彈簧，在引擎後面中間
    const a = [-0.33, 0.44, 0.0], b = [-0.27, 0.76, 0.0], A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), d = B3.clone().sub(A3), len = d.length(); d.normalize();
    const L = [rod(a, A3.clone().addScaledVector(d, len * 0.55).toArray(), 0.024, 16), rod(a, b, 0.009, 8)];
    const pts = [], turns = 8, v = new THREE.Vector3(0, 0, 1), w = d.clone().cross(v).normalize(), v2 = d.clone().cross(w);
    for (let i = 0; i <= turns * 16; i++) { const t = i / (turns * 16), an = t * turns * 2 * Math.PI; pts.push(A3.clone().addScaledVector(d, len * (0.15 + 0.7 * t)).addScaledVector(w, Math.cos(an) * 0.04).addScaledVector(v2, Math.sin(an) * 0.04)); }
    body.add(new THREE.Mesh(merge(L), mats.alu), new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.007, 6, false), spring));
  }
  // ---- 前叉（倒立式：上面粗的外管＋金色內管）、三角台、前土除、卡鉗；這一組跟著把手轉（bars）----
  const bars = new THREE.Group(); bars.name = 'bars';
  const outer = [], inner = [], clampL = [];
  for (const s of [1, -1]) {
    const z = s * 0.105;
    outer.push(rod(fk(0.26).concat([z]), fk(0.80).concat([z]), 0.027, 16), rod(fk(0.24).concat([z]), fk(0.27).concat([z]), 0.031, 16)); // 外管＋下面的油封蓋
    inner.push(rod(fk(-0.02).concat([z]), fk(0.26).concat([z]), 0.019, 14));
    clampL.push(box(0.09, 0.07, 0.05, ...fk(0.0).concat([z]), 0, 0, 0)); // 叉腳（軸的座）
    clampL.push(box(0.085, 0.045, 0.03, A[0] - Math.cos(0.35) * 0.015 - 0.06, A[1] - 0.055, s * 0.062, 0, 0, 0.35)); // 卡鉗（軸後下方）
  }
  const rk = MOTO.rake;
  clampL.push(box(0.085, 0.03, 0.275, ...fk(tL).concat([0]), 0, 0, -rk), box(0.075, 0.026, 0.255, ...fk(tT).concat([0]), 0, 0, -rk)); // 下、上三角台
  clampL.push(rod(fk(tL).concat([0]), fk(tT).concat([0]), 0.034, 16)); // 龍頭軸（看得到的那段）
  bars.add(new THREE.Mesh(merge(outer), dark), new THREE.Mesh(merge(inner), gold), new THREE.Mesh(merge(clampL), aluF));
  bars.add(new THREE.Mesh(arcFender(MOTO.xf, MOTO.RF, 0.335, 20, 150, 0.075), shell)); // 前土除（車身色）
  // 把手：仿賽＝分離式（夾在外管上，上三角台下面）；街車＝一字把（上三角台的座上）＋後照鏡
  const barG = [], gr = [], lv = [], mir = [], mirG = [], mirB = [], mirGl = [];
  if (fair) {
    for (const s of [1, -1]) {
      barG.push(rod(fk(tT - 0.03).concat([s * 0.105]), [0.355, 0.985, s * 0.22], 0.012, 10), rod([0.355, 0.985, s * 0.22], [0.31, 0.983, s * 0.345], 0.011, 10));
      barG.push(rod(fk(tT - 0.03).concat([s * 0.105]), fk(tT - 0.03).concat([s * 0.105]), 0.04, 16)); // 夾座
      gr.push(rod([0.337, 0.984, s * 0.27], [0.312, 0.983, s * 0.335], 0.017, 14), rod([0.312, 0.983, s * 0.335], [0.305, 0.983, s * 0.355], 0.02, 14));
      lv.push(rod([0.37, 0.99, s * 0.25], [0.44, 1.0, s * 0.34], 0.005, 6), box(0.03, 0.03, 0.03, 0.36, 0.99, s * 0.245));
      mir.push(tube([[0.73, 1.00, s * 0.22], [0.70, 1.05, s * 0.30], [0.66, 1.08, s * 0.37]], 0.009, 10, 8)); // 後照鏡：整流罩上的（殼車身色）
      const h = new THREE.SphereGeometry(0.07, 18, 12); h.scale(0.28, 0.6, 1); h.translate(0.645, 1.095, s * 0.41); mirG.push(h);
      const gl = new THREE.CircleGeometry(0.062, 20); gl.scale(1, 0.58, 1); gl.rotateY(-Math.PI / 2); gl.translate(0.628, 1.095, s * 0.41); mirGl.push(gl);
    }
  } else {
    barG.push(tube([[0.31, 1.065, -0.37], [0.355, 1.06, -0.20], [0.36, 1.055, 0], [0.355, 1.06, 0.20], [0.31, 1.065, 0.37]], 0.012, 60, 10));
    for (const s of [1, -1]) {
      barG.push(rod(fk(tT).concat([s * 0.05]), [0.36, 1.05, s * 0.05], 0.014, 10)); // 把手座
      gr.push(rod([0.338, 1.062, s * 0.265], [0.312, 1.065, s * 0.355], 0.017, 14), rod([0.312, 1.065, s * 0.355], [0.306, 1.065, s * 0.375], 0.02, 14));
      lv.push(rod([0.37, 1.07, s * 0.25], [0.44, 1.08, s * 0.34], 0.005, 6), box(0.03, 0.03, 0.03, 0.36, 1.07, s * 0.245));
      mir.push(tube([[0.35, 1.07, s * 0.22], [0.33, 1.14, s * 0.27], [0.30, 1.19, s * 0.31]], 0.008, 10, 8));
      const h = new THREE.SphereGeometry(0.05, 16, 10); h.scale(0.3, 1, 1); h.translate(0.30, 1.20, s * 0.33); mirB.push(h); // 圓鏡（黑殼）
      const gl = new THREE.CircleGeometry(0.045, 24); gl.rotateY(-Math.PI / 2); gl.translate(0.285, 1.20, s * 0.33); mirGl.push(gl);
    }
    // 圓燈（街車）：鍍鉻燈殼＋燈片，架在前叉上；儀表（圓的）在把手前面
    const bucket = new THREE.CylinderGeometry(0.095, 0.085, 0.11, 32); bucket.rotateZ(-Math.PI / 2); bucket.translate(0.555, 0.96, 0);
    bars.add(new THREE.Mesh(bucket, mats.chrome));
    const lp = new THREE.CircleGeometry(0.088, 32); lp.rotateY(Math.PI / 2); lp.translate(0.611, 0.96, 0); bars.add(new THREE.Mesh(lp, lens));
    const brk = []; for (const s of [1, -1]) brk.push(rod(fk(0.70).concat([s * 0.105]), [0.52, 0.96, s * 0.07], 0.007, 8));
    bars.add(new THREE.Mesh(merge(brk), steel));
    const dial = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 28); dial.rotateX(Math.PI / 2 - 0.5); dial.translate(0.42, 1.10, 0); bars.add(new THREE.Mesh(dial, plastic));
    const face = new THREE.CircleGeometry(0.05, 28); face.rotateX(-0.5); face.translate(0.43, 1.12, 0); bars.add(new THREE.Mesh(face, screenM));
  }
  bars.add(new THREE.Mesh(merge(barG), dark), new THREE.Mesh(merge(gr), grip), new THREE.Mesh(merge(lv), mats.alu), new THREE.Mesh(merge(mir), steel), new THREE.Mesh(merge(mirGl), mats.mirrorGlass || mats.chrome));
  if (mirG.length) (fair ? body : bars).add(new THREE.Mesh(merge(mirG), shell)); if (mirB.length) bars.add(new THREE.Mesh(merge(mirB), plastic));
  if (fair) { const fm = new THREE.Mesh(merge(mir), steel); bars.remove(bars.children[bars.children.length - 2]); body.add(fm); } // 仿賽的後照鏡裝在整流罩上：不跟著把手轉
  body.add(bars);
  if (fair) { // 風鏡（透明）、兩顆大燈的燈片、儀表（風鏡底下的螢幕）
    const seg = 18, pts = [], norm = [], idx = [];
    for (let i = 0; i <= seg; i++) { const v = i / seg, x = 0.62 - 0.22 * v + 0.03 * Math.sin(v * Math.PI), y = 1.02 + 0.15 * v; for (let j = 0; j <= 10; j++) { const z = -0.17 + 0.34 * j / 10, k = (z / 0.17) ** 2; pts.push(x - 0.07 * k - 0.02 * k * v, y - 0.03 * k, z); norm.push(0.7, 0.7, 0); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < 10; j++) { const a = i * 11 + j; idx.push(a, a + 1, a + 11, a + 1, a + 12, a + 11); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); sg.setIndex(idx); sg.computeVertexNormals();
    body.add(new THREE.Mesh(sg, glass));
    for (const s of [1, -1]) { const l = new THREE.PlaneGeometry(0.135, 0.045); l.rotateY(Math.PI / 2); l.rotateX(s * Math.atan(0.25)); l.translate(0.975, 0.86, s * 0.105); body.add(new THREE.Mesh(l, lens)); }
    const dash = box(0.08, 0.05, 0.16, 0.50, 0.985, 0, 0, 0, 0.4); body.add(new THREE.Mesh(dash, plastic));
    const scr = new THREE.PlaneGeometry(0.13, 0.04); scr.lookAt(new THREE.Vector3(-0.6, 0.8, 0)); scr.translate(0.47, 1.01, 0); body.add(new THREE.Mesh(scr, screenM));
  }
  // ---- 引擎：曲軸箱、往前傾 20 度的汽缸＋散熱片、汽缸頭蓋、兩邊的側蓋；水箱 ----
  const eng = [box(0.44, 0.26, 0.36, 0.03, 0.46, 0), box(0.30, 0.10, 0.32, -0.12, 0.40, 0)];
  const cyl = box(0.26, 0.24, 0.33, 0.21, 0.65, 0, 0, 0, -0.35); eng.push(cyl);
  const cov = box(0.22, 0.05, 0.30, 0.27, 0.78, 0, 0, 0, -0.35); eng.push(cov);
  for (const s of [1, -1]) { const c = new THREE.CylinderGeometry(s > 0 ? 0.105 : 0.09, s > 0 ? 0.105 : 0.09, 0.03, 32); c.rotateX(Math.PI / 2); c.translate(-0.02, 0.46, s * 0.19); eng.push(c); }
  body.add(new THREE.Mesh(merge(eng), dark));
  const fins = []; for (let k = 0; k < 5; k++) fins.push(box(0.20, 0.006, 0.34, 0.235 + 0.012 * k, 0.56 + k * 0.045, 0, 0, 0, -0.35));
  body.add(new THREE.Mesh(merge(fins), fin));
  const rad = box(0.04, 0.30, 0.34, 0.40, 0.58, 0, 0, 0, -0.15); body.add(new THREE.Mesh(rad, plastic)); // 水箱
  const radF = box(0.006, 0.28, 0.32, 0.422, 0.585, 0, 0, 0, -0.15); body.add(new THREE.Mesh(radF, fin));
  // ---- 排氣管：四支頭段從汽缸頭前面下來、合成一支到右邊的尾段（仿賽短的翹起來、街車長的）----
  const ex = [];
  for (const z of [-0.12, -0.04, 0.04, 0.12]) ex.push(tube([[0.33, 0.57, z], [0.42, 0.44, z * 0.9], [0.36, 0.30, z * 0.6], [0.10, 0.27, z * 0.3 + 0.06], [-0.10, 0.29, 0.10]], 0.016, 30, 8));
  ex.push(tube([[-0.10, 0.29, 0.10], [-0.28, 0.33, 0.16], [-0.40, 0.42, 0.19]], 0.03, 20, 10));
  body.add(new THREE.Mesh(merge(ex), bronze));
  const can = fair ? rod([-0.40, 0.42, 0.19], [-0.74, 0.60, 0.215], 0.052, 24, 0.045) : rod([-0.40, 0.42, 0.19], [-0.82, 0.53, 0.21], 0.05, 24, 0.045);
  body.add(new THREE.Mesh(can, brushed));
  const tip = fair ? rod([-0.74, 0.60, 0.215], [-0.78, 0.62, 0.215], 0.03, 16) : rod([-0.82, 0.53, 0.21], [-0.86, 0.54, 0.21], 0.03, 16);
  body.add(new THREE.Mesh(tip, steel));
  // ---- 腳踏（兩邊）：踏桿＋三角板、煞車踏板（右）、排檔桿（左）；側柱（左）----
  const fp = [], px = fair ? -0.13 : -0.08, py = 0.42;
  for (const s of [1, -1]) {
    fp.push(rod([px, py, s * 0.17], [px, py, s * 0.25], 0.012, 10), side([[px - 0.06, py + 0.02], [px + 0.04, py - 0.01], [px + 0.02, py + 0.16], [px - 0.08, py + 0.14]], s * 0.15 - 0.005, s * 0.15 + 0.005, 0.002));
    fp.push(rod([px + 0.03, py - 0.02, s * 0.17], [px + 0.20, py - 0.06, s * 0.19], 0.007, 8), rod([px + 0.20, py - 0.06, s * 0.19], [px + 0.22, py - 0.06, s * 0.26], 0.01, 8)); // 踏板／排檔桿
  }
  fp.push(rod([-0.30, 0.40, -0.14], [-0.36, 0.05, -0.24], 0.011, 8), box(0.05, 0.015, 0.05, -0.36, 0.04, -0.24)); // 側柱
  body.add(new THREE.Mesh(merge(fp), steel));
  // ---- 鏈條（左邊）：前齒盤、後齒盤、上下兩條 ----
  const ch = [], zc = -0.15, fs = [-0.19, 0.42], rs = [MOTO.xr, MOTO.RR], rF = 0.045, rR = 0.11;
  for (const [c, r] of [[fs, rF], [rs, rR]]) { const g = new THREE.CylinderGeometry(r, r, 0.008, 36); g.rotateX(Math.PI / 2); g.translate(c[0], c[1], zc); ch.push(g); }
  const dx = rs[0] - fs[0], dy = rs[1] - fs[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  for (const s of [1, -1]) { const a = [fs[0] + nx * rF * s, fs[1] + ny * rF * s, zc], b = [rs[0] + nx * rR * s, rs[1] + ny * rR * s, zc]; ch.push(box(L, 0.012, 0.016, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zc, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]))); }
  body.add(new THREE.Mesh(merge(ch), chainM));
  body.add(new THREE.Mesh(box(0.30, 0.03, 0.02, -0.50, 0.40, zc - 0.012, 0, 0, 0.25), plastic)); // 鏈條蓋
  // ---- 座墊（黑）、油箱蓋、尾燈、車牌架 ----
  const seatP = [[-0.03, 0.845], [-0.15, 0.825], [-0.30, 0.812], [-0.42, 0.825], [-0.47, 0.842], [-0.47, 0.80], [-0.30, 0.785], [-0.03, 0.80]];
  const sg = side(seatP, -0.155, 0.155, 0.014, true); const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const f = 1 - 0.25 * sstep(-0.2, -0.47, sp.getX(i)); sp.setZ(i, sp.getZ(i) * f); } sg.computeVertexNormals();
  const seat = new THREE.Mesh(sg, seatM); seat.name = 'seat'; body.add(seat);
  const cap = new THREE.CylinderGeometry(0.045, 0.048, 0.012, 32); cap.translate(0.20, 0.985, 0); body.add(new THREE.Mesh(cap, mats.chrome));
  const tl = new THREE.PlaneGeometry(0.11, 0.028); tl.rotateY(-Math.PI / 2); tl.translate(-0.805, 0.83, 0); body.add(new THREE.Mesh(tl, red));
  body.add(new THREE.Mesh(merge([box(0.015, 0.28, 0.03, -0.72, 0.65, 0, 0, 0, 0.5), box(0.012, 0.11, 0.17, -0.80, 0.56, 0, 0, 0, 0.25)]), plastic));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.09), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.5 })); plate.rotation.y = -Math.PI / 2; plate.rotation.x = 0; plate.position.set(-0.808, 0.56, 0); plate.rotateY(0); plate.rotation.set(0, -Math.PI / 2, 0.25); body.add(plate);
  // ---- 輪子 ----
  const wf = motoWheel({ R: MOTO.RF, w: MOTO.wF, rim: MOTO.rim, mats, discs: 2, discR: 0.155 }); wf.position.set(MOTO.xf, MOTO.RF, 0); wf.name = 'wheelF'; bars.add(wf);
  const wr = motoWheel({ R: MOTO.RR, w: MOTO.wR, rim: MOTO.rim, mats, discs: 1, discR: 0.11 }); wr.position.set(MOTO.xr, MOTO.RR, 0); wr.name = 'wheelR'; body.add(wr);
  return { bars, wheels: [wf, wr] };
}
