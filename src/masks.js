// 3D Supra 的表面細節：從側面、正面、後面、上面四個方向「投影」到車身上的貼圖。
// 車窗、黑色飾條、車門縫、車燈、水箱罩、引擎蓋通風口、拉花都畫在這些平面圖上，
// shader 再依照車身每一點的位置去查，所以邊緣很銳利，也不用管網格怎麼切。
import * as THREE from 'three';

// 各視圖的範圍（公尺）
export const BOX = {
  side: { x0: -2.35, x1: 2.35, y0: 0, y1: 1.4, w: 2048 },
  front: { x0: -1, x1: 1, y0: 0, y1: 1.3, w: 1024 },   // 從車頭看：x 是 -z（車的右邊在左手邊）
  rear: { x0: -1, x1: 1, y0: 0, y1: 1.3, w: 1024 },    // 從車尾看：x 是 z
  top: { x0: -2.35, x1: 2.35, y0: -1, y1: 1, w: 2048 },
};
export function canvas(b) {
  const c = document.createElement('canvas');
  c.width = b.w; c.height = Math.round((b.w * (b.y1 - b.y0)) / (b.x1 - b.x0));
  const g = c.getContext('2d');
  const k = c.width / (b.x1 - b.x0);
  g.setTransform(k, 0, 0, -k, -b.x0 * k, b.y1 * k); // 用公尺畫，y 往上
  return { c, g, k };
}
// 四張黑白圖合成一張 RGBA 貼圖（每個通道是一種材質的遮罩）
export function layers(b, fns) {
  const cs = fns.map((fn) => {
    const { c, g } = canvas(b);
    g.fillStyle = '#000'; g.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2);
    g.fillStyle = g.strokeStyle = '#fff';
    if (fn) fn(g);
    return c;
  });
  const w = cs[0].width, h = cs[0].height, out = new Uint8Array(w * h * 4);
  cs.forEach((c, ch) => {
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      const src = y * w * 4, dst = (h - 1 - y) * w * 4; // 上下翻過來，讓 v=0 在下面
      for (let x = 0; x < w; x++) out[dst + x * 4 + ch] = d[src + x * 4];
    }
  });
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
export const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); };
export function smooth(g, pts, closed = true) {
  const n = pts.length; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  const P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) g.closePath();
}
export const line = (g, pts, w) => { g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke(); };
// 在 y 往上的座標裡寫字（字是正的）
export function text(g, s, x, y, size, { font = 'Arial Black, Arial, sans-serif', weight = 900, italic = false, mirror = false, align = 'center', skew = 0 } = {}) {
  g.save(); g.translate(x, y); g.scale(mirror ? -1 : 1, -1);
  if (skew) g.transform(1, 0, -skew, 1, 0, 0);
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, 0, 0); g.restore();
}
export const mirrorU = (pts) => pts.map(([u, y]) => [-u, y]);

// ---- 側面：R 側窗、G 黑色、B 縫（只用在朝側面的地方，前擋、後擋改看俯視圖）----
// 側窗上緣沿著車艙轉角（法線 |nz|≈0.66 的位置，從車身量出來的）
export const LINES = {
  dlo: [[0.58, 0.9635], [0.55, 0.982], [0.5, 1.01], [0.45, 1.036], [0.4, 1.063], [0.35, 1.088], [0.3, 1.112], [0.25, 1.134], [0.2, 1.153],
    [0.15, 1.168], [0.1, 1.18], [0.05, 1.188], [0, 1.193], [-0.1, 1.198], [-0.2, 1.198], [-0.3, 1.197], [-0.4, 1.194], [-0.5, 1.186],
    [-0.6, 1.173], [-0.7, 1.152], [-0.8, 1.125], [-0.9, 1.094], [-1.0, 1.059], [-1.045, 1.036], [-0.92, 1.0]],
  bPillar: [[-0.5575, 1.26], [-0.4775, 1.26], [-0.5175, 0.95], [-0.5975, 0.95]],
  doorFront: [[0.765, 0.94], [0.795, 0.62], [0.795, 0.30], [0.745, 0.17]],
  doorRear: [[-0.4575, 0.99], [-0.4975, 0.62], [-0.5575, 0.36], [-0.6375, 0.17]],
};
function sideTex() {
  const L = LINES;
  return layers(BOX.side, [
    (g) => { smooth(g, L.dlo); g.fill(); }, // 側窗
    (g) => { // 黑色
      poly(g, L.bPillar); g.fill();
      g.lineWidth = 0.02; g.lineJoin = 'round'; smooth(g, L.dlo); g.stroke();    // 窗框
      line(g, [[0.58, 0.956], [-0.92, 0.996]], 0.02);                             // 腰線飾條
      g.beginPath(); g.ellipse(-0.84, 0.43, 0.035, 0.06, 0.2, 0, Math.PI * 2); g.fill(); // 後葉子板前面的進氣口
    },
    (g) => { // 縫
      line(g, L.doorFront, 0.005); line(g, L.doorRear, 0.005);
      line(g, [[-0.62, 0.195], [0.74, 0.19]], 0.004);
      g.beginPath(); g.ellipse(-0.33, 0.885, 0.055, 0.011, 0, 0, Math.PI * 2); g.fill();
      line(g, [[1.62, 0.56], [1.66, 0.42], [1.70, 0.20]], 0.004);
      line(g, [[-1.78, 0.62], [-1.80, 0.45], [-1.84, 0.22]], 0.004);
    },
    null,
  ]);
}

// ---- 正面：R 車燈（鍍鉻反射罩）、G 黑色、B 橘色方向燈、A 暗色細節（燈裡是投射鏡、燈外是網子）----
const HEAD = [[0.33, 0.612], [0.42, 0.655], [0.56, 0.688], [0.70, 0.70], [0.80, 0.688], [0.835, 0.64], [0.80, 0.592], [0.66, 0.570], [0.50, 0.570], [0.39, 0.582]];
const GRILLE = [[-0.50, 0.425], [0.50, 0.425], [0.575, 0.37], [0.52, 0.27], [0.30, 0.245], [-0.30, 0.245], [-0.52, 0.27], [-0.575, 0.37]];
const AMBER = [[0.72, 0.495], [0.845, 0.50], [0.862, 0.462], [0.73, 0.456]];
// 原廠保桿：一個寬的進氣口（橫的格柵）、兩邊方形霧燈
const MOUTH = [[-0.50, 0.322], [0.50, 0.322], [0.535, 0.29], [0.50, 0.203], [-0.50, 0.203], [-0.535, 0.29]];
const FOG = [[0.585, 0.29], [0.755, 0.293], [0.765, 0.262], [0.75, 0.238], [0.59, 0.236], [0.578, 0.262]];
function headDetails(g, s) { // 大燈裡面：燈殼下緣暗一條、兩個反射碗的外圈、投射鏡是淺灰玻璃
  const S = (p) => p.map(([u, y]) => [u * s, y]);
  g.save(); smooth(g, S(HEAD)); g.clip();
  g.fillStyle = 'rgb(200,200,200)'; smooth(g, S([[0.30, 0.55], [0.95, 0.55], [0.95, 0.588], [0.70, 0.584], [0.48, 0.585], [0.30, 0.595]])); g.fill();
  g.strokeStyle = 'rgb(170,170,170)'; g.lineWidth = 0.007;
  for (const [u, y, r] of [[0.51, 0.628, 0.044], [0.675, 0.64, 0.05]]) { g.beginPath(); g.arc(u * s, y, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgb(95,95,95)';
  for (const [u, y, r] of [[0.51, 0.628, 0.023], [0.675, 0.64, 0.027]]) { g.beginPath(); g.arc(u * s, y, r, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.fillStyle = g.strokeStyle = '#fff';
}
function frontTex(kit = 'bomex') {
  if (kit === 'stock') return layers(BOX.front, [
    (g) => { for (const s of [1, -1]) { smooth(g, HEAD.map(([u, y]) => [u * s, y])); g.fill(); smooth(g, FOG.map(([u, y]) => [u * s, y])); g.fill(); } },
    (g) => {
      smooth(g, MOUTH); g.fill();
      for (const s of [1, -1]) {
        g.lineWidth = 0.005; smooth(g, HEAD.map(([u, y]) => [u * s, y])); g.stroke();
        g.lineWidth = 0.008; smooth(g, FOG.map(([u, y]) => [u * s, y])); g.stroke();
      }
    },
    (g) => { for (const s of [1, -1]) { smooth(g, AMBER.map(([u, y]) => [u * s, y])); g.fill(); } },
    (g) => {
      for (const s of [1, -1]) {
        headDetails(g, s);
        g.save(); smooth(g, FOG.map(([u, y]) => [u * s, y])); g.clip(); g.fillStyle = 'rgb(120,120,120)';
        g.fillRect(0.60 * s - 0.05, 0.245, 0.10, 0.04); g.restore(); g.fillStyle = '#fff';
      }
      g.save(); smooth(g, MOUTH); g.clip(); // 橫的格柵
      for (let y = 0.212; y < 0.32; y += 0.021) line(g, [[-0.6, y], [0.6, y]], 0.007);
      for (let u = -0.45; u <= 0.46; u += 0.15) line(g, [[u, 0.2], [u, 0.33]], 0.006);
      g.restore();
    },
  ]);
  return layers(BOX.front, [
    (g) => { // 車燈
      for (const s of [1, -1]) {
        smooth(g, HEAD.map(([u, y]) => [u * s, y])); g.fill();
        g.beginPath(); g.arc(0.60 * s, 0.345, 0.042, 0, Math.PI * 2); g.fill(); // 霧燈
      }
    },
    (g) => { // 黑色
      smooth(g, GRILLE); g.fill();
      for (const s of [1, -1]) {
        g.lineWidth = 0.005; smooth(g, HEAD.map(([u, y]) => [u * s, y])); g.stroke(); // 大燈外框
        const S = (p) => p.map(([u, y]) => [u * s, y]);
        smooth(g, S([[0.755, 0.425], [0.84, 0.425], [0.855, 0.36], [0.835, 0.318], [0.755, 0.322], [0.745, 0.37]])); g.fill(); // 轉角進氣口
        smooth(g, S([[0.44, 0.255], [0.70, 0.262], [0.72, 0.225], [0.66, 0.205], [0.46, 0.205], [0.42, 0.228]])); g.fill(); // 下面的進氣口
        g.lineWidth = 0.014; g.beginPath(); g.arc(0.60 * s, 0.345, 0.05, 0, Math.PI * 2); g.stroke(); // 霧燈框
      }
    },
    (g) => { // 橘色方向燈
      for (const s of [1, -1]) { smooth(g, AMBER.map(([u, y]) => [u * s, y])); g.fill(); }
    },
    (g) => { // 暗色細節
      for (const s of [1, -1]) {
        headDetails(g, s);
        g.beginPath(); g.arc(0.60 * s, 0.345, 0.03, 0, Math.PI * 2); g.fill();
      }
      // 水箱罩的網子（斜的格子）
      g.save(); smooth(g, GRILLE); g.clip();
      g.lineWidth = 0.0035;
      for (let k = -1.2; k < 1.2; k += 0.014) {
        g.beginPath(); g.moveTo(k, 0.2); g.lineTo(k + 0.25, 0.45); g.stroke();
        g.beginPath(); g.moveTo(k, 0.45); g.lineTo(k + 0.25, 0.2); g.stroke();
      }
      g.restore();
    },
  ]);
}

// 正面的貼紙（彩色，可以整組拿掉）
function drawFrontLivery(style = 'ff', kit = 'bomex') {
  const { c, g } = canvas(BOX.front);
  g.clearRect(-2, -1, 4, 3);
  if (style !== 'ff') return c;
  g.fillStyle = g.strokeStyle = '#0d0e0d';
  if (kit === 'stock') { emblem(g); return c; } // 原廠保桿上沒有 NOS、STILLEN 那些，只留車頭的圖騰
  for (const s of [1, -1]) {
    text(g, 'NOS', 0.765 * s, 0.285, 0.034, { italic: true });
    text(g, 'STILLEN', 0.64 * s, 0.155, 0.03, { italic: true, weight: 900 });
  }
  text(g, '12', -0.21, 0.198, 0.125, { italic: true, skew: 0.25 });
  emblem(g);
  return c;
}
function emblem(g) { // 車頭中間的圖騰
  g.lineWidth = 0.006; g.lineCap = 'round';
  for (const [a, b2] of [[[-0.06, 0.50], [0.05, 0.58]], [[-0.03, 0.49], [0.02, 0.59]], [[-0.07, 0.54], [0.07, 0.54]], [[0.0, 0.47], [0.06, 0.56]]]) { g.beginPath(); g.moveTo(...a); g.lineTo(...b2); g.stroke(); }
}

// ---- 後面：R 紅燈、G 黑色、B 白色倒車燈 ----
// 尾燈、車牌位置照 Nick 2026-09-27 傳的紅色 Supra 車尾照片量的（rear3d/hit-supra.mjs）：橢圓燈殼、兩顆圓燈（內側那顆中間是倒車燈）
const TAIL = [[0.17, 0.775], [0.185, 0.808], [0.23, 0.825], [0.40, 0.829], [0.60, 0.826], [0.70, 0.815], [0.745, 0.785], [0.735, 0.745],
  [0.69, 0.727], [0.50, 0.722], [0.30, 0.722], [0.21, 0.73], [0.18, 0.748]];
const TAIL_RINGS = [0.33, 0.56];
function rearTex() {
  return layers(BOX.rear, [
    (g) => { for (const s of [1, -1]) { smooth(g, TAIL.map(([u, y]) => [u * s, y])); g.fill(); } },
    (g) => {
      for (const s of [1, -1]) {
        g.lineWidth = 0.008; smooth(g, TAIL.map(([u, y]) => [u * s, y])); g.stroke();
        g.lineWidth = 0.011; for (const u of TAIL_RINGS) { g.beginPath(); g.arc(u * s, 0.776, 0.046, 0, Math.PI * 2); g.stroke(); }
      }
      g.beginPath(); g.roundRect(-0.18, 0.47, 0.36, 0.145, 0.01); g.fill(); // 車牌
      poly(g, [[-0.75, 0.16], [0.75, 0.16], [0.70, 0.25], [-0.70, 0.25]]); g.fill();
    },
    (g) => { for (const s of [1, -1]) { g.beginPath(); g.arc(TAIL_RINGS[0] * s, 0.776, 0.02, 0, Math.PI * 2); g.fill(); } },
    null,
  ]);
}

// ---- 上面：R 通風口、G 黑色（前擋黑邊、雨刷飾板、後擋黑邊）、B 縫、A 前擋和後擋玻璃 ----
// 玻璃外框（含黑邊）＝車艙轉角開始彎的地方（法線 |nz|≈0.2，從車身量出來的），右半邊，畫的時候鏡射
const WS = [[0.80, 0], [0.795, 0.30], [0.78, 0.48], [0.755, 0.56], [0.715, 0.598], [0.65, 0.602], [0.6, 0.595], [0.55, 0.586], [0.5, 0.576],
  [0.45, 0.566], [0.4, 0.554], [0.35, 0.543], [0.3, 0.533], [0.25, 0.524], [0.2, 0.513], [0.172, 0.49], [0.16, 0.35], [0.155, 0]];
const BL = [[-0.66, 0], [-0.662, 0.30], [-0.672, 0.44], [-0.70, 0.50], [-0.8, 0.513], [-0.9, 0.521], [-1.0, 0.527], [-1.1, 0.528],
  [-1.2, 0.524], [-1.3, 0.51], [-1.38, 0.48], [-1.46, 0.40], [-1.51, 0.25], [-1.53, 0]];
const COWL = [[0.848, 0], [0.843, 0.30], [0.828, 0.46], [0.80, 0.54], [0.765, 0.575], [0.745, 0.57], [0.77, 0.535], [0.785, 0.46], [0.795, 0.30], [0.797, 0]];
export const both = (h) => [...h, ...h.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
// 玻璃周圍的黑邊：側邊 side 寬，前後兩端另外加寬
export function frit(g, outline, side, [xa, xb], [xc, xd]) {
  g.save(); smooth(g, outline); g.clip();
  g.lineWidth = side * 2; smooth(g, outline); g.stroke();
  g.fillRect(xa, -1, xb - xa, 2); g.fillRect(xc, -1, xd - xc, 2);
  g.restore();
}
function topTex() {
  return layers(BOX.top, [
    (g) => {
      for (const s of [1, -1]) {
        const S = (p) => p.map(([x, z]) => [x, z * s]);
        poly(g, S([[1.80, 0.06], [1.77, 0.36], [1.63, 0.33], [1.67, 0.08]])); g.fill();
        poly(g, S([[1.76, 0.40], [1.72, 0.61], [1.60, 0.585], [1.64, 0.385]])); g.fill();
      }
    },
    (g) => {
      frit(g, both(WS), 0.03, [0.10, 0.205], [0.765, 0.9]);       // 前擋：上緣黑帶寬一點
      frit(g, both(BL), 0.03, [-0.70, -0.6], [-1.6, -1.48]);      // 後擋
      smooth(g, both(COWL)); g.fill();                             // 雨刷飾板
    },
    (g) => {
      line(g, [[0.87, 0.66], [1.40, 0.70], [1.90, 0.66], [2.06, 0.50], [2.10, 0], [2.06, -0.50], [1.90, -0.66], [1.40, -0.70], [0.87, -0.66]], 0.005);
      line(g, [[-1.55, 0.64], [-1.85, 0.66], [-2.08, 0.58], [-2.12, 0], [-2.08, -0.58], [-1.85, -0.66], [-1.55, -0.64]], 0.005);
    },
    (g) => { smooth(g, both(WS)); g.fill(); smooth(g, both(BL)); g.fill(); },
  ]);
}

// ---- 拉花（側面，左右各一張，RGBA 顏色）----
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function drawLivery(side, style = 'ff') {
  const { c, g } = canvas(BOX.side);
  g.clearRect(-3, -1, 6, 3);
  if (style !== 'ff') return c;
  const GREEN = '#8fe13a', GREEN2 = '#5fb52c', INK = '#0d0e0d';
  // 後葉子板的綠色圖騰：很多往前伸的火舌＋碎塊
  const r = rng(7);
  g.save();
  // 限制在後葉子板範圍（車門後緣之後、輪拱上面）
  g.beginPath(); g.moveTo(-0.50, 0.95); g.lineTo(-2.3, 0.95); g.lineTo(-2.3, 0.38); g.lineTo(-1.80, 0.40);
  g.arc(-1.3375, 0.325, 0.40, 0.2, Math.PI - 0.2, false); g.lineTo(-0.60, 0.38); g.closePath(); g.clip();
  for (let i = 0; i < 26; i++) {
    const y = 0.44 + r() * 0.48, x0 = -2.2 + r() * 0.3, len = 0.5 + r() * 0.9, th = 0.02 + r() * 0.05;
    const tip = x0 + len, bend = (r() - 0.5) * 0.12;
    g.fillStyle = r() < 0.8 ? GREEN : GREEN2;
    smooth(g, [[x0, y - th], [x0 + len * 0.5, y + bend - th * 0.6], [tip, y + bend * 1.6], [x0 + len * 0.5, y + bend + th * 0.6], [x0, y + th]]);
    g.fill();
  }
  for (let i = 0; i < 40; i++) { // 碎點
    g.fillStyle = r() < 0.7 ? GREEN : GREEN2;
    const x = -0.6 - r() * 1.6, y = 0.45 + r() * 0.47, s = 0.01 + r() * 0.035;
    g.beginPath(); g.ellipse(x, y, s * (1 + r()), s, r() * 3, 0, Math.PI * 2); g.fill();
  }
  // 橘色的空隙（讓圖騰看起來像噴漆的破碎感）
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 18; i++) {
    const x = -0.7 - r() * 1.5, y = 0.46 + r() * 0.44, s = 0.015 + r() * 0.04;
    g.beginPath(); g.ellipse(x, y, s * 2.2, s * 0.7, (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // 車門上的人物圖
  g.save();
  const fig = side > 0 ? 1 : 1;
  // 綠色速度線（在人物後面）
  g.fillStyle = GREEN;
  for (let i = 0; i < 7; i++) { const y = 0.60 + i * 0.022; poly(g, [[-0.45, y], [0.05 + i * 0.03, y + 0.004], [0.05 + i * 0.03, y + 0.012], [-0.45, y + 0.011]]); g.fill(); }
  // 黑色細線
  g.strokeStyle = INK; line(g, [[0.66, 0.535], [-0.52, 0.545]], 0.008);
  // 渦輪（鍍鉻、有條紋）
  const tx = -0.12, ty = 0.705;
  const gr = g.createLinearGradient(0, ty - 0.09, 0, ty + 0.09); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.5, '#9aa2ab'); gr.addColorStop(1, '#e2e6ea');
  g.fillStyle = INK; smooth(g, [[tx - 0.25, ty - 0.07], [tx + 0.10, ty - 0.10], [tx + 0.26, ty - 0.06], [tx + 0.28, ty + 0.06], [tx + 0.10, ty + 0.11], [tx - 0.24, ty + 0.08]]); g.fill();
  g.fillStyle = gr; smooth(g, [[tx - 0.23, ty - 0.055], [tx + 0.10, ty - 0.085], [tx + 0.24, ty - 0.05], [tx + 0.26, ty + 0.05], [tx + 0.10, ty + 0.095], [tx - 0.22, ty + 0.065]]); g.fill();
  g.strokeStyle = INK; for (let i = -3; i <= 3; i++) line(g, [[tx - 0.20, ty + i * 0.02], [tx + 0.22, ty + i * 0.024]], 0.006);
  // 人：手往前伸、身體在後面（灰色、黑框）
  const body = [[0.62, 0.575], [0.56, 0.60], [0.44, 0.585], [0.30, 0.60], [0.14, 0.64], [0.02, 0.64], [-0.02, 0.60], [0.06, 0.56], [0.20, 0.535], [0.36, 0.545], [0.50, 0.555], [0.60, 0.55]];
  g.fillStyle = INK; smooth(g, body.map(([x, y]) => [x + 0.008, y - 0.008])); g.fill();
  const gb = g.createLinearGradient(0, 0.53, 0, 0.65); gb.addColorStop(0, '#6d747c'); gb.addColorStop(0.5, '#c4c9ce'); gb.addColorStop(1, '#8a9199');
  g.fillStyle = gb; smooth(g, body); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.006; smooth(g, body); g.stroke();
  g.beginPath(); g.arc(0.15, 0.625, 0.035, 0, Math.PI * 2); g.fillStyle = '#b7bdc3'; g.fill(); g.stroke(); // 頭
  line(g, [[0.46, 0.575], [0.30, 0.575]], 0.004); line(g, [[0.08, 0.60], [0.26, 0.585]], 0.004);
  g.fillStyle = '#e9ecef'; g.beginPath(); g.arc(0.61, 0.565, 0.025, 0, Math.PI * 2); g.fill(); g.stroke(); // 拳頭
  g.restore();
  // 下面一排贊助商貼紙（黑字、斜體）
  g.fillStyle = INK;
  const names = ['NOS', 'SPARCO', 'DAZZ', 'HKS', 'TRD', 'GREDDY'];
  names.forEach((t, i) => text(g, t, 0.55 - i * 0.24, 0.31, 0.036, { italic: true, mirror: side < 0 }));
  return c;
}

// Supra 的外觀：各視圖的貼圖、拉花、套件換哪個車頭，還有 shader 用的位置（前後輪、車頭車尾從哪裡開始、輪拱多大）
export const SUPRA_LOOK = {
  side: sideTex, rear: rearTex, top: topTex,
  fronts: { bomex: () => frontTex('bomex'), stock: () => frontTex('stock') },
  livery: (side, style) => drawLivery(side, style), frontLivery: (style, nose) => drawFrontLivery(style, nose),
  nose: (kit) => (kit === 'stock' ? 'stock' : 'bomex'),
  U: { uXr: -1.3375, uXf: 1.2125, uFx: [1.72, 1.80], uRx: [-1.88, -1.96], uWell: [0.325, 0.385, 0.875], uGlassY: 0.9 },
};

// ---- 通用拉花（每台車都能選，車子自己的拉花照舊）：flames 火焰、stripes 賽車條紋、team 大便龍車隊貼紙 ----
// 位置照每台車自己的前後輪軸（uXf、uXr）、輪子半徑＝輪心高度和輪拱半徑（uWell、uWellR）、車窗下緣（uGlassY）算；
// 再看側面投影圖（R 玻璃、G 黑、B 縫）：火焰、條紋、貼紙都在門檻黑色側裙上面，貼紙找一塊沒有黑色、玻璃、縫的地方。正面不畫。
export const LIV_GENERIC = [['flames', '火焰'], ['stripes', '賽車條紋'], ['team', '大便龍車隊']];
// 車庫的拉花選項：車子自己的＋通用的（'none' 放最後；名字撞到車子自己的，例如 918 的 stripes，通用的改用 'gen:stripes'）
export const livOptions = (own) => {
  const has = new Set(own.map((o) => o[0]));
  return [...own.filter((o) => o[0] !== 'none'), ...LIV_GENERIC.map(([k, l]) => [has.has(k) ? 'gen:' + k : k, l]), ...own.filter((o) => o[0] === 'none')];
};
export function genericLivery(look, sideTex) {
  const u = look.U, wf = u.uWell, wr = u.uWellR ?? u.uWell, G = u.uGlassY, b = BOX.side;
  const F = { x: u.uXf, y: wf[0], r: wf[1] + 0.04 }, R = { x: u.uXr, y: wr[0], r: wr[1] + 0.04 }; // r：輪拱外面再留 4 公分
  const xs = F.x - F.r, xe = R.x + R.r, len = xs - xe; // 門那段：前輪拱後緣到後輪拱前緣
  // 側面投影圖：擋住的地方（黑、玻璃、縫）做成累加表，一個方塊裡有沒有東西一次查完；側裙＝最下面那塊黑的上緣
  const img = sideTex && sideTex.image, W = img ? img.width : 0, H = img ? img.height : 0;
  const at = (x, y, ch) => { const i = Math.floor(((x - b.x0) / (b.x1 - b.x0)) * W), j = Math.floor(((y - b.y0) / (b.y1 - b.y0)) * H); return i < 0 || j < 0 || i >= W || j >= H ? 0 : img.data[(j * W + i) * 4 + ch]; };
  let sum = null, skirtY = null;
  const busy = (x0, y0, x1, y1) => {
    if (!W) return 0;
    if (!sum) {
      sum = new Int32Array((W + 1) * (H + 1));
      for (let j = 0; j < H; j++) for (let i = 0, run = 0; i < W; i++) {
        const o = (j * W + i) * 4; run += img.data[o] > 80 || img.data[o + 1] > 80 || img.data[o + 2] > 60 ? 1 : 0;
        sum[(j + 1) * (W + 1) + i + 1] = sum[j * (W + 1) + i + 1] + run;
      }
    }
    const I = (x) => Math.max(0, Math.min(W, Math.round(((x - b.x0) / (b.x1 - b.x0)) * W))), J = (y) => Math.max(0, Math.min(H, Math.round(((y - b.y0) / (b.y1 - b.y0)) * H)));
    const i0 = I(x0), i1 = I(x1), j0 = J(y0), j1 = J(y1), s = (i, j) => sum[j * (W + 1) + i];
    return s(i1, j1) - s(i0, j1) - s(i1, j0) + s(i0, j0);
  };
  const skirt = () => {
    if (skirtY !== null) return skirtY;
    const tops = [];
    for (let x = xe + 0.05; x < xs - 0.05; x += 0.01) { // 每一欄從下往上：第一段黑色從 0.2 公尺以下開始才算側裙
      let y = 0.06; while (y < 0.2 && at(x, y, 1) <= 80) y += 0.005;
      if (y >= 0.2) { tops.push(0); continue; }
      while (y < F.y + 0.1 && at(x, y, 1) > 80) y += 0.005;
      tops.push(y);
    }
    tops.sort((p, q) => p - q);
    return (skirtY = tops.length ? tops[Math.floor(tops.length * 0.9)] : 0);
  };

  // 一圈點畫成平滑的路徑：第三個數字是 1 的點是尖角（火舌尖端、轉角），其他點平滑通過
  function curvy(g, pts) {
    const n = pts.length, s0 = Math.max(0, pts.findIndex((p) => p[2])), P = (i) => pts[(s0 + i) % n];
    g.beginPath(); g.moveTo(P(0)[0], P(0)[1]);
    for (let a = 0; a < n;) {
      let e = a + 1; while (e < n && !P(e)[2]) e++;
      const run = []; for (let i = a; i <= e; i++) run.push(P(i));
      const m = run.length - 1, Q = (i) => run[Math.max(0, Math.min(m, i))];
      for (let i = 0; i < m; i++) {
        const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
        g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      }
      a = e;
    }
    g.closePath();
  }
  // 火焰：前緣貼著前輪拱後半圈，五條火舌往後舔到門的下半部；黃→橘→紅，外面一圈深色邊
  // 樣板座標：u＝往後（0 前緣～1 最長那條的尖端），v＝往上（0 下緣～1 上緣）；[u, v, 1] 是尖角
  const FLAME = [[0, 1, 1], [0.1, 1], [0.2, 0.99], [0.3, 0.975], [0.4, 0.95], [0.48, 0.92], [0.54, 0.9], [0.6, 0.93, 1],
    [0.56, 0.87], [0.49, 0.845], [0.4, 0.83], [0.32, 0.815], [0.26, 0.8], [0.225, 0.78], [0.215, 0.76], [0.235, 0.74],
    [0.31, 0.735], [0.42, 0.73], [0.54, 0.72], [0.64, 0.7], [0.73, 0.67], [0.8, 0.64], [0.85, 0.63], [0.9, 0.66, 1],
    [0.86, 0.605], [0.79, 0.58], [0.69, 0.56], [0.58, 0.545], [0.47, 0.535], [0.38, 0.525], [0.325, 0.51], [0.31, 0.49], [0.33, 0.47],
    [0.4, 0.465], [0.49, 0.455], [0.57, 0.44], [0.63, 0.42], [0.67, 0.405], [0.72, 0.43, 1],
    [0.68, 0.375], [0.61, 0.35], [0.52, 0.335], [0.43, 0.325], [0.37, 0.315], [0.335, 0.3], [0.325, 0.28], [0.345, 0.262],
    [0.43, 0.258], [0.55, 0.252], [0.67, 0.24], [0.78, 0.22], [0.87, 0.2], [0.93, 0.195], [1, 0.23, 1],
    [0.95, 0.165], [0.87, 0.14], [0.76, 0.128], [0.64, 0.12], [0.54, 0.112], [0.47, 0.105], [0.43, 0.09], [0.425, 0.07], [0.445, 0.055],
    [0.52, 0.052], [0.6, 0.048], [0.67, 0.045], [0.76, 0.072, 1],
    [0.7, 0.015], [0.58, -0.005], [0.4, -0.01], [0.2, -0.005], [0, 0, 1], [0, 0.25], [0, 0.5], [0, 0.75]];
  function flames(g) {
    const yb = Math.max(0.2, 0.9 * F.y, skirt() + 0.03), yt = Math.min(F.y + 0.94 * F.r, G - 0.07), h = yt - yb; // 上緣從輪拱頂端後面一點開始
    const x0 = (y) => F.x - Math.sqrt(Math.max(0, F.r * F.r - (y - F.y) * (y - F.y))); // 輪拱後半圈（前緣貼著它）
    let reach = xs - 0.7 * len; // 最長那條舔到門的 70%，前面有大塊黑的（進氣口）就停在它前面
    for (let x = xs - 0.15; x > reach; x -= 0.01) { let n = 0; for (let v = 0.05; v < 0.85; v += 0.05) n += at(x, yb + v * h, 1) > 80 ? 1 : 0; if (n >= 5) { reach = x + 0.08; break; } }
    const Lm = x0(yb + 0.235 * h) - reach;
    const pts = FLAME.map(([u, v, s]) => { const y = yb + v * h; return [x0(y) - u * Lm, y, s]; });
    g.lineJoin = 'round'; g.lineWidth = 0.024; g.strokeStyle = '#1c0b06'; curvy(g, pts); g.stroke(); // 先描邊再填色：只剩外面一圈深色邊
    const gr = g.createLinearGradient(F.x, 0, reach, 0);
    for (const [k, col] of [[0, '#fff6a8'], [0.14, '#ffe236'], [0.36, '#ffac18'], [0.6, '#ff6512'], [0.84, '#e2300f'], [1, '#c01610']]) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fill();
  }

  // 賽車條紋：兩條平行的深色條紋＋白色細邊，高度在側裙和車窗中間，從車頭到車尾，經過輪拱照輪拱的圓讓開（留白邊）
  // 前後兩頭斜切，停在車頭、車尾轉角前面（輪拱前後各多 22 公分、不超過正面／後面投影開始的地方；不到 12 公分就不畫那段）
  function band(g, y0, hh, grow, col, x0, x1, yc) {
    const X = (x, y) => x + (y - yc) * 0.35;
    g.save(); poly(g, [[X(x0 + grow, y0), y0], [X(x1 - grow, y0), y0], [X(x1 - grow, y0 + hh), y0 + hh], [X(x0 + grow, y0 + hh), y0 + hh]]); g.clip();
    g.beginPath(); g.rect(b.x0 - 1, y0 - 1, b.x1 - b.x0 + 2, hh + 2);
    for (const A of [F, R]) { g.moveTo(A.x + A.r + grow, A.y); g.arc(A.x, A.y, A.r + grow, 0, Math.PI * 2); }
    g.fillStyle = col; g.fill('evenodd'); g.restore();
  }
  function stripes(g) {
    const yc = (Math.max(0.14, skirt()) + G) / 2, w = 0.042, k = 0.007, gap = 0.02;
    const fx = Math.min(F.x + F.r + 0.22, u.uFx[1] + 0.05), rx = Math.max(R.x - R.r - 0.22, u.uRx[1] - 0.05);
    const x1 = fx - (F.x + F.r) < 0.12 ? F.x : fx, x0 = R.x - R.r - rx < 0.12 ? R.x : rx;
    for (const y0 of [yc + gap / 2, yc - gap / 2 - w - 2 * k]) { band(g, y0, w + 2 * k, 0, '#f4f5f6', x0, x1, yc); band(g, y0 + k, w, k, '#16171a', x0, x1, yc); }
  }

  // 車隊貼紙：「大便龍 RACING」粗斜體，深色斜牌子＋白邊；兩邊的字都是正的（左邊整塊左右翻過來畫）
  const FONT = '"Arial Black", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';
  function spot(w, h) { // 門的下半部找一塊乾淨的地方（沒有黑色、玻璃、縫，也不碰輪拱），越低越好、越靠門中間越好
    const y0 = Math.max(0.2, 0.95 * F.y, skirt() + 0.02), m = 0.015, cx = (xs + xe) / 2;
    for (let y = y0 + h / 2; y + h / 2 < G - 0.08; y += 0.01) {
      for (let k = 0; k <= 80; k++) {
        const x = cx + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.02;
        if (x - w / 2 - m < xe || x + w / 2 + m > xs) continue;
        if (!busy(x - w / 2 - m, y - h / 2 - m, x + w / 2 + m, y + h / 2 + m)) return [x, y];
      }
    }
    return [cx, y0 + h / 2];
  }
  let where = null; // 貼紙位置（兩邊一樣，算一次就記住；累加表用完就丟，手機記憶體比較夠）
  function team(g, sd) {
    const fs = 0.085, sk = 0.22, t1 = '大便龍', t2 = 'RACING';
    g.save(); g.font = `900 100px ${FONT}`;
    const w1 = (g.measureText(t1).width * fs) / 100, w2 = (g.measureText(t2).width * fs) / 100, sp = fs * 0.32, tw = w1 + sp + w2;
    const pw = tw + fs * 0.9, ph = fs * 1.5, key = `${pw.toFixed(4)},${ph.toFixed(4)}`;
    if (!where || where.key !== key) { where = { key, at: spot(pw + ph * sk, ph) }; sum = null; }
    const [cx, cy] = where.at;
    g.translate(cx, cy); g.scale(sd < 0 ? -1 : 1, 1);
    const P = (x, y) => [x + y * sk, y]; // 往前斜的平行四邊形
    poly(g, [P(-pw / 2, -ph / 2), P(pw / 2, -ph / 2), P(pw / 2, ph / 2), P(-pw / 2, ph / 2)]);
    g.fillStyle = '#141518'; g.fill(); g.lineJoin = 'miter'; g.lineWidth = 0.007; g.strokeStyle = '#f4f5f6'; g.stroke();
    g.scale(1, -1); g.transform(1, 0, -sk, 1, 0, 0); g.scale(fs / 100, fs / 100);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const x0 = (-tw / 2 / fs) * 100, base = 36;
    g.fillStyle = g.strokeStyle = '#ffd21f'; g.lineWidth = 3; g.fillText(t1, x0, base); g.strokeText(t1, x0, base); // 中文字描一圈，加粗
    g.fillStyle = '#f4f5f6'; g.fillText(t2, x0 + ((w1 + sp) / fs) * 100, base);
    g.restore();
  }

  return (sd, style) => {
    const { c, g } = canvas(b);
    g.clearRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2);
    if (style === 'flames') flames(g); else if (style === 'stripes') stripes(g); else if (style === 'team') team(g, sd);
    return c;
  };
}
// 包一層 look 的拉花：通用的名字畫通用的（正面空白），其他名字照車子自己的。
// 車子自己也有同名的拉花（918 的 stripes）就用車子自己的，通用的改用 'gen:stripes'（'gen:' 開頭一定是通用的）
export function withGenericLivery(look, sideTex) {
  const draw = genericLivery(look, sideTex), own = {}, keys = LIV_GENERIC.map((o) => o[0]);
  let last = 'ff'; // 最後畫的車子自己的拉花（探測完再畫一次，車子自己記的狀態才不會亂掉，例如 Jesko 的點綴色）
  const sig = (c) => { const s = document.createElement('canvas'); s.width = 256; s.height = 80; const g = s.getContext('2d'); g.drawImage(c, 0, 0, 256, 80); return g.getImageData(0, 0, 256, 80).data; };
  const mine = (k) => (own[k] ??= (() => { const p = sig(look.livery(1, k)), q = sig(look.livery(1, '?')); look.livery(1, last); return p.some((v, i) => Math.abs(v - q[i]) > 16); })());
  const gen = (s) => { const k = String(s).replace(/^gen:/, ''); return keys.includes(k) && (k !== s || !mine(k)) ? k : null; };
  const blank = () => { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; };
  return {
    livery: (sd, s) => { const k = gen(s); if (k) return draw(sd, k); last = s; return look.livery(sd, s); },
    frontLivery: (s, nose) => (gen(s) ? blank() : look.frontLivery(s, nose)),
  };
}

export function makeMaskTextures(look = SUPRA_LOOK) {
  const cv = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const noses = Object.keys(look.fronts), side = look.side(), L = withGenericLivery(look, side); // L：拉花（含通用的）
  const t = {
    side, rear: look.rear(), top: look.top(), livR: cv(L.livery(1, 'ff')), livL: cv(L.livery(-1, 'ff')),
    fronts: Object.fromEntries(noses.map((k) => [k, look.fronts[k]()])),
    livFs: Object.fromEntries(noses.map((k) => [k, cv(L.frontLivery('ff', k))])),
  };
  // 所有車身材質共用這組 uniform：換套件只要換 tFront、tLivF 的 value
  const V2 = (a) => new THREE.Vector2(...a), V3 = (a) => new THREE.Vector3(...a), u = look.U;
  t.U = {
    tSide: { value: t.side }, tFront: { value: t.fronts[noses[0]] }, tRear: { value: t.rear }, tTop: { value: t.top },
    tLivR: { value: t.livR }, tLivL: { value: t.livL }, tLivF: { value: t.livFs[noses[0]] },
    uXr: { value: u.uXr }, uXf: { value: u.uXf }, uLiv: { value: look.livDefault ?? 1 },
    uFx: { value: V2(u.uFx) }, uRx: { value: V2(u.uRx) }, uWell: { value: V3(u.uWell) }, uWellR: { value: V3(u.uWellR ?? u.uWell) }, uGlassY: { value: u.uGlassY },
  };
  t.uLiv = t.U.uLiv;
  t.setNose = (k) => { t.nose = k; t.U.tFront.value = t.fronts[k]; t.U.tLivF.value = t.livFs[k]; };
  // 換拉花：'none' 關掉，其他名字就重畫三張拉花貼圖（L.livery(side, 名字)、L.frontLivery(名字, 車頭)；通用的名字見 LIV_GENERIC）
  t.livStyle = 'ff';
  t.setLivery = (style) => {
    t.U.uLiv.value = style === 'none' ? 0 : 1;
    if (style === 'none' || style === t.livStyle) return;
    t.livStyle = style;
    t.livR.image = L.livery(1, style); t.livR.needsUpdate = true;
    t.livL.image = L.livery(-1, style); t.livL.needsUpdate = true;
    for (const k of noses) { t.livFs[k].image = L.frontLivery(style, k); t.livFs[k].needsUpdate = true; }
  };
  return t;
}

// ---- shader ----
const VERT_DECL = 'varying vec3 vP; varying vec3 vN;\n';
const MASK_FN = `
uniform sampler2D tSide, tFront, tRear, tTop, tLivR, tLivL, tLivF;
uniform float uXr, uXf, uLiv, uGlassY;
uniform vec2 uFx, uRx; uniform vec3 uWell, uWellR;
varying vec3 vP; varying vec3 vN;
vec2 uvSide(vec3 p) { return vec2((p.x + 2.35) / 4.7, p.y / 1.4); }
vec2 uvTop(vec3 p) { return vec2((p.x + 2.35) / 4.7, (p.z + 1.0) / 2.0); }
// 玻璃在哪裡：朝側面的地方看側視圖（側窗），朝上的地方看俯視圖（前擋、後擋）
// glass＝玻璃範圍（含黑邊），blk＝黑邊；glass 而且不是 blk 才是透明的玻璃
float sideF(vec3 n) { return smoothstep(0.35, 0.55, abs(n.z)); }
void glassMask(vec4 S, vec4 Tp, out float glass, out float blk) {
  float sf = sideF(vN), hi = step(uGlassY, vP.y);
  glass = max(S.r * sf, Tp.a * (1.0 - sf) * hi);
  blk = max(S.g * sf, Tp.g * (1.0 - sf) * hi);
}
`;
function inject(shader, tex) {
  Object.assign(shader.uniforms, tex.U);
  shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = position; vN = normal;');
  shader.fragmentShader = MASK_FN + shader.fragmentShader;
}

// 車漆那一層：玻璃的地方挖掉，其他依照投影圖改顏色、粗糙度、金屬感
export function patchPaint(mat, tex) {
  mat.onBeforeCompile = (shader) => {
    inject(shader, tex);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec4 S = texture2D(tSide, uvSide(vP));
  vec4 Tp = texture2D(tTop, uvTop(vP));
  float glass, blk; glassMask(S, Tp, glass, blk);
  if (glass > 0.5 && blk < 0.5) discard;
  float sf = sideF(vN);
  float sideW = smoothstep(0.2, 0.45, abs(vN.z));
  vec4 LV = vP.z > 0.0 ? texture2D(tLivR, uvSide(vP)) : texture2D(tLivL, uvSide(vP));
  diffuseColor.rgb = mix(diffuseColor.rgb, LV.rgb, LV.a * sideW * uLiv);
  float blackG = S.g * sf, gap = S.b * sideW, lamp = 0.0, lens = 0.0, wire = 0.0, amber = 0.0, red = 0.0, rev = 0.0, matte = 0.0;
  float fW = smoothstep(uFx.x, uFx.y, vP.x) * smoothstep(-0.35, 0.1, vN.x) * (1.0 - smoothstep(0.82, 0.95, vN.y));
  if (fW > 0.0) {
    vec2 uvF = vec2((1.0 - vP.z) / 2.0, vP.y / 1.3);
    vec4 LF = texture2D(tLivF, uvF);
    diffuseColor.rgb = mix(diffuseColor.rgb, LF.rgb, LF.a * fW * uLiv);
    vec4 F = texture2D(tFront, uvF);
    lamp = F.r * fW; lens = F.a * F.r * fW; wire = F.a * (1.0 - F.r) * fW * smoothstep(0.3, 0.7, vN.x); // 網子只在朝前的面（開口的內壁是黑的）
    amber = F.b * fW; blackG = max(blackG, F.g * fW * (1.0 - F.r));
  }
  float rW = (1.0 - smoothstep(uRx.y, uRx.x, vP.x)) * (1.0 - smoothstep(-0.1, 0.35, vN.x));
  if (rW > 0.0) {
    vec4 Rr = texture2D(tRear, vec2((vP.z + 1.0) / 2.0, vP.y / 1.3));
    red = Rr.r * rW * (1.0 - Rr.g); rev = Rr.b * rW; blackG = max(blackG, Rr.g * rW); gap = max(gap, Rr.a * rW);
  }
  float tW = smoothstep(0.25, 0.5, vN.y);
  matte = max(matte, Tp.r * tW); blackG = max(blackG, Tp.g * tW * (1.0 - sf)); gap = max(gap, Tp.b * tW);
  // 輪拱內側、底盤：黑
  float well = max(step(length(vP.xy - vec2(uXr, uWellR.x)), uWellR.y) * step(abs(vP.z), uWellR.z), step(length(vP.xy - vec2(uXf, uWell.x)), uWell.y) * step(abs(vP.z), uWell.z));
  well *= step(vN.y, 0.35); // 朝上的面（引擎蓋很低的車，蓋子會落在輪拱半徑裡）不算輪拱內側
  float under = step(vN.y, -0.6) * step(vP.y, 0.3);
  matte = max(matte, max(well, under));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), blackG);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02), matte);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.9), lamp);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.11, 0.13), lens);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.23, 0.24), wire);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.45, 0.05), amber);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.0, 0.01), red);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), rev);
  diffuseColor.rgb *= 1.0 - 0.85 * gap;
`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.2, blackG);
  roughnessFactor = mix(roughnessFactor, 0.8, matte);
  roughnessFactor = mix(roughnessFactor, 0.14, lamp);
  roughnessFactor = mix(roughnessFactor, 0.05, lens);
  roughnessFactor = mix(roughnessFactor, 0.4, wire);
  roughnessFactor = mix(roughnessFactor, 0.12, max(amber, red));
`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.0, max(blackG, matte));
  metalnessFactor = mix(metalnessFactor, 1.0, lamp * (1.0 - lens));
  metalnessFactor = mix(metalnessFactor, 0.0, lens);
  metalnessFactor = mix(metalnessFactor, 0.8, wire);
`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  material.clearcoat *= 1.0 - max(max(matte, wire), blackG * 0.8);
`);
  };
  mat.customProgramCacheKey = () => 'paint';
}
// 玻璃那一層：只留玻璃的地方
export function patchGlass(mat, tex) {
  mat.onBeforeCompile = (shader) => {
    inject(shader, tex);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float glass, blk; glassMask(texture2D(tSide, uvSide(vP)), texture2D(tTop, uvTop(vP)), glass, blk);
  if (glass < 0.5 || blk > 0.5) discard;
`).replace('#include <opaque_fragment>', `#include <opaque_fragment>
  float refl = max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b);
  gl_FragColor.a = clamp(diffuseColor.a + refl * 0.9, 0.0, 1.0);
`);
  };
  mat.customProgramCacheKey = () => 'glass';
}
// 車內那一層（車殼背面）：玻璃的地方也挖掉，才看得穿兩邊車窗
export function patchInside(mat, tex) {
  mat.onBeforeCompile = (shader) => {
    inject(shader, tex);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float glass, blk; glassMask(texture2D(tSide, uvSide(vP)), texture2D(tTop, uvTop(vP)), glass, blk);
  if (glass > 0.5 && blk < 0.5) discard;
`);
  };
  mat.customProgramCacheKey = () => 'inside';
}
