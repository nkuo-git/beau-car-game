# MRT station (捷運站) — batch 78, trial v90 (2026-11-08)

Nick: 「內湖的捷運站要從地面建起 要有正反方向的捷運開來開去 要真的可以搭…要可以自己走進捷運站並等車 每過一段時間來一班車」.
Mock: https://claude.ai/artifact/ENbFFWeqJxurXLgrTaE3j6 (card 「兩個都做」: dyno = batch 77 / v89 first, then this).

## What you get
- 港墘 and 文德 (the two stations already in neihu-data.js) are now real 3-level buildings under the existing elevated guideway:
  level 0 street → entrance stairs (two 出口 per station, each a 9.4 m tall glass box with a flat roof so the camera never
  pokes through) → level 1 concourse (±22 × ±9 m, gates, boards, a footbridge from each entrance) → ramps (two, one per
  side) → level 2 side platforms (±30 m, full-height platform doors at v 3.3, glass back wall at 7.8).
- Trains (white, brown band, 4 cars, driverless; no real logo): both directions, every 90 s (`H`), dwell 15 s (`DWELL`),
  22 m/s max, 1.2 m/s². Cycle = 180 s. Each direction runs tunnel mouth → 港墘 → 文德 → tunnel mouth (dir +1 = east)
  and back (dir −1), phase 0 / 45 s. Doors (train + platform door) open together on the platform side only.
- Walk in, gates go 「嗶！（免費）」, 「叮咚！往文德的列車進站了」 when a train opens its doors, walk into a car; when the doors
  close you are riding (`walker.shift` every frame moves you and the camera with the car), 「下一站　文德」, 「叮咚！文德　到了
  （終點站，請下車）」, big button 「下車」 (teleports you to the platform through the nearest door), walk down and out.
  Staying on past the terminus ejects you onto the platform (「終點站，請下車」). Your car stays where you parked it.
- Timetable facts (`M.info.dirs`): dir +1: 港墘 dwell 41.9–56.9, 文德 121.8–136.8; dir −1 (phase 45): 文德 35.2–50.2,
  港墘 115–130. Door u positions `DOOR_U = (i − 1.5)·14.4 ± 3.6`.

## Files
- `src/mrt.js` (new; IIFE exporting `buildMrt`, `MRT_TEXT`; in build-art.mjs and build-app.mjs just before `neihu.js`).
  `buildMrt(V, { renderer })` after `buildNeihu` (needs `V.neihu.data/roadAt/hillH/inBox`). Station frame: u along the track
  (+u = +s = east), v across (+v = right of eastbound travel = eastbound platform); `S.loc(x,z)` / `S.toW(u,v)`.
  Levels: `YT` = guideway (11.5), `YP = YT + 1.1` platform, `YC = 6` concourse, `CEIL1 9.4`, `CEIL2 = YP + 4.4`, entrance box `HT = YC + 3.4`.
  Two tracks at v = ±`TRK_V` (1.95); car half-width 1.28 → outer skin 7 cm from the platform door.
  API: `update(camera, dt)`, `heightAt(x,z)` (several candidates: platform, track/car floor, concourse, bridge, stairs; picks the
  one nearest last frame's y — the concourse is under the platform and the street under the bridge), `at(x,z)` → station index,
  `cols(si, lvl)` static colliders per level, `movers` (platform-door leaves, car walls; rebuilt each frame), `step(dt, px, pz, py,
  walking)` → `{ shift, lvl (0 street / 1 concourse / 2 platform / 3 riding), si, ride, toast, chime, beep, action 'off', eject, cap }`,
  `getOff(px,pz)`, `leave()`, `setTime(t)` / `time`, `trains()`, `info`, `street` (street-level colliders), `dirLabel`.
  Draw calls: all station geometry is merged per station (wall / glass / light meshes) + 3 InstancedMesh for cars / car glass / door
  leaves + 1 for platform doors; stations hide beyond 1500 m, trains beyond 2600 m.
- `src/neihu.js`: `NH_MRT_V2 = true` → old painted station houses, entrances and name signs skipped (sound walls kept);
  exports `roadAt(x,z)` → `{ d, w, sw, nm }` (nearest road, distance from centreline) so mrt.js puts nothing on the carriageway.
- `src/walk.js`: `shift(dx, dz, dth)` moves the walker and camera yaw together (riding).
- `src/town.src.js`: `MRTS`, `mrtStep(dt)` (called every frame while out, before `walker.update`): swaps colliders
  (`removeColliders('world')` + `addColliders(M.cols(si,lvl),'mrt'+lvl)`), `setMovers(M.movers)`, `setCarReach(false)`,
  camera `maxY: r.cap` (car ceiling YP+2.0, platform CEIL2, concourse CEIL1, entrance box YC+3.2), `setAction(下車)`;
  `mrtOff()`, `mrtDown()` (back to garage / arrested: clear ride, restore street colliders), `mrtSnd('chime'|'beep')`
  (sine notes on the engine-audio bus so mute/volume apply). `walkWorld().heightAt` asks `VIL.mrt.heightAt` first; `ldScan`
  (live houses) is skipped while `MRTS.lvl`.

## Lessons
- Cars sat on the centreline at first with doors open both sides → the player walked straight through the train. Offset by
  `TRK_V·dir` and open doors only on `q > 0` (platform side in car-local frame).
- Entrance canopies at 2.6 m put the camera inside the roof on the stairs; replaced by the 9.4 m glass box + per-level `cap`.
  Inside a car the cap is YP+2.0 (car roof), otherwise the platform ceiling.
- A `//` comment inside a one-line block swallowed the rest of the line (page error "Unexpected token '}'").
- Sign material must be FrontSide — DoubleSide text read mirrored through the glass.
- Probe: `.dv-act2` (下車 pill) click did nothing from Playwright; tests call `leaveCar()` through the hook after braking to a stop
  (in AT, holding brake after stopping = reverse).

## Test
`node mrt-test.mjs ../out/mrt/mt` (browser only, 960×576, gc8 save, 高): station built (names, levels, timetable, no street collider
on a carriageway), walk up 出口 1 → gates beep → ramp → platform; `M.setTime` to just before the eastbound train, chime toast,
walk in, ride (shift > 150 m, toasts), 「下車」 at 文德, walk down the second gate row and out; day + night shots, draw calls.

## Batch 79 (trial v91): smooth start/stop
- Nick: train "jumps to the next station"; wants slow start and slow stop, not too long. `runP(L, t)` is now an S-curve (jerk-limited: v = Vp·s²(3−2s) over TA = Vp/ACC), `VM 36`, `ACC 2.0` (peak 3 m/s²). 港墘 → 文德 ≈ 46 s (was 65).
- A probe ride showed no teleport: ~100 m per 5 s, smooth. The car interior is a plain white box and the camera faces the doors, so motion is hard to see — fix with the station/train rework (windows, outside visible).

## Batch 80 (trial v92): station + train rework
Nick 2026-11-08: 「捷運太假了」「捷運站做成橫跨內湖路的建築…把會與捷運站重疊的房子去除…有電扶梯跟樓梯…不要太小」
「等候區大一點顏色也不要那麼單調譬如說禁止跨越區捷運路線圖」「有些東西要做的有棱有角不要那麼方正」.
- Bigger station: platform PV1 10.4, concourse CV 11. Gabled roof with chamfered brown eaves and slanted fins; pillars and
  street columns are octagonal prisms (`M.prism`).
- Platform: floor hole to `HOLE1` 8.8; per door 下車 hatch + two green 排隊 lanes; 禁止跨越 zones at both ends (yellow/black
  barrier + collider at u ±(PL−2.6) + wall sign); back wall of 10 coloured bays with the 文湖線 route map (`WENHU`, 24 real
  station names, `routeMap`) and posters (all made up). All drawn from one 1024² canvas per station (`decoAtlas`, mesh `mrt-deco`).
- Escalators (`escal` → `ESCS`): platform ↔ concourse beside each stair, street ↔ exit beside each exit stair. Steps are one
  InstancedMesh (`mrt-esc-steps`) moved in `drawSteps()` only when near. A walker on one gets `out.shift` along the run at
  `ESC_V` 0.55 m/s (still walks too).
- Exits: per-station table `entDefs` from a road probe (港墘 over 內湖路一段: both exits north of the road at v 19.5/21.5;
  文德: one each side). Each exit = 5 m enclosed wing from the concourse + 2.6 m stair + 1.5 m escalator under a sloped roof
  (`e.roofAt(u)` for the camera cap, `exitCap`).
- Houses: `mrtKeepOut(N)` (station footprint + exit boxes + wings, in world rects) is checked in neihu.js before building;
  overlapping buildings get `b.mrt` and are skipped (neihu.js, nhstreet.js, minimap). 6 removed. `N.mrtIn(x, z)` also drops
  street trees and nhstreet props (palms, lamps, shelters, scooters) inside — a 9 m palm under the concourse poked through the floor.
- Train: grey body, green stripe, black window band, big windows, navy/blue longitudinal seats, poles, handrails, gangway ends;
  separate nose mesh (sloped windscreen, round lamps) on both ends; door glass; a generic route strip over the doors.
- Numbers (960×576, 高): 19 meshes / 37k tris for both stations + trains; street 198/218 calls, concourse 131, platform 194,
  riding 119, 文德 platform 105, 文德 street 244 / 0.77M.
- mrt-test section 10: escalator count + steps, deco meshes, noses, houses removed, escalator ride 0 → 6.

## Batch 82 (trial v94, 2026-11-09): brighter station and train, ride can't drop you to the street

Nick: station and train interior too dark, view out of the windows too dark, "halfway through the ride I'm suddenly on the ground", stairs overlap shops/signs, no escalators. (Escalators and the house removal exist since v92; the phone build, content 41, is still v90.)

- Self-lit fill: `mats.wall` and `mats.train` get an `onBeforeCompile` that adds `vColor * self` to emissive, plus `vColor * lamp` when all three channels ≥ 0.945 (the ceiling lamp strips in the cars). `SELF = { wall: [0.24, 1.6], train: [0.34, 1.8] }`; cache keys `mrt-self-wall` / `mrt-self-train` (look.js appends `|lk1`). Works at every look level and hour.
- look.js `indoor(cam)` may now return a number 0..1; town.src.js returns 0.7 while `MRTS.lvl > 0` (station or train), 1 inside the tower.
- Train window glass `tglass` 0xa9bcc6, opacity 0.16 (was 0x2a3a46 / 0.45).
- Ride hardening in `step`: when `walking` is false but `P.ride` is set, the walker is still carried (shift) and stays riding; with doors closed a walker outside the car's inner box is clamped back (|lu| ≤ 6.6, |lv| ≤ CAR_W − 0.3) by adding to `out.shift`; a walker more than 12 / 5 m from the car (teleported) stops riding. `heightAt` while riding: YP within 3 m of the car (was 1 m).
- Could not reproduce the drop in the browser (both directions, 15 fps, walking around inside); these close the paths that would put a rider at street height.
- neihu.js: vertical shop signs whose tip is in `N.mrtIn`, and road sign posts at/over the keep-out, are not built.
- mrt-test 7b checks the pause, the push through the wall, the self-lit keys and the glass.

## Batch 87 (trial v98, 2026-11-11): animals in the stations; train key no longer changes at the 180 s wrap

Nick's original 2026-11-08 ask included 「捷運站也要有生物」; on 2026-11-11 he said 「做1. 2」 (1 = this).

- `buildMrt(V, { makeAnimal })` — town.src.js passes animals.js `buildAnimal`. Nothing is built until the camera is within
  400 m of a station (`zInit`), then up to 3 models per frame (`mrt-animal-<kind>`, 2 draw calls each, hidden past 90 m).
- Per station: concourse 4 (2 in each of the two biggest walkable areas = outside / inside the gates), platform 3 per side.
- Walking: per level a 0.25 m grid in station-local u/v (`zNav`): level colliders inflated 0.5 m, the stair/escalator
  holes, the track (|v| < PV0) and the footbridge mouths blocked; 4-neighbour components so an animal never paths to an
  area it can't reach. BFS (8-neighbour, no corner cutting) + greedy line-of-sight string-pull (`zPath`); at most one path
  search per frame (`Z.budget`). They stop for you or another animal 0.75 m ahead and re-pick after 1.6 s blocked.
- Platform life: 45 % of picks go to a free queue spot (door ± 1.35 m at v = PV0 + 0.95); doors in front of the stair hole
  are skipped (`zDoorsOK`). When a train's doors open (`open > 0.7`, once per `key@si`, `Z.done` cleared when the doors
  close): its riders alight (`zAlight`: door → PSD gap → platform cell); at the train's first stop it also brings up to 2
  riders from the tunnel (`zPlaceRider`); then waiting animals board (`zBoard`): queueing ones always, others 55 %
  (85 % when > 3), always leaving ≥ 1 on the platform; if none boarded, the one nearest a door (≤ 6 m) does. A boarder that
  hasn't reached the doorway 2.4 s before the doors close goes back to the platform. Riders store car-local `lu/lv` and
  follow the car; a rider whose train leaves the line (tunnel) is recycled (`st 'gone'`, record reused).
- Walker collision: `zMovers` pushes a circle per standing/walking animal into `M.movers` (platform/concourse of your
  station, or the riders of your car while you ride). Boarding/alighting animals don't block.
- **Bug fixed while testing**: the train key was `dir:k mod 1000` with `k` from the wrapped clock (`time % 180`), so every
  train got a new key at the wrap. A rider (you) was then treated as "列車開進隧道了" mid-ride and left in the air → fell to
  the street. This is very likely Nick's batch-82 report 「開到一半我就突然跑到地面」 (a 46 s ride crosses the wrap about
  one time in four; the test never did). Now `key = dir:(k + lap·CYCLE/H)` with `lap` counting wraps.
- `M.trains()` now includes `key`; `M.animals()` and `M.zoo` are for tests.
- mrt-test section 11: keys survive the wrap; counts per station/side, three kinds, floors/walls, 14 s of walking (speed
  ≤ 1.2 m/s), you're blocked by a standing one, an eastbound dwell at 港墘 (some board, ride inside their car at 12.6,
  walk out at 文德; tunnel riders get off at 港墘), visible count = 2 meshes each, draw calls.
- Numbers (960×576, 高, same views as section 2): concourse 133 calls / 0.43M (v97 131), platform 198 / 0.54M (v97 194) —
  +2 calls per animal in view; animal close-ups 108 / 0.32M and 96 / 0.25M. update+step stays small (≤ 1 path search a frame).

## Batch 89 (trial v100, 2026-11-14): floor marks no longer float over the stairs

Nick: 「捷運站的等候線不要懸空在樓梯上」.
- Cause: the doors at u 3.6 and 10.8 sit next to the stair/escalator hole in the platform floor (u 0…12, |v| 4.6…8.8). Their 下車 decal reached v 5.3 and the 排隊 decals reached v 6.3, past the glass rail at 4.6, so they hung in the air over the stairs.
- Fix: a door whose marks (d ± 1.8) overlap the hole uses short marks in the 0.58 m strip between the yellow tactile line and the rail (v a+0.6 … r0−0.12).
  - A wide 「下車」 (`DEC.offW`, 384×140 in the atlas, 1.6 × 0.58 m).
  - Two small square 「排隊」 (`DEC.queueS`, 140×140, 0.58 m). Same u as before (d ± 1.35).
  - The animals' queue spot (ZQV 4.25) is in that strip already.
- `M.info.hole` = { u0, u1, v0, v1 } (station coords) for tests.
- mrt-test section 10 adds a check: no floor-level vertex of `mrt-deco` is inside the hole.
