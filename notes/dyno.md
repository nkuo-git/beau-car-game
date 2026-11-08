# Dyno (馬力機) — batch 77, trial v89 (2026-11-08)

Nick: 「改車廠裡要有一個馬力機 可以自己把車開上去 車就跟原本一樣快 換檔啥的都一樣 只是在原地 旁邊要有一個螢幕顯示剛的車速跟馬力曲線圖」.
Mock: https://claude.ai/artifact/ENbFFWeqJxurXLgrTaE3j6 (card 「兩個都做」: dyno first, MRT station = batch 78).

## Where
- 阿輝改車廠, east roller door (local x 8.5…14.5 at z 0) is now open (was a closed door with a white car behind it; both removed).
  `village.js` shop block: wall `wp(3…8.5)` + `wp(14.5…18)` + lintel `wp(8.5…14.5, y 4.6…7.4, col=false)`, sill split the same way.
- Pad: local (10, −8.5), 3.8 × 8.6 m, dark plate at y 0.045 with yellow/black stripe border (floor quads at 0.05).
  Control cabinet (blue, x 12.6…13.4, z −9.2…−7.8), screen: two posts + black frame 3.9 × 2.15 m at local z −14.3, y 1.2…3.35, yellow top bar.
  All in `V.places.shop.dyno = { pad, pose, screen, off }`: pad = where the button shows, pose = strapped position (−150, −34.5, heading north),
  screen = { x, y, z, w, h } for the canvas plane (faces +z, towards the car), off = where the car backs out to (−150, −24.5 = in the forecourt).

## drive.js
- `setDyno(pose | null)`, `st.dyno`. In `update()` the input goes through `dynoInp()` (steer = 0, handbrake = 0; throttle/brake/clutch untouched) and after every
  `physics(h)` step `dynoPin()` puts x/z/heading back and zeroes slip/kap/alat/steer. Speed, gear, rpm, MT clutch/stall, shift events, the engine sound: all
  as on the road, so the wheels spin at the right speed (`st.spin`).
- `st.pw` = power the engine sends to the wheels this step (W) = `fE · dmgP.power · eng · u` where `fE` is the drivetrain force before the traction cap
  (so the curve is the engine, not grip); `st.px` = revs ÷ redline at that step. Telemetry: `dyno`, `whp` (= pw / 745.7), `whpX`, `redline`.
  Peak = 0.88 × PERF.hp (the 12 % drivetrain loss already in the engine model), at ~98 % revs.

## town.src.js (`DYNO`, after `bayAct`)
- `dynoBuild()` once VIL exists: group with the screen plane (`CanvasTexture` 768 × 432, `MeshBasicMaterial`, `toneMapped: false` so it is bright at night),
  4 rollers (one `InstancedMesh`, cylinders r 0.16, axis sideways, centre y −0.08 so the tops (0.08) stay under the tyre between the two rollers of a wheel)
  and 2 slot plates. +3 draw calls. Rollers are placed under the mounted car's axles (`tripS.wheels[i].parent.position.x`, width from the hub z) — bikes
  and motorcycles have 4 hub positions too (two overlap), so the Set of x values gives the two axles.
- `dynoAct(t)`: on the pad (margin 0.5 m, < 6 m/s) → 「上馬力機」; strapped → 「下馬力機」; `bayLock.dyno` until you drive 3 m off the pad.
  Borrowed car: toast, no dyno. 「下車」 (`OUT_ACT`) is hidden while strapped.
- `dynoOn()`: `drv.parkAt(pose)` then `drv.setDyno(pose)`, bins reset, rollers placed, toast.
- `dynoStep(dt)` every frame (also on foot, so the idle screen exists): envelope of max whp per rev bin (48 bins), peak, max kmh, roller spin
  (`ang += v·dt / r`), redraw every 3 frames. If the drv changes or the trip ends while strapped (換車, 直接回車庫) it just resets.
- `dynoDraw(t)`: header (店名、車名), tiles 車速 / 轉速 / 檔位 (N, R, 熄) / 輪上馬力, chart: x = rpm 0…redline, left axis hp (orange, 4 px),
  right axis Nm (blue; torque = P / ω per bin), grey dashed = `GAME.best.dyno[cur].c` (上次), 最大 … hp @ … rpm text, legend. Idle: 「把車開上台子，按「上馬力機」」.
- `dynoOff()`: `setDyno(null)`, save `GAME.best.dyno[cur] = { hp, rpm, kmh, c[48] }` (`save(true)`), clear the run so the screen shows it as the grey 上次 line,
  `parkAt(off)` = reverse straight out to the door (stepAuto gives negative v for a straight backward move, so the wheels roll backwards), toast with the number.
- Save: `garage.src.html` `GAME.best.dyno` (init/reset), load validates each entry (hp > 0, 48 ints).

## Numbers (SwiftShader 390 × 844, 普通)
GC8 strapped, chase cam: 173 calls / 0.56 M tris; revving 160 / 0.55 M; eye 79 / 0.29 M; 高 at 22:00 163. GC8 run: 251 hp @ 7800 rpm (0.88 × 280 = 246; the
limiter sits at 1.02 × redline so the last bin is a bit over).

## Test
`node dyno-test.mjs ../out/dyno/dy`: Node (setDyno pins the car, 0.88 × hp, release moves) + browser (east door open and drivable, pad button, strap,
6 s full throttle with the wheel turned → no drift, curve on the canvas (pixel count), screenshots chase/eye/night, 下馬力機 backs out, save + reload, lock).
Lesson: in a test never hold the brake after the car has stopped (AT: brake while stopped = reverse gear), use throttle 0 / brake only while moving.
