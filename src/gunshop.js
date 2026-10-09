// ---- 槍店（第 3 批）：走得進去的店：玻璃櫃台、牆上的長槍、子彈架、後面的靶場（打倒的靶會倒下去、計分）；櫃台的買槍畫面 ----
// Nick 2026-09-28 07:19：「有店可以買槍   子彈」
// 規矩（整個遊戲一樣）：卡通、不血腥；槍都是虛構的（沒有牌子、商標）：手槍、衝鋒槍、霰彈槍、步槍；店裡不可以開槍，後面的靶場才可以
// 全部用程式做（貼圖都是 canvas 畫的，沒有下載任何東西）；世界座標跟 village.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北）
//
// 【API】
//   await gunShopFonts(name)            貼圖上的中文字先等字型（最多 1.5 秒；name＝店名，招牌上的字）
//   const S = buildGunShopInterior({ door, name, renderer, makeCharacter, clerkLook, quality, GAME, onRangeEnd })
//     door：店門外面那一點 { x, z, ry }（跟 V.buildings[i].door 一樣：ry＝門朝外的方向）或 { x, z, heading }（heading＝朝外）；
//           V.places.gunshop.door 直接給。沒給＝(0, 0)、朝南。裡面比外面的房子大也沒關係：裡面是自己的 THREE.Scene（跟走進房子的模組一樣）
//     name：店名（招牌；V.places.gunshop.name，沒有就「阿龍槍砲店」）；renderer：做反射的環境貼圖（槍、金屬架子才亮）、貼圖 anisotropy（可省略）
//     makeCharacter(look)：店員（buildCharacter；charstub.js 或 character.js）；沒給就沒有店員
//     quality：'high'｜'low'（慢的手機：沒有反射貼圖、子彈盒少一點）；GAME：看靶場的最佳紀錄（GAME.guns.range）
//     onRangeEnd({ weapon, hits, total, time })：靶場一輪打完（頁面：gunShop.rangeResult(GAME, weapon, res) → 存檔、S.range.say(res.msg)）
//   S.group            THREE.Group：已經擺在世界位置（門口）；放進自己的 THREE.Scene（燈在 group 裡）：scene.add(S.group); scene.background = S.background; scene.environment = S.environment
//   S.spawn            走進來站的地方 { x, z, heading }（門裡面 1.3 公尺、面朝裡面）
//   S.exitDoor         出去的長方形 { x, z, hx, hz, rot, to: 'outside', spawn: 門外 { x, z, heading }（面朝外）}；S.exits＝[exitDoor]（跟警察局、房子的裡面一樣）
//   S.doors            walk.js setDoors 用的：[{ x, z, ry, w }]（ry 朝店裡面；走進去＝走出店門）
//   S.colliders        世界座標的碰撞（牆 h ≥ 2.4、櫃台、架子、靶場的射擊台；記分板只擋子彈：y0）：createWalker({ world: { colliders }, bounds: S.walkBounds })、gunner.setWorld
//   S.walkBounds       { x0, x1, z0, z1 }（createWalker 的 bounds）；S.bounds：{ x, z, hx, hz, rot }（整間店＋靶場）
//   S.camera           { maxDist, ceiling, near }：walker.setCamera({ dist: maxDist, maxY: ceiling })
//   S.zones            { counter（櫃台前面：給「買槍、子彈」）, range（射擊台後面：給「開始練習」）, shop, rangeRoom }：{ x, z, hx, hz, rot }
//   S.zoneAt(x, z)     'counter' | 'range' | 'rangeRoom' | 'shop' | null
//   S.views            { counter, range }：{ pos: [x, y, z], look: [x, y, z], fov }（買東西的時候鏡頭擺這裡）
//   S.fireRule(x, z)   → null（靶場裡：可以開槍）｜'店裡不可以開槍，去後面的靶場'   → gunner.setWorld({ rule: S.fireRule, crime: false })
//   S.raycast(ox, oy, oz, dx, dy, dz, maxT, out) → t   子彈打靶（站著的靶）：out.kind＝'target'、out.nx/ny/nz、out.ref、out.onHit(hit)（靶倒下去）→ gunner.setWorld({ raycast: S.raycast })
//   S.range            靶場：start(weaponId) → true（站起來、倒數 3 秒、開始計時；全部打倒或 30 秒結束）、stop()、say(text)（記分板第二行）、
//                      state（'idle'｜'count'｜'run'｜'done'）、hits、total（6）、time、weapon；平常（沒在比）打倒的靶 2.5 秒後自己站起來
//   S.setClerk(state)  店員的動作（'idle'｜'talk'｜'wave'）；S.update(dt, player?)：每一幀（靶、倒數、店員；player＝{ x, z }：店員轉頭看你）
//   S.info             { tris, draws, ms }；S.dispose()
//
//   const shop = openGunShop(parent, GAME, onBuy, { name, money, onClose })   櫃台的買槍畫面（跟改車廠同一個樣子：garage.css 的 .shop、.part）
//     parent：放在哪個元素裡（車庫頁的 .wrap，畫面下面）；onBuy(kind 'gun'|'ammo', id, result)：買到了（頁面 save()、renderWallet()、gunner.refresh()）
//     money：錢的寫法（預設跟車庫一樣：萬／億）；onClose()：按「離開櫃台」
//     → { el, refresh(msg?), close() }
//   槍：按一下看價錢、再按一次買（送一個裝滿的彈匣）；子彈：按一下、再按一次買一盒，之後 3.5 秒內每按一次再買一盒
// 效能：同一個材質的東西併成一個網格（牆、架子、子彈盒、展示的槍⋯）；靶是一個 InstancedMesh；記分板有變才重畫；每一幀不新增物件
//
// 【接到遊戲裡】（town.src.js；guns-test.html 的 enterShop、leaveShop、openCounter、closeCounter、startRange 就是這樣接的）
//   第一次走進去才蓋：await gunShopFonts(name); S = buildGunShopInterior({ door: VIL.places.gunshop.door, name, renderer, makeCharacter: buildCharacter, GAME, onRangeEnd })
//     shopScene = new THREE.Scene()：add(S.group)、background、environment；第二個 walker：createWalker({ scene: shopScene, camera: dcam, world: { colliders: S.colliders },
//     colliders: [], hudParent: stage, doors: S.doors, bounds: S.walkBounds, mapLayer: walker.mapLayer, onDoor: 走出去 })
//   走進去（atDoor 是槍店）：walker.pause()；inside.setCharacter(角色)、teleport(S.spawn)、setCamera({ dist: S.camera.maxDist, maxY: S.camera.ceiling })、resume()
//     gunner.setWalker(inside)、setWorld({ scene: shopScene, colliders: S.colliders, ceiling: S.camera.ceiling, raycast: S.raycast, rule: S.fireRule, crime: false })、setTargets([])
//     police-ai.js 的 getPlayer：店裡 hidden＝true（找不到你）；櫃台打開的時候 mode 'off'
//   每一格：S.update(dt, inside.telemetry())；S.zoneAt(x, z) 是 'counter' → inside.setAction({ label: '買槍、子彈' })、是 'range'（沒在比）→「開始練習」；inside.update(dt)；gunner.update(dt)
//     renderer.render(shopScene, dcam)
//   櫃台：inside.pause()、gunner.setEnabled(false)、S.setClerk('talk')、body 加 shopping（畫面變矮）、鏡頭擺 S.views.counter；
//     openGunShop(wrap, GAME, (kind, id, res) => { save(); renderWallet(); gunner.refresh(); }, { onClose })；關掉反過來（inside.resume、setEnabled(true)）
//   靶場：S.range.start(gunner.telemetry().cur)；onRangeEnd(res) → r = gunShop.rangeResult(GAME, res.weapon, res)；save()；renderWallet()；S.range.say(r.msg)
//   走出去（inside 的 onDoor）：inside.pause()；walker.setCharacter(角色)、teleport(S.exitDoor.spawn)、resume()；gunner 換回村子（setWalker、setWorld、setTargets）
import * as THREE from 'three';
import { GUNS, GUN_IDS, gunShop, buildGunModel, GUN_ICONS, GUN_RANGE_REWARD } from './guns.js';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告：這個檔全部包在一個函式裡，只露出下面這些名字
export const { buildGunShopInterior, openGunShop, gunShopFonts, GUNSHOP_TEXT } = (() => {
const TAU = Math.PI * 2, HP = Math.PI / 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const DEF_NAME = '阿龍槍砲店';
const GUNSHOP_TEXT = '阿龍槍砲店槍子彈靶場安全第一口永遠朝的方向還不射時候手指要放在扳機上把每一都當作有看清楚目標和後面什麼規則戴耳罩護目鏡只台前開倒了會自己站起來保持準備計時秒打完美最佳紀錄獎金萬手衝鋒霰步營業中歡迎光臨按「開始練習」一輪個全部禁止吸菸使用限員工專區';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const hasDoc = () => typeof document !== 'undefined' && !!document.createElement;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

function gunShopFonts(name = DEF_NAME, ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 40px ${SANS}`, GUNSHOP_TEXT + name), f.load(`500 40px ${SANS}`, GUNSHOP_TEXT), f.load(`700 40px ${COND}`, '0123456789/.: RANGE GUN SHOP OPEN')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- 尺寸（本地座標：原點＝店門口的地面中間、+z＝外面（馬路）、−z＝往店裡面、+x＝走進來的右手邊）----
const SH = { x0: -5, x1: 5, z0: -9, z1: 0, H: 3.4 }; // 店面
const RG = { x0: -5, x1: 5, z0: -27, z1: -9.25, H: 3.2 }; // 靶場（跟店面中間的牆 z −9.25…−9）
const DOOR = { x0: -0.8, x1: 0.8, h: 2.3 }, RDOOR = { x0: 3.2, x1: 4.6, h: 2.2 }; // 大門、去靶場的門
const CNT = { x0: -4.3, x1: 1.8, z0: -5.4, z1: -4.7, h: 1.0 }; // 玻璃櫃台
const PART = { x0: 2.45, x1: 2.75, z0: -8.95, z1: -5.1 }; // 櫃台右邊的長槍櫃（隔開店員那邊跟往靶場的走道）
const BENCH = { z0: -12.8, z1: -12.2, h: 1.0 }; // 靶場的射擊台
const TARGETS = [[-3.4, -16.5], [-1.2, -18.0], [1.3, -17.2], [3.5, -19.5], [-2.4, -23.0], [2.1, -24.0]]; // 六個鋼靶（x, z）
const HINGE = 0.35; // 靶的軸（倒下去轉的地方）多高

// ---- 幾何：同一個材質的零件併在一起（位置、法線、顏色；有的還有 uv）----
const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _m = new THREE.Matrix4();
function bucket(uv) { return { p: [], n: [], c: [], uv: uv ? [] : null, tris: 0 }; }
// g：BufferGeometry（有沒有 index 都可以）；col：[r, g, b]（線性）或 null（用 g 自己的頂點色）；m：Matrix4；shade(x, y, z)：明暗（牆腳、天花板的陰影）
function put(B, g, col, m, shade, uvf) {
  const G = g.index ? g.toNonIndexed() : g, P = G.attributes.position, N = G.attributes.normal, K = G.attributes.color, U = G.attributes.uv;
  if (m) _n3.getNormalMatrix(m);
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i); if (m) _v.applyMatrix4(m);
    const x = _v.x, y = _v.y, z = _v.z, k = shade ? shade(x, y, z) : 1;
    B.p.push(x, y, z);
    _v.fromBufferAttribute(N, i); if (m) _v.applyMatrix3(_n3).normalize();
    B.n.push(_v.x, _v.y, _v.z);
    if (col) B.c.push(col[0] * k, col[1] * k, col[2] * k); else B.c.push(K.getX(i) * k, K.getY(i) * k, K.getZ(i) * k);
    if (B.uv) { if (uvf) { const q = uvf(x, y, z, U ? U.getX(i) : 0, U ? U.getY(i) : 0); B.uv.push(q[0], q[1]); } else B.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
  }
  B.tris += P.count / 3;
  if (G !== g) G.dispose();
}
function toMesh(B, mat, name) {
  if (!B.p.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
  if (B.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}
// 長方形（x0…x1、y0…y1、z0…z1）；seg：y 方向切幾段（牆腳的陰影要頂點）
function box(B, x0, y0, z0, x1, y1, z1, col, shade, seg = 1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0, 1, seg, 1); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  put(B, g, col, null, shade); g.dispose();
}
function cyl(B, r, y0, y1, x, z, col, seg = 10, shade) { const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1); g.translate(x, (y0 + y1) / 2, z); put(B, g, col, null, shade); g.dispose(); }
// 一片長方形（四個角，逆時針從正面看），uv：[u0, v0, u1, v1]（atlas 的一格，v 往上）
function quad(B, a, b, c, d, col, uv) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const P = [a, b, c, a, c, d], T = uv ? [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]] : null;
  for (let i = 0; i < 6; i++) { B.p.push(P[i][0], P[i][1], P[i][2]); B.n.push(nx, ny, nz); B.c.push(col[0], col[1], col[2]); if (B.uv) B.uv.push(T ? T[i][0] : 0, T ? T[i][1] : 0); }
  B.tris += 2;
}
// 牆上的一片（貼在 z＝常數的牆上，面朝 +z 或 −z；或 x＝常數，面朝 ±x）
function panelZ(B, x0, x1, y0, y1, z, face, col, uv) { // face 1：面朝 +z
  if (face > 0) quad(B, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col, uv); else quad(B, [x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], col, uv);
}
function panelX(B, z0, z1, y0, y1, x, face, col, uv) { // face 1：面朝 +x（從 +x 看：左邊是 z 大的那邊）
  if (face > 0) quad(B, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], col, uv); else quad(B, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], col, uv);
}

// ---- 貼圖 ----
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, o = {}) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (o.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } if (o.aniso) t.anisotropy = o.aniso; return t; }
function fitFont(g, text, maxW, px, weight = 700, fam = SANS) { let s = px; g.font = `${weight} ${s}px ${fam}`; while (s > 8 && g.measureText(text).width > maxW) { s -= 2; g.font = `${weight} ${s}px ${fam}`; } return s; }
function crosshair(g, x, y, r, col, lw) {
  g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.beginPath(); for (const [a, b] of [[[x - r * 1.35, y], [x - r * 0.45, y]], [[x + r * 0.45, y], [x + r * 1.35, y]], [[x, y - r * 1.35], [x, y - r * 0.45]], [[x, y + r * 0.45], [x, y + r * 1.35]]]) { g.moveTo(...a); g.lineTo(...b); } g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(x, y, lw * 0.9, 0, TAU); g.fill();
}
// 一張 1024² 的 atlas：招牌、海報、標籤（區域 → uv）
function paintAtlas(name) {
  const W = 1024, c = canvas(W, W), g = c.getContext('2d'), R = {};
  const reg = (k, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); R[k] = [x / W, 1 - (y + h) / W, (x + w) / W, 1 - y / W]; };
  // 店名的招牌（亮的）：黑底、橘字、準星（跟外面的招牌同一個樣子）
  reg('sign', 0, 0, 1024, 176, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#202226'); gr.addColorStop(1, '#131417'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff8a2a'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20);
    crosshair(g, 104, h / 2, 42, '#ff8a2a', 8);
    g.fillStyle = '#ffb347'; g.textBaseline = 'middle'; g.textAlign = 'left'; fitFont(g, name, 560, 110); g.fillText(name, 184, h / 2 + 4);
    const x2 = Math.min(184 + g.measureText(name).width + 34, 760);
    g.fillStyle = '#f2f3f5'; fitFont(g, '槍 · 子彈 · 靶場', w - x2 - 30, 36, 500); g.fillText('槍 · 子彈 · 靶場', x2, h / 2 - 24);
    g.fillStyle = '#9aa1ac'; g.font = `700 36px ${COND}`; g.fillText('GUN SHOP', x2, h / 2 + 28);
  });
  // 靶場的門上面：紅底白字＋箭頭
  reg('rsign', 0, 176, 512, 128, (g, w, h) => {
    g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2f3f5'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'left'; fitFont(g, '靶場', 200, 76); g.fillText('靶場', 40, h / 2 + 2);
    g.font = `700 44px ${COND}`; g.fillText('RANGE', 222, h / 2 + 4);
    g.beginPath(); g.moveTo(400, 40); g.lineTo(460, h / 2); g.lineTo(400, h - 40); g.lineTo(400, h / 2 + 12); g.lineTo(372, h / 2 + 12); g.lineTo(372, h / 2 - 12); g.lineTo(400, h / 2 - 12); g.closePath(); g.fill();
  });
  // 海報：安全第一（四條守則）
  const poster = (k, x, y, title, lines, bg, fg) => reg(k, x, y, 256, 352, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.fillStyle = bg; g.fillRect(0, 0, w, 92);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, title, 220, 52); g.fillText(title, w / 2, 48);
    g.textAlign = 'left'; g.fillStyle = '#23262d';
    lines.forEach((t, i) => {
      const yy = 128 + i * 58; g.fillStyle = bg; g.beginPath(); g.arc(28, yy, 13, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.font = `700 18px ${COND}`; g.textAlign = 'center'; g.fillText(String(i + 1), 28, yy + 1);
      g.textAlign = 'left'; g.fillStyle = '#23262d'; const words = t.split('|');
      words.forEach((s, j) => { fitFont(g, s, 200, 21, 500); g.fillText(s, 50, yy - (words.length - 1) * 12 + j * 24); });
    });
  });
  poster('safe', 512, 176, '安全第一', ['槍口永遠朝|安全的方向', '還不射的時候|手指不要放在扳機上', '把每一把槍|都當作有子彈', '看清楚目標|和後面有什麼'], '#1f5fae', '#ffffff');
  poster('rules', 768, 176, '靶場規則', ['戴耳罩|護目鏡', '只在射擊台前開槍', '槍口保持朝前', '靶倒了|會自己站起來'], '#b3261e', '#ffffff');
  // 子彈架的標籤
  ['手槍子彈', '衝鋒槍子彈', '霰彈', '步槍子彈'].forEach((t, i) => reg('lab' + i, 0, 304 + i * 56, 256, 56, (g, w, h) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, t, 230, 34); g.fillText(t, w / 2, h / 2 + 1);
  }));
  // 射擊台的號碼
  for (let i = 0; i < 3; i++) reg('lane' + i, 256 + i * 80, 304, 80, 80, (g, w, h) => { g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; g.font = `700 64px ${COND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, h / 2 + 3); });
  // 保持槍口朝前（靶場的牆）
  reg('muzzle', 0, 528, 512, 96, (g, w, h) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; for (let x = -40; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 48, h - 16); g.lineTo(x + 24, h - 16); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '保持槍口朝前', 440, 54); g.fillText('保持槍口朝前', w / 2, h / 2 - 6);
  });
  // 門上的貼紙：營業中 OPEN；門口的腳踏墊：歡迎光臨
  reg('open', 512, 528, 256, 96, (g, w, h) => {
    g.fillStyle = '#1d1f23'; g.fillRect(0, 0, w, h); g.fillStyle = '#3ddc84'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '營業中', 150, 44); g.fillText('營業中', 90, h / 2 + 2);
    g.fillStyle = '#f2f3f5'; g.font = `700 40px ${COND}`; g.fillText('OPEN', 196, h / 2 + 3);
  });
  reg('mat', 768, 528, 256, 96, (g, w, h) => {
    g.fillStyle = '#5a1f1c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b36a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#e8c77a'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '歡迎光臨', 210, 50); g.fillText('歡迎光臨', w / 2, h / 2 + 2);
  });
  // 紙靶（櫥窗、牆上）
  reg('paper', 0, 624, 192, 256, (g, w, h) => {
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.46; for (let r = 9; r >= 1; r--) { g.fillStyle = r <= 4 ? '#1d1f23' : '#f3efe4'; g.beginPath(); g.arc(cx, cy, r * 9.5, 0, TAU); g.fill(); g.strokeStyle = r <= 4 ? '#f3efe4' : '#1d1f23'; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = '#ff6a1f'; g.beginPath(); g.arc(cx, cy, 6, 0, TAU); g.fill();
    g.fillStyle = '#1d1f23'; g.font = `700 20px ${COND}`; g.textAlign = 'center'; g.fillText('25 M', cx, h - 20);
  });
  // 員工專區（櫃台後面的門）、禁止吸菸
  reg('staff', 192, 624, 256, 80, (g, w, h) => { g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '員工專區', 220, 44); g.fillText('員工專區', w / 2, h / 2 + 2); });
  reg('nosmoke', 448, 624, 96, 96, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c62f25'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h / 2, 38, 0, TAU); g.stroke();
    g.fillStyle = '#1d1f23'; g.fillRect(22, 44, 46, 10); g.fillStyle = '#c9c4b8'; g.fillRect(68, 44, 8, 10);
    g.beginPath(); g.moveTo(w / 2 - 27, h / 2 - 27); g.lineTo(w / 2 + 27, h / 2 + 27); g.stroke();
  });
  return { c, R };
}
// 地磚（淺米灰 60 公分，2×2 一張）、水泥地、窗外的街景
function paintTiles() {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(31);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const k = 0.94 + r() * 0.08; g.fillStyle = `rgb(${Math.round(214 * k)},${Math.round(208 * k)},${Math.round(196 * k)})`; g.fillRect(i * 128, j * 128, 128, 128);
    for (let s = 0; s < 260; s++) { const q = r(); g.fillStyle = `rgba(${q > 0.5 ? 255 : 90},${q > 0.5 ? 250 : 84},${q > 0.5 ? 240 : 74},${0.05 + r() * 0.07})`; g.fillRect(i * 128 + r() * 128, j * 128 + r() * 128, 1 + r() * 3, 1 + r() * 3); }
  }
  g.fillStyle = 'rgba(96,90,80,0.55)'; for (const p of [0, 127, 128, 255]) { g.fillRect(p, 0, 1, 256); g.fillRect(0, p, 256, 1); }
  return c;
}
function paintConcrete() {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(57);
  g.fillStyle = '#8f8c86'; g.fillRect(0, 0, 256, 256);
  for (let s = 0; s < 2200; s++) { const k = 100 + r() * 80; g.fillStyle = `rgba(${k},${k - 2},${k - 6},${0.08 + r() * 0.12})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 4, 1 + r() * 4); }
  for (let s = 0; s < 14; s++) { g.fillStyle = `rgba(60,58,54,${0.04 + r() * 0.05})`; g.beginPath(); g.arc(r() * 256, r() * 256, 10 + r() * 40, 0, TAU); g.fill(); }
  return c;
}
function paintStreet() { // 對面的店（淡淡的，隔著玻璃看）
  const c = canvas(1024, 256), g = c.getContext('2d'), r = rng(88);
  const sky = g.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, '#8fb6dc'); sky.addColorStop(1, '#d6e4ee'); g.fillStyle = sky; g.fillRect(0, 0, 1024, 140);
  let x = -20; const cols = ['#e8e2d6', '#d9cdb8', '#c9d3d6', '#efe9e0', '#d4c3a8', '#bfc8c2'], signs = [['#f6c343', '#b3261e'], ['#1f5fae', '#fff'], ['#c62f25', '#fff3c4'], ['#2e9a5c', '#fff'], ['#ffffff', '#c62f25']];
  while (x < 1024) {
    const w = 150 + r() * 90, h = 110 + r() * 60, top = 176 - h; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, top, w, h + 10);
    g.fillStyle = 'rgba(40,60,80,0.45)'; for (let i = 0; i < 3; i++) g.fillRect(x + 14 + i * (w - 28) / 3, top + 16, (w - 28) / 3 - 10, 28);
    const s = signs[(r() * signs.length) | 0]; g.fillStyle = s[0]; g.fillRect(x + 8, 128, w - 16, 22); g.fillStyle = s[1]; g.fillRect(x + w * 0.3, 134, w * 0.4, 10);
    g.fillStyle = '#4a4d52'; g.fillRect(x + 6, 150, w - 12, 30); g.fillStyle = 'rgba(255,240,210,0.5)'; g.fillRect(x + 16, 156, w - 32, 20);
    x += w + 4;
  }
  g.fillStyle = '#b9b6ae'; g.fillRect(0, 180, 1024, 14); g.fillStyle = '#56585c'; g.fillRect(0, 194, 1024, 62);
  g.fillStyle = '#e9ebee'; for (let i = 0; i < 1024; i += 90) g.fillRect(i, 226, 50, 4);
  return c;
}
// 軟影子（家具底下、牆腳）：中間黑、邊邊淡掉
function paintShadow() {
  const c = canvas(64, 64), g = c.getContext('2d'), im = g.getImageData(0, 0, 64, 64); // 新的畫布：全部透明
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = Math.max(0, Math.abs(x - 31.5) - 12) / 20, dy = Math.max(0, Math.abs(y - 31.5) - 12) / 20, d = Math.min(1, Math.hypot(dx, dy)), a = (1 - d) * (1 - d);
    const i = (y * 64 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 0; im.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(im, 0, 0); return c;
}
// 鋼靶的正面：白色、頭上一圈橘色
function paintPopper() {
  const c = canvas(128, 256), g = c.getContext('2d');
  g.fillStyle = '#f1efe9'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#ff6a1f'; g.lineWidth = 12; g.beginPath(); g.arc(64, 256 - 0.62 / 0.85 * 256, 26, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(120,118,112,0.25)'; const r = rng(5); for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * 128, r() * 256, 1 + r() * 3, 0, TAU); g.fill(); }
  return c;
}

// ---- 蓋一間 ----
function buildGunShopInterior(o = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const d = o.door || { x: 0, z: 0, ry: 0 };
  const ry = d.ry != null ? +d.ry : d.heading != null ? +d.heading + HP : 0, X0 = +d.x || 0, Z0 = +d.z || 0, cr = Math.cos(ry), sr = Math.sin(ry);
  const name = String(o.name || DEF_NAME), low = o.quality === 'low', doc = hasDoc();
  // 本地 → 世界
  const W = (lx, lz) => [X0 + lx * cr + lz * sr, Z0 - lx * sr + lz * cr];
  const L = (wx, wz, out) => { const dx = wx - X0, dz = wz - Z0; out[0] = dx * cr - dz * sr; out[1] = dx * sr + dz * cr; return out; };
  const H = (lh) => wrapA(lh + ry); // 本地 heading → 世界
  const group = new THREE.Group(); group.name = 'gunshop'; group.position.set(X0, 0, Z0); group.rotation.y = ry;
  const own = []; // 要 dispose 的
  const R = rng(20260928);

  // ---- 材質 ----
  const gm = buildGunModel('pistol'); const MET = gm.children[0].material, GMAT = gm.children[1].material; // 跟手上的槍同一組材質（共用，不 dispose）
  const mats = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }),
    semi: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe6ea, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.35 }), // 斜斜看過去也看得到裡面（反光不要太多）
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  own.push(mats.matte, mats.semi, mats.glass, mats.glow);
  let atlas = null, AR = {};
  if (doc) {
    const A = paintAtlas(name); AR = A.R;
    atlas = tex(A.c, { aniso: 4 }); own.push(atlas);
    mats.atlas = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.55, metalness: 0 });
    mats.lit = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false });
    const tl = tex(paintTiles(), { rep: 1, aniso: 8 }); tl.repeat.set(1 / 1.2, 1 / 1.2); own.push(tl);
    mats.tile = new THREE.MeshStandardMaterial({ map: tl, vertexColors: true, roughness: 0.3, metalness: 0 });
    const cc = tex(paintConcrete(), { rep: 1, aniso: 8 }); cc.repeat.set(1 / 2.5, 1 / 2.5); own.push(cc);
    mats.conc = new THREE.MeshStandardMaterial({ map: cc, vertexColors: true, roughness: 0.9, metalness: 0 });
    const st = tex(paintStreet()); own.push(st);
    mats.street = new THREE.MeshBasicMaterial({ map: st, toneMapped: false, fog: false });
    const sh = new THREE.CanvasTexture(paintShadow()); own.push(sh);
    mats.shadow = new THREE.MeshBasicMaterial({ map: sh, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  } else {
    mats.atlas = mats.lit = mats.tile = mats.conc = mats.matte; mats.street = mats.glow; mats.shadow = null;
  }
  for (const k of ['atlas', 'lit', 'tile', 'conc', 'street', 'shadow']) if (mats[k] && !own.includes(mats[k])) own.push(mats[k]);
  const Bm = bucket(), Bs = bucket(), Bmet = bucket(), Bg = bucket(), Bgl = bucket(), Bglow = bucket(), Ba = bucket(true), Blit = bucket(true), Bt = bucket(true), Bc = bucket(true), Bst = bucket(true), Bsh = bucket(true);
  // 牆腳、天花板邊的暗（頂點色）
  const aoWall = (Hc) => (x, y) => 1 - 0.3 * Math.exp(-y / 0.25) - 0.16 * Math.exp(-(Hc - y) / 0.18);
  const aoLow = (x, y) => 1 - 0.28 * Math.exp(-y / 0.14);
  const shadowQuad = (x0, z0, x1, z1, a = 1) => { if (!mats.shadow) return; const m = 0.25; quad(Bsh, [x0 - m, 0.004, z1 + m], [x1 + m, 0.004, z1 + m], [x1 + m, 0.004, z0 - m], [x0 - m, 0.004, z0 - m], [a, a, a], [0, 0, 1, 1]); };
  const cols = []; // 碰撞（本地）
  const col = (x0, z0, x1, z1, h, y0 = 0, tag) => cols.push({ x0, z0, x1, z1, h, y0, tag });

  // ================= 店面 =================
  // 地板（地磚：uv＝世界公尺）、踢腳板
  const tileUv = (x, y, z) => [x, -z];
  { const g = new THREE.PlaneGeometry(SH.x1 - SH.x0, SH.z1 - SH.z0, 10, 9).rotateX(-HP).translate((SH.x0 + SH.x1) / 2, 0, (SH.z0 + SH.z1) / 2);
    // 地板靠牆的地方暗一點
    put(Bt, g, C('#ffffff'), null, (x, y, z) => 1 - 0.22 * Math.exp(-Math.min(x - SH.x0, SH.x1 - x, z - SH.z0, SH.z1 - z) / 0.5), tileUv); g.dispose(); }
  const wallC = C('#e9e4da'), wainC = C('#3f4a43'), trimC = C('#26282c');
  // 左、右牆（下半部深綠色的護牆板、上面米白色）
  for (const [x, f] of [[SH.x0, 1], [SH.x1, -1]]) {
    const xi = x + (f > 0 ? 0 : 0);
    box(Bm, f > 0 ? x - 0.2 : x, 0, SH.z0 - 0.25, f > 0 ? x : x + 0.2, SH.H, SH.z1 + 0.2, wallC, aoWall(SH.H), 6);
    box(Bs, f > 0 ? xi : xi - 0.03, 0, SH.z0, f > 0 ? xi + 0.03 : xi, 0.95, SH.z1, wainC, aoLow, 3); // 護牆板
    box(Bs, f > 0 ? xi : xi - 0.045, 0.95, SH.z0, f > 0 ? xi + 0.045 : xi, 1.0, SH.z1, trimC); // 護牆板上緣
    col(f > 0 ? x - 0.2 : x, SH.z0 - 0.25, f > 0 ? x + 0.03 : x + 0.2, SH.z1 + 0.2, SH.H);
  }
  // 前面的牆：兩邊櫥窗、中間玻璃門
  { const z = SH.z1, t = 0.2;
    const solid = (x0, x1, y0, y1) => box(Bm, x0, y0, z, x1, y1, z + t, wallC, aoWall(SH.H), 2);
    solid(SH.x0 - 0.2, -4.7, 0, SH.H); solid(-1.1, DOOR.x0, 0, SH.H); solid(DOOR.x1, 1.1, 0, SH.H); solid(4.7, SH.x1 + 0.2, 0, SH.H);
    for (const [a, b] of [[-4.7, -1.1], [1.1, 4.7]]) {
      solid(a, b, 0, 0.55); solid(a, b, 2.55, SH.H); // 窗台、窗楣
      box(Bs, a, 0.55, z - 0.06, b, 0.6, z + 0.02, C('#cfc9bd')); // 窗台板
      box(Bmet, a, 0.55, z + 0.08, b, 0.6, z + 0.12, C('#2b2d31')); box(Bmet, a, 2.5, z + 0.08, b, 2.55, z + 0.12, C('#2b2d31'));
      for (const xx of [a, (a + b) / 2, b]) box(Bmet, xx - 0.025, 0.55, z + 0.08, xx + 0.025, 2.55, z + 0.12, C('#2b2d31'));
      quad(Bgl, [a, 0.6, z + 0.1], [b, 0.6, z + 0.1], [b, 2.5, z + 0.1], [a, 2.5, z + 0.1], [1, 1, 1]);
      // 櫥窗裡面：紙靶、一把長槍的展示架
      const mx = (a + b) / 2;
      box(Bs, mx - 0.9, 0.6, z - 0.42, mx + 0.9, 0.66, z - 0.02, C('#3a2a20'));
      for (const s of [-1, 1]) { const px = mx + s * 0.55; quad(Ba, [px - 0.2, 0.7, z - 0.25], [px + 0.2, 0.7, z - 0.25], [px + 0.2, 1.23, z - 0.25], [px - 0.2, 1.23, z - 0.25], [1, 1, 1], AR.paper); box(Bm, px - 0.015, 0.66, z - 0.27, px + 0.015, 0.72, z - 0.23, C('#26282c')); }
    }
    // 窗外的街景（隔 4 公尺，一片）
    quad(Bst, [SH.x0 - 2, -0.6, z + 4.5], [SH.x1 + 2, -0.6, z + 4.5], [SH.x1 + 2, 5.6, z + 4.5], [SH.x0 - 2, 5.6, z + 4.5], [1, 1, 1], [0, 0, 1, 1]);
    quad(Bm, [SH.x0 - 2, -0.02, z + 4.5], [SH.x1 + 2, -0.02, z + 4.5], [SH.x1 + 2, -0.02, z + 0.2], [SH.x0 - 2, -0.02, z + 0.2], C('#9d9a93')); // 門口外面的地
    solid(DOOR.x0, DOOR.x1, DOOR.h, SH.H); // 門楣
    // 玻璃門（兩片，鋁框）＋「營業中」
    for (const [a, b] of [[DOOR.x0, 0], [0, DOOR.x1]]) {
      quad(Bgl, [a, 0.05, z + 0.1], [b, 0.05, z + 0.1], [b, DOOR.h, z + 0.1], [a, DOOR.h, z + 0.1], [1, 1, 1]);
      for (const [x0, x1] of [[a, a + 0.05], [b - 0.05, b]]) box(Bmet, x0, 0, z + 0.07, x1, DOOR.h, z + 0.13, C('#8b8f96'));
      box(Bmet, a, 0, z + 0.07, b, 0.1, z + 0.13, C('#8b8f96')); box(Bmet, a, DOOR.h - 0.05, z + 0.07, b, DOOR.h, z + 0.13, C('#8b8f96'));
      box(Bmet, (a + b) / 2 + (a < 0 ? 0.28 : -0.28) - 0.012, 0.85, z + 0.02, (a + b) / 2 + (a < 0 ? 0.28 : -0.28) + 0.012, 1.25, z + 0.07, C('#b9bec6')); // 把手
    }
    quad(Ba, [-0.62, 1.42, z + 0.06], [-0.1, 1.42, z + 0.06], [-0.1, 1.62, z + 0.06], [-0.62, 1.62, z + 0.06], [1, 1, 1], AR.open);
    col(SH.x0 - 0.2, z, SH.x1 + 0.2, z + t, SH.H);
  }
  // 腳踏墊
  { const y = 0.012; quad(Ba, [-0.75, y, -0.25], [0.75, y, -0.25], [0.75, y, -1.05], [-0.75, y, -1.05], [0.9, 0.9, 0.9], AR.mat); }
  // 後面的牆（店員那邊＋往靶場的門）
  { const z = SH.z0, t = 0.25;
    box(Bm, SH.x0 - 0.2, 0, z - t, RDOOR.x0, SH.H, z, wallC, aoWall(SH.H), 6);
    box(Bm, RDOOR.x1, 0, z - t, SH.x1 + 0.2, SH.H, z, wallC, aoWall(SH.H), 6);
    box(Bm, RDOOR.x0, RDOOR.h, z - t, RDOOR.x1, SH.H, z, wallC);
    col(SH.x0 - 0.2, z - t, RDOOR.x0, z, SH.H); col(RDOOR.x1, z - t, SH.x1 + 0.2, z, SH.H); col(RDOOR.x0, z - t, RDOOR.x1, z, SH.H, RDOOR.h);
    // 門框（鐵的、厚）、門上的紅牌子
    for (const x of [RDOOR.x0, RDOOR.x1]) box(Bmet, x - 0.06, 0, z - t - 0.02, x + 0.06, RDOOR.h + 0.06, z + 0.04, C('#3b3e44'));
    box(Bmet, RDOOR.x0 - 0.06, RDOOR.h, z - t - 0.02, RDOOR.x1 + 0.06, RDOOR.h + 0.08, z + 0.04, C('#3b3e44'));
    quad(Blit, [RDOOR.x0 - 0.05, 2.45, z + 0.03], [RDOOR.x1 + 0.05, 2.45, z + 0.03], [RDOOR.x1 + 0.05, 2.8, z + 0.03], [RDOOR.x0 - 0.05, 2.8, z + 0.03], [0.95, 0.95, 0.95], AR.rsign);
    box(Bs, RDOOR.x0 - 0.05, 2.43, z + 0.0, RDOOR.x1 + 0.05, 2.82, z + 0.025, C('#1d1f23'));
    // 店員那邊的護牆板、木條牆、長槍（橫放在木栓上）、店名的招牌
    box(Bs, SH.x0, 0, z, PART.x0, 0.95, z + 0.03, wainC, aoLow, 3);
    const slat0 = -4.85, slat1 = 2.3;
    box(Bs, slat0, 0.98, z, slat1, 2.66, z + 0.02, C('#2a1c14'));
    for (let x = slat0 + 0.03; x < slat1 - 0.03; x += 0.1) box(Bs, x, 1.0, z + 0.02, x + 0.072, 2.64, z + 0.05, mul(C('#6b4a32'), 0.85 + R() * 0.25));
    box(Bs, slat0 - 0.04, 2.64, z, slat1 + 0.04, 2.7, z + 0.07, C('#3a2a20')); box(Bs, slat0 - 0.04, 0.95, z, slat1 + 0.04, 1.0, z + 0.07, C('#3a2a20'));
    const RACK = [['rifle', 'shotgun', 'rifle'], ['shotgun', 'rifle', 'smg'], ['smg', 'rifle', 'shotgun'], ['rifle', 'shotgun', 'rifle']];
    RACK.forEach((row, i) => row.forEach((id, j) => {
      const y = 2.34 - i * 0.36, cx = -3.55 + j * 2.3, ud = buildGunModel(id).userData, len = ud.length;
      const gx = cx - len * 0.42; // 槍的原點（握把）放在中間偏左：槍管朝右
      mountGun(id, new THREE.Matrix4().makeTranslation(gx, y, z + 0.1));
      for (const px of [gx - len * 0.28, gx + len * 0.33]) { const pg = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8).rotateX(HP).translate(px, y - 0.055, z + 0.1); put(Bmet, pg, C('#b9bec6')); pg.dispose(); }
    }));
    // 招牌（亮的）＋外框
    box(Bs, -4.45, 2.76, z, 1.95, 3.3, z + 0.05, C('#0e0f12'));
    quad(Blit, [-4.4, 2.8, z + 0.055], [1.9, 2.8, z + 0.055], [1.9, 3.26, z + 0.055], [-4.4, 3.26, z + 0.055], [1, 1, 1], AR.sign);
    // 員工專區的門（櫃台後面左邊）
    box(Bs, -4.95, 0, z, -4.9, 2.2, z + 0.05, C('#3a2a20'));
  }
  // 天花板（燈：六片）
  { const y = SH.H;
    box(Bm, SH.x0, y, SH.z0 - 0.25, SH.x1, y + 0.1, SH.z1 + 0.2, C('#d8d5ce'));
    for (let x = SH.x0 + 0.6; x < SH.x1; x += 0.6) box(Bm, x - 0.01, y - 0.015, SH.z0, x + 0.01, y, SH.z1, C('#bdbab3')); // 輕鋼架
    for (let z = SH.z0 + 0.6; z < SH.z1; z += 0.6) box(Bm, SH.x0, y - 0.015, z - 0.01, SH.x1, y, z + 0.01, C('#bdbab3'));
    for (const lx of [-2.7, 0.3, 3.3]) for (const lz of [-2.1, -6.6]) { box(Bglow, lx - 0.58, y - 0.026, lz - 0.28, lx + 0.58, y - 0.012, lz + 0.28, [1.0, 0.97, 0.9]); box(Bm, lx - 0.63, y - 0.02, lz - 0.33, lx + 0.63, y - 0.004, lz + 0.33, C('#ecebe6')); } // 燈片比外框低一點（從下面看得到亮的那面）
  }

  // ---- 玻璃櫃台（裡面躺著手槍）----
  { const { x0, x1, z0, z1, h } = CNT, fr = C('#2b2d31');
    box(Bs, x0, 0, z0, x1, 0.32, z1, C('#3a2a20'), aoLow, 2); box(Bm, x0 + 0.03, 0, z1 - 0.06, x1 - 0.03, 0.08, z1 + 0.005, C('#141416')); // 木頭底座、踢腳
    box(Bs, x0 + 0.02, 0.32, z0 + 0.02, x1 - 0.02, 0.35, z1 - 0.02, C('#5a1a1e')); // 絨布
    box(Bs, x0 + 0.02, 0.63, z0 + 0.06, x1 - 0.02, 0.64, z1 - 0.06, C('#b8d4d8')); // 中間的玻璃層板（亮一點當反光）
    // 鋁框：12 條邊＋每 1.5 公尺一根
    const e = 0.022;
    for (const [ya, yb] of [[0.32, 0.32 + e], [h - e, h]]) { box(Bmet, x0, ya, z1 - e, x1, yb, z1, fr); box(Bmet, x0, ya, z0, x1, yb, z0 + e, fr); box(Bmet, x0, ya, z0, x0 + e, yb, z1, fr); box(Bmet, x1 - e, ya, z0, x1, yb, z1, fr); }
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 4) { box(Bmet, x - e / 2, 0.32, z1 - e, x + e / 2, h, z1, fr); box(Bmet, x - e / 2, 0.32, z0, x + e / 2, h, z0 + e, fr); }
    // 玻璃（正面、上面、兩邊、後面）
    quad(Bgl, [x0, 0.34, z1], [x1, 0.34, z1], [x1, h, z1], [x0, h, z1], [1, 1, 1]); quad(Bgl, [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [1, 1, 1]);
    quad(Bgl, [x1, 0.34, z0], [x0, 0.34, z0], [x0, h, z0], [x1, h, z0], [1, 1, 1]);
    quad(Bgl, [x0, 0.34, z0], [x0, 0.34, z1], [x0, h, z1], [x0, h, z0], [1, 1, 1]); quad(Bgl, [x1, 0.34, z1], [x1, 0.34, z0], [x1, h, z0], [x1, h, z1], [1, 1, 1]);
    box(Bglow, x0 + 0.05, h - 0.035, z1 - 0.07, x1 - 0.05, h - 0.022, z1 - 0.05, [1, 0.95, 0.85]); // 燈條
    // 手槍：下層六把、上層四把（右邊朝上、槍管斜斜的）＋白色的價錢牌
    const lie = (id, x, y, zc, a) => { const m = new THREE.Matrix4().makeTranslation(x, y, zc).multiply(_m.makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationX(-HP)); mountGun(id, m); box(Bs, x - 0.04, y - 0.012, zc + 0.13, x + 0.04, y + 0.002, zc + 0.16, C('#f2f3f5')); };
    for (let i = 0; i < 6; i++) lie('pistol', x0 + 0.5 + i * 1.0, 0.36, (z0 + z1) / 2 - 0.02, 0.35 + (i % 2) * 0.25);
    for (let i = 0; i < 4; i++) lie(i === 2 ? 'smg' : 'pistol', x0 + 0.9 + i * 1.45, 0.655, (z0 + z1) / 2 - 0.04, i === 2 ? 0.05 : 0.2);
    // 上面：收銀機、腳踏的橡膠墊、鈴
    box(Bm, -4.05, h, -5.25, -3.5, h + 0.12, -4.85, C('#1d1f23')); box(Bm, -3.95, h + 0.12, -5.2, -3.62, h + 0.3, -5.12, C('#26282c')); box(Bglow, -3.92, h + 0.16, -5.12, -3.65, h + 0.27, -5.115, [0.35, 0.9, 0.55]);
    box(Bs, -1.9, h, -5.3, -0.6, h + 0.008, -4.8, C('#2f3a33'));
    cyl(Bmet, 0.045, h, h + 0.035, 0.9, -5.0, C('#c9a24a'), 12); cyl(Bmet, 0.008, h + 0.035, h + 0.055, 0.9, -5.0, C('#c9a24a'), 6);
    shadowQuad(x0, z0, x1, z1, 1);
    col(x0, z0, x1, z1, h);
    // 櫃台右邊的小門（關著，擋人）
    box(Bs, x1, 0, -5.12, PART.x0, 0.98, -4.98, C('#3a2a20'), aoLow, 2); col(x1, -5.15, PART.x0, -4.95, 1.0);
  }
  // ---- 長槍櫃（櫃台右邊：玻璃門朝走道，裡面直立的步槍、霰彈槍）----
  { const { x0, x1, z0, z1 } = PART, hh = 2.2;
    box(Bs, x0, 0, z0, x1, 0.3, z1, C('#2c2f33'), aoLow, 2); box(Bs, x0, hh - 0.12, z0, x1, hh, z1, C('#2c2f33')); box(Bs, x0, 0.3, z0, x0 + 0.04, hh, z1, C('#3a3d42'));
    box(Bs, x0, 0.3, z0, x1, hh, z0 + 0.04, C('#2c2f33')); box(Bs, x0, 0.3, z1 - 0.04, x1, hh, z1, C('#2c2f33'));
    box(Bs, x0 + 0.04, 0.3, z0 + 0.04, x0 + 0.06, hh - 0.12, z1 - 0.04, C('#5a1a1e')); // 裡面的絨布
    quad(Bgl, [x1, 0.3, z1], [x1, 0.3, z0], [x1, hh - 0.12, z0], [x1, hh - 0.12, z1], [1, 1, 1]);
    for (let z = z0 + 0.04; z <= z1; z += (z1 - z0 - 0.08) / 3) box(Bmet, x1 - 0.02, 0.3, z - 0.015, x1 + 0.005, hh - 0.12, z + 0.015, C('#2b2d31'));
    box(Bglow, x0 + 0.08, hh - 0.14, z0 + 0.1, x0 + 0.1, hh - 0.13, z1 - 0.1, [1, 0.95, 0.85]);
    const ids = ['rifle', 'shotgun', 'rifle', 'shotgun', 'rifle', 'shotgun'];
    ids.forEach((id, i) => { const z = z0 + 0.45 + i * ((z1 - z0 - 0.9) / (ids.length - 1)), ud = buildGunModel(id).userData;
      const m = new THREE.Matrix4().makeTranslation((x0 + x1) / 2 + 0.02, 0.34 - ud.butt.x, z).multiply(_m.makeRotationY(HP)).multiply(new THREE.Matrix4().makeRotationZ(HP)); mountGun(id, m); });
    // 背面（朝店員那邊，客人斜斜看得到）：跟後牆一樣的木條牆，掛手槍、衝鋒槍（不要一大片黑的）
    box(Bs, x0 - 0.02, 0.3, z0 + 0.04, x0, hh - 0.12, z1 - 0.04, C('#2a1c14'));
    for (let z = z0 + 0.07; z < z1 - 0.1; z += 0.1) box(Bs, x0 - 0.05, 0.34, z, x0 - 0.02, hh - 0.16, z + 0.072, mul(C('#6b4a32'), 0.85 + R() * 0.25));
    [['pistol', 'smg'], ['smg', 'pistol'], ['pistol', 'pistol']].forEach((row, i) => row.forEach((id, j) => {
      const y = 1.78 - i * 0.42, zc = j ? -6.15 : -7.95, len = buildGunModel(id).userData.length, gz = zc - len * 0.42;
      mountGun(id, new THREE.Matrix4().makeTranslation(x0 - 0.1, y, gz).multiply(_m.makeRotationY(-HP))); // 槍管朝 +z（店門那邊）、右邊朝店員
      for (const pz of [gz - len * 0.2, gz + len * 0.33]) { const pg = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8).rotateZ(HP).translate(x0 - 0.07, y - 0.05, pz); put(Bmet, pg, C('#b9bec6')); pg.dispose(); }
    }));
    col(x0 - 0.12, z0, x1 + 0.03, z1, hh);
  }
  // ---- 右邊牆：子彈架（四個鐵架、五層，一盒一盒的彩色子彈盒）----
  { const x1 = SH.x1, x0 = x1 - 0.45, units = [[-8.7, -6.85], [-6.75, -4.9], [-4.4, -2.55], [-2.45, -0.6]], hh = 2.1;
    const PAL = [['#2f6b3b', '#e9e4d0'], ['#b3261e', '#f2f3f5'], ['#f2c230', '#1d1f23'], ['#1f5fae', '#f2f3f5'], ['#1d1f23', '#f2c230'], ['#6b4a32', '#e9e4d0'], ['#ff6a1f', '#1d1f23']];
    units.forEach(([za, zb], u) => {
      for (const zz of [za, zb]) box(Bmet, x0, 0, zz - 0.02, x1, hh, zz + 0.02, C('#6d7178'));
      for (let s = 0; s < 5; s++) {
        const y = 0.12 + s * 0.44; box(Bmet, x0, y - 0.02, za, x1, y, zb, C('#8b8f96'));
        if (low && s % 2) continue;
        let z = za + 0.05; const pal = PAL[(u * 5 + s) % PAL.length], bw = s === 0 ? 0.26 : 0.12 + (s % 2) * 0.04, bh = s === 0 ? 0.2 : 0.075 + (s % 3) * 0.015;
        while (z + bw < zb - 0.04) {
          const stack = s === 0 ? 1 : 1 + ((R() * 2.4) | 0);
          for (let k = 0; k < stack; k++) {
            const yb = y + k * bh, dx = 0.18 + R() * 0.12;
            if (s === 0) { box(Bs, x1 - 0.36, yb, z, x1 - 0.04, yb + bh, z + bw, C('#4f5a3a'), aoLow); box(Bmet, x1 - 0.37, yb + bh - 0.03, z + bw * 0.3, x1 - 0.35, yb + bh - 0.01, z + bw * 0.7, C('#26282c')); } // 子彈箱（軍綠鐵箱）
            else { box(Bs, x1 - 0.04 - dx, yb, z, x1 - 0.04, yb + bh - 0.004, z + bw - 0.006, C(pal[0])); box(Bs, x1 - 0.045 - dx, yb + bh * 0.35, z + 0.01, x1 - 0.04 - dx + 0.001, yb + bh * 0.62, z + bw - 0.016, C(pal[1])); }
          }
          z += bw + 0.012;
        }
      }
      if (u < 4) { const zc = (za + zb) / 2, lab = AR['lab' + [0, 3, 1, 2][u]]; if (lab) quad(Ba, [x0 - 0.005, hh + 0.02, zc + 0.5], [x0 - 0.005, hh + 0.02, zc - 0.5], [x0 - 0.005, hh + 0.24, zc - 0.5], [x0 - 0.005, hh + 0.24, zc + 0.5], [1, 1, 1], lab); }
      shadowQuad(x0, za, x1, zb, 0.8);
      col(x0, za - 0.03, x1, zb + 0.03, hh);
    });
  }
  // ---- 左邊牆：洞洞板＋掛著的手槍、衝鋒槍、耳罩；海報 ----
  { const x = SH.x0, z0 = -4.4, z1 = -1.6;
    box(Bs, x + 0.03, 0.95, z0, x + 0.05, 2.55, z1, C('#c9b89a'));
    for (let y = 1.05; y < 2.5; y += 0.1) for (let z = z0 + 0.05; z < z1; z += 0.1) box(Bm, x + 0.05, y - 0.006, z - 0.006, x + 0.052, y + 0.006, z + 0.006, C('#6b604e')); // 洞
    box(Bs, x + 0.02, 0.93, z0 - 0.03, x + 0.07, 0.97, z1 + 0.03, C('#3a2a20')); box(Bs, x + 0.02, 2.53, z0 - 0.03, x + 0.07, 2.57, z1 + 0.03, C('#3a2a20'));
    const hang = [['pistol', 2.25], ['pistol', 1.85], ['smg', 1.4]];
    for (let j = 0; j < 4; j++) hang.forEach(([id, y], i) => {
      const ud = buildGunModel(id).userData, zc = z0 + 0.4 + j * 0.68 + (i === 2 ? 0.1 : 0);
      if (id === 'smg' && j % 2) return;
      const m = new THREE.Matrix4().makeTranslation(x + 0.1, y, zc + ud.length * 0.35).multiply(_m.makeRotationY(HP)); mountGun(id, m);
      const pg = new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6).rotateZ(HP).translate(x + 0.09, y + 0.02, zc + ud.length * 0.35 - 0.04); put(Bmet, pg, C('#b9bec6')); pg.dispose();
    });
    // 耳罩（兩個圓＋一條弧）
    for (const zc of [z0 + 0.35, z0 + 1.2, z0 + 2.2]) {
      const y = 1.1;
      for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.035, 14).rotateZ(HP).translate(x + 0.1, y, zc + s * 0.065); put(Bs, g, C('#26282c')); g.dispose(); }
      const g = new THREE.TorusGeometry(0.075, 0.009, 6, 14, Math.PI).translate(0, 0, 0).rotateY(HP).translate(x + 0.1, y + 0.02, zc); put(Bs, g, C('#ff6a1f')); g.dispose();
    }
    // 海報（安全第一、靶場規則）、紙靶
    quad(Ba, [x + 0.04, 1.25, -1.1], [x + 0.04, 1.25, -0.35], [x + 0.04, 2.3, -0.35], [x + 0.04, 2.3, -1.1], [1, 1, 1], AR.safe);
    quad(Ba, [x + 0.04, 1.25, -6.0], [x + 0.04, 1.25, -5.25], [x + 0.04, 2.3, -5.25], [x + 0.04, 2.3, -6.0], [1, 1, 1], AR.rules);
    quad(Ba, [x + 0.04, 1.3, -7.6], [x + 0.04, 1.3, -7.0], [x + 0.04, 2.1, -7.0], [x + 0.04, 2.1, -7.6], [1, 1, 1], AR.paper);
    // 左後角：保險櫃（深綠色鐵櫃）
    box(Bs, x, 0, -8.95, x + 0.55, 1.75, -8.05, C('#2e4a3a'), aoLow, 3); box(Bmet, x + 0.55, 0.8, -8.6, x + 0.57, 1.0, -8.55, C('#c9a24a')); cyl(Bmet, 0.05, 1.1, 1.12, x + 0.56, -8.3, C('#c9ccd0'), 14);
    shadowQuad(x, -8.95, x + 0.55, -8.05, 0.8); col(x, -8.95, x + 0.55, -8.05, 1.75);
    quad(Ba, [x + 0.04, 2.3, -3.6], [x + 0.04, 2.3, -3.3], [x + 0.04, 2.6, -3.3], [x + 0.04, 2.6, -3.6], [1, 1, 1], AR.nosmoke);
  }
  // 店員那邊的地上：一張高腳椅
  { const cx = -2.6, cz = -6.2; cyl(Bmet, 0.2, 0.72, 0.78, cx, cz, C('#1d1f23'), 14); cyl(Bmet, 0.025, 0.05, 0.72, cx, cz, C('#8b8f96'), 8); cyl(Bmet, 0.22, 0, 0.04, cx, cz, C('#26282c'), 14); }
  // 牆腳的影子（整圈）
  if (mats.shadow) { shadowQuad(SH.x0, SH.z0, SH.x0 + 0.06, SH.z1, 0.7); shadowQuad(SH.x1 - 0.06, SH.z0, SH.x1, SH.z1, 0.7); shadowQuad(SH.x0, SH.z0, SH.x1, SH.z0 + 0.06, 0.7); }

  // ================= 靶場 =================
  { const concUv = (x, y, z) => [x, -z];
    // 地板：射擊台後面的水泥地、前面（靶那邊）深一點
    const g1 = new THREE.PlaneGeometry(RG.x1 - RG.x0, 3.6, 10, 4).rotateX(-HP).translate(0, 0, (BENCH.z0 + RG.z1 + 0.25) / 2 + 0.2); put(Bc, g1, C('#ffffff'), null, (x, y, z) => 1 - 0.22 * Math.exp(-Math.min(x - RG.x0, RG.x1 - x) / 0.5), concUv); g1.dispose();
    const g2 = new THREE.PlaneGeometry(RG.x1 - RG.x0, BENCH.z0 - RG.z0 + 0.4, 10, 12).rotateX(-HP).translate(0, 0, (RG.z0 + BENCH.z0) / 2 - 0.2); put(Bc, g2, C('#7c7870'), null, null, concUv); g2.dispose();
    box(Bm, RDOOR.x0, 0, SH.z0 - 0.25, RDOOR.x1, 0.005, SH.z0, C('#6d7178')); // 門檻
    box(Bs, RG.x0, 0.001, -10.55, RG.x1, 0.004, -10.45, C('#f2c230')); // 黃線
    // 牆：下面水泥磚、上面深灰色的吸音板（一條一條）
    const block = C('#9c9a94'), foam = C('#3a3c40');
    for (const [x, f] of [[RG.x0, 1], [RG.x1, -1]]) {
      box(Bm, f > 0 ? x - 0.2 : x, 0, RG.z0 - 0.2, f > 0 ? x : x + 0.2, RG.H, RG.z1, block, aoWall(RG.H), 6);
      for (let z = RG.z0; z < RG.z1 - 0.3; z += 0.6) box(Bm, f > 0 ? x : x - 0.06, 1.2, z + 0.03, f > 0 ? x + 0.06 : x, RG.H - 0.05, z + 0.57, mul(foam, 0.9 + R() * 0.2));
      box(Bm, f > 0 ? x : x - 0.02, 0, RG.z0, f > 0 ? x + 0.02 : x, 1.2, RG.z1, mul(block, 0.92), aoLow, 3);
      col(f > 0 ? x - 0.2 : x, RG.z0 - 0.2, f > 0 ? x + 0.06 : x + 0.2, RG.z1, RG.H);
    }
    // 後面的土堤（斜的）＋上面的擋板
    { const zb = RG.z0, zf = -25.2, hb = 1.5; const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(zb - zf, 0), new THREE.Vector2(zb - zf, hb), new THREE.Vector2(-0.4, 0.02)].map((v) => new THREE.Vector2(-v.x, v.y)));
      const g = new THREE.ExtrudeGeometry(s, { depth: RG.x1 - RG.x0, bevelEnabled: false }).rotateY(-HP).translate(RG.x1, 0, zf); put(Bm, g, C('#7a644a'), null, (x, y) => 0.8 + 0.25 * (y / hb)); g.dispose();
      box(Bm, RG.x0, 0, zb - 0.2, RG.x1, RG.H, zb, C('#2f3134'), aoWall(RG.H), 4);
      const pg = new THREE.BoxGeometry(RG.x1 - RG.x0, 1.2, 0.04).rotateX(-0.5).translate(0, 2.35, zb + 0.5); put(Bmet, pg, C('#4a4d52')); pg.dispose();
      col(RG.x0, zb - 0.2, RG.x1, zb, RG.H); col(RG.x0, zb, RG.x1, zf + 0.4, 1.0); col(RG.x0, zb, RG.x1, zf - 0.6, 1.4);
    }
    // 跟店面中間的牆（靶場那一面）
    box(Bm, RG.x0, 0, RG.z1 - 0.02, RDOOR.x0, RG.H, RG.z1, block, aoWall(RG.H), 6); box(Bm, RDOOR.x1, 0, RG.z1 - 0.02, RG.x1, RG.H, RG.z1, block, aoWall(RG.H), 6);
    // 天花板＋斜的擋板（子彈打不出去）
    box(Bm, RG.x0, RG.H, RG.z0 - 0.2, RG.x1, RG.H + 0.1, RG.z1, C('#2b2d30'));
    for (let z = -14; z > RG.z0 + 1; z -= 3) { const bg = new THREE.BoxGeometry(RG.x1 - RG.x0, 0.9, 0.05).rotateX(0.6).translate(0, RG.H - 0.38, z); put(Bm, bg, C('#45484d')); bg.dispose(); }
    // 燈：射擊台上面兩條日光燈、靶那邊的投射燈
    for (const x of [-3.3, 0, 3.3]) { box(Bglow, x - 0.9, RG.H - 0.06, -11.05, x + 0.9, RG.H - 0.03, -10.95, [1, 1, 1]); box(Bmet, x - 0.95, RG.H - 0.03, -11.1, x + 0.95, RG.H, -10.9, C('#d9dade')); }
    for (const x of [-3.5, 0, 3.5]) { box(Bmet, x - 0.3, RG.H - 0.35, -15.3, x + 0.3, RG.H - 0.15, -15.1, C('#26282c')); quad(Bglow, [x - 0.26, RG.H - 0.33, -15.32], [x + 0.26, RG.H - 0.33, -15.32], [x + 0.26, RG.H - 0.17, -15.32].map((v) => v), [x - 0.26, RG.H - 0.17, -15.32], [1, 0.98, 0.9]); }
    // 射擊台：一整排（灰色桌面、深色的桌子）＋兩片隔板＋號碼
    const { z0, z1, h } = BENCH;
    box(Bs, RG.x0, 0, z0 + 0.05, RG.x1, h - 0.05, z1, C('#3b3e44'), aoLow, 3);
    box(Bs, RG.x0, h - 0.05, z0, RG.x1, h, z1 + 0.04, C('#8c877d'));
    box(Bs, RG.x0, h - 0.07, z1 + 0.02, RG.x1, h - 0.01, z1 + 0.06, C('#1d1f23'));
    col(RG.x0, z0, RG.x1, z1 + 0.05, h);
    for (const x of [-1.65, 1.65]) { box(Bm, x - 0.03, 0, -12.9, x + 0.03, 1.9, -11.3, C('#4a4d52'), aoWall(1.9), 3); box(Bmet, x - 0.04, 1.9, -12.92, x + 0.04, 1.94, -11.28, C('#26282c')); col(x - 0.04, -12.9, x + 0.04, -11.3, 1.9); }
    [-3.3, 0, 3.3].forEach((x, i) => { const lane = AR['lane' + i]; if (lane) quad(Ba, [x - 0.12, 0.62, z1 + 0.061], [x + 0.12, 0.62, z1 + 0.061], [x + 0.12, 0.86, z1 + 0.061], [x - 0.12, 0.86, z1 + 0.061], [1, 1, 1], lane);
      // 桌上：耳罩、一盒子彈
      box(Bs, x + 0.35, h, -12.6, x + 0.5, h + 0.07, -12.5, C(['#2f6b3b', '#b3261e', '#1f5fae'][i]));
      for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.035, 14).translate(x - 0.45 + s * 0.065, h + 0.03, -12.5); put(Bs, g, C('#26282c')); g.dispose(); }
    });
    // 記分板（吊在射擊台前面的上面）：外框（網格）＋畫面（另外一個會變的貼圖）
    box(Bm, -0.9, 2.1, -13.06, 0.9, 2.94, -13.0, C('#141416'));
    for (const x of [-0.6, 0.6]) box(Bmet, x - 0.015, 2.94, -13.04, x + 0.015, RG.H, -13.02, C('#26282c'));
    col(-0.9, -13.08, 0.9, -12.98, 2.95, 2.08);
    // 「保持槍口朝前」：吊在記分板左邊、面朝射擊的人
    box(Bm, -3.68, 2.14, -13.06, -1.14, 2.7, -13.0, C('#141416'));
    for (const x of [-3.2, -1.6]) box(Bmet, x - 0.015, 2.7, -13.04, x + 0.015, RG.H, -13.02, C('#26282c'));
    quad(Ba, [-3.64, 2.18, -12.995], [-1.18, 2.18, -12.995], [-1.18, 2.66, -12.995], [-3.64, 2.66, -12.995], [1, 1, 1], AR.muzzle);
    // 靶的架子（地上的鐵座＋斜的擋板）
    for (const [tx, tz] of TARGETS) {
      box(Bmet, tx - 0.28, 0, tz - 0.18, tx + 0.28, 0.04, tz + 0.18, C('#3b3e44'));
      box(Bmet, tx - 0.025, 0.04, tz - 0.03, tx + 0.025, HINGE, tz + 0.03, C('#3b3e44'));
      const dg = new THREE.BoxGeometry(0.62, 0.36, 0.03).rotateX(-0.45).translate(tx, 0.17, tz + 0.3); put(Bmet, dg, C('#55585e')); dg.dispose();
      col(tx - 0.31, tz + 0.2, tx + 0.31, tz + 0.42, 0.34);
      shadowQuad(tx - 0.3, tz - 0.2, tx + 0.3, tz + 0.2, 0.8);
    }
  }

  // ---- 展示的槍：併進槍的兩個網格（跟手上的槍同一組材質）----
  function mountGun(id, m) { const g = buildGunModel(id); put(Bmet, g.children[0].geometry, null, m); put(Bg, g.children[1].geometry, null, m); }

  // ---- 做成網格 ----
  const meshes = [
    toMesh(Bm, mats.matte, 'gs-matte'), toMesh(Bs, mats.semi, 'gs-semi'), toMesh(Bmet, MET, 'gs-metal'), toMesh(Bg, GMAT, 'gs-gunmatte'),
    toMesh(Bt, mats.tile, 'gs-tile'), toMesh(Bc, mats.conc, 'gs-concrete'), toMesh(Ba, mats.atlas, 'gs-signs'), toMesh(Blit, mats.lit, 'gs-lit'), toMesh(Bglow, mats.glow, 'gs-lights'),
    toMesh(Bst, mats.street, 'gs-street'), mats.shadow ? toMesh(Bsh, mats.shadow, 'gs-shadows') : null, toMesh(Bgl, mats.glass, 'gs-glass'),
  ].filter(Boolean);
  for (const m of meshes) { group.add(m); own.push(m.geometry); }
  const glassMesh = meshes.find((m) => m.name === 'gs-glass'); if (glassMesh) glassMesh.renderOrder = 2;
  const shMesh = meshes.find((m) => m.name === 'gs-shadows'); if (shMesh) shMesh.renderOrder = 1;

  // ---- 燈（沒有陰影；換房子不會重新編譯 shader：燈的組合跟村子的房子差不多）----
  const hemi = new THREE.HemisphereLight(0xfff3e2, 0x4a4238, 0.9); group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.55); sun.position.set(1.5, 6, 2); sun.target.position.set(-1, 0, -6); group.add(sun, sun.target);
  const p1 = new THREE.PointLight(0xffe6c8, 9, 13, 1.2); p1.position.set(-0.6, 2.9, -4.2); group.add(p1);
  const p2 = new THREE.PointLight(0xeef2ff, 8, 18, 1.1); p2.position.set(0, 2.8, -13.5); group.add(p2);

  // ---- 環境貼圖（槍、金屬才亮）：一個簡單的房間＋亮的天花板燈 ----
  let environment = null;
  if (o.renderer && !low) {
    try {
      const E = new THREE.Scene(), pm = new THREE.PMREMGenerator(o.renderer);
      const room = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), new THREE.MeshBasicMaterial({ color: 0x8a847a, side: THREE.BackSide })); room.position.y = 2; E.add(room);
      const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) });
      for (const x of [-3, 0, 3]) for (const z of [-3, 2]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), lamp); q.rotation.x = HP; q.position.set(x, 3.95, z); E.add(q); }
      const win = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.5, 2.8) })); win.position.set(0, 1.6, 5.95); win.rotation.y = Math.PI; E.add(win);
      environment = pm.fromScene(E, 0.03).texture; pm.dispose();
      E.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); });
      own.push(environment);
    } catch (e) { console.warn('gunshop env', e); environment = null; }
  }

  // ---- 靶（InstancedMesh：正面有貼圖、側邊鐵灰色）----
  const tg = { list: [], mesh: null, dirty: true };
  {
    const s = new THREE.Shape(); // 鋼靶的剪影：下面寬、上面一個圓頭（原點＝軸，在最下面中間）
    s.moveTo(-0.17, 0); s.lineTo(0.17, 0); s.lineTo(0.1, 0.44); s.lineTo(0.05, 0.47);
    s.absarc(0, 0.62, 0.16, -Math.PI * 0.4, Math.PI * 1.4, false); s.lineTo(-0.1, 0.44); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false, curveSegments: 14 }); g.translate(0, 0, -0.008);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.4 + 0.5, uv.getY(i) / 0.85); // 正面：貼圖剛好蓋住
    own.push(g);
    let front = mats.semi, side = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.5, metalness: 0.4 }); own.push(side);
    if (doc) { const t = tex(paintPopper()); own.push(t); front = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 }); own.push(front); }
    tg.mesh = new THREE.InstancedMesh(g, [front, side], TARGETS.length); tg.mesh.name = 'gs-targets'; tg.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tg.mesh.frustumCulled = false;
    group.add(tg.mesh);
    TARGETS.forEach(([x, z], i) => tg.list.push({ i, x, z, a: 0, va: 0, down: false, upT: 0, shake: 0, onHit: null }));
  }
  const M4 = new THREE.Matrix4(), M4b = new THREE.Matrix4();
  function placeTargets() {
    for (const t of tg.list) { M4.makeTranslation(t.x, HINGE, t.z); M4b.makeRotationX(t.a + Math.sin(t.shake * 60) * t.shake * 0.25); M4.multiply(M4b); tg.mesh.setMatrixAt(t.i, M4); }
    tg.mesh.instanceMatrix.needsUpdate = true;
  }
  placeTargets();

  // ---- 記分板（會變的貼圖）----
  const board = { c: null, g: null, t: null, key: '', say: '' };
  if (doc) {
    board.c = canvas(512, 240); board.g = board.c.getContext('2d'); board.t = tex(board.c); own.push(board.t);
    const bm = new THREE.MeshBasicMaterial({ map: board.t, toneMapped: false }); own.push(bm);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.78), bm); q.position.set(0, 2.52, -12.995); q.name = 'gs-board'; group.add(q); own.push(q.geometry);
  }

  // ---- 店員 ----
  let clerk = null, clerkState = 'idle', clerkYaw = -HP;
  if (typeof o.makeCharacter === 'function') {
    try {
      clerk = o.makeCharacter(o.clerkLook || { body: 'm', age: 'adult', height: 1.7, build: 'big', skin: '#c99a74', hair: 'short', hairColor: '#2a2522', top: 'tee', topColor: '#3e4a3c', bottom: 'jeans', bottomColor: '#2b2b2b', shoes: 'sneakers', shoesColor: '#1d1f23', hat: 'cap', hatColor: '#1d1f23', glasses: 'none', mask: false });
      clerk.group.position.set(-0.9, 0, -6.15); clerk.group.rotation.y = clerkYaw; clerk.group.name = 'gs-clerk'; group.add(clerk.group);
    } catch (e) { console.warn('gunshop clerk', e); clerk = null; }
  }

  // ---- 碰撞、區域、出口（世界座標）----
  const colliders = cols.map((c) => { const [x, z] = W((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2); const b = { t: 'box', x, z, hx: (c.x1 - c.x0) / 2, hz: (c.z1 - c.z0) / 2, rot: ry, h: c.h }; if (c.y0) b.y0 = c.y0; return b; });
  const rect = (x0, z0, x1, z1) => { const [x, z] = W((x0 + x1) / 2, (z0 + z1) / 2); return { x, z, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: ry }; };
  const zones = { counter: rect(-3.9, -4.65, 1.5, -3.2), range: rect(RG.x0 + 0.3, -12.1, RG.x1 - 0.3, -10.3), shop: rect(SH.x0, SH.z0, SH.x1, SH.z1), rangeRoom: rect(RG.x0, BENCH.z1, RG.x1, RG.z1 + 0.05) };
  const inR = (r, x, z) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot), s = Math.sin(r.rot); return Math.abs(dx * c - dz * s) <= r.hx && Math.abs(dx * s + dz * c) <= r.hz; };
  const zoneAt = (x, z) => (inR(zones.counter, x, z) ? 'counter' : inR(zones.range, x, z) ? 'range' : inR(zones.rangeRoom, x, z) ? 'rangeRoom' : inR(zones.shop, x, z) ? 'shop' : null);
  const P = (lx, lz, lh) => { const [x, z] = W(lx, lz); return { x, z, heading: H(lh) }; };
  const spawn = P(0, -1.3, HP), outside = P(0, 1.1, -HP);
  const exitDoor = { ...rect(DOOR.x0, -0.62, DOOR.x1, -0.05), to: 'outside', spawn: outside };
  const [dx0, dz0] = W(0, -0.02), doors = [{ x: dx0, z: dz0, ry: wrapA(ry + Math.PI), w: 0.8 }];
  const cornersW = [W(SH.x0 - 0.2, SH.z1 + 0.2), W(SH.x1 + 0.2, SH.z1 + 0.2), W(SH.x0 - 0.2, RG.z0 - 0.2), W(SH.x1 + 0.2, RG.z0 - 0.2)];
  const walkBounds = { x0: Math.min(...cornersW.map((p) => p[0])), x1: Math.max(...cornersW.map((p) => p[0])), z0: Math.min(...cornersW.map((p) => p[1])), z1: Math.max(...cornersW.map((p) => p[1])) };
  const bounds = rect(SH.x0 - 0.2, RG.z0 - 0.2, SH.x1 + 0.2, SH.z1 + 0.2);
  const v3 = (lx, y, lz) => { const [x, z] = W(lx, lz); return [+x.toFixed(3), y, +z.toFixed(3)]; };
  const views = { counter: { pos: v3(0.35, 1.72, -1.55), look: v3(-1.35, 1.2, -6.9), fov: 56 }, range: { pos: v3(4.3, 1.75, -9.9), look: v3(0.2, 0.7, -20), fov: 55 } };

  // ---- 子彈：靶 ----
  const LQ = [0, 0];
  const HEAD_Y = 0.62, HEAD_R = 0.16;
  function raycast(ox, oy, oz, dx, dy, dz, maxT, out) {
    L(ox, oz, LQ); const lx = LQ[0], lz = LQ[1];
    const ldx = dx * cr - dz * sr, ldz = dx * sr + dz * cr; // 方向轉到本地
    if (ldz > -1e-6) return Infinity; // 靶都朝 +z（射的人那邊）：往後射才打得到
    let best = maxT, hit = null;
    for (const t of tg.list) {
      if (t.down || t.a < -0.25) continue;
      const tt = (t.z + 0.009 - lz) / ldz; if (tt <= 0 || tt >= best) continue;
      const hx = lx + ldx * tt - t.x, hy = oy + dy * tt - HINGE;
      let ok = false;
      if (hy >= 0 && hy <= 0.47) ok = Math.abs(hx) <= 0.17 - (0.07 * hy) / 0.44; // 身體（梯形）
      if (!ok) ok = hx * hx + (hy - HEAD_Y) * (hy - HEAD_Y) <= HEAD_R * HEAD_R; // 頭
      if (ok) { best = tt; hit = t; }
    }
    if (!hit) return Infinity;
    out.nx = sr; out.ny = 0; out.nz = cr; out.ref = hit; out.kind = 'target'; out.onHit = hit.onHit;
    return best;
  }
  const fireRule = (x, z) => { L(x, z, LQ); return LQ[1] < RG.z1 + 0.02 ? null : '店裡不可以開槍，去後面的靶場'; };

  // ---- 靶場的一輪 ----
  const RN = { state: 'idle', weapon: null, t: 0, count: 0, hits: 0, total: TARGETS.length, doneT: 0, say: '', lastSec: -1 };
  function knock(t) {
    if (t.down) return;
    t.down = true; t.va = -9; t.shake = 0;
    if (RN.state === 'run') { RN.hits++; if (RN.hits >= RN.total) end(); } else t.upT = RN.state === 'count' ? 0.6 : 2.5;
    drawBoard();
  }
  for (const t of tg.list) t.onHit = () => knock(t);
  function standAll() { for (const t of tg.list) { if (t.down) { t.down = false; t.va = 0; } t.upT = 0; } }
  function start(id) {
    if (RN.state === 'count' || RN.state === 'run') return false;
    RN.state = 'count'; RN.weapon = id && GUNS[id] ? id : null; RN.count = 3; RN.t = 0; RN.hits = 0; RN.say = ''; RN.lastSec = -1;
    standAll(); drawBoard(); return true;
  }
  function end() {
    RN.state = 'done'; RN.doneT = 3.5;
    const res = { weapon: RN.weapon, hits: RN.hits, total: RN.total, time: +RN.t.toFixed(2) };
    drawBoard();
    if (o.onRangeEnd && RN.weapon) try { o.onRangeEnd(res); } catch (e) { console.warn(e); }
    return res;
  }
  function stop() { if (RN.state === 'count' || RN.state === 'run') { RN.state = 'idle'; standAll(); drawBoard(); } }
  function bestOf(id) { const g = o.GAME && o.GAME.guns && o.GAME.guns.range; if (!g || !id) return null; return { best: g.best[id] || 0, time: g.time[id] || null }; }
  function drawBoard() {
    if (!board.g) return;
    const n = RN.weapon ? GUNS[RN.weapon].name : '', sec = Math.floor(RN.t * 10) / 10, cnt = Math.ceil(RN.count);
    const key = `${RN.state}|${n}|${RN.hits}|${RN.state === 'run' ? sec : ''}|${RN.state === 'count' ? cnt : ''}|${RN.say}`;
    if (key === board.key) return; board.key = key;
    const g = board.g, w = 512, h = 240;
    g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#26282c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (RN.state === 'count') {
      g.fillStyle = '#ffb347'; fitFont(g, '準備', 300, 44); g.fillText('準備', w / 2, 52);
      g.fillStyle = '#f2f3f5'; g.font = `700 120px ${COND}`; g.fillText(String(cnt), w / 2, 150);
    } else if (RN.state === 'run' || RN.state === 'done') {
      g.fillStyle = '#9aa1ac'; fitFont(g, `${n}　打倒`, 300, 34); g.fillText(`${n}　打倒`, w * 0.3, 48); g.fillText('時間', w * 0.74, 48);
      g.fillStyle = RN.hits >= RN.total ? '#3ddc84' : '#ffb347'; g.font = `700 92px ${COND}`; g.fillText(`${RN.hits}/${RN.total}`, w * 0.3, 128);
      g.fillStyle = '#f2f3f5'; g.fillText(RN.t.toFixed(1), w * 0.74, 128);
      g.fillStyle = RN.state === 'done' ? '#ffb347' : '#9aa1ac';
      const msg = RN.state === 'done' ? (RN.say || (RN.hits >= RN.total ? '全部打倒！' : '時間到')) : '全部打倒就停';
      fitFont(g, msg, w - 40, 34, 700); g.fillText(msg, w / 2, 200);
    } else {
      g.fillStyle = '#ffb347'; fitFont(g, '靶場', 300, 70); g.fillText('靶場', w / 2, 62);
      g.fillStyle = '#f2f3f5'; fitFont(g, '站在台子前面按「開始練習」', w - 40, 32, 500); g.fillText('站在台子前面按「開始練習」', w / 2, 132);
      g.fillStyle = '#9aa1ac'; fitFont(g, `一輪 ${RN.total} 個靶，全部打倒最快幾秒`, w - 40, 26, 500); g.fillText(`一輪 ${RN.total} 個靶，全部打倒最快幾秒`, w / 2, 178);
      if (RN.say) { g.fillStyle = '#ffb347'; fitFont(g, RN.say, w - 40, 26, 700); g.fillText(RN.say, w / 2, 212); }
    }
    board.t.needsUpdate = true;
  }
  drawBoard();

  // ---- 每一幀 ----
  const PL = [0, 0];
  function update(dt, player) {
    dt = Math.min(0.1, Math.max(0, +dt || 0)); if (!dt) return;
    // 靶：倒下去（彈一下）、站起來
    let moved = false;
    for (const t of tg.list) {
      if (t.down) {
        if (t.a > -1.38 || Math.abs(t.va) > 0.05) { t.va += (-1.38 - t.a) * 160 * dt - t.va * 9 * dt; t.a += t.va * dt; if (t.a < -1.45) { t.a = -1.45; t.va = -t.va * 0.35; } moved = true; }
        if (t.upT > 0) { t.upT -= dt; if (t.upT <= 0) { t.down = false; t.va = 0; } }
      } else if (t.a < 0) { t.a = Math.min(0, t.a + dt * 5.5); moved = true; }
      if (t.shake > 0) { t.shake = Math.max(0, t.shake - dt); moved = true; }
    }
    if (moved) placeTargets();
    // 一輪
    if (RN.state === 'count') { RN.count -= dt; if (RN.count <= 0) { RN.state = 'run'; RN.t = 0; } drawBoard(); }
    else if (RN.state === 'run') { RN.t += dt; if (RN.t >= 30) { RN.t = 30; end(); } else drawBoard(); }
    else if (RN.state === 'done') { RN.doneT -= dt; if (RN.doneT <= 0) { RN.state = 'idle'; standAll(); drawBoard(); } }
    // 店員：轉頭看你（左右 60° 以內）
    if (clerk) {
      let want = -HP;
      if (player && isFinite(player.x)) { L(player.x, player.z, PL); if (PL[1] > -9) { const a = Math.atan2(-(PL[1] - clerk.group.position.z), PL[0] - clerk.group.position.x); want = clamp(wrapA(a + HP), -1.05, 1.05) - HP; } }
      clerkYaw += wrapA(want - clerkYaw) * (1 - Math.exp(-dt * 4)); clerk.group.rotation.y = clerkYaw;
      clerk.update(dt, { speed: 0, state: clerkState });
      if (clerkState === 'wave' && clerk.state === 'idle') clerkState = 'idle';
    }
  }

  const info = { tris: meshes.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0), draws: meshes.length + 2 + (clerk ? 1 : 0), ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) };
  return {
    group, background: new THREE.Color(0xcfd8de), environment, spawn, exitDoor, exits: [exitDoor], doors, colliders, walkBounds, bounds,
    camera: { maxDist: 2.9, ceiling: 3.1, near: 0.08 }, zones, zoneAt, views, fireRule, raycast, name,
    range: {
      start, stop, get state() { return RN.state; }, get hits() { return RN.hits; }, get total() { return RN.total; }, get time() { return RN.t; }, get weapon() { return RN.weapon; },
      say(text) { RN.say = String(text || ''); drawBoard(); }, best: bestOf,
      get targets() { return tg.list.map((t) => ({ x: W(t.x, t.z)[0], z: W(t.x, t.z)[1], y: HINGE + 0.4, down: t.down, a: +t.a.toFixed(2) })); },
    },
    get clerk() { return clerk; }, setClerk(s) { clerkState = s || 'idle'; },
    update, info,
    dispose() {
      group.removeFromParent();
      if (clerk && clerk.dispose) clerk.dispose();
      for (const x of own) if (x && x.dispose) x.dispose();
      tg.mesh.dispose();
    },
  };
}

// ---- 櫃台的買槍畫面（跟改車廠一樣：garage.css 的 .shop、.shop-head、.shop-cash、.shop-msg、.group、.parts、.part）----
const PANEL_CSS = `
.gs .parts{grid-template-columns:1fr}
.gs .part.gs-gun{grid-template-columns:58px minmax(0,1fr) auto;grid-template-areas:"i n h" "i d d" "i s p";padding:10px 12px 11px}
.gs .part .ic{grid-area:i;align-self:center;justify-self:start;display:block;width:54px;height:22px;color:var(--ink)}
.gs .part .ic svg{display:block;width:100%;height:100%;fill:currentColor}
.gs .part.cant .ic{opacity:.55}
.gs .part .st{grid-area:s;display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:5px;align-self:center}
.gs .part .st span{display:inline-flex;align-items:center;gap:5px;font-size:11px;line-height:1.2;color:var(--soft);white-space:nowrap}
.gs .part .st i{display:inline-flex;gap:2px}
.gs .part .st i u{display:block;width:8px;height:5px;border-radius:1px;background:var(--line)}
.gs .part .st i u.on{background:var(--accent)}
.gs .part.on .st i u.on{background:var(--ink)}
.gs .part.gs-ammo{grid-template-columns:58px minmax(0,1fr) auto;grid-template-areas:"i n h" "i d p"}
.gs .part.gs-ammo.dim{cursor:default}
.gs .part.gs-ammo.dim b,.gs .part.gs-ammo.dim .hp{opacity:.55}
.gs .part.gs-ammo.dim .p{color:var(--soft)}
.gs .part .ic.box{width:40px;height:26px}
`;
const AMMO_ICON = '<svg viewBox="0 0 40 26" aria-hidden="true"><rect x="2" y="7" width="36" height="17" rx="2"/><rect x="2" y="3" width="36" height="5" rx="1.5" opacity=".6"/><rect x="8" y="12" width="24" height="6" rx="1" fill="var(--surf)"/></svg>';
function openGunShop(parent, GAME, onBuy, opts = {}) {
  if (!hasDoc() || !parent) return { el: null, refresh() {}, close() {} };
  if (!document.getElementById('gs-style')) { const st = document.createElement('style'); st.id = 'gs-style'; st.textContent = PANEL_CSS; document.head.append(st); }
  const money = opts.money || ((w) => (w >= 10000 ? `${+(w / 10000).toFixed(2)} 億` : `${w.toLocaleString('en-US')} 萬`));
  const name = opts.name || DEF_NAME;
  const el = document.createElement('section'); el.className = 'shop gs'; el.setAttribute('aria-label', name);
  el.innerHTML = '<div class="shop-head"><div class="who"><b></b><span>槍、子彈都在這裡買；後面有靶場可以練習</span></div><button type="button" class="primary gs-leave">離開櫃台</button></div>'
    + '<div class="shop-cash"><span>你的錢</span><b></b></div><p class="shop-msg" role="status" aria-live="polite"></p>'
    + '<div class="group"><h2>槍<small>買了送一個裝滿的彈匣</small></h2><div class="parts gs-guns" role="group" aria-label="槍"></div></div>'
    + '<div class="group"><h2>子彈<small>一盒一盒買，身上帶得下才賣</small></h2><div class="parts gs-ammo-list" role="group" aria-label="子彈"></div></div>'
    + '<p class="note">拿槍：畫面右邊的槍（或按 Q、1–4）。按住「瞄準」拖動看準星，按「開槍」射；子彈打完會自己換彈匣。店裡不可以開槍，後面的靶場可以：全部打倒第一次有獎金。</p>';
  el.querySelector('.who b').textContent = name;
  const cash = el.querySelector('.shop-cash b'), msg = el.querySelector('.shop-msg'), gunsEl = el.querySelector('.gs-guns'), ammoEl = el.querySelector('.gs-ammo-list');
  el.querySelector('.gs-leave').addEventListener('click', () => { if (opts.onClose) opts.onClose(); });
  let armed = null, armT = 0;
  const G = () => GAME.guns || { owned: [], ammo: {}, mag: {} };
  function disarm() { clearTimeout(armT); armed = null; }
  function arm(key) { armed = key; clearTimeout(armT); armT = setTimeout(() => { armed = null; render(); }, 3500); }
  function say(t) { msg.textContent = t || ''; }
  const stat = (label, n) => { const s = document.createElement('span'); s.append(label); const i = document.createElement('i'); for (let k = 0; k < 5; k++) { const u = document.createElement('u'); if (k < n) u.className = 'on'; i.append(u); } s.append(i); return s; };
  function render() {
    cash.textContent = `NT$ ${money(Math.floor(+GAME.money || 0))}`;
    const g = G();
    gunsEl.replaceChildren();
    for (const id of GUN_IDS) {
      const W = GUNS[id], have = g.owned.includes(id), can = (GAME.money || 0) >= W.price, b = document.createElement('button');
      b.type = 'button'; b.className = 'part gs-gun ' + (have ? 'on' : can ? 'can' : 'cant'); b.dataset.id = id; b.setAttribute('aria-pressed', String(have));
      if (armed === 'gun:' + id) b.classList.add('armed');
      const ic = document.createElement('span'); ic.className = 'ic'; ic.innerHTML = GUN_ICONS[id];
      const n = document.createElement('b'); n.textContent = W.name;
      const h = document.createElement('span'); h.className = 'hp'; h.textContent = `${W.mag} 發`;
      const dd = document.createElement('span'); dd.className = 'd'; dd.textContent = have ? `${W.tag} · 身上 ${g.mag[id] || 0} + ${g.ammo[id] || 0} 發（子彈在下面買）` : `${W.tag} · ${W.desc}`;
      const st = document.createElement('span'); st.className = 'st'; st.append(stat('威力', W.stats.power), stat('射速', W.stats.rate), stat('射程', W.stats.range), stat('準度', W.stats.aim));
      const p = document.createElement('span'); p.className = 'p';
      if (have) p.textContent = '已買';
      else p.textContent = armed === 'gun:' + id ? '再按一次' : money(W.price);
      b.append(ic, n, h, dd, st, p);
      b.addEventListener('click', () => buyGun(id));
      gunsEl.append(b);
    }
    ammoEl.replaceChildren();
    for (const id of GUN_IDS) {
      const W = GUNS[id], have = g.owned.includes(id), room = have ? gunShop.ammoRoom(g, id) : 0, can = (GAME.money || 0) >= W.ammo.price, b = document.createElement('button');
      b.type = 'button'; b.className = 'part gs-ammo ' + (!have || room <= 0 ? 'dim cant' : can ? 'can' : 'cant'); b.dataset.id = id;
      if (armed === 'ammo:' + id) b.classList.add('armed');
      const ic = document.createElement('span'); ic.className = 'ic box'; ic.innerHTML = AMMO_ICON;
      const n = document.createElement('b'); n.textContent = `${W.name}子彈`;
      const h = document.createElement('span'); h.className = 'hp'; h.textContent = `一盒 ${W.ammo.count} 發`;
      const dd = document.createElement('span'); dd.className = 'd'; dd.textContent = have ? `身上 ${g.mag[id] || 0} + ${g.ammo[id] || 0} 發（最多帶 ${W.ammo.max}）` : `要先買${W.name}`;
      const p = document.createElement('span'); p.className = 'p'; p.textContent = !have ? '先買槍' : room <= 0 ? '帶滿了' : armed === 'ammo:' + id ? '再按一次' : money(W.ammo.price);
      b.append(ic, n, h, dd, p);
      b.addEventListener('click', () => buyAmmo(id));
      ammoEl.append(b);
    }
  }
  function buyGun(id) {
    const W = GUNS[id], g = G();
    if (g.owned.includes(id)) { disarm(); say(`${W.name}已經買過了：子彈在下面`); render(); return; }
    if ((GAME.money || 0) < W.price) { disarm(); say(`${W.name}要 ${money(W.price)}，還差 ${money(W.price - Math.floor(GAME.money || 0))}：去比賽贏錢`); render(); return; }
    if (armed !== 'gun:' + id) { arm('gun:' + id); say(`${W.name}要 ${money(W.price)}，再按一次就買`); render(); return; }
    disarm();
    const r = gunShop.buyGun(GAME, id); say(r.msg);
    if (r.ok && onBuy) try { onBuy('gun', id, r); } catch (e) { console.warn(e); }
    render();
  }
  function buyAmmo(id) {
    const W = GUNS[id], g = G();
    if (!g.owned.includes(id)) { disarm(); say(`要先買${W.name}才能買它的子彈`); render(); return; }
    if (gunShop.ammoRoom(g, id) <= 0) { disarm(); say(`${W.name}的子彈帶滿了（最多 ${W.ammo.max} 發）`); render(); return; }
    if ((GAME.money || 0) < W.ammo.price) { disarm(); say(`一盒要 ${money(W.ammo.price)}，錢不夠：去比賽贏錢`); render(); return; }
    if (armed !== 'ammo:' + id) { arm('ammo:' + id); say(`${W.name}子彈一盒 ${W.ammo.count} 發 ${money(W.ammo.price)}，再按一次就買（之後每按一次再買一盒）`); render(); return; }
    const r = gunShop.buyAmmo(GAME, id, 1); say(r.msg);
    if (r.ok) { arm('ammo:' + id); if (onBuy) try { onBuy('ammo', id, r); } catch (e) { console.warn(e); } } else disarm();
    render();
  }
  parent.append(el);
  say(opts.hello != null ? opts.hello : Math.floor(GAME.money || 0) >= GUNS.pistol.price || G().owned.length ? '要什麼槍？按一下看價錢，再按一次就買' : '你現在的錢不夠：先去賽道比賽贏獎金，再回來買');
  render();
  return { el, refresh(t) { if (t != null) say(t); render(); }, close() { disarm(); el.remove(); } };
}

return { buildGunShopInterior, openGunShop, gunShopFonts, GUNSHOP_TEXT };
})();
