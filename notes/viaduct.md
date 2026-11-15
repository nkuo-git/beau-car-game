# Roundabout viaduct + big parking lot (圓環高架橋＋超大停車場) — batch 91, trial v102 (2026-11-14)

Nick: 「在原本的快速道路上搭建一個像這樣的圓環高架橋上高架也可以通到內湖最遠處有斜坡緩緩下高架 並且高架橋中間下面要有一個超大停車場有很多車車一樣從車店挑」 (two photos, reference only).
Draft: https://claude.ai/artifact/FAaQSJMuCUmvLgnfMcFRC2 — Nick 「好 做完直接上線」 (shipped straight as content 46 with batch 90).

## What you get
- The hill inside the south half of the freeway loop (hills.js `(−805, 185)`) is gone. In its place:
  - a flat asphalt parking lot (radius 96.5 round (−780, 250)): 9 east-west rows, bays on both sides, a north-south aisle
    (7.2 m) down the middle: 972 bays, about two thirds (≈620) with a dealer car in them (cheap ones common, supercars rare:
    same table as the 環山路 bays, `lotKind`/`lotLook` with its own seed `VDL_SEED = 7000`).
  - an opening in the freeway's inner rail at the south apex (village.js `VD_GAP`, s 1853 ± 7.5) and a 10 m road north to the lot.
  - the roundabout viaduct: starts at ground level at the lot's north edge (−780, 145) heading west, climbs 1.5 turns
    (centre (−780, 250), radius 105, 990 m, ≈2.5%) to 24 m above the south side, then heads east over the freeway and the
    Neihu entrance, along the north foot of the Neihu hills (z ≈ 312), turns south at the NE corner, runs down the east side
    (x 1755) over the MRT, comes down at 4% and lands at the end of the south-easternmost Neihu road. About 5.0 km.
- Two lanes each way (3.5 m), double yellow line, 1 m concrete barriers, lamps every ~45 m (lit at night: `V.lampsX`/`V.lampsK`
  go into look.js's lamp list), piers every 30 m (not on roads, houses, tunnels), and where the two roundabout layers overlap,
  columns on both sides with a cross beam. Under 6 m clearance the sides are solid walls (the ramps). Clearance is at least
  6.5 m on the flat part (the MRT guideway counts as ground + 4.5 m).
- Houses under the deck are removed (village: `vdNear` skips trees/houses; neihu.js marks buildings whose outline is within 3 m
  of the deck edge as `b.mrt = true` → not built, list in `N.vdGone`).
- Player only (like the tunnels' upper level and the tower ramp): traffic, police and pedestrians stay on the ground.
  While you are high on the deck (`VDV.st.high`): the police can't see you (`polPlayer().hidden`), traffic doesn't react to you
  (npc `me.x = 1e6`), crush ignores you, junk colliders are off, ground colliders within 6 m of the deck edge are off.
- You can get out and walk on the deck (barriers stop you, jump works) and walk in the lot. Within 26 m of you in the lot, the
  nearest 8 cars become real LOD cars (`buildLodCar`, pooled per kind, one built at a time every 0.25 s); further ones are the
  instanced boxes.

## Files
- `src/viaduct.js` (new IIFE, in build-art.mjs / build-app.mjs just before `hills.js`; exports
  `VD_PATH, VD_LOT, VD_GAP, VD_TEXT, vdNear, vdInLot, buildViaduct`). Header comment = API.
  - `VD_PATH` is computed at load (no village needed) so village.js / neihu.js can call `vdNear` before anything is built.
  - `buildViaduct(V, { renderer, lotCar(n) → {k, paint} | null, dims(k) → [L, W, H] })` after `buildHills`: deck/barrier
    meshes in 400 m chunks (`vd-road` with role 'road', `vd-conc` vertex colours), piers, columns, lamps (`vd-lamp`, emissive
    map = map → look.js night boost), signs (`vd-sign`), the lot (ground + lines + far cars: 2 InstancedMeshes `vd-lotcars`,
    `vd-lotcars-dark`, per-instance colour, scaled by `LOT_DIMS`).
  - `VDV.at(x, z, py)`: deck height within [py − 3, py + 1.5], closest to py (the roundabout has two layers on top of each other);
    `normal`, `Q` (last s, u, slope). 16 m grid of segment indices (`GRID`).
  - `VDV.cols`: barriers (`off` unless the player's y is within the deck band; `h = deck + 1`, `y0 = deck` when elevated
    so you can drive under; `lowCam` so the chase camera isn't blocked), piers/columns (off when you are on the deck),
    lot cars.
  - Side effects: `V.viaduct`, `V.info.viaduct`, lamps appended to `V.lampsX`/`V.lampsK`, `V.surfaceAt` (asphalt) and
    `V.mapDraw` (the minimap / big map draw the deck) wrapped.
- `src/town.src.js`: `VDV` built in enterDrive; `proxyWorld` asks the viaduct first (`vdY`: at(x, z, st.py), or the ground when
  the point is > 30 m from the player) for heightAt / terrainAt / normalAt / surfaceAt; `W.groundAt` = the ground without the
  viaduct. `vdStep(dt)` in driveStep (writes `VDV.st` from the walker or the car), `vdLotStep`, `vdLotOff`, `LOT_DIMS`, `VDL`.
  `rampHigh()` includes `VDV.st.high`.
- `src/net.src.js`: friends see you at deck height (`s.y` sent while `VDV.st.on`, driving or walking).
- `src/village.js`: rail gap (`VG0`/`VG1`, meshes, posts, cushions, colliders), paddy removed, a grove moved to (−948, 352).
- `src/hills.js`: the hill removed; tunnels find their hill by `tun` (`findIndex`) instead of a fixed index.
- `src/drive.js`: `tall(c)` skips `lowCam` colliders.
- `src/look.js`: lamp list includes `V.lampsX/V.lampsK`; `lampPick` weights height difference (`ey`, beyond 12 m) so on the
  deck the deck lamps win and on the ground the street lamps win.

## Gotchas
- qb's triangle counter is `nt` (`tri` is the method that adds a triangle; having both named `tri` broke the build).
- Removing an entry from `HILL_LIST` shifts indices: anything that points at a hill by index breaks (the tunnels did).
- walk.js colliders: `y0` absolute bottom, `h` absolute top; without `y0` a collider always blocks the walker.
- Known limitation: a friend's car parked on the deck is drawn at ground height (pv/pk carry no y).
- Piers in Neihu may stand on sidewalks (surface 3 counts as road only west of x 100); pedestrians walk through them.

## Tests
- `viaduct-test.mjs` (new): route/heights/clearance/slope/piers/lamps, lot flat + asphalt + car mix, no house under the deck;
  the freeway opening; one drive freeway → opening → lot → roundabout → Neihu end and down (stays on the deck, never stuck,
  police hidden while high); driving under it (connector, freeway outer lane); get out on the deck, walk into the barrier,
  jump, get back in; lot near cars swap in/out; screenshots + draw calls; night lamps at 高.
- hills-test: 23 hills; the climb uses the north hill inside the freeway loop (−800, −165).

## Batch 92 (2026-11-15, trial v104) — Nick's ten asks for the viaduct
Nick 2026-11-15: steering wheel reversed; curve / speed-limit signs; gantry signs saying where each lane goes; a few cars on the
viaduct, sports cars faster; people walking in the roundabout's middle; no pop-in; branches to the MRT and the city centre;
an ETC gantry before the last exit and a big road in Neihu after it; a rest area modelled on 南投服務區 (convenience store,
toilets, in/out ramps, cars from the dealer coming and going, people and the three animals).

- Hands on the wheel turn the same way as the wheel (`seats-test` checks the direction).
- Far parked cars (`farcars.js` from `make-far.mjs`): each kind's own ~300-triangle shape in one InstancedMesh per kind.
- Ramps (`viaduct.js` ROADS[1..]): A (環山路 / 港墘站) and B (內湖路二段 / city centre) exits; EX/WX into the rest area,
  EE/WE back up. Exits leave from the outer lane (`UC` = distance from the main centre line).
- Rest area (`vdrest.js`): platform at y 24 between x 800–1214; `restLayout` (roads N/S/CW/CE/A1/A2, 460 bays in 4 rows,
  hall + walk-in store (interiors.js store), two toilet blocks, gas station, bus lot, plaza with pond and benches);
  `buildRestArea` meshes + colliders (`y0` = 24). ~58% of bays have a parked dealer car (lot cars with `area: 'r'`).
- Signs (`vdsign.js`): speed limits, curve warnings (before each sharp bend, both directions), 5 gantries across the road
  (`門架`; lanes → destinations) and the ETC gantry before the last curve (`etc`). Sign post colliders block only a player at
  the post's own height (`off` = `!(py > y0 − 0.5 && py < h − 1)`): the WE start runs under the EX ramp, whose posts
  used to block it (an early `st.high` getter also switched them off for the whole rest area, which is up at 24 m).
- ETC (`town.src.js vdStep`): crossing an ETC `s` on the main road beeps once and toasts 「ETC 嗶！（免費）」 (`st.etcN`).
- Neihu big road (`neihu.js NH_BIG`): 成功路二段456巷, 陽光街, 文德路208巷 widened to 21 m + 3.6 m sidewalks; buildings
  in the way are not built (`b.mrt`), street-name signs pushed out, edge barrier widened; npc lanes use `r.lo` (outer lane).
- Traffic (`vdtraffic.js`, new): its own few cars (main road ≤ 6) picked from the dealer (`vdtKind`: 28% sports/supercars).
  - Lines: four main lanes (`M±0/1`; ±1.85 / ±5.55 m from the centre, +S traffic on +u = right-hand traffic) with the big
    lot's central aisle at the start (from z 452 on the connector road) and 120 m of the Neihu big road at the end; ramps
    (A/B have 80 m of ground road after them). Speed: curvature (a_lat ≤ 1 m/s² × √car's alat) and limits (60 roundabout,
    80 middle, 50 down to Neihu) with braking look-ahead; ordinary 22.5 m/s (~80), sports ×1.25 (~100), supercars ×1.5
    (~120).
  - Car following + stop for the player (same level, ahead, within 2.2 m sideways); lane change to pass a slower car or
    you (`laneChange`: other lane clear −22…+40 m, not if an exit is planned; drawn sliding over 2.4 s).
  - Exits: outer-lane cars take A/B (22%) or the rest area (30%). Rest area: pick a free bay → `arrive` route → park 40–120 s
    → back out (`leave`, reversing Bézier) → EE/WE → merge. Parked lot cars also leave (`depart`, every 15–35 s while you
    are within 600 m): the LOD car is placed first (`needObj`), then the instanced copy is hidden and its collider turned
    off (`onTake`); far away (> 760 m from the rest area, no rest traffic) they are put back (`onGive`).
  - Spawn 420–820 m away (first three after a clear: 250 m) so nothing appears next to you; a new car waits where it
    spawned (`needObj`: not drawn, not a collider, followers treat it as stopped) until town has put its LOD car on it,
    so it never pops in closer (gives up after 6 s: `st.lost`); at a route's end a car waits
    only while within 170 m **and** inside the camera frustum (`o.seen`), otherwise it is removed.
  - town: `vdTrafficStep` after `npcStep` (LODs share the `VDL` pool; one build at a time; hidden beyond 700 m);
    colliders: drive gets `VDT.colliders(x, z, 30, y)` ('vdtraffic', same level only), walking → `NPC.MOV`;
    `vdTrafficOff()` on going home; `VDT_ON` (tests turn it off while checking the road).
  - Gotcha: "stop at the end of the segment" braking (`√(2·2.5·(left − 0.3))`) reaches 0 before `end − 0.05` → treat
    `left < 0.4 && v < 0.3` as arrived (cars used to freeze before parking / at the end of a ramp).
  - Gotcha: probes that step many frames inside one `page.evaluate` never let the async LOD loads finish (`needObj` cars
    wait forever) — step in chunks with awaits.
- Crowd (`vdcrowd.js`, new): people + the three animals (half each) in two zones, each a 0.5 m walk grid with colliders
  (± 0.4 m) carved out: the big lot's E–W aisles (west and east halves; the central aisle has traffic) and the rest
  area's plaza / store front (`RL.walk[0..1]`). BFS inside the connected piece → pick a spot 6–40 m away → string-pulled
  path; idle 1.5–7 s; give way to each other and to you. Your car coming: jump aside (`dive`); too fast to dodge: fall and
  get up (`onHit` → `crowdHit`: toast, crime only for people and only on the ground); kids always jump aside; anyone under
  the car is pushed out. Built one per frame when you are within 250 m, hidden beyond 200 m. People walking out of the
  rest-area store become crowd agents (`spawnAt` via `LDF_HOOKS.leave`).
  - Dodge only when in front of the car (`ahead > 0.4·hx`); jump to the far side only when the near side is blocked
    **and** the car is still > hx + 2.5 m away (otherwise go as far as the near side allows; the push-out does the rest).
    Walking agents do not step into the area in front of / beside a moving car (they wait, re-plan after 2.5 s).
  - Gotcha (test 9d): letting off the throttle at 4 m/s stops the car (engine braking) ~5 m short — hold ~4 m/s.
- Draw calls seen from far away (neihu-test's drone over 港墘 went 227 → 274): the far parked cars are one InstancedMesh per
  kind **per area** (lot / rest area), and each area's whole bounding sphere is in view from Neihu → `lotFar().cull`
  hides an area's meshes when the camera is > `FAR_CULL` (650 m) from the area's edge; `cullFar` also hides the whole
  rest-area group beyond `REST_CULL` (900 m from its centre). town `vdStep` calls `VDV.cull(dcam.position)` each frame
  (last frame's camera). Ramp concrete used to flush one chunk per ramp (6 chunks); now ramps whose starts are within
  700 m share a chunk (`rampEnd`): [A], [B], [WX, WE, EX, EE]. Probe (390×844, 普通, same pose): content 46 227, now 233.


## Batch 93 — median, two-way main road, highway police (trial v105, 2026-11-15)
Nick 2026-11-15: 「高速公路做成雙向來回的中間用分隔島隔開上網查高速公路分隔島圖片」「高速公路有額外的警用追逐車用GC8去查國道警車塗裝並採用」.
- **Median** (viaduct.js `MED`): main road s `S_OPEN+4` … `L−4` (40 … 5034 m), New-Jersey concrete barrier
  0.6 m wide at the foot, 0.18 m at the top, 0.82 m tall (profile `MPR`), plus green anti-glare slats every 1 m, 0.62 m
  tall, turned 35° to the road (the usual Taiwan freeway median). Built per 4 m segment into the deck chunks
  (`medSeg`, end caps `medCap` in yellow), so no extra draw calls beyond the chunk (perf below).
  Colliders: one box per 4 m (`vd:'med'`, 1248 of them, `lowCam`, `noCrush`), only on the deck level
  (`off` getter like the side barriers). Deck paint: double yellow moved to ±0.55, lane dashes at ±3.9.
- **Lanes** (vdtraffic.js `LANE`): inner 1.85 → 2.2, outer 5.55. Traffic always keeps right (+u when going +S).
- **Highway police** (vdtraffic.js `c.cop`, town.src.js `VCOP`/`copGet`/`copSiren`): one GC8 patrols the main road
  (spawned like normal cars, 420–820 m away, only while `nMain < max`); when you are wanted and on the main road it
  chases you on your side of the median (its own s/u: `copPose`/`copStep`, max 50 m/s, changes lane around cars, other
  cars pull over); 1★ → 1 car, 3★+ → 2 (`spawnChaser` 300 m behind). Within `COP_SEE` 90 m it tells police-ai you are
  seen (`seenBy`, stars don't drop); you stopped (or on foot) with it within 10 m for 1.2 s → `catchBy('hwy')`
  「被國道警察抓到了！」; hitting it → `crime('cop')` +1★. Leaving the main road / no stars / too far → gives up
  (lights off, back to patrol or parks on the shoulder). Siren = police-ai `makeSiren` on the same output bus.
- Hitting people/animals in the rest area now counts as a crime too (`crowdHit`; animals still don't).
- Tests: viaduct-test section 10 (85 ok): median everywhere, driving at it from the outer lane stops you
  (closest 1.26–1.30 m from the middle, 1 bump), traffic never on it, police car looks (10b), patrol (10c), chase (10d),
  give up (10e), ramming (10f), caught (10g). Section 3's robot now drives the middle of its carriageway (u 3.9 instead
  of 2: with u 2 its pure-pursuit corner cutting hit the median in the two 65 m corners).
- Perf (390×844, 普通): lot 195 (191 before), crossing 308 (303), under 362 (356), roundabout/neihu-end/ramps same;
  +25–55k triangles. Highway police chase shot 356 calls / 0.90M.


## Batch 94 — four lanes each way, rest-area toilets, big store, asphalt (trial v106, 2026-11-15)
Nick 2026-11-15: 「高速公路兩邊各加寬成4道」「南休廁所沒有入口進去裡面沒有馬桶」「南休便利商店要長得跟改車廠旁的完全不一樣裡面大一點南休路面真一點」.
- **Four lanes each way** (viaduct.js): asphalt half-width `ROAD` 7.4 → 14.3, barrier `HW` 8 → 14.9. Paint (from the
  centre line): double yellow ±0.55, lane dashes 3.9 / 7.25 / 10.6, edge line 13.95. Helix radius `R` 105 → 112 (the
  lot stays 96.5 so the inner barrier doesn't sit on the parking bays); north stretch z 312 → 319. The main road got
  64 m longer (L 5038 → 5096, helix 990 → 1056), so **every ramp `s0` moved +64 (B +58, end x 1742 → 1735)** to keep
  the ramps where they were; `vdsign.js` fallbacks too. Ramp constants follow the road: `U0 = ROAD − RROAD`,
  `U1 = HW + 5`, `U_SEP = HW + RHW`. Piers wider (hz 2.2), caps `HW − 1.6`; helix columns at `R ± (HW + 1.4)`;
  lamps every 40 m (was 48), 10 m tall with longer arms.
  - Lesson: when the main road's length changes, ramps keyed by `s0` slide along it. With stale s0 the WX/WE/EE ramps
    turned back on themselves (57% grade, U-turns) — viaduct-test 3b/9a caught it.
- **Traffic** (vdtraffic.js): `LANE` [2.2, 5.55, 8.9, 12.25]; `laneChange`/`tryLane` try the inner lane first
  (overtaking), then outer; `nearLane(u)`; `U_MAX` from `V.path.road`. Last stretch (成功路二段456巷 is 2 lanes):
  outer lanes k 2, 3 merge into k 0, 1 between `DROP0` and `DROP1` from the end (`uAt`), cars move in before
  `DROP_GO`, no spawns there. Highway cop picks the emptier neighbouring lane. Spawn fix: `nMain` counts up when a car
  is spawned in the same frame (the patrol cop used to make it 7).
- **Toilets** (vdrest.js `buildWc`): each building = men | family/accessible | women, open doorways with a screen wall
  inside (like real rest areas, no door leaves), stalls with toilets, urinals in the men's, sinks; ceilings in the
  unlit glow buffer (they were dark). Layout `L.wcs` (wcs[0] x 925–957, z 199–219): men door west, family south,
  women east. `fixtures` list (toilet / urinal / sink) is exported as `VDV.rest` with `wcs`, `store` (tests).
- **Big store** (interiors.js `bigStoreFloor`, `planOf` `big`; vdrest.js store x 989, z 216, 26 × 16, door z 224.15):
  「大便龍市集」: dark wood, red sign, a row of red lanterns outside, warm windows, automatic door in the middle; inside
  wood floor/shelves (gondolas), deli case with two hanging cylinder lanterns over it (first try hung them by the door:
  they filled the camera and showed 福 mirrored), fridges with light boxes, the same 9 shop spots + till as the village
  store (mart.src.js works unchanged). Looks nothing like the village store (white, green/yellow/red stripes).
- **Asphalt** (vdrest.js `asphTex`): rest-area roads and lots use a 12 m tiling asphalt texture in world coordinates
  (gravel, patches, cracks, oil) on mesh `rest-road` with `userData.role = 'road'` (look.js road shader at 高/超高).
- **Tests**: viaduct-test 9e (walk into the three toilets: inside, camera under the ceiling, fixture counts) and 9f
  (walk into the store: name, 26 × 16, bigger than the village store, 9 spots 拿, checkout, bag, walk out; asphalt map
  ≥ 512 px, role 'road'). 10e also prints cop states / crimes for diagnosis.
