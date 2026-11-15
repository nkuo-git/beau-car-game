// vdcrowd.js — 第 92 批（Nick 2026-11-15「高速公路圓環中間要有人走來走去」「休息站…要有人車…有那三隻動物跟人」）
// 超大停車場（圓環中間下面）、休息站（高架中段）走來走去的人和三隻動物（animals.js）：
//   每一區一張 0.5 公尺的格子（走得到的地方：停車場＝車和車中間的走道（中間那條南北的大走道有車在開，不去；東西兩半各走各的）、
//   休息站＝廣場、廁所和商店前面；碰撞（燈、柱子、椅子、水池、停著的車）旁邊不算）；
//   每個人：在走得到的格子裡挑一個地方（BFS：同一塊連著的）、拉直走過去、停一下（1.5～7 秒）、再挑；互相讓、讓你（走路的你在前面就停）；
//   你開車過來（同一層、在車子前面、快撞到）：往旁邊跳開（人永遠不會被壓扁）；真的撞到（太快閃不掉）：倒下去再爬起來（o.onHit）；小孩永遠不會被撞到（一定跳開、被車蓋到就推出去）。
//   走近一區（250 公尺內）才做（一格做一個）、200 公尺外藏起來；休息站的超商走出來的人（town LDF_HOOKS.leave → spawnAt）也變成這裡的人。
// 用法：const K = createVdCrowd(V, { lot: VD_LOT, cols: [VDV.cols, VIL.colliders], heightAt, makePerson(look), makeAnimal(kind), scene, onHit(a, speed), rnd })
//   K.update(dt, me)：me＝{ x, y, z, on, walk（走路）, car: { x, z, h（前面＝(cos h, −sin h)）, v, hx, hz } | null }
//   K.colliders(x, z, r, y) → 走路的 movers（圓，r 0.3）；K.spawnAt(x, z, heading, look)；K.agents；K.zones；K.info()
export const { createVdCrowd } = (() => {
const CELL = 0.5;
function createVdCrowd(V, o = {}) {
  const rnd = o.rnd || Math.random, hAt = o.heightAt || (() => 0);
  const zones = [];
  // ---- 一區：格子（走得到＝1）----
  function mkZone(id, y, rects, levelOk, nP, nA, cx, cz) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const r of rects) { x0 = Math.min(x0, r[0]); z0 = Math.min(z0, r[1]); x1 = Math.max(x1, r[2]); z1 = Math.max(z1, r[3]); }
    const W = Math.ceil((x1 - x0) / CELL) + 1, H = Math.ceil((z1 - z0) / CELL) + 1, G = new Uint8Array(W * H);
    for (const r of rects) { const a0 = Math.ceil((r[0] - x0) / CELL), a1 = Math.floor((r[2] - x0) / CELL), b0 = Math.ceil((r[1] - z0) / CELL), b1 = Math.floor((r[3] - z0) / CELL); for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) G[b * W + a] = 1; }
    const Z = { id, y, x0, z0, W, H, G, nP, nA, cx, cz, agents: [], made: 0, act: false, vis: false, blocked: 0 };
    const pad = 0.4;
    for (const L of o.cols || []) for (const c of L || []) { // 碰撞旁邊不走
      if (!c || !isFinite(c.x) || !levelOk(c)) continue;
      const R = c.t === 'box' ? Math.hypot(c.hx, c.hz) + pad : (c.r || 0) + pad;
      if (c.x + R < x0 || c.x - R > x1 || c.z + R < z0 || c.z - R > z1) continue;
      const a0 = Math.max(0, Math.floor((c.x - R - x0) / CELL)), a1 = Math.min(W - 1, Math.ceil((c.x + R - x0) / CELL)), b0 = Math.max(0, Math.floor((c.z - R - z0) / CELL)), b1 = Math.min(H - 1, Math.ceil((c.z + R - z0) / CELL));
      const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0);
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
        const k = b * W + a; if (!G[k]) continue; const px = x0 + a * CELL - c.x, pz = z0 + b * CELL - c.z;
        let hit; if (c.t === 'box') { const lx = px * co - pz * si, lz = px * si + pz * co; hit = Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad; } else hit = px * px + pz * pz < R * R;
        if (hit) { G[k] = 0; Z.blocked++; }
      }
    }
    let n = 0; for (let k = 0; k < G.length; k++) n += G[k]; Z.cells = n;
    zones.push(Z); return Z;
  }
  // 超大停車場：東西向的走道（兩排車中間 7 公尺），中間那條南北的大走道兩邊各留 0.8 公尺不去（有車在開）
  const LOT = o.lot;
  if (LOT) {
    const rects = [], CX = LOT.x, CZ = LOT.z, RS = LOT.rs || 89, AIS = LOT.ais || 3.6, D = LOT.d || 5;
    for (let k = -5; k <= 4; k++) {
      const za = CZ + 17 * k + D + 0.7, zb = CZ + 17 * (k + 1) - D - 0.7, dz = Math.max(Math.abs(za - CZ), Math.abs(zb - CZ)); if (dz >= RS - 2) continue;
      const hw = Math.sqrt(RS * RS - dz * dz) - 1.2; if (hw < AIS + 6) continue;
      rects.push([CX - hw, za, CX - AIS - 0.8, zb], [CX + AIS + 0.8, za, CX + hw, zb]);
    }
    const y = hAt(CX, CZ);
    mkZone('lot', y, rects, (c) => c.y0 == null || c.y0 < y + 3, 6, 6, CX, CZ);
  }
  // 休息站：廣場、廁所和商店前面（vdrest.js restLayout.walk 的前兩塊）
  const RL = V.restL;
  if (RL) {
    const rects = RL.walk.slice(0, 2).map((r) => [r[0], r[1], r[2], r[3]]), y = RL.y;
    mkZone('rest', y, rects, (c) => c.y0 != null && Math.abs(c.y0 - y) < 1.5, 6, 6, (rects[0][0] + rects[0][2]) / 2, (rects[0][1] + rects[1][1]) / 2 + 6);
  }
  const ok = (Z, x, z) => { const a = Math.round((x - Z.x0) / CELL), b = Math.round((z - Z.z0) / CELL); return a >= 0 && b >= 0 && a < Z.W && b < Z.H && Z.G[b * Z.W + a] === 1; };
  const cellOf = (Z, x, z) => { const a = Math.round((x - Z.x0) / CELL), b = Math.round((z - Z.z0) / CELL); return a >= 0 && b >= 0 && a < Z.W && b < Z.H ? b * Z.W + a : -1; };
  const cx = (Z, k) => Z.x0 + (k % Z.W) * CELL, cz = (Z, k) => Z.z0 + Math.floor(k / Z.W) * CELL;
  const sight = (Z, ax, az, bx, bz) => { const l = Math.hypot(bx - ax, bz - az), n = Math.ceil(l / 0.25); for (let i = 1; i < n; i++) { const t = i / n; if (!ok(Z, ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; };
  // BFS：從 a 出發，同一塊連著的格子裡挑一個 6 公尺以外的地方（離 4～40 公尺），回傳拉直的路
  let PREV = null, QU = null;
  function plan(Z, a, x, z) {
    const s = cellOf(Z, x, z); if (s < 0 || !Z.G[s]) return null;
    const N = Z.W * Z.H; if (!PREV || PREV.length < N) { PREV = new Int32Array(N); QU = new Int32Array(N); }
    PREV.fill(-2, 0, N); let h = 0, t = 0; QU[t++] = s; PREV[s] = -1;
    const W = Z.W, picks = []; let goal = -1;
    while (h < t && t < 24000) {
      const k = QU[h++], kx = k % W, kz = (k / W) | 0, dd = Math.hypot(kx - (s % W), kz - ((s / W) | 0)) * CELL;
      if (dd > 6 && dd < 40 && (k & 7) === 0) picks.push(k);
      if (dd > 40) continue;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const ax = kx + dx, az = kz + dz; if (ax < 0 || az < 0 || ax >= W || az >= Z.H) continue; const j = az * W + ax; if (PREV[j] !== -2 || !Z.G[j]) continue; if (dx && dz && (!Z.G[kz * W + ax] || !Z.G[az * W + kx])) continue; PREV[j] = k; QU[t++] = j; }
    }
    if (!picks.length) return null;
    goal = picks[Math.floor(rnd() * picks.length)];
    const raw = []; for (let k = goal; k >= 0; k = PREV[k]) raw.push(k); raw.reverse();
    const pts = []; let px = x, pz = z, i = 0;
    while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !sight(Z, px, pz, cx(Z, raw[j]), cz(Z, raw[j]))) j--; px = cx(Z, raw[j]); pz = cz(Z, raw[j]); pts.push([px, pz]); i = j; }
    return pts.length ? pts : null;
  }
  // ---- 人、動物 ----
  const KINDS = ['pig', 'pinky', 'cham'];
  let nid = 1;
  function makeAgent(Z, animal, look, x, z, hd) {
    const C = animal ? o.makeAnimal(look || { animal: KINDS[Math.floor(rnd() * 3)] }) : o.makePerson(look || null); if (!C) return null;
    const ak = animal ? C.look?.animal : null;
    const a = { id: nid++, Z, C, animal: !!animal, kind: ak, kid: !animal && C.look?.age === 'kid', x, z, y: Z.y, hd: hd ?? rnd() * Math.PI * 2, v: 0, vmax: animal ? (ak === 'cham' ? 0.62 : 0.78) + rnd() * 0.16 : 1.05 + rnd() * 0.3,
      path: null, pi: 0, wait: 0.5 + rnd() * 4, block: 0, dive: 0, dvx: 0, dvz: 0, fall: 0, state: 'idle', r: animal ? (C.radius || 0.3) : 0.3, h: C.height || 1.7 };
    C.group.position.set(x, Z.y, z); C.group.rotation.y = a.hd; C.group.visible = Z.vis; o.scene?.add(C.group);
    Z.agents.push(a); agents.push(a); return a;
  }
  const agents = [], ST = { made: 0, plans: 0, dives: 0, hits: 0, spawnAt: 0, blocked: 0 };
  function seedOne(Z) { // 隨便一個走得到的格子（離別人 1.5 公尺以上）
    for (let k = 0; k < 40; k++) { const i = Math.floor(rnd() * Z.G.length); if (!Z.G[i]) continue; const x = cx(Z, i), z = cz(Z, i); if (Z.agents.some((q) => Math.hypot(q.x - x, q.z - z) < 1.5)) continue; return [x, z]; }
    return null;
  }
  const UP = { speed: 0, state: 'idle' };
  const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function update(dt, me) {
    dt = Math.min(dt, 0.1);
    for (const Z of zones) {
      const d = me.on ? Math.hypot(me.x - Z.cx, me.z - Z.cz) : 1e9;
      Z.act = d < 250; const vis = d < 200;
      if (vis !== Z.vis) { Z.vis = vis; for (const a of Z.agents) a.C.group.visible = vis; }
      if (!Z.act) continue;
      if (Z.made < Z.nP + Z.nA && o.makePerson && o.makeAnimal) { const animal = Z.made % 2 === 1, q = seedOne(Z); if (q) { makeAgent(Z, animal, null, q[0], q[1]); ST.made++; } Z.made++; } // 一格做一個
      for (const a of Z.agents) step(a, dt, me);
    }
  }
  function step(a, dt, me) {
    const Z = a.Z, C = a.C, same = me.on && Math.abs(me.y - Z.y) < 2.5;
    // 你開車過來：往旁邊跳開
    if (same && me.car) {
      const c = me.car, dx = a.x - c.x, dz = a.z - c.z, fx = Math.cos(c.h), fz = -Math.sin(c.h), ah = dx * fx + dz * fz, lat = -dx * fz + dz * fx, sp = Math.abs(c.v);
      const ahead = c.v >= 0 ? ah : -ah, reach = c.hx + 1.2 + sp * 0.9;
      if (!a.fall && sp > 0.8 && ahead > -c.hx && ahead < reach && Math.abs(lat) < c.hz + a.r + 0.6) {
        if (!a.kid && Math.abs(lat) < c.hz + a.r && ahead < c.hx + a.r + 0.1 && sp > 2.5 && !a.dive) { a.fall = 2.2; a.dive = 0; a.path = null; ST.hits++; o.onHit?.(a, sp); } // 太快了閃不掉：倒下去（再爬起來）
        else if (!a.dive && ahead > c.hx * 0.4) { // 在車子前面才跳（在旁邊、後面的：下面推出去就好）
          let side = lat >= 0 ? 1 : -1; const ex = -fz * side, ez = fx * side;
          if (ahead > c.hx + 2.5 && !ok(Z, a.x + ex * 1.6, a.z + ez * 1.6) && ok(Z, a.x - ex * 1.6, a.z - ez * 1.6)) side = -side; // 這邊沒地方、車還遠：跳到另一邊（車快到了就不穿過車前面，往這邊跳到底）
          a.dvx = -fz * side; a.dvz = fx * side; a.dive = 0.65; a.path = null; ST.dives++;
        }
      }
      { // 被車子蓋到的地方推出去（永遠不會被壓扁；慢慢開過去也一樣）
        const inX = Math.abs(ah) < c.hx + a.r, inZ = Math.abs(lat) < c.hz + a.r;
        if (inX && inZ) { const s = lat >= 0 ? 1 : -1, need = c.hz + a.r + 0.05 - Math.abs(lat), nx = a.x - fz * s * need, nz = a.z + fx * s * need; if (ok(Z, nx, nz) || !ok(Z, a.x + fz * s * (2 * c.hz + 2 * a.r - need), a.z - fx * s * (2 * c.hz + 2 * a.r - need))) { a.x = nx; a.z = nz; } else { a.x += fz * s * (2 * c.hz + 2 * a.r - need); a.z -= fx * s * (2 * c.hz + 2 * a.r - need); } a.path = null; }
      }
    }
    let mv = 0;
    if (a.fall > 0) { a.fall -= dt; UP.state = a.fall > 0.9 ? 'fall' : 'getup'; UP.speed = 0; if (a.fall <= 0) { a.wait = 0.6; } }
    else if (a.dive > 0) {
      a.dive -= dt; const sp = 3.6 * Math.min(1, a.dive / 0.3 + 0.2), nx = a.x + a.dvx * sp * dt, nz = a.z + a.dvz * sp * dt;
      if (ok(Z, nx, nz)) { a.x = nx; a.z = nz; } a.hd = Math.atan2(-a.dvz, a.dvx); UP.state = 'run'; UP.speed = sp; if (a.dive <= 0) { a.dive = 0; a.wait = 0.8 + rnd(); }
    } else if (!a.path) {
      UP.state = 'idle'; UP.speed = 0;
      if ((a.wait -= dt) <= 0) { a.path = plan(Z, a, a.x, a.z); a.pi = 0; ST.plans++; if (!a.path) a.wait = 1 + rnd() * 2; }
    } else {
      const q = a.path[a.pi], dx = q[0] - a.x, dz = q[1] - a.z, l = Math.hypot(dx, dz);
      if (l < 0.15) { if (++a.pi >= a.path.length) { a.path = null; a.wait = 1.5 + rnd() * 5.5; } }
      else {
        const want = Math.atan2(-dz, dx); a.hd += Math.max(-4 * dt, Math.min(4 * dt, wrapA(want - a.hd)));
        // 前面有人（別人、走路的你）就停：等太久換一個地方
        const fx = Math.cos(a.hd), fz = -Math.sin(a.hd); let stop = false;
        for (const b of Z.agents) { if (b === a) continue; const ex = b.x - a.x, ez = b.z - a.z, ah = ex * fx + ez * fz; if (ah > 0 && ah < a.r + b.r + 0.45 && Math.abs(-ex * fz + ez * fx) < a.r + b.r + 0.1) { stop = b.id > a.id || !b.path; break; } }
        if (!stop && same && me.car && Math.abs(me.car.v) > 0.8) { // 車子開過來：不走進車子前面、旁邊（等它過去）
          const c = me.car, cx = Math.cos(c.h), cz = -Math.sin(c.h), ex = a.x + fx * 0.5 - c.x, ez = a.z + fz * 0.5 - c.z, ah = (ex * cx + ez * cz) * (c.v >= 0 ? 1 : -1), lt = Math.abs(-ex * cz + ez * cx);
          if (ah > -c.hx - a.r - 0.5 && ah < c.hx + 2 + Math.abs(c.v) * 1.2 && lt < c.hz + a.r + 0.5) { const l0 = Math.abs(-(a.x - c.x) * cz + (a.z - c.z) * cx); if (lt < l0 + 0.01) stop = true; }
        }
        if (!stop && same && me.walk) { const ex = me.x - a.x, ez = me.z - a.z, ah = ex * fx + ez * fz; if (ah > 0 && ah < a.r + 0.75 && Math.abs(-ex * fz + ez * fx) < a.r + 0.45) stop = true; }
        if (stop) { a.v = Math.max(0, a.v - 4 * dt); if ((a.block += dt) > 2.5) { a.block = 0; a.path = null; a.wait = 0.3 + rnd(); ST.blocked++; } }
        else { a.block = 0; a.v = Math.min(a.vmax, a.v + 2.5 * dt); }
        const turn = Math.abs(wrapA(want - a.hd)) > 1.2 ? 0.3 : 1; mv = Math.min(l, a.v * turn * dt);
        const nx = a.x + (dx / l) * mv, nz = a.z + (dz / l) * mv; if (ok(Z, nx, nz)) { a.x = nx; a.z = nz; } else { a.path = null; a.wait = 0.5; }
      }
      UP.state = a.v > 0.05 ? 'walk' : 'idle'; UP.speed = a.v;
    }
    if (!Z.vis) return;
    const g = C.group; g.position.set(a.x, Z.y, a.z); g.rotation.y = a.hd; C.update(dt, UP);
  }
  // 走出超商的人：變成休息站的人（樣子一樣）
  function spawnAt(x, z, heading, look) {
    const Z = zones.find((q) => q.id === 'rest'); if (!Z || !o.makePerson) return false;
    if (Z.agents.length >= Z.nP + Z.nA + 4) return false; // 太多了：留在店裡
    let px = x, pz = z; if (!ok(Z, px, pz)) { let best = null, bd = 1e9; for (let dz = -6; dz <= 6; dz += 0.5) for (let dx = -6; dx <= 6; dx += 0.5) if (ok(Z, x + dx, z + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [x + dx, z + dz]; } } if (!best) return false; [px, pz] = best; }
    const a = makeAgent(Z, false, look, px, pz, heading); if (!a) return false; a.wait = 0.2; ST.spawnAt++; return true;
  }
  const colPool = [], colOut = [];
  function colliders(x, z, r, y) {
    colOut.length = 0;
    for (const a of agents) {
      if (Math.abs(a.Z.y - y) > 2.5 || Math.abs(a.x - x) > r || Math.abs(a.z - z) > r || !a.Z.act) continue;
      const c = colPool[colOut.length] || (colPool[colOut.length] = { t: 'circle', x: 0, z: 0, r: 0.3, h: 1.7, npc: 'ped', person: null, vdc: true });
      c.x = a.x; c.z = a.z; c.r = a.r; c.h = a.Z.y + (a.fall ? 0.35 : a.h); c.y0 = a.Z.y; c.person = a; colOut.push(c);
    }
    return colOut;
  }
  const info = () => ({ zones: zones.map((Z) => ({ id: Z.id, y: +Z.y.toFixed(2), W: Z.W, H: Z.H, cells: Z.cells, blocked: Z.blocked, agents: Z.agents.length, people: Z.agents.filter((a) => !a.animal).length, animals: Z.agents.filter((a) => a.animal).length, act: Z.act, vis: Z.vis })), ...ST });
  return { agents, zones, update, colliders, spawnAt, info, ok, plan };
}
return { createVdCrowd };
})();
