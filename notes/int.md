# b3-int: police + gun shop wired into the full game (2026-10-04)

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

Nick asked: 「警察追人抓人、槍店買槍射擊繼續做」. Folder: old-scratch/b3-int, a copy of the 0.8.35 trunk old-scratch/b2-intF. The trunk was not touched.
The trial page is built: `node build-art.mjs --yaris` → old-scratch/b3-int/art/garage.html.

## What works now (full game, trial page)
- **Crimes → stars.** These follow police.md.
  - Punching someone with the round 揍 button gives 1★. The button is on the right while walking (key F).
  - Hitting someone with the car gives 2★.
  - Shooting a person gives 3★ at once. Shooting an officer or a police car gives +1★.
  - Kids can never be hit, by a punch, a car or a gun. npc.js carCheck now also skips kids for the knockdown and the "freeze" reaction.
  - The 通緝中 star bar is at the top. The minimap, the camera button, the fullscreen button and the sound button move down 46 px under it on tall screens.
- **Chase.**
  - Police cars leave the police station with sirens and red/blue lights, and show as dots on the minimap (drive.js/walk.js `setMarkers`).
  - They chase you on the roads and box you in. Officers get out and run after you.
  - Police never shoot. Over all e2e runs, officer poses were only idle/walk/run/fall/getup.
- **Arrest.**
  1. 「被警察抓到了！」 (red toast), then fade.
  2. You are in the jail cell inside the police station. The cell door is shut and the cell collider is on.
  3. The jail card counts 30 s and has 「繳罰款 NT$ N 萬，馬上出去」 (2 萬 per star).
  4. You are released at the station door. If you were caught in the car, the car is towed to the station yard and you get 「你的車停在警察局的停車場」.

  While you are jailed, the destination bar, the 揍 button and the gun HUD are hidden. Arrest never takes guns or ammo.
- **Losing them.**
  - The escape timer only starts once the police have seen you. If they never see you, a 45 s "hunt" grace runs first (police-ai.js TUNE.hunt).
  - 25 s unseen loses a star, then one every 10 s after that.
  - Hiding in a house counts as unseen.
  - Walking or driving into your own garage and pressing 關鐵捲門 clears all stars. That button is a new action while you are wanted.
- **Police station.** You can enter it on foot like the houses (police.js interior, 「警察局：拘留室在後面」). The cell door is open when you visit. If you walk in while wanted, you surrender: 「自首：警察帶你去拘留室」 → jail.
- **Gun shop.** You enter on foot. The interior is built the first time you go in.
  - **Counter.** 「買槍、子彈」 opens the shop panel under the picture, like the tuning shop. Tap twice to buy; prices are in guns.md. A bought gun is drawn when you leave the counter.
  - **No shooting in the shop.** Firing outside the range shows 「店裡不可以開槍⋯」.
  - **Range.** 「開始練習」 starts a countdown and 6 targets. The first perfect round for each gun pays 2 萬; later rounds pay nothing. Range shooting is never a crime.
- **Guns outside.**
  - Aim (V or the button), fire (F or the button), reload (R or the button).
  - The ammo pill opens the weapon wheel. Keys 1–4 and Q pick a gun; X puts it away.
  - When you draw a gun, 揍 is replaced by 開槍／瞄準／換彈匣.
  - Guns are put away and disabled while driving: the HUD is hidden and F/1/Q/R/V do nothing. They are also disabled inside houses, the police station, jail and the shop counter.
- **Saving.** GAME.guns `{owned, ammo, mag, cur, range:{best,time,paid}}` is in save() and repaired on load with gunSave.load. Old saves without `guns` load fine. 重新開始 resets guns and calls townReset() (clears stars, puts the gun away).
- **Open issues fixed from police.md / guns.md.**
  - Chase camera clipping the light bar: a police car box now blocks the camera ray (camera pulls in), and the camera lifts above a police car it is next to.
  - Toasts: non-red police toasts go through the walker/drive toast, so two toasts no longer stack. While wanted on tall screens the toast sits at max(34%, 322px) so it does not cover the pushed-down ammo pill.
  - Preload: the loading screen has the step 「警察局、槍店準備中⋯」, which builds the 3 cars, 3 officers and the station interior.
  - Escape timer: it no longer starts before you are ever seen.
- **Layouts.** Fullscreen and normal at 360×800, 412×915, 915×412, 800×360 and 1280×720: no overlaps while walking with 3★, a gun drawn, the weapon wheel open or the gun put away (揍), nor while driving with 2★ (checked in test-b3).
  - Short landscape (height ≤ 560): the gun buttons form a row along the bottom right. In fullscreen the ammo pill sits in the camera row; in normal layout everything sits left of the minimap.
  - The wheel shows 3 per row (2 in normal layout). In fullscreen it hides the destination bar while open.
  - The right-hand column is not pushed down by the stars in short landscape, because the stars are centred and do not reach it.

## Files (old-scratch/b3-int)
Added:
- police-ai.js (1822 lines): b3-police copy plus the b3-int edits below.
- guns.js, gunshop.js: unchanged from old-scratch/b3-guns.
- test-b3.mjs (833 lines).
- b3-int-police.patch (police + guns only vs trunk; was b3-int.patch) and b3-merged.patch (police + guns + drift + circuit vs trunk).

Changed (diff vs trunk):
- town.src.js +265/−14: all the wiring; see the 「第 3 批（b3-int）」 block after npcCarHit and the marked lines.
- drive.js +21/−2, in 4 marked places (`第 3 批（b3-int）`):
  1. `let marks`
  2. `camBlock` in rayHit, plus `isCop` and `cam.cop`, and the camera lift block after camera.position.set
  3. the minimap marker loop
  4. `setMarkers` in the returned API
- walk.js +13: markers patch, and DEST entries police/gunshop/offroad.
- npc.js +2/−2: kids are never knocked down or frozen by cars.
- garage.src.html +6/−4: GAME.guns in the literal, save, restore and 重新開始.
- garage.css +32: the b3 section at the end of the fullscreen/walking block.
- build-art.mjs, build-app.mjs: police-ai.js, guns.js and gunshop.js added after npc.js in both bundle lists.
- test-b1.mjs +24/−9 and test-b4.mjs +4/−1. These changes are explained under Tests.

police-ai.js edits vs b3-police (marked b3-int):
- TUNE.hunt 45, with `everSeen`/`huntT`.
- punch/carHit skip kids.
- `surrender()`.
- onRelease's return value says whether the car was towed.
- The `o.toast` hook.
- Jail card position.

character.js: the trunk copy is newer than b3-guns/latest (29 bones, aim/shoot poses, C.hand/handL), so it is kept unchanged. The OLD npc.js in b3-guns was not used.

## How to port
Police + guns only: `b3-int-police.patch`, a unified diff of 14 files against the 0.8.35 trunk. To apply it in a copy of the trunk: `cd <trunk-copy> && patch -p1 < old-scratch/b3-int/b3-int-police.patch`. Everything merged (police + guns + drift + circuit, see the merge section): `b3-merged.patch` (21 files, also verified byte-identical on a trunk copy). It was verified on a scratch copy and gives byte-identical files. Then run `node build-art.mjs --yaris`.

The drift and circuit port scripts should apply on top of this folder: my drive.js edits are small and marked.

## Tests (SwiftShader; the machine was shared with the other agents' tests, load ~7 on 4 cores)
- **test-b3.mjs** (new): `node test-b3.mjs <prefix>`; `B3_UNTIL=n` stops after part n. **50/50 ok, ALL OK, 0 page errors**, 111 s. Log: old-scratch/b3-logs/b3-run5.txt (earlier runs b3-run1..4).
  1. Old save loads; the loading step preloads the police.
  2. Punch: kid no / adult 1★, then car out of the station, officer runs, caught, jail, pay 2 萬, released at the door.
  3. Car: kid not hit / adult hit gives 2★, then boxed in by 2 cars, caught in the car, towed to the yard, jail ~30 s waited out, released with the yard message.
  4. Timer not started before seen; house hide clears in ~25 s; garage 關鐵捲門 clears.
  5. Gun shop: counter, buy pistol + ammo (saved), no fire in the shop, range 6/6 pays 2 萬 once, walk out armed.
  6. The rest:
     - kid shot 3× is never hit
     - shoot an officer gives +1★
     - shoot an adult gives 3★
     - layout sweeps: fullscreen and normal, with the wheel
     - 3★ chase: 3 cars, never shoot, caught, guns kept, pay 6 萬
     - board GC8 with the gun out: guns disabled, keys dead
     - driving 2★ layout sweeps
     - get out: 揍 + pill back
     - surrender
     - reload: guns, ammo and range record kept
- **test-b1.mjs**: **140 ok, ALL CHECKS OK, no page errors**, 567 s. Log: old-scratch/b3-logs/b1-run4.txt.
  - I replaced one check. The trunk asserted 「警察局還沒開門」, which this task removes. It now walks into the open police station (fade, inside, toast) and back out to its door.
  - Stars are cleared after the deliberate "drive into a person" check (that now gives 2★).
  - Stars are also cleared in the robot's `leg()` loop if it hits someone by accident; the count is logged. Otherwise the police would arrest the robot mid-route.
  - No other check was changed. Runs 1–3 show the failures before these fixes: the station door made the test walk inside; the arrest after the hit.
- **test-b4.mjs**: **66 ok, ALL CHECKS OK**, 243 s. Log: old-scratch/b3-logs/b4-run2.txt.
  - The same `leg()` star clearing as test-b1, plus a `__pol` hook.
  - Without it, run1 failed (b4-run1.txt): the monster-truck robot hit a pedestrian (2★), then bumped a police car (3★), and was arrested.
- test-app-b1/test-app-b4 (App build) were not run: they need build-app.mjs against a repo dir. build-app.mjs syntax was checked and its bundle list matches build-art.

## Screenshots
old-scratch/b3-shots/t-*.png (test-b3), old-scratch/b3-shots/b1/, old-scratch/b3-shots/b4/. test-b3 shots:
- 2-punch-1star, 2b-caught, 2c-jail
- 3-hit-2stars, 3b-boxed-in, 3c-released-yard
- 5-counter, 5b-range
- 6-shot-cop, 6b-shot-3stars, 6c-wheel, 6d-normal-layout, 6e-driving-2stars

## Perf (renderer.info at the screenshots; SwiftShader)
- Walking outside, 1★ just after the punch: 104 calls / 290k tris.
- Walking with 3★ and police around (view down the street): 224 / 1.24M.
- Driving with 2★: 256 / 1.14M.
- Boxed in: 218 / 1.10M.
- Released at the yard: 43 / 110k.
- Jail cell: 8 / 14k.
- Gun range: 22 / 67k.
- Shot at an officer: 103 / 279k.
- For comparison, test-b1 on this build: on foot 222 / 1.28M, street 145 / 1.03M.
- Police cars and officers are hidden (0 draws) when no one is wanted.
- police.update: avg 0.04–0.05 ms over ~11k frames.
  - Max 28–47 ms seen once per run under machine load. A 3★ probe shows occasional 4–9 ms frames, which look like GC/contention.
  - The update does not allocate per frame (police.md); the page calls telemetry() only in tests.
- Gun shop interior: 61k tris, 15 draws, built on first entry in 180–280 ms (a one-time hitch at the door fade).
- npcStep avg 0.11 ms (test-b1).

## Open issues / limits
- **Normal (non-fullscreen) landscape driving.** At 915×412 and 800×360, `.dv-cam × .dv-gas` overlap even without stars. This is already in the trunk (its sweep only checks #fsBtn there); not fixed (drive.js layout).
- **Jail cell camera.** The cell is small (3.5 × 4.8 m), so the third-person camera pulls in close when you walk up to the bars.
- **Hunt grace.** If the police never see you, stars start to drop after the 45 s hunt grace plus 25 s.
- **Not changed from police.md:** 1★ on the highway may be too hard; rarely a car gets stuck in the station lot; the siren was never listened to (tests are muted).
- **No 去警察局／去槍店 destination pills.** test-b4 requires exactly six pills in two rows of three. The places are on the minimap (警, 槍) and on the street signs.
- **No shooting from cars** (by design). Kids are unshootable (by design).
- **The robot drivers in test-b1/b4 sometimes hit pedestrians.** The tests now clear the stars and log how often. A smarter robot would avoid the hit.

## Merge with drift (b3-drift) + circuit (b3-circuit) — 2026-10-04, second step
Backup before merging: old-scratch/b3-int-pre-merge.

### Ports
- `node src/port-drift.mjs old-scratch/b3-int --dry`: 43 OK. Then applied: 43 applied.
- `node src/port-circuit.mjs old-scratch/b3-int --dry`: all OK. Then applied: 6 files changed, plus circuit.js, circuit.src.js and circuit-test.mjs.
- No FAIL, so nothing had to be resolved by hand.

### Integration fixes (marked 第 3 批（b3-int）)
- **Police during races.**
  - New `polRace(on)` in town.src.js. While a circuit race or an off-road race runs, it turns the police off (cars and HUD hidden) and the star bar off; the stars are kept.
  - police-ai.js `crime()` now ignores crimes while the police are disabled, so nothing on the circuit counts.
  - circuit.src.js calls `polRace(true)` when the race starts and `polRace(false)` in `ciEnd`. orStart/orEnd do the same.
  - You cannot sign up at the circuit pit box while wanted: 「警察在追你：先甩掉警察才能報名」. Once the stars are gone, the car parks itself and the menu opens as usual.
- **Skid marks on the circuit.** drive.js `gy()` puts the marks at 0.04 instead of 0.045. On the circuit the asphalt is at 0.03 and the white lines are at 0.045 (circuit.js `Y`), so marks at the old height would flicker against the lines. They now sit between the asphalt and the lines, below the curbs at 0.042. In the village the road is at 0.03 and the decals at 0.05, so nothing changes there.
- **Robots.** circuit-test.mjs `leg()` clears accidental stars the same way as test-b1/b4 and logs the count; the hook `__pol` was added. Its race robot runs with the police off.
- **Layout fixes (garage.css).**
  - **Camera button vs gas pedal.** This overlap was already in the trunk, in normal (not fullscreen) phone landscape. Fixed: there the camera button moves to the top row, left of the fullscreen button.
  - **Short landscape while wanted.** Nothing is pushed down by the stars, the top-left chip and action button included. Pushing them down made them hit 直接回車庫 at 800×360 fullscreen.
  - **Circuit HUD.**
    - `.cir` is inset to the safe area in fullscreen, like the driving HUD.
    - On short screens the 名次 panel is compact (standings list hidden, smaller text), so it clears 直接回車庫 and the steering buttons.
    - In normal portrait the red lights sit lower, at max(36%, 290px), below the panel and the fullscreen button.
  - 手煞車 (.dv-hb) did not overlap anything once these were in. The gun buttons are hidden while driving.
- **test-b3 part 7 (new).**
  1. Wanted at the pit box: no sign-up.
  2. Stars cleared: the menu opens and the race starts.
  3. Police off, and a crime during the race gives 0★.
  4. Layout sweeps during the grid (red lights, 名次 panel, 手煞車): fullscreen and normal at all 5 sizes, no overlap.
  5. Lights out, then a handbrake drift on the main straight: 29° at 93 km/h, 150 skid-mark pieces on the circuit asphalt.
  6. 放棄比賽 brings the police back.

  HUD_SEL now also has `.dv-hb .cir-p .cir-l`. The part 3 kid search widens to 3000 m when no kid is near: the straight road it picks changed with the circuit.

### Tests after the merge (run one at a time on old-scratch/b3-int)
| Test | Result | Time | Log |
|---|---|---|---|
| test-b3.mjs | ALL OK, 56 ok, 0 page errors | 122 s | old-scratch/b3-logs/b3-m2.txt (b3-m1 = the first run, before the layout and test fixes) |
| drift-test.mjs | ALL OK, 42 ok (26 Node incl. bit-identical normal driving vs trunk drive.js + 16 browser) | 74 s | old-scratch/b3-logs/drift-m1.txt |
| circuit-test.mjs | PASSED, 24 ok, 0 failed, 0 page errors | — | old-scratch/b3-logs/ci-m1.txt |
| test-b1.mjs | ALL CHECKS OK, 140 ok | 415 s | old-scratch/b3-logs/b1-m1.txt |
| test-b4.mjs | ALL CHECKS OK, 66 ok (robot hit someone once; stars cleared, logged) | 164 s | old-scratch/b3-logs/b4-m1.txt |

- The final `node build-art.mjs --yaris` produced garage.html 2,558,477 bytes. The bundle passes `node --check`.

### Screenshots
- old-scratch/b3-shots/t-7b-circuit-drift.png: drifting on the circuit, 甩尾 30° pill, skid marks.
- old-scratch/b3-shots/t-7-circuit-race-start.png: lights out, 出發！.
- old-scratch/b3-shots/t-3b-boxed-in.png, t-2b-caught.png: police chase.
- old-scratch/b3-shots/t-5b-range.png: gun range.
- old-scratch/b3-shots/t-6b-shot-3stars.png: 3★ with a gun.
- Also old-scratch/b3-shots/ci/ (circuit-test), old-scratch/b3-shots/drift/ (drift-test), old-scratch/b3-shots/b1/, old-scratch/b3-shots/b4/.

### Open issues after the merge
- The off-road race also turns the police off now, with the stars kept for afterwards; the drag race did that already. Whether a race should clear the stars instead is a design choice.
- The squeal and the siren were never listened to (tests run muted).
- The app tests (test-app-b1.mjs) still lack `.dv-hb` and the b3 selectors in their HUD list and were not run.

## App build v36 (trial page v20 「上線」): test-app-b1 / test-app-b4 — 2026-10-04, third step
The App was built with `node build-app.mjs old-scratch/repo36 36` from old-scratch/b3-int. old-scratch/repo36 is a copy of the git repo with WEB_BUILD, the cache and ?v= already set to 36. The first runs failed: old-scratch/b3-int/app36/a1-log.txt and a4-log.txt.

The agent that was stopped at about 12:40 UTC had not edited anything. test-app-b1.mjs and test-app-b4.mjs were still byte-identical to old-scratch/b3-int-pre-merge and old-scratch/b2-intF (same md5).

### Causes
- **test-app-b1, police station.** The cascade started with the old 「警察局還沒開門」 check. The station is open now, so the test walked inside. It then teleported to the street while still indoors, so 上車, 下車, the drive to the tuning shop and 修車 all failed, and the run ended in the TypeError.
- **test-app-b4, monster truck going home.** The robot hit a pedestrian, the police caught it, and the drive was handed over, so `D.drv` was null and `setInput` was called on null. The rerun log shows the same thing: 「police stars cleared 1× (robot hit someone)」 on that leg.

### Test changes
These are the same edits as test-b1/test-b4, copied by `src/port-app-tests.mjs`. Each anchor must match exactly once. Backups: test-app-b1.bak-b3pre.mjs, test-app-b4.bak-b3pre.mjs.
- Hook `window.__pol`.
- `.dv-hb` added to HUD_SEL (app-b1 only, as in test-b1).
- `leg()` clears accidental stars and logs `polClr`.
- The police-station check now walks in and back out.
- Stars are cleared after the deliberate "drive into a person" check.

### One real game bug, found by `.dv-hb` in the App layout check
- **Symptom.** 「fullscreen off on other screens … 1280x720: .dv-hb × #fsBtn」.
- **Cause.** In the App on a tall, wide screen (tablet or computer) the normal layout makes the stage a small 426×320 column. The handbrake's placement is chosen by viewport media queries (max-height 560). With a tall viewport it stays at bottom 124 px, which puts it on top of the camera button and the fullscreen button (probe: hb 768–842 × 232–278, fsBtn 746–790 × 226–270, cam 798–842 × 226–270). The trial page does not have this problem because its stage fills the viewport.
- **Fix.** drive.js CSS, marked 第 3 批（b3-int）: `@media (min-height:561px){@container (max-height:409px){.dv-hb{top:142px;right:114px;bottom:auto;height:44px}.pw-host.pw-on .dv-hb{margin-top:46px}}}`.
  - The handbrake goes in the camera row, left of the fullscreen button. While wanted, it moves down 46 px with the minimap.
  - Short viewports (phone landscape) keep their old rules.
  - Probe after the fix at 1280×720: hb 664–738 × 226–270, fsBtn 746–790. 915×412 is unchanged.
- **Rebuild.** `node build-art.mjs --yaris` (garage.html 2,558,735 bytes), then `node build-app.mjs old-scratch/repo36 36`.
- **Files changed in old-scratch/repo36:** only tune.js. tune.html, tune.css, the glbs, app.js, index.html, mc.html and sw.js have the same md5 as before (old-scratch/b3-int/app36/repo36-md5-before.txt).

### Results (one at a time)
| Test | Result | Log |
|---|---|---|
| test-app-b1.mjs old-scratch/repo36 | ALL CHECKS OK, 146 ok, no page errors, 598 s | old-scratch/b3-int/app36c/a1-log.txt. The run before the CSS fix had 1 FAIL (.dv-hb × #fsBtn) and the police station ok: app36b/a1-log.txt |
| test-app-b4.mjs old-scratch/repo36 | ALL CHECKS OK, 66 ok, no page errors, 263 s; robot stars cleared 1× | old-scratch/b3-int/app36c/a4-log.txt |
| test-b3.mjs | ALL OK, 56 ok, 0 page errors, 136 s | old-scratch/b3-logs/b3-app36b.txt |
| circuit-test.mjs | PASSED, 24 ok, 0 page errors | old-scratch/b3-logs/ci-app36.txt |
| drift-test.mjs | ALL OK, 42 ok | old-scratch/b3-logs/drift-app36.txt |

Run 1 of test-b3 (old-scratch/b3-logs/b3-app36.txt) had 1 FAIL. In part 3, `X.person` found no kid in a walking pose within 3000 m at that moment, so it reported "kid … at undefined km/h". This is a flaky test setup unrelated to the CSS change, and the rerun passed. A test fix would be to spawn or wait for a kid instead of failing.

The "console error Failed to load resource: net::ERR_FAILED" lines in the App logs come from outside requests that the test aborts. They were already in the earlier logs.

### Open issues (App normal layout on tall, wide screens, already in the trunk; the test only checks #fsBtn there)
- In the 426×320 stage, 下車 (.dv-act2, top 240) overlaps the gas and brake pedals.
- While wanted, the pushed-down camera button (188–232) would touch the gas (top 208).
- This needs a container-query pass over the whole drive HUD, not just the handbrake.
