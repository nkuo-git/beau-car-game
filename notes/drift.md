# 第 3 批：甩尾（drift）— b3-drift

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

Nick 2026-10-04「可以甩尾」. Folder: `old-scratch/b3-drift` (copy of trunk 0.8.35 `old-scratch/b2-intF`; trunk untouched).

## What works now
- **Real slide in drive.js**, layered over the kinematic bicycle model. New state `slip` (angle between heading and travel
  direction, nose right of travel = +), `slipV`, `loose` (rear grip lost 0–1). While `slip`/`slipV` are exactly 0 the original
  movement code runs unchanged — normal driving is **bit-identical** to trunk (checked against trunk drive.js for all 7 cars:
  gentle steering, braking, reversing, full lock at parking speed, short full-throttle taps).
- **Entries**: (1) handbrake while turning ≥ 22 km/h (full effect from 36 km/h); (2) full throttle + full lock held ≥ 0.25 s —
  RWD easily (power oversteer), AWD only on loose surfaces / very high power; (3) hard brake then snap to full lock within 0.6 s
  (flick); (4) fast sweeper ≥ 79 km/h while pushing, then lift off the throttle (lift-off oversteer).
- **Arcade assist** (works with the two digital steering buttons): pressing into the slide holds the max angle (RWD 35–45°,
  AWD 23–30°, off-road cars 17°; smaller at speed, a bit bigger on grass/dirt, bigger while the handbrake is held); letting go
  regains grip smoothly; pressing the other way straightens quickly; beyond the max angle it countersteers itself (no spins);
  the front wheels visibly point along the travel direction (countersteer look). Throttle sustains the slide (RWD high power
  longest; AWD grips back by itself). Speed bleeds a little (side-force drag; drive force capped while sliding).
- **Never at low speed**: below 22 km/h nothing changes (parking, garage, lifts, shops, auto-park); `parkAt`, `teleport`,
  `pause`/`release`, reversing, being blocked → slide state cleared.
- **Per car** from PERF (`awd`, `hp`, `kg`, `offroad`): amax/sustain/decay/power-entry derived from hp/kg and drive type.
  Off-road cars (monster truck, `perf.offroad`): only the handbrake makes them slide, max 17°; no power/flick/lift-off entries.
- **Surfaces**: grass ×1.5, paddy ×1.7, dirt ×1.4, mud ×1.6, sand ×1.5 looser (bigger angles, easier entry).
- **Collisions**: impact speed uses the travel direction while sliding; a hard hit ends the slide; crash damage (`onImpact`)
  unchanged; wall sliding unchanged.
- **Touch UI**: 「手煞車」 button (dark rounded, orange text, `.on` = orange like the pedals) above 油門 in portrait; in short
  screens (≤ 560 px tall) left of 煞車; in very short stages (non-fullscreen phone landscape, container ≤ 290 px) further left
  so it never covers 下車. Multi-touch with steering and throttle (own pointer capture). Space = handbrake (header text fixed:
  空白鍵手煞車); help text says how to drift.
- **Feedback**: tyre smoke (96 pooled instanced billboards, 1 draw call), skid marks (640-quad ring buffer that fades over 18 s,
  1 draw call, only the newly written range is uploaded), both hidden when nothing is alive (0 draw calls); shared per scene
  (marks stay when you get out and back in). Squeal through `engineAudio.skid(level, pitch, dirt)` (same master output → volume
  & mute respected; one node set; level 0 fades and frees after 1 s). Chase camera yaw follows travel direction 60 %.
  「甩尾 35°」 pill above the speedometer while sliding (shows after 0.25 s, hides 0.6 s after).
- **telemetry()** new fields (old meanings unchanged): `slip`, `travel`, `drift` (0–1), `drifting` (> 10°), `drifts` (count),
  `loose`, `skid` (0–1), `handbrake` (0/1), `marks` (visible skid-mark pieces), `smoke` (live puffs). `v` is along travel.

## Files
- changed: `drive.js` (all of the above), `sound.js` (`audio.skid()`), `town.src.js` (`createDrive({ …, audio: engineAudio })`),
  `garage.src.html` (help text), `test-b1.mjs` (HUD_SEL + `.dv-hb`, so every existing overlap sweep also checks the button)
- added: `drift-test.mjs` (Node part `--node` ~3 s; browser part ~2–3 min), `port-drift.mjs` (port), `port-drift-gen.py`
  (regenerates port-drift.mjs from trunk vs this folder; not needed to port)
- No new modules (build lists unchanged); no new save fields.

## How to port
`node src/port-drift.mjs <dir> [--dry]` — 43 exact-text edits (42 + adds drift-test.mjs), prints OK/FAIL per edit,
writes nothing if any edit fails, second run = "0 applied, 43 already there". Anchors avoid every line the police work changes
(b3-int: setMarkers, `camBlock` in rayHit, the `const cam` line, cop-camera block, drawMap marks). Verified: trunk copy →
files identical to b3-drift; b3-int copy (police already in) → all 43 OK, both features present, module loads; re-run no-op.
(`b3-police/drive-markers.patch` already fails 2 hunks on trunk — it predates batch 4; b3-int merged it by hand; my port does
not touch those regions.) Then `node build-art.mjs --yaris`.
For the circuit agent (b3-circuit uses drive.js): skid marks are drawn at y 0.045 (village road decks are 0.03, decals 0.05);
a circuit with a higher road surface needs `world.heightAt`/ride or a tweak of `gy()` in drive.js.

## Tests (all on old-scratch/b3-drift, run one at a time)
- `node test-b1.mjs shots-b1/b1` → **ALL CHECKS OK, 140 ok, 0 FAIL, no page errors, exit 0** (745 s) — log `old-scratch/b3-drift/b1-drift-log1.txt`,
  shots `old-scratch/b3-drift/shots-b1/` (its HUD overlap sweeps now include `.dv-hb`).
- `node test-b4.mjs shots-b4/b4` → **ALL CHECKS OK, 66 ok, 0 FAIL, no page errors, exit 0** (297 s; monster truck legs + off-road
  race unchanged) — log `old-scratch/b3-drift/b4-drift-log1.txt`, shots `old-scratch/b3-drift/shots-b4/`.
- `node drift-test.mjs shots-drift/d4` → **ALL OK, 42 ok (26 Node + 16 browser), exit 0** (94 s) — log `old-scratch/b3-drift/drift-log4.txt`.
  Node part alone: `node drift-test.mjs --node` (~3 s; compares with trunk drive.js in `TRUNK`, default `../b2-intF`).
  Key numbers: handbrake at 60 km/h SUPRA 36° / SP3 39° / JESKO 45° (grip again 0.55–0.57 s), AWD GC8 25° / YARIS 25° / GTR 26° /
  P918 30° (0.35–0.38 s); car swings 87–89°, no spins. Full throttle + full lock from 45: SUPRA 35°, SP3 38°, JESKO 44° held;
  GC8 0°, YARIS 1°, GTR 2°, P918 8°. Flick at 80: SUPRA 21°, JESKO 28°, GC8 11°. Handbrake at 150: SUPRA 19°, JESKO 24°, GC8 13°.
  Lift-off at 140: SUPRA 10°, SP3 13°. Grass vs road: SUPRA 40 vs 34°, GC8 26 vs 22°. Below 22 km/h: 0 slides in ~1300 frames
  per car. Normal driving bit-identical to trunk for all 7 cars. Off-road lap 38.4 s, 0° (same as trunk), with handbrake 10°.
- Screenshots: `old-scratch/b3-drift/shots-drift/d4-1-drift.png` (touch drift, 甩尾 40° pill, marks, smoke), `d4-2-drift-left.png`,
  `d4-3-marks.png`, `d4-3b-marks-above.png`, `d4-4-perf-drift.png`, `d4-5-clean.png` (faded), `d4-6-landscape-fs.png`,
  `d4-6b-landscape-page.png`, `d4-7-hud-portrait.png`.
- `node build-art.mjs --yaris` → OK (garage.html 2,128,012 bytes).
- Port: trunk copy → 43 applied, files byte-identical to b3-drift, 2nd run "0 applied, 43 already there"; b3-int copy → 43 applied,
  police code intact (setMarkers), drive.js/sound.js load; a copy missing test-b1.mjs → "1 FAILED — nothing written" (nothing written).

## Perf
- Browser (SwiftShader test machine): driveStep 0.24 ms normal vs 0.23 ms drifting (NPC/town included).
- Render while sliding: 96–109 calls, 615–631k triangles depending on view; marks + smoke cost exactly +2 calls, +948 triangles
  (98 vs 96 in the same view); 0 calls once faded. Node `update(1/60)`: 0.004 ms normal, 0.006 ms drifting.
- No per-frame allocations in the slide/fx path (preallocated vectors, ring buffer, partial buffer uploads).

## Open issues / limits
- Squeal loudness (`audio.skid`) is set by ear on paper (master 0.32 × level, under the engine) and was checked only for
  being called/muted/torn down — not measured with sound-render / not listened to. Nick may want it louder/softer.
- Circuit (b3-circuit): marks are drawn at road height + 0.04/0.045 from `ride.ground`; if the circuit road surface is not what
  `ride.ground` reports, marks may hide under it or float. Check once the circuit is merged.
- App test (`test-app-b1.mjs`) HUD selector list not updated with `.dv-hb` and not run (only test-b1 was asked); add `.dv-hb`
  there too when the app is rebuilt.
- Non-fullscreen phone landscape (page 800×360 / 915×412): the stage is small; 手煞車 sits between the speedometer and 煞車 left of
  them (no overlap, checked) — tight but usable. Pre-existing crowding there is unchanged.
- Road cars driven on dirt/grass slide more with full throttle (by design); this makes SUPRA slower on the off-road course
  (50 s vs offroad truck 38 s). Off-road races use the monster truck, so no race result changed.
- Only cars driven by drive.js slide (free driving, off-road course/races). The 400 m drag race (race.src.js, its own straight-line
  physics) and NPC/AI cars are unchanged and do not drift.
