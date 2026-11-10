// ---- 三隻動物（第 86 批）：白色小豬、粉紅長鼻子、彩虹變色龍；路上很多行人換成牠們 ----
// Nick 2026-11-08：「把很多的行人換成這三隻動物但撞到它們不會被抓 / 要注意三隻動物走路要順暢大約人的一半高 白色那隻用小跳的移動不要跳太高
//   粉色那隻用彩色的腳走 / 全身彩色那隻變色龍用四隻紫色的腳爬 / 注意變色龍是三隻裏最大隻的其他2隻一樣大 還有走路姿勢要自然不要歪歪斜斜的或很畸形」
// 2026-11-10「補上漏掉的那隻動物」（粉紅那隻的影片）、「做完全部直接上線」。Nick 給的影片（家裡的填充玩偶）只拿來看，影片永遠不放進遊戲
// 全部程式做（沒有模型檔、沒有貼圖）：每隻一個 SkinnedMesh（頂點顏色，三種共用一個材質）＋腳下淡淡的圓影子＝2 個 draw call
//
// 【API】跟 character.js 的 buildCharacter 一樣（npc.js 直接拿來當路上的人）
//   buildAnimal(look = { animal: 'pig' | 'pinky' | 'cham' }, opts = { shadow }) → C
//     C.group（腳底 y = 0、臉朝本地 +x，rotation.y＝heading）、C.mesh、C.bones、C.look { animal, age: 'adult' }、C.height（公尺）、C.radius（碰撞圓）
//     C.update(dt, { speed, state })   state：'idle' | 'walk' | 'run' | 'talk' | 'sit' | 'fall' | 'getup' | 'wave'（生氣）；'getup' 0.9 秒、'wave' 1.5 秒播完自己回 'idle'
//       小豬：小小的跳（最高 5～11 公分，Nick「不要跳太高」），落地壓扁一點、耳朵跟著晃；跳在空中的時候才往前（落地的時候腳不滑）
//       粉紅：兩隻彩色條紋的腳走路（兩節的腳，照腳要踩的位置算膝蓋：腳踩在地上不會滑）、手前後擺、大耳朵晃
//       變色龍：四隻紫色的腳爬（對角的兩隻一起走），身體、尾巴輕輕左右擺，兩顆眼睛各自亂轉
//       'fall'：小豬、粉紅往後倒（肚子朝上、腳在空中踢），變色龍往旁邊翻；'getup' 翻回來
//     C.setLook(p)   換別種動物（p.animal）；人的樣子不理
//     C.dispose()
//   randomAnimal(rng) → look（三種一樣多）；ANIMAL_KINDS
//   大小：小豬、粉紅一樣大（頭頂約 0.77 公尺，人的一半；粉紅的大耳朵到 0.9），變色龍最大（背上到 0.9、從鼻子到尾巴 1.9 公尺）
// 效能：小豬約 3.0 千個三角形、粉紅約 3.3 千、變色龍約 6.6 千；幾何每一種只做一次、大家共用；update 一隻約 0.01–0.02 ms
import * as THREE from 'three';

export const { buildAnimal, randomAnimal, ANIMAL_KINDS } = (() => {
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const sstep = (a, b, x) => smooth((x - a) / (b - a));
const wrapA = (a) => { a = (a + PI) % TAU; return a < 0 ? a + PI : a - PI; };
const hash3 = (x, y, z) => { let h = Math.imul(Math.round(x * 600) | 0, 73856093) ^ Math.imul(Math.round(y * 600) | 0, 19349663) ^ Math.imul(Math.round(z * 600) | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CC = new Map();
const col = (hex) => { let c = CC.get(hex); if (!c) { const t = new THREE.Color(hex); c = [t.r, t.g, t.b]; CC.set(hex, c); } return c; };

// ---- 幾何：每一塊接成一個 BufferGeometry；每個點綁一根骨頭（或兩根混）----
function gb() { return { P: [], N: [], C: [], R: [], SI: [], SW: [], I: [], n: 0 }; }
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3(), _M = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function vert(G, x, y, z, nx, ny, nz, c, rough, fuzz, skin) {
  const k = (0.84 + 0.16 * (0.5 + 0.5 * ny)) * (1 + (hash3(x, y, z) - 0.5) * 2 * fuzz); // 下面暗一點（填充玩偶的影子）＋一點絨毛的深淺
  G.P.push(x, y, z); G.N.push(nx, ny, nz); G.C.push(c[0] * k, c[1] * k, c[2] * k); G.R.push(rough);
  if (typeof skin === 'number') { G.SI.push(skin, 0, 0, 0); G.SW.push(1, 0, 0, 0); } else { G.SI.push(skin[0], skin[2], 0, 0); G.SW.push(skin[1], skin[3], 0, 0); }
  return G.n++;
}
// geo（本地）× M → 模型座標；color：[r,g,b] 或 (本地 x, y, z, 模型座標) => [r,g,b]；skin：骨頭號碼 或 (模型座標) => [b0, w0, b1, w1]
function put(G, geo, M, color, skin, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, n0 = G.n, rough = o.rough ?? 1, fuzz = o.fuzz ?? 0.03, jit = o.jit || 0;
  _m3.getNormalMatrix(M);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
    _v.set(lx, ly, lz).applyMatrix4(M); _n.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(_m3).normalize();
    if (jit) _v.addScaledVector(_n, (hash3(_v.x * 3.1, _v.y * 3.1, _v.z * 3.1) - 0.5) * jit);
    const c = typeof color === 'function' ? color(lx, ly, lz, _v) : color;
    vert(G, _v.x, _v.y, _v.z, _n.x, _n.y, _n.z, c, rough, fuzz, typeof skin === 'function' ? skin(_v.x, _v.y, _v.z) : skin);
  }
  if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) G.I.push(n0 + ix.getX(i)); } else for (let i = 0; i < pos.count; i++) G.I.push(n0 + i);
  geo.dispose();
}
// 橢球：中心 c、三個半徑 r、轉 rot [x, y, z]（弧度）
function ell(G, c, r, rot, color, skin, o = {}) {
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e);
  _M.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(r[0], r[1], r[2]));
  put(G, new THREE.SphereGeometry(1, o.w || 20, o.h || 14), _M, color, skin, o);
}
// 兩頭圓的管子（a → b，粗細 r0 → r1）
function cap(G, a, b, r0, r1, color, skin, o = {}) {
  const k = o.k || 6, L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), pts = [];
  for (let i = 0; i <= k; i++) { const t = -PI / 2 + (i / k) * (PI / 2); pts.push(new THREE.Vector2(Math.max(1e-5, r0 * Math.cos(t)), r0 * Math.sin(t))); }
  const m = o.mid || 0; for (let i = 1; i <= m; i++) { const t = i / (m + 1); pts.push(new THREE.Vector2(lerp(r0, r1, t), L * t)); }
  for (let i = 0; i <= k; i++) { const t = (i / k) * (PI / 2); pts.push(new THREE.Vector2(Math.max(1e-5, r1 * Math.cos(t)), L + r1 * Math.sin(t))); }
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); _q.setFromUnitVectors(_Y, _v);
  _M.compose(_p.set(a[0], a[1], a[2]), _q, _s.set(1, 1, 1));
  put(G, new THREE.LatheGeometry(pts, o.seg || 14), _M, color, skin, o);
}
function finish(G, sc = 1) {
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(G.P); if (sc !== 1) for (let i = 0; i < P.length; i++) P[i] *= sc;
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(G.N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(G.C, 3));
  g.setAttribute('rough', new THREE.Float32BufferAttribute(G.R, 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(G.SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(G.SW, 4));
  g.setIndex(G.n > 65535 ? new THREE.Uint32BufferAttribute(G.I, 1) : new THREE.Uint16BufferAttribute(G.I, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
// 兩根骨頭混：y（或任何座標）在 a…b 之間從骨頭 b0 慢慢換到 b1
const mix2 = (b0, b1, a, b, v) => { const w = sstep(a, b, v); return w <= 0 ? [b0, 1, b1, 0] : w >= 1 ? [b1, 1, b0, 0] : [b0, 1 - w, b1, w]; };

// ==== 小豬（白色，小跳）====
const PIG = {
  bones: [['root', null, 0, 0, 0], ['body', 'root', 0, 0.15, 0], ['head', 'body', 0, 0.42, 0], ['earL', 'head', -0.005, 0.7, -0.12], ['earR', 'head', -0.005, 0.7, 0.12],
    ['armL', 'body', 0.02, 0.405, -0.135], ['armR', 'body', 0.02, 0.405, 0.135], ['legL', 'body', 0, 0.15, -0.07], ['legR', 'body', 0, 0.15, 0.07], ['tail', 'body', -0.15, 0.25, 0]],
  height: 0.8, radius: 0.26, shadow: [0.5, 0.46, 0], sc: 1,
  geo(G, B) {
    const BODY = col('#e4ddd2'), FEET = col('#d3c9bd'), EARIN = col('#e9a4a6'), SNOUT = col('#eba1a8'), NOS = col('#8c3946'), EYE = col('#141012'), GLINT = col('#ffffff');
    ell(G, [0, 0.3, 0], [0.15, 0.17, 0.155], null, BODY, B.body, { w: 22, h: 16 });
    ell(G, [0.025, 0.575, 0], [0.195, 0.175, 0.215], null, BODY, B.head, { w: 26, h: 18 });
    ell(G, [0.205, 0.535, 0], [0.05, 0.062, 0.088], null, SNOUT, B.head, { w: 18, h: 12, fuzz: 0.015 });
    for (const s of [-1, 1]) {
      ell(G, [0.252, 0.537, s * 0.032], [0.012, 0.026, 0.015], null, NOS, B.head, { w: 10, h: 8, fuzz: 0 });
      ell(G, [0.19, 0.615, s * 0.088], [0.021, 0.021, 0.021], null, EYE, B.head, { w: 12, h: 8, fuzz: 0, rough: 0.22 });
      ell(G, [0.207, 0.624, s * 0.081], [0.006, 0.006, 0.006], null, GLINT, B.head, { w: 6, h: 4, fuzz: 0, rough: 0.3 });
      const th = s * 0.65, ear = s < 0 ? B.earL : B.earR, ex = -0.005, ey = 0.7, ez = s * 0.12, dy = Math.cos(th), dz = Math.sin(th);
      ell(G, [ex, ey + 0.06 * dy, ez + 0.06 * dz], [0.026, 0.085, 0.066], [th, 0, 0], BODY, ear, { w: 14, h: 10 });
      ell(G, [ex + 0.017, ey + 0.058 * dy, ez + 0.058 * dz], [0.012, 0.062, 0.046], [th, 0, 0], EARIN, ear, { w: 12, h: 8, fuzz: 0.015 });
      cap(G, [0.02, 0.405, s * 0.135], [0.075, 0.3, s * 0.172], 0.046, 0.042, BODY, s < 0 ? B.armL : B.armR, { seg: 12, k: 5 });
      cap(G, [0, 0.15, s * 0.07], [0.012, 0.05, s * 0.075], 0.056, 0.05, BODY, s < 0 ? B.legL : B.legR, { seg: 12, k: 5 });
      ell(G, [0.03, 0.036, s * 0.075], [0.068, 0.04, 0.055], null, FEET, s < 0 ? B.legL : B.legR, { w: 14, h: 8 });
    }
    _q.setFromEuler(_e.set(0, PI / 2, 0)); _M.compose(_p.set(-0.158, 0.25, 0), _q, _s.set(1, 1, 1));
    put(G, new THREE.TorusGeometry(0.024, 0.009, 6, 14, PI * 1.6), _M, BODY, B.tail);
  },
};

// ==== 粉紅（長鼻子、大耳朵、毛毛的屁股、彩色條紋的腳）====
const PINKY = {
  bones: [['root', null, 0, 0, 0], ['hips', 'root', 0, 0.27, 0], ['chest', 'hips', 0, 0.44, 0], ['head', 'chest', 0, 0.56, 0], ['earL', 'head', -0.01, 0.73, -0.075], ['earR', 'head', -0.01, 0.73, 0.075],
    ['armL', 'chest', 0, 0.51, -0.125], ['armR', 'chest', 0, 0.51, 0.125],
    ['thighL', 'hips', 0, 0.27, -0.075], ['shinL', 'thighL', 0, 0.155, -0.075], ['footL', 'shinL', 0, 0.045, -0.075],
    ['thighR', 'hips', 0, 0.27, 0.075], ['shinR', 'thighR', 0, 0.155, 0.075], ['footR', 'shinR', 0, 0.045, 0.075], ['tail', 'hips', -0.12, 0.27, 0]],
  height: 0.85, radius: 0.25, shadow: [0.46, 0.46, 0.01], sc: 1,
  geo(G, B) {
    const BODY = col('#efcfc4'), FLEECE = col('#f0dcd2'), EARIN = col('#e7a99f'), NOSE = col('#e2b2a6'), STITCH = col('#2a1a1a'), EYE = col('#141012'), GLINT = col('#ffffff');
    const STR = [col('#4fae80'), col('#ea8a2c'), col('#5c4231')];
    ell(G, [0, 0.43, 0], [0.125, 0.15, 0.135], null, BODY, (x, y) => mix2(B.hips, B.chest, 0.36, 0.48, y), { w: 22, h: 16 });
    ell(G, [-0.005, 0.32, 0], [0.142, 0.118, 0.152], null, FLEECE, B.hips, { w: 24, h: 16, jit: 0.007, fuzz: 0.06 });
    ell(G, [0.02, 0.645, 0], [0.13, 0.12, 0.125], null, BODY, B.head, { w: 22, h: 16 });
    cap(G, [0.1, 0.63, 0], [0.245, 0.665, 0], 0.075, 0.05, BODY, B.head, { seg: 16, k: 6 });
    const pa = Math.atan2(0.035, 0.145);
    ell(G, [0.288, 0.675, 0], [0.016, 0.046, 0.049], [0, 0, pa], NOSE, B.head, { w: 14, h: 10, fuzz: 0.01 });
    for (const s of [-1, 1]) {
      ell(G, [0.302, 0.678, s * 0.02], [0.006, 0.015, 0.008], [0, 0, pa], STITCH, B.head, { w: 8, h: 6, fuzz: 0 });
      ell(G, [0.098, 0.69, s * 0.085], [0.017, 0.017, 0.017], null, EYE, B.head, { w: 12, h: 8, fuzz: 0, rough: 0.22 });
      ell(G, [0.112, 0.697, s * 0.08], [0.005, 0.005, 0.005], null, GLINT, B.head, { w: 6, h: 4, fuzz: 0, rough: 0.3 });
      const th = s * 0.33, ear = s < 0 ? B.earL : B.earR, ex = -0.01, ey = 0.73, ez = s * 0.075, dy = Math.cos(th), dz = Math.sin(th);
      ell(G, [ex - 0.01, ey + 0.095 * dy, ez + 0.095 * dz], [0.022, 0.1, 0.058], [th, 0, -0.12], BODY, ear, { w: 14, h: 12 });
      ell(G, [ex + 0.004, ey + 0.095 * dy, ez + 0.095 * dz], [0.01, 0.078, 0.04], [th, 0, -0.12], EARIN, ear, { w: 12, h: 10, fuzz: 0.015 });
      const arm = s < 0 ? B.armL : B.armR;
      cap(G, [0, 0.51, s * 0.125], [0.05, 0.375, s * 0.155], 0.04, 0.036, BODY, arm, { seg: 12, k: 5 });
      ell(G, [0.056, 0.36, s * 0.156], [0.04, 0.046, 0.036], null, BODY, arm, { w: 12, h: 8 });
      const th0 = s < 0 ? B.thighL : B.thighR, sh = s < 0 ? B.shinL : B.shinR, ft = s < 0 ? B.footL : B.footR;
      cap(G, [0, 0.29, s * 0.075], [0, 0.06, s * 0.075], 0.05, 0.046, (x, y, z, v) => STR[((Math.floor(v.y / 0.036) % 3) + 3) % 3], (x, y) => mix2(sh, th0, 0.13, 0.18, y), { seg: 14, k: 5, mid: 10 });
      ell(G, [0.028, 0.045, s * 0.078], [0.08, 0.05, 0.056], null, (x) => STR[[0, 1, 2, 1, 0][clamp(Math.floor((x + 1) * 2.5), 0, 4)]], ft, { w: 20, h: 12 });
    }
    cap(G, [-0.12, 0.27, 0], [-0.158, 0.19, 0], 0.02, 0.015, BODY, B.tail, { seg: 8, k: 4 });
  },
};

// ==== 變色龍（全身彩虹條紋、背上紫色的鬚、四隻紫色的腳、尾巴捲起來；三隻裡面最大）====
const STRIPES = ['#e8393f', '#f28a2b', '#f5d33c', '#58b847', '#2f96d6', '#2b3c96', '#8e4dbf', '#ea589f'].map(col);
const CHAM_SC = 1.2;
// 腳：肩膀／髖 u、手肘／膝蓋 l、腳踝 f（還沒放大）；前腳手肘朝後、後腳膝蓋朝前，站著就彎一點（爬的樣子，走路的時候腳才踩得到地）
const CLEG = { F: { x: 0.22, u: 0.42, lx: -0.1, l: 0.22, f: 0.035 }, H: { x: -0.37, u: 0.42, lx: 0.1, l: 0.22, f: 0.035 } };
let CL = null; // 中線：{ x, y, s }，s＝從鼻子量的長度（還沒放大）
function chamLine() {
  if (CL) return CL;
  const ctrl = [[0.70, 0.575], [0.58, 0.592], [0.44, 0.59], [0.30, 0.566], [0.10, 0.536], [-0.15, 0.515], [-0.40, 0.496], [-0.61, 0.468], [-0.78, 0.425]];
  const pts = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 20; k++) { const t = k / 20, t2 = t * t, t3 = t2 * t; pts.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); }
  }
  pts.push(ctrl[ctrl.length - 1]);
  // 尾巴：往後往下，越捲越緊（捲在下面、朝前）
  let [x, y] = pts[pts.length - 1], th = Math.atan2(y - pts[pts.length - 2][1], x - pts[pts.length - 2][0]);
  const LT = 0.8, du = 0.01;
  for (let u = du; u <= LT + 1e-9; u += du) { const R = lerp(0.28, 0.048, Math.pow(u / LT, 0.85)); x += Math.cos(th) * du; y += Math.sin(th) * du; th += du / R; pts.push([x, y]); }
  const out = []; let s = 0;
  for (let i = 0; i < pts.length; i++) { if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); out.push({ x: pts[i][0], y: pts[i][1], s }); }
  return (CL = out);
}
function clAt(s, o) { // 中線上 s 那一點＋方向（往尾巴）
  const L = chamLine(); let i = 1; while (i < L.length - 1 && L[i].s < s) i++;
  const a = L[i - 1], b = L[i], t = clamp((s - a.s) / (b.s - a.s || 1), 0, 1), l = b.s - a.s || 1;
  o.x = lerp(a.x, b.x, t); o.y = lerp(a.y, b.y, t); o.tx = (b.x - a.x) / l; o.ty = (b.y - a.y) / l; return o;
}
const TAIL0 = 1.22; // 尾巴從這裡開始（s）
const RT = [[0.07, 0.125, 0.105], [0.11, 0.145, 0.12], [0.2, 0.158, 0.13], [0.3, 0.15, 0.122], [0.42, 0.19, 0.148], [0.62, 0.212, 0.16], [0.85, 0.196, 0.152], [1.05, 0.152, 0.126], [TAIL0, 0.1, 0.092]];
function chamR(s, o) { // [上下半徑, 左右半徑]
  const end = chamLine()[chamLine().length - 1].s;
  if (s < 0.07) { const k = Math.sqrt(Math.max(0, 1 - (1 - s / 0.07) ** 2)); o[0] = 0.125 * k; o[1] = 0.105 * k; return o; }
  if (s <= TAIL0) { let i = 1; while (i < RT.length - 1 && RT[i][0] < s) i++; const a = RT[i - 1], b = RT[i], t = smooth((s - a[0]) / (b[0] - a[0])); o[0] = lerp(a[1], b[1], t); o[1] = lerp(a[2], b[2], t); return o; }
  const t = clamp((s - TAIL0) / (end - TAIL0), 0, 1); let r = lerp(0.094, 0.026, Math.pow(t, 0.8)), ry = lerp(0.1, 0.026, Math.pow(t, 0.8));
  if (s > end - 0.026) { const k = Math.sqrt(Math.max(0, 1 - ((s - (end - 0.026)) / 0.026) ** 2)); r *= k; ry *= k; }
  o[0] = ry; o[1] = r; return o;
}
// 骨頭（中線上的點；名字、上一根、s）
const CHAM_SP = [['head', 0.3], ['chest', 0.5], ['spine', 0.78], ['pelvis', 1.02], ['tail1', 1.24], ['tail2', 1.48], ['tail3', 1.72], ['tail4', 1.94]];
const CHAM_BD = [[0.3, 'head', 'chest'], [0.5, 'chest', 'spine'], [0.78, 'spine', 'pelvis'], [1.2, 'pelvis', 'tail1'], [1.44, 'tail1', 'tail2'], [1.68, 'tail2', 'tail3'], [1.9, 'tail3', 'tail4']];
const CHAM = {
  bones: null, height: 0.9, radius: 0.45, shadow: [1.5, 0.55, -0.12], sc: CHAM_SC,
  mkBones() {
    const o = {}, at = (s) => { clAt(s, o); return [o.x, o.y, 0]; }, P = {};
    for (const [n, s] of CHAM_SP) P[n] = at(s);
    const b = [['root', null, 0, 0, 0], ['pelvis', 'root', ...P.pelvis], ['spine', 'pelvis', ...P.spine], ['chest', 'spine', ...P.chest], ['head', 'chest', ...P.head],
      ['eyeL', 'head', 0.555, 0.628, -0.112], ['eyeR', 'head', 0.555, 0.628, 0.112],
      ['tail1', 'pelvis', ...P.tail1], ['tail2', 'tail1', ...P.tail2], ['tail3', 'tail2', ...P.tail3], ['tail4', 'tail3', ...P.tail4]];
    for (const [k, par, z] of [['LF', 'chest', -0.11], ['RF', 'chest', 0.11], ['LH', 'pelvis', -0.11], ['RH', 'pelvis', 0.11]]) {
      const g = CLEG[k[1]]; b.push([k + 'u', par, g.x, g.u, z], [k + 'l', k + 'u', g.x + g.lx, g.l, z], [k + 'f', k + 'l', g.x, g.f, z]);
    }
    return b;
  },
  geo(G, B) {
    const L = chamLine(), end = L[L.length - 1].s, o = {}, r = [0, 0], PURP = col('#9b72d4'), FOOT = col('#8f64c9'), CREST = col('#8b5fc6'), WHITE = col('#f7f7f4'), PUPIL = col('#121014');
    const skinAt = (s) => { // s 那裡的身體跟著哪兩根骨頭
      for (const [b, b0, b1] of CHAM_BD) if (s < b + 0.06) return s <= b - 0.06 ? [B[b0], 1, B[b1], 0] : mix2(B[b0], B[b1], b - 0.06, b + 0.06, s);
      return [B.tail4, 1, 0, 0];
    };
    // 身體＋尾巴：一圈一圈掃過去；條紋的邊多一圈（顏色才會利）
    const W = 0.05, S0 = 0.012, NR = 18, rings = [];
    const grid = []; for (let s = 0; s < end; s += 0.016) grid.push(s); grid.push(end);
    for (let k = 1; S0 + k * W < end; k++) grid.push(S0 + k * W, S0 + k * W);
    grid.sort((a, b) => a - b);
    let last = -1;
    for (const s of grid) { const ci = Math.floor((s - S0) / W + 1e-6), dup = s === last; rings.push({ s, ci: dup ? ci : s === last ? ci : Math.floor((s - S0) / W - (grid.indexOf(s) !== grid.lastIndexOf(s) ? 1e-6 : 0)), dup }); last = s; }
    // 同一個 s 兩圈：第一圈是前面那條的顏色、第二圈是後面那條
    for (let i = 0; i < rings.length; i++) { const q = rings[i]; if (i + 1 < rings.length && rings[i + 1].s === q.s) { q.ci = Math.round((q.s - S0) / W) - 1; rings[i + 1].ci = q.ci + 1; i++; } else q.ci = Math.floor((q.s - S0) / W); }
    const base = [];
    for (const q of rings) {
      clAt(q.s, o); chamR(q.s, r);
      const ry = Math.max(r[0], 1e-4), rz = Math.max(r[1], 1e-4), nx = o.ty, ny = -o.tx; // N＝往上（中線轉 90 度）
      const r2 = [0, 0]; chamR(Math.min(end, q.s + 0.004), r2); const r1 = [0, 0]; chamR(Math.max(0, q.s - 0.004), r1);
      const slope = clamp((r2[0] + r2[1] - r1[0] - r1[1]) / 2 / (Math.min(end, q.s + 0.004) - Math.max(0, q.s - 0.004)), -40, 40);
      const c = STRIPES[((q.ci % 8) + 8) % 8], sk = skinAt(q.s), i0 = G.n;
      for (let j = 0; j < NR; j++) {
        const a = (j / NR) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let mx = nx * (ca / ry), my = ny * (ca / ry), mz = sa / rz; const ml = Math.hypot(mx, my, mz); mx /= ml; my /= ml; mz /= ml;
        mx -= o.tx * slope; my -= o.ty * slope; const l2 = Math.hypot(mx, my, mz);
        vert(G, o.x + nx * ry * ca, o.y + ny * ry * ca, rz * sa, mx / l2, my / l2, mz / l2, c, 1, 0.025, sk);
      }
      base.push({ i0, dup: q.dup });
    }
    for (let i = 0; i + 1 < base.length; i++) {
      if (base[i + 1].dup) continue;
      const a = base[i].i0, b = base[i + 1].i0;
      for (let j = 0; j < NR; j++) { const j1 = (j + 1) % NR; G.I.push(a + j, b + j, a + j1, a + j1, b + j, b + j1); }
    }
    // 背上紫色的鬚（頭上大一點）
    for (let s = 0.1; s < 0.96; s += 0.052) {
      clAt(s, o); chamR(s, r); const big = s < 0.27, ang = Math.atan2(o.ty, o.tx) + PI, nx = o.ty, ny = -o.tx, h = big ? 0.05 : 0.04;
      ell(G, [o.x + nx * (r[0] + h * 0.45), o.y + ny * (r[0] + h * 0.45), 0], [big ? 0.036 : 0.031, h, 0.013], [0, 0, ang], CREST, skinAt(s), { w: 12, h: 8 });
    }
    // 眼睛：白色凸凸的、黑色的眼珠（會自己轉）
    for (const sd of [-1, 1]) {
      const e = sd < 0 ? B.eyeL : B.eyeR, c = [0.555, 0.628, sd * 0.112];
      ell(G, c, [0.06, 0.06, 0.058], null, WHITE, e, { w: 18, h: 12, fuzz: 0, rough: 0.35 });
      const d = new THREE.Vector3(0.55, 0.12, sd * 0.83).normalize();
      ell(G, [c[0] + d.x * 0.042, c[1] + d.y * 0.042, c[2] + d.z * 0.042], [0.03, 0.03, 0.03], null, PUPIL, e, { w: 12, h: 8, fuzz: 0, rough: 0.2 });
      ell(G, [c[0] + d.x * 0.054 + 0.012, c[1] + d.y * 0.054 + 0.012, c[2] + d.z * 0.054], [0.007, 0.007, 0.007], null, WHITE, e, { w: 6, h: 4, fuzz: 0, rough: 0.3 });
    }
    // 腳：兩節＋腳掌（兩根圓圓的腳趾）
    for (const k of ['LF', 'RF', 'LH', 'RH']) {
      const g = CLEG[k[1]], x = g.x, z = k[0] === 'L' ? -0.11 : 0.11, sd = k[0] === 'L' ? -1 : 1, lx = x + g.lx;
      cap(G, [x, g.u + 0.05, z], [lx, g.l, z], 0.066, 0.056, PURP, B[k + 'u'], { seg: 14, k: 5 });
      cap(G, [lx, g.l, z], [x, 0.045, z], 0.056, 0.048, PURP, B[k + 'l'], { seg: 14, k: 5 });
      ell(G, [x + 0.018, 0.03, z + sd * 0.006], [0.072, 0.033, 0.066], null, FOOT, B[k + 'f'], { w: 14, h: 8 });
      for (const t of [-1, 0, 1]) ell(G, [x + 0.074 - Math.abs(t) * 0.008, 0.024, z + t * 0.038 + sd * 0.006], [0.038, 0.023, 0.024], [0, t * 0.45, 0], FOOT, B[k + 'f'], { w: 10, h: 6 });
    }
  },
};
CHAM.bones = CHAM.mkBones();

const KINDS = { pig: PIG, pinky: PINKY, cham: CHAM };
const ANIMAL_KINDS = Object.keys(KINDS);
const GEO = {};
function kindGeo(kind) {
  if (GEO[kind]) return GEO[kind];
  const K = KINDS[kind], B = {}; K.bones.forEach((b, i) => { B[b[0]] = i; });
  const G = gb(); K.geo(G, B);
  return (GEO[kind] = finish(G, K.sc));
}

// ---- 材質：三種共用一個（頂點顏色；粗糙度每個點自己的：眼睛亮亮的）----
let MAT = null, SHADOW = null;
function material() {
  if (MAT) return MAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float rough;\nvarying float vRough;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor *= vRough;');
  };
  m.customProgramCacheKey = () => 'beau-animal-1';
  return (MAT = m);
}
function shadowMat() {
  if (SHADOW) return SHADOW;
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); tex = new THREE.CanvasTexture(c);
  }
  SHADOW = { geo: new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), mat: new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: tex ? 0.55 : 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
  return SHADOW;
}

// ---- 兩節的腳：髖到腳踝（前後 dx、往下 dv）→ [上面那根、下面那根] 繞 z 的角度（正的＝往前擺）；knee＝true 膝蓋朝前 ----
const IK = [0, 0];
function ik2(a, b, dx, dv, knee) {
  let d = Math.hypot(dx, dv); const dmax = (a + b) * 0.9995, dmin = Math.abs(a - b) + 1e-3;
  if (d > dmax) { dx *= dmax / d; dv *= dmax / d; d = dmax; } else if (d < dmin) d = dmin;
  const al = Math.atan2(dx, dv), be = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), ga = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  if (knee) { IK[0] = al + be; IK[1] = -(PI - ga); } else { IK[0] = al - be; IK[1] = PI - ga; }
  return IK;
}

// ---- 動畫 ----
const DUR = { getup: 0.9, wave: 1.5 };
const NORM = { walk: 'walk', run: 'run', sit: 'sit', getup: 'getup', wave: 'wave', fall: 'fall' };
function newAnim(seed) {
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { st: 'idle', t: 0, clock: rnd() * 10, ph: rnd(), sp: 0, fw: 0, fw0: 0, lieT: 0, side: 1, yaw0: null, look: 0, lookTo: 0, lookT: 1 + rnd() * 3, tw: -1, twS: 1, twT: 2 + rnd() * 4,
    eL: [0, 0], eR: [0, 0], eLt: [0, 0], eRt: [0, 0], eT: [0.5, 1.2], ry: 0, ryv: 0, spr: 0, sprv: 0, rnd };
}
function step(C, dt, o) {
  const S = C.anim, K = C.K; dt = Math.min(Math.max(dt || 0, 0), 0.25);
  const req = o.state || S.req || 'idle'; S.req = req;
  S.clock += dt;
  // 狀態
  if (req === 'fall') { if (S.st !== 'fall') { S.st = 'fall'; S.t = 0; S.lieT = 0; S.side = S.rnd() < 0.5 ? -1 : 1; } }
  else if (S.st === 'fall') { S.lieT += dt; if (req === 'getup' || S.lieT > 0.6 || req === 'sit') { S.st = 'getup'; S.t = 0; S.fw0 = S.fw; } }
  else if (S.st === 'getup' || S.st === 'wave') { if (req === 'sit') { S.st = 'sit'; S.t = 0; } else if (S.t >= DUR[S.st]) { const n = NORM[req] || 'idle'; S.st = n === S.st ? 'idle' : n; S.t = 0; } }
  else { const n = NORM[req] || 'idle'; if (n !== S.st) { S.st = n; S.t = 0; if (n === 'getup') S.fw0 = S.fw; } }
  S.t += dt;
  if (S.st === 'fall') S.fw = Math.min(1, S.fw + dt / 0.28);
  else if (S.st === 'getup') S.fw = S.fw0 * (1 - smooth(S.t / 0.75));
  else S.fw = Math.max(0, S.fw - dt / 0.3);
  const want = S.st === 'walk' || S.st === 'run' ? Math.max(0, o.speed ?? S.sp) : 0;
  S.sp += (want - S.sp) * Math.min(1, dt * 7);
  // 看一看（停著的時候頭慢慢轉）、耳朵動一下
  if ((S.lookT -= dt) <= 0) { S.lookTo = (S.rnd() - 0.5) * 1.1; S.lookT = 1.5 + S.rnd() * 4; }
  S.look += (S.lookTo - S.look) * Math.min(1, dt * 2.2);
  if ((S.twT -= dt) <= 0) { S.tw = 0; S.twS = S.rnd() < 0.5 ? -1 : 1; S.twT = 2 + S.rnd() * 5; }
  if (S.tw >= 0) { S.tw += dt; if (S.tw > 0.35) S.tw = -1; }
  // 骨頭回到原位
  const bs = C.bones, R = C.rest;
  for (let i = 0; i < bs.length; i++) { const b = bs[i]; b.position.set(R[i * 3], R[i * 3 + 1], R[i * 3 + 2]); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); }
  K.anim(C, S, dt);
  // 倒下：小豬、粉紅往後倒（肚子朝上），變色龍往旁邊翻
  const fw = smooth(S.fw), root = C.B.root;
  if (fw > 0) {
    if (K === CHAM) { const a = S.side * 1.42 * fw; root.rotation.x = a; root.position.y += 0.17 * CHAM_SC * fw; root.position.z += -0.5 * CHAM_SC * Math.sin(a); }
    else { root.rotation.z = 1.42 * fw; root.position.y += (K === PIG ? 0.155 : 0.15) * fw; }
  }
  // 影子
  if (C.shadow) {
    const sh = C.shadow, k = K.shadow, lie = fw;
    sh.position.set(root.position.x + k[2] * CHAM_SC * (K === CHAM ? 1 : 0) + (K === CHAM ? 0 : -0.25 * lie), 0.012, K === CHAM ? root.position.z * 0.3 : 0);
    sh.scale.set(k[0] * (K === CHAM ? CHAM_SC : 1) * (1 + (K === CHAM ? 0 : 0.5 * lie)), 1, k[1] * (1 + (K === CHAM ? 0.9 * lie : 0)));
  }
  C.state = S.st;
}
// 身體慢慢呼吸、耳朵／尾巴的小彈簧
function spring(S, key, target, dt, k = 120, c = 9) { const v = key + 'v'; S[v] += (-(S[key] - target) * k - S[v] * c) * dt; S[key] += S[v] * dt; return S[key]; }

PIG.anim = (C, S, dt) => {
  const B = C.B, sp = S.sp, k = sstep(0.04, 0.25, sp) * (1 - S.fw), run = sstep(1.8, 3.2, sp);
  const L = clamp(0.26 + 0.17 * sp, 0.3, 0.8), H = clamp(0.045 + 0.022 * sp, 0.05, 0.11), c = 0.3;
  S.ph += (dt * sp) / L; const f = S.ph - Math.floor(S.ph);
  let y = 0, sq = 0, tuck = 0, dx, pitch = 0;
  if (f < c) { sq = Math.sin((PI * f) / c); dx = -f * L; } else { const q = (f - c) / (1 - c); y = H * Math.sin(PI * q); tuck = Math.sin(PI * q); dx = (smooth(q) - f) * L; pitch = -0.09 * Math.cos(PI * q); }
  // 生氣：原地跳兩下、搖頭
  let ang = 0;
  if (S.st === 'wave') { const t = S.t, h = (t0) => (t > t0 && t < t0 + 0.42 ? Math.sin((PI * (t - t0)) / 0.42) : 0); y += 0.06 * (h(0.05) + h(0.62)); ang = Math.sin(clamp(t / 1.4, 0, 1) * PI); }
  const br = (1 - k) * 0.012 * Math.sin(S.clock * 2.3);
  B.root.position.y = y * k + (S.st === 'wave' ? y : 0) * (1 - k); B.root.position.x = dx * k;
  B.root.scale.set(1 + 0.04 * sq * k, 1 - 0.085 * sq * k + br, 1 + 0.04 * sq * k);
  B.body.rotation.z = pitch * k;
  B.head.rotation.z = -pitch * 0.5 * k;
  B.head.rotation.y = S.look * (1 - k) * 0.8 + 0.32 * Math.sin(S.t * 15) * ang;
  B.legL.rotation.z = B.legR.rotation.z = -0.42 * tuck * k;
  B.armL.rotation.x = 0.3 * tuck * k + 0.5 * ang; B.armR.rotation.x = -B.armL.rotation.x;
  B.armL.rotation.z = B.armR.rotation.z = 0.15 * tuck * k + 0.6 * ang;
  const ear = spring(S, 'spr', 0.22 * sq * k - 0.12 * tuck * k, dt);
  const tw = S.tw >= 0 ? Math.sin((PI * S.tw) / 0.35) * 0.3 : 0;
  B.earL.rotation.x = -ear - (S.twS < 0 ? tw : 0) + 0.2 * ang; B.earR.rotation.x = ear + (S.twS > 0 ? tw : 0) - 0.2 * ang;
  B.tail.rotation.x = 0.4 * Math.sin(S.clock * 5) * (0.3 + k);
  if (S.st === 'sit') { B.root.position.y -= 0.09; B.legL.rotation.z = B.legR.rotation.z = 1.25; B.armL.rotation.z = B.armR.rotation.z = 0.3; }
  if (S.fw > 0) { const w = Math.sin(S.clock * 8) * S.fw; B.legL.rotation.z += 0.35 * w + 0.4 * S.fw; B.legR.rotation.z += -0.35 * w + 0.4 * S.fw; B.armL.rotation.x += 0.5 * S.fw; B.armR.rotation.x -= 0.5 * S.fw; }
  if (S.st === 'getup' && S.t > 0.62) B.root.position.y += 0.05 * Math.sin(PI * clamp((S.t - 0.62) / 0.28, 0, 1));
};

PINKY.anim = (C, S, dt) => {
  const B = C.B, sp = S.sp, k = sstep(0.03, 0.22, sp) * (1 - S.fw), run = sstep(1.3, 2.2, sp);
  const lam = clamp(0.24 + 0.1 * sp, 0.26, 0.5), beta = lerp(0.62, 0.4, run), lift = lerp(0.04, 0.06, run); // 腳短：小步小步走（步子太大腳踩不到地會滑）
  S.ph += (dt * sp) / lam; const f = S.ph - Math.floor(S.ph);
  const bob = lerp(0.006, 0.012, run) * Math.cos(4 * PI * (f - beta / 2)) - lerp(0.03, 0.036, run); // 走路膝蓋彎一點
  let ang = 0; if (S.st === 'wave') ang = Math.sin(clamp(S.t / 1.4, 0, 1) * PI);
  const rootY = bob * k + (1 - k) * 0.006 * Math.sin(S.clock * 2.1);
  B.root.position.y = rootY;
  // 兩隻腳：照腳要踩的地方算膝蓋（腳踩在地上不會滑）
  const hipY = 0.27 + rootY, a = C.len.thigh, b = C.len.shin, ank = 0.045;
  for (let i = 0; i < 2; i++) {
    const p = (f + i * 0.5) % 1; let fx, fy;
    if (p < beta) { fx = beta * lam * (0.5 - p / beta); fy = 0; } else { const q = (p - beta) / (1 - beta); fx = beta * lam * (-0.5 + smooth(q)); fy = lift * Math.sin(PI * q); }
    fx *= k; fy *= k;
    if (S.st === 'wave' && i === 0) fy += 0.05 * Math.max(0, Math.sin(S.t * 9)) * ang; // 跺腳
    const r = ik2(a, b, fx, hipY - (ank + fy), true), th = i ? B.thighR : B.thighL, sh = i ? B.shinR : B.shinL, ft = i ? B.footR : B.footL;
    th.rotation.z = r[0]; sh.rotation.z = r[1]; ft.rotation.z = -(r[0] + r[1]);
  }
  const A = lerp(0.35, 0.75, run) * k, sw = Math.cos(TAU * f);
  B.armR.rotation.z = A * sw + 1.5 * ang + 0.25 * Math.sin(S.t * 16) * ang; B.armL.rotation.z = -A * sw + 1.5 * ang + 0.25 * Math.sin(S.t * 16 + 1.5) * ang;
  B.armL.rotation.x = 0.1 * run * k + 0.25 * ang; B.armR.rotation.x = -B.armL.rotation.x;
  B.chest.rotation.x = -0.03 * Math.cos(TAU * (f - beta / 2)) * k; B.chest.rotation.y = 0.07 * Math.sin(TAU * f) * k;
  B.chest.rotation.z = -0.08 * run * k; B.hips.rotation.z = 0;
  B.head.rotation.y = S.look * (1 - k) * 0.8 - B.chest.rotation.y;
  B.head.rotation.z = 0.035 * Math.sin(4 * PI * f) * k + 0.08 * run * k - 0.12 * ang;
  const ear = spring(S, 'spr', -bob * 4 * k, dt, 90, 7);
  const tw = S.tw >= 0 ? Math.sin((PI * S.tw) / 0.35) * 0.25 : 0;
  B.earL.rotation.x = -0.05 - ear * 0.5 - (S.twS < 0 ? tw : 0); B.earR.rotation.x = 0.05 + ear * 0.5 + (S.twS > 0 ? tw : 0);
  B.earL.rotation.z = B.earR.rotation.z = -0.25 * run * k + ear * 0.4;
  B.tail.rotation.x = 0.35 * Math.sin(TAU * f) * k + 0.15 * Math.sin(S.clock * 1.3);
  if (S.st === 'sit') { B.root.position.y = -0.13; B.thighL.rotation.z = B.thighR.rotation.z = 1.45; B.shinL.rotation.z = B.shinR.rotation.z = -0.15; B.footL.rotation.z = B.footR.rotation.z = -0.4; }
  if (S.fw > 0) { const w = Math.sin(S.clock * 7) * S.fw; for (const [th, sh, s] of [[B.thighL, B.shinL, 1], [B.thighR, B.shinR, -1]]) { th.rotation.z = lerp(th.rotation.z, 0.7 + 0.35 * w * s, S.fw); sh.rotation.z = lerp(sh.rotation.z, -0.5, S.fw); } B.armL.rotation.z = B.armR.rotation.z = lerp(B.armL.rotation.z, 1.2, S.fw); }
  if (S.st === 'getup' && S.t > 0.62) B.root.position.y += 0.04 * Math.sin(PI * clamp((S.t - 0.62) / 0.28, 0, 1));
};

CHAM.anim = (C, S, dt) => {
  const B = C.B, SC = CHAM_SC, sp = S.sp / SC, k = sstep(0.03, 0.2, sp) * (1 - S.fw), run = sstep(1.1, 2.0, sp);
  const lam = clamp(0.34 + 0.2 * sp, 0.4, 0.8), beta = lerp(0.66, 0.48, run), lift = lerp(0.05, 0.075, run);
  S.ph += (dt * sp) / lam; const f = S.ph - Math.floor(S.ph);
  let ang = 0; if (S.st === 'wave') ang = Math.sin(clamp(S.t / 1.4, 0, 1) * PI);
  const rootY = (0.006 * Math.cos(4 * PI * f) - 0.006) * k + (1 - k) * 0.004 * Math.sin(S.clock * 1.6);
  B.root.position.y = rootY * CHAM_SC;
  // 身體左右輕輕擺（S 形），頭幾乎不動
  const a = 0.06 * k * (1 - 0.4 * run), s1 = Math.sin(TAU * f);
  B.pelvis.rotation.y = -a * s1; B.spine.rotation.y = a * s1; B.chest.rotation.y = 0.6 * a * s1;
  B.chest.rotation.z = 0.22 * ang; B.head.rotation.z = 0.1 * ang + 0.1 * Math.sin(S.t * 11) * ang;
  B.head.rotation.y = -0.3 * a * s1 + S.look * (1 - k) * 0.6;
  // 四隻腳：對角的兩隻一起（左前＋右後、右前＋左後）；前腳手肘朝後、後腳膝蓋朝前；腳往外張一點
  for (let i = 0; i < 4; i++) {
    const key = C.legs[i], off = i === 0 || i === 3 ? 0 : 0.5, front = i < 2, sd = i === 0 || i === 2 ? -1 : 1;
    const p = (f + off) % 1; let fx, fy;
    if (p < beta) { fx = beta * lam * (0.5 - p / beta); fy = 0; } else { const q = (p - beta) / (1 - beta); fx = beta * lam * (-0.5 + smooth(q)); fy = lift * Math.sin(PI * q); }
    fx *= k; fy *= k;
    if (S.fw > 0.02) { fx = 0; fy = 0; }
    const g = CLEG[front ? 'F' : 'H'], rho = 0.14, dv = ((g.u - g.f) * SC + B.root.position.y - fy * SC) / Math.cos(rho);
    const r = ik2(C.len.cu, C.len.cl, fx * SC, dv, !front), u = B[key + 'u'], l = B[key + 'l'], ft = B[key + 'f'], ru = front ? C.len.ruF : C.len.ruH, rl = front ? C.len.rlF : C.len.rlH;
    u.rotation.x = sd * rho; u.rotation.z = r[0] - ru; l.rotation.z = r[1] + ru - rl; ft.rotation.z = -(r[0] + r[1] - rl); ft.rotation.x = -sd * rho;
    if (S.fw > 0) { const w = Math.sin(S.clock * 6 + i * 1.7) * S.fw; u.rotation.z = lerp(u.rotation.z, 0.45 * w, S.fw); l.rotation.z = lerp(l.rotation.z, -0.3 + 0.3 * w, S.fw); }
  }
  // 尾巴：走路跟著擺、停著的時候慢慢捲一捲
  const tw = 0.1 * k, ct = S.clock;
  B.tail1.rotation.y = tw * Math.sin(TAU * f - 0.7) + 0.05 * Math.sin(ct * 0.9);
  B.tail2.rotation.y = tw * Math.sin(TAU * f - 1.4) + 0.06 * Math.sin(ct * 0.9 - 0.6);
  B.tail3.rotation.z = 0.07 * Math.sin(ct * 0.7) - 0.2 * ang; B.tail4.rotation.z = 0.1 * Math.sin(ct * 0.7 - 0.5);
  B.tail1.rotation.z = -0.12 * ang;
  // 眼睛：兩顆各自轉
  for (let e = 0; e < 2; e++) {
    if ((S.eT[e] -= dt) <= 0) { const t = e ? S.eRt : S.eLt; t[0] = (S.rnd() - 0.5) * 1.2; t[1] = (S.rnd() - 0.5) * 0.7; S.eT[e] = 0.5 + S.rnd() * 2.2; }
    const t = e ? S.eRt : S.eLt, c = e ? S.eR : S.eL, kk = Math.min(1, dt * 14); c[0] += (t[0] - c[0]) * kk; c[1] += (t[1] - c[1]) * kk;
    const b = e ? B.eyeR : B.eyeL; b.rotation.y = c[0] + (ang ? Math.sin(S.t * 8 + e) * ang : 0); b.rotation.z = c[1];
  }
  if (S.st === 'sit') { B.root.position.y = -0.12 * CHAM_SC; }
};

// ---- 做一隻 ----
let SEED = 1;
function buildAnimal(look = {}, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const kind = KINDS[look && look.animal] ? look.animal : 'pig', K = KINDS[kind], geo = kindGeo(kind), sc = K.sc;
  const group = new THREE.Group(); group.name = 'animal-' + kind;
  const bones = [], B = {}, inv = [], abs = {}, rest = new Float32Array(K.bones.length * 3);
  K.bones.forEach(([n, par, x, y, z], i) => {
    const b = new THREE.Bone(); b.name = n; abs[n] = [x * sc, y * sc, z * sc];
    const P = par ? abs[par] : [0, 0, 0]; b.position.set(x * sc - P[0], y * sc - P[1], z * sc - P[2]);
    rest[i * 3] = b.position.x; rest[i * 3 + 1] = b.position.y; rest[i * 3 + 2] = b.position.z;
    if (par) B[par].add(b);
    B[n] = b; bones.push(b); inv.push(new THREE.Matrix4().makeTranslation(-x * sc, -y * sc, -z * sc));
  });
  const skeleton = new THREE.Skeleton(bones, inv);
  const mesh = new THREE.SkinnedMesh(geo, material()); mesh.name = 'animal-body'; mesh.add(bones[0]);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(K === CHAM ? -0.15 : 0, 0.42, 0), K === CHAM ? 1.45 : 0.85);
  group.add(mesh);
  const len = {};
  if (K === PINKY) { len.thigh = abs.thighL[1] - abs.shinL[1]; len.shin = abs.shinL[1] - abs.footL[1]; }
  if (K === CHAM) { // 兩節的長度、站著的時候兩節的角度（往前＝正）
    const d = (a, b) => Math.hypot(abs[a][0] - abs[b][0], abs[a][1] - abs[b][1]), ang = (a, b) => Math.atan2(abs[b][0] - abs[a][0], abs[a][1] - abs[b][1]);
    len.cu = d('LFu', 'LFl'); len.cl = d('LFl', 'LFf');
    len.ruF = ang('LFu', 'LFl'); len.rlF = ang('LFl', 'LFf'); len.ruH = ang('LHu', 'LHl'); len.rlH = ang('LHl', 'LHf');
  }
  const C = {
    group, mesh, bones, skeleton, B, K, kind, rest, len, legs: ['LF', 'RF', 'LH', 'RH'], animal: kind,
    look: { animal: kind, age: 'adult' }, height: K.height, radius: K.radius, state: 'idle', anim: newAnim(SEED++ * 7919 + kind.length),
    info: { tris: geo.index.count / 3, verts: geo.attributes.position.count, draws: 1, buildMs: 0 }, shadow: null,
    update(dt, o) { step(C, dt, o || NO_OPTS); },
    setLook(p) { if (p && p.animal && KINDS[p.animal] && p.animal !== C.kind) { const n = buildAnimal(p, opts); C.group.remove(C.mesh); Object.assign(C, { mesh: n.mesh, bones: n.bones, skeleton: n.skeleton, B: n.B, K: n.K, kind: n.kind, rest: n.rest, len: n.len, animal: n.kind, look: n.look, height: n.height, radius: n.radius, info: n.info }); C.group.add(C.mesh); if (C.shadow && n.shadow) C.shadow.scale.copy(n.shadow.scale); C.group.name = n.group.name; } },
    dispose() { group.removeFromParent(); skeleton.dispose(); }, // 幾何、材質大家共用，不釋放
  };
  if (opts.shadow !== false) { const sh = shadowMat(); C.shadow = new THREE.Mesh(sh.geo, sh.mat); C.shadow.name = 'animal-shadow'; C.shadow.renderOrder = -1; group.add(C.shadow); C.info.draws = 2; }
  C.update(0, { state: 'idle', speed: 0 });
  C.info.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return C;
}
const NO_OPTS = {};
function randomAnimal(rng = Math.random) { return { animal: ANIMAL_KINDS[Math.min(2, Math.floor(rng() * 3))], age: 'adult' }; }

return { buildAnimal, randomAnimal, ANIMAL_KINDS };
})();
