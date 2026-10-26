// 第 46 批（Nick 2026-10-26「你去查世界記錄遊戲中的車在真實世界改到多快 你就讓遊戲裡改到多快」）：極速照零件
// Node（不開瀏覽器）：從 garage.src.html 拿 PERF 和 vmaxOf，每台車在平平的空地上油門踩到底（drive.js，跟遊戲一樣）
//   1) 沒裝零件：最快＝原廠 vmax
//   2) 零件全部裝好：最快＝top（真的改裝車跑過最快的）
//   3) 裝一半：在中間；vmaxOf 照多了幾匹
// node top-test.mjs
import './village-node-stub.mjs';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createDrive } from './drive.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const src = fs.readFileSync(path.join(dir, 'garage.src.html'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('not found: ' + a); return src.slice(i, j + b.length); };
const perfSrc = cut('const PERF = {', '\n};'), vmaxSrc = cut('const vmaxOf =', '};');
const GAME = { parts: {} };
const { PERF, vmaxOf } = new Function('GAME', `${perfSrc}\nconst partsOf = (k) => (GAME.parts[k] ||= []);\nconst hpOf = (k) => PERF[k].hp + PERF[k].parts.reduce((a, p) => a + (partsOf(k).includes(p[0]) ? p[3] : 0), 0);\n${vmaxSrc}\nreturn { PERF, vmaxOf };`)(GAME);

const W = { xf: 1.33, xr: -1.335, R: 0.33, trackF: 0.75, trackR: 0.75, wF: 0.245, wR: 0.245 };
function fakeCar() {
  const car = new THREE.Group(), body = new THREE.Group(), len = W.xf - W.xr + 1.9; body.name = 'body';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.85)); shell.position.set((W.xf + W.xr) / 2, 0.72, 0); body.add(shell); car.add(body);
  const wheels = [];
  for (const [x, tr] of [[W.xf, W.trackF], [W.xr, W.trackR]]) for (const s of [-1, 1]) { const hub = new THREE.Group(); hub.position.set(x, W.R, s * tr); const wh = new THREE.Group(); hub.add(wh); car.add(hub); wheels.push(wh); }
  return { car, body, wheels, spec: { wheels: W, interior: { wheelZ: 0.37 } } };
}
// 跟 town.src.js 一樣：perf ＝ { ...PERF[k], hp: hpOf(k), vmax: vmaxOf(k) }；油門踩到底直直開，最多 150 秒（遊戲時間）
function flatOut(k) {
  const S = fakeCar(), scene = new THREE.Scene(); scene.add(S.car);
  GAME.parts[k] ||= [];
  const hp = PERF[k].hp + PERF[k].parts.reduce((a, p) => a + (GAME.parts[k].includes(p[0]) ? p[3] : 0), 0), vmax = vmaxOf(k);
  const d = createDrive({ car: S, scene, camera: null, perf: { ...PERF[k], hp, vmax }, halfW: PERF[k].halfW, world: { surfaceAt: () => 0, colliders: [], places: {} }, keyboard: false });
  d.teleport({ x: 0, z: 0, heading: 0 }); d.setInput({ throttle: 1, brake: 0, steer: 0 });
  let top = 0, t = 0, still = 0;
  for (; t < 150 * 60 && still < 8 * 60; t++) { d.update(1 / 60); const v = d.telemetry().kmh; if (v > top + 0.05) { top = v; still = 0; } else still++; }
  d.dispose?.();
  return { hp, vmax, top, secs: t / 60, info: d.carInfo.vmax };
}
const rows = [];
for (const k of Object.keys(PERF)) {
  GAME.parts[k] = [];
  const stock = flatOut(k);
  GAME.parts[k] = PERF[k].parts.map((p) => p[0]);
  const full = flatOut(k);
  GAME.parts[k] = PERF[k].parts.slice(0, Math.ceil(PERF[k].parts.length / 2)).map((p) => p[0]);
  const half = flatOut(k);
  rows.push({ k, stock, full, half });
  console.log(`  ${k.padEnd(9)} stock ${stock.hp} hp → ${stock.top.toFixed(1)} km/h (vmax ${PERF[k].vmax}) · all parts ${full.hp} hp → ${full.top.toFixed(1)} km/h (top ${PERF[k].top}, ${full.secs.toFixed(0)} s) · half ${half.hp} hp → ${half.vmax}`);
}
const near = (a, b) => Math.abs(a - b) <= 1.5;
check(rows.every((r) => PERF[r.k].top >= PERF[r.k].vmax), 'every car has a tuned top speed (top) at least as fast as stock (vmax)');
check(rows.every((r) => r.stock.vmax === PERF[r.k].vmax && near(r.stock.top, PERF[r.k].vmax)), `no parts: every car still tops out at its stock vmax (${rows.filter((r) => !near(r.stock.top, PERF[r.k].vmax)).map((r) => r.k).join(', ') || 'all'})`);
check(rows.every((r) => r.full.vmax === PERF[r.k].top && r.full.info === PERF[r.k].top && near(r.full.top, PERF[r.k].top)), `all parts: every car reaches its real-world tuned record (${rows.filter((r) => !near(r.full.top, PERF[r.k].top)).map((r) => `${r.k} ${r.full.top.toFixed(1)}/${PERF[r.k].top}`).join(', ') || 'all'})`);
check(rows.every((r) => r.half.vmax >= PERF[r.k].vmax && r.half.vmax <= PERF[r.k].top && near(r.half.top, r.half.vmax)), 'half the parts: top speed in between, and the car really gets there');
const T = (k) => PERF[k].top;
check(T('chiron') === 490 && T('rx7') === 389 && T('supra') === 387 && T('gtr') === 346 && T('jesko') === 413 && T('monster') === 160 && T('gc8') === 288, `the numbers from the research (C16 ${T('chiron')}, R7 ${T('rx7')}, SUPRA ${T('supra')}, GT-R ${T('gtr')}, JESKO ${T('jesko')}, monster truck ${T('monster')}, GC8 ${T('gc8')})`);
console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
