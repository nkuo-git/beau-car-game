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
