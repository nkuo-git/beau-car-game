// ---- 內湖（OpenStreetMap）→ 遊戲用的資料 neihu-data.js：node neihu-conv.mjs [檔.osm] [--out neihu-data.js] ----
// Nick 2026-10-04「從西湖站到文德站這一代附近」、「以港墘路 × 內湖路一段為中心」；最後一次：用 neihu3.osm 匯出的整個範圍（不要只切一個圓）
// 地圖資料 © OpenStreetMap 貢獻者（ODbL）：遊戲裡在內湖的時候要顯示「地圖資料 © OpenStreetMap 貢獻者」（neihu.src.js）
// 這個檔只在電腦上跑（不打包）；輸出的 neihu-data.js 才打包進遊戲。換地圖：給另一個 .osm 再跑一次（範圍＝檔裡的 <bounds>；不用改別的）
// 座標：中心點＝(0, 0)；x 往東、z 往南（跟遊戲一樣，北＝−z）；公尺。輸出的數字是公寸（×10 的整數），neihu.js 讀的時候 ÷10
// 做的事：
//   1. 路（車開的）：照等級給寬度（車道、單行道、人行道）、裁到匯出的範圍（長方形，邊外留 8 公尺看得到）、路口（共用的點）、斑馬線、路名牌
//   2. （舊的：西邊沒資料的地方補巷子；neihu3.osm 整個範圍都有資料，不用補了）
//   3. 房子：OSM 的（樓層 building:levels／height，沒有就照種類猜）＋空的地方沿著路補房子（透天厝、公寓、大樓、內科的辦公大樓）
//      一樓臨路：店面；大馬路邊：騎樓（一樓往裡面退、外面一排柱子）；碰撞＝長方形（多邊形拆成幾個盒子）
//   4. 公園、學校、球場、水池、停車場（地面的多邊形）、捷運文湖線高架（港墘、文德、西湖站）、國道高架（只能看）、行道樹
//   5. 範圍的邊：路開出去的地方擺「道路施工」的欄杆（邊外是山：neihu.js 畫）；西北角的環山路二段接到遊戲世界（聯外道路：越野車場的水泥路在村子南邊的口往南直走）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const here = path.dirname(new URL(import.meta.url).pathname);

// ======== 要改的在這裡 ========
const CENTER = { lat: 25.07943, lon: 121.57687 }; // 港墘路 × 內湖路一段（兩條路共用的點）
const SRC_DEFAULT = path.join(here, 'data/neihu3.osm.gz'); // repo 裡存壓縮過的（20 MB → 1 MB）；.osm、.osm.gz 都讀得懂
// 遊戲世界裡：資料範圍（匯出的長方形）的西北角放在世界的這一點（Nick 2026-10-05「去內湖的路太遠了 可以大概三四百公尺遠就好」）
//   越野車場（圍籬 z 76…196）南邊、小村莊東南邊：北邊留 130 公尺一道矮山脊（擋住往村子、賽道那邊看的東西），西北角離村子南邊的口（x −112、z 94）約 350 公尺的聯外道路
const BOX_AT = [0, 330];
// 入口：從範圍西邊進來的這條路接聯外道路（西北角，離村子最近；開到港墘站走環山路二段 → 港墘路 → 內湖路一段，都是大路）
const ENTRY_ROAD = '環山路二段';
const EDGE = 3; // 開得到的範圍＝匯出的長方形往裡面縮幾公尺（邊上一圈綠籬、路上施工欄杆）
// 山（金面山）：範圍外面一圈（neihu.js 照 box 畫），這裡沒有山腳線了；舊的資料格式要 foot：給空的
// ==============================

const args = process.argv.slice(2);
const SRC = args.find((a) => !a.startsWith('--') && /\.osm(\.gz)?$/.test(a)) || SRC_DEFAULT;
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, 'neihu-data.js');
const T0 = Date.now();

// ---- 小工具 ----
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hr = (s, k = 0) => (hash(s + ':' + k) % 100000) / 100000; // 照 id 固定的亂數 0–1
const area = (P) => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return a / 2; }; // x 東、z 南：從上面看逆時針＝負（跟 three.js 從上面看的一樣要注意）
const centroid = (P) => { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; };
function inPoly(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segD2(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = clamp(t, 0, 1); const ex = ax + dx * t - px, ez = az + dz * t - pz; return ex * ex + ez * ez; }
function dp(P, eps, keep) { // Douglas–Peucker；keep(i) 一定要留
  if (P.length <= 2) return P.slice();
  const mark = new Uint8Array(P.length); mark[0] = mark[P.length - 1] = 1;
  for (let i = 0; i < P.length; i++) if (keep && keep(i)) mark[i] = 1;
  const rec = (a, b) => { let bi = -1, bd = eps * eps; for (let i = a + 1; i < b; i++) { const d = segD2(P[i][0], P[i][1], P[a][0], P[a][1], P[b][0], P[b][1]); if (d > bd) { bd = d; bi = i; } } if (bi >= 0) { mark[bi] = 1; rec(a, bi); rec(bi, b); } };
  let a = 0; for (let i = 1; i < P.length; i++) if (mark[i]) { rec(a, i); a = i; }
  return P.filter((_, i) => mark[i]);
}
const q = (v) => Math.round(v * 10); // 公寸

// ---- 讀 OSM ----
const xml = SRC.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(SRC)).toString('utf8') : fs.readFileSync(SRC, 'utf8');
const NODES = new Map(), WAYS = [], RELS = [];
{
  const re = /<(node|way|relation)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g, at = (a, k) => { const m = a.match(new RegExp(`\\b${k}="([^"]*)"`)); return m && m[1]; };
  const ent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  let m;
  while ((m = re.exec(xml))) {
    const [, t, a, , body = ''] = m, id = at(a, 'id'), tags = {};
    for (const x of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[ent(x[1])] = ent(x[2]);
    if (t === 'node') NODES.set(id, { lat: +at(a, 'lat'), lon: +at(a, 'lon'), tags });
    else if (t === 'way') WAYS.push({ id, nds: [...body.matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]), tags });
    else RELS.push({ id, members: [...body.matchAll(/<member type="(\w+)" ref="(\d+)" role="([^"]*)"/g)].map((x) => ({ type: x[1], ref: x[2], role: x[3] })), tags });
  }
}
const BM = xml.match(/<bounds minlat="([\d.]+)" minlon="([\d.]+)" maxlat="([\d.]+)" maxlon="([\d.]+)"/);
const KX = Math.cos((CENTER.lat * Math.PI) / 180) * 111320, KZ = 110540;
const proj = (lat, lon) => [(lon - CENTER.lon) * KX, -(lat - CENTER.lat) * KZ];
if (!BM) throw new Error('.osm 檔沒有 <bounds>（範圍）');
const BB = (() => { const a = proj(+BM[3], +BM[2]), b = proj(+BM[1], +BM[4]); return { x0: a[0], z0: a[1], x1: b[0], z1: b[1] }; })();
const PT = new Map(); for (const [id, n] of NODES) PT.set(id, proj(n.lat, n.lon));
const wayPts = (w) => w.nds.map((id) => PT.get(id)).filter(Boolean);
const WAYMAP = new Map(WAYS.map((w) => [w.id, w]));
console.log(`OSM: ${NODES.size} nodes, ${WAYS.length} ways, ${RELS.length} relations; data box x ${BB.x0.toFixed(0)}…${BB.x1.toFixed(0)}, z ${BB.z0.toFixed(0)}…${BB.z1.toFixed(0)}`);

// ---- 範圍：匯出的長方形（m＞0 往裡面縮、m＜0 往外放）----
const inData = (x, z, m = 0) => x >= BB.x0 + m && x <= BB.x1 - m && z >= BB.z0 + m && z <= BB.z1 - m;
const edgeD = (x, z) => Math.min(x - BB.x0, BB.x1 - x, z - BB.z0, BB.z1 - z); // 到邊的距離（裡面＞0）
const drivable = (x, z) => inData(x, z, EDGE);

// ---- 路的等級：寬度（兩個方向／單行道）、人行道、小地圖的種類 ----
const RC = { // [雙向寬, 單行寬, 人行道, 等級（越小越大條）]
  trunk: [18, 11, 4, 0], primary: [16, 11, 4, 0], secondary: [14, 10.5, 3.5, 1], secondary_link: [7, 6.5, 2, 2], primary_link: [7, 6.5, 2, 2],
  tertiary: [11, 7.5, 3, 2], tertiary_link: [7, 6, 2, 3], unclassified: [8, 6, 2, 3], residential: [7, 5, 0, 4], living_street: [4.5, 4, 0, 5], service: [4.2, 4, 0, 6],
};
const WIDEN = 1.5; // 第 9 批（路變大）
const roadW = (t) => {
  const c = RC[t.highway]; if (!c) return null;
  const ow = t.oneway === 'yes' || t.oneway === '1' || t.oneway === '-1' || t.junction === 'roundabout';
  let w = ow ? c[1] : c[0];
  const ln = parseInt(t.lanes, 10); if (ln > 0 && ln < 9) w = ow ? ln * 3.3 + 1 : ln * 3.2 + 1.2;
  const wt = parseFloat(t.width); if (wt > 2.5 && wt < 40) w = wt;
  if (t.highway === 'residential' && /弄/.test(t.name || '')) w = Math.min(w, 5.5);
  w *= WIDEN; // 第 9 批（路變大）：車道 ×1.5（人行道不變；中心線不動）
  return { w, sw: c[2], cls: c[3], ow: t.oneway === '-1' ? -1 : ow ? 1 : 0 };
};

// ---- 1. 路：裁到範圍（邊外 8 公尺還看得到，再過去是山）----
const keepRoad = (x, z) => inData(x, z, -8);
const NODE = [], NID = new Map(); // 路的點：[x, z]；OSM id → 第幾個
const nodeOf = (id) => { let i = NID.get(id); if (i == null) { i = NODE.length; NODE.push(PT.get(id).slice()); NID.set(id, i); } return i; };
const newNode = (p) => { NODE.push([p[0], p[1]]); return NODE.length - 1; };
const ROADS = []; // { nm（名字）, w, sw, cls, ow, hw, n: [點], gen（補的）}
const nodeUse = new Map();
const isRoadWay = (w) => { const t = w.tags; if (!t.highway || !RC[t.highway]) return false; if (t.area === 'yes' || +t.layer < 0 || t.tunnel === 'yes' || t.tunnel === 'building_passage') return false; if (t.highway === 'service' && /parking_aisle|drive-through/.test(t.service || '')) return false; if (t.access === 'private' && t.highway === 'service') return false; return true; };
for (const w of WAYS) if (isRoadWay(w)) for (const id of w.nds) nodeUse.set(id, (nodeUse.get(id) || 0) + 1);
for (const w of WAYS) {
  if (!isRoadWay(w)) continue;
  const rw = roadW(w.tags); const ids = w.nds.filter((id) => PT.has(id)); if (ids.length < 2) continue;
  // 一段一段：在範圍裡的點留下，出去的地方切在邊上（二分法找交界）
  const runs = []; let cur = null;
  const edge = (a, b) => { let lo = 0, hi = 1; const ins = keepRoad(a[0], a[1]); for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2, x = a[0] + (b[0] - a[0]) * m, z = a[1] + (b[1] - a[1]) * m; if (keepRoad(x, z) === ins) lo = m; else hi = m; } const m = ins ? lo : hi; return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m]; };
  for (let i = 0; i < ids.length; i++) {
    const p = PT.get(ids[i]), inside = keepRoad(p[0], p[1]);
    if (i > 0) {
      const pp = PT.get(ids[i - 1]), pin = keepRoad(pp[0], pp[1]);
      if (pin && !inside) { cur.push({ p: edge(pp, p), cut: true }); runs.push(cur); cur = null; }
      else if (!pin && inside) cur = [{ p: edge(pp, p), cut: true }];
      else if (!pin && !inside) { // 兩頭都在外面：中間有沒有穿過（短的路不管）
        const L = Math.hypot(p[0] - pp[0], p[1] - pp[1]); let a = -1, b = -1;
        for (let k = 1; k < Math.ceil(L / 4); k++) { const t = (k * 4) / L, x = pp[0] + (p[0] - pp[0]) * t, z = pp[1] + (p[1] - pp[1]) * t; if (keepRoad(x, z)) { if (a < 0) a = t; b = t; } }
        if (a >= 0) { const A = [pp[0] + (p[0] - pp[0]) * a, pp[1] + (p[1] - pp[1]) * a], B = [pp[0] + (p[0] - pp[0]) * b, pp[1] + (p[1] - pp[1]) * b]; runs.push([{ p: edge(pp, A), cut: true }, { p: edge(B, p), cut: true }]); }
      }
    }
    if (inside) { if (!cur) cur = []; cur.push({ id: ids[i] }); }
  }
  if (cur) runs.push(cur);
  for (const run of runs) {
    if (run.length < 2) continue;
    const pts = run.map((r) => (r.id ? PT.get(r.id) : r.p));
    const keep = (i) => !!run[i].id && (nodeUse.get(run[i].id) > 1);
    const simp = dp(pts, 0.6, keep);
    const n = []; let j = 0;
    for (let i = 0; i < pts.length && j < simp.length; i++) if (pts[i] === simp[j]) { n.push(run[i].id ? nodeOf(run[i].id) : newNode(run[i].p)); j++; }
    let L = 0; for (let i = 1; i < n.length; i++) L += Math.hypot(NODE[n[i]][0] - NODE[n[i - 1]][0], NODE[n[i]][1] - NODE[n[i - 1]][1]);
    if (L < 6 || (w.tags.highway === 'service' && L < 25)) continue;
    ROADS.push({ nm: w.tags.name || '', en: w.tags['name:en'] || '', ...rw, hw: w.tags.highway, n, osm: w.id, cut: [run[0].cut ? 1 : 0, run[run.length - 1].cut ? 1 : 0] });
  }
}
console.log(`roads (OSM, clipped): ${ROADS.length}`);

// ---- 資料外面（OSM 檔的邊界外）斷掉的路：照最後一段的方向往外接，接到別條路（T 字路口）或圓的邊 ----
// （匯出的檔只含穿過範圍的路：雙向分開的大路，另一個方向常常在檔的外面斷掉）
function nearRoadSlow(x, z, skip) { let best = null; for (const r of ROADS) { if (r === skip) continue; for (let k = 1; k < r.n.length; k++) { const a = NODE[r.n[k - 1]], b = NODE[r.n[k]], d = Math.sqrt(segD2(x, z, a[0], a[1], b[0], b[1])); if (!best || d - r.w / 2 < best.g) best = { r, k, d, g: d - r.w / 2 }; } } return best; }
{
  const dg = new Map(); for (const r of ROADS) r.n.forEach((ni, i) => dg.set(ni, (dg.get(ni) || 0) + (i === 0 || i === r.n.length - 1 ? 1 : 2)));
  let ext = 0;
  for (const r of ROADS) for (const e of [0, 1]) {
    if (r.cut[e]) continue; const n = r.n, i = e ? n.length - 1 : 0, p = NODE[n[i]]; if (dg.get(n[i]) !== 1 || inData(p[0], p[1], 1)) continue;
    const qq = NODE[n[e ? n.length - 2 : 1]], l = Math.hypot(p[0] - qq[0], p[1] - qq[1]); if (l < 1) continue; const ux = (p[0] - qq[0]) / l, uz = (p[1] - qq[1]) / l;
    let s = 2, end = null, join = null;
    for (; s < 520; s += 2) { const x = p[0] + ux * s, z = p[1] + uz * s; if (!keepRoad(x, z)) { end = [x - ux, z - uz]; break; } const nr = nearRoadSlow(x, z, r); if (nr && nr.g < 0.5 && s > 4) { join = nr; break; } }
    if (!end && !join) continue;
    let ni;
    if (join) { const jr = join.r, a = NODE[jr.n[join.k - 1]], b = NODE[jr.n[join.k]], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, x = p[0] + ux * s, z = p[1] + uz * s, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0.02, 0.98); ni = newNode([a[0] + dx * t, a[1] + dz * t]); jr.n.splice(join.k, 0, ni); }
    else { ni = newNode(end); r.cut[e] = 1; }
    if (e) n.push(ni); else n.unshift(ni);
    ext++;
  }
  console.log(`dead ends outside the data extended: ${ext}`);
}
// ---- 第 9 批（路變大）：地標的房子（圖書館、教會）旁邊那一小段路照舊的寬（路邊局部縮回去，地標原封不動）----
{
  const LMB = [168407498, 371239214], CLR = 0.5, SUB = 10; let nSplit = 0;
  const polys = LMB.map((id) => { const w = WAYMAP.get(String(id)); return w ? wayPts(w).slice(0, -1) : null; }).filter(Boolean);
  const gapOf = (P, a, b) => { let m = 1e9; for (const p of P) m = Math.min(m, Math.sqrt(segD2(p[0], p[1], a[0], a[1], b[0], b[1]))); for (let i = 0; i < P.length; i++) { const c = P[i], d = P[(i + 1) % P.length]; for (const e of [a, b]) m = Math.min(m, Math.sqrt(segD2(e[0], e[1], c[0], c[1], d[0], d[1]))); } return m; }; // 多邊形到路段（中線）的距離
  for (let ri = ROADS.length - 1; ri >= 0; ri--) { const r = ROADS[ri];
    const hitK = (k) => { let g = 1e9; for (const P of polys) g = Math.min(g, gapOf(P, NODE[r.n[k - 1]], NODE[r.n[k]])); return g; };
    let any = false; for (let k = 1; k < r.n.length; k++) if (hitK(k) < r.w / 2 + CLR) any = true;
    if (!any) continue;
    const n2 = [r.n[0]]; for (let k = 1; k < r.n.length; k++) { const a = NODE[r.n[k - 1]], b = NODE[r.n[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.ceil(L / SUB); for (let i = 1; i < m; i++) n2.push(newNode([a[0] + ((b[0] - a[0]) * i) / m, a[1] + ((b[1] - a[1]) * i) / m])); n2.push(r.n[k]); } // 切成 10 公尺一段
    r.n = n2; let k0 = 1e9, k1 = -1, g = 1e9; for (let k = 1; k < r.n.length; k++) { const gk = hitK(k); if (gk < r.w / 2 + CLR) { k0 = Math.min(k0, k); k1 = Math.max(k1, k); g = Math.min(g, gk); } }
    const nw = Math.max(r.w / WIDEN, 2 * (g - CLR)), mk = (n, cut) => ({ ...r, n, cut }), out = [];
    if (k0 > 1) out.push(mk(r.n.slice(0, k0), [r.cut[0], 0]));
    out.push({ ...mk(r.n.slice(k0 - 1, k1 + 1), [k0 > 1 ? 0 : r.cut[0], k1 < r.n.length - 1 ? 0 : r.cut[1]]), w: nw });
    if (k1 < r.n.length - 1) out.push(mk(r.n.slice(k1), [0, r.cut[1]]));
    ROADS.splice(ri, 1, ...out); nSplit++;
    console.log(`  ${r.nm || r.hw}: ${(r.w).toFixed(1)} → ${nw.toFixed(1)} m 一小段（${k1 - k0 + 1} 段 × ≤${SUB} m，地標旁邊）`);
  }
  console.log(`landmark clearance: ${nSplit} roads narrowed locally`);
}
// ---- 西邊的入口：ENTRY_ROAD（沒有就最大條的路）穿過範圍西邊的地方 → 接遊戲世界 ----
const westEnd = (p) => p[0] < BB.x0 + 2; // 切在西邊的邊上（外面 8 公尺）
function entryOf(name) {
  let best = null;
  for (const r of ROADS) for (const e of [0, r.n.length - 1]) {
    const p = NODE[r.n[e]]; if (!r.cut[e ? 1 : 0] || !westEnd(p)) continue;
    const sc = (r.nm === name ? 0 : 100) + r.cls * 10 + Math.abs(p[1] - (BB.z0 + BB.z1) / 2) / 100; if (!best || sc < best.sc) best = { sc, r, e, p };
  }
  return best;
}
// 同名的另一個方向（雙向分開的路）也接上：找另一條同名、端點也在西邊邊界的路
const entsOf = (ENT) => { const L = ROADS.flatMap((r) => [0, r.n.length - 1].filter((e) => r.cut[e ? 1 : 0] && r.nm === ENT.r.nm && r.nm && westEnd(NODE[r.n[e]]) && Math.hypot(NODE[r.n[e]][0] - ENT.p[0], NODE[r.n[e]][1] - ENT.p[1]) < 60).map((e) => ({ r, e, p: NODE[r.n[e]] }))); if (!L.length) L.push(ENT); return L; };
const ENT = entryOf(ENTRY_ROAD);
if (!ENT) throw new Error('找不到西邊的入口（大條的路穿過範圍的西邊）');
const ENTS = entsOf(ENT);
const EP = centroid(ENTS.map((e) => e.p)); // 入口中間
// 補房子（placeAlong）的「資料外面的辦公大樓」那條舊規則照以前的入口（內湖路一段）算：入口換了，補的房子、亂數還是一模一樣（v21 的街景不變）
const EP_OLD = (() => { const e = entryOf('內湖路一段'); return e ? centroid(entsOf(e).map((x) => x.p)) : EP; })();
// 世界座標：中心放哪裡（範圍的西北角在世界的 BOX_AT）
const AT = { x: BOX_AT[0] - BB.x0, z: BOX_AT[1] - BB.z0 };
const toLocal = (wx, wz) => [wx - AT.x, wz - AT.z];
console.log(`entry ${ENTS.map((e) => e.r.nm + (e.r.ow ? '(單行)' : '')).join(' + ')} at ${EP.map((v) => v.toFixed(0))}; centre in the game world at (${AT.x.toFixed(0)}, ${AT.z.toFixed(0)})`);
// 入口那幾條路的方向（往圓裡面）
const entDir = (() => { let dx = 0, dz = 0; for (const e of ENTS) { const n = e.r.n, a = NODE[n[e.e]], b = NODE[n[e.e ? n.length - 2 : 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]); dx += (b[0] - a[0]) / l; dz += (b[1] - a[1]) / l; } const l = Math.hypot(dx, dz); return [dx / l, dz / l]; })();

// ---- 路的空間索引（20 公尺一格）----
const SG = 20, sgrid = new Map();
const sgKey = (i, j) => i * 100003 + j;
function indexRoads() {
  sgrid.clear();
  ROADS.forEach((r, ri) => { for (let k = 1; k < r.n.length; k++) { const a = NODE[r.n[k - 1]], b = NODE[r.n[k]], m = r.w / 2 + r.sw + 12; for (let i = Math.floor((Math.min(a[0], b[0]) - m) / SG); i <= Math.floor((Math.max(a[0], b[0]) + m) / SG); i++) for (let j = Math.floor((Math.min(a[1], b[1]) - m) / SG); j <= Math.floor((Math.max(a[1], b[1]) + m) / SG); j++) { const kk = sgKey(i, j); let L = sgrid.get(kk); if (!L) sgrid.set(kk, (L = [])); L.push(ri, k); } } });
}
// 在不在車道上：附近任何一條路，離中線 w/2＋m 以內（nearRoad 找的是「最近的路邊」，不一定是蓋住這一點的那條）
function onLane(x, z, m = 0) {
  const L = sgrid.get(sgKey(Math.floor(x / SG), Math.floor(z / SG))); if (!L) return false;
  for (let i = 0; i < L.length; i += 2) { const r = ROADS[L[i]], k = L[i + 1], a = NODE[r.n[k - 1]], b = NODE[r.n[k]]; if (segD2(x, z, a[0], a[1], b[0], b[1]) < (r.w / 2 + m) ** 2) return true; }
  return false;
}
// 路口（三條路以上）附近：最寬那條的半寬＋人行道＋m 以內（轉彎會切過去）
let JN = null;
function nearJ(x, z, m = 0) {
  if (!JN) { JN = []; const dg = new Map(), jr = new Map(); for (const r of ROADS) r.n.forEach((ni, i) => { dg.set(ni, (dg.get(ni) || 0) + (i === 0 || i === r.n.length - 1 ? 1 : 2)); jr.set(ni, Math.max(jr.get(ni) || 0, r.w / 2 + r.sw)); }); for (const [ni, d] of dg) if (d >= 3) JN.push([NODE[ni][0], NODE[ni][1], jr.get(ni)]); }
  for (const [jx, jz, r] of JN) if ((jx - x) ** 2 + (jz - z) ** 2 < (r + m) ** 2) return true;
  return false;
}
function nearRoad(x, z, filt) { // 最近的路：{ r, k, d（到中線）, gap（到路邊/人行道外緣）, t, px, pz }
  const L = sgrid.get(sgKey(Math.floor(x / SG), Math.floor(z / SG))); if (!L) return null; let best = null;
  for (let i = 0; i < L.length; i += 2) {
    const r = ROADS[L[i]], k = L[i + 1]; if (filt && !filt(r)) continue; const a = NODE[r.n[k - 1]], b = NODE[r.n[k]];
    const d = Math.sqrt(segD2(x, z, a[0], a[1], b[0], b[1])), gap = d - r.w / 2 - r.sw;
    if (!best || gap < best.gap) best = { r, k, d, gap };
  }
  return best;
}

// ---- 2. （舊的）西邊沒資料補巷子：neihu3.osm 整個範圍都有資料，不補了 ----
indexRoads();

// ---- 路口：一個點有幾條路用 ----
const deg = new Uint16Array(NODE.length);
for (const r of ROADS) r.n.forEach((ni, i) => { deg[ni] += i === 0 || i === r.n.length - 1 ? 1 : 2; });

// ---- 佔用格子（1 公尺）：0 空、1 路、2 房子、3 不能蓋（公園、學校、水、球場⋯）、5 範圍外 ----
const GX0 = Math.floor(BB.x0) - 60, GZ0 = Math.floor(BB.z0) - 60, GNX = Math.ceil(BB.x1 - BB.x0) + 120, GNZ = Math.ceil(BB.z1 - BB.z0) + 120, OG = new Uint8Array(GNX * GNZ);
const gi = (x, z) => { const i = Math.floor(x - GX0), j = Math.floor(z - GZ0); return i < 0 || j < 0 || i >= GNX || j >= GNZ ? -1 : j * GNX + i; };
for (let j = 0; j < GNZ; j++) for (let i = 0; i < GNX; i++) { const x = GX0 + i + 0.5, z = GZ0 + j + 0.5; OG[j * GNX + i] = inData(x, z, EDGE + 1) ? 0 : 5; }
function paintPoly(P, code, over = (v) => v === 0) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) { const k = gi(x + 0.5, z + 0.5); if (k >= 0 && over(OG[k]) && inPoly(P, x + 0.5, z + 0.5)) OG[k] = code; }
}
function paintCapsule(a, b, r, code) {
  const x0 = Math.min(a[0], b[0]) - r, x1 = Math.max(a[0], b[0]) + r, z0 = Math.min(a[1], b[1]) - r, z1 = Math.max(a[1], b[1]) + r;
  for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) { const k = gi(x + 0.5, z + 0.5); if (k >= 0 && OG[k] !== 2 && segD2(x + 0.5, z + 0.5, a[0], a[1], b[0], b[1]) <= r * r) OG[k] = code; }
}
for (const r of ROADS) for (let k = 1; k < r.n.length; k++) paintCapsule(NODE[r.n[k - 1]], NODE[r.n[k]], r.w / 2 + r.sw + 0.6, 1);

// ---- 4. 地面的多邊形：公園、學校、球場、水、停車場、廣場、工地 ----
const AREAS = []; // { t, p }
const areaKind = (t) => {
  if (t.natural === 'water' || t.water || t.waterway === 'riverbank' || t.leisure === 'swimming_pool' || t.landuse === 'basin' || t.landuse === 'reservoir') return 'water';
  if (t.leisure === 'pitch') return /basketball|tennis|volleyball|badminton/.test(t.sport || '') ? 'court' : t.surface === 'tartan' ? 'track' : 'pitch';
  if (t.leisure === 'track') return 'track';
  if (t.leisure === 'stadium') return 'pitch';
  if (t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass' || t.landuse === 'recreation_ground' || t.landuse === 'village_green' || t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'scrub' || t.leisure === 'nature_reserve') return 'park';
  if (t.leisure === 'playground') return 'play';
  if (t.amenity === 'school' || t.amenity === 'college' || t.amenity === 'university' || t.amenity === 'kindergarten' || t.landuse === 'education') return 'school';
  if (t.amenity === 'parking' && !t.building && +t.layer >= 0 !== false && t.parking !== 'underground' && t.parking !== 'multi-storey') return 'parking';
  if (t.highway === 'pedestrian' && t.area === 'yes') return 'plaza';
  if (t.landuse === 'construction' || t.landuse === 'brownfield') return 'site';
  return null;
};
const NAMED = []; // 有名字的公園、學校（招牌）
function ringsOfRel(rel) { // multipolygon 的外圈（把一段一段的接起來）
  const segs = rel.members.filter((m) => m.type === 'way' && m.role === 'outer').map((m) => WAYMAP.get(m.ref)).filter(Boolean).map((w) => w.nds.slice());
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    for (let guard = 0; guard < 200 && ring[0] !== ring[ring.length - 1]; guard++) {
      const end = ring[ring.length - 1], i = segs.findIndex((s) => s[0] === end || s[s.length - 1] === end); if (i < 0) break;
      const s = segs.splice(i, 1)[0]; ring = ring.concat(s[0] === end ? s.slice(1) : s.reverse().slice(1));
    }
    if (ring[0] === ring[ring.length - 1]) rings.push(ring.map((id) => PT.get(id)).filter(Boolean));
  }
  return rings;
}
const polyItems = [];
for (const w of WAYS) if (w.nds.length > 3 && w.nds[0] === w.nds[w.nds.length - 1]) polyItems.push({ id: 'w' + w.id, tags: w.tags, rings: [wayPts(w)] });
for (const r of RELS) if (r.tags.type === 'multipolygon') polyItems.push({ id: 'r' + r.id, tags: r.tags, rings: ringsOfRel(r) });
for (const it of polyItems) {
  const k = areaKind(it.tags); if (!k || it.tags.building) continue;
  if (+it.tags.layer < 0) continue;
  for (const ring of it.rings) {
    if (ring.length < 4) continue; const P = ring.slice(0, -1), c = centroid(P);
    if (!P.some((p) => inData(p[0], p[1], -40))) continue;
    if (Math.abs(area(P)) < 12) continue;
    const S = dp(P.concat([P[0]]), 0.4).slice(0, -1); if (S.length < 3) continue;
    AREAS.push({ t: k, p: S, nm: it.tags.name || '' });
    if (k !== 'parking' && k !== 'plaza') paintPoly(S, 3);
    if (it.tags.name && (k === 'park' || k === 'school') && inData(c[0], c[1], 10) && Math.abs(area(S)) > 600) NAMED.push({ t: k, nm: it.tags.name, p: S });
  }
}
console.log(`areas: ${AREAS.length} (${Object.entries(AREAS.reduce((o, a) => ((o[a.t] = (o[a.t] || 0) + 1), o), {})).map(([k, v]) => k + ' ' + v).join(', ')})`);

// ---- 3. 房子（OSM）----
const BLD = []; // { p（多邊形，從上面看順時針＝x 東 z 南的「正面積」）, f（樓）, h（高，公尺）, st（外觀）, e（每一邊：0 牆、1 店面、2 騎樓）, kind, osm, back（圓外：只看）}
const STY = { tileBeige: 0, tileWhite: 1, tileBrick: 2, tilePink: 3, newGrey: 4, office: 5, school: 6, oldGrey: 7, tileGreen: 8, temple: 9, factory: 10 };
const resStyles = [STY.tileBeige, STY.tileWhite, STY.tileBrick, STY.tilePink, STY.oldGrey, STY.tileGreen, STY.tileBeige, STY.tileWhite];
function guessFloors(t, A, key) {
  const lv = parseFloat(t['building:levels']); if (lv > 0 && lv < 60) return Math.round(lv);
  const h = parseFloat(t.height); if (h > 2 && h < 250) return Math.max(1, Math.round((h - 0.6) / 3.2));
  const r = hr(key, 1), b = t.building;
  if (b === 'house' || b === 'detached' || b === 'terrace') return 2 + Math.floor(r * 3);
  if (b === 'garage' || b === 'garages' || b === 'shed' || b === 'roof' || b === 'outbuilding' || b === 'kiosk' || b === 'hut' || b === 'service' || b === 'carport') return 1;
  if (b === 'temple' || t.amenity === 'place_of_worship') return 2 + Math.floor(r * 2);
  if (b === 'school' || b === 'college' || b === 'kindergarten') return 3 + Math.floor(r * 3);
  if (b === 'industrial' || b === 'office' || b === 'commercial') return A > 1500 ? 8 + Math.floor(r * 8) : A > 500 ? 5 + Math.floor(r * 6) : 2 + Math.floor(r * 4);
  if (b === 'apartments') return A > 600 ? 10 + Math.floor(r * 6) : A > 250 ? 6 + Math.floor(r * 6) : 4 + Math.floor(r * 2);
  if (b === 'residential') return A > 500 ? 7 + Math.floor(r * 6) : 4 + Math.floor(r * 2);
  if (b === 'retail' || b === 'supermarket') return 1 + Math.floor(r * 3);
  return A > 800 ? 6 + Math.floor(r * 8) : A > 200 ? 4 + Math.floor(r * 4) : 2 + Math.floor(r * 3);
}
function styleOf(t, f, A, key) {
  const b = t.building, r = hr(key, 2);
  if (b === 'temple' || t.amenity === 'place_of_worship' && b !== 'church') return STY.temple;
  if (b === 'school' || b === 'college' || b === 'kindergarten' || t.amenity === 'school') return STY.school;
  if (b === 'industrial' && f <= 3 && A > 800) return STY.factory;
  if (b === 'office' || b === 'industrial' || b === 'commercial' || b === 'hotel') return f >= 6 ? (r < 0.75 ? STY.office : STY.newGrey) : resStyles[Math.floor(r * resStyles.length)];
  if (f >= 11) return r < 0.6 ? STY.newGrey : resStyles[Math.floor(hr(key, 3) * resStyles.length)];
  return resStyles[Math.floor(r * resStyles.length)];
}
const schoolAreas = AREAS.filter((a) => a.t === 'school');
for (const it of polyItems) {
  const t = it.tags; if (!t.building || t['building:part'] || t.building === 'roof' || t.building === 'construction' || +t.layer < 0) continue;
  if (+t.layer >= 1) continue; // 架高的（捷運站 building=transportation layer=1、天橋）：不從地面蓋上去（會擋路；捷運站另外做）
  for (const ring of it.rings) {
    if (ring.length < 4) continue; let P = dp(ring, 0.35).slice(0, -1); if (P.length < 3) continue;
    let A = area(P); if (Math.abs(A) < 10) continue; if (A > 0) P = P.reverse(); A = Math.abs(A); // 跟補的長方形同一個方向（area() < 0：從上面看、z 往下的畫面上順時針）
    const c = centroid(P); if (!inData(c[0], c[1], 1)) continue; // 範圍外的不要（邊外是山）
    let f = guessFloors(t, A, it.id); const tg = { ...t }; if (!tg.building || tg.building === 'yes') { if (schoolAreas.some((s) => inPoly(s.p, c[0], c[1]))) tg.building = 'school'; }
    if (tg.building === 'school' && !t['building:levels']) f = 3 + Math.floor(hr(it.id, 1) * 3);
    let h = parseFloat(t.height); h = h > 2 && h < 250 ? h : 0;
    BLD.push({ p: P, f, h, st: styleOf(tg, f, A, it.id), kind: tg.building, osm: it.id, back: false });
  }
}
for (const b of BLD) paintPoly(b.p, 2, (v) => v !== 2);
{ // 第 9 批：路變寬，可以退比較多（3→4.5 公尺）才拿掉
  // OSM 的房子蓋到車道上：邊進到車道裡（路的寬度是照車道數估的；資料畫的位置也會差一點）→ 那幾邊往裡面退；退不了（或路中線在多邊形裡）就拿掉
  const laneIn = (x, z) => { const L = sgrid.get(sgKey(Math.floor(x / SG), Math.floor(z / SG))); let m = 0; if (L) for (let i = 0; i < L.length; i += 2) { const r = ROADS[L[i]], k = L[i + 1], a = NODE[r.n[k - 1]], b = NODE[r.n[k]], d = Math.sqrt(segD2(x, z, a[0], a[1], b[0], b[1])); m = Math.max(m, r.w / 2 + 0.3 - d); } return m; }; // 進到車道（＋0.3）多深
  const edgeIn = (P) => P.map((a, j) => { const c = P[(j + 1) % P.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; let m = 0; for (let s2 = 0; s2 <= L; s2 += 1) m = Math.max(m, laneIn(a[0] + ((c[0] - a[0]) * Math.min(s2, L)) / L, a[1] + ((c[1] - a[1]) * Math.min(s2, L)) / L)); return m; });
  const insetBy = (P, d) => { const n = P.length, ln = (i) => { const a = P[i], c = P[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, ox = (c[1] - a[1]) / l, oz = -(c[0] - a[0]) / l; return { a: [a[0] - ox * d[i], a[1] - oz * d[i]], dx: (c[0] - a[0]) / l, dz: (c[1] - a[1]) / l }; }; const out = []; for (let i = 0; i < n; i++) { const A = ln((i + n - 1) % n), B = ln(i), den = A.dx * B.dz - A.dz * B.dx; if (Math.abs(den) < 0.05) { out.push(B.a); continue; } const t = ((B.a[0] - A.a[0]) * B.dz - (B.a[1] - A.a[1]) * B.dx) / den; out.push([A.a[0] + A.dx * t, A.a[1] + A.dz * t]); } return out; };
  let n = 0, fixed = 0;
  for (let i = BLD.length - 1; i >= 0; i--) { const b = BLD[i]; let hit = false; const P = b.p;
    const ei = edgeIn(P), mx = Math.max(...ei);
    if (mx > 0.4) { hit = true;
      if (mx < 3 * WIDEN) { const Q = insetBy(P, ei.map((v) => (v > 0.4 ? v + 0.2 : 0))), a0 = area(P), a1 = area(Q); // 外面＝(dz, −dx)：往裡面退
        if (a1 / a0 > 0.45 && Q.every((q, j) => Math.hypot(q[0] - P[j][0], q[1] - P[j][1]) < 5 * WIDEN) && Math.max(...edgeIn(Q)) <= 0.4) { b.p = Q; hit = false; fixed++; } } }
    for (const r of ROADS) { if (hit) break; for (let k = 1; k < r.n.length && !hit; k++) { const a = NODE[r.n[k - 1]], c = NODE[r.n[k]], L = Math.hypot(c[0] - a[0], c[1] - a[1]); for (let s2 = 0; s2 <= L; s2 += 1.5) { const x = a[0] + ((c[0] - a[0]) * s2) / L, z = a[1] + ((c[1] - a[1]) * s2) / L; if (inPoly(b.p, x, z)) { hit = true; break; } } } }
    if (hit) { BLD.splice(i, 1); n++; } }
  if (n) { OG.fill(0); for (let j = 0; j < GNZ; j++) for (let i = 0; i < GNX; i++) if (!inData(GX0 + i + 0.5, GZ0 + j + 0.5, EDGE + 1)) OG[j * GNX + i] = 5; for (const r of ROADS) for (let k = 1; k < r.n.length; k++) paintCapsule(NODE[r.n[k - 1]], NODE[r.n[k]], r.w / 2 + r.sw + 0.6, 1); for (const a of AREAS) if (a.t !== 'parking' && a.t !== 'plaza') paintPoly(a.p, 3); for (const b of BLD) paintPoly(b.p, 2, (v) => v !== 2); }
  console.log(`OSM buildings into a lane: ${fixed} pulled back, ${n} dropped`);
}
console.log(`buildings (OSM): ${BLD.length}`);

// ---- 補房子：沿著路的兩邊一塊一塊放（空的地方才放）----
const KEJI = polyItems.find((it) => it.tags.landuse === 'industrial' && /內湖科技園區/.test(it.tags.name || '')); // 內科：辦公大樓
const kejiP = KEJI ? KEJI.rings[0] : null;
const isOffice = (x, z) => (kejiP && inPoly(kejiP, x, z)) || (!inData(x, z) && z > EP_OLD[1] + 20 && x < BB.x0);
const rectPts = (cx, cz, ux, uz, hx, hz) => { const vx = -uz, vz = ux; return [[cx - ux * hx - vx * hz, cz - uz * hx - vz * hz], [cx + ux * hx - vx * hz, cz + uz * hx - vz * hz], [cx + ux * hx + vx * hz, cz + uz * hx + vz * hz], [cx - ux * hx + vx * hz, cz - uz * hx + vz * hz]]; };
function rectFree(P, codeOK = 0) { // 長方形裡（縮 0.3）全部是空的
  const c = centroid(P); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  const S = P.map((p) => [c[0] + (p[0] - c[0]) * 0.97, c[1] + (p[1] - c[1]) * 0.97]);
  for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) { if (!inPoly(S, x + 0.5, z + 0.5)) continue; const k = gi(x + 0.5, z + 0.5); if (k < 0 || OG[k] !== codeOK) return false; }
  return true;
}
const FILL = { n: 0 };
function placeAlong(r, side, R0) {
  const P = r.n.map((i) => NODE[i]);
  for (let k = 1; k < P.length; k++) {
    const a = P[k - 1], b = P[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, vx = -uz * side, vz = ux * side; // 往右（side 1）或往左
    let t = 3;
    while (t < L - 4) {
      const mx = a[0] + ux * t, mz = a[1] + uz * t, office = isOffice(mx, mz), main = r.cls <= 2;
      let F, D, f, st, arc = false, set = r.w / 2 + r.sw + 0.4, row = 0, kind;
      if (office && (main || R0() < 0.6)) { F = 26 + R0() * 30; D = 20 + R0() * 16; f = 7 + Math.floor(R0() * 9); st = R0() < 0.75 ? STY.office : STY.newGrey; set += 5; kind = 'office'; }
      else if (main) { F = 12 + R0() * 16; D = 13 + R0() * 7; f = R0() < 0.3 ? 11 + Math.floor(R0() * 5) : 5 + Math.floor(R0() * 6); st = f >= 11 && R0() < 0.6 ? STY.newGrey : resStyles[Math.floor(R0() * resStyles.length)]; arc = r.cls <= 2 && f >= 4; kind = 'apartments'; }
      else if (r.w / WIDEN < 6.2 || R0() < 0.45) { F = 4.4 + R0() * 1.8; D = 11 + R0() * 5; f = 3 + Math.floor(R0() * 3); st = resStyles[Math.floor(R0() * resStyles.length)]; row = 1; kind = 'townhouse'; } // 透天厝
      else { F = 10 + R0() * 8; D = 11 + R0() * 5; f = R0() < 0.7 ? 4 + Math.floor(R0() * 2) : 7 + Math.floor(R0() * 6); st = resStyles[Math.floor(R0() * resStyles.length)]; kind = 'apartments'; }
      if (t + F > L - 3) { F = L - 3 - t; if (F < (row ? 4 : 9)) break; }
      let placed = false;
      for (const dk of [1, 0.75, 0.55]) {
        const d = D * dk; if (d < 8) break;
        const cx = mx + ux * (F / 2) + vx * (set + d / 2), cz = mz + uz * (F / 2) + vz * (set + d / 2);
        if (!inData(cx, cz, EDGE + d / 2 + 2)) continue;
        const Q = rectPts(cx, cz, ux * side, uz * side, F / 2, d / 2); // 第 0 邊＝靠路那邊（臨路）
        // rectPts：第 0 點、第 1 點在 −v（往路那邊）
        if (!rectFree(Q)) continue;
        const near = nearRoad(cx, cz); if (near && near.r !== r && near.gap < d / 2 - 1) continue; // 不要擋到別條路
        const e = [arc ? 2 : (office ? 0 : (R0() < 0.85 ? 1 : 0)), 0, 0, 0];
        BLD.push({ p: Q, f, h: 0, st, kind, gen: 1, e, back: false });
        paintPoly(Q, 2, (v) => v === 0); FILL.n++; placed = true;
        // 後面再一棟（大的街廓裡面）
        if (!office && R0() < 0.75) {
          const d2 = 10 + R0() * 6, gap = 2 + R0() * 3, bx = cx + vx * (d / 2 + gap + d2 / 2), bz = cz + vz * (d / 2 + gap + d2 / 2);
          const Q2 = rectPts(bx, bz, ux * side, uz * side, F / 2, d2 / 2);
          if (inData(bx, bz, EDGE + d2 / 2 + 2) && rectFree(Q2)) { const n2 = nearRoad(bx, bz); if (!n2 || n2.gap > d2 / 2 - 1) { BLD.push({ p: Q2, f: Math.max(3, f - Math.floor(R0() * 3)), h: 0, st: resStyles[Math.floor(R0() * resStyles.length)], kind, gen: 1, e: [0, 0, 0, 0], back: false }); paintPoly(Q2, 2, (v) => v === 0); FILL.n++; } }
        }
        break;
      }
      t += placed ? F + (row ? 0 : office ? 8 + R0() * 8 : R0() < 0.5 ? 0 : 1.5 + R0() * 3) : 2.5;
    }
  }
}
{
  const R0 = rng(4141);
  const order = ROADS.map((r, i) => i).sort((a, b) => ROADS[a].cls - ROADS[b].cls);
  for (const i of order) for (const s of [1, -1]) placeAlong(ROADS[i], s, R0);
}
// （舊的：圓外面一圈補的公寓；現在範圍外是山，不補）
console.log(`buildings filled in: ${FILL.n}; total ${BLD.length}`);

// ---- OSM 房子的一樓：臨路的邊是店面；大馬路邊（人行道寬）退進去做騎樓 ----
for (const b of BLD) {
  if (b.e) continue; const P = b.p, n = P.length; b.e = new Array(n).fill(0);
  if (b.back || b.st === STY.office || b.st === STY.school || b.st === STY.temple || b.st === STY.factory || b.f < 2) continue;
  for (let i = 0; i < n; i++) {
    const a = P[i], c = P[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 4) continue;
    const ox = (c[1] - a[1]) / L, oz = -(c[0] - a[0]) / L; // 從上面看順時針（x 東 z 南）的外面：(dz, −dx)
    const mx = (a[0] + c[0]) / 2 + ox * 3, mz = (a[1] + c[1]) / 2 + oz * 3, nr = nearRoad(mx, mz); if (!nr || nr.gap > 5) continue;
    const ra = NODE[nr.r.n[nr.k - 1]], rb = NODE[nr.r.n[nr.k]], rl = Math.hypot(rb[0] - ra[0], rb[1] - ra[1]), par = Math.abs(((rb[0] - ra[0]) * (c[0] - a[0]) + (rb[1] - ra[1]) * (c[1] - a[1])) / (rl * L));
    if (par < 0.8) continue; // 跟路差不多平行才算臨路
    const clear = !onLane(a[0], a[1], 0.6) && !onLane(c[0], c[1], 0.6) && !onLane((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0.6) && !nearJ(a[0], a[1], -1) && !nearJ(c[0], c[1], -1); // 騎樓的柱子在邊上：不可以在車道、路口
    b.e[i] = clear && nr.r.cls <= 2 && b.f >= 4 && L >= 7 && (b.kind === 'apartments' || b.kind === 'residential' || b.kind === 'yes' || b.kind === 'commercial' || !b.kind) ? 2 : 1;
  }
}
// 騎樓：那一邊往裡面退 3.2 公尺（一樓的牆、碰撞）；退了以後形狀壞掉就不做
const ARC = 3.2;
function inset(P, e) {
  const n = P.length, L = (i) => { const a = P[i], c = P[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]); const ox = (c[1] - a[1]) / l, oz = -(c[0] - a[0]) / l, d = e[i] === 2 ? ARC : 0; return { a: [a[0] - ox * d, a[1] - oz * d], dx: (c[0] - a[0]) / l, dz: (c[1] - a[1]) / l }; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = L((i + n - 1) % n), B = L(i), den = A.dx * B.dz - A.dz * B.dx;
    if (Math.abs(den) < 0.05) { out.push(B.a); continue; }
    const t = ((B.a[0] - A.a[0]) * B.dz - (B.a[1] - A.a[1]) * B.dx) / den; out.push([A.a[0] + A.dx * t, A.a[1] + A.dz * t]);
  }
  const a0 = area(P), a1 = area(out); if (!(a1 / a0 > 0.45) || out.some((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1]) > ARC * 2.2)) return null;
  return out;
}
let arcN = 0;
for (const b of BLD) if (b.e.includes(2)) { const c = inset(b.p, b.e); if (c) { b.core = c; arcN++; } else b.e = b.e.map((v) => (v === 2 ? 1 : v)); }
console.log(`arcades (騎樓): ${arcN}`);

// ---- 碰撞：多邊形拆成盒子（照最長的邊轉正、0.5 公尺一格、一列一列合併）----
function boxesOf(P) {
  const n = P.length; let bi = 0, bl = 0; for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l > bl) { bl = l; bi = i; } }
  const a = P[bi], c = P[(bi + 1) % n], ux = (c[0] - a[0]) / bl, uz = (c[1] - a[1]) / bl, vx = -uz, vz = ux;
  const L = P.map((p) => [(p[0] - a[0]) * ux + (p[1] - a[1]) * uz, (p[0] - a[0]) * vx + (p[1] - a[1]) * vz]);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const p of L) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
  // 幾乎是長方形：一個盒子
  if (Math.abs(area(P)) > 0.9 * (u1 - u0) * (v1 - v0)) return [box(a, ux, uz, vx, vz, u0, u1, v0, v1)];
  let cs = 0.5; if ((u1 - u0) * (v1 - v0) > 6000) cs = 1;
  const nu = Math.ceil((u1 - u0) / cs), nv = Math.ceil((v1 - v0) / cs), cell = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) cell[j * nu + i] = inPoly(L, u0 + (i + 0.5) * cs, v0 + (j + 0.5) * cs) ? 1 : 0;
  const out = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (!cell[j * nu + i]) continue;
    let i1 = i; while (i1 + 1 < nu && cell[j * nu + i1 + 1]) i1++;
    let j1 = j; for (;;) { if (j1 + 1 >= nv) break; let ok = true; for (let k = i; k <= i1; k++) if (!cell[(j1 + 1) * nu + k]) { ok = false; break; } if (!ok) break; j1++; }
    for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) cell[jj * nu + k] = 0;
    const w = (i1 - i + 1) * cs, d = (j1 - j + 1) * cs; if (w < 0.6 || d < 0.6) continue;
    out.push(box(a, ux, uz, vx, vz, u0 + i * cs, u0 + (i1 + 1) * cs, v0 + j * cs, v0 + (j1 + 1) * cs));
  }
  out.sort((p, q2) => q2[2] * q2[3] - p[2] * p[3]);
  return out.slice(0, 14);
}
function box(a, ux, uz, vx, vz, u0, u1, v0, v1) { const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; return [a[0] + ux * cu + vx * cv, a[1] + uz * cu + vz * cv, (u1 - u0) / 2, (v1 - v0) / 2, Math.atan2(-uz, ux)]; } // [x, z, hx, hz, rot（rotation.y：+x 轉到 u）]
let colN = 0;
for (const b of BLD) { if (b.back) continue; b.col = boxesOf(b.core || b.p); colN += b.col.length; }
console.log(`building colliders: ${colN} boxes`);

// ---- 捷運文湖線（高架）、國道（高架，只能看）----
const ELEV = []; // { k: 'mrt' | 'hwy', p: [[x, z]], y（橋面）, w }
{
  const mrt = WAYS.filter((w) => w.tags.railway === 'subway' && w.tags.bridge === 'viaduct' && !w.tags.service && /文湖/.test(w.tags.name || ''));
  if (mrt.length) {
    // 兩條軌道：最長的那條當基準，往另一條的中間挪
    const A = mrt.map(wayPts).sort((a, b) => b.length - a.length);
    const base = A[0], other = A.slice(1).flat();
    const mid = base.map((p) => { let bd = Infinity, bq = p; for (let i = 1; i < other.length; i++) { const a = other[i - 1], b = other[i]; const d = segD2(p[0], p[1], a[0], a[1], b[0], b[1]); if (d < bd) { bd = d; const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2, 0, 1); bq = [a[0] + dx * t, a[1] + dz * t]; } } return bd < 15 * 15 ? [(p[0] + bq[0]) / 2, (p[1] + bq[1]) / 2] : p; });
    let pts = mid.filter((p) => inData(p[0], p[1], -260)); // 邊外 260 公尺（neihu.js 在山邊收進隧道口）
    // 照方向：從西到東
    if (pts.length > 1 && pts[0][0] > pts[pts.length - 1][0]) pts.reverse();
    pts = dp(pts, 0.5);
    ELEV.push({ k: 'mrt', p: pts, y: 11.5, w: 8.2 });
  }
  for (const w of WAYS) {
    const t = w.tags; if (t.highway !== 'motorway' && t.highway !== 'motorway_link') continue;
    const P = wayPts(w).filter((p) => inData(p[0], p[1], 0)); if (P.length < 2) continue;
    const lay = Math.max(1, +t.layer || 1), ln = parseInt(t.lanes, 10) || (t.highway === 'motorway' ? 3 : 1);
    ELEV.push({ k: 'hwy', p: dp(P, 0.8), y: 7 + lay * 5.5, w: ln * 3.5 + 2.5 });
  }
}
// 橋墩：路面上不要放（路中間的分隔島可以）；30 公尺左右一根，最多 55 公尺
for (const E of ELEV) {
  const P = E.p, piers = []; let acc = 0, last = -999; const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], at = (s) => { let i = 1; while (i < P.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
  const okAt = (p) => { const k = gi(p[0], p[1]); if (k < 0) return false; for (const [dx, dz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) { const kk = gi(p[0] + dx, p[1] + dz); if (kk < 0) return false; if (onLane(p[0] + dx, p[1] + dz, 0.6)) return false; } return !nearJ(p[0], p[1], 0); };
  for (let s = 6; s < L - 4; s += 1) {
    if (s - last < 26) continue;
    const p = at(s); if (okAt(p)) { piers.push(p); last = s; } // 車道、路口上不放（沒地方放就跨長一點）
  }
  E.piers = piers; acc = piers.length;
}
// 車站：照站名（文湖線的站、或同名的停靠點）
const STATIONS = [];
{
  const byName = new Map();
  for (const [id, n] of NODES) { const t = n.tags; if (!t.name || /出入口|出口|入口/.test(t.name)) continue; if (!(t.railway === 'station' || t.railway === 'stop' || t.railway === 'halt' || t.public_transport === 'station' || t.public_transport === 'stop_position') || !(t.subway === 'yes' || t.station === 'subway' || t.railway === 'station' || t.train !== 'yes')) continue; if (t.bus === 'yes' || t.highway === 'bus_stop') continue; const p = PT.get(id); let a = byName.get(t.name); if (!a) byName.set(t.name, (a = { nm: t.name, en: t['name:en'] || '', ps: [] })); a.ps.push(p); }
  const mrt = ELEV.find((e) => e.k === 'mrt');
  for (const s of byName.values()) {
    const c = centroid(s.ps); if (!mrt || !inData(c[0], c[1], 30)) continue;
    // 投影到高架上
    let bd = Infinity, bi = 1, bq = c; for (let i = 1; i < mrt.p.length; i++) { const a = mrt.p[i - 1], b = mrt.p[i], d = segD2(c[0], c[1], a[0], a[1], b[0], b[1]); if (d < bd) { bd = d; bi = i; const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = clamp(((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / l2, 0, 1); bq = [a[0] + dx * t, a[1] + dz * t]; } }
    if (bd > 40 * 40) continue;
    const a = mrt.p[bi - 1], b = mrt.p[bi];
    STATIONS.push({ nm: s.nm, en: s.en, x: bq[0], z: bq[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: 92, w: 22 });
  }
}
// 捷運出入口
const ENTR = [];
for (const [id, n] of NODES) if (n.tags.railway === 'subway_entrance') { const p = PT.get(id); if (inData(p[0], p[1], 10)) { const nr = nearRoad(p[0], p[1]); let ang = 0; if (nr) { const a = NODE[nr.r.n[nr.k - 1]], b = NODE[nr.r.n[nr.k]]; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } ENTR.push({ x: p[0], z: p[1], ang }); } }
// 出入口的盒子不要擋路：往路邊外面推
for (const e of ENTR) { for (let k = 0; k < 20; k++) { const nr = nearRoad(e.x, e.z); if (!nr || nr.d > nr.r.w / 2 + 1.5) break; const a = NODE[nr.r.n[nr.k - 1]], b = NODE[nr.r.n[nr.k]], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); const sd = Math.sign((e.x - a[0]) * -dz + (e.z - a[1]) * dx) || 1; e.x += (-dz / l) * sd * 0.8; e.z += (dx / l) * sd * 0.8; } }
console.log(`elevated: ${ELEV.map((e) => `${e.k} ${e.p.length} pts ${e.piers.length} piers`).join('; ')}; stations: ${STATIONS.map((s) => s.nm).join(', ')}; entrances ${ENTR.length}`);
// 車站、出入口的地方：房子讓開（補的房子不要蓋在站底下）— 已經蓋了的補房子：碰到出入口就拿掉
for (let i = BLD.length - 1; i >= 0; i--) { const b = BLD[i]; if (!b.gen) continue; if (ENTR.some((e) => inPoly(b.p, e.x, e.z) || b.p.some((p) => Math.hypot(p[0] - e.x, p[1] - e.z) < 3))) BLD.splice(i, 1); }

// ---- 斑馬線（OSM 的 crossing 點；大路口每個方向也畫）、路名牌、施工欄杆 ----
const CROSS = []; // [x, z, ang（路的方向）, w（路寬）]
{
  const seen = [];
  const add = (x, z, ang, w) => { if (seen.some((s) => Math.hypot(s[0] - x, s[1] - z) < 6)) return; seen.push([x, z]); CROSS.push([x, z, ang, w]); };
  const crossIds = new Set(); for (const [id, n] of NODES) if (n.tags.highway === 'crossing' || n.tags.crossing) crossIds.add(id);
  const back = new Map(); for (const [id, i] of NID) back.set(i, id);
  for (const r of ROADS) {
    if (r.cls > 3) continue;
    for (let i = 0; i < r.n.length; i++) {
      const ni = r.n[i], id = back.get(ni), p = NODE[ni];
      const isC = id && crossIds.has(id), isJ = deg[ni] >= 3 && r.cls <= 2;
      if (!isC && !isJ) continue; if (!drivable(p[0], p[1])) continue;
      const a = NODE[r.n[Math.max(0, i - 1)]], b = NODE[r.n[Math.min(r.n.length - 1, i + 1)]], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (isC) add(p[0], p[1], ang, r.w);
      else { // 路口：往兩邊退（路口大小）各畫一條
        for (const s of [-1, 1]) { const off = 9 + r.w * 0.3, j = s < 0 ? i - 1 : i + 1; if (j < 0 || j >= r.n.length) continue; const q2 = NODE[r.n[j]], l = Math.hypot(q2[0] - p[0], q2[1] - p[1]); if (l < off + 4) continue; add(p[0] + ((q2[0] - p[0]) / l) * off, p[1] + ((q2[1] - p[1]) / l) * off, ang, r.w); }
      }
    }
  }
}
const SIGNS = []; // 路名牌：[x, z, ang（牌子朝哪個方向：正面）, 名字第幾個]
const NAMES = [];
const nameIdx = (nm, en) => { let i = NAMES.findIndex((n) => n[0] === nm); if (i < 0) { i = NAMES.length; NAMES.push([nm, en || '']); } return i; };
{
  const at = new Map(); // node → 經過的路（有名字）
  for (const r of ROADS) if (r.nm) r.n.forEach((ni, i) => { if (deg[ni] < 3) return; let a = at.get(ni); if (!a) at.set(ni, (a = [])); a.push({ r, i }); });
  const used = [];
  for (const [ni, list] of at) {
    const p = NODE[ni]; if (!drivable(p[0], p[1])) continue;
    const names = [...new Set(list.map((x) => x.r.nm))]; if (names.length < 2) continue; // 兩條不同名字的路交叉的路口
    if (used.some((u) => Math.hypot(u[0] - p[0], u[1] - p[1]) < 35)) continue; used.push(p);
    // 放在路口的一個角：最大條的那條路的右前方
    list.sort((a, b) => a.r.cls - b.r.cls);
    const m = list[0], r = m.r, j = Math.min(r.n.length - 1, m.i + 1), k0 = Math.max(0, m.i - 1), a = NODE[r.n[k0]], b = NODE[r.n[j]], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    // 另一條路寬
    const other = list.find((x) => x.r.nm !== r.nm), ow = other ? other.r.w / 2 + other.r.sw : 4;
    const off = r.w / 2 + (r.sw ? r.sw * 0.7 : 1.2), sx = p[0] - uz * off - ux * (ow + 1.5), sz = p[1] + ux * off - uz * (ow + 1.5);
    const k = gi(sx, sz); if (k < 0 || OG[k] === 2) continue;
    if (onLane(sx, sz, 0.5) || nearJ(sx, sz, -0.5)) continue;
    for (const nm of names.slice(0, 2)) { const rd = list.find((x) => x.r.nm === nm).r, rk = list.find((x) => x.r.nm === nm); const aa = NODE[rd.n[Math.max(0, rk.i - 1)]], bb = NODE[rd.n[Math.min(rd.n.length - 1, rk.i + 1)]]; SIGNS.push([sx, sz, Math.atan2(bb[1] - aa[1], bb[0] - aa[0]), nameIdx(nm, rd.en)]); }
  }
}
// 公園、學校的名字牌：最靠路的那一邊中間（路邊）
const NAMESIGNS = [];
function signAt(P) { // 多邊形最靠路的那一邊：牌子的位置、朝哪邊（null＝找不到路）；第 9 批：放不下（路變寬，壓到別條路）就換次近的那一邊
  const C = [];
  for (let i = 0; i < P.length; i++) { const p = P[i], c = P[(i + 1) % P.length], m = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2], nr = nearRoad(m[0], m[1]); if (nr && Math.hypot(c[0] - p[0], c[1] - p[1]) > 6) C.push({ gap: nr.gap, m, nr }); }
  C.sort((a, b) => a.gap - b.gap);
  for (const best of C.slice(0, 4)) { const s = signAt1(best); if (s) return s; }
  return null;
}
function signAt1(best) {
  if (!best || best.gap > 25 || !drivable(best.m[0], best.m[1])) return null;
  const r = best.nr.r, ra = NODE[r.n[best.nr.k - 1]], rb = NODE[r.n[best.nr.k]], ang = Math.atan2(rb[1] - ra[1], rb[0] - ra[0]);
  // 牌子放在路邊（人行道外面一點），朝路
  const dx = rb[0] - ra[0], dz = rb[1] - ra[1], l = Math.hypot(dx, dz), sd = Math.sign((best.m[0] - ra[0]) * -dz + (best.m[1] - ra[1]) * dx) || 1, off = r.w / 2 + r.sw + 1.6;
  const t = clamp(((best.m[0] - ra[0]) * dx + (best.m[1] - ra[1]) * dz) / (l * l), 0, 1), px = ra[0] + dx * t + (-dz / l) * sd * off, pz = ra[1] + dz * t + (dx / l) * sd * off;
  if (onLane(px, pz, 1) || nearJ(px, pz, 0)) return null; // 別條路上不要
  return [px, pz, ang + (sd > 0 ? Math.PI : 0)];
}
// ---- 七個地標（Nick 2026-10-05「我只需要下面幾個跟實景一樣就好（位置也要正確喔）」）：OSM 的形狀原封不動送出去，外觀 neihu.js 照參考照片手工做 ----
const LMNM = ['碧湖公園', '內湖國小', '麗山國中', '大港墘公園', '西湖分館', '湖光基督教會']; // 這幾個不用一般的公園／學校牌子（地標自己有牌子）
for (const a of NAMED) {
  if (LMNM.includes(a.nm)) continue;
  const s = signAt(a.p); if (!s) continue;
  if (NAMESIGNS.some((x) => x[3] === a.nm)) continue;
  NAMESIGNS.push([s[0], s[1], s[2], a.nm, a.t]);
}
const LM = {};
{
  const wayOf = (id) => { const w = WAYMAP.get(String(id)); return w ? wayPts(w) : null; };
  const ring = (id) => { const P = wayOf(id); return P && P.length > 3 ? P.slice(0, -1) : null; };
  const relRing = (id) => { const r = RELS.find((x) => x.id === String(id)); if (!r) return null; const R = ringsOfRel(r); return R.length ? R[0].slice(0, -1) : null; };
  const bldOf = (id) => BLD.find((b) => b.osm === 'w' + id);
  const fl = (P) => (P ? P.flatMap((p) => [q(p[0]), q(p[1])]) : []);
  const sg = (P, nm) => { const s = P && signAt(P); return s ? [q(s[0]), q(s[1]), Math.round(s[2] * 1000), nm] : null; };
  const parts = {
    bihu: { nm: '碧湖公園', outer: ring(314211284), g: { lake: ring(55038272), islet: ring(330357191), bridge: wayOf(236370956) } }, // 公園、碧湖（內湖大陂）、湖心小島、九曲橋
    nhps: { nm: '臺北市內湖區內湖國民小學', outer: relRing(4790869), g: { track: ring(608277929), pool: ring(608277923), court: ring(608283298) } }, // 校地（圍牆）、操場、游泳池、籃球場
    lishan: { nm: '臺北市立麗山國民中學', outer: relRing(4790962), g: {} },
    dgq: { nm: '大港墘公園', outer: ring(547805172), g: {} },
    lib: { nm: '臺北市立圖書館西湖分館', outer: ring(168407498), g: {}, bld: 168407498 }, // 房子自己畫（一般的房子不要再畫一次）
    church: { nm: '湖光基督教會', outer: ring(371239214), g: {}, bld: 371239214 },
    mrt: { nm: '港墘站', outer: ring(243750311), g: {} }, // 捷運港墘站的站體（layer 2：本來就不當房子蓋）
  };
  for (const [k, v] of Object.entries(parts)) {
    if (!v.outer) { console.log(`landmark ${k}: OSM 的形狀找不到`); continue; }
    const o = { nm: v.nm, p: fl(v.outer) };
    for (const [gk, gp] of Object.entries(v.g)) if (gp) o[gk] = fl(gp);
    const s = sg(v.outer, v.nm); if (s) o.sign = s;
    if (v.bld) { const b = bldOf(v.bld); if (b) b.lm = 1; }
    LM[k] = o;
  }
  console.log(`landmarks: ${Object.entries(LM).map(([k, v]) => k + (v.sign ? '' : '（沒牌子）')).join(', ')}`);
}
// 邊界：路開出圓（或山腳）的地方 → 施工欄杆
const BARS = []; // [x, z, ang（路的方向）, w]
for (const r of ROADS) for (const e of [0, 1]) {
  if (!r.cut[e]) continue; const n = r.n, i = e ? n.length - 1 : 0, p = NODE[n[i]], qq = NODE[n[e ? n.length - 2 : 1]];
  if (ENTS.some((x) => x.r === r && x.e === i)) continue; // 西邊的入口：接世界，不要欄杆
  // 欄杆放在開得到的範圍的邊上（往裡面找）
  const l = Math.hypot(qq[0] - p[0], qq[1] - p[1]), ux = (qq[0] - p[0]) / l, uz = (qq[1] - p[1]) / l; let s = 0; while (s < l && !inData(p[0] + ux * s, p[1] + uz * s, EDGE)) s += 1;
  if (s >= l) continue;
  BARS.push([p[0] + ux * s, p[1] + uz * s, Math.atan2(uz, ux), r.w + 2 * r.sw]);
}
// （舊的：補的巷子在圓邊上的盡頭也擺欄杆；不補巷子了）
console.log(`crossings ${CROSS.length}, street-name signs ${SIGNS.length} (${NAMES.length} names), park/school signs ${NAMESIGNS.length}, road-closed barriers ${BARS.length}`);

// ---- 行道樹（大路的人行道）、公園、學校邊上的樹 ----
const TREES = [];
{
  const R0 = rng(99), occ = (x, z) => { const k = gi(x, z); return k < 0 ? 9 : OG[k]; };
  for (const r of ROADS) {
    if (!r.sw || r.sw < 2.5) continue;
    for (let k = 1; k < r.n.length; k++) {
      const a = NODE[r.n[k - 1]], b = NODE[r.n[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let s = 6; s < L - 6; s += 9 + R0() * 3) for (const sd of [1, -1]) {
        const off = r.w / 2 + r.sw * 0.55, x = a[0] + ux * s - uz * sd * off, z = a[1] + uz * s + ux * sd * off;
        if (!drivable(x, z) || occ(x, z) === 2) continue; if (onLane(x, z, 0.8) || nearJ(x, z, 0)) continue; // 別條路的路面上、路口不要
        if (ENTR.some((e) => Math.hypot(e.x - x, e.z - z) < 5)) continue;
        TREES.push([x, z, 0.8 + R0() * 0.4]);
      }
    }
  }
  for (const a of AREAS) {
    if (a.t !== 'park' && a.t !== 'school' && a.t !== 'play') continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of a.p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const A = Math.abs(area(a.p)), n = Math.min(400, Math.floor(A / (a.t === 'park' ? 90 : 400)));
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const x = x0 + R0() * (x1 - x0), z = z0 + R0() * (z1 - z0); if (!inPoly(a.p, x, z)) continue;
      if (a.t === 'school') { // 學校：只在邊上（操場、建築不要）
        let near = Infinity; for (let j = 0; j < a.p.length; j++) { const p = a.p[j], c = a.p[(j + 1) % a.p.length]; near = Math.min(near, segD2(x, z, p[0], p[1], c[0], c[1])); } if (near > 36) continue;
      }
      const o = occ(x, z); if (o === 2 || o === 1) continue; if (AREAS.some((b) => (b.t === 'pitch' || b.t === 'track' || b.t === 'court' || b.t === 'water') && inPoly(b.p, x, z))) continue;
      if (!inData(x, z, EDGE + 1)) continue;
      TREES.push([x, z, 0.75 + R0() * 0.6]); i++;
    }
  }
}
console.log(`trees: ${TREES.length}`);

// ---- 輸出 ----
// 路的點只留用得到的、重新編號
const used = new Int32Array(NODE.length).fill(-1), NOUT = [];
for (const r of ROADS) for (const ni of r.n) if (used[ni] < 0) { used[ni] = NOUT.length / 2; NOUT.push(q(NODE[ni][0]), q(NODE[ni][1])); }
const roadsOut = ROADS.map((r) => [r.nm ? nameIdx(r.nm, r.en) : -1, q(r.w), q(r.sw), r.cls, r.ow, r.gen ? 1 : 0, r.n.map((ni) => used[ni])]);
const entOut = ENTS.map((e) => [ROADS.indexOf(e.r), e.e ? 1 : 0]);
// 房子、樹：Int16 一串（base64），省空間；格式（neihu.js 的 readBld 照這個讀）：
//   補的長方形：[1, 樓, 高(公寸), 外觀 | 圓外<<5, cx, cz, hx, hz, rot(毫弧度), 每一邊（2 bit × 4）]
//   OSM 多邊形：[0, 樓, 高, 外觀 | 圓外<<5, 點數 n, x, z × n, 每一邊（2 bit，8 邊一個數）× ceil(n/8), 有沒有騎樓的一樓 (0/1), 一樓 x, z × n, 盒子數 m, (x, z, hx, hz, rot) × m]
const I16 = [];
const push = (...v) => { for (const x of v) { const r = Math.round(x); if (r < -32768 || r > 32767) throw new Error('Int16 放不下: ' + x); I16.push(r); } };
let nRect = 0;
for (const b of BLD) {
  const flags = b.st | (b.back ? 32 : 0) | (b.lm ? 64 : 0); // 64＝地標（neihu.js 自己畫，一般的房子不要畫）
  if (b.gen && b.p.length === 4) {
    const [P0, P1, , P3] = b.p, ux = P1[0] - P0[0], uz = P1[1] - P0[1], vx = P3[0] - P0[0], vz = P3[1] - P0[1], lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz), c = centroid(b.p);
    push(1, b.f, q(b.h), flags, q(c[0]), q(c[1]), q(lu / 2), q(lv / 2), Math.round(Math.atan2(-uz / lu, ux / lu) * 1000), b.e[0] | (b.e[1] << 2) | (b.e[2] << 4) | (b.e[3] << 6)); nRect++;
  } else {
    const n = b.p.length; push(0, b.f, q(b.h), flags, n); for (const p of b.p) push(q(p[0]), q(p[1]));
    for (let i = 0; i < n; i += 8) { let v = 0; for (let k = 0; k < 8 && i + k < n; k++) v |= (b.e[i + k] & 3) << (2 * k); push(v - (v > 32767 ? 65536 : 0)); }
    push(b.core ? 1 : 0); if (b.core) for (const p of b.core) push(q(p[0]), q(p[1]));
    const col = b.col || []; push(col.length); for (const c of col) push(q(c[0]), q(c[1]), q(c[2]), q(c[3]), Math.round(c[4] * 1000));
  }
}
const b64 = (arr) => Buffer.from(new Int16Array(arr).buffer).toString('base64');
const bldOut = b64(I16);
const treeOut = b64(TREES.flatMap((t) => [q(t[0]), q(t[1]), Math.round(t[2] * 100)]));
const AK = ['park', 'school', 'pitch', 'track', 'court', 'water', 'play', 'parking', 'plaza', 'site'];
const areasOut = AREAS.map((a) => [AK.indexOf(a.t), a.p.flatMap((p) => [q(p[0]), q(p[1])])]);
const out = {
  v: 2, wide: WIDEN, center: CENTER, edge: EDGE, at: { x: Math.round(AT.x * 10) / 10, z: Math.round(AT.z * 10) / 10 }, link: { entry: [Math.round((AT.x + EP[0]) * 10) / 10, Math.round((AT.z + EP[1]) * 10) / 10], box: BOX_AT },
  src: path.basename(SRC).replace(/\.gz$/, ''), made: new Date().toISOString().slice(0, 10), box: [q(BB.x0), q(BB.z0), q(BB.x1), q(BB.z1)],
  ent: entOut, entP: [q(EP[0]), q(EP[1])], entDir: [Math.round(entDir[0] * 1e4) / 1e4, Math.round(entDir[1] * 1e4) / 1e4],
  names: NAMES, nodes: NOUT, roads: roadsOut, nbld: BLD.length, bld: bldOut, areaKinds: AK, areas: areasOut,
  elev: ELEV.map((e) => [e.k, q(e.y), q(e.w), e.p.flatMap((p) => [q(p[0]), q(p[1])]), e.piers.flatMap((p) => [q(p[0]), q(p[1])])]),
  stations: STATIONS.map((s) => [s.nm, s.en, q(s.x), q(s.z), Math.round(s.ang * 1000), q(s.len), q(s.w)]),
  entr: ENTR.map((e) => [q(e.x), q(e.z), Math.round(e.ang * 1000)]),
  cross: CROSS.map((c) => [q(c[0]), q(c[1]), Math.round(c[2] * 1000), q(c[3])]),
  signs: SIGNS.map((s) => [q(s[0]), q(s[1]), Math.round(s[2] * 1000), s[3]]),
  nsigns: NAMESIGNS.map((s) => [q(s[0]), q(s[1]), Math.round(s[2] * 1000), s[3], s[4]]),
  lm: LM,
  bars: BARS.map((b) => [q(b[0]), q(b[1]), Math.round(b[2] * 1000), q(b[3])]),
  trees: treeOut,
};
const js = `// ---- 內湖（自動產生：node neihu-conv.mjs；不要手改）----
// 地圖資料 © OpenStreetMap 貢獻者（ODbL 1.0，https://www.openstreetmap.org/copyright）：${out.src}（${out.made} 轉換）；中心 ${CENTER.lat}, ${CENTER.lon}；範圍＝匯出的 bounds ${BM[1]}–${BM[3]}, ${BM[2]}–${BM[4]}（${(BB.x1 - BB.x0).toFixed(0)} × ${(BB.z1 - BB.z0).toFixed(0)} 公尺）
// 數字是公寸（÷10＝公尺）；格式見 neihu-conv.mjs 的「輸出」、neihu.js 的 readData
export const NEIHU_DATA = ${JSON.stringify(out)};
`;
fs.writeFileSync(OUT, js);
console.log(`wrote ${OUT}: ${(js.length / 1024).toFixed(0)} KB; roads ${roadsOut.length}, nodes ${NOUT.length / 2}, buildings ${BLD.length} (${nRect} rects), areas ${areasOut.length}, trees ${TREES.length}; ${Date.now() - T0} ms`);
