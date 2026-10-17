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

## Performance (measured in test harness, SwiftShader)
- Tower interior: 12 calls / 16k tris. Other five homes' exteriors: 9 calls / 97k tris.
- Home 1 lobby: 179 calls / 1.26M tris. Outside home 1: 197 calls / 1.26M tris.

## Tests
- test-b1: sections 2, 7, 10, 10b, 10c, 11. They cover walls and door, the panel on every screen, riding up and parking, walking rides, 叫電梯, deliveries, old-save migration, and the garage-page camera.
- test-b4 section 9: the monster truck refuses the lift and parks on 1F; you ride up on foot to GC8 and come back down.
- world-test section 3: B's home is the summit, too far to see except as a map dot.
