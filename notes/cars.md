# 10 new cars, cockpits, pop-up headlights, tilt steering (content 16, 2026-10-17)

Nick asked for 10 more cars modelled from web photos. The photos were only used to look at; they are never in the game or the repo. Names are made-up badges, not real brands.

| key | button | price (萬) | notes |
|---|---|---|---|
| `rx7` | R7 轉子跑車 | 100 | rotary sound, pop-up headlights |
| `ae86` | 86 豆腐車 | 75 | black/white, pop-up headlights |
| `altis` | 小黃 計程車 | 45 | taxi; the most common new car in traffic |
| `civic` | FK 大尾翼掀背 | 115 | |
| `evo` | E9 拉力房車 | 100 | AWD |
| `aventador` | AV12 剪刀門 | 1200 | |
| `senna` | SN8 大尾翼 | 1500 | mid-engine |
| `huayra` | HY 風神 | 4500 | mid-engine |
| `laferrari` | LF 紅色流線 | 5000 | mid-engine |
| `chiron` | C16 馬蹄超跑 | 8000 | W16, AWD |

- Each car has `<car>-look.js` / `<car>-spec.js`, a garage body (`body-*-q.glb`), a light-weight body (`body-*-lod.glb`) and wide-body settings. They are bundled in build-art.mjs / build-app.mjs through the `CARS` list. See `src/CARS-CONTRACT.md`.
- Traffic (npc.js) also uses the new cars.
- 阿財車行 has more cars than its 6 turntables. Tapping a car further down the list swaps the turntables to that batch (town.src.js `padOff`).
- Cockpits: every new car has a first-person interior (cabin.js), with a steering wheel that turns and a red top marker.

## Pop-up headlights 跳燈 (popup.js; mock https://claude.ai/artifact/NjStMe4AhSWuk9dBUELzde)
- 86 and R7 get a 「跳燈」 button next to 手煞車 (drive.js `setPop`). In portrait it sits above 手煞車; in landscape it sits to the left. The L key also works.
- Each press raises or lowers the covers and switches the lamps on or off (`popStep` animates).
- The state is saved per car in `GAME.pop` (`{car: 1}`, saved as `pop`). A borrowed car's state is not saved.
- Friends see the lamps (`pl` in `netState`).

## Tilt steering 轉手機開車
- Nick: 「你看可不可以把手機本身改成可以方向盤的模式」.
- The 「⋯」 row gets a 🎮 button: 「方向盤 按鈕 ⬅➡ / 轉手機 📱」.
- drive.js `setTilt` reads gravity from `devicemotion`. Tilting 30° is full lock; the middle 2° does nothing.
- The setting is kept per phone in `localStorage` `carid.tilt`. It is not in the save and is not moved over.
- If the phone sends no sensor data for 1.5 s, it says 「這支手機不能轉手機開車」 and switches back to buttons.

## Real rear-view mirrors (第 25 批, 2026-10-21)
- Nick: 「第一人稱駕駛的時候 後照鏡要真的顯示後方景色 有車子也要顯示出來 且會跟著開車方向移動」.
- town.src.js `MIR` / `mirrorSet` / `mirrorStep`: in the driver's-seat view only, a backward camera at the driver's eye height (car centre line) draws the scene into a 512×170 render target every 3rd frame, with your own car hidden for that pass. The inside mirror (cabin.js `cabin.userData.mirror`, a hidden quad in front of the painted mirror) and both side-mirror glasses (`S.mats.mirrorGlass` meshes) get `MIR.mat` with UVs from `mirUV` (inside: straight back; left: left-behind; right: right-behind; flipped like a mirror). Leaving the driver's view (or stowing the car) puts the original materials back.
- Cost: one extra pass of about 87 calls / 0.38M tris (mirror-test, village road) every 3rd frame, only in the driver’s view.
- Test: `mirror-test.mjs`.

## Tuned top speeds = real-world records (第 46 批, trial v59, 2026-10-26)
- Nick: 「你去查世界記錄遊戲中的車在真實世界改到多快 你就讓遊戲裡改到多快」.
- `PERF[k].top` (garage.src.html) is the fastest measured speed of a modified car of that model. `vmaxOf(k, hp = hpOf(k))` goes linearly from stock `vmax` (no parts) to `top` (all parts) by added hp.
- Used by:
  - the town drive: town.src.js `perf.vmax`, which drives `drive.js`'s gearing and governor;
  - your car in the 400 m: race.src.js `mySetup().vmax` → `racer` `fd`.
- Not used by the 400 m / circuit opponents or the dealer label (still stock).
- No new UI.

| car | stock | tuned | record (research 2026-10-26) |
|---|---|---|---|
| GC8 | 250 | 288 | AFP GC8, 1/4-mile trap, Santa Pod 2014 (engine swap) |
| GR Yaris | 230 | 250 | Lamspeed, 1/4-mile trap, ~2024 |
| SUPRA (A80) | 300 | 387 | Ekanoo Racing 2JZ drag Supra, 1/4-mile trap, Bahrain 2014 |
| GT-R (R34) | 290 | 346 | Veilside R34, closed road, NZ 1999 |
| 918 | 345 | 351 | Weissach, runway mile, 2018 (best measured) |
| JESKO | 330 | 413 | Jesko Absolut 0-400-0 runs 2024 (best measured; no aftermarket record) |
| R7 (FD) | 250 | 389 | Racing Beat FD, Bonneville 1995 (three-rotor) |
| C16 (Chiron) | 350 | 490 | Chiron Super Sport 300+ prototype, Ehra-Lessien 2019 |
| 86 (AE86) | 190 | 254 | 3S-GTE swap, 1/4-mile trap (low confidence) |
| AV12 | 345 | 350 | Underground Racing twin-turbo, standing half-mile 2015 |
| 小黃 (Corolla) | 180 | 241 | E110 Corolla 3S-GTE, standing half-mile 2019 (different generation) |
| FK | 272 | 275 | Stage 2 FK8, Autobahn speedometer video 2022 (low) |
| E9 (Evo IX) | 250 | 299 | Extreme Tuners, 1/4-mile trap 2017–18 |
| monster truck | 110 | 160 | Raminator, Guinness 2014 |
| SP3, SN8, HY, LF | same | same | no modified run found; LF's 372 is an unverified speedometer video |

- A "trap" is the speed at the end of a 1/4 mile. The car's true top would be higher, but nobody has measured it.
- Test: `top-test.mjs` (Node, ~1 s) checks every car flat out on a flat plane through `drive.js`:
  - no parts reach `vmax`;
  - all parts reach `top`;
  - half the parts land in between.
- drift-test checks the in-game wiring: SUPRA `carInfo.vmax` goes 300 → 387 → 300, and the 400 m `fd` scales too.

## J4 jeep 吉普車 (第 48 批, trial v61 = content 28, 2026-10-28)
- Nick: 「另外可以開始做 更多越野車（吉普車、小越野車、皮卡、沙灘車）」. Pictures first, then the decision card 「好，做進去」 (sold at the 越野車行, 80 萬 for now), then 「做好直接上線」: shipped as content 28 without a separate trial round.
- A made-up two-door off-roader: round lamps, horizontal grille slats, black hardtop, spare wheel on the tailgate. No real brand, badge or logo. Reference photos were only looked at; none are in the repo.
- Files:
  - `jp4-body.mjs`: SDF body, then `body-jp4-q.glb` (garage) and `body-jp4-lod.glb` (light car).
  - `jp4-look.js`: surface masks.
  - `jp4-spec.js`: parts. 34" tyres on 17" beadlock-style rims, black flares, steel bumpers, side steps, mirrors, hinges. Off-road kit = winch + snorkel; roof rack + LED bar.
- **Mask coordinates.** The body is taller than masks.js's 0–1.4 m window, so the mesh is stored in mask space, like the monster truck: xm = x·0.92, ym = (y − 0.44)·0.92, zm = z·0.92 (`JP4_M`). jp4-spec scales it back to metres.
  - make-lod.mjs knows `mask`: it classifies and simplifies in mask space, then converts to metres.
  - The "low chrome" rule is off for this car (the lower half of the round lamps would stop lighting up at night).
  - Part simplification error is 4 mm (`PART_ERR_CAR`).
- **PERF** (garage.src.html): price 80, 285 hp, 1840 kg, AWD, `vmax` = `top` = 180, `offroad: 1`, not `big`.
  - No tuned top-speed record was found (big tyres; even the factory V8 versions are limited to about 160), so parts only add power: launch, hills, mud.
  - Eight parts, up to `swap` (6.4 V8).
- **Ride.** It is the first car on terrain.js's `offroad` class (suspension, 0.3 m clearance, off-road tyres): mud up to 40 km/h (road cars 12).
  - Not `big`, so `liftOK` is true: tower, ramp, lift and basement all work.
- **Crushing.** `offK` = `PERF.offroad`, so like the monster truck it crushes things (Nick 2026-10-09 「越車可碾任何東西」). People dive away. In the village that is 1★.
- **Ramp fix (tower.js `RAMP_COLS`).** The jeep showed two old ramp problems:
  - The ramp walls had no `noCrush`, so an off-road car flattened the guardrail and got a police star. All ramp walls are now `noCrush`.
  - On the first half-lap (F 0) the full-circle outer rail also stood just before the ramp start (A0 − 0.55 rad). That stretch is ground at that lap; the rail there belongs to the 3F lap. A wide car turning onto the start had its tail inside that invisible wall when `TRAMP.on` added the colliders. F 0 now leaves those boxes out.
- **Cockpit** (cabin.js `STYLE.jp4`):
  - Left-hand drive, eyes 1.56 m up.
  - Two big dials plus fuel and temperature, a knobs stack, manual gearbox, three pedals, bench rear seat with no parcel shelf.
  - cabin-fit.mjs: the wheel-arch walk retries 20 cm higher when nothing is found at axle height (the tub floor 0.52 is above the axle 0.415).
  - `fitOf`: no rear glass means the headliner runs to the tail.
- **Sound** (sound.js): 3.6 V6 (120° firing). With the `swap` part, `SND_profile` applies `B.swap` (cross-plane V8 burble).
- **Traffic.** npc.js `CAR_W` 0.8 (a common car), no wing.
- **Dealer** (town.src.js `oDisp`, `oWant`): `display[0]` = the podium (big cars: monster truck); `display[1]`, `display[2]` = the two shed pads, nose out (normal-size off-roaders: the jeep).
  - `lookAtCar` maps the camera to the right pad.
  - offroad.js: pad mats rotated to match.
- **cview.html:** `cab=1` adds the 3D cockpit; `v=eye` renders the driver's view (`node shot.mjs out.png 'car=jp4&v=eye' 1200 700`).
- **Tests:**
  - `jeep-test.mjs`: garage cockpit; ramp to 3F with nothing crushed and no invisible wall; lift to B1; park and get out; back to 1F; expressway 180 km/h; mud 40 km/h.
  - test-b4 / test-app-b4: shed pad, walker blocked at the nose, buttons, camera.
- **Numbers** (jeep-test, 390×844, traffic paused): garage page 242 calls / 1.67M tris; 3F 223 / 1.24M; B1 235 / 1.25M; expressway 136 / 0.90M; driver's view 38 / 0.28M; mud pit 180 / 0.99M. Cockpit 7 meshes, 9.2k tris.

## GC8 rebuilt for phones (第 49 批, trial v62, 2026-10-28)
- Nick 2026-10-28: 「回到上次做的GC8 其實我不是很滿意 我們可以再來改善它嗎」 → five gaps listed, card 「全部改」 (taller roof and bigger windows, lighter blue with even reflections, six thin spokes, thin tall wing legs, rounder hood scoop and mirrors). Then 「車子好多了 所以手機跑不動嗎?」: the sample was ~630k triangles in 825 meshes and took ~9 s to build, so it was baked into a phone-sized body for the trial page.
- Files:
  - `gc8-model.js` (was the git-excluded `probe-car2.js`): the high-detail lofted body, `window.__CAR2.build(THREE, { bake: true })`. Only used for baking; the game never runs it. Every material carries `userData.slot` (which bake group it joins).
  - `gc8-bake.mjs`: Chromium builds the car → meshes grouped by slot (wing and the two mirror glasses separate, `smoke` folded into `trim`) → weld + meshoptimizer (borders locked, error per slot, normal weight 1 for paint/glass, 0.3 for the rest) → `body-gc8-q.glb`: 19 nodes, 104.8k triangles, 2.3 MB, KHR_mesh_quantization. Node extras `{ slot, part: body|wing|mirror, side, uv: [u0, v0, du, dv], clean }`. Textures: paint = panel gaps only (map + normal map), headlight reflector, tail lamp, grille meshes.
  - `node gc8-bake.mjs --write` measures the baked body with axis-aligned rays on a 2 cm grid and rewrites `FIT.gc8` (cabin.js), `WINGS_DECK.gc8` (wings.js) and `WIDE.gc8` (wide.js / wide.json). cabin-fit.mjs and make-wide.mjs now skip gc8.
- Runtime (supra.js): `carGeos` sees `userData.slot` → `bakedGeos`; `buildCar` with `geos.baked` puts one mesh per group (`bakedBody`): paint/glass/inside reuse the car's materials, lamps glow at night (`bakedNight`), the headlight lens and indicators are fake glass (`bakedClear`: opacity from reflection, no transmission). The projected masks only carry the livery now (`bakedMasks`); masks.js `uUnderY` = 0.2 keeps the bumper's lower curve body-coloured. The STI wing is in the glb (`spec.wings = { sti: 'baked' }`); extra wings sit 5 cm lower than before (the new boot lid is lower: ~932 mm at the centre, was 982).
- Wheels: `GC8_spokes` (six thin spokes, flat hub, black cap, five nuts) with `own = true` (parts.js `rimFace` adds no cap or nuts); parts.js now exports `rimMerge`, `rimLathe`, `rimCyl`.
- Track kit `GC8_AERO` refitted to the new bumper (lip under the bumper face, canards on the bumper corners, skirt blades at the sill bottom, diffuser under the exhaust). Interior: parcel shelf moved in under the rear glass (`bench.shelfX/shelfY`).
- Light car (make-lod.mjs, baked path): the body comes straight from `body-gc8-q.glb`, not from mask classification.
  - Slot → class: paint, glass, trim (+ black grille meshes), dark → matte, reflector/bulb/frost → lamp, amber, bright → chrome (low chrome, not lit), tail split along texture v = 0.43 (grey reverse strip below, red above), light trim = number plates (one custom material). Headlight lens and `inside` are dropped.
  - Lamp covers that face into the car (the tail lamps: double-sided in the garage, so nobody saw it) are flipped when most of a connected piece faces against the nearest paint normal (`bakedFlip`); the light car draws back faces as the dark inside.
  - The right half is cut exactly at z = 0 (cut vertices get z = 0 and no normal z), welded, and z = 0 vertices where the border leaves the centre line are locked; then one joint simplification to 9000 triangles with `Prune` (tiny bits go).
  - The exhaust is only on the left, so it is taken out before mirroring and stored as an all-kits part (`BK_ASYM`).
  - Result: 17,998 body triangles (whole car), 22.4k with wheels, 4 draw calls, 204 KB glb. `node make-lod.mjs gc8 --rebake`.
- Numbers (cview, 900×600): front 3/4 69 calls / 144k triangles; track kit 83–85 calls; wide 77; driver's view 42 / 135k.
- In the game (mirror-test, same spot, first-person, 390×844): old GC8 130 calls / 1.19M triangles → new 126 calls / 0.43M (the old SDF body alone was ~0.8M). Trial v62 published 2026-10-28 (artifact version 63; only car-gc8.txt and car-gc8-lod.txt changed).
- Wipers: the sample had them standing up the glass (pointing towards the roof), which put two black sticks in the middle of the driver's view. They now rest along the bottom of the windshield, on the glass, both lying to the left (the right one is longer). Re-baked without `--write`: FIT.gc8 only moved 2–15 mm in `ws`/`wf` because the rays now touch the wipers, so the old values (glass only) stay.
- Mirrors: the two mirror-glass nodes are in car coordinates, so their mesh origin was at 0 and town.src.js `mirrorSet` (left/right by mesh position) gave both the right mirror's picture. `bakedGeos` now moves the mirror geometry to its own centre (`at`) and `bakedBody` puts the mesh there; mirror-test passes again.
- look-test fix (not GC8): its village checksums (`__posSum`/`__geoSum`) counted the light cars the game adds to `VIL.group` later (your parked monster truck once its light car loads, and since 第 48 批 the J4 on the off-road dealer's indoor pad within 260 m). The J4's 4 meshes were exactly the +1491.1 / +1895.9 difference, so `lodcar-*` subtrees are skipped now.

## GC8 A-pillar (第 50 批, trial v63, 2026-10-29)
- Nick 2026-10-29: 「Gc8其實做的還不錯 a柱稍微改明顯一點 不用太多」. In the baked GC8 the windshield (`windGlass`) and the side window (`sideGlass`) overlapped by 1–3 cm along the pillar, so the glass ran round the corner with no pillar at all (only a highlight line); from the driver's seat there was almost nothing on the right. The old SDF GC8 had a fat ~10 cm pillar.
- gc8-model.js: side-window front edge `xA` moved back 5 cm (0.80 → 0.75), windshield side edge 1 cm narrower (0.66 → 0.65). The pillar is now a ~4–5 cm body-colour strip (measured along the station cut) plus the two 1.4 cm black rubber bands; inside it is the dark `inside` layer, so the driver sees a slim dark pillar. Tried: 5 cm back alone (2.9–4.8 cm strip, but the bands nearly touch and the edges zig-zag), 7 cm back + 0.6 cm narrower (a bit wider at the base); 5 + 1 looked closest to the photos without being heavy.
- Paint normals: after `computeVertexNormals` the paint vertices get normals from paint triangles only. Before, the glass-edge rubber band (sloping 7 mm into the glass over 1.4 cm) was averaged in, so on a narrow strip the highlights came out as lightning-bolt zig-zags.
- Re-baked (`node gc8-bake.mjs --rebake --write`, then `node make-lod.mjs gc8 --rebake`). FIT.gc8 changed only near the pillar (S at x 0.3–0.7 / y 1.0–1.3, T by 2 mm, `st` at x 0.3–0.6 down 3–5 cm, `wt` at z 0.6 forward 9 cm). The windshield scan now ignores thin black things lying on the glass or cowl (`overGlass`: a dark/trim top hit with glass or paint within 3 cm below → use that hit), so the wipers no longer shift `ws`/`wf`; they come out exactly as before the wiper change.
- Before/after sheet: /mnt/project-files/car-game/gc8/gc8-apillar-v63.jpg (exterior close-up, driver's view).

## K2 mini off-roader 小越野車 (第 51 批, trial v64, 2026-10-29)
- Nick 2026-10-29: picture of the next off-roader first (/mnt/project-files/car-game/offroad/k2-v1.jpg: mint, mustard with the trail kit and roof basket, stripe and mountain liveries, body-colour spare cover), then the decision card 「好，做進去」 (sold at the 越野車行 for 60 萬, trial page first).
- A made-up three-door mini off-roader: rounded-rectangle headlamps, two horizontal grille slots, clamshell bonnet, upright windshield, black B-pillar, round black wheel arches, body-colour hard spare-wheel cover on the side-hinged tailgate. No real brand, badge or logo; the side text is only "K2 4WD" / "K2".
- Files:
  - `k2-body.mjs`: SDF body (boxes, side profiles, rounded), then make-car.mjs → `body-k2-q.glb` (garage) and `body-k2-lod.glb` (light car). `body-k2.glb` is the intermediate (git-ignored, like the jeep's).
  - `k2-look.js`: surface masks (`K2_M`), liveries `stripe` (two thin lines along the sill + "K2 4WD" on the door) and `mountain` (dark peaks with snow on the door, "K2" over the rear arch). The arch flares cover y < 0.905 around the arches and the black cladding everything under 0.565, so livery art stays on the door and the panel above the rear arch.
  - `k2-spec.js`: parts. All-terrain tyres on 16" white steel wheels (eight holes), black flares, plastic bumpers with a silver skid strip, round fog lamps, round mirrors, frame rails and axles under the body, the spare with a body-colour shell (`shell.color = paint.color`, so it follows the paint; the light car bakes it as paint because the bake paints the car `#123457`). Trail kit = front bar with two round lamps + mud flaps; roof basket.
- **Mask coordinates**, same as the jeep: xm = x·0.92, ym = (y − 0.40)·0.92, zm = z·0.92 (`K2_M`; k2-body.mjs `K2`). cabin-fit.mjs knows the K2 too (`{ jp4: M.JP4, k2: M.K2 }`), make-lod.mjs has it in `ALL` with a 4 mm part error, lod-bake.html passes `mask`.
- **PERF** (garage.src.html): price 60, 102 hp, 1090 kg, AWD, red 6200, `vmax` = `top` = 145, cda 1.15, `offroad: 1`, not `big`, tyres 2 / 4 萬. Like the jeep, no tuned top-speed record turned up (one search: supercharger kits, no measured top speed), so the six parts (up to a small supercharger, +45 hp) only add power. Default look: mint, white wheels, stripe livery (as in the approved picture).
- **Ride**: terrain.js `offroad` class (second car on it): mud 40 km/h, ramp/lift/basement all work (not big), crushes things like the other off-roaders (people dive away).
- **Cockpit** (cabin.js `STYLE.k2`, `FIT.k2` from `node cabin-fit.mjs k2 --write`): left-hand drive, eyes 1.48 m up and 0.30 m behind the car centre, low flat dash (top 1.08), tach + speedo with fuel/temp in between, knobs stack, manual, three pedals, small bench with no parcel shelf. The first try (eyes 1.50, wheel drop 0.35) hid the dials behind the wheel hub; eyes 1.48 / drop 0.40 shows them like the jeep's.
- **Sound**: 1.5 NA four (`SND_CARS.k2`, from the yaris table with the four-cylinder firing, red 6200, softer rasp); the `sc` part adds the supercharger whine (`P.sc`).
- **Traffic**: npc.js `CAR_W` 0.7, no wing.
- **Dealer**: `oWant` puts normal-size off-roaders on the two shed pads cheapest first, so now `display[1]` = K2 (60) and `display[2]` = J4 (80); the podium keeps the monster truck.
- **Tests**:
  - `k2-test.mjs` = `jeep-test.mjs` with `OFFCAR=k2` (jeep-test takes the car from a small table: name, price, top speed, expressway minimum). Garage page, cockpit, ramp to 3F (nothing crushed), lift to B1, park, back to 1F, expressway 140 km/h in 20 s (top 145), mud 40 km/h. 22 ok.
  - test-b4 / test-app-b4: both shed pads checked (car, nose out, length, walker blocked at the nose), the dealer list is K2* / J4 / 怪獸卡車, the camera goes to pad 1, then pad 2 after tapping J4, then the podium.
- Published to the trial page 2026-10-29 (artifact version 65: the page + car-k2.txt + car-k2-lod.txt). Tests run: k2-test 22 ok, test-b4 86 ok, test-b1 151 ok, top-test, free-test.
- **Numbers** (k2-test, 390×844, traffic paused): garage page 204 calls / 1.42M tris; 3F 203 / 1.12M; B1 216 / 1.12M; expressway 119 / 0.77M; driver's view 39 / 0.26M; mud pit 162 / 0.86M. Cockpit 7 meshes, 9.2k tris. car-k2.txt 1.43 MB; light car 201 KB glb (18k body tris).

## GC8 B-pillar (第 52 批, trial v65, 2026-10-29)
- Nick 2026-10-29, after looking at v63: 「看到了 應該是我選錯車 GC8再幫我加上b柱 要比a柱更細一點」 (the A-pillar is fine; he had been looking at the wrong car). The baked GC8 side glass ran from the A-pillar to the C-pillar in one piece. In the reference photos the B-pillar is a thin black strip whose top leans forward.
- gc8-model.js:
  - Pillar centre line `xB(y) = −0.50 + (y − 0.95)·0.12` (top leans forward), half width `BW` = 1.2 cm. `sideGlass` excludes it and `bPillar` marks it (`v.bp`). Quads touching a pillar point and no glass are material 4, drawn as black trim.
  - The glass next to the pillar gets a 3 mm black edge (`TRIMB`) instead of the usual 1.4 cm (`TRIMW`). So the pillar reads as about 3 cm of black, against about 7 cm for the A-pillar (body colour plus two bands). Inside, the dark `inside` layer covers it.
  - Stations between x −0.60 and −0.38 are split in three (about 5 mm apart) so a thin pillar has grid points on both edges.
  - **The paint texture u must stay linear in x.** Each station keeps a virtual index (`VI` → `U[i]`), and both the uv and `paintMaps(…, U, …)` use it. With u taken from the station number, this stretch of texture was squeezed three times. After simplification, big baked triangles crossing it turned the door seam and the handle outline into saw teeth.
  - Glass points beside the pillar are placed along their original row (`O`, saved before any snapping), at BW + TRIMB from the centre line, by bisection. Placing them from the nearest edge point instead made every few rows stick out, because the pillar is slanted and the nearest neighbour switches; that looked jagged from inside.
  - At the two ends (window top and bottom), the point first moves 1.4 cm in from the window edge along the grid line, like every other rubber-band point. Then the same row segment, shifted there, is bisected to the 3 mm line.
    - The first version did it the other way round. One point sat 0.3 mm under the roof edge, so the edge→point direction was almost horizontal and the 1.4 cm move threw it 12 mm sideways. That flipped three triangles (light slivers from inside).
    - Check: a flip test on the raw mesh, comparing the normal with the outward direction, found 0 flips at the top and the bottom. Glass points move at most 3 mm sideways.
  - Slanted rows where only b or c is a pillar point take the a–d diagonal (`oneBBC`), so the black stays a thin line.
- gc8-bake.mjs FIT belt/`st` scan: a thin black hit counts as glass when there is side glass 3 cm in front and 3 cm behind it. Otherwise the sample at x −0.5 jumped 11 cm up onto the pillar and the door-card line inside had a bump.
  - After `--rebake --write`: belt, st, ws, wf, wt, rg and rt are unchanged. S changes by +7 mm in one cell, because the pillar is flush while the glass is recessed 7 mm. The rest are 1–3 mm rebake noise, and WINGS_DECK changes by 1 mm in places.
- Numbers:
  - Body 105.1k → 107.8k tris (+2.6%), body-gc8-q.glb 2.29 → 2.34 MB. Draw calls unchanged (garage 69).
  - Light car: body 18k tris, 22.3k total, 4 draws.
  - The driver's forward view is unchanged. Looking right shows a slim dark pillar.
- Before/after sheet: /mnt/project-files/car-game/gc8/gc8-bpillar-v65.jpg (exterior close-up, rear three-quarter, driver looking right).
- Published to the trial page 2026-10-29 (artifact version 66: the page + car-gc8.txt + car-gc8-lod.txt). Tests run: test-b1 151 ok, mirror-test 10 ok, drift-test 66 ok, free-test 2 ok.

## P8 pickup 皮卡 (第 53 批, trial v66, 2026-10-29)
- Nick 2026-10-29: 「越野車 繼續做」. Picture first (/mnt/project-files/car-game/offroad/p8-v1.jpg: 火山紅 stock; 沙色 with the trail kit, roll bar and stripe; white side with the mud livery; blue rear with the bed), then the decision card 「好，做進去」 (sold at the 越野車行 for 90 萬, trial page first).
- A made-up four-door double-cab off-road pickup: mesh grille with body-colour "P8" letters, slim headlamps with two projector rings in a black band, red tow hooks, black squared flares, tube side steps, steel step bumper with a hitch, black bed liner, opaque rear window on the flat cab back. No real brand, badge or logo.
- Size: body 5.05 m (5.28 with bumpers), 1.85 wide (1.97 with flares), roof 1.84, wheelbase 3.10 (front axle +1.70, rear −1.40), track 1.58, 33" all-terrain tyres (R 0.42) on 17" six-spoke wheels. Cab back at x −0.70, bed x −0.74 … −2.55.
- Files:
  - `p8-body.mjs`: SDF body like the jeep's and the K2's, then make-car.mjs → `body-p8-q.glb` (garage, 1.66 MB) and `body-p8-lod.glb` (light car, 225 KB). Mask coordinates S 0.90, Y0 0.40 (`P8_M`). BOUNDS need at least 2 cells of margin past the body: make-car.mjs's surface nets drop the outermost cell, and the tailgate vanished with a 3 cm margin.
  - `p8-look.js`: surface masks, liveries `stripe` and `mud`.
  - `p8-spec.js`: parts. Wing `none` / `rollbar` (black tube roll bar in the bed with four round lamps), kit `stock` / `trail` (roof LED bar, steel winch bumper with two round lamps, mud flaps), height 0 / +4 / +8 cm. Default look: 火山紅, gunmetal wheels, stock.
- **PERF** (garage.src.html): price 90, 395 hp, 2250 kg, AWD, red 6000, `vmax` = `top` = 180, cda 1.35, `offroad: 1`, not `big`, tyres 3 / 6 萬. Six parts up to a big supercharger (+150 hp, 35 萬). One search (supercharged V8 pickups such as the TRX and the Raptor R) turned up only stock tests and drag races, no measured tuned top speed, so like the jeep and the K2 the parts only add power.
- **Ride**: terrain.js `offroad` class (third car on it): mud 40 km/h; ramp, lift and basement all work (not big: 5.28 m fits the tower bays and the lift); crushes things like the other off-roaders (people dive away).
- **Cockpit** (cabin.js `STYLE.p8`, `FIT.p8` from `node cabin-fit.mjs p8 --write`, which also writes the p8 entry of cabin-masks.json): left-hand drive automatic (two pedals, no hand brake), eyes 1.52 m up and 0.12 m in front of the car centre (0.22 first: the header was out of view and the legroom short), two big round dials with fuel and temperature between them, knobs stack, black cloth, grey headliner, a bench in the back. Three new STYLE options; the other cars keep the old behaviour because the defaults are the old values:
  - `dash.lip` (P8 0.04): lifts the dash's front edge to meet the windshield base. FIT's `bil()` takes the lower sample where neighbours differ by more than 4 cm, so under the raked windshield the dash sat 5 cm low and a red strip of body showed under the glass.
  - `bench.a` (default 24°, P8 12°): how far the rear backrest leans back. `inside()` clamps only y and z, never x, so a 24° backrest poked through the cab back wall into the bed.
  - `roofR` (P8 −0.58): where the headliner ends at the back. With no rear glass in FIT, `rt` fell back to the car's tail and the lining ran out over the bed.
  - Checked from outside (side, rear three-quarter, top): nothing of the cockpit shows outside the cab.
- **Sound**: 5.0 NA V8 (`SND_CARS.p8`, cross-plane firing like the jeep's 6.4 swap, red 6000); the `sc` part adds the supercharger whine.
- **Traffic**: npc.js `CAR_W` 0.8, no wing.
- **Dealer**: the shed has three pads now (offroad.js `DMAT`: x −7, 0.5, 8; mats 3.4 × 6 m for the 5.3 m truck). `oWant` still fills them cheapest first: K2 (60), J4 (80, now in the middle), P8 (90). The podium keeps the monster truck. town.src.js `oDisp` / `oLoading` have four slots.
- **Ramp entry**: jeep-test's line (from ramp-test) swings out to r 18.5 at 25°, which is outside the ramp's outer edge (17.2) and the concrete apron (17.5), then cuts in to RM 14.9 by 45°. The P8 couldn't follow that S at 4 or 7 m/s. Its wheelbase is 3.10 m, so the tightest turn is 4.5 m at the rear axle (the J4's is 3.5 m). Both times its nose hit the start of the ground wedge's outer wall at A0 (the first box of `towerRampGround().wedge`, r 17.15 ± 0.3).
  - Five lines tried in one session:
    - Turning right as soon as it's out of the door, aimed straight at the mouth (the RM circle from 12°): 0 bumps at 4 and 7 m/s, outer front corner 16.2–16.6 at the mouth (wall face 16.85).
    - Leaving through the left half of the door and then taking the old line also works.
    - A tighter first turn passes at 4 m/s but not at 7.
  - jeep-test `CAR.tight` gives the P8 the first of those lines; the J4 and the K2 keep the old one. The check is unchanged (0 bumps), and so is the ramp. Tip for players: with the pickup, turn right as soon as you're out of the door.
- **Tests**:
  - `p8-test.mjs` = `jeep-test.mjs` with `OFFCAR=p8`: garage page, cockpit, ramp to 3F (nothing crushed), lift to B1, park, back to 1F, expressway 180 km/h, mud 40 km/h. 22 ok.
  - test-b4 / test-app-b4: three shed pads checked (car, nose out, length, walker blocked at the nose). The dealer list is K2* / J4 / P8 / 怪獸卡車. The camera goes to pad 1, then pad 2 after tapping J4, pad 3 after tapping P8, then the podium.
  - mirror-test: adding the P8 to traffic (`CAR_W`) changed which car the seeded traffic puts nearest, and it became a dark, low HY. It shows in the mirror (screenshot), but hiding it changed the picture by only 2.51 (threshold 3; a GC8 gave 4.01 on 2026-10-21). The test now puts the nearest common car behind (YARIS, GC8 or 小黃; otherwise the nearest car): YARIS, 5.61. The threshold is unchanged.
- Published to the trial page 2026-10-29 (artifact version 67: the page + car-p8.txt + car-p8-lod.txt). Tests run: p8-test 22 ok, jeep-test 22, k2-test 22, test-b4 88 (was 86: the third pad adds two checks), test-b1 151, mirror-test 10, drift-test 66, top-test 5, free-test 2. test-app-b4 needs the site rebuilt first (docs/ still has two shed cars).
- **Numbers** (p8-test, 390×844, traffic paused):
  - Garage page 224 calls / 2.04M tris (J4 242 / 1.67M, K2 204 / 1.42M); 3F 212 / 1.41M; B1 228 / 1.44M.
  - Expressway 127 / 1.08M (J4 136 / 0.90M); driver's view 36 / 0.26M; mud pit 173 / 1.17M; 越野車行 panel with the P8 selected 151 / 0.43M (test-b4).
  - Body 117k tris (J4 94k, K2 76k); cockpit 7 meshes, 8.6k tris; car-p8.txt 2.21 MB; light car glb 225 KB.
