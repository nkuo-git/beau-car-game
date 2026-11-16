// ---- 大便龍寵物店（第 95 批）：村子裡的寵物店（外面、裡面）；三隻動物（小豬、粉紅、變色龍）站在圓台上，走到前面按「買」 ----
// Nick 2026-11-15「可以花重金買寵物 / 寵物是那三隻 / 他會一直跟著你 可以幫你打警察或人 / 你開車可以讓寵物騎沙灘車跟在你後面」
//   mock https://claude.ai/artifact/JiamLyxU1TobxZU6T6cgko ，2026-11-16 卡片選「照這樣做」、「做好就上線」
// 位置：大停車場西邊（以前那塊稻田）：大樓 x −370.5…−357.5、z −35…−15，大門朝東（大停車場西邊那條路）；全部用程式做（貼圖 canvas 畫的，沒有下載東西）
// 世界座標跟 village.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北）
//
// 【API】
//   PETSHOP：{ x, z, hx, hz, H, door }（大樓、門口）；PET_KINDS：[{ k: 'pig'|'pinky'|'cham', name, price（萬）}]；PETSHOP_TEXT：貼圖上的字（字型先載）
//   buildPetShop({ renderer }) → { group（村子的 group 裡：2 個 draw call）, colliders, pave, place, building, info }   ← village.js 蓋村子的時候叫
//   buildPetShopInterior({ makeAnimal, makeCharacter, renderer }) → {   ← town.src.js 第一次走進去才蓋（之後留著）
//     group（世界位置；放進自己的 THREE.Scene，燈在 group 裡）, background, environment: null, spawn, exitDoor, exits, doors, colliders, camera: { maxDist, ceiling, near },
//     zones（三個圓台前面「買」的長方形）, zoneAt(x, z) → 0｜1｜2｜-1, update(dt, player), info, dispose()
//   }
import * as THREE from 'three';

export const { PETSHOP, PET_KINDS, PETSHOP_TEXT, buildPetShop, buildPetShopInterior } = (() => {
const PETSHOP = { x: -364, z: -25, hx: 6.5, hz: 10, H: 4.4, top: 5.0, door: { x: -356.9, z: -25, ry: Math.PI / 2 } };
const FX = PETSHOP.x + PETSHOP.hx, BX = PETSHOP.x - PETSHOP.hx, NZ = PETSHOP.z - PETSHOP.hz, SZ = PETSHOP.z + PETSHOP.hz; // 正面 x −357.5、後面 −370.5、北 z −35、南 −15
const PET_KINDS = [{ k: 'pig', name: '小豬', price: 200, col: '#f4b6c6' }, { k: 'pinky', name: '粉紅', price: 200, col: '#ff6fa8' }, { k: 'cham', name: '變色龍', price: 300, col: '#8a62d6' }]; // 第 96 批（Nick 2026-11-16「寵物太貴了」）：便宜 10 倍（以前 2000、2000、3000）
const PODS = [{ z: -30.6, r: 0.95, x: -367.0 }, { z: -25.0, r: 0.95, x: -367.0 }, { z: -19.2, r: 1.3, x: -367.3 }]; // 圓台（照 PET_KINDS 的順序；變色龍最長，圓台大一點）
const NAME = '大便龍寵物店';
const PETSHOP_TEXT = [...new Set([...NAME, ...'小豬粉紅變色龍萬最大隻可愛寵物歡迎參觀光臨會一直跟著你收銀台飼料玩具零食幫你打騎沙灘車0123456789！'])].join('');
const SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const hasDoc = typeof document !== 'undefined' && !!document.createElement;
const C3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ---- 網格：方塊、四邊形、圓柱（頂點顏色＋貼圖 uv）----
function mesher() { return { p: [], n: [], c: [], uv: [], i: [], v: 0 }; }
function quad(M, a, b, c, d, nrm, col, uv) { // a 左下、b 右下、c 右上、d 左上（從正面看）
  const o = M.v;
  for (const q of [a, b, c, d]) { M.p.push(q[0], q[1], q[2]); M.n.push(nrm[0], nrm[1], nrm[2]); M.c.push(col[0], col[1], col[2]); }
  if (uv) M.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]); else M.uv.push(0, 0, 0, 0, 0, 0, 0, 0);
  M.i.push(o, o + 1, o + 2, o, o + 2, o + 3); M.v += 4;
}
function box(M, x0, y0, z0, x1, y1, z1, col, o = {}) { // o.top：上面的顏色；o.skip：{ px, nx, py, ny, pz, nz } 不畫哪幾面
  const s = o.skip || {}, top = o.top || col, sd = o.side || col;
  if (!s.px) quad(M, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], sd);
  if (!s.nx) quad(M, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], sd);
  if (!s.pz) quad(M, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col);
  if (!s.nz) quad(M, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col);
  if (!s.py) quad(M, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top);
  if (!s.ny) quad(M, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col);
}
function cyl(M, cx, cz, y0, y1, r, col, top, n = 28) {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
    quad(M, [p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [Math.cos(am), 0, Math.sin(am)], col);
    const o = M.v; // 上面一片三角形
    M.p.push(cx, y1, cz, p1[0], y1, p1[1], p0[0], y1, p0[1]); for (let j = 0; j < 3; j++) { M.n.push(0, 1, 0); M.c.push(top[0], top[1], top[2]); M.uv.push(0, 0); }
    M.i.push(o, o + 1, o + 2); M.v += 3;
  }
}
function toMesh(M, mat, name) {
  if (!M.v) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(M.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
  g.setIndex(M.i); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}

// ---- 貼圖（1024²，一次畫好，裡外共用）：招牌、櫥窗、雨遮的條紋、玻璃門、價錢牌、飼料、海報 ----
const AW = 1024;
const R = { sign: [0, 0, 1024, 150], win: [0, 150, 1024, 450], awn: [0, 450, 512, 560], door: [512, 450, 768, 850], food: [768, 450, 1024, 706], poster: [768, 706, 1024, 1010],
  price: [[0, 560, 512, 688], [0, 688, 512, 816], [0, 816, 512, 944]] };
const UV = (r) => [r[0] / AW, 1 - r[3] / AW, r[2] / AW, 1 - r[1] / AW];
let ATLAS = null;
function paw(g, x, y, s, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y + s * 0.25, s * 0.42, s * 0.36, 0, 0, Math.PI * 2); g.fill(); for (const [dx, dy] of [[-0.42, -0.2], [-0.15, -0.45], [0.15, -0.45], [0.42, -0.2]]) { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, s * 0.15, s * 0.19, 0, 0, Math.PI * 2); g.fill(); } }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function face(g, kind, x, y, s) { // 三隻動物的臉（櫥窗、招牌上的小圖；自己畫的）
  if (kind === 'pig') { g.fillStyle = '#fbf7f2'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f4a7b9'; g.beginPath(); g.ellipse(x, y + s * 0.25, s * 0.38, s * 0.26, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c4566f'; for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * s * 0.13, y + s * 0.25, s * 0.07, 0, Math.PI * 2); g.fill(); } for (const d of [-1, 1]) { g.fillStyle = '#fbf7f2'; g.beginPath(); g.ellipse(x + d * s * 0.7, y - s * 0.75, s * 0.28, s * 0.36, d * 0.5, 0, Math.PI * 2); g.fill(); } }
  else if (kind === 'pinky') { for (const d of [-1, 1]) { g.fillStyle = '#ff8fbd'; g.beginPath(); g.ellipse(x + d * s * 0.95, y - s * 0.2, s * 0.45, s * 0.7, d * 0.4, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ff9cc6'; g.beginPath(); g.ellipse(x, y + s * 0.55, s * 0.22, s * 0.5, 0, 0, Math.PI * 2); g.fill(); }
  else { const cols = ['#ff5a5a', '#ffb13b', '#ffe94a', '#5ad16b', '#47a8ff', '#9b6bff']; for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(x, y, s * (1 - i * 0.14), 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ffffff'; for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * s * 0.55, y - s * 0.3, s * 0.28, 0, Math.PI * 2); g.fill(); } }
  g.fillStyle = '#1b1b22'; for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * s * (kind === 'cham' ? 0.55 : 0.36), y - s * (kind === 'cham' ? 0.3 : 0.18), s * 0.1, 0, Math.PI * 2); g.fill(); }
}
function atlas() {
  if (ATLAS) return ATLAS;
  if (!hasDoc) return (ATLAS = { tex: null });
  const c = document.createElement('canvas'); c.width = c.height = AW; const g = c.getContext('2d');
  g.fillStyle = '#e9e4da'; g.fillRect(0, 0, AW, AW);
  // 招牌：深青綠的板子、奶油色的字、兩邊腳印、右邊三隻的臉
  { const [x0, y0, x1, y1] = R.sign, w = x1 - x0, h = y1 - y0; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#1f7f86'); gr.addColorStop(1, '#155e66'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.strokeStyle = '#ffd08a'; g.lineWidth = 6; g.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
    g.fillStyle = '#fff6e0'; g.font = `900 92px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(NAME, x0 + w * 0.43, y0 + h * 0.54);
    paw(g, x0 + 60, y0 + h * 0.5, 54, '#ffd08a'); face(g, 'pig', x1 - 230, y0 + h * 0.56, 30); face(g, 'pinky', x1 - 150, y0 + h * 0.56, 28); face(g, 'cham', x1 - 66, y0 + h * 0.56, 32); }
  // 櫥窗：暖暖的燈、三隻動物、腳印貼紙、字
  { const [x0, y0, x1, y1] = R.win, w = x1 - x0, h = y1 - y0; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fff3d6'); gr.addColorStop(1, '#ffd9a6'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x0 + 80, y0); g.lineTo(x0 + 260, y0); g.lineTo(x0 + 120, y1); g.lineTo(x0 - 60, y1); g.fill(); g.beginPath(); g.moveTo(x0 + 620, y0); g.lineTo(x0 + 700, y0); g.lineTo(x0 + 560, y1); g.lineTo(x0 + 480, y1); g.fill();
    for (const [k, fx, s] of [['pig', 0.2, 60], ['pinky', 0.5, 56], ['cham', 0.8, 66]]) { g.fillStyle = 'rgba(120,80,40,0.18)'; g.beginPath(); g.ellipse(x0 + w * fx, y0 + h * 0.86, s * 1.3, 14, 0, 0, Math.PI * 2); g.fill(); face(g, k, x0 + w * fx, y0 + h * 0.58, s); }
    g.fillStyle = '#d4552a'; g.font = `900 48px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('可愛寵物 歡迎參觀', x0 + w * 0.5, y0 + 44);
    for (let i = 0; i < 6; i++) paw(g, x0 + 40 + i * 190, y1 - 24, 22, 'rgba(255,106,31,0.55)');
    g.strokeStyle = '#1f6f78'; g.lineWidth = 10; g.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10); }
  // 雨遮：橘白條紋
  { const [x0, y0, x1, y1] = R.awn; for (let i = 0, x = x0; x < x1; i++, x += 32) { g.fillStyle = i % 2 ? '#fff4e6' : '#ff7a2f'; g.fillRect(x, y0, 32, y1 - y0); } }
  // 玻璃門：深青綠的框、淺藍的玻璃、腳印、歡迎光臨
  { const [x0, y0, x1, y1] = R.door, w = x1 - x0, h = y1 - y0; g.fillStyle = '#1f6f78'; g.fillRect(x0, y0, w, h);
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#cfe9ee'); gr.addColorStop(1, '#8fbfca'); g.fillStyle = gr; g.fillRect(x0 + 16, y0 + 16, w / 2 - 22, h - 32); g.fillRect(x0 + w / 2 + 6, y0 + 16, w / 2 - 22, h - 32);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0 + 30, y0 + 30, 14, h - 60); g.fillRect(x0 + w / 2 + 20, y0 + 30, 14, h - 60);
    g.fillStyle = '#e8eef0'; g.fillRect(x0 + w / 2 - 20, y0 + h * 0.45, 8, 60); g.fillRect(x0 + w / 2 + 12, y0 + h * 0.45, 8, 60);
    paw(g, x0 + w * 0.5, y0 + h * 0.3, 40, '#ff7a2f'); g.fillStyle = '#1f6f78'; g.font = `900 30px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('歡迎光臨', x0 + w * 0.5, y0 + h * 0.66); }
  // 飼料袋（貨架上）
  { const [x0, y0, x1, y1] = R.food, w = x1 - x0, h = y1 - y0, cols = ['#e85d4a', '#3f9be0', '#f2b53a', '#55b46a', '#a26ad6', '#ff8fbd'];
    g.fillStyle = '#8a6a4a'; g.fillRect(x0, y0, w, h);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const bx = x0 + 6 + i * 41, by = y0 + 10 + r * 124, c = cols[(i + r * 3) % 6]; g.fillStyle = c; rrect(g, bx, by, 36, 104, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(bx + 4, by + 30, 28, 30); paw(g, bx + 18, by + 46, 14, c); }
    g.fillStyle = '#5b4330'; g.fillRect(x0, y0 + 118, w, 8); g.fillRect(x0, y1 - 8, w, 8); }
  // 海報：寵物會一直跟著你
  { const [x0, y0, x1, y1] = R.poster, w = x1 - x0, h = y1 - y0; g.fillStyle = '#fff8ea'; g.fillRect(x0, y0, w, h); g.fillStyle = '#ff7a2f'; g.fillRect(x0, y0, w, 52);
    g.fillStyle = '#ffffff'; g.font = `900 30px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('寵物會一直跟著你', x0 + w / 2, y0 + 27);
    face(g, 'pig', x0 + 60, y0 + 130, 34); face(g, 'pinky', x0 + 128, y0 + 130, 32); face(g, 'cham', x0 + 196, y0 + 130, 36);
    g.fillStyle = '#1f6f78'; g.font = `800 26px ${SANS}`; g.fillText('幫你打、騎沙灘車', x0 + w / 2, y0 + 220); for (let i = 0; i < 4; i++) paw(g, x0 + 40 + i * 58, y1 - 26, 14, '#ffb48a'); }
  // 價錢牌：白底、上面一條動物的顏色
  PET_KINDS.forEach((p, i) => {
    const [x0, y0, x1, y1] = R.price[i], w = x1 - x0, h = y1 - y0; g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, h); g.fillStyle = p.col; g.fillRect(x0, y0, w, 18); g.fillRect(x0, y1 - 8, w, 8);
    face(g, p.k, x0 + 64, y0 + h * 0.56, 34);
    g.fillStyle = '#26303a'; g.font = `900 52px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(p.name, x0 + 120, y0 + h * 0.58);
    g.fillStyle = '#d4552a'; g.font = `900 44px ${SANS}`; g.textAlign = 'right'; g.fillText(`${p.price} 萬`, x1 - 22, y0 + h * 0.6);
    if (p.k === 'cham') { g.fillStyle = '#8a62d6'; g.font = `800 20px ${SANS}`; g.textAlign = 'left'; g.fillText('最大隻！', x0 + 124, y0 + 34); }
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true;
  return (ATLAS = { tex, canvas: c });
}
function floorTex() { // 木頭地板＋淡淡的腳印（2 公尺一張）
  if (!hasDoc) return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { const v = 0.9 + ((i * 37) % 7) * 0.025; g.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(176 * v)},${Math.round(128 * v)})`; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(90,60,30,0.35)'; g.fillRect(0, i * 32 + 31, 256, 1); g.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32); }
  paw(g, 70, 90, 26, 'rgba(255,255,255,0.22)'); paw(g, 190, 190, 26, 'rgba(255,255,255,0.22)');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.anisotropy = 4;
  return t;
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const A = atlas();
  MATS = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
    sign: new THREE.MeshStandardMaterial({ map: A.tex, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: 0.16, roughness: 0.55, metalness: 0, vertexColors: false }),
  };
  MATS.body.name = 'petshop-body'; MATS.sign.name = 'petshop-sign';
  return MATS;
}

// ==================== 外面（村子）====================
function buildPetShop() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const M = mesher(), S = mesher(), H = PETSHOP.H, TOP = PETSHOP.top, x = FX;
  const WALL = C3('#c4e6d4'), WALL2 = C3('#a9d5c0'), TRIM = C3('#fbf6ec'), BASE = C3('#8d9196'), ROOF = C3('#9a9c9e'), FRAME = C3('#1f6f78'), AWU = C3('#e0682a'), GREEN = C3('#4f8f45'), POT = C3('#b8754a');
  box(M, BX - 0.1, 0, NZ - 0.1, FX + 0.1, 0.3, SZ + 0.1, BASE, { skip: { ny: true } }); // 台基
  box(M, BX, 0.3, NZ, FX, H, SZ, WALL, { skip: { ny: true, py: true }, side: WALL }); // 牆
  for (const [z0, z1] of [[NZ, NZ + 0.35], [SZ - 0.35, SZ]]) box(M, FX - 0.02, 0.3, z0, FX + 0.12, H, z1, WALL2, { skip: { ny: true } }); // 正面兩邊的柱子
  box(M, BX - 0.06, 2.92, NZ - 0.06, FX + 0.06, 3.08, SZ + 0.06, TRIM, { skip: { ny: false } }); // 腰帶
  box(M, BX - 0.12, H, NZ - 0.12, FX + 0.12, TOP, SZ + 0.12, TRIM, { top: ROOF }); // 女兒牆（上面當屋頂）
  box(M, BX + 2, TOP, NZ + 3, BX + 3.4, TOP + 0.9, NZ + 4.2, C3('#d7dadd')); // 屋頂的冷氣
  // 櫥窗、門的框（深青綠）
  const WIN = [[NZ + 1.5, PETSHOP.z - 2.0], [PETSHOP.z + 2.0, SZ - 1.5]], WY0 = 0.75, WY1 = 2.65;
  for (const [z0, z1] of WIN) { box(M, x, WY0 - 0.12, z0 - 0.12, x + 0.1, WY0, z1 + 0.12, FRAME); box(M, x, WY1, z0 - 0.12, x + 0.1, WY1 + 0.12, z1 + 0.12, FRAME); for (const zz of [z0 - 0.12, z1]) box(M, x, WY0, zz, x + 0.1, WY1, zz + 0.12, FRAME); box(M, x, 0.3, z0 - 0.12, x + 0.14, WY0 - 0.12, z1 + 0.12, C3('#7fb8a4')); }
  box(M, x, 0.3, PETSHOP.z - 1.1, x + 0.12, 2.75, PETSHOP.z - 0.98, FRAME); box(M, x, 0.3, PETSHOP.z + 0.98, x + 0.12, 2.75, PETSHOP.z + 1.1, FRAME); box(M, x, 2.63, PETSHOP.z - 1.1, x + 0.12, 2.75, PETSHOP.z + 1.1, FRAME);
  // 雨遮：斜的（上面條紋貼圖、下面橘色）＋前面垂下來那一條
  const AWN = [[NZ + 1.2, PETSHOP.z - 1.6], [PETSHOP.z - 1.6, PETSHOP.z + 1.6], [PETSHOP.z + 1.6, SZ - 1.2]], aw = UV(R.awn);
  for (const [z0, z1] of AWN) {
    const ya = 3.12, yb = 2.78, xo = x + 1.25, ny = 0.94, nx = 0.34;
    quad(S, [xo, yb, z1], [xo, yb, z0], [x, ya, z0], [x, ya, z1], [nx, ny, 0], [1, 1, 1], [aw[0], aw[1], aw[0] + (aw[2] - aw[0]) * ((z1 - z0) / 4), aw[3]]);
    quad(M, [x, ya - 0.02, z1], [x, ya - 0.02, z0], [xo, yb - 0.02, z0], [xo, yb - 0.02, z1], [-nx, -ny, 0], AWU);
    quad(S, [xo, yb - 0.26, z1], [xo, yb - 0.26, z0], [xo, yb, z0], [xo, yb, z1], [1, 0, 0], [1, 1, 1], [aw[0], aw[1], aw[0] + (aw[2] - aw[0]) * ((z1 - z0) / 4), aw[1] + (aw[3] - aw[1]) * 0.35]);
    quad(M, [xo, yb - 0.26, z0], [x, ya - 0.26, z0], [x, ya, z0], [xo, yb, z0], [0, 0, -1], AWU); quad(M, [x, ya - 0.26, z1], [xo, yb - 0.26, z1], [xo, yb, z1], [x, ya, z1], [0, 0, 1], AWU); // 兩頭
  }
  // 招牌（雨遮上面）、櫥窗、玻璃門（貼圖）
  box(M, x, 3.14, PETSHOP.z - 4.25, x + 0.16, 4.38, PETSHOP.z + 4.25, FRAME);
  quad(S, [x + 0.165, 3.2, PETSHOP.z + 4.1], [x + 0.165, 3.2, PETSHOP.z - 4.1], [x + 0.165, 4.32, PETSHOP.z - 4.1], [x + 0.165, 4.32, PETSHOP.z + 4.1], [1, 0, 0], [1, 1, 1], UV(R.sign));
  const wu = UV(R.win);
  WIN.forEach(([z0, z1]) => quad(S, [x + 0.04, WY0, z1], [x + 0.04, WY0, z0], [x + 0.04, WY1, z0], [x + 0.04, WY1, z1], [1, 0, 0], [1, 1, 1], wu));
  quad(S, [x + 0.04, 0.3, PETSHOP.z + 0.98], [x + 0.04, 0.3, PETSHOP.z - 0.98], [x + 0.04, 2.63, PETSHOP.z - 0.98], [x + 0.04, 2.63, PETSHOP.z + 0.98], [1, 0, 0], [1, 1, 1], UV(R.door));
  // 側面的牆上一張海報（南邊、北邊）
  const pu = UV(R.poster);
  quad(S, [FX - 4.4, 0.9, SZ + 0.01], [FX - 2.0, 0.9, SZ + 0.01], [FX - 2.0, 3.3, SZ + 0.01], [FX - 4.4, 3.3, SZ + 0.01], [0, 0, 1], [1, 1, 1], pu);
  quad(S, [FX - 2.0, 0.9, NZ - 0.01], [FX - 4.4, 0.9, NZ - 0.01], [FX - 4.4, 3.3, NZ - 0.01], [FX - 2.0, 3.3, NZ - 0.01], [0, 0, -1], [1, 1, 1], pu);
  // 門口兩邊的花台
  for (const zc of [PETSHOP.z - 2.9, PETSHOP.z + 2.9]) { box(M, x + 0.3, 0.3, zc - 0.5, x + 0.9, 0.75, zc + 0.5, POT); box(M, x + 0.36, 0.75, zc - 0.44, x + 0.84, 1.05, zc + 0.44, GREEN); }
  const m = mats(), group = new THREE.Group(); group.name = 'petshop';
  for (const q of [toMesh(M, m.body, 'petshop-body'), toMesh(S, m.sign, 'petshop-sign')]) if (q) group.add(q);
  const colliders = [{ t: 'box', x: PETSHOP.x + 0.05, z: PETSHOP.z, hx: PETSHOP.hx + 0.05, hz: PETSHOP.hz, rot: 0, h: TOP, noCrush: true, petshop: true }];
  for (const zc of [PETSHOP.z - 2.9, PETSHOP.z + 2.9]) colliders.push({ t: 'box', x: x + 0.6, z: zc, hx: 0.3, hz: 0.5, rot: 0, h: 1.05, noCrush: true });
  const pave = [{ x: (FX + -350.9) / 2, z: PETSHOP.z, hx: (-350.9 - FX) / 2, hz: 11, col: '#cfcbc4' }]; // 門口到路邊的水泥地
  const place = { name: NAME, pos: [FX + 3, PETSHOP.z], spawn: { x: FX + 4.2, z: PETSHOP.z + 6, heading: Math.PI / 2 }, zone: { x: FX + 3.3, z: PETSHOP.z, hx: 3.2, hz: 10.5, rot: 0 },
    door: { x: PETSHOP.door.x, z: PETSHOP.door.z, heading: 0 }, building: { x: PETSHOP.x, z: PETSHOP.z, hx: PETSHOP.hx, hz: PETSHOP.hz, rot: 0 } };
  const building = { kind: 'petshop', name: NAME, x: PETSHOP.x, z: PETSHOP.z, hx: PETSHOP.hx, hz: PETSHOP.hz, rot: 0, h: TOP, floors: 1, door: { ...PETSHOP.door } };
  const tris = (M.i.length + S.i.length) / 3;
  return { group, colliders, pave, place, building, info: { meshes: group.children.length, tris, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) } };
}

// ==================== 裡面（自己的場景）====================
function buildPetShopInterior(o = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const IX0 = BX + 0.2, IX1 = FX - 0.2, IZ0 = NZ + 0.2, IZ1 = SZ - 0.2, CH = 3.6, DZ = 1.0; // 裡面的牆、天花板、門洞半寬
  const M = mesher(), S = mesher(), L = mesher(), Fm = mesher();
  const WALL = C3('#fff0c9'), LOW = C3('#ffcf9c'), CEIL = C3('#fbfaf6'), WOOD = C3('#a77b52'), WHITE = C3('#f7f6f2'), FRAME = C3('#1f6f78'), GLASS = C3('#dff2f7');
  // 地板（貼圖，2 公尺一張）
  { const w = IX1 - IX0, d = IZ1 - IZ0; quad(Fm, [IX0, 0, IZ1], [IX1, 0, IZ1], [IX1, 0, IZ0], [IX0, 0, IZ0], [0, 1, 0], [1, 1, 1], [0, 0, w / 2, d / 2]); }
  // 牆（朝裡面）：下面一截橘色、上面奶油色；正面的牆有門洞、兩扇窗（亮亮的）
  const wallX = (xx, nx, z0, z1, y0, y1, col) => (nx > 0 ? quad(M, [xx, y0, z1], [xx, y0, z0], [xx, y1, z0], [xx, y1, z1], [1, 0, 0], col) : quad(M, [xx, y0, z0], [xx, y0, z1], [xx, y1, z1], [xx, y1, z0], [-1, 0, 0], col));
  const wallZ = (zz, nz, x0, x1, y0, y1, col) => (nz > 0 ? quad(M, [x0, y0, zz], [x1, y0, zz], [x1, y1, zz], [x0, y1, zz], [0, 0, 1], col) : quad(M, [x1, y0, zz], [x0, y0, zz], [x0, y1, zz], [x1, y1, zz], [0, 0, -1], col));
  for (const [y0, y1, col] of [[0, 1.0, LOW], [1.0, CH, WALL]]) {
    wallX(IX0, 1, IZ0, IZ1, y0, y1, col); wallZ(IZ0, 1, IX0, IX1, y0, y1, col); wallZ(IZ1, -1, IX0, IX1, y0, y1, col);
    wallX(IX1, -1, IZ0, PETSHOP.z - DZ, y0, y1, col); wallX(IX1, -1, PETSHOP.z + DZ, IZ1, y0, y1, col);
  }
  wallX(IX1, -1, PETSHOP.z - DZ, PETSHOP.z + DZ, 2.6, CH, WALL); // 門上面
  for (const [a, b, c, d2] of [[IX0, IX0 + 0.03, IZ0, IZ1], [IX1 - 0.03, IX1, IZ0, IZ1], [IX0, IX1, IZ0, IZ0 + 0.03], [IX0, IX1, IZ1 - 0.03, IZ1]]) box(M, a, 0.98, c, b, 1.05, d2, C3('#ff9a52'), { skip: { ny: true } });
  for (const [z0, z1] of [[NZ + 1.5, PETSHOP.z - 2.0], [PETSHOP.z + 2.0, SZ - 1.5]]) { wallX(IX1 - 0.01, -1, z0, z1, 0.75, 2.65, GLASS); for (const zz of [z0, z1]) box(M, IX1 - 0.08, 0.7, zz - 0.05, IX1, 2.7, zz + 0.05, FRAME); box(M, IX1 - 0.08, 0.7, z0, IX1, 0.76, z1, FRAME); box(M, IX1 - 0.08, 2.64, z0, IX1, 2.7, z1, FRAME); }
  for (const zz of [PETSHOP.z - DZ, PETSHOP.z + DZ]) box(M, IX1 - 0.1, 0, zz - 0.06, IX1 + 0.2, 2.66, zz + 0.06, FRAME); box(M, IX1 - 0.1, 2.6, PETSHOP.z - DZ, IX1 + 0.2, 2.68, PETSHOP.z + DZ, FRAME);
  quad(M, [IX1 + 0.19, 0, PETSHOP.z - DZ], [IX1 + 0.19, 0, PETSHOP.z + DZ], [IX1 + 0.19, 2.6, PETSHOP.z + DZ], [IX1 + 0.19, 2.6, PETSHOP.z - DZ], [-1, 0, 0], C3('#bfe3ea')); // 門外亮亮的（玻璃門）
  quad(M, [IX0, CH, IZ0], [IX1, CH, IZ0], [IX1, CH, IZ1], [IX0, CH, IZ1], [0, -1, 0], CEIL); // 天花板
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const cx = IX0 + 2.2 + i * 4.1, cz = IZ0 + 2.6 + j * 4.8; quad(L, [cx - 0.6, CH - 0.02, cz - 0.3], [cx + 0.6, CH - 0.02, cz - 0.3], [cx + 0.6, CH - 0.02, cz + 0.3], [cx - 0.6, CH - 0.02, cz + 0.3], [0, -1, 0], [1, 1, 1]); }
  // 圓台＋後面牆上的價錢牌＋最上面的店名
  PET_KINDS.forEach((p, i) => {
    const P = PODS[i], col = C3(p.col);
    cyl(M, P.x, P.z, 0, 0.12, P.r + 0.12, C3('#ffffff'), C3('#f1ece2'));
    cyl(M, P.x, P.z, 0.12, 0.36, P.r, col, C3('#fffdf8'));
    const pu = UV(R.price[i]), z0 = P.z - 1.15, z1 = P.z + 1.15;
    box(M, IX0, 1.84, z0 - 0.06, IX0 + 0.04, 2.48, z1 + 0.06, FRAME);
    quad(S, [IX0 + 0.05, 1.88, z1], [IX0 + 0.05, 1.88, z0], [IX0 + 0.05, 2.44, z0], [IX0 + 0.05, 2.44, z1], [1, 0, 0], [1, 1, 1], pu);
  });
  quad(S, [IX0 + 0.05, 2.7, PETSHOP.z + 2.1], [IX0 + 0.05, 2.7, PETSHOP.z - 2.1], [IX0 + 0.05, 3.32, PETSHOP.z - 2.1], [IX0 + 0.05, 3.32, PETSHOP.z + 2.1], [1, 0, 0], [1, 1, 1], UV(R.sign));
  // 收銀台（東北角）＋收銀機
  const CT = { x0: -362.2, x1: -359.4, z0: -33.5, z1: -32.7 };
  box(M, CT.x0, 0, CT.z0, CT.x1, 1.0, CT.z1, WOOD, { top: WHITE, skip: { ny: true } }); box(M, CT.x0 + 0.5, 1.0, CT.z0 + 0.15, CT.x0 + 0.95, 1.25, CT.z0 + 0.6, C3('#33383e'));
  box(M, CT.x1 - 0.9, 1.0, CT.z0 + 0.2, CT.x1 - 0.3, 1.04, CT.z0 + 0.6, C3('#ff8fbd'));
  // 貨架（北牆、南牆）：木頭架子、飼料
  const SH = [{ x0: -369.9, x1: -364.0, z0: IZ0, z1: IZ0 + 0.45, nz: 1 }, { x0: -369.9, x1: -364.6, z0: IZ1 - 0.45, z1: IZ1, nz: -1 }, { x0: -362.6, x1: -360.0, z0: IZ1 - 0.45, z1: IZ1, nz: -1 }];
  const fu = UV(R.food);
  for (const s of SH) {
    box(M, s.x0, 0, s.z0, s.x1, 0.06, s.z1, WOOD); box(M, s.x0, 0.9, s.z0, s.x1, 0.95, s.z1, WOOD); box(M, s.x0, 1.75, s.z0, s.x1, 1.8, s.z1, WOOD);
    for (const xx of [s.x0, s.x1 - 0.05]) box(M, xx, 0, s.z0, xx + 0.05, 1.8, s.z1, WOOD);
    const zf = s.nz > 0 ? s.z1 - 0.05 : s.z0 + 0.05, w = s.x1 - s.x0, n = Math.max(1, Math.round(w / 1.6));
    for (let k = 0; k < n; k++) { const xa = s.x0 + 0.08 + (k * (w - 0.16)) / n, xb = s.x0 + 0.08 + ((k + 1) * (w - 0.16)) / n;
      if (s.nz > 0) quad(S, [xa, 0.06, zf], [xb, 0.06, zf], [xb, 1.74, zf], [xa, 1.74, zf], [0, 0, 1], [1, 1, 1], fu); else quad(S, [xb, 0.06, zf], [xa, 0.06, zf], [xa, 1.74, zf], [xb, 1.74, zf], [0, 0, -1], [1, 1, 1], fu); }
  }
  // 海報（南牆兩個貨架中間）
  { const pu = UV(R.poster), zf = IZ1 - 0.02; quad(S, [-362.8, 1.0, zf], [-364.4, 1.0, zf], [-364.4, 2.9, zf], [-362.8, 2.9, zf], [0, 0, -1], [1, 1, 1], pu); }
  // 地上的圓地毯（門口）
  cyl(M, IX1 - 1.6, PETSHOP.z, 0, 0.012, 1.0, C3('#ffb48a'), C3('#ffb48a'), 24);

  const m = mats(), group = new THREE.Group(); group.name = 'petshop-in';
  const own = [];
  const lit = new THREE.MeshBasicMaterial({ color: 0xfffbf0 }); own.push(lit);
  const ft = floorTex(), fmat = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.6, metalness: 0 }); own.push(fmat); if (ft) own.push(ft);
  const inMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }); own.push(inMat);
  const meshes = [toMesh(Fm, fmat, 'ps-floor'), toMesh(M, inMat, 'ps-in'), toMesh(S, m.sign, 'ps-signs'), toMesh(L, lit, 'ps-lights')].filter(Boolean);
  for (const q of meshes) { group.add(q); own.push(q.geometry); }
  // 燈：跟槍店一樣的組合（不重新編譯 shader）
  const hemi = new THREE.HemisphereLight(0xfff3e2, 0x6a5a48, 1.0); group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.6); sun.position.set(PETSHOP.x + 4, 6, PETSHOP.z + 3); sun.target.position.set(PETSHOP.x - 2, 0, PETSHOP.z - 1); group.add(sun, sun.target);
  const p1 = new THREE.PointLight(0xffe6c8, 10, 14, 1.2); p1.position.set(-366.5, 3.0, -25); group.add(p1);
  const p2 = new THREE.PointLight(0xeef2ff, 7, 14, 1.1); p2.position.set(-360.5, 3.0, -25); group.add(p2);

  // 三隻展示的動物（站在圓台上，轉頭看你）
  const pets = [];
  if (typeof o.makeAnimal === 'function') PET_KINDS.forEach((p, i) => {
    try { const C = o.makeAnimal({ animal: p.k, age: 'adult' }); const P = PODS[i]; C.group.position.set(P.x + (p.k === 'cham' ? 0.45 : 0), 0.36, P.z); C.group.rotation.y = 0; C.group.name = 'ps-pet-' + p.k; group.add(C.group); pets.push({ C, yaw: 0, P }); } catch (e) { console.warn('petshop pet', e); }
  });
  // 店員（收銀台後面）
  let clerk = null;
  if (typeof o.makeCharacter === 'function') {
    try {
      clerk = o.makeCharacter({ body: 'f', age: 'adult', height: 1.62, build: 'slim', skin: '#e9c3a0', hair: 'ponytail', hairColor: '#3a2a20', top: 'polo', topColor: '#ff7a2f', bottom: 'pants', bottomColor: '#2e3a46', shoes: 'sneakers', shoesColor: '#f2f2f2', hat: 'none', glasses: 'none', mask: false });
      clerk.group.position.set(-360.8, 0, -34.15); clerk.group.rotation.y = -Math.PI / 2; clerk.group.name = 'ps-clerk'; group.add(clerk.group);
    } catch (e) { console.warn('petshop clerk', e); clerk = null; }
  }

  // ---- 碰撞、區域、出口（世界座標）----
  const B = (x0, z0, x1, z1, h) => ({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, h });
  const colliders = [
    B(IX0 - 0.4, IZ0 - 0.4, IX0, IZ1 + 0.4, CH), B(IX0 - 0.4, IZ0 - 0.4, IX1 + 0.4, IZ0, CH), B(IX0 - 0.4, IZ1, IX1 + 0.4, IZ1 + 0.4, CH), // 後面、北、南
    B(IX1, IZ0 - 0.4, IX1 + 0.4, PETSHOP.z - DZ, CH), B(IX1, PETSHOP.z + DZ, IX1 + 0.4, IZ1 + 0.4, CH), // 正面（門洞留著）
    B(CT.x0, CT.z0, CT.x1, CT.z1, 1.1), B(CT.x0, IZ0, CT.x1, CT.z0, 1.1), // 收銀台、後面（店員站的地方）
    ...SH.map((s) => B(s.x0, s.z0, s.x1, s.z1, 1.8)),
    ...PODS.map((P, i) => ({ t: 'circle', x: P.x + (i === 2 ? 0.1 : 0), z: P.z, r: P.r + 0.15, h: 0.4 })),
  ];
  const zones = PODS.map((P) => ({ x: -364.7, z: P.z, hx: 1.25, hz: 1.45, rot: 0 }));
  const zoneAt = (x, z) => { for (let i = 0; i < zones.length; i++) { const q = zones[i]; if (Math.abs(x - q.x) <= q.hx && Math.abs(z - q.z) <= q.hz) return i; } return -1; };
  const outside = { x: FX + 1.25, z: PETSHOP.z, heading: 0 }, spawn = { x: IX1 - 1.0, z: PETSHOP.z, heading: Math.PI };
  const exitDoor = { x: IX1 + 0.15, z: PETSHOP.z, hx: 0.25, hz: DZ - 0.1, rot: 0, to: 'outside', spawn: outside };
  const doors = [{ x: IX1 + 0.1, z: PETSHOP.z, ry: -Math.PI / 2, w: 0.9 }];

  const PL = { x: 0, z: 0 }, IDLE = { speed: 0, state: 'idle' };
  function update(dt, player) {
    if (player && isFinite(player.x)) { PL.x = player.x; PL.z = player.z; } else { PL.x = NaN; }
    for (const q of pets) {
      let want = 0;
      if (isFinite(PL.x)) { const a = Math.atan2(-(PL.z - q.C.group.position.z), PL.x - q.C.group.position.x); want = Math.max(-0.9, Math.min(0.9, a)); }
      q.yaw += (want - q.yaw) * (1 - Math.exp(-dt * 3)); q.C.group.rotation.y = q.yaw;
      q.C.update(dt, IDLE);
    }
    if (clerk) clerk.update(dt, { speed: 0, state: 'idle' });
  }
  const info = { tris: meshes.reduce((s, q) => s + (q.geometry.index ? q.geometry.index.count : 0) / 3, 0), draws: meshes.length + pets.length * 2 + (clerk ? 2 : 0), ms: 0 };
  info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0);
  return {
    group, background: new THREE.Color(0xf3e6cf), environment: null, spawn, exitDoor, exits: [exitDoor], doors, colliders, zones, zoneAt, pets,
    camera: { maxDist: 3.0, ceiling: CH - 0.2, near: 0.08 }, update, info, name: NAME,
    dispose() { for (const q of pets) q.C.dispose?.(); clerk?.dispose?.(); for (const x of own) x.dispose?.(); group.removeFromParent(); },
  };
}

return { PETSHOP, PET_KINDS, PETSHOP_TEXT, buildPetShop, buildPetShopInterior };
})();
