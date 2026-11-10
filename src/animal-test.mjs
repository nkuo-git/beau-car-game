// 第 86 批：三隻動物（animals.js）：Node，一秒
//   大小（Nick「大約人的一半高」「變色龍是三隻裏最大隻的其他2隻一樣大」）、三角形、走路的時候腳踩在地上不會滑（粉紅、變色龍：踩地那一段腳的世界座標不動；
//   小豬：落地那一段腳不動、跳不超過 12 公分）、身體不歪（走直線的時候左右對稱：沒有往一邊倒）、倒下去再爬起來、生氣播完回到站著、沒有 NaN
import * as THREE from 'three';
import { buildAnimal, ANIMAL_KINDS, randomAnimal } from './animals.js';
let ok = 0, bad = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ok  ', m); } else { bad++; console.log('  FAIL', m); } };
const box = new THREE.Box3(), V = new THREE.Vector3();
const size = (C) => { C.group.updateMatrixWorld(true); C.mesh.computeBoundingBox(); box.copy(C.mesh.boundingBox).applyMatrix4(C.mesh.matrixWorld); return { h: box.max.y, len: box.max.x - box.min.x, w: box.max.z - box.min.z, minY: box.min.y }; };
const A = {};
for (const k of ANIMAL_KINDS) { const C = buildAnimal({ animal: k }, { shadow: true }); C.update(0.5, { state: 'idle' }); A[k] = { C, ...size(C) }; }
console.log('  sizes', JSON.stringify(Object.fromEntries(ANIMAL_KINDS.map((k) => [k, { h: +A[k].h.toFixed(3), len: +A[k].len.toFixed(2), w: +A[k].w.toFixed(2), tris: A[k].C.info.tris, draws: A[k].C.info.draws }]))));
check(ANIMAL_KINDS.join() === 'pig,pinky,cham', 'three kinds: pig, pinky, cham');
for (const k of ANIMAL_KINDS) check(A[k].h > 0.7 && A[k].h < 1.1 && A[k].minY > -0.02 && A[k].minY < 0.04, `${k}: about half a person tall (${A[k].h.toFixed(2)} m; a person is about 1.7), standing on the ground (lowest ${A[k].minY.toFixed(3)})`);
check(Math.abs(A.pig.h - A.pinky.h) < 0.13 && Math.abs(A.pig.len - A.pinky.len) < 0.25, `pig and pinky are the same size (${A.pig.h.toFixed(2)}/${A.pinky.h.toFixed(2)} m tall, ${A.pig.len.toFixed(2)}/${A.pinky.len.toFixed(2)} m long)`);
const vol = (a) => a.h * a.len * a.w;
check(A.cham.h >= Math.max(A.pig.h, A.pinky.h) - 0.02 && A.cham.len > 1.5 * Math.max(A.pig.len, A.pinky.len) && vol(A.cham) > 2.5 * Math.max(vol(A.pig), vol(A.pinky)), `the chameleon is the biggest (${A.cham.h.toFixed(2)} m tall, ${A.cham.len.toFixed(2)} m long)`);
check(ANIMAL_KINDS.every((k) => A[k].C.info.draws === 2 && A[k].C.info.tris < 18000), `each one 2 draw calls and few triangles (${ANIMAL_KINDS.map((k) => A[k].C.info.tris).join(', ')})`);
check(A.pig.C.geo === undefined && buildAnimal({ animal: 'pig' }).mesh.geometry === A.pig.C.mesh.geometry, 'geometry is shared by every animal of the same kind');

// 腳的世界座標（骨頭）
const bonePos = (C, name) => { C.group.updateMatrixWorld(true); return C.B[name].getWorldPosition(V).clone(); };
function walk(k, speed, secs, feet) {
  const C = buildAnimal({ animal: k }, { shadow: false }), dt = 1 / 60, tr = feet.map(() => []), roll = [];
  for (let i = 0; i < 40; i++) C.update(dt, { state: 'walk', speed }); // 先開始走
  let x = 0;
  for (let i = 0; i < secs * 60; i++) {
    C.update(dt, { state: speed > 2 ? 'run' : 'walk', speed }); x += speed * dt; C.group.position.x = x;
    feet.forEach((f, j) => { const p = bonePos(C, f); tr[j].push([p.x, p.y, p.z]); });
    C.group.updateMatrixWorld(true); const s = size(C); roll.push((box.max.z + box.min.z) / 2);
  }
  let nan = false; C.mesh.skeleton.bones.forEach((b) => { if (!isFinite(b.matrixWorld.elements[12]) || !isFinite(b.matrixWorld.elements[13])) nan = true; });
  return { C, tr, roll, nan };
}
// 踩在地上那一段（腳最低的那幾格）：腳往前後滑多少
function slide(tr, ground) {
  let worst = 0, n = 0, run = [];
  const flush = () => { if (run.length > 2) { const xs = run.map((p) => p[0]); worst = Math.max(worst, Math.max(...xs) - Math.min(...xs)); n++; } run = []; };
  for (const p of tr) { if (p[1] < ground) run.push(p); else flush(); }
  flush(); return { worst, n };
}
for (const [k, sp, feet] of [['pinky', 0.75, ['footL', 'footR']], ['cham', 0.85, ['LFf', 'RFf', 'LHf', 'RHf']]]) {
  for (const speed of [sp, 2.2]) {
    const R = walk(k, speed, 4, feet), s = R.tr.map((t) => slide(t, Math.min(...t.map((p) => p[1])) + 0.003)); // 踩地＝腳踝在最低的地方（3 公釐內）
    const lowest = Math.min(...R.tr.flat().map((p) => p[1]));
    const w = Math.max(...s.map((q) => q.worst));
    console.log(`  ${k} ${speed} m/s: steps per foot ${s.map((q) => q.n).join('/')}, slide ${s.map((q) => q.worst.toFixed(3)).join('/')} m, lowest ankle ${lowest.toFixed(3)}`);
    check(!R.nan && s.every((q) => q.n >= 2) && w < 0.03, `${k} walking ${speed} m/s: each foot steps (${s.map((q) => q.n).join('/')}) and stays put on the ground (slides at most ${(w * 100).toFixed(1)} cm)`);
    const rm = R.roll.reduce((a, b) => a + b, 0) / R.roll.length;
    check(Math.abs(rm) < 0.03, `${k} walking ${speed} m/s: not leaning to one side (body centre ${(rm * 100).toFixed(1)} cm off the line)`);
  }
}
{ // 小豬：小小的跳
  const C = buildAnimal({ animal: 'pig' }, { shadow: false }), dt = 1 / 60, ys = [], fl = [];
  for (let i = 0; i < 40; i++) C.update(dt, { state: 'walk', speed: 0.8 });
  let x = 0; for (let i = 0; i < 240; i++) { C.update(dt, { state: 'walk', speed: 0.8 }); x += 0.8 * dt; C.group.position.x = x; ys.push(C.B.root.position.y); const p = bonePos(C, 'legL'); fl.push([p.x, C.B.root.position.y > 1e-6 ? 1 : 0, p.z]); } // 落地＝身體沒有在空中
  const hmax = Math.max(...ys), hops = ys.filter((y, i) => i && ys[i - 1] <= 1e-6 && y > 1e-6).length;
  const s = slide(fl, 0.5);
  console.log(`  pig 0.8 m/s: hops ${hops} in 4 s, highest ${hmax.toFixed(3)} m, feet slide on the ground ${s.worst.toFixed(3)} m (${s.n} landings)`);
  check(hops >= 5 && hmax > 0.03 && hmax < 0.12, `the pig moves in small hops (${hops} hops in 4 s, at most ${(hmax * 100).toFixed(1)} cm high)`);
  check(s.n >= 4 && s.worst < 0.02, `the pig's feet stay put while it is on the ground (${(s.worst * 100).toFixed(1)} cm)`);
}
// 倒下、爬起來、生氣
for (const k of ANIMAL_KINDS) {
  const C = buildAnimal({ animal: k }, { shadow: true }), dt = 1 / 60;
  for (let i = 0; i < 60; i++) C.update(dt, { state: 'fall' });
  const lying = size(C);
  for (let i = 0; i < 60; i++) C.update(dt, { state: 'fall' });
  let st = []; for (let i = 0; i < 120; i++) { C.update(dt, { state: i ? 'idle' : 'getup' }); st.push(C.state); } // 一次性的動作送一次（跟 npc.js 的 send 一樣）
  for (let i = 0; i < 30; i++) C.update(dt, { state: 'idle' });
  const up = size(C);
  let w = []; for (let i = 0; i < 150; i++) { C.update(dt, { state: i ? 'idle' : 'wave' }); w.push(C.state); }
  check(lying.h < A[k].h * 0.8 && Math.abs(up.h - A[k].h) < 0.03 && st.includes('getup') && st[st.length - 1] === 'idle' && w.includes('wave') && w[w.length - 1] === 'idle' && up.minY > -0.03,
    `${k}: falls over (${lying.h.toFixed(2)} m), gets back up (${up.h.toFixed(2)} m), angry wave plays once and ends standing`);
}
const seen = new Set(); let r = 0.01; for (let i = 0; i < 60; i++) seen.add(randomAnimal(() => (r = (r * 9301 + 0.4927) % 1)).animal);
check(seen.size === 3, `randomAnimal gives all three (${[...seen]})`);
const C = buildAnimal({ animal: 'pig' }); C.setLook({ animal: 'cham' }); C.update(0.1, { state: 'walk', speed: 1 });
check(C.kind === 'cham' && C.group.children.includes(C.mesh) && C.height === A.cham.C.height, 'setLook switches the kind');
const t0 = performance.now(); const Cs = ANIMAL_KINDS.map((k) => buildAnimal({ animal: k })); for (let i = 0; i < 600; i++) for (const c of Cs) c.update(1 / 60, { state: 'walk', speed: 1 });
const us = ((performance.now() - t0) / 1800) * 1000;
check(us < 60, `update is cheap (${us.toFixed(1)} µs per animal per frame)`);
console.log(bad ? `${ok} ok, ${bad} FAILED` : `${ok} ok, ALL CHECKS OK`);
process.exit(bad ? 1 : 0);
