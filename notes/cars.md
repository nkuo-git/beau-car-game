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

## GC8 details + brakes for every car (第 54 批, trial v67, 2026-10-29)
- Nick 2026-10-29 (after a BeamNG video): 「我覺得他的車子細節很多 我比較希望細節做多一點 為了要手機跑得動 影子跟反射我可以接受少一點」. Plan picture /mnt/project-files/car-game/gc8/gc8-detail-plan.jpg (7 items); the card went unanswered, so all 7 were done (the recommended option) and the card withdrawn. Before/after sheet: /mnt/project-files/car-game/gc8/gc8-detail-v67.jpg.
- Every car (parts.js):
  - **Tyres** (`MAT.tyre`, `tyreTex`, `tyreGeo`): one 2048×512 height canvas → colour + normal map, shared by all cars. Made-up sidewall text (BEAU RACING, SPORT GT, 225/45 R17 94W, RADIAL TUBELESS), rim-side bead, shoulder triangles, three tread grooves and shoulder blocks. The tyre is a lathe with its own v per profile point (inner sidewall 0–0.25, tread 0.25–0.60, outer sidewall 0.60–1) and u 0..2 around. Light cars and wheels without `mats.tyre` keep `mats.rubber`.
  - **Brake disc** (`rotorGeo`, `rotorTex`, `MAT.rotor`): one lathe (back face, chamfers, vented edge, friction ring, top hat) with hard edges (every corner point doubled, the zero-length strips are left out of the index). 512×512 colour + normal map repeated 8 times round: 48 drilled holes (7.5 mm, light chamfer; ellipses because u is angle and v is radius), turned rings, unworn rims, 40 slanted vanes in the vented edge, dark anodised hat. It has holes now, so it spins: `wheel({ rotor: true })` returns it and `buildCar` puts it in the wheel group (light-car rim pictures and the jeep's spare call `wheel()` without it).
  - **Caliper** (`caliperGeo`, `calMat`, `calTex`): one mesh: the arc with round ends (extruded, 12 mm bevel, smoothed normals except the flat faces: `smoothFlat`), two hex bolts and a bleed nipple (steel), a dark pad window on the bridge. Attribute `calk` 0 = caliper colour, 1 = steel, 2 = dark; the made-up word BEAU is the alpha of a 512×256 map mixed to white in the shader, so the 卡鉗 colour chip still works and the text stays white. Left calipers are mirrored (`brake.scale.x = -1`), so `side` flips u and the word reads the right way on both sides.
  - Draw calls: the brake group was disc + hat + caliper (3 per wheel); now rotor + caliper (2).
- GC8 only (gc8-model.js → `node gc8-bake.mjs --rebake --write` → `node make-lod.mjs gc8 --rebake`):
  - **Plates** (slot `plate`, own node): made-up number BEA-8888, raised border, letters and screws drawn as height (normal map). The light car keeps a plain light plate.
  - **Exhaust**: sooty inner sleeve and a dark disc inside the tip.
  - **Underbody** (slot `under`, own node, error 2 mm): muffler with bands, pipe from the front to the tip, catalyst, resonator, drive shaft with joints, diff, fuel tank with straps, rear and front arms, front under-tray. Nothing below y 0.12. Left out of FIT and of the light car.
  - **Rear defroster** (slot `defrost`, own node): the rear-glass triangles (glass group, x < −0.9, facing up) copied 1.5 mm inwards with a transparent 256×512 texture (14 thin brown lines + two bus bars); u runs across each row by that row's half width, v along x. In the game: transparent, no depth write, `forceSinglePass` (both sides in one draw), renderOrder 1 (before the glass). Left out of FIT and of the light car.
  - **Baked self-shadow (AO)**, `gc8-ao.js` (bake only, loaded by the bake page, not bundled): a BVH over all solid triangles (263k), ground plane at y 0, the four tyres as cylinders; 48 cosine-weighted rays per sample, 0.35 m reach. Paint → a 512×256 `aoMap` in the paint texture space (dilated, blurred; the nose cap borrows the unused floor strip of the map) = glTF occlusion texture; other solid parts → per-vertex AO multiplied into the vertex colours (strength 0.8). Glass, lamps, lenses, tail lamps, grilles, mirrors and the interior get none. About 30 s of the bake. In the game three.js applies aoMap to indirect light only, so supra.js also darkens the paint's diffuse by up to 60 % with it (`USE_AOMAP` in the paint wrapper): 普通／高 have no self-shadows, and that is where it shows.
  - Body: 20 → 23 nodes (+plate, +under, +defrost), 108k → 111k triangles, glb 2.34 → 2.62 MB. FIT.gc8 and WIDE.gc8 unchanged; WINGS_DECK.gc8 moved at the last stations only (the plate top is 5 mm higher than the old blank plate).
- look.js 超高 `carEnv` used to force a clearcoat of 1 on every physical material of your car with metalness < 0.5, so the 消光 finish (clearcoat 0.001) turned glossy while driving at 超高, and so did the rubber. Now only materials that already have a clearcoat (≥ 0.05) get it.
- cview.html: custom views take `tz` (target z, default 0) for close-ups of a wheel.
- Numbers (cview, whole GC8 with cabin, 1000×750): 63 → 62 calls (+3 body nodes, −4 brake meshes; the defroster was drawn in two passes until `forceSinglePass`), 156k → 168k triangles (tyres, discs, underbody). In the game (mirror-test, driver's view): main view 190 calls / 0.73M, mirror pass 99 / 0.41M.
- Published to the trial page 2026-10-29 (artifact version 68: the page + car-gc8.txt + car-gc8-lod.txt; the P8 files from version 67 unchanged). Tests: test-b1 151 ok, test-b4 88, p8-test 22, jeep-test 22, k2-test 22, mirror-test 10, drift-test 66, look-test 18, top-test 5, bump-test 7, free-test 2; free-test and mirror-test again after the `forceSinglePass` rebuild.

## GC8 thinner panel gaps + better lamps (第 55 批, trial v68, 2026-10-30)
- Nick 2026-10-29, after trial v67: 「還不錯 我覺得車燈可以再做更好一點 還有車身鋼板間的縫隙有點太明顯 把它修飾的細一點 少一點鋸齒」. Reference: the parent's headlight / tail-lamp photos (look only). Before/after sheet: /mnt/project-files/car-game/gc8/gc8-lights-gaps-v68.jpg.
- **Panel gaps** (gc8-model.js `paintMaps`, baked 2048×1024 paint map + normal map): the gap used to be 8 mm of solid dark plus a 1.5 mm ramp, decided per texel (2.1 × 3.3 mm), and its normals came from finite differences ×30, so every texel step became a jag with a white/black edge. Now the gap is 3.4 mm (`SW` 1.7 mm half width) with a 2.5 mm rounded edge (`BV`) on each side. Texels within about 1.2 cm of a seam are supersampled 5×5 over 1.25 texels (`NS`, `FP`): colour = covered fraction (dark 82 %, plus up to 22 % "occlusion" on the rounded edge), normal = the average slope of the rounded edge, pointing into the gap (`seamAt` returns the distance and the direction away from the nearest seam in world space; the slope is converted to the shader's tangent frame, T = ∇u, B = ∇v, divided by the larger of the two). The edge strength is `KN` 0.8. A recess lit from above now shows a thin highlight on the lower lip and a darker upper lip. Only texels near seams are supersampled, so the bake time did not change.
- **Headlight** (`HT`, `rm`, `frost`): the reflector texture is now drawn per pixel: around the bulb 8 radial facets, then a 9×5 grid of flat chrome facets slightly bent with the bowl, each with its own tilt (normal map ±0.5) and bright albedo (0.84–0.96), 1 px dark seams with a 1 px bright rim; outside the bowl, vertical cylindrical flutes (9–17 px) broken by two horizontal lines. Daytime emission 0.14 → 0.03 and roughness 0.1 → 0.06 (gc8-model.js and supra.js `reflector`), so the look comes from reflections, not from a grey picture glowing. The corner lamp and the bottom strip (`frost`): 24 round vertical flutes, metalness 0.55, roughness 0.16, emission 0.1 → 0.03. Night glow (`bakedNight`) unchanged.
- **Lens**: the lens texture now has alpha: an almost clear dark base (alpha 0.05) and grey grid lines (alpha 0.3, 12 vertical + 3 horizontal, like the photo). In the game the `lens` material uses the map (white colour, opacity 1); the base still gives the old dark 0x0d0f11-ish look.
- **Turn signals and side markers** (`Mt.lensAmber`, colour e88a16 → e47c12): a repeated 128² prism map (4×4 cells of 3 mm, four-sided pyramids in the normal map, darker cell edges); the lens uv is metres, the texture repeat (1/0.012) is baked into the uv. In the game `amber` takes `map` + `normalMap`, opacity 0.78 → 0.72. A small chrome screw at the inner top corner of each front turn signal (slot `bright`, no new draw call).
- **Duct below the turn signal**: 6 thin orange plastic louvres tilted 0.45 rad (were 3 clear amber bars). They are in the `trim` slot (vertex colour d98a2e) so they cost no draw call; make-lod.mjs reads the vertex colour (`Wm` = red − blue) and puts orange trim into the light car's amber class (the old rule "light trim = plate" would have made them white).
- **Tail lamp** (`tailMat`): two darker red reflector rectangles in the inner half, a rounded reverse-light frame in the clear strip, thin prism grid lines over the whole lens, and a 6×5 px pyramid normal map instead of horizontal ribs. The red / clear split stays at v 0.43 (make-lod `BK_TAIL_V`).
- Numbers: body 111,274 → 111,596 baked triangles, 23 nodes (no new group); glb 2.62 → 2.66 MB (reflector colour 129 → 32 KB, reflector normal 41 → 105 KB); light car 211 KB (about the same). cview: whole car 62 calls before and after, +270 triangles (screw, louvres). FIT.gc8, WINGS_DECK.gc8 and WIDE.gc8 unchanged.

## Z2 ATV 沙灘車 (第 56 批, trial v69, 2026-10-30)
- Nick 2026-10-29: 「繼續做其他的」 in the off-roader thread, the last vehicle on his list (沙灘車). In Taiwan 沙灘車 usually means the ridden quad, so the picture (/mnt/project-files/car-game/offroad/z2-v1.jpg: yellow with the rider, blue with the trail kit, red side with the stripe, lime rear) showed that, with a card 做進去 / 要改 / 改做坐的 (a buggy with a wheel and a cage). He chose 「好，做進去」: sold at the 越野車行 for 30 萬 (the cheapest vehicle in the game), trial page first.
- A made-up four-wheel ATV you ride: two slanted strip headlamps with two projector rings each, black mesh grille, one red tail strip, fender humps over the wheels, flat centre deck with the tank, black side covers, long black seat, handlebars (grips, levers, a pod with a small screen), A-arm suspension with red coil shocks, black foot boards, front bumper, rear bumper with a hitch, exhaust on the right. 25" knobby tyres (R 0.32, 200 front / 250 rear) on 12" six-spoke wheels with black beadlock rings. Wheelbase 1.26 m, track 0.95 / 0.93, about 2.16 m long and 1.2 m wide. No real brand, badge or logo; the only words are "Z2" and the number "88".
- Files:
  - `z2-body.mjs`: SDF body in metres (no mask scaling, unlike the jeep, the K2 and the P8). Fender humps are ellipse arches (`Z2_FENDERS`). make-car.mjs → `body-z2-q.glb` (garage, 422 KB) and `make-lod.mjs z2` → `body-z2-lod.glb` (light car, 298 KB, part error 3 mm). `body-z2.glb` is the git-ignored intermediate.
  - `z2-look.js`: surface masks; liveries `race` (white number plate "88" over the rear wheel, "Z2" over the front wheel, a slash on the tank side), `stripe` (a thin line along each fender, "Z2"), `none`. The side covers are hidden by the rider's legs, so all livery art sits on the fenders right above the wheels.
  - `z2-spec.js`: parts, `Z2_RIDE` / `Z2_ride` / `Z2_steer` / `Z2_eye` / `Z2_helmet` (below), `Z2_GARAGE` (8 paints, default 閃電黃 with black wheels; racks `rack` / `none`; kit `stock` / `trail` = big front bumper, winch, two round lamps, hand guards in body colour; height 0 / +3 / +6 cm; livery race / stripe / none). No cabin: `build()` removes `interior`.
  - `z2-view.html`: cview.html for pictures, plus `rider=1` (you on it), `steer=`, `helmet=`, and `v=fp` (first person, `hide=1` without the rider).
- Shared changes:
  - masks.js: livery only on outward-facing surfaces, so the fender humps' inner slopes (and the P8's bed walls) no longer get livery.
  - character.js `'sit'`: `feet: [x, y, z]` (ankle target, knees out), stored as `S.seatFeet` (`S.feet` is the walking gait's). `hands` can now also be two targets `[[left], [right]]` (`sitLean`, `sitArms`), because the grips move when the bars turn.
- **The rider** (town.src.js `RIDER`, `riderMake` / `riderOn` / `riderOff` / `riderStep`): a second character with your own look (`meLook()`) plus a helmet (`Z2_helmet`: if your hat is already the helmet it keeps your colour, otherwise white). Built once, re-looked when your look changes. While riding it hangs on the car body at `Z2_RIDE.at` (x −0.22, y 0.438): seat pose, hands on the grips, feet on the foot boards (`Z2_ride` every frame). It shows only while you are really riding (`cur === 'z2'`, driving, the car visible, the walker off and hidden, so not while sleeping). Taken off on the garage page (`goHome`, `stowFull`); the 400 m race puts it on its own car (`enterRace`) and takes it off when the race doesn't return to the village (`exitRace`).
- **Handlebars that steer**: `Z2_steer(body, s)` turns the `bars` group about the stem (pivot 0.40 / 0.95, axis tilted 20° back, at most 0.5 rad) with `drv.telemetry().steer`, and `Z2_ride` turns the grip targets the same way, so the hands follow.
- **First person**: no cabin, no mirrors. The eye is the rider's eye (`Z2_eye`: 30 frames of the pose, then `C.eyes`) + 6 cm forward (makeDrv `eye`), and the rider is hidden: with it drawn, the helmet visor showed as a dark arc over the landscape. `CABIN_VIEW.z2 = Z2_RIDE.view` gives the garage page's 「車內」 view from the seat. mirrorStep now returns when `MIR.list` is empty, so cars without mirror meshes (the Z2) skip the rear-camera pass.
- **Friends** (net.src.js): a friend riding a Z2 has their walking character put on the light car's body at `Z2_RIDE.at` with a helmet (their own hat saved in `P.hat0`), posed with `Z2_ride` (bars straight). `netUnride` gives the hat back and stands them up when they get off, change car or leave. No new data in `world/p`, so the rules don't change.
- **PERF** (garage.src.html): price 30, 48 hp, 300 kg, AWD, red 8500, `vmax` = `top` = 105, cda 1.0, `offroad: 1`, `light: 1`, tyres 1 / 2 萬; six parts, +25 hp in all (intake 3, exhaust 4, ECU 4, header 3, cams 5, big bore 686 → 750 cc 6). Top-speed search (one round):
  - The fastest quad on record, 315.74 km/h (Terry Wilmeth, 2008), is a modified 700 cc sport quad with a hybrid rocket thruster (Guinness, https://www.guinnessworldrecords.com/world-records/fastest-speed-on-a-quadbike-(atv)).
  - Tuned figures only exist for 1000 cc twin sport quads: owners past 85 mph stock, past 100 mph (160 km/h) with an ECU flash and an exhaust; big 1000 cc utility 4×4s do 75–80 mph stock (webBikeWorld, https://webbikeworld.com/the-fastest-stock-atvs).
  - Nothing for a single-cylinder 4×4 like this one, so the parts only add power (start, hills, mud), like the jeep, the K2 and the P8.
- **Light = no crushing**: `crushK = offK && !PERF.light`. The Z2 rides the terrain.js `offroad` class (mud 40 km/h, rough ground, fourth vehicle on it) but crushes nothing: hitting a prop or a car works like a normal car, and it doesn't count as the big-truck kind of hit (`q.big`). Not `big`: ramp, lift and basement all work.
- **Sound**: 686 cc single (`SND_CARS.z2`, from the yaris table with one cylinder firing, red 8500, idle 0.16, raspy, pops on lift-off).
- **Traffic**: no `CAR_W` entry, so it isn't in traffic (a traffic Z2 would need a rider).
- **Dealer**: the shed has four pads now (offroad.js `DMAT`: x −11, −4.5, 2, 9; was −7, 0.5, 8). `oWant` fills them cheapest first: Z2 (30), K2 (60), J4 (80), P8 (90); the podium keeps the monster truck. town.src.js `oDisp` / `oLoading` have five slots.
- **Tests**:
  - `z2-test.mjs` (new, jeep-test's harness): garage page and 「車內」; get on (rider visible, helmet, hands and feet on their targets, the eye); the ramp to 3F with jeep-test's line (height error 0.028 m, nothing crushed); lift to B1; park, get off, back on, down to 1F and out; expressway 106 km/h after 20 s (top 105); the bars and the hands turn with the steering; first person (camera at the eye, rider hidden, no mirror meshes) and back to the chase view; the mud pit at 40 km/h; a crushable box hit at 26 km/h stays up (one bump). 31 ok.
  - test-b4 / test-app-b4: four shed pads checked (car, nose out, length, walker blocked at the nose); the dealer list is Z2* / K2 / J4 / P8 / 怪獸卡車; the camera goes to each pad in turn after tapping each car, then the podium. 90 ok (was 88). test-app-b4 needs the site rebuilt with the Z2 first (docs/ of content 31 has three shed cars).
- **Numbers** (z2-test, 390×844, traffic paused):
  - Garage page 162 calls / 676k tris; 「車內」 38 / 278k; on the lobby lift 181 / 738k; 3F 177 / 745k; B1 194 / 755k; parked 178 / 732k.
  - Expressway 97 / 401k; turning 97 / 391k; first person 64 / 346k; mud pit 139 / 493k.
  - Light car: body 18k tris, about 26k with parts. car-z2.txt 563 KB, car-z2-lod.txt 407 KB.
- Published to the trial page 2026-10-30 (artifact version 70: the page + car-z2.txt + car-z2-lod.txt; every other car file is byte-identical to version 69). Tests run before publishing: z2-test 31 ok, test-b4 90, test-b1 151, jeep-test 22, k2-test 22, p8-test 22, crush-test 55, mirror-test 10, drift-test 66, top-test 5, bump-test 7, free-test 2.
