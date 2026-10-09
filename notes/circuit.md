# circuit (賽車場) — notes

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

Folder: old-scratch/b3-circuit (started from 0.8.35 trunk = old-scratch/b2-intF). Nick 2026-10-04: 「賽道要很長不要只是直線」.
No commits. Did not touch drive.js (physics). Did not touch b2-intF or b3-int; I only copied them to read.

## What works
- **大便龍賽車場**: a 3661 m road course in free space north of the drag strip (x −72…1250, z −820…−8). It is counter-clockwise and has 23 corners: a 1 km main straight with start/finish and grid, a fast T1, two long sweepers, a hairpin, a 4-part chicane, S-curves, medium corners and a back straight under a bridge.
- **Trackside**: red/white curbs, grass run-off (cap 50 km/h), and gravel traps outside fast corners (paddy surface, cap 16 km/h). Barriers follow the run-off edge and all have collision: steel rail, tyre walls at gravel, and a concrete wall with ads along the main straight. Total 8.5 km of barrier and 1634 colliders. Also: 6 grandstands, a start gantry with 5 red lights, pit lane plus pit wall (維修區, 起點·終點), garages, a control tower with a banner, marshal posts, 300/200/100 braking boards, a bridge, about 420 instanced trees, and an arch on the access road 「大便龍賽車場 →」.
- **Getting there**: an access road leaves the drag strip start area at x −51. It goes through a 13 m gap in the strip's north wall; the east side opens into a funnel out to x −37 so the left turn does not clip the rail. It then runs to the paddock and the pit lane. The minimap shows the circuit. Destination pill 去賽車場 replaces 去賽道 and is the default when you have no money. `V.route` works both ways, garage↔circuit (~944 m) and circuit→track/garage.
- **Sign-up and racing**:
  - Drive slowly into the pit-lane box (報名處) and the car parks itself. An opponent menu opens with the same 9 OPPS (names, cars, prize); locked ones show ？？？. 離開 closes it, and 直接回車庫 is hidden while it is open.
  - 開始比賽 puts you at the back of a 4-car grid. Five red lights come on one by one (HUD and gantry), then go out at a random 4.7–5.7 s and the race starts. The car is held with brake and handbrake, because brake alone flips drive.js into reverse.
  - Races are 2 laps (3 laps for the last 3 opponents). There are 12 checkpoints, so recrossing old-scratch/F or cutting does not count. 開反了！掉頭 shows when you drive the wrong way, and driving out via the access road aborts the race.
  - The HUD shows position, lap, time, best lap, standings and 放棄比賽. The results screen offers 再比一次 and 開走.
  - Winning pays the prize, adds GAME.wins[id] (same key as before, so old saves keep their unlocks) and unlocks the next opponent.
- **AI**: 3 LOD cars per race: this level's opponent plus the previous two, or filler drivers. They drive a smoothed racing line with a per-car speed profile (corner grip × pace, braking, reaction). They overtake by changing lanes, follow when blocked, and have a mild rubber band (−6 %…+3 %). They are kinematic colliders, with brake lights and shadows from one InstancedMesh.
  - Pace per level `CI_PACE = [.55,.62,.68,.73,.77,.80,.83,.86,.89]`. Lap times: classmate 134 s, uncle 128, courier 120 … boss 103. A stock GC8 driven perfectly does 111 s; the test robot at 82 % does 119–123 s.
  - Damage does not slow you during a race; it is restored after.
- **直線加速**: the old 400 m drag race at the same start area is unchanged.
  - Same opponents and prize, but a drag win is stored as `GAME.wins['dr:<id>']` and no longer unlocks anyone. The note says 「去賽車場也贏X，下一個對手才會出現」.
  - The garage-page section is relabelled 直線加速. Trophies skip 'dr:' keys.

## Files
- New: `circuit.js` (world build + race engine, 928 lines), `circuit.src.js` (game glue appended after town.src.js), `circuit-test.mjs`, `port-circuit.mjs`.
- Edited by the port (small exact-anchor inserts): build-art.mjs, build-app.mjs, town.src.js (8 inserts), race.src.js (8), village.js (1: strip north-wall collider gap), garage.src.html (6). Backups are `*.bak-ci0.*`.
- Saves: no new top-level field. `GAME.wins` gets 'dr:<id>' keys; load already copies any key, so old saves load fine.

## How to port
`node port-circuit.mjs <dir> [--dry]` copies the 3 circuit files and applies 30 exact-text edits, printing OK/FAIL for each. The second run changes nothing.
- **Fresh trunk copy** (b2-intF copy): all OK, 6 files changed; second run 0 changed. The result is byte-identical to b3-circuit, including art/garage.html.
- **b3-int snapshot** (police-guns work in progress, copied at about 10:20): `--dry` is all OK.

## Tests (all in old-scratch/b3-circuit; run one at a time)
- `node circuit-test.mjs ci-shots/ci`: **PASSED, 24 checks, 0 failed, 0 page errors** (log `ci-log6.txt`).
  - Garage → circuit by itself (94 s sim, stuck 0). Menu, grid and lights; the robot drives 2 laps and wins (263 s, best lap 122.7 s).
  - Prize +5 萬 and unlock 巷口阿伯 are saved; all 3 AI finish after you.
  - Recrossing old-scratch/F does not count, wrong-way warning, 放棄比賽 cleanup, surfaces, barriers stop you, 離開 menu.
  - The drag race is still reachable and its list follows circuit wins; reload keeps money, wins and 1 trophy.
- `node test-b1.mjs ci-b1/b1`: **ALL CHECKS OK, 140 ok** (`ci-b1-log3.txt`). An earlier run (`ci-b1-log2.txt`) failed once on "every car stays on the deck it was left on (saved on the phone)" while other agents' chromium was running. That check is about garage deck saving, not the circuit, and it passed on the rerun and in log1. Not changed.
- `node test-b4.mjs ci-b4/b4`: **ALL CHECKS OK, 66 ok** (`ci-b4-log2.txt`).
- test-b1's race section was not changed and still passes.
- Final `node build-art.mjs --yaris` → art/garage.html 2188669 bytes.

## Screenshots (old-scratch/b3-circuit/ci-shots/)
01-menu, 02-grid-lights, 03-race-start, 04-race-eye, 05-results, 06-main-straight, 07-turn1-braking, 07b-turn1-drone, 08-hairpin, 08b-hairpin-drone, 09-chicane, 09b-chicane-drone, 10-s-curves, 10b-s-curves-drone, 11-driver-seat, 12-pit-lane, 13-aerial, 14-aerial-top, 15-access-road, 16-from-village, 17-drag-strip.

## Perf
- Circuit build: 34 meshes, 65k tris, 1634 colliders, 175–250 ms in the SwiftShader page (≈170 ms in node).
- renderer.info calls/tris:
  - main straight 137/973k, T1 118/943k, hairpin 143/973k, chicane 151/987k, S-curves 252/1.22M (drone 349/1.30M), driver seat 59/928k, pit 140/980k, access road 141/984k, from village 250/1.10M.
  - In a race: grid 145/1.03M, eye cam 262/1.25M.
  - Car out of view (top aerial): 47/91k. So about 0.9M of the tris is the player's full car model, not the circuit.
- race.update with 3 AI: 0.007–0.07 ms/frame, with no per-frame allocations (reused objects; HUD written every 0.2 s and only on change).
- Robot drive step: 0.29 ms/step on the garage→circuit leg.

## Open issues
- The S-curves drone view hits 349 draw calls because it looks back over the village; it is camera-dependent, not circuit cost.
- offroad.js holds the car with `setInput({brake:1})` like circuit.js used to. In drive.js, brake held while stopped switches to reverse, so that hold may let the car creep backwards. Not changed (not mine).
- The damage toast 「車子撞壞了：開去阿輝改車廠修」 can show during a race after a hard crash.
- AI do not actively avoid the player beside them (they only react to cars ahead); contact is handled by colliders.
