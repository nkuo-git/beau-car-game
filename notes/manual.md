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
