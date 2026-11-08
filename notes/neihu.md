# 內湖 (b4-neihu): a 1:1 map of 內湖 from OpenStreetMap

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

## What works
- **The whole of old-scratch/neihu-data/neihu3.osm is used**, with no radius clip.
  - Bounds: lat 25.07427–25.08649, lon 121.57078–121.58820. That is 1756 × 1351 m, 1:1.
  - The 港墘路 × 內湖路一段 junction (25.07943, 121.57687) is the reference point. The map centre sits at world (2102, 200).
  - The data box in the world is x 1488…3244, z −580…770.
  - The data is ODbL. While in 內湖, the screen shows 「地圖資料 © OpenStreetMap 貢獻者」.
- **Offline converter** (`node neihu-conv.mjs [file.osm] [--out file]`). It reads the local file, downloads nothing, and takes about 2.4 s. Output:
  - 418 roads with widths by class, lanes, one-way and sidewalks; 1007 nodes; junction pads; 273 zebra crossings.
  - 33 road-closed barriers where streets leave the data.
  - 4843 buildings: 719 from OSM, the rest are blocks filled in along streets. Heights come from levels or height, otherwise from the class.
  - 374 騎樓 arcades on shop streets (pillars are colliders). There are about 1400 generic shop signs, with no brand names.
  - OSM building polygons that stick into a lane are pulled back to the kerb (130), or dropped if that is not possible (11). The elevated 港墘 station building (layer ≥ 1) is not extruded on the road.
  - The 文湖線 viaduct: 37 piers, kept off lanes and junctions, and stations 文德 and 港墘 with 4 entrances.
  - 109 areas (schools, tracks, parks, water, courts, pitches) and 24 school/park signs, for example 麗山高中 and 內湖高工.
  - 318 street-name signs (139 names) and 4569 street trees.
  - A re-run reproduces neihu-data.js byte for byte, dates ignored; neihu-test part 0 checks this.
- **In the game:**
  - Link road: it leaves the drag strip through a new south guardrail gap at x −57.5…−37 (z 6.3) and runs along z 22 to x 1000. It then bends through a valley in the west ridge to 內湖路一段 at the west edge, with guardrails.
  - 「去內湖」 destination pill: the 7th, before 回車庫. The bar is 4 + 3 at equal width. The garage → 港墘站 route is 2.45 km.
  - 金面山 and the hills form a green ring outside the box: north 235 m, east 150, south 70, and a 62 m west ridge. There are 2600 hill trees. The MRT goes into tunnel portals where the hill rises above the deck.
  - drive.js and walk.js use the building/arcade/pier/tree colliders. Surfaces are asphalt, pavement and grass.
  - The minimap draws the 內湖 streets, parks, water and buildings live (`mapLive`). The original village layer keeps its old bounds (`mapBounds`).
  - Arrival toast: 「到港墘站了！上面是捷運文湖線，可以下車走走」.
- **Performance:**
  - Geometry is merged per material per tile: 250 m tiles for walls, 500 m for ground, roads and paint. The window atlas is repeated in the shader.
  - Trees are an InstancedMesh per 250 m tile. Tiles are distance-culled every 8 m of camera movement.
  - The far world is hidden while you are in 內湖. That covers village tiles, the circuit, the off-road park, the highway and the drag-strip meshes more than 1.6 km away. At street level it also covers everything west of the ridge (x < 1200), which the hills hide anyway. Only what neihu hid is restored when you leave.

## Files (all in old-scratch/b4-neihu)
- neihu-conv.mjs: the converter (OSM → neihu-data.js).
- neihu-data.js: the generated data, 267 KB (decimetre ints, Int16 base64 arrays).
- neihu.js: buildNeihu(V, {renderer}), neihuFonts(), NEIHU_KEEP, NEIHU_TEXT.
- neihu.src.js: town glue (nhTick, nhLeave, the credit, the first-arrival toast).
- neihu-test.mjs: the browser test.
- port-neihu.mjs: the port script.
- neihu-work/: debug tools (dbg1–3 colliders on lanes, calls-probe draw-call breakdown, upd update timing, nodecheck, plot*). It is not needed for the port.

## How to port
`node src/port-neihu.mjs <dir> [--dry]`
- It copies the 5 files above and makes exact-anchor edits:
  - build-art.mjs and build-app.mjs: bundle after circuit.js, and append neihu.src.js.
  - town.src.js: fonts, build, tick, leave, toast.
  - village.js: south wall gap.
  - race.src.js: guardrail gap, no trees on the link, east hill moved from (950, 60) to (1000, 330).
  - drive.js and walk.js: mapBounds, mapLive, the DEST style for neihu.
  - garage.src.html: the pill.
  - garage.css: 8-column grid, 14 px pill text.
  - test-b4.mjs, test-app-b4.mjs (optional) and circuit-test.mjs (optional): six → seven pills.
- It writes nothing if any anchor fails, and it is idempotent: a second run reports 0 changed.
- `--dry` against the current old-scratch/b3-int: **all OK, 12 files would change**.
- After porting, run `node build-art.mjs --yaris`.

## Tests (run one at a time on old-scratch/b4-neihu)
| Test | Result | Time | Log |
|---|---|---|---|
| neihu-test.mjs | ALL OK, 21 ok, 0 failed, 0 page errors | 118 s | old-scratch/b4-logs/nh-run4.txt (runs 1–3 are earlier, failing runs) |
| test-b4.mjs | ALL CHECKS OK, 66 ok, no page errors | 173 s | old-scratch/b4-logs/nh-b4.txt |
| test-b3.mjs | ALL OK, 56 ok, 0 page errors | 121 s | old-scratch/b4-logs/nh-b3.txt |
| circuit-test.mjs | PASSED, 24 ok, 0 failed, 0 page errors | — | old-scratch/b4-logs/nh-ci2.txt (nh-ci.txt: 1 fail on the old "six pills" check, fixed through the port) |
| drift-test.mjs | ALL OK, 42 ok | 82 s | old-scratch/b4-logs/nh-drift.txt |
| test-b1.mjs | ALL CHECKS OK, 140 ok, no page errors | 481 s | old-scratch/b4-logs/nh-b1.txt |

neihu-test covers:
- The converter re-run and the build checks.
- Boarding the GC8, checking the 7 pills and choosing 去內湖.
- The robot drives garage → 港墘站: 83 s sim, max 236 km/h, stuck 0. Credit and toast shown, far world hidden.
- Drives along 內湖路一段 to the east end (100% on it), from 港墘站 south to the end of 港墘路, and north along the whole 港墘路 (91% on it).
- The car hitting a building wall at 15 m/s stops at the wall.
- On foot: getting out, walking 90 m of street, walking 8 m under a 騎樓, a building blocking the walker, getting back in.
- Screenshots and draw calls.
- Driving home: everything is visible again and the credit is hidden.

Final `node build-art.mjs --yaris`: garage.html 2,917,535 bytes; 內湖 adds about 360 KB.

## Screenshots
old-scratch/b4-neihu/neihu-shots/:
- nh-3-arrive-gangqian
- nh-4-e-內湖路一段, nh-4-s-港墘路, nh-4-n-港墘路
- nh-5-building-blocks
- nh-6-walk
- nh-7a-street-gangqian, 7b-eye-gangqian (cockpit), 7c-street-west
- 7d-drone-gangqian, 7e-drone-high
- 7f-wende-station, 7g-lishan-school
- 7h-entry-valley, 7i-hills-edge
- nh-8-home

Shots from the other tests are in old-scratch/b4-shots/nh-{b1,b3,b4,ci,drift}/.

## Perf (390×844, swiftshader, renderer.info)
| View | Draw calls | Triangles |
|---|---|---|
| street at 港墘 | 182 | 1.09M |
| cockpit | 118 | 1.07M |
| street looking west down the valley | 233 | 1.20M |
| drone at 130 m | 185 | 1.10M |
| high drone at 650 m (whole map) | 245 | 1.21M |
| 文德 station | 139 | 1.00M |
| 麗山高中 | 124 | 0.97M |
| entry valley | 191 | 1.11M |
| hill edge | 17 | 48k |
| on foot | 65 | 148k |

- About **102 calls and about 0.9M triangles of each driving view are the player's GC8 itself**. In a breakdown at street level, 內湖 is about 75 calls and about 150k triangles. From the high drone it is about 140 calls.
- Before the ridge/drag-strip cull, the west view was 336 calls.
- Build:
  - buildNeihu: 272 ms in the page and about 280 ms in Node.
  - 210 meshes, 385k triangles in total, 13.4k colliders.
- update(): 2 µs per frame on average while driving; a cull pass is about 0.13 ms every 8 m. No per-frame allocations.
- Robot driving in 內湖: 0.24–0.33 ms per drive step.

## Open issues and limits
- **No traffic or pedestrians in 內湖.** The link road is `noNpc`, and the NPC system only knows the village roads. This was left out as not cheap.
- **A few OSM buildings still reach up to about 1 m into unnamed service lanes.** These are driveways into courtyards, found by neihu-work/dbg3.mjs. No named street has one. Hedges at the data edge sit across roads that leave the map; that is deliberate.
- **Most buildings away from the main streets are generated.** OSM has 719 buildings in this export; the rest are filled-in blocks with plausible heights, not real footprints.
- **The robot's "south on 港墘路" leg starts at 港墘站.** From the east end of 內湖路一段, the shortest route legitimately cuts through side streets, so the test places the car at 港墘站 first.
- **The streets are flat (y = 0).** Real 內湖 is flat in this area, but the 金面山 slopes are scenery only and cannot be driven.

## 第 28 批（2026-10-23）：每間房子不一樣（`NH_VARIETY`，先關著）＋招牌的字修正

Nick: 「內湖的房子都要不一樣現在都長得一樣 每間房子都長得一樣」. Since 第 18 批 (`NH_MAX_FL = 1`) every Neihu house was a
1-floor box with the same grey ground-floor cell, so the streets looked identical. Mock (before/after from the real game):
https://claude.ai/artifact/FcaD5KwCZGwsHKHuXy67cf . **`NH_VARIETY = false` until Nick says OK**; then flip it (trial page v47).

- **Mirrored text fixed (always on, not behind the flag).** Seen from outside, `wallQ`'s `a` end is on the right, so u ran
  right→left and every facade was mirrored: the shop signs (咖啡, 補習班, 眼鏡…) read backwards in the live game. `wallQ` now
  puts `u1` at `a` and `u0` at `b`. Everything else on that path is symmetric (windows, glass, tiles).
- With the flag on (residential styles 0–3, 7, 8, not 麗山國中, not landmarks):
  - Facade atlas 2048×2048, 64 cells. 32–43: 12 ground-floor house families (wall, door kind/colour, grille, 門牌, meter, pots);
    26–31 + 44–49: matching side walls; 50–59: 10 more shop cells (20 new shop names, none repeat 12–14); 60/61 red/grey roof
    tiles; 62 white corrugated; 63 striped awning.
  - Which wall is the front: the wall whose point 3 m outward is on a road or sidewalk (`mkRoadGrid`); if none, the closest
    within 8 m; otherwise edge 0 for generated rects. Front = family cell, other walls = side cell; shop edges stay shops.
  - Long shop / front walls (≥ 7 m) are split every ~6 m, each piece picks its own shop (or family), so a row is not one shop
    repeated.
  - Height 0.94–1.10 × 3.6 m; roof colour grey/green/blue-grey; pitched red/grey tile roofs on 14 % of small generated houses;
    parapets 55 %; rooftop sheds (blue/white) 12 %; water tanks (steel/blue/concrete) 55 %; solar heaters 16 %; shop awnings
    (striped or one colour) 72 %; wall AC units.
  - Cost: Neihu triangles 295k → 458k; draw calls unchanged (same 199 meshes). Street views 1.07M → 1.17M triangles
    (130–252 calls either way). Build time no visible change. Atlas memory +~11 MB.
- Probe: `src/probe-nh.mjs` (not committed; flips the flag at serve time, renders 11 spots both ways, `ATLAS=1` dumps the atlas).


## Batch 72 (trial v84, 2026-11-07): the three streets from Nick's dashcam photos — `src/nhstreet.js`

Nick sent 31 dusk screenshots of 江南街 (13), 內湖路一段 (9) and 環山路 (9) on 2026-11-07 (kept under
/mnt/project-files/car-game/neihu/ref-2026-11-07/, reference only — never in the game) and said 「直接開始做內湖的部分」.
The three roads already exist in neihu-data.js; everything new is a second module so neihu.js stays readable.

- `nhStreetPrep({ N, nx, nz, names })` runs before the building loop:
  - `floorsOf(b, bi, cx, cz)`: buildings whose front (generated rects: edge P0→P1, otherwise the centroid) is within
    w/2 + sw + 8 m of one of the three roads get their real floor count back (NH_MAX_FL = 1 stays everywhere else):
    江南街 3–5 F (≥ 9 F keeps up to 14), 內湖路 5–15 F, 環山路 3–15 F; 16 % of the buildings 18–75 m behind 江南街 become
    12–14 F towers (the photos show towers behind the low street). Facade style 4 (tower) for ≥ 11 F, 7 for some low 環山路 ones.
    neihu.js: `bf`/`top` become `let`, `one = !ov && b.f <= 1 && b.h <= 2` picks the one-wall shortcut, `gw = gh` so upper walls draw.
  - `arcadeFix(b, bi)`: generated rects fronting 江南街 (≥ 3 F, ≥ 4.4 m wide, ≥ 9 m deep) get `e[0] = 2`, a `core` inset 3.2 m
    and a collider box shrunk by 1.6 m → the existing arcade code draws the ceiling and pillars. The converter only makes
    arcades on cls ≤ 2 roads; 江南街 is cls 4. 7 buildings (the gen rects along 江南街 are sparse: fronts sit 9–11.6 m from the centreline).
  - One generated rect (8–20 m sides, nearest x ≈ 520) on 環山路 becomes the construction site (`b.site`, skipped by the loop).
  - `noTree(x, z)`: no OSM street trees along 內湖路 (palms instead) or on the site.
- `nhStreetBuild(ctx)` runs after `addTree` exists and before `signMesh` is built (the site uses the SA 「施工」 plate):
  - 1024² canvas atlas: 36 lightbox cells 256×80 (`CHAINS` 24 parody chains + `GENERIC` 12 made-up shops; icons are hand-drawn
    cup/house/star/burger/cart/plus/leaf/bolt/ring/bars — never a real logo), 6 dynamic green guide cells, bus / 優拜客 / two
    utility-box paintings / scaffold mesh / lamp glow / 施工中 / hoarding, 3 signal heads. `mats.sign2` (map = emissiveMap,
    0.3 → look.js boosts it at night like the other signs) and `mats.sign3` (no emissive: mesh, utility boxes).
    `plate2(x, y, z, ux, uz, w, h, key, two, c, fx, fz, mat)`: a one-sided plate faces (fx, fz) — the first run had every
    single-sided plate facing into its wall (quad a→b faces (−uz, ux)).
  - Scooters (`along` each road, 0.85 m steps, runs of 5–14 on 江南街 at w/2 − 0.55, sparse on the other two sidewalks),
    parking bays + cars on 環山路 only (bays at w/2 − 1.3: the NPC lane is at w/4, so the car's inner edge stays ≥ 1 m clear;
    內湖路 is one-way with the lane on the centreline — no bays), royal palms every 9 m both sides of 內湖路, lamps every 34 m
    alternating sides (`poles.push({x, z, fx, fz, lamp: true})` → look.js lampList), bus shelters (candidates every 10 m,
    one per 230 m that passes `ok` + not near another road + no building within 2.2 m; try the other side first),
    signals at junctions of the three roads with other named roads (one per approach, right side, arm over the lane),
    utility boxes, walls + hedges (內湖路) / 3.6 m retaining walls + two rows of trees (環山路) on 4 m runs with no building
    within 6.5 m, the site (hoarding, 6 slabs + columns, scaffold on two faces with mesh sheets, tower crane), guide signs
    (≤ 6, 28 m before 環山路 junctions with cls ≤ 3 roads), two bike stations, lightbox signs on ground floors fronting the
    three roads (one per 6 m piece, 40 % chains).
  - Scooters / cars / palms are InstancedMesh per 250 m tile (`nh-scooter-i,j` …) pushed into neihu.js `treeMeshes`, so they
    are culled at 400 m like the trees and crushable through `im`/`ti` like the trees (circle/box colliders with the
    `small` sizes crush.js accepts for any car). Walls, shelter posts, the site and the crane are `noCrush`.
- Probe (not committed): scratchpad probe2-nh.mjs = neihu-test's helpers + shots at `V.neihu.street.views` at 高 / 17:54.
  Numbers (960×576, 高, dusk): 江南街 166 calls / 0.52M, 內湖路 232 / 0.73M, 環山路 187 / 0.49M (380 looking back west on
  環山路二段 towards the whole east side); Neihu 240 meshes / 604k triangles (was 199 / 458k), build ≈ +100 ms.
- Test: neihu-test 7s (counts, no parked thing on a lane, arcades, tall buildings near the views, dusk shots, calls < 300).

## Batch 74 (2026-11-07): parking-bay cars are dealer cars
Nick: 「路停的車用車店的隨機放 豪車少一點」. The 環山路 bays no longer get the instanced box car: nhstreet.js only records
`spots.parked = [[x, z, heading, seed]…]` (`info.cars` still counts them). crush.js got a second car list next to the
off-road park's junk cars: `o.lots()` (town.src.js → `VIL.neihu.street.parked`), `o.me(out)` (driver or walker position),
`o.makeLot(i, spot)`. Every 0.25 s it builds the nearest unbuilt bay within 150 m (one LOD car per tick, `buildLodCar`),
hides built ones beyond 130 m, and gives each a `junk` pad (`street: true`): the same squash / 30 s regrow as the park cars,
but the first hit calls `police()` (1★ outside the park). `colliders(true)` returns the unflattened ones regardless of the
current car for the walker; `crushStep` now re-pushes 'junk' colliders to a new drv too. Pads grow on demand (`take(true)`)
so the 16-pad pool is not eaten. Model choice is a per-seed weighted hash in town.src.js `lotKind`: price ≤ 60 萬 6,
≤ 100 3, ≤ 200 1.5, ≤ 500 0.6, supercars 0.06 (≈1.3 %); paints white/silver/black-heavy (`LOT_PAINT`); no ridden things, no
monster truck. Test: neihu-test 7s counts `N.street.parked`, 7t builds them at the 環山路 view (6 s), checks model mix,
positions, visibility, colliders, hiding at 江南街.
- Test lessons (batch 74): neihu-test 7t must yield between `__dstep` batches (a synchronous loop in one `evaluate` never lets the async `buildLodCar` promises run); `drv.colsNear` takes a half-width, so query 1500 m to see every street car's junk collider. crush-test's "Neihu ≤ 2 floors" check now skips boxes within 95 m of the three streets' ways (`V.neihu.street.roads`, an array: one road has several ways). Final: neihu-test 42 ok, crush-test 55 ok.

## Batch 76 (trial v88, 2026-11-08): every shop and house different

Nick: 「內湖的店每間都要不一樣 房子也不要一樣」. Daytime probe shots showed the cause: ~26 shop names baked into the
13 shop cells of the 2048² facade atlas (so the same 13 storefronts repeated every block), 7 sign colours, and the
residential upper styles all near-white.
- **Shops** (neihu.js `shopAtlas`): a second 2048² atlas just for shop signs: 340 horizontal 192×48 + 84 vertical
  48×192 plates, names generated from `SHOP_PRE` (40 made-up house names) × `SHOP_KIND` (60 trades) picked with
  `(i*1021) % 2400` so all 424 differ, a small `SHOP_SUB` subtitle line, 14 colour schemes. The facade cell's sign strip
  (`shopFront`) is now a plain dark box; the building loop records one `shopPl` entry per shop-fronted wall segment
  (strip = 0.75–0.976 of the ground-floor height, width ≤ 5.8 m, skipped where an nhstreet lightbox already sits,
  `b.back`, or the segment is < 2.2 m) and `shopPlate` draws a one-sided quad 1 cm in front of it; plate i uses atlas
  slot `(i*97) % 340` (coprime → neighbours never share), vertical `vSigns` use `(i*29) % 84`. All plates go in one
  `Geo` → mesh `nh-shops` with `mats.shop` (map = emissiveMap, intensity 0.25 → look.js SIGNS glows it at night).
  +1 draw call. nhstreet.js lightboxes: 40 % stay 諧音 `CHAINS` (own atlas), 60 % take `ctx.shopPlate`/`shopUV`
  (previously 12 `GENERIC` names cycling).
- **Houses**: light wall styles (0, 1, 7) get a per-building pale tint from `TINTS` (12) × the old 0.88–1.06 shade
  → 881 distinct colours; 35 % of light buildings swap their upper tile style via `UP_ALT`. `info.shops` reports
  plates/total/v/names/tints.
- Numbers (SwiftShader 960×576, 高, 13:00): 港墘站 195 calls / 594k tris (was 194 / 584k), 江南街 174 / 554k,
  環山路 188 / 505k, 內湖路 234 / 733k, build 642 ms. Test: neihu-test 7u.
