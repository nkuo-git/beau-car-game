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
