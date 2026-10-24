# Round glass tower home + 6 homes (第 21 批, content 16, 2026-10-17)

Nick: 「把原本正方形的車庫直接弄掉」, 「可以自行決定要停在哪一層可以自己搭電梯上去」. Mock https://claude.ai/artifact/GZcpBA7kY8HVfa7zYk3Si4 (approved).
Homes spread over the map: mock https://claude.ai/artifact/EaTT7dijRcjfStUoV1SU4x (Nick 「可以」).
The 4-floor ring garage behind the marble garage (an earlier step of the same day, never shipped) is gone; so is the marble garage and its lifts (room.js / ringgar.js are no longer bundled).

## tower.js
- `TOWER` = radius 12 glass ring (`RO`), 6 floors (`NF`): 1F lobby `H1` 4.5 m, then `FH` 3.2 m per floor; roller door on +x (`DX0`…`DX1`, ±`DZ` 4, `DH` 3.6 high).
- 1F lobby: the round lift (`RP` 3.3) in the middle doubles as the turntable; a small house (bed + wardrobe) on the north side, trophy cabinet west, sofa south, 4 plants. No bays on 1F.
- 2F–6F: 8 bays each = `TOWER_BAYS[40]` (`f` 1–5, `i` 0–7, angle `a = i·π/4`, centre at `RB` 7.6, car nose out = heading `−a`), `towerFy(f)` = floor height.
- The lift (`liftTo(f, rot, cb)`, `liftSnap`, `lift.{floor, y, rot, busy}`) carries a platform group (`platform`) and turns while it moves. The shaft poles were removed (they blocked the view).
- `put(i, obj|name)` / `take(i)` hang a car in bay group `towerBay<i+1>`; `cars[i]` is the Object3D, or `true` while only a name is known (car still loading).
- `cull(cam)`: inside, only the current floor's bays draw (plus the lift's floor while moving); outside, every bay within 90 m.
- `camClamp(p, t)`: the garage-page camera stays in the lobby (inside the glass, under 2F, out of the house/cabinet).
- `exterior` mode (other people's homes): just the shell as shared InstancedMesh parts; 9 calls / 97k tris for all five.

## Garage page (garage.src.html)
- Your car sits on the lift in the lobby. Other cars hang in their bays (`syncTower`). Picking a car parked upstairs: toast 「X 坐電梯從 N 樓下來了」 (no lift animation yet), and the previous car takes its bay.
- Save: `park = { mid, tower[40] }`. `normPark` reads old saves in this order: `tower` first, then the old lift `decks`, then the ring `ring` (owned, deduplicated, not the current car), then fills by price. Unknown/repeated names are dropped.

## In the game (town.src.js, 第 21 批)
- `TWR` = which car is in each bay; `tripPose[k].tw` = bay index for a parked car; `poseF(p)` = floor.
- Elevator panel `.elpanel` (garage.css): 3×2 (4F 5F 6F / 1F 2F 3F), each floor says 空 N. Upstairs while driving there is an extra ◀ ▶ row (turn the lift 45°).
  - Shows when you drive within 1.4 m of the centre (`elWho` 1), or walk onto the lift (`elWho` 3). Big or borrowed cars get `elWho` 2: pressing a floor says 「這台太大了，不能坐電梯」 / 「借來的車不能停在你家」.
  - An off-road car parked on the lift blocks it (「怪獸卡車太大了，電梯載不動：先開走」); otherwise it would be carried upstairs.
  - Placement: driving = top-left under the action button; walking = right side under the round buttons (the left has the 去哪裡 list); landscape = top centre. Hidden while 去哪裡 or ⋯ is open. `#stage.el-on` moves toasts below it.
- Ride (`elGo` → `parkAt` centre → `elRide`): you, the car and the camera ride the platform; cars standing on the lift ride along (`padCars`).
  - Driving up: the lift turns to the nearest free bay.
  - Going down to 1F: it turns the nose to the door.
  - Arrival toasts: 「N 樓：往前開進空的格子，停好再下車」, or 「1 樓：按「開鐵捲門」開出去」 when the door is shut.
- Parking: drive into a bay roughly straight (`parkSpot` tolerance in bay coordinates: −2.4…+2.6 m along, ±1.5 m across, ±0.6 rad) and press 下車.
  - The car straightens itself (`parkAt`) and hangs in the bay: toast 「X 停好了：N 樓 M 號」. The car you just drove hangs as the full model until you switch cars.
  - On 1F a car stays wherever you leave it.
- Boarding upstairs (`towerHint`): 「倒車回到電梯上，按 1F」. Reverse back onto the lift and press 1F.
- 叫電梯: if the lift is on another floor, standing by the shaft gives 「叫電梯」 (`elCallAct`), which shows 「電梯動作中⋯」 while it comes.
- Dealer delivery (`deliver`): first free bay, without moving the lift. When all 40 are full: 「車庫滿了：X 先停在一樓大廳」 at lobby (−6.5, 4).
- Off-road cars (`liftOK` false: `PERF.big`) never use the tower. They park in the 越野車車庫 annex (orbay.js), as before (Nick: 「怪獸卡車還是停越野車車庫」).

## 6 homes (village.js `HOME_SITES`)
- 1 車庫街 (the old spot), 2 山頂 (mountain.js levels it; the tower is raised to summit height, y ≈ 101.8), 3 賽車場門口, 4 越野車場旁邊, 5 內湖入口, 6 快速道路 (inside the loop).
- `places.garst.slots` = these 6 (name kept for net.src.js). Your home = your world slot, saved as `home`; not in a world = 1.
- The garage street keeps only house #1. `homeAt(n)` moves `places.garage` to home n, and `wrapHome` reroutes 「回車庫」 to it.
- Other homes draw as exterior shells with name signs. Friends' homes show on the big map, and 「去找他」 for a friend at home drives to their door (`NET.goalHome`).
- 第 22 批 (2026-10-18, Nick 「在賽道那邊的車庫車子出不來 要弄一個出口」): home 3's door faced the circuit access road's north guardrail (z ≈ −106.6), so no car could leave. circuit.js now cuts the guardrail contours (colliders and drawn rail pieces) inside a box in front of every home door (`GAPS`: from the door face DX1 to apron + 4 m out, ±(DZ + 3) m wide). Only home 3 is near the circuit, so only that rail changes. circuit-test checks the door drive-out and the rail beside it.

## Performance (measured in test harness, SwiftShader)
- Tower interior: 12 calls / 16k tris. Other five homes' exteriors: 9 calls / 97k tris.
- Home 1 lobby: 179 calls / 1.26M tris. Outside home 1: 197 calls / 1.26M tris.

## Tests
- test-b1: sections 2, 7, 10, 10b, 10c, 11. They cover walls and door, the panel on every screen, riding up and parking, walking rides, 叫電梯, deliveries, old-save migration, and the garage-page camera.
- test-b4 section 9: the monster truck refuses the lift and parks on 1F; you ride up on foot to GC8 and come back down.
- world-test section 3: B's home is the summit, too far to see except as a map dot.

## A friend's tower (第 23 批, 2026-10-18)
- Visiting a friend after the doorbell moves this same `GAR` to the friend's lot: all tower math goes through `garLot()` (= `HOME.lot`, where GAR stands now; `HOME.gs` its slot, `HOME.slot` your real home). `twrNow()` = the friend's bays while `GV.on`. tower.js `setSign(top, bottom)` writes the friend's name on the sign. Details in notes/world.md 第 23 批.

## The ramp round the outside (第 24 批, 2026-10-20)
Nick: 「車庫外圍的那個外面那一圈的路可以弄了」. Mock https://claude.ai/artifact/Xbe4taBBqkM6gL9VDyV3xb; Nick picked 「照草稿」.
- Shape (tower.js `TOWER_RAMP`): a spiral road from r 12.6 to 17.2 m round the glass. It starts at local angle 45° (A0, front right of the door) at ground level and climbs with the tower on your right. Each half lap goes up one floor (`towerRampY(u)`: smoothstep per half lap, so it is level at every entrance). The steepest part is 14% on the first half lap and about 10% after that. It ends 0.32 rad past the 6F entrance (`UEND`).
- Entrances: 2F back, 3F front, 4F back, 5F front, 6F back (`ent(f) = 45° + f·180°`). Each has an orange frame with a "2F"…"6F" LED sign, readable from both sides. The bay at each entrance became the road (`TOWER_BAYS[i].road`, ids 5, 9, 21, 25, 37), so there are 35 parking bays. Each floor has yellow lane lines and chevrons from the entrance to the lift.
- Drawing: the ramp is merged into the exterior shell, gold and lights meshes (`GEO.shellX/goldX/lightsX`), so there are no extra draw calls. Other people's homes use `GEO.ext`, which includes the ramp. The first half lap is a solid embankment; above it the deck has an underside, and you can drive under it at the back.
- Collisions (all flat 2D; drive.js has no heights):
  - `towerRampCols(F)`, used while driving on the ramp or upstairs: an inner kerb ring with a gap at floor F's entrance and an outer parapet ring, both 1.1 m high so they don't pull the chase camera in. The top end wall exists only for F = 5, because a 2D wall would block every lap passing that angle.
  - `towerRampGround()`, used from the ground (village.js, every home): the low half lap is solid (`rcol`), plus the start line (`mcol`). town.src.js `rampStep` turns these `off` for your own home: `rcol` while you are up, `mcol` while you drive a car that may go up.
  - Upstairs, `GAR.colliders(open, world, car)` gives cars a glass ring with that floor's entrance open (`COLR`); walkers keep the full ring.
- State (town.src.js `TRAMP`): `on` means driving on the ramp. `u` is how far round from the start (unwrapped angle), and the car height and the ceiling for the chase camera both come from it. While on the ramp, `GAR.floor` is the nearest floor, so the entrance floor, colliders and parked cars line up. You get on by crossing the start line, enter a floor by driving inside the glass at its entrance, and get back on by driving out of a floor's entrance.
- Rules:
  - The monster truck (`liftOK` false), a borrowed car and a car at a friend's home (`GV.on`) can't go up. The start line blocks them and you get a toast.
  - Walkers never go up: the start line always blocks them, and the upstairs glass is a full ring for them.
  - You can't get out on the ramp (「在斜坡上不能下車」).
  - Arriving on a floor where the lift isn't calls it up (「3 樓：電梯上來了⋯」). `elRide` never counts the car you are driving as a turntable passenger, because its `tripPose` is still on the 1F turntable.
  - Upstairs, the lift's ◀ ▶ turns you 45° at a time to face the yellow lines and drive back out.
- Police: while you are more than 2.5 m up the ramp (`rampHigh`), police don't see you or collide with you.
- Friends: `world/p` carries `y` (the ramp height) while you drive on the ramp. Their game draws your car at that height, pitched with the slope, and doesn't collide with it when the heights differ by more than 2.2 m. The rules need no change because `world/p` validates only x, z, h and t.
- Old saves: cars in the 5 road bays move to free bays (`normPark`). The deliveries and the lift skip road bays (`twFree`). A friend on an older version may have a car in a road bay; `gvStart` moves it.
- Fixes found while building: `garCols` now passes `car = true`, so the floor's entrance is open for driving.
- Tests: `ramp-test.mjs` (new). test-b1 / test-app-b1 expect 7 free bays per floor and price-ordered parking that skips 2F #6. world-test section 9 uses B's bay 10 instead of 9, and the new 9c checks that B sees A up on the ramp.

## Basement B1, B2 (第 26 批, 2026-10-21)
Nick: 「看可以的話加在地下室然後地下室有幾樓樓上就剪掉幾樓」. Mock https://claude.ai/artifact/36fLvpmhQmAd2LCwaaeBH2; Nick picked 「坐電梯」 (the basement is reached by lift only).
- Floors: 1F lobby, 2F–4F upstairs, B1, B2 below. The floor index stays 0..5 and bay ids stay 0..39, so saves don't change: `f = 4` is B1 and `f = 5` is B2 (they were 5F and 6F, so a car parked on 5F is now on B1 and one on 6F on B2). `TOWER.NU = 4` (floors above ground). `towerFy(f)` gives B1 −3.2 m, B2 −6.4 m; the roof is now 14.1 m. Helpers: `towerUp(f)` (2F–4F), `towerUnder(f)` (B1/B2), `towerFlName(f)` ("2F"/"B1"), `towerFlTxt(f)` ("2 樓"/"B1") for toasts.
- The ramp ends at 4F (`TOWER_RAMP.NE = 3`, `UEND = 3π + 0.32`); road bays are only 5, 9, 21, so there are 37 parking bays (2F 6, 3F 7, 4F 7, B1 8, B2 8).
- Lift panel: top row 2F 3F 4F, bottom row B2 B1 1F; basement buttons are blue (`.elpanel button.ug`). Walking and at a friend's home (doorbell) can ride to the basement too; the monster truck still can't use the lift.
- Look (tower.js `GEO.under` + `GEO.underL`, 2 meshes in group `towerUnder`): concrete floor/ceiling/wall ring, blue bays with white lines, ceiling lamps between bays, a ring light round the shaft, four navy "B1"/"B2" LED signs on the wall. B2 has the pit floor.
- The hole in the ground: the terrain is one big mesh over the tower lot. The renderer has `stencil: true`; the `towerHole` disc (radius RP + 0.125, no colour, no depth, renderOrder −100) writes stencil 1, and the ground materials under the lot (found once per home, town.src.js `shaftCut`: five short vertical segments through big plain meshes, `shaftHit` skips triangles outside their box; about 10–20 ms once; not three's Raycaster, which tests every triangle (the mountain alone took ~30 ms per ray) and throws on friends' name-tag sprites) only draw where stencil ≠ 1. The hole is drawn only while you are inside the tower and the lift is not at 1F; from outside the pit cover is drawn instead. The basement group is drawn only when you are inside and (you are in the basement or the hole is open).
- Walking fixes: walk.js colliders with a `y0` now block only relative to the floor under the walker (`blocksBody(c, gy)`), so the B1 ceiling ring doesn't stop you getting out of the car; colliders without `y0` always block (`yb`). The walking camera may go below 0.3 m when the floor is below ground.
- `elCall` decides 「電梯上來了／下來了」 by height (basement indices are bigger).
- Tests: `under-test.mjs` (new; numbers, old save, panel, stencil, ride down and see the basement, park on B1, walls, walk to B2, call the lift up, outside view, draw calls). ramp-test, test-b1 and test-app-b1 updated for 37 bays and 2F–4F. world-test section 9 also rides B's lift down to B1.
- Performance (SwiftShader): 1F at the panel 208 calls / 1.26M tris, riding down 192 / 1.26M, B1 224 / 1.40M, B2 77 / 0.33M, looking down the shaft from 1F 55 / 0.31M.

## Batch 33 — the garage page's lift really fetches the car (trial v50, 2026-10-24)

Picking a car parked upstairs / in the basement on the garage page used to swap instantly with a toast. Now (`town.src.js` `ELA`,
hooked into `garage.src.html` through `liftAnim`): the car that was on the platform (full model) rides up/down to that floor and slides
into the picked car's bay (bay-local x −RB → 0, 1.1 s smoothstep), the picked car's light model slides from the bay onto the platform,
the platform returns to 1F with rotation 0, and only then the full model of the picked car becomes visible (`liftAnim.vis` keeps the old
car visible and the new one hidden meanwhile). During the ride `arrangeCars` uses the old bay list (`ELA.on.want`) and `syncTower` skips
that bay, so nothing jumps; at the end a normal `arrangeCars()` → `normPark()` writes the swapped save. `room.update(dt)` is now called
from the page loop (it never was: `liftSnap` only). The lift motor sound uses `room.onLift` → `engineAudio.lift()` (`liftSnd.page`).
Picking another car, going out (`enterDrive`) or hiding the room cancels: `liftSnap(0, 0)` and the same finish. Timing: 2F ≈ 1.9 s each
way + 1.1 s, B2 ≈ 2.5 s each way. Toast now ends with 「⋯」 while it rides.
Tests: under-test 0b (pick the B1 YARIS: up/swap/down phases, positions, visibility, save; pick GC8 back), test-b1 / test-app-b1 pk11
updated (toast 「⋯」, animation state, final state).
