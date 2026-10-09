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
