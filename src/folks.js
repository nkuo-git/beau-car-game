// ---- 第 70 批：房子裡的人會動、會進出（Nick 2026-11-04「每棟房子裡的人會進出 會動」、2026-11-07「第二項可以做了」）----
//   只有蓋好的那一棟（town.src.js 的 LD）裡面的人會動：走來走去（客廳、餐廳、廚房）、坐沙發、站起來、拜拜；店的老闆站櫃台不走。
//   有時候一個人走到大門，門自己開，他走出去變成路上走的人（npc.js spawnAt）；路上的人走到門口（npc.js 的 enter），門開了走進來（arrive）。
//   公寓沒有人（Nick）：town.src.js 不給公寓做。
// 【API】createFolks({ I, b, scene, makeCharacter, randomLook, hooks }) → F
//   I、b：interiors.js 蓋好的那一棟（live）和村子的那一棟；scene：房子的場景（LD.sc）；makeCharacter／randomLook：character.js
//   hooks：{ door() → 0～1（門開了多少；沒有門＝1）, openDoor()（請門開著：每格叫），
//           player() → { x, z } | null（你在哪裡：人會讓你）, leave(look, x, z, heading) → true＝外面接走了（變成路上的人）}
//   F.update(dt)            每格：只有現在這一層的人會動
//   F.setFloor(i)           換樓層（別層的人藏起來、不算）
//   F.arrive(look)          有人從大門走進來：在門口裡面生一個居民（樣子照 look），走去找位子
//   F.colliders             現在這一層站著、走著的人的圓柱（物件每格改位置：給 walker.setMovers 的陣列用）
//   F.list                  現在這一層的人 [{ C, st, x, z, … }]；F.count；F.stats { leaves, arrivals, paths, pathMs }
//   F.dispose()
//   走路的格子：interiors.js 每一層的 nav（0.1 公尺、人半徑 0.32 已經算進去）；路線＝BFS 再拉直（看得到就直走）
(function () {
  const TAU = Math.PI * 2;
  const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
  const hyp = Math.hypot;
  const IDLE = { speed: 0, state: 'idle' }, WALK = { speed: 1, state: 'walk' }, SIT = { speed: 0, state: 'sit' }, ARG = { speed: 0, state: 'idle' };

  function createFolks(o) {
    const I = o.I, b = o.b, scene = o.scene, mkChar = o.makeCharacter, rLook = o.randomLook, H = o.hooks || {};
    const st = { leaves: 0, arrivals: 0, paths: 0, pathMs: 0, waits: 0 };
    const floors = I.floors.map(() => null); // 每一層：{ folks, nav, mark, q, prev, gen }（用到才做）
    let cur = -1, player = null;
    const local = (x, z) => I.local(x, z), world = (x, z) => I.world(x, z);
    // 固定的亂數：同一棟、同一層每次都是同樣的人
    let q = (Math.imul(Math.round(b.x * 10), 73856093) ^ Math.imul(Math.round(b.z * 10), 19349663)) >>> 0;
    const rnd = () => { q = (q + 0x6d2b79f5) >>> 0; let t = q; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (a) => a[(rnd() * a.length) | 0];
    const kind = I.kind, isShop = !!(I.floors[0].spots.counter?.length);

    // ---- 走路的格子（本地座標）----
    function navOf(fl) {
      const f = I.floors[fl], nv = f.nav; if (!nv) return null;
      const n = nv.nx * nv.nz;
      return { ...nv, mark: new Int32Array(n), prev: new Int32Array(n), q: new Int32Array(n), gen: 0 };
    }
    const cellOf = (N, x, z) => { const i = Math.floor((x - N.x0) / N.gs), j = Math.floor((z - N.z0) / N.gs); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? -1 : i * N.nz + j; };
    const freeAt = (N, x, z) => { const k = cellOf(N, x, z); return k >= 0 && !N.cells[k]; };
    function nearFree(N, x, z, r) { // 最近的空格子（半徑 r 公尺內）
      let best = -1, bd = Infinity; const n = Math.ceil(r / N.gs), ci = Math.floor((x - N.x0) / N.gs), cj = Math.floor((z - N.z0) / N.gs);
      for (let i = Math.max(0, ci - n); i <= Math.min(N.nx - 1, ci + n); i++) for (let j = Math.max(0, cj - n); j <= Math.min(N.nz - 1, cj + n); j++) {
        const k = i * N.nz + j; if (N.cells[k]) continue; const dx = N.x0 + (i + 0.5) * N.gs - x, dz = N.z0 + (j + 0.5) * N.gs - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = k; }
      }
      return bd <= r * r ? best : -1;
    }
    function los(N, ax, az, bx, bz) { // 兩點之間都是空的（每 0.05 公尺看一格）
      const d = hyp(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.05));
      for (let i = 1; i < n; i++) { const t = i / n; if (!freeAt(N, ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
      return true;
    }
    function route(N, ax, az, bx, bz) { // BFS（4 方向）→ 格子中心的點 → 拉直；回傳 [[x, z]…]（不含起點）；null＝走不到
      const t0 = performance.now(); st.paths++;
      const ks = nearFree(N, ax, az, 1.2), kg = nearFree(N, bx, bz, 1.2); if (ks < 0 || kg < 0) return null;
      const gen = ++N.gen, mark = N.mark, prev = N.prev, Q = N.q, nz = N.nz, nx = N.nx, cells = N.cells; let qh = 0, qt = 0;
      mark[ks] = gen; prev[ks] = -1; Q[qt++] = ks; let found = ks === kg;
      while (qh < qt && !found) {
        const k = Q[qh++], i = (k / nz) | 0, j = k - i * nz;
        const nb0 = i > 0 ? k - nz : -1, nb1 = i < nx - 1 ? k + nz : -1, nb2 = j > 0 ? k - 1 : -1, nb3 = j < nz - 1 ? k + 1 : -1;
        for (const nb of [nb0, nb1, nb2, nb3]) { if (nb < 0 || cells[nb] || mark[nb] === gen) continue; mark[nb] = gen; prev[nb] = k; Q[qt++] = nb; if (nb === kg) { found = true; break; } }
      }
      if (!found) { st.pathMs += performance.now() - t0; return null; }
      const pts = []; for (let k = kg; k >= 0; k = prev[k]) { const i = (k / nz) | 0, j = k - i * nz; pts.push([N.x0 + (i + 0.5) * N.gs, N.z0 + (j + 0.5) * N.gs]); }
      pts.reverse(); // 起點 → 終點
      const out = []; let a = [ax, az], i = 0; // 拉直：從 a 看得到最遠的點就直接走過去
      while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(N, a[0], a[1], pts[j][0], pts[j][1])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
      out[out.length - 1] = [bx, bz]; // 最後一點＝真的目標（格子中心差幾公分）
      st.pathMs += performance.now() - t0;
      return out;
    }

    // ---- 人 ----
    function mk(fl, look, lx, lz, lh, state) {
      let C = null; try { C = mkChar(look, { state: state === 'sit' ? 'sit' : 'idle' }); } catch (e) { console.error(e); return null; }
      const f = { C, look: C.look || look, st: 'idle', x: lx, z: lz, h: lh, hd: lh, spot: null, t: 0, path: null, pi: 0, v: 0, wait: 0, fl, boss: false, kid: (C.look || look).age === 'kid', elder: (C.look || look).age === 'elder',
        col: { t: 'circle', x: 0, z: 0, r: Math.max(0.24, Math.min(0.34, C.radius || 0.3)), h: 1.7, npc: 'folk', person: null } };
      f.col.person = f; f.speed = f.kid ? 1.15 : f.elder ? 0.7 : 0.9 + rnd() * 0.25;
      C.group.visible = fl === cur;
      scene.add(C.group); place(f);
      return f;
    }
    function place(f) { const w = world(f.x, f.z); f.C.group.position.x = w[0]; f.C.group.position.z = w[1]; f.C.group.rotation.y = f.h + (b.rot || 0); f.col.x = w[0]; f.col.z = w[1]; }
    function spotLocal(s) { const p = local(s.x, s.z); return { x: p[0], z: p[1], h: wrapA(s.heading - (b.rot || 0)), y: s.y, s }; }
    function taken(fl, s) { for (const g of floors[fl].folks) if (g.spot && g.spot.s === s) return true; return false; }
    function freeSpots(fl, kinds) { const sp = I.floors[fl].spots, out = []; for (const k of kinds) for (const s of sp[k] || []) if (!taken(fl, s)) out.push([k, s]); return out; }
    function sitAt(f, p) { f.x = p.x; f.z = p.z; f.h = f.hd = p.h; f.st = 'sit'; f.t = 15 + rnd() * 45; f.C.group.position.y = Math.max(0, (p.y ?? 0.45) - 0.45); f.C.update(0, SIT); place(f); }
    function standAt(f, p, how) { f.x = p.x; f.z = p.z; f.h = f.hd = p.h; f.st = how === 'pray' ? 'pray' : 'idle'; f.t = (how === 'pray' ? 8 : 4) + rnd() * (how === 'pray' ? 20 : 16); f.C.group.position.y = 0; f.C.update(0, IDLE); place(f); }
    function populate(fl) {
      const F = floors[fl], sp = I.floors[fl].spots; F.folks = [];
      if (kind === 'apt') return; // 公寓沒有人（Nick）
      const want = [];
      if (sp.counter?.length) want.push(['counter', sp.counter[0], true]); // 老闆（大人）
      const n = kind === 'temple' ? (rnd() < 0.7 ? 1 : 0) + (rnd() < 0.4 ? 1 : 0) : (want.length ? 0 : 1) + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0); // 透天厝、店 1～3 個（店的老闆算一個）；廟 0～2 個拜拜的
      const pool = freeSpots(fl, kind === 'temple' ? ['pray', 'stand', 'sit'] : ['sit', 'stand', 'pray']);
      for (let i = 0; i < n && pool.length; i++) { const k = (rnd() * pool.length) | 0; const [kk, s] = pool.splice(k, 1)[0]; want.push([kk, s, false]); }
      for (const [kk, s, adult] of want) {
        let L = rLook(rnd); for (let k = 0; adult && L.age === 'kid' && k < 8; k++) L = rLook(rnd);
        const p = spotLocal(s), f = mk(fl, L, p.x, p.z, p.h, kk === 'sit' ? 'sit' : 'idle'); if (!f) continue;
        f.spot = p; f.boss = kk === 'counter';
        if (kk === 'sit') sitAt(f, p); else standAt(f, p, kk);
        if (f.boss) f.t = 1e9; // 老闆不走
        F.folks.push(f);
      }
    }
    function floorData(fl) { if (!floors[fl]) { floors[fl] = { folks: null, nav: navOf(fl) }; } const F = floors[fl]; if (!F.folks) populate(fl); return F; }

    // ---- 要去哪裡 ----
    function doorPts() { // 大門：裡面一點、外面一點（本地）
      const pt = I.portals && I.portals[0]; if (!pt) return null;
      const c = local((pt.a[0] + pt.b[0]) / 2, (pt.a[1] + pt.b[1]) / 2), bc = local(I.floors[0].bounds.x, I.floors[0].bounds.z);
      let dx = bc[0] - c[0], dz = bc[1] - c[1]; const d = hyp(dx, dz) || 1; dx /= d; dz /= d;
      return { inX: c[0] + dx * 0.7, inZ: c[1] + dz * 0.7, outX: c[0] - dx * 1.0, outZ: c[1] - dz * 1.0, h: Math.atan2(-dz, dx) + Math.PI, hIn: Math.atan2(-dz, dx) }; // h＝走出去的方向（character：臉朝本地 +x，rotation.y＝heading；z 是 −sin）
    }
    function goTo(f, F, tx, tz, then) {
      const N = F.nav; if (!N) return false;
      const path = route(N, f.x, f.z, tx, tz); if (!path) return false;
      f.path = path; f.pi = 0; f.st = 'walk'; f.then = then; f.wait = 0; f.stuck = 0;
      if (f.C.state === 'sit') { f.C.group.position.y = 0; f.C.update(0, IDLE); }
      return true;
    }
    function next(f, F) { // 站夠了、坐夠了：下一件事
      if (f.boss) { f.t = 1e9; return; }
      const fl = f.fl, dp = fl === 0 && H.leave ? doorPts() : null;
      if (dp && rnd() < 0.18 && F.nav) { if (goTo(f, F, dp.inX, dp.inZ, 'door')) { f.spot = null; return; } }
      const pool = freeSpots(fl, kind === 'temple' ? ['pray', 'stand', 'sit'] : ['sit', 'stand', 'pray']).filter(([, s]) => s !== f.spot?.s);
      if (!pool.length || !F.nav) { f.t = 5 + rnd() * 10; return; }
      const [kk, s] = pool[(rnd() * pool.length) | 0], p = spotLocal(s);
      if (goTo(f, F, p.x, p.z, kk)) { f.spot = p; f.spot.kind = kk; } else f.t = 5 + rnd() * 10;
    }
    function arrived(f, F) {
      const p = f.spot, how = f.then;
      f.path = null;
      if (how === 'door') { f.st = 'door'; f.t = 0; f.hd = doorPts()?.h ?? f.h; return; }
      if (how === 'sit' && p) sitAt(f, p); else if (p) standAt(f, p, how); else { f.st = 'idle'; f.t = 4 + rnd() * 8; f.C.update(0, IDLE); }
    }
    function blocked(f, F) { // 前面有你、有別人：等（讓路）
      const look = 0.75, fx = Math.cos(f.h), fz = -Math.sin(f.h);
      if (player) { const dx = player[0] - f.x, dz = player[1] - f.z, d = hyp(dx, dz); if (d < look + 0.3 && dx * fx + dz * fz > d * 0.2) return true; }
      for (const g of F.folks) { if (g === f || g.st === 'sit') continue; const dx = g.x - f.x, dz = g.z - f.z, d = hyp(dx, dz); if (d < 0.6 && dx * fx + dz * fz > d * 0.3 && (g.st !== 'walk' || g.id < f.id)) return true; }
      return false;
    }
    function stepWalk(f, F, dt) {
      const p = f.path[f.pi]; let dx = p[0] - f.x, dz = p[1] - f.z, d = hyp(dx, dz);
      if (d < 0.1) { f.pi++; if (f.pi >= f.path.length) { f.x = p[0]; f.z = p[1]; arrived(f, F); return; } return stepWalk(f, F, dt); }
      f.hd = Math.atan2(-dz, dx);
      if (blocked(f, F)) { f.wait += dt; f.v = 0; st.waits += dt; if (f.wait > 2.5) { f.wait = 0; const e = f.path[f.path.length - 1]; if (!goTo(f, F, e[0], e[1], f.then)) { f.st = 'idle'; f.t = 3; } } return; } // 讓路；等太久：重新找路
      f.wait = 0;
      const da = wrapA(f.hd - f.h); if (Math.abs(da) > 1.2) { f.v = 0; return; } // 先轉身再走
      const v = f.speed * (Math.abs(da) > 0.5 ? 0.5 : 1), m = Math.min(v * dt, d); f.x += (dx / d) * m; f.z += (dz / d) * m; f.v = v;
    }
    function update(dt) {
      if (cur < 0) return; const F = floors[cur]; if (!F || !F.folks) return;
      const pl = H.player ? H.player() : null; player = pl ? local(pl.x, pl.z) : null;
      for (let i = F.folks.length - 1; i >= 0; i--) {
        const f = F.folks[i]; f.id = i;
        if (f.st === 'walk') stepWalk(f, F, dt);
        else if (f.st === 'door') { // 走到大門裡面：請門開；開了就走出去，外面接走
          f.t += dt; if (H.openDoor) H.openDoor();
          const open = (H.door ? H.door() : 1) > 0.7;
          if (open && f.t > 0.3) { const dp = doorPts(); f.path = [[dp.outX, dp.outZ]]; f.pi = 0; f.st = 'out'; f.then = null; }
          else if (f.t > 6) { f.st = 'idle'; f.t = 2; } // 門一直沒開（不應該）：算了
        }
        else if (f.st === 'out') { // 走出門口：到了外面那一點＝變成路上的人
          const p = f.path[0], dx = p[0] - f.x, dz = p[1] - f.z, d = hyp(dx, dz); f.hd = Math.atan2(-dz, dx);
          if (H.openDoor) H.openDoor();
          const m = Math.min(f.speed * dt, d); f.x += (dx / d) * m; f.z += (dz / d) * m; f.v = f.speed;
          if (d < 0.08) { const w = world(f.x, f.z); const ok = H.leave ? H.leave(f.look, w[0], w[1], f.h + (b.rot || 0)) : false; if (ok) { st.leaves++; remove(F, f); continue; } f.st = 'idle'; f.t = 20 + rnd() * 20; f.spot = null; }
        }
        else { f.v = 0; f.t -= dt; if (f.t <= 0) next(f, F); }
        // 轉頭、動畫、位置
        const da = wrapA(f.hd - f.h); f.h += Math.sign(da) * Math.min(Math.abs(da), 7 * dt);
        if (f.st === 'sit') f.C.update(dt, SIT);
        else { ARG.speed = f.v; ARG.state = f.v > 0.02 ? 'walk' : 'idle'; f.C.update(dt, ARG); }
        place(f);
      }
      // 給走路的碰撞：站著、走著的人
      cols.length = 0; for (const f of F.folks) if (f.st !== 'sit') cols.push(f.col);
    }
    function remove(F, f) { const i = F.folks.indexOf(f); if (i >= 0) F.folks.splice(i, 1); f.C.dispose(); }
    function arrive(look) { // 路上的人從大門走進來：門口裡面生一個，走去找位子（沒有位子就站一下再說）
      const F = floorData(0), dp = doorPts(); if (!dp || kind === 'apt') return false;
      const f = mk(0, look, dp.inX, dp.inZ, dp.hIn, 'idle'); if (!f) return false;
      F.folks.push(f); st.arrivals++;
      f.t = 0.3 + rnd() * 0.5; f.st = 'idle'; // 進來先站一下再走（next 會找位子；找不到就站著）
      return true;
    }
    const cols = [];
    function setFloor(i) {
      if (i === cur) return;
      if (cur >= 0 && floors[cur]?.folks) for (const f of floors[cur].folks) f.C.group.visible = false;
      cur = i; const F = floorData(i); for (const f of F.folks) f.C.group.visible = true;
      cols.length = 0; for (const f of F.folks) if (f.st !== 'sit') cols.push(f.col);
    }
    function dispose() { for (const F of floors) if (F?.folks) for (const f of F.folks) f.C.dispose(); floors.fill(null); cols.length = 0; cur = -1; }
    setFloor(I.floor);
    function leaveNow(f) { const F = floors[f.fl], dp = doorPts(); if (!dp || !F || f.boss) return false; if (!goTo(f, F, dp.inX, dp.inZ, 'door')) return false; f.spot = null; return true; } // 測試用：叫他走出大門
    function routeOf(fl, ax, az, bx, bz) { const F = floorData(fl); return F.nav ? route(F.nav, ax, az, bx, bz) : null; } // 測試用
    return { update, setFloor, arrive, colliders: cols, get list() { return floors[cur]?.folks || []; }, get count() { return floors[cur]?.folks?.length || 0; }, get floor() { return cur; }, stats: st, dispose, doorPts, _floors: floors, _leave: leaveNow, _route: routeOf, _free: (fl, x, z) => { const F = floorData(fl); return F.nav ? freeAt(F.nav, x, z) : null; }, _nearFree: (fl, x, z, r) => { const F = floorData(fl); return F.nav ? nearFree(F.nav, x, z, r) >= 0 : null; } };
  }
  window.createFolks = createFolks;
})();
