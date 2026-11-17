# Batch 68 — manual gearbox with a clutch (trial v80, 2026-11-06)

Nick: 「車子做手排的」. Mock https://claude.ai/artifact/MNb8vxG79wmRufgxrsfovt — v1 had no clutch; the card answer was 「要有離合器」, so v2 added a clutch button and got 「照這樣做」.

## UI
- `⋯` row: a new round button `#gearTog` (`自排` / `手排`, `aria-pressed` = manual) next to 🎵 (portrait: top 194 right 62; landscape: in the row at right 426, 「下車」 moves 426 → 478). One tap toggles. Stored per phone in `localStorage carid.gear` (`at` default). town.src.js `gearMode()` → `drv.setGearbox()`; also applied when a drive is created.
- drive.js HUD (only with `.dv.mt`): `.dv-clu` 「離合器」 hold button above 「📍 去哪裡」 (portrait: left 10 bottom 140, 134 wide, 116 on ≤379 px; landscape: right of 去哪裡 at left 170 bottom 88, 120×40); `.dv-up` / `.dv-dn` ▲升檔 ▼降檔 above the brake (right 94, bottom 100 / 154; portrait < 400 px the tach is raised to 96 so they go to 186 / 240; landscape (max-height 560) a row at bottom 88, right 94 / 166, 40 tall, under the 「下車」 row). `.dv-mth` hint pill above the tach. `body.destsopen` hides the clutch (the destination list stacks over it).
- Tach shows `N` (grey), `R`/`熄` (red) or the gear. The brake button never becomes 「倒車」 in manual.
- Keyboard: ShiftLeft/Right = clutch (`kb.C`), Q = up, Z = down.

## Physics (drive.js, `st.mt`)
- State: `mg` (−1 R, 0 N, 1–6), `clu` (0 pressed … 1 engaged; press is instant, release ramps 0.12 s), `stall`, `crank`, `grind`/`grindWhy`, `lim`, `limT`, `shq` (queued ▲▼). `st.gear` / `st.rev` follow `mg`, so every other system (sound load, ride, race, net) is unchanged.
- `mtStep()` runs at the top of `physics()`: shifts need `clu ≤ 0.3` else grind 1; R needs |v| ≤ 1.5 m/s else grind 2; `onShift` fires on upshifts ≥ 2 (engine voice `shift()`).
- `eng = mg === 0 || stall ? 0 : clu` scales drive torque (forward and reverse). In manual the throttle always drives (also in R) and the brake always brakes; the stand-still brake-hold toggle R ↔ 1 is kept but fires once per press (`hold = −1e9`).
- Stall: on the clutch-release edge (clu crosses 0.5 upward) when the wheel-driven rpm fraction < 0.12 and throttle < 0.15 → `stall`; `onEngine(false)` (town disposes the voice). Throttle > 0.3 starts a 0.6 s crank, then `onEngine(true)`. Only the release edge stalls: lugging a high gear just makes the car weak (hint 「檔太高了 ▼」).
- No auto shift. At redline (x ≥ 1) torque is cut (as before) and `lim` is set while the throttle is held: rpm target alternates 0.96 / 1.02 every 0.05 s; sound.js's own `limit` produces the cut sound.
- Over-rev after an early downshift: extra resistance `min(8, (x − 1.02)·60)·eng`.
- rpm target: engaged → wheels (+ the 1st-gear slip model); clutch in / N → `0.13 + 0.87·go`; stalled → 0 (slow filter); cranking → 0.07 ± wobble.
- `telemetry()` adds `mt, mgear, clutch, stalled, cranking, grind, limiter`; API `setGearbox(k)`, `shift(d)`, `gearbox`, `setInput({ clutch })`.
- Switching: to manual while moving = current gear, at a stop = N; `teleport()` → N, `parkAt()` → 1st.

## Tests
`mt-test.mjs`: Node part (22 checks on a fake car) + browser part (20 checks: toggle, persistence, buttons, 6 screen sizes with and without the ⋯ row, touch clutch + ▲, stall / restart with the engine voice, limiter, keyboard, lugging hint, back to auto, reload). Lesson: CDP `Input.dispatchTouchEvent` `touchEnd` lists the points being *released*, so `touchEnd [TU]` lets go of ▲ while the clutch finger stays. Regression: drift-test, test-b1, bump-test, top-test.

# Batch 69 — swipe shifter, real gear counts, AT/MT per car, smaller toasts (trial v81, 2026-11-07)

Nick after v80: a vertical shifter on the left (swipe up = +1, down = −1, one gear per swipe, 1 → N → R), gear counts looked up per car, an instant rpm rise on a sudden downshift, `AT`/`MT` labels with no MT on cars that are automatics in real life, and all pop-up texts smaller. Mock v3 on the same artifact, card 「照這樣做」.

## Shifter (`.dv-shf`)
- Built at HUD creation from `NG`: one `<b data-g>` per slot, top → bottom `NG … 1, N, R`. Left 10 / top 62 / 52 wide; slots 28 px (22 in landscape ≤ 560 tall). Hidden while `body.moreopen` (the ⋯ row's left buttons reach x ≈ 28 on a 390-wide phone) or `body.destsopen`; not drawn when the stage container is ≤ 300 tall (desktop non-fullscreen → keyboard only).
- Pointer handling: `pointerdown` → `human.clu = 1` (finger = clutch), remember `clientY`; `pointermove` past `SHF_SWIPE` (16 px) → `shift(±1)` once per touch (`H.shfDone`); `pointerup/cancel` → `human.clu = 0`. `touch-action: none`, `pointer-events: auto` (the `.dv` root is `pointer-events: none`, so every interactive element must opt in — first bug).
- Slot classes from `mtHud()` in one `set('shf', key)`: `cur` (+`stall`), `hot` on mg+1 (rpm > 0.86) or mg−1 (lugging), `lim` flashing on mg+1 at the limiter.
- The brake-hold R ↔ 1 toggle is **off in manual** (R lives on the shifter); auto unchanged.
- Landscape + manual: `body.mtgear` moves `#drivebar` (「去哪裡」) right 62 and down 10 so it clears the shifter and 「下車」 on a 338-tall phone.

## Gear counts
`PERF.ng` (default 6) and `PERF.mt` (manual available). drive.js `NG = clamp(ng, 2, 12)`; `GR` = `P.gears` when its length is NG, the stock 6 ratios for 6, otherwise a geometric spread 3.3 → 0.86. Everything that indexed `GR[5]` / `< 5` / `6` now uses `NG`. Monster truck: `ng: 2, gears: [2.1, 0.86]` (Powerglide-style). Sources (looked up 2026-11-07): Evo IX MR 6-speed, Grizzly-700-type ATV = CVT, monster trucks = 2-speed Powerglide, GR Yaris 6MT (8AT optional since 2024).

## Downshift rpm
On the clutch-release edge (clu crosses 0.5) with no stall: `st.rpm = max(st.rpm, min(1.08, xOf(v, gear)))`. Past the half point the rpm target follows the wheels fully (no `(1 − eng)·idle` blend), otherwise the snap was pulled back to ~0.66 within two frames. Neutral engine load is `go` (not `0.6·go`) so revving in N is loud.

## Toasts
`.dv-toast` / `.wk-toast`: 13 px, weight 600, `top: 132px` (under the minimap), `translate(-50%, 0)`. Race page `.toast` and garage `gtoast` 13 px. `.dv-mth` 13 px at bottom 140 (clear of 「去哪裡」).

## Tests
mt-test Node 26 (+ `ng: 5`, 2-speed array, downshift snap) and browser 30 (swipe via CDP `touchStart`/`touchMove`/`touchEnd`, one-gear-per-swipe, stall on release, limiter slot, downshift snap, 3 → N → R, R stays R when braking, automatic car 918 has no AT/MT button and 7 gears). Lessons: shifting into a lower gear at a standstill without gas stalls on release (correct), so the test rolls with light gas; the hint pill overlapped 「去哪裡」 at bottom 104 → 140.

test-b1 / test-app-b1 robot: with the GC8 at 5 gears the shop leg's timing changed and the robot got shoved by a crossing HY into a house front near (−245, −60), then pushed against it for 180 s (speed oscillating −0.1…0.4 m/s, so a speed-based stall timer never reached 2 s). The robot now backs out (brake-hold → R, 1.6 s, steer mirrored) whenever it has not moved 1.5 m in 3 s while not waiting for traffic, the door or a deliberate brake; the leg line prints `backed out of a jam N×`, and a failed leg prints the stuck samples (speed, throttle, brake, route length, position). Result: test-b1 151 ok, ALL CHECKS OK (650 s).

## Batch 74 (2026-11-07): neutral revs slower, louder downshift
Nick: 「降檔時的聲浪太小」「空檔踩的時候轉速表不要升那麼快」.
- **Free revving** (MT, engine not driving the wheels: neutral, or clutch down): the rpm chase rate was the same 12/s as in gear, so a stab of gas in N hit the limiter in a quarter second. Now `FREE_UP = 2.4` (half-way in 0.3 s, 90 % after 1 s) and in neutral it also falls slower (`FREE_DOWN = 4`). Clutch-down in gear still falls at 12 (the swipe test reads the drop six frames after the finger lands).
- **Downshift blip**: on the clutch-release edge, when the wheel-speed rpm is more than 0.06 above the engine rpm (a downshift), `st.blip = 0.55 s` and an event `['blip', gear]` → `onBlip` → `dvoice.shift()` (the shift sound: cut, blow-off, pops). While `blip > 0`, `st.load = max(load, 0.6 + 0.4·blip/0.55)`, so the engine voice plays a loud throttle stab instead of the coasting whisper (load 0 → amplitude 18 %).
- Tests: mt-test Node +2 (free-rev timing 0.25 s / 1 s / fall; blip load 0 → 0.94 → 0.73 → 0 and onBlip).

## Batch 89 (trial v100, 2026-11-14): ignition

Nick: 「車子發動要有點火」.
- Getting in / going out (town.src.js `makeDrv` → `ignStart()`, and `onGetIn` re-boarding the same car):
  - The engine voice starts at gain 0, `drv.ignite(0.85)` runs, and `engineAudio.starter({ key, dur })` plays.
  - Bicycles skip all of this.
- drive.js: `st.ign` counts down. The tach shakes around 0.075 (`ignT`), load is 0, and pressing the throttle (> 0.15) catches at once.
  - When it catches, the `ignite` event fires → `onIgnite` stops the starter and sets voice gain 1.
  - `st.flare` (1 s) pulls the tach up to 0.37 and back to idle. Display/sound only: `st.rpm` does not feed the forces.
- MT stall restart now also pushes `crank` (→ `onCrank`: starter sound for 0.6 s) and gets the flare when it catches.
- sound.js `starter()`:
  - A key click (bandpass noise), then the solenoid `clunk`.
  - The starter motor: a sawtooth 70→118 Hz through a lowpass, a gear whine, and noise.
  - Compression pulses at (200+60k)/60 × cylinders/2 per second, each dipping the motor and adding a 52 Hz thump.
  - `stop()` spins it up and fades it in 0.07 s.
  - The output gain is 0.4: measured offline, cranking is about −21 dB vs idle about −32 dB; at 1.0 it was 18 dB over idle.
- telemetry `igniting`.

## Batch 94 (trial v106, 2026-11-15): slower acceleration, tapering near top speed
Nick: 「車子加速稍微加慢一點」「車子越快加越慢不要到極速以後突然上不去」.
- drive.js: forward drive force × `ACC_K` 0.87 (not reverse). Above `TAPER0` 0.55 × top speed, the surplus
  (drive − resistance) is multiplied by (1 − s)^`TAPER_P` 0.4 (s = 0 → 1 between 0.55 and 1 × top), and capped at
  `TAPER_E`·√(m/s left to the cap): it eases into top speed instead of hitting it (before: 1.2–5.8 m/s² at 98% then a
  wall). Same for AT and MT.
- `o.accel0` keeps the old behaviour (drift-test compares with the old drive.js using it).

## Batch 96 (trial v108, 2026-11-16): manual on automatic cars, no stall
Nick: 「改成自排車也能換手排只是不會突然熄火」.
- Every car with an engine now shows the AT／MT button (town.src.js `mtOk(k)` = PERF entry and not `bike`). Cars without PERF `mt` (918, SP3, JESKO, C16, AV12, SN8, HY, LF, P8, monster, 小黃, Z2) get `drv.setGearbox('mt', mtOpt(k))` with `{ noStall: true }`.
- drive.js: `st.noStall` (set on every `setGearbox` call, even when the mode does not change). It only disables the stall on the clutch-release edge; with the clutch in and rpm below idle, `xr = max(0.13, x)` already keeps the engine at idle, so the car just sits there (like a torque converter). Everything else (grind, limiter, lugging hint, over-rev engine braking) is the same as a real manual. Telemetry has `noStall`.
- Shifter height: `--shh` = min(28px, 224px / slots) portrait, min(22px, 176px / slots, (100cqh − 160px) / slots) landscape (`--shn` = gears + 2 is set on `.dv-shf` when the HUD is built). Up to 6 gears nothing changes in portrait; a 10-speed P8 gets 18.7px slots, the same 232px column.
- Fixed while here (bug since batch 69): the MT shifter sat on top of the big action button (`.dv-act`, also top-left at 58px: 開鐵捲門, 上馬力機…) and, in portrait, the tower lift panel; in landscape at 338 px a 6-speed shifter overlapped the ◀ ▶ buttons by 6px. Now `.dv.mt .dv-act` moves to left 72px (17px text), `body.mtgear:not(.walking) #stage .elpanel` moves to left 72 / top 146 in portrait, and the landscape column stops above the steering buttons. AT layout unchanged.
- Tests: mt-test Node +4 (no stall in 1st and in 5th from standstill, drives off, plain `setGearbox('mt')` stalls again); browser: 918 has the button and the 7654321NR shifter, no stall, drives off; P8 12 slots at the tower door (act button + lift panel showing) on 6 screens with `.elpanel` added to the overlap check; the mtb has no button. 35 + 38 ok.

## Batch 97 (trial v109, 2026-11-17): softer downshift sound
Nick: 「降檔聲稍微不要那麼頓挫」.
- What made it jerky: on a downshift (clutch let go, revs jump up) drive.js set the sound load straight to 1 and, 0.55 s later, dropped it from 0.6 to 0 in one frame; town.src.js played `voice.shift()`, which is the upshift sound: a fuel cut (the engine sound stops for `cut` = 0.1–0.16 s), the blow-off valve and a string of pops; the sound's rpm followed the instant jump in about 20 ms.
- drive.js: `blipEnv(e)` = smoothstep attack over `BLIP_A` 0.05 s × (1 − smoothstep(e / `BLIP_T`)), `BLIP_T` 0.55 → 0.7 s; the load never jumps down. The tachometer still jumps up at once (batch 69: 「轉速要瞬間增加」).
- sound.js: new `voice.blip()` (worklet parameter `blip`, script fallback `core.blip()`): no fuel cut, no blow-off; the sound's rpm glides up (`glT` 0.18 s with a 0.04 s two-pole instead of 0.01 s); one or two small quiet pops 0.22–0.52 s later. town.src.js `onBlip` calls `blip` (falls back to `shift` on an old voice).
- Tests: mt-test Node +1 (load rises at most +0.42 a frame, falls at most −0.036 a frame (the old drop at the end was −0.6), peak 0.98, 0 after 1 s); sound-test +2 (gc8 and AV12: `blip()` drops < 6 dB while `shift()` still cuts > 8 dB; the sound's rpm is still near the start 10 ms after a blip and at the target after 250 ms). sound-test also has +2 for the AV12 tone below (7 ok in all).

## Batch 97 (trial v109, 2026-11-17): AV12 deep at low revs, brighter and louder up high
Nick: 「lamborghini AV12 低轉速時聲浪要低沉越高轉越高亢越大聲」.
- sound.js `P.tone` (only `aventador` has it), applied in `SND_core` before the volume stage: a one-pole low-pass splits the sound; low part × `bass`, high part × `treb`; the cut-off, `bass` and `treb` slide with the revs from `r[0]` 0.15 to `r[1]` 0.95 (smoothstep): 550 Hz / ×1.5 / ×0.35 at low revs (deep) → 2800 Hz / ×1.0 / ×1.7 at the top (bright). `lev` = [[rpm, dB]…] volume by revs, measured on a 0.025 grid so full throttle rises smoothly from −22 dB at 0.13 to −14.5 dB at 0.98 (the exhaust resonances used to make 0.45–0.65 quieter than 0.3). Idle stays about −27 dB.
- Measured (full throttle, sound-test): −21.1 / −20.0 / −18.9 / −17.5 / −16.5 / −15.1 / −14.5 dB at 0.2 / 0.3 / 0.45 / 0.6 / 0.75 / 0.9 / 0.98; spectral centroid 293 / 298 / 764 / 1749 / 2193 / 1826 / 2300 Hz.
- Scripts used to fit `lev` (not in the repo): a grid that measures full-throttle dB every 0.025 rpm with three seeds, and a fit that sets `lev` = target − measured and re-measures.

## Batch 98 (trial v110, 2026-11-17): start and stop the engine yourself
Nick: 「要可自己發動熄火熄火時大燈也要關掉 下車時車一樣發動只能在車上發動熄火 手排車熄火時把油門鍵改成發動鍵發動後做一個小熄火按鈕在換檔下方 AV12也是只是改成要踩著剎車才可以發動AV12發動時間大約1秒 去查AV12發動的聲音 / N檔踩油門放開轉速稍微掉慢一點」. Mock https://claude.ai/artifact/Kphfn8H9ekJ9PssyUJU9Ji (board "Main"); card unanswered, built on the recommended 「照這樣做」.
- No more automatic ignition on get-in (batch 89's `ignStart` is gone). drive.js `st.stall` now means "engine off" for AT and MT alike. While off, the gas pedal shows 「發動」 (power icon, `.dv-gas.start`); the press edge (`pressL` latch, throttle > 0.3) runs the starter for `CRANK` s (`P.crank`, 0.8; AV12 1.0) and then `engine` true (flare as batch 89). Holding the pedal does not count: release and press again (`stopEngine` sets `pressL`).
- AV12 (`P.startBrk`): the brake must be held (≥ 0.5) when 發動 is pressed; otherwise `needBrake` event + red hint 「踩著煞車，再按發動」 for 1.6 s (`nbT`: pressing the brake within that time still starts it). After it starts with the brake held, `brkLatch` stops the brake from turning into reverse until it is released.
- 「熄火」: a small button under the shifter (`.dv-off`; AT has no shifter: same spot in portrait, above 去哪裡 in landscape; hidden in the small non-fullscreen stage; key X) → `stopEngine()` → `onEngine(false)`. The car rolls on.
- town.src.js `ENG[car]` = engine running this trip. Get-out leaves it running (sound fades with distance: `engOut`, half at 7 m, ~0 at 30 m, silent indoors); get back in = still running. Parking in a bay, walking off to the lift (`dropDrv`), switching cars, being arrested, going back to the garage page = off. A new trip starts with every car off (`ENG` cleared). Bicycles have no engine (`NOENG`: always on, no button).
- Headlights: masks.js `carLamps(obj, on)` sets `material.userData.lampOff` on every material of the car; lamp shaders read `nightU(m)` (0 when off) instead of `PAINT_NIGHT` directly; look.js `headOn()` turns the spot light + beam off. `engLamps()` runs on start/stop, get-in, `parkFull`.
- Sound: sound.js `starter({ key })` for AV12 is higher and faster (saw × 1.3, gear whine × 1.45 and louder), 1.0 s; then a loud flare (PERF `flare` 0.26 ≈ 3000 rpm, `flareLoad` 0.9, back to idle in `flareT` 1.4 s).
- N revs (「N檔踩油門放開轉速稍微掉慢一點」): `FREE_DOWN` 4 → 2.5 (neutral, throttle released).
- Tests: test-b1 (engine off at get-in, 發動 → sound + lamps; walk away and back, still running), mt-test, seats-test (driver's seat: 發動 first), dyno-test (tap the gas after getting in). Tests that drive start the engine with a throttle tap (`H.start()`).

## Batch 98 (trial v111, 2026-11-17): car doors that open and close like the real car
Nick: 「車門做成是可自己打開關起來的 請上網查影片各車的開門樣子 像AV12是剪刀門上開的」 (mock https://claude.ai/artifact/Kphfn8H9ekJ9PssyUJU9Ji, board Doors; card 「照這樣做」).
- doors.js: a door = the car body (and the cabin's door panel) cut along the door's side-view polygon (sill to window line, then the window frame following the A pillar) and only the outer skin (`|z| > zIn`), hung on a hinge group under `door-rig` in `S.body`. All doors shut = the body's original geometry again (same trick as the trunk, mart.src.js `trunkCut`). Kinds (`DOOR_KIND`): conv (hinge at the front, swings out), scissor (AV12: hinge at the front, swings up), butterfly (SP3, SN8, LF: up and out), gull (HY: hinge on the roof), dihedral (JESKO: out, then up). Four-door cars (`DOOR_FOUR`: ALTIS, EVO, P8, FK) have rear doors too (back seat).
- Measurements (`DOOR_FIT`) are precomputed with `node door-fit.mjs [cars] [--write]` (cview.html `fit=1`): ray casts take seconds per car in the game (HY 64 s). door-fit reads doors.js first and rewrites the `DOOR_FIT` line at the end, so don't edit doors.js while it runs. `roof` samples the roof at z ±0.12 / ±0.3 (z 0 slips through the seam of the mirrored halves); `zOut` takes the widest non-glass skin hit along the door (J4's sill ray used to hit the frame rail). `node door-sheet.mjs <dir> [cars]` renders every car with all doors open.
- cardoor.src.js (`CD_ON`): only your own trip car (`tripS`, the full one) has working doors; no doors on Z2, N4, bicycles, the monster truck, borrowed cars, in a race. Walking: within 1.25 m of a shut door the big button is 「開車門 · X」 (opens in 0.6 s); an open door gives 「上車 · X」 + a second button 「關車門」 (replaces 選位子 on this car). The door you use decides the seat: the driver's side front door = drive, the other front door = passenger seat, rear doors = back seat (`cdSeatOf`). 上車 from anywhere else (the car's own 上車 button, tests calling `walker.getIn`) walks to the driver's door, which opens by itself; 下車 opens the door first and leaves it open.
- Driver side: GC8, YARIS, RX-7, GT-R, 86 and EVO are right-hand drive (cabin seats). walk.js `car.dside` (set by town.src.js `walkCars` / `outAt` from `cdSide(k)` = seat 0's side for door cars) makes the default 上車 walk round to that side and 下車 step out on it (`exitSpot` tries that side first); cars without doors keep the old rule (the side you stand on; left first on exit).
- Driving with a door open: stopped → top-left 「關車門」 (`cdDriveAct`, after the lift / roller-door / dyno buttons); faster than 2.5 m/s (9 km/h) the doors slam shut. Sitting in another seat: all doors close 1 s after you sit down. Doors and the trunk both cut the body, so opening one shuts the other first.
- drive.js `bodyBox` skips `door-rig`: the car's size used to be measured with the open door sticking out when you got in with it open, which put the 下車 spot 3 m to the side (so no door opened on the way out).
