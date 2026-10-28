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
