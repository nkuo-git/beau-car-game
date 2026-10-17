// 量車艙（cabin.js 的 FIT 表）：node cabin-fit.mjs [--masks] [--write] [車...]
//   車身 SDF（<key>-body.mjs 的 makeSDF；supra＝body.mjs）量：
//     S：側面半寬（x −1.9～1.2 每 0.1 × y 0.2～1.3 每 0.1）：從中線往外走（每 2 公釐）走到車身外面；中線就在車身外面＝0
//     T：頭上車身高度（x 同上 × |z| 0～1.0 每 0.1）：從 y＝2 往下走（每 2 公釐），碰到車身前最後一個在外面的點；整條都碰不到＝0
//     bot：車艙底下（x −1～0.6、z 0～0.6）車身最低點的平均；fa／ra：前輪拱後緣、後輪拱前緣 [x, 輪拱頂 y]（z＝0.7、輪心高）
//   車窗遮罩（cabin-masks.json；--masks 或 json 裡沒有這台：用 Chromium 畫 <KEY>_LOOK 的 side()／top() 量，存回 json）：
//     belt／st：側窗（側面圖 R 有、G 沒有＝看得到的玻璃）每個 x 的下緣／上緣 y（每 4 公釐量）；沒有玻璃＝0
//     ws／wf／wt：前擋（俯視圖 A＝玻璃、G＝黑邊；從車頭往後第一段玻璃）每個 |z| 的看得到的玻璃下緣（最前面）x／整片玻璃最前面 x／上緣 x（每 5 公釐）
//     rg／rt：後擋（最後面那段玻璃，要有兩段以上）看得到的玻璃最後面／最前面 x
//   --write：把量好的車寫進 cabin.js 的 // __CABIN_FIT__ 和 // __CABIN_FIT_END__ 中間（沒量的車照舊）；沒有 --write 只印出來跟現在的比
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2), WRITE = args.includes('--write'), MASKS = args.includes('--masks');
const MJ = path.join(DIR, 'cabin-masks.json'), CJ = path.join(DIR, 'cabin.js');
const src = fs.readFileSync(CJ, 'utf8');
const have = [...src.matchAll(/^ {4}(\w+): \{S: '/gm)].map((m) => m[1]);
const keys = args.filter((a) => !a.startsWith('--'));
if (!keys.length) keys.push(...have);
const X0 = -1.9, NX = 32, Y0 = 0.2, NY = 12, NZ = 11;
const mm = (v) => Math.round(v * 1000);

// ---- 車窗遮罩（Chromium）----
async function measureMasks(list) {
  const { serve, browser } = await import('./lod-serve.mjs');
  const srv = await serve(), b = await browser(), p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/__cabinfit.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><body></body>' }));
  await p.goto(`${srv.url}/__cabinfit.html`);
  const out = {};
  for (const key of list) {
    out[key] = await p.evaluate(async ({ key, X0, NX, NZ }) => {
      const { BOX } = await import('/masks.js');
      let look;
      if (key === 'supra' || key === 'gtr') { const m = await import('/supra.js'); look = (key === 'supra' ? m.SUPRA_SPEC : m.GTR_SPEC).look; }
      else look = (await import(`/${key}-spec.js`))[`${key.toUpperCase()}_SPEC`].look;
      const px = (t, b, x, y, ch) => { // t.image.data：第 0 列在下面（y0）
        const { width: w, height: h, data } = t.image, k = w / (b.x1 - b.x0);
        const i = Math.floor((x - b.x0) * k), j = Math.floor((y - b.y0) * k);
        if (i < 0 || j < 0 || i >= w || j >= h) return 0;
        return data[(j * w + i) * 4 + ch];
      };
      const r3 = (v) => Math.round(v * 1000);
      // 側窗
      const sd = look.side(), belt = [], st = [];
      for (let i = 0; i < NX; i++) {
        const x = X0 + i * 0.1; let lo = 0, hi = 0;
        for (let q = 0; q <= 350; q++) { const y = q * 0.004; if (px(sd, BOX.side, x, Math.min(y, 1.3999), 0) > 127 && px(sd, BOX.side, x, Math.min(y, 1.3999), 1) < 128) { if (!lo) lo = r3(y) || 1; hi = r3(y); } }
        belt.push(lo); st.push(hi);
      }
      // 前擋、後擋
      const tp = look.top(), ws = [], wf = [], wt = [], rg = [], rt = [];
      for (let k = 0; k < NZ; k++) {
        const z = k * 0.1, runs = []; let cur = null;
        for (let q = 470; q >= -470; q--) {
          const x = q * 0.005, a = px(tp, BOX.top, x, z, 3) > 127, vis = a && px(tp, BOX.top, x, z, 1) < 128;
          if (a) { if (!cur) runs.push((cur = { f: x, vmax: null, vmin: null })); if (vis) { if (cur.vmax == null) cur.vmax = x; cur.vmin = x; } } else cur = null;
        }
        const R = runs.filter((r) => r.vmax != null), w = R[0], rr = R.length > 1 ? R[R.length - 1] : null;
        ws.push(w ? r3(w.vmax) : 0); wf.push(w ? r3(w.f) : 0); wt.push(w ? r3(w.vmin) : 0);
        rg.push(rr ? r3(rr.vmin) : 0); rt.push(rr ? r3(rr.f) : 0);
      }
      sd.dispose(); tp.dispose();
      return { belt, st, ws, wf, wt, rg, rt };
    }, { key, X0, NX, NZ });
    console.log('masks', key, errs.length ? errs.join(' | ') : 'ok');
  }
  await b.close(); srv.close();
  return out;
}

// ---- 車身 SDF ----
async function measureBody(key) {
  const M = await import(key === 'supra' ? './body.mjs' : `./${key}-body.mjs`);
  const sp = key === 'supra' || key === 'gtr' ? (await import('./supra.js'))[`${key.toUpperCase()}_SPEC`] : (await import(`./${key}-spec.js`))[`${key.toUpperCase()}_SPEC`];
  const f = M.makeSDF(), W = sp.wheels, st = 0.002;
  const side = (x, y) => { if (f(x, y, 0) >= 0) return 0; let z = 0; while (z < 1.2 && f(x, y, z) < 0) z += st; return z; };
  const top = (x, z) => { let y = 2; while (y > 0 && f(x, y, z) > 0) y -= st; return y > 0 ? y + st : 0; };
  const S = [], T = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) S.push(mm(side(X0 + i * 0.1, Y0 + j * 0.1)));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) T.push(mm(top(X0 + i * 0.1, j * 0.1)));
  let bs = 0, bn = 0;
  for (let x = -1; x <= 0.601; x += 0.1) for (let z = 0; z <= 0.601; z += 0.1) { let y = 0; while (y < 1 && f(x, y, z) >= 0) y += st; if (y < 1) { bs += y; bn++; } }
  const arch = (xc, R, dir) => { // dir：往車艙的方向（前輪 −1、後輪 +1）
    let x = xc; while (Math.abs(x - xc) < 0.8 && f(x, R, 0.7) >= 0) x += dir * st;
    let y = R; while (y < R + 0.8 && f(xc, y, 0.7) >= 0) y += st;
    return `${mm(x)} ${mm(y)}`;
  };
  return { S: S.join(' '), T: T.join(' '), bot: Math.round((bs / bn) * 1000) / 1000, fa: arch(W.xf, W.RF ?? W.R, -1), ra: arch(W.xr, W.RR ?? W.R, 1) };
}

// ---- 主程式 ----
const masks = fs.existsSync(MJ) ? JSON.parse(fs.readFileSync(MJ, 'utf8')) : {};
const need = keys.filter((k) => MASKS || !masks[k]);
if (need.length) { Object.assign(masks, await measureMasks(need)); fs.writeFileSync(MJ, JSON.stringify(Object.fromEntries(Object.keys(masks).sort().map((k) => [k, masks[k]])), null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"')); }
const old = (key) => { const m = src.match(new RegExp(`^ {4}${key}: (\\{S: .*\\}),$`, 'm')); return m ? Function(`return ${m[1]}`)() : null; };
const cmp = (a, b, name) => { // 印出差多少（現在 cabin.js 裡的 vs 新量的）
  if (a == null) return `${name}: 新的`;
  const A = String(a).split(' ').map(Number), B = String(b).split(' ').map(Number); let n = 0, s = 0, mx = 0, z = 0;
  A.forEach((v, i) => { const w = B[i]; if (!v !== !w) { z++; return; } if (!v) return; n++; s += Math.abs(v - w); mx = Math.max(mx, Math.abs(v - w)); });
  return `${name} ${n ? (s / n).toFixed(1) : '-'}/${mx}${z ? ` 0≠${z}` : ''}`;
};
const lines = {};
for (const key of keys) {
  const B = await measureBody(key), K = masks[key], j = (a) => a.join(' ');
  const E = { S: B.S, T: B.T, belt: j(K.belt), st: j(K.st), ws: j(K.ws), wf: j(K.wf), wt: j(K.wt), rg: j(K.rg), rt: j(K.rt), fa: B.fa, ra: B.ra, bot: B.bot };
  const o = old(key);
  console.log(key, Object.keys(E).map((k) => (k === 'bot' ? `bot ${o?.bot}→${E.bot}` : cmp(o?.[k], E[k], k))).join(' | '));
  lines[key] = `    ${key}: {${Object.entries(E).map(([k, v]) => (k === 'bot' ? `bot: ${v}` : `${k}: '${v}'`)).join(', ')}},`;
}
if (WRITE) {
  const a = src.indexOf('  const FIT = {\n'), b = src.indexOf('  };\n  // __CABIN_FIT_END__');
  if (a < 0 || b < 0) throw new Error('cabin.js 找不到 FIT 的記號');
  const body = src.slice(a + 16, b).split('\n').filter(Boolean), order = body.map((l) => l.match(/^ {4}(\w+):/)[1]);
  for (const k of keys) if (!order.includes(k)) order.push(k);
  const map = Object.fromEntries(body.map((l, i) => [order[i], l]));
  const out = src.slice(0, a + 16) + order.map((k) => lines[k] ?? map[k]).join('\n') + '\n' + src.slice(b);
  fs.writeFileSync(CJ, out); console.log('寫進 cabin.js：', keys.join(' '));
}
