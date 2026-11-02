// N4 街車（第 62 批；Nick 2026-11-02 卡片「只做街車」）：自己設計的直四街車（圓燈、一字把、倒立前叉、雙翼樑鋁車架、四合一排氣；沒有真的牌子，只有「N4」）。
// 車殼＝body-n4(-q).glb（n4-body.mjs → moto-body.mjs，公尺座標），零件和騎的人在 moto-spec.js（motoBuild、MOTO_RIDE、motoRide、motoSteer）。
// 兩個輪子（motoBuild 做的：前輪在 bars 這組裡面，跟著把手轉）：buildCar 不做四個輪子（spec.wheels.moto）；S.wheels 給四個看不到的點（drive.js 的轉向、
// terrain.js 的四個角照舊），右邊那兩個（[1] 前、[3] 後）的 rotation 就是真的輪子的 rotation（轉動跟著走）。
// 套件：wing＝後箱（none／box）；kit＝原廠／運動（大燈上面的小風鏡＋引擎下面的導流罩，車身色）；沒有升高、降低（輪子在車身裡面）。
import * as THREE from 'three';
import { N4_LOOK } from './n4-look.js';
import { motoBuild, MOTO, MOTO_RIDE, motoRide, motoSteer } from './moto-spec.js';

// 後箱（上面那個行李箱）：黑色塑膠殼＋車身色的蓋子邊、底下的架子
function N4_box(paint) {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.8 });
  const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }); shell.color = paint.color;
  const box = new THREE.BoxGeometry(0.36, 0.24, 0.40, 2, 2, 2); const p = box.attributes.position; // 圓圓的箱子：角往內收
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 - 0.18 * (Math.abs(x) / 0.18) * (Math.abs(z) / 0.2); p.setXYZ(i, x * k, y, z * (1 - 0.12 * (y + 0.12) / 0.24)); }
  box.computeVertexNormals(); box.translate(-0.66, 1.05, 0);
  g.add(new THREE.Mesh(box, plastic));
  const lid = new THREE.BoxGeometry(0.30, 0.03, 0.30); lid.translate(-0.66, 1.172, 0); g.add(new THREE.Mesh(lid, shell));
  const rk = []; for (const s of [1, -1]) { const r = new THREE.CylinderGeometry(0.009, 0.009, 0.30, 8); r.rotateZ(Math.PI / 2); r.translate(-0.66, 0.925, s * 0.09); rk.push(r); }
  const pl = new THREE.BoxGeometry(0.30, 0.012, 0.22); pl.translate(-0.66, 0.935, 0); rk.push(pl);
  for (const r of rk) g.add(new THREE.Mesh(r, steel));
  const lens = new THREE.MeshStandardMaterial({ color: 0xd4202a, roughness: 0.2, metalness: 0.2, emissive: 0xaa0a10, emissiveIntensity: 0.3 });
  const rf = new THREE.PlaneGeometry(0.16, 0.025); rf.rotateY(-Math.PI / 2); rf.translate(-0.842, 1.06, 0); g.add(new THREE.Mesh(rf, lens)); // 後面一條紅色反光片
  return g;
}

export const N4_SPEC = {
  look: N4_LOOK, paint: '#2a2b2e', metal: 0.3, seat: 0x141518,
  // 前 120/70-17（半徑 0.30）、後 180/55-17（0.315）、17 吋框；moto：buildCar 不做輪子（motoBuild 做），track 只給看不到的點用
  wheels: { xf: MOTO.xf, xr: MOTO.xr, R: MOTO.RF, RF: MOTO.RF, RR: MOTO.RR, rim: MOTO.rim, trackF: 0.12, trackR: 0.12, wF: MOTO.wF, wR: MOTO.wR, style: 'five', moto: true },
  wings: { none: () => new THREE.Group(), box: (paint) => N4_box(paint) },
  wing: 'none',
  interior: {},
  build(body, paint, mats) {
    const cab = body.getObjectByName('interior'); if (cab) body.remove(cab); // 沒有車內（騎的）
    const B = motoBuild('n4', body, paint, mats);
    const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }); shell.color = paint.color;
    // 運動套件：圓燈上面的小風鏡（跟著把手轉：放在 bars）＋引擎下面的導流罩
    const fly = new THREE.Group(); fly.name = 'n4-sport';
    { const sh = new THREE.Shape(); sh.moveTo(-0.11, 0); sh.quadraticCurveTo(-0.115, 0.11, -0.05, 0.16); sh.lineTo(0.05, 0.16); sh.quadraticCurveTo(0.115, 0.11, 0.11, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - 0.5 * x * x); } g.computeVertexNormals(); // 往兩邊彎
      g.rotateY(Math.PI / 2); g.rotateZ(-0.45); g.translate(0.60, 1.0, 0); const m = new THREE.Mesh(g, shell); B.bars.add(m); fly.userData.screen = m; }
    { const pts = [[0.42, 0.42], [0.36, 0.30], [0.22, 0.25], [-0.10, 0.25], [-0.17, 0.32], [0.05, 0.335], [0.30, 0.37], [0.38, 0.46]];
      const sh = new THREE.Shape(); sh.moveTo(...pts[0]); sh.splineThru(pts.slice(1).map((q) => new THREE.Vector2(...q))); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 16 }); g.translate(0, 0, -0.18);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 - 0.25 * Math.max(0, (0.34 - y) / 0.09); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals();
      fly.add(new THREE.Mesh(g, shell)); }
    body.add(fly);
    return (kit) => { const on = kit === 'sport'; fly.visible = on; fly.userData.screen.visible = on; };
  },
  kit: 'stock',
  lod: { wheels: N4_lodWheels },
};

// 輕量車的兩個輪子（carlod.js 的 builder：B.lathe／B.cap；R＝角色 → 類別）：圓胎、兩面輪框（輪框色）、碟盤；輪子都在中間（z 0）
function N4_lodWheels(B, R, kit, axles) {
  for (const A of axles) {
    const c = { x: A.x, y: A.R, z: 0 }, w = A.w, Rr = A.R, rim = A.rim, hw = w / 2, cc = Rr - hw * 0.9, prof = [[rim + 0.004, -hw * 0.92], [rim + 0.03, -hw * 0.98]];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + Math.PI * i / 8; prof.push([cc + Math.cos(a) * hw * 0.9, Math.sin(a) * hw]); }
    prof.push([rim + 0.03, hw * 0.98], [rim + 0.004, hw * 0.92]);
    B.lathe(prof, 32, c, 1, R.rubber);
    const disc = []; for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2; disc.push([Math.cos(a) * (rim + 0.005), Math.sin(a) * (rim + 0.005)]); }
    B.cap(disc, hw * 0.6, c, 1, R.rim); B.cap(disc, -hw * 0.6, c, 1, R.rim, true); // 輪框兩面
    const rot = []; for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2; rot.push([Math.cos(a) * 0.15, Math.sin(a) * 0.15]); }
    B.cap(rot, hw + 0.02, c, 1, R.disc); B.cap(rot, -hw - 0.02, c, 1, R.disc, true);
  }
}

// 騎的人：跟 z2-spec.js 一樣的介面（town.src.js 的 RIDES）
export const N4_RIDE = MOTO_RIDE.n4;
export const N4_steer = (body, s) => motoSteer(body, s, 'n4');
export const N4_ride = (C, s = 0, dt = 1 / 60) => motoRide(C, s, dt, 'n4');
const N4_V = new THREE.Vector3();
export function N4_eye(C, out = [0, 0, 0]) { // 騎的人的眼睛（車身座標）：坐好以後量（跟 Z2_eye 一樣）
  for (let i = 0; i < 30; i++) N4_ride(C, 0, 1 / 30);
  const g = C.group, p = g.parent; if (p) p.remove(g);
  const P0 = g.position.clone(), R0 = g.rotation.clone(); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true); C.eyes.getWorldPosition(N4_V);
  g.position.copy(P0); g.rotation.copy(R0); if (p) p.add(g);
  const at = N4_RIDE.at; out[0] = N4_V.x + at[0]; out[1] = N4_V.y + at[1]; out[2] = N4_V.z + at[2];
  return out;
}

// 這台車的標準視角（車很小；cview.html 用）
export const N4_CAMS = {
  front34: { a: 35, d: 4.4, h: 1.4, tx: 0, ty: 0.62, fov: 32 }, rear34: { a: 145, d: 4.4, h: 1.4, tx: -0.05, ty: 0.62, fov: 32 },
  side: { a: 90, d: 6.0, h: 0.72, tx: 0, ty: 0.6, fov: 26 }, front: { a: 0, d: 6, h: 0.75, tx: 0, ty: 0.6, fov: 20 }, rear: { a: 180, d: 6, h: 0.75, tx: 0, ty: 0.6, fov: 20 },
  low: { a: 28, d: 3.4, h: 0.45, tx: 0.2, ty: 0.55, fov: 40 }, top: { a: 90, d: 0.01, h: 8, tx: 0, ty: 0, fov: 25 },
};

export const N4_GARAGE = {
  name: 'N4 街車', sub: '直四街車 · 3D 試做版',
  paints: [['#2a2b2e', '消光灰'], ['#d42a2a', '紅'], ['#1d5fc4', '藍'], ['#f2c21b', '黃'], ['#7ac943', '萊姆綠'], ['#ef6c1a', '橘'], ['#f2f2ee', '白'], ['#121315', '黑']],
  opts: {
    wing: [['none', '不要'], ['box', '後箱']],
    kit: [['stock', '原廠'], ['sport', '運動套件']],
    height: [['0', '原廠']],
    livery: [['race', '號碼'], ['stripe', '條紋'], ['none', '不要']],
    rimStyle: [['stock', '原廠']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#2a2b2e', rim: 'black', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'race', tint: 'dark' },
};
