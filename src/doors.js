// 第 98 批（Nick 2026-11-17「車門做成是可自己打開關起來的 請上網查影片各車的開門樣子 像AV12是剪刀門上開的」）：
//   車門＝把車身（還有車裡面靠門的那一塊：門板）照門的形狀切下來，掛在鉸鏈上轉；關好了換回原本的網格（跟後車廂 mart.src.js trunkCut 一樣的作法）
//   種類（照真的車）：conv＝一般的門（前面當軸往外轉）、scissor＝剪刀門（AV12：前面當軸整片往上翻）、butterfly＝蝴蝶門（SP3、SN8、LF：往上又往外）、
//   gull＝鷗翼門（HY：車頂中間當軸往上掀）、dihedral＝轉出去再翻上來（JESKO）
//   座標：車子自己的（car 的 local）：+x 往前、+y 往上、+z 右邊；side＝−1 左邊、+1 右邊
//   門的形狀（側面看）：下面一塊長方形（門檻到窗下緣）＋上面窗框（前緣照 A 柱斜）＝一個凸多邊形；z 只切外面那一層（|z| > zIn）
//   doorProbe(S, key) 量這台車（輪子、車身的盒子、側窗）→ 每一邊、每一排（前門、後門）的門；doorCut 切；doorRig 開關（每一格 step）
import * as THREE from 'three';

export const DOOR_KIND = { aventador: 'scissor', sp3: 'butterfly', senna: 'butterfly', laferrari: 'butterfly', huayra: 'gull', jesko: 'dihedral' };
export const DOOR_FOUR = { altis: 1, evo: 1, p8: 1, civic: 1 }; // 四門（後座有自己的門）
// 每台車量好的（node door-fit.mjs --write 用 cview.html 量，寫在這裡：遊戲裡不用再打射線，量一次要好幾秒）；左右一樣（車子是鏡射的）
//   xf 門的前緣、xr 後緣、yb 下緣、yw 窗下緣、yt 上緣、xat 窗框上面前緣（A 柱）、zIn 切到哪裡（|z| 比這個大的才是門）、zOut 門外面、zt 窗上緣的玻璃、roof 車頂、xr2 後門的後緣（四門）；車身（S.body）的座標，公尺
//   沒有的車（新車）：遊戲裡現場量（慢）
export const DOOR_FIT = {"gc8":{"xf":0.77,"xr":-0.23,"yb":0.262,"yw":0.962,"yt":1.357,"xat":0.27,"zIn":0.587,"zOut":0.855,"zt":0.637,"roof":1.378},"yaris":{"xf":0.751,"xr":-0.304,"yb":0.269,"yw":0.889,"yt":1.376,"xat":0.401,"zIn":0.599,"zOut":0.845,"zt":0.649,"roof":1.366},"supra":{"xf":0.788,"xr":-0.254,"yb":0.275,"yw":0.869,"yt":1.346,"xat":0.438,"zIn":0.686,"zOut":0.866,"zt":0.686,"roof":1.209},"gtr":{"xf":0.863,"xr":-0.247,"yb":0.277,"yw":0.947,"yt":1.252,"xat":0.51,"zIn":0.606,"zOut":0.855,"zt":0.656,"roof":1.278},"rx7":{"xf":0.794,"xr":-0.206,"yb":0.266,"yw":0.777,"yt":1.158,"xat":0.444,"zIn":0.64,"zOut":0.843,"zt":0.64,"roof":0.975},"ae86":{"xf":0.914,"xr":-0.086,"yb":0.341,"yw":0.89,"yt":1.28,"xat":0.564,"zIn":0.57,"zOut":0.794,"zt":0.57,"roof":1.149},"civic":{"xf":0.863,"xr":-0.137,"yb":0.278,"yw":0.884,"yt":1.356,"xat":0.513,"zIn":0.603,"zOut":0.886,"zt":0.636,"roof":1.324,"xr2":-1.022,"roof2":1.435},"evo":{"xf":0.878,"xr":-0.122,"yb":0.272,"yw":1.04,"yt":1.614,"xat":0.528,"zIn":0.652,"zOut":0.851,"zt":0.652,"roof":1.244,"xr2":-0.943,"roof2":1.45},"altis":{"xf":0.969,"xr":-0.031,"yb":0.266,"yw":0.931,"yt":1.433,"xat":0.619,"zIn":0.728,"zOut":0.872,"zt":0.728,"roof":1.229,"xr2":-0.939,"roof2":1.374},"p918":{"xf":0.866,"xr":-0.259,"yb":0.297,"yw":0.713,"yt":1.088,"xat":0.517,"zIn":0.572,"zOut":0.905,"zt":0.612,"roof":1.131},"sp3":{"xf":0.777,"xr":-0.317,"yb":0.284,"yw":0.831,"yt":1.301,"xat":0.427,"zIn":0.747,"zOut":0.938,"zt":0.747,"roof":1.126},"jesko":{"xf":0.903,"xr":-0.204,"yb":0.297,"yw":0.735,"yt":1.133,"xat":0.553,"zIn":0.587,"zOut":0.932,"zt":0.243,"roof":1.083},"chiron":{"xf":0.931,"xr":-0.193,"yb":0.29,"yw":0.754,"yt":1.16,"xat":0.581,"zIn":0.71,"zOut":0.923,"zt":0.71,"roof":0.981},"aventador":{"xf":0.719,"xr":-0.408,"yb":0.281,"yw":0.691,"yt":1.057,"xat":0.369,"zIn":0.625,"zOut":0.958,"zt":0.675,"roof":1.127},"senna":{"xf":0.665,"xr":-0.449,"yb":0.277,"yw":0.751,"yt":1.158,"xat":0.315,"zIn":0.584,"zOut":0.917,"zt":0.599,"roof":1.19},"huayra":{"xf":0.84,"xr":-0.347,"yb":0.281,"yw":0.709,"yt":1.09,"xat":0.49,"zIn":0.589,"zOut":0.931,"zt":0.612,"roof":1.145},"laferrari":{"xf":0.844,"xr":-0.265,"yb":0.271,"yw":0.673,"yt":1.038,"xat":0.494,"zIn":0.64,"zOut":0.924,"zt":0.69,"roof":1.097},"jp4":{"xf":0.705,"xr":-0.295,"yb":0.393,"yw":1.299,"yt":1.948,"xat":0.355,"zIn":0.664,"zOut":0.86,"zt":0.714,"roof":2.028},"k2":{"xf":0.635,"xr":-0.365,"yb":0.315,"yw":1.234,"yt":2.057,"xat":0.285,"zIn":0.66,"zOut":0.8,"zt":0.66,"roof":1.732},"p8":{"xf":1.18,"xr":0.18,"yb":0.37,"yw":1.302,"yt":2.035,"xat":0.83,"zIn":0.783,"zOut":1,"zt":0.783,"roof":1.617,"xr2":-0.77,"roof2":1.847}}; // door-fit.mjs --write 換掉這一行
export function doorKind(k) { return DOOR_KIND[k] || 'conv'; }

const DR_V = new THREE.Vector3(), DR_M = new THREE.Matrix4();
function drMeshes(root, skip) {
  const out = []; const walk = (o) => { if (skip(o)) return; if (o.isMesh && o.geometry && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible !== false) out.push(o); for (const c of o.children) walk(c); };
  walk(root); return out;
}
const drGlass = (m) => !!m && (m.transparent || /glass|window/i.test(m.name || ''));

// 量（左邊，右邊一樣）：打射線找側窗、A 柱、門檻
export function doorMeasure(S, key) {
  const car = S.body; S.car.updateMatrixWorld(true); // 車身（S.body）自己的座標：開車的時候車身會晃（懸吊），門跟著車身
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert();
  const skipCut = (o) => !!o.userData.seated || o.name === 'mart-trunk' || o.name === 'door-rig' || /^z2-rider|^seat-me|^lid-|^door-/.test(o.name);
  const body = drMeshes(S.body, (o) => skipCut(o) || o.name === 'interior');
  const box = new THREE.Box3(), bb = new THREE.Box3();
  for (const o of body) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); DR_M.multiplyMatrices(inv, o.matrixWorld); bb.copy(o.geometry.boundingBox).applyMatrix4(DR_M); box.union(bb); }
  const hubs = (S.wheels || []).map((w) => w.parent).filter(Boolean).map((h) => { h.updateMatrixWorld(true); return car.worldToLocal(h.getWorldPosition(new THREE.Vector3())); }); // 輪子：前軸、後軸、半徑
  const xs = hubs.map((p) => p.x), xF = xs.length ? Math.max(...xs) : box.max.x - 0.9, xR = xs.length ? Math.min(...xs) : box.min.x + 0.9, R = hubs.length ? hubs[0].y : 0.32;
  const ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), s = -1;
  const hitSide = (x, y) => { // 從左邊往裡面打：打到的第一個（點、是不是玻璃）
    o.set(x, y, s * (box.max.z - box.min.z + 2)).applyMatrix4(car.matrixWorld); d.set(0, 0, -s).transformDirection(car.matrixWorld); ray.set(o, d); ray.far = 6;
    const h = ray.intersectObjects(body, false)[0]; if (!h) return null; const p = car.worldToLocal(h.point.clone()); const mt = Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material; return { z: p.z, glass: drGlass(mt) }; };
  const topAt = (x) => { let top = -1e9; for (const z of [0.12, -0.12, 0.3, -0.3]) { o.set(x, box.max.y + 1, z).applyMatrix4(car.matrixWorld); d.set(0, -1, 0).transformDirection(car.matrixWorld); ray.set(o, d); ray.far = box.max.y + 3; const h = ray.intersectObjects(body, false)[0]; if (h) top = Math.max(top, car.worldToLocal(h.point.clone()).y); } return top > -1e9 ? top : box.max.y; }; // 車頂：正中間（z 0）是左右兩半的縫，射線會穿過去（SUPRA 量到 0.44）→ 兩邊各打兩條取最高
  const halfW = Math.max(box.max.z, -box.min.z), four = !!DOOR_FOUR[key], r3 = (v) => Math.round(v * 1000) / 1000;
  const glassY = (x) => { let lo = null, hi = null; for (let y = R; y < box.max.y; y += 0.03) { const h = hitSide(x, y); if (h && h.glass) { if (lo == null) lo = y; hi = y; } } return lo == null ? null : [lo, hi]; }; // 側窗的上下（每 3 公分）
  const front = (y) => { for (let x = xF; x > xR; x -= 0.06) { const h = hitSide(x, y); if (h && h.glass) { let a = x; for (let k = 1; k < 6; k++) { const q = hitSide(x + 0.01 * k, y); if (q && q.glass) a = x + 0.01 * k; else break; } return a; } } return null; }; // 窗的前緣（先 6 公分一格，再 1 公分）
  const xMid = (xF + xR) / 2, win = glassY(xMid) || glassY(xMid + 0.25) || glassY(xMid - 0.25);
  const yb = Math.max(box.min.y + 0.1, R - 0.05), yw = win ? win[0] - 0.01 : box.min.y + (box.max.y - box.min.y) * 0.58, yt = win ? win[1] + 0.025 : box.max.y - 0.08;
  const xwb = front(yw + 0.04), xwt = front(yt - 0.05);
  const xf = Math.min(xF - R - 0.1, xwb != null ? xwb + 0.12 : xF - R - 0.1);
  const xr = xf - (four ? 1.0 : Math.min(1.35, Math.max(1.0, (xf - (xR + R + 0.12)) * 0.62)));
  const xat = Math.min(xf - 0.05, xwt != null ? xwt + 0.03 : xf - 0.35);
  // 門外面那一層：窗的上緣那裡玻璃在哪裡（往裡 5 公分）、門檻那裡車身在哪裡（往裡 14 公分），取比較外面的；最少車寬的 55%
  const gz = hitSide((xf + xr) / 2, yt - 0.06), sz = hitSide((xf + xr) / 2, yb + 0.06);
  let zSkin = sz && !sz.glass ? Math.abs(sz.z) : 0; for (let k = 1; k <= 4; k++) { const h = hitSide((xf + xr) / 2, yb + 0.06 + (yw - 0.04 - yb - 0.06) * k / 4); if (h && !h.glass) zSkin = Math.max(zSkin, Math.abs(h.z)); } // 門外面的鈑金：門檻到窗下緣打 5 條取最外面（J4 門檻那條打到大樑 0.42）
  const zS = sz && Math.abs(sz.z) > zSkin - 0.15 ? Math.abs(sz.z) : zSkin; // 門檻打到的比鈑金裡面 15 公分以上（大樑、踏板）＝不算
  const zIn = Math.max(halfW * 0.55, Math.min(gz ? Math.abs(gz.z) - 0.05 : halfW - 0.3, zS ? zS - 0.14 : halfW - 0.3));
  const F = { xf, xr, yb, yw, yt, xat, zIn, zOut: Math.max(zSkin || halfW, zIn + 0.1), zt: gz ? Math.abs(gz.z) : zIn, roof: topAt((xf + xr) / 2) };
  if (four) { F.xr2 = Math.max(xR + R + 0.06, xr - 0.95); F.roof2 = topAt((xr + F.xr2) / 2); }
  for (const k of Object.keys(F)) F[k] = r3(F[k]);
  return F;
}
// 每一個門 { side, row, kind, poly:[[x,y]…]（側面的凸多邊形，逆時針）, zIn, zOut, pivot, at(t, g), planes }
export function doorProbe(S, key) {
  if (S._doors) return S._doors;
  const F = DOOR_FIT[key] || doorMeasure(S, key), kind = doorKind(key), doors = [];
  for (const s of [-1, 1]) {
    const { xf, xr, yb, yw, yt, xat, zIn, zOut } = F;
    doors.push(drMk(kind, s, 0, [[xr, yb], [xf, yb], [xf, yw], [xat, yt], [xr, yt]], zIn, zOut, { xf, xr, yb, yw, yt, xat, zt: F.zt, roof: F.roof }));
    if (F.xr2 != null) { // 後門：前門後緣到後輪拱前面；窗下緣一樣、上緣到車頂
      const xr2 = F.xr2, xf2 = xr - 0.008;
      doors.push(drMk('conv', s, 1, [[xr2, yb], [xf2, yb], [xf2, yt], [xr2 + 0.05, yt], [xr2, yw]], zIn, zOut, { xf: xf2, xr: xr2, yb, yw, yt, xat: xf2, zt: F.zt, roof: F.roof2 ?? F.roof }));
    }
  }
  return (S._doors = { doors, kind, key, F });
}

// 鉸鏈和打開的樣子：rig＝{ pivot:[x,y,z], at(t, g) } g＝鉸鏈的 Group（position＝pivot），t 0 關～1 開
function drMk(kind, s, row, poly, zIn, zOut, m) {
  const D = { kind, side: s, row, poly, zIn, zOut, m };
  const z = s * (zOut - 0.03);
  if (kind === 'scissor') { D.pivot = [m.xf - 0.08, m.yw - 0.05, z]; D.at = (t, g) => { const e = drEase(t); g.rotation.set(0, 0, 0); g.rotateY(s * 0.12 * e); g.rotateZ(-1.2 * e); }; }
  else if (kind === 'butterfly') { D.pivot = [m.xat + 0.05, m.yt - 0.02, s * (zIn + 0.05)]; D.at = (t, g) => { const e = drEase(t); g.rotation.set(0, 0, 0); g.rotateY(s * 0.42 * e); g.rotateZ(-0.95 * e); g.rotateX(-s * 0.3 * e); }; }
  else if (kind === 'gull') { D.pivot = [(m.xf + m.xr) / 2, m.yt, s * Math.max(zIn, (m.zt ?? zIn) - 0.02)]; D.at = (t, g) => { const e = drEase(t); g.rotation.set(-s * 1.25 * e, 0, 0); }; } // 鷗翼：窗的上緣（車頂的邊）當軸往上掀
  else if (kind === 'dihedral') { D.pivot = [m.xf - 0.06, m.yb + 0.3, z]; D.at = (t, g) => { const a = drEase(Math.min(1, t / 0.4)), b = drEase(Math.max(0, (t - 0.3) / 0.7)); g.rotation.set(0, 0, 0); g.rotateY(s * 0.3 * a); g.rotateZ(-1.3 * b); }; }
  else { D.pivot = [m.xf - 0.04, 0, z]; D.at = (t, g) => { g.rotation.set(0, s * 1.08 * drEase(t), 0); }; } // 一般的門：前面當軸往外（後緣往外 62 度）
  // 切的範圍＝側面的多邊形（每一個邊一個面）＋ |z| > zIn
  const P = []; const n = poly.length;
  for (let i = 0; i < n; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n], ex = x1 - x0, ey = y1 - y0, L = Math.hypot(ex, ey) || 1; const nx = ey / L, ny = -ex / L; P.push([nx, ny, 0, nx * x0 + ny * y0]); } // 逆時針：外面的法線 (ey, −ex)
  P.push([0, 0, -s, -zIn]); // s·z ≥ zIn
  D.planes = P;
  D.inR = (x, y, zz) => { for (const p of P) if (p[0] * x + p[1] * y + p[2] * zz > p[3] + 1e-6) return false; return true; };
  return D;
}
const drEase = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// 切：每個網格的三角形照門的那幾個面切開：裡面的＝門、外面的＝剩下的（跟 mart.src.js trunkCut 一樣，面可以是斜的）；同一份頂點，只換 index（切到的邊多幾個點）
export function doorCut(S, D) {
  D.cut = D.cut || new Map();
  const car = S.body; S.car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), parts = [];
  const skip = (o) => !!o.userData.seated || o.name === 'mart-trunk' || o.name === 'door-rig' || /^z2-rider|^seat-me|^lid-|^door-/.test(o.name);
  for (const ob of drMeshes(S.body, skip)) {
    if (!ob.geometry.attributes.position) continue;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, ob.matrixWorld), g = ob.geometry, key = g.uuid + rel.elements.map((e) => e.toFixed(4)).join();
    let sp = D.cut.get(key);
    if (sp === undefined) { sp = drSplit(g, rel, D); D.cut.set(key, sp); }
    if (sp) parts.push({ mesh: ob, g0: g, sp, rel });
  }
  return parts;
}
function drSplit(g, rel, D) {
  const pos = g.attributes.position, n = pos.count, C = new Float32Array(n * 3), inside = new Uint8Array(n);
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox.clone().applyMatrix4(rel), xs = D.poly.map((p) => p[0]), ys = D.poly.map((p) => p[1]);
  if (bb.max.x < Math.min(...xs) || bb.min.x > Math.max(...xs) || bb.max.y < Math.min(...ys) || bb.min.y > Math.max(...ys) || (D.side > 0 ? bb.max.z < D.zIn : bb.min.z > -D.zIn)) return null;
  for (let i = 0; i < n; i++) { DR_V.fromBufferAttribute(pos, i).applyMatrix4(rel); C[i * 3] = DR_V.x; C[i * 3 + 1] = DR_V.y; C[i * 3 + 2] = DR_V.z; inside[i] = D.inR(DR_V.x, DR_V.y, DR_V.z) ? 1 : 0; }
  const CC = Array.from(C), PL = D.planes, nv = [], ek = new Map();
  const cf = (id, ax) => CC[id * 3 + ax], fOf = (id, p) => p[0] * cf(id, 0) + p[1] * cf(id, 1) + p[2] * cf(id, 2) - p[3];
  const split = (A, B, pi, fa, fb) => { if (fa === 0) return A; if (fb === 0) return B;
    const lo = A < B ? A : B, hi = A < B ? B : A, key = lo * 64 + pi + '_' + hi; let id = ek.get(key); if (id !== undefined) return id;
    const t = lo === A ? fa / (fa - fb) : fb / (fb - fa); id = n + nv.length; nv.push([lo, hi, t]);
    for (let ax = 0; ax < 3; ax++) CC.push(cf(lo, ax) + (cf(hi, ax) - cf(lo, ax)) * t); ek.set(key, id); return id; };
  const fan = (poly, out) => { for (let q = 1; q + 1 < poly.length; q++) out.push(poly[0], poly[q], poly[q + 1]); };
  const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : n, I = (k) => (idx ? idx[k] : k);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.drawRange.count === Infinity ? cnt : Math.min(cnt, g.drawRange.count), materialIndex: 0 }];
  const lid = [], rest = [], gl = [], gr = []; let any = false;
  for (const gp of groups) { const l0 = lid.length, r0 = rest.length;
    for (let k = gp.start; k + 2 < gp.start + gp.count && k + 2 < cnt; k += 3) {
      const a = I(k), b = I(k + 1), c = I(k + 2);
      if (inside[a] && inside[b] && inside[c]) { lid.push(a, b, c); any = true; continue; }
      let out = false; for (const p of PL) if (fOf(a, p) > 0 && fOf(b, p) > 0 && fOf(c, p) > 0) { out = true; break; }
      if (out) { rest.push(a, b, c); continue; }
      let poly = [a, b, c];
      for (let pi = 0; pi < PL.length && poly.length >= 3; pi++) { const pl = PL[pi], ins = [], outs = [];
        for (let q = 0; q < poly.length; q++) { const A = poly[q], B = poly[(q + 1) % poly.length], fa = fOf(A, pl), fb = fOf(B, pl);
          if (fa <= 0) ins.push(A); if (fa >= 0) outs.push(A);
          if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const N = split(A, B, pi, fa, fb); ins.push(N); outs.push(N); } }
        if (outs.length >= 3) fan(outs, rest); poly = ins; }
      if (poly.length >= 3) { fan(poly, lid); any = true; }
    }
    gl.push({ start: l0, count: lid.length - l0, materialIndex: gp.materialIndex }); gr.push({ start: r0, count: rest.length - r0, materialIndex: gp.materialIndex });
  }
  if (!any) return null;
  let attrs = g.attributes, N = n;
  if (nv.length) { attrs = {}; N = n + nv.length;
    for (const [k, a] of Object.entries(g.attributes)) { const s2 = a.itemSize, arr = new Float32Array(N * s2), get = (i, c) => (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i));
      for (let i = 0; i < n; i++) for (let c = 0; c < s2; c++) arr[i * s2 + c] = get(i, c);
      for (let j = 0; j < nv.length; j++) { const [i0, i1, t] = nv[j], o = (n + j) * s2; for (let c = 0; c < s2; c++) arr[o + c] = arr[i0 * s2 + c] + (arr[i1 * s2 + c] - arr[i0 * s2 + c]) * t;
        if ((k === 'normal' || k === 'tangent') && s2 >= 3) { const L = Math.hypot(arr[o], arr[o + 1], arr[o + 2]) || 1; arr[o] /= L; arr[o + 1] /= L; arr[o + 2] /= L; } }
      attrs[k] = new THREE.BufferAttribute(arr, s2); } }
  const mk = (arr, gs) => { const q = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(attrs)) q.setAttribute(k, a); q.setIndex(new (N > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(arr, 1)); if (g.groups.length) for (const x of gs) q.addGroup(x.start, x.count, x.materialIndex); q.boundingSphere = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere); q.boundingBox = g.boundingBox; return q; };
  return { lid: mk(lid, gl), rest: mk(rest, gr), added: nv.length, tris: lid.length / 3 };
}

// 開關：rig.set(i, want)（i＝第幾個門，want 0／1）、rig.step(dt)（每一格）；全部關好＝車身換回原本的網格（不多 draw call）
//   同一個網格可能被兩個門切到（左右兩邊、前後門）：先切第一個門，剩下的再給第二個門切（照順序疊上去）
export function doorRig(S, key) {
  if (S._doorRig) return S._doorRig;
  const P = doorProbe(S, key), root = new THREE.Group(); root.name = 'door-rig'; S.body.add(root);
  const DS = P.doors.map((D) => ({ D, t: 0, want: 0, g: null, inner: null, lids: [], on: false }));
  let cutOn = false, base = []; // base：每個網格原本的 geometry
  function apply() { // 照現在開著的門重新切（只有開關那一下）
    for (const b of base) b.mesh.geometry = b.g0; base = [];
    for (const d of DS) { for (const m of d.lids) m.removeFromParent(); d.lids.length = 0; }
    cutOn = DS.some((d) => d.on);
    if (!cutOn) return;
    const seen = new Map();
    for (const d of DS) {
      if (!d.on) continue;
      if (!d.g) { d.g = new THREE.Group(); d.g.name = 'door-hinge'; d.g.position.set(...d.D.pivot); root.add(d.g); d.inner = new THREE.Group(); d.inner.position.set(-d.D.pivot[0], -d.D.pivot[1], -d.D.pivot[2]); d.g.add(d.inner); }
      for (const p of doorCut(S, d.D)) {
        if (!seen.has(p.mesh)) { seen.set(p.mesh, p.g0); base.push({ mesh: p.mesh, g0: p.g0 }); }
        const cur = p.mesh.geometry === p.g0 ? p.sp : null; // 這個網格已經被前一個門切過了：再切剩下的那一份
        const sp = cur || drSplit(p.mesh.geometry, p.rel, d.D); if (!sp) continue;
        p.mesh.geometry = sp.rest;
        const m = new THREE.Mesh(sp.lid, p.mesh.material); m.matrixAutoUpdate = false; m.matrix.copy(p.rel); m.castShadow = p.mesh.castShadow; m.receiveShadow = p.mesh.receiveShadow; m.renderOrder = p.mesh.renderOrder; m.name = 'door-' + (p.mesh.name || 'part'); m.frustumCulled = false;
        d.inner.add(m); d.lids.push(m);
      }
    }
  }
  const rig = {
    P, doors: DS,
    get any() { return DS.some((d) => d.want > 0 || d.t > 0); },
    open(i) { const d = DS[i]; return d ? d.t : 0; },
    set(i, want) { const d = DS[i]; if (!d) return; d.want = want ? 1 : 0; if (d.want && !d.on) { d.on = true; apply(); } },
    slam(i) { const d = DS[i]; if (d && d.want) { d.want = 0; d.fast = true; } }, // 開快了：門自己甩上（很快關）
    nudge(i, t) { const d = DS[i]; if (!d) return; rig.set(i, 1); d.t = Math.max(d.t, t); }, // 下車：門先開一點（人才走得出來）
    snap(i, t) { const d = DS[i]; if (!d) return; d.t = d.want = t ? 1 : 0; if (d.want && !d.on) { d.on = true; apply(); } rig.step(0); },
    step(dt, T = 0.6) {
      let re = false;
      for (const d of DS) {
        if (!d.on) continue;
        if (d.t !== d.want) d.t = d.want > d.t ? Math.min(d.want, d.t + dt / T) : Math.max(d.want, d.t - dt / (T * (d.fast ? 0.3 : 0.8)));
        if (d.want) d.fast = false;
        if (d.g) { d.D.at(d.t, d.g); d.g.updateMatrixWorld(true); }
        if (d.t === 0 && d.want === 0) { d.on = false; re = true; } // 關好了：換回原本的網格
      }
      if (re) apply();
    },
    near(x, z, side) { // 這台車哪一個門離 (x, z)（車子座標）最近；side 只看那一邊
      let best = -1, bd = 1e9; for (let i = 0; i < DS.length; i++) { const D = DS[i].D; if (side && D.side !== side) continue; const xm = (D.m.xf + D.m.xr) / 2, dd = Math.hypot(x - xm, z - D.side * D.zOut); if (dd < bd) { bd = dd; best = i; } } return best; },
    dispose() { // 換回原本的網格、切好的都丟掉（量的 S._doors 留著：下次不用再量）
      for (const b of base) b.mesh.geometry = b.g0; base = []; root.removeFromParent();
      for (const d of DS) { for (const sp of d.D.cut?.values() || []) if (sp) { sp.lid.dispose(); sp.rest.dispose(); } d.D.cut = null; }
      S._doorRig = null; },
  };
  return (S._doorRig = rig);
}
