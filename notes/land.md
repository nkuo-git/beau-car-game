# 內湖 v2 (b5-land): seven real landmarks, road-name signs, 內湖 moved closer

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

(the v21 trial page, which already has 內湖 v1 — see neihu.md). old-scratch/b4-neihu, old-scratch/b3-int and the 萬能軟體 repo (nkuo-git/carid-pwa) were not touched.

Nick asked for three things (2026-10-05):
1. 「我只需要下面幾個跟實景一樣就好（位置也要正確喔）」: 碧湖公園, 內湖國小, 麗山國中, 港墘站, 湖光教會, 西湖圖書館, 大港墘公園.
2. 「主要街道（十米寬以上）可以掛路牌讓我看得出我在什麼路上嗎?」
3. 「去內湖的路太遠了 可以大概三四百公尺遠就好 不要開一兩公里」

## A. The seven landmarks

All seven stand on their **real OSM footprints at their real positions** (1:1, same projection as v1). The converter
(neihu-conv.mjs) picks the OSM elements out by id and writes them into `neihu-data.js` as `lm`; the renderer (neihu.js)
builds them from that data, so nothing is hand-placed in world coordinates. neihu-test part 1 checks every centroid
against the OSM value within 3 m (it comes out 0.0–0.1 m), that each one has a name sign, and that each has colliders.

The looks were modelled **by hand** from Nick's reference photos in (萬能軟體 Claude 專案的檔案) tune-game/neihu-photos
(8 + 7 + 6 + 6 + 6 + 2 + 2 files, see 來源.md there). **No photo pixels went into the game**: no texture, no image file,
nothing copied into the build. Many of them are marked 「有版權，僅供參考」, so they were only looked at while modelling.

| Landmark | OSM | world (x, z) |
|---|---|---|
| 碧湖公園 (lake, islet, 九曲橋) | way 314211284 park + 55038272 lake + 330357191 islet + 236370956 bridge | 682.3, −304.4 |
| 臺北市內湖區內湖國民小學 | relation 4790869 (+ track 608277929, pool 608277923, court 608283298) | 384.8, −41.8 |
| 臺北市立麗山國民中學 | relation 4790962 | −146.7, −307.3 |
| 大港墘公園 | way 547805172 | −326.5, 114.1 |
| 臺北市立圖書館西湖分館 | way 168407498 (building) | 46.2, 76.6 |
| 湖光基督教會 | way 371239214 (building) | 157.0, 106.8 |
| 港墘站 | way 243750311 (station building) + its 4 entrances | −174.3, −68.0 |

(World x, z here are relative to the 港墘路 × 內湖路一段 reference node; the test uses the same numbers.)

### Real vs guessed, per landmark

**碧湖公園** — photos 碧湖公園-1…-8.
- Real: the park outline, the lake outline, the islet and the zig-zag bridge line, all OSM ways; the entrance monument
  position (nearest-road rule from the OSM park ring).
- From photos: grey-green lake water, not blue (-1, -3, -6); stone-block lake edge (-1, -6); red-brick path all round the
  water (-1, -2); thin stainless railing posts (-1); islet with a stone rim and a hexagonal pavilion — six grey columns, a
  white architrave, an orange glazed-tile roof and white balustrade posts (-5); white 九曲橋 deck with carved white
  balustrades and concrete piers (-4, -7); black granite monument with gold characters at the entrance (-8).
- Guessed: all heights and sizes (pavilion radius 4.1 m, railing 1 m, monument 4.2 × 2.2 m), the number of piers, the
  exact path width (3.2 m).

**內湖國小** — photos 內湖國小-1, -2.
- Real: the school ring (OSM wall), the running track, the pool and the basketball court polygons; gate position.
- From photos: white wall with a dark red brick base (-1); red PU track with green infield (-1 aerial); the gate as two
  tall white pylons with a flat canopy and a stone name wall beside it (-2).
- Guessed: wall height 1.9 m, pylon height 5.4 m, the 11 m gate gap, hoop height 3.0 m, pool deck width.

**麗山國中** — photos 麗山國中-1, -2.
- Real: the school ring (OSM relation); buildings inside it come from the OSM building polygons.
- From photos: white small-tile facade with a red brick band and corridor rails — that is facade atlas cell 24, used for
  every building inside the school ring (-1); red-brick gate piers (-2).
- Guessed: the gate position (nearest-road rule), the gate sign text (「臺北市立麗山國民中學」 from OSM, not read off a
  photo), wall height 2.0 m, pier size.

**大港墘公園** — photos 大港墘公園-1…-6.
- Real: the park polygon (OSM).
- From photos: light concrete paths looping inside the park with radial spurs (-2, -5); a paved central plaza with a
  red-brick band (-3); the playground east of the middle — blue and yellow soft mats, a grey slide mound with orange
  rails (-4, -6); black lamp posts and wooden benches (-2, -5); dark green stone monument on a pale base (-1, -3).
- Guessed: the path layout is "a loop 16 m inside the outline plus spurs", not surveyed; plaza 32 × 24 m, playground
  24 × 18 m at +26 m east; 10 lamps, 6 benches; monument 2.6 m tall.

**西湖圖書館** — photos 西湖圖書館-1, -3, -4, -6 (-2 is an aerial that also shows the police station; -5 is unrelated).
- Real: the building footprint (OSM way), 5 floors.
- From photos: grey-white small-mosaic tile with ribbon windows — facade atlas cell 25 (-4, -6); the rounded corner
  volume on the street corner with a curved canopy over the first floor (-1, -5); the stair house on the roof (-1); the
  tall pylon carrying the library name (-4, -6).
- Guessed: height 17.5 m (5 floors), corner radius 5.2 m, canopy at 4.0–4.5 m; the real name is written **vertically** on
  the pylon, the game shows it as a horizontal plate at 6.5 m because the sign atlas only draws horizontal text.

**湖光基督教會** — photos 湖光教會-1, -2, -3, -5 (-4 is a small night shot, -6 is the interior). **No longer guessed**: it is
now modelled from the photos.
- Real: the building footprint (OSM way).
- From photos: white stone walls (-1, -2); a tall columned portico on the street front — fluted round columns to 12.2 m
  with capitals, an architrave carrying 「湖光基督教會」 and a cornice above it (-1, -3); green glass canopy over the
  entrance level (-1); the bell tower with a cornice, a belfry stage with dark arched openings, a tall slim spire and a
  cross on top (-1, -2, -5).
- Guessed: wall top 15 m, tower 20 m, spire to 33 m, cross to 35.4 m, 3–6 columns depending on the facade length (the
  photos show the portico but no measurable scale); the portico is placed on the longest footprint edge.

**港墘站** — photos 港墘站-1…-7. The station block was rewritten for every 文湖線 station in the map (文德 too), and the
港墘 exits got their own treatment.
- Real: the station building footprint and the viaduct line (OSM), the four entrance positions.
- From photos: white elevated station body with platform doors (-3, -7); green glass curtain wall (-1, -4); orange steel
  columns with stepped "tree" brackets and cross beams (-6); two curved grey metal wave roofs over the platforms (-1,
  -4, -6); orange arched ribs inside (-7); light-green noise barriers along the viaduct either side of a station (-6);
  the exits as a granite base with a grey aluminium canopy and a gold station-name plate (-2, -5).
- Guessed: platform level 15.2 m, column spacing 13 m, barrier length ±130 m, canopy sizes.

## B. Road-name signs (≥ 10 m wide streets) and the HUD road name

- A road qualifies when `r.w + 2 * r.sw ≥ 10 m` (carriageway + both sidewalks, from OSM lanes/width). **18 roads qualify**:
  堤頂大道一段 22.2, 堤頂大道二段 18.9, 內湖路一段 17.5, 文德路 17.5, 舊宗路二段 17.5, 環山路二段 17.0, 環山路三段 17.0,
  金龍隧道 17.0, 內湖路二段179巷 17.0, 內湖路二段 17.0, 瑞光路 17.0, 洲子街 14.0, 港墘路 13.6, 文德路208巷 13.6,
  內湖路二段103巷 13.6, 陽光街 13.6, 文德路101巷 13.6, 內湖路一段629巷 12.0 m.
- **132 signs**. One 13 m before every junction of degree ≥ 3, per direction of travel (one-way respected), plus one every
  250 m where no sign is within 90 m; at least 60 m apart per direction.
- Each sign is a grey pole on the right-hand kerb with an arm reaching over the near lane: a blue plate 4.6 × 0.95 m with
  white text (the road's own name) at 5.3 m, and under it a smaller 3.3 × 0.68 m plate with the crossing street's name at
  4.5 m. Plates face the approaching traffic (`plate(...)` front faces (−uz, ux)). The pole is a collider (r 0.22, h 6.3).
  Text is about 0.5 m high, readable from about 40 m — checked in the shot nh-7j-bigsign.png (內湖路一段 + crossing name).
- **HUD label** (neihu.src.js `nhRoadTick`): a blue box with a white border and white 16 px text in the top-left of the
  stage, showing the road under the car (or under the walker when on foot). It asks `N.roadName` at most every 250 ms,
  only when the name changed, with no allocations. Hidden outside 內湖 and when not on a named road.
  - Layout: top 118 px / left 10 px under the place chip and the big action button. On short screens (max-height 560 px,
    i.e. a phone held sideways) that spot is taken by 「直接回車庫」 and 「去哪裡」, so a media query moves it to
    top 122 / left 115. It also follows the police wanted bar (margin-top 46 px with `.pw-host.pw-on`, like the other
    HUD pills). The CSS is injected by neihu.src.js, so garage.css needs no port edit.
  - neihu-test part 4 checks the label text equals the road name under the car after each driving leg, and runs the HUD
    overlap sweep at [360×800], [412×915], [915×412], [800×360], [1280×720] — no overlaps.

## C. 內湖 moved next to the village

The whole 內湖 box was **moved** (not scaled): its NW corner is now world (0, 330), so the box is x 0…1756.3,
z 330…1680.8, just south of the off-road park.

- The link road leaves the **village's south gap** at (−112, 94) — the same 12 m opening the off-road park's cement road
  uses, so it is 6 m wide there and widens to 9 m further south — runs south and curves into 環山路二段 at the box edge
  (−8, 344.7): **the empty link is 326 m** (Nick asked for 300–400 m; it used to be about 1.5 km).
- Garage → 港墘站 route: **1952 m** (chip 「去內湖2.0 km」), of which about 1219 m is inside 內湖 itself, about 364 m the
  link, and about 370 m village streets. So the part with nothing in it is only the 326 m link.
- The drag strip's south wall has **no gap any more** (the road now leaves from the village gap), and the three south
  dome hills of race.src.js were removed because 內湖 sits there. In village.js the drag strip south wall collider is
  back, and three village hills moved west/south-west so they do not cover the link: hill(−190, 182, 90) → (−214, 182, 86),
  far hills (−260, 430) → (−320, 500) and (−90, 390) → (−230, 680).
- The 「到港墘站了」 arrival toast, the OSM credit and the A/B route consistency are unchanged; neihu-test still drives
  garage → 港墘站 by itself (98 s sim, max 159 km/h, stuck 0).
- Culling: `cullWorld` now splits big groups (radius > 400) into children and hides anything whose far edge is north of
  the ridge (z < 262) while you are at street level in 內湖, plus everything more than 1.6 km away.

## Bug found and fixed in v1 (flatPoly winding)

`THREE.ShapeUtils.triangulateShape` always returns triangles with positive 2D area; in the x–z plane those face **down**.
v1 emitted them unchanged, so roughly half of all filled areas (including 碧湖 lake, school pitches, park lawns, some
roofs) were invisible from above. flatPoly now emits (a, d, b) for up-facing polygons. This makes a lot of previously
invisible geometry visible, which is the intended look but is a visible change against v21.

Generic area polygons whose centroid sits within 2.5 m of a landmark sub-polygon (lake, track, pool, court) are skipped
(`LMSKIP`), so the landmark version is the only one drawn — without that the two fought over the same depth.

## Files (all in old-scratch/b5-land)

- **neihu-conv.mjs** — + the `lm` block (seven landmarks by OSM id: rings, lake/islet/bridge, track/pool/court, signs),
  `flags |= 64` on landmark buildings, landmark names kept out of the generic name-sign list (20 left).
- **neihu-data.js** — regenerated, 270 KB. A re-run reproduces it byte for byte (neihu-test part 0).
- **neihu.js** — landmark builders, the big road-name signs, the rewritten station, facade cells 24/25, landmark sign
  atlas (`L0…L6`), the flatPoly fix, LMSKIP, the new link road and `carveWorld`/`cullWorld` for the new box position.
- **neihu.src.js** — `nhRoadTick` (the HUD road name) + its injected CSS.
- **neihu-test.mjs** — + landmark checks (OSM positions, signs, colliders), big-sign checks, the HUD-name checks and the
  landmark screenshots.
- **port-land.mjs** — the port script (see below).
- **land-work/** — probes used while building (top-down world map, shot/auto-shot, ray/bisect, OSM element dumps,
  harness parts). Not needed for the port.

## How to port

`node src/port-land.mjs <dir> [--dry]` — the target must already have 內湖 v1 (port-neihu.mjs).
- Copies neihu.js, neihu-data.js, neihu.src.js, neihu-conv.mjs, neihu-test.mjs.
- Five exact-anchor edits: race.src.js (south wall with no gap, the three south hills removed), village.js (south wall
  collider back, three hills moved).
- Writes nothing if any anchor fails; idempotent (a second run says "(already)" for every line).
- `--dry` against old-scratch/b4-neihu: **all OK, 2 files would change** (race.src.js, village.js). `--dry` against old-scratch/b5-land
  itself: all OK, 0 files would change.
- After porting run `node build-art.mjs --yaris` (art/garage.html 3,263,882 bytes here; b4-neihu was 3,221,521).

## Tests (old-scratch/b5-land, run one at a time)

All six ran on the final build (art/garage.html 3,263,882 bytes), one at a time.

| Test | Result | Time | Log |
|---|---|---|---|
| neihu-test.mjs | ALL OK, 29 ok, 0 failed, 0 page errors | 157 s | old-scratch/b5-logs/neihu-test.log |
| test-b4.mjs | ALL CHECKS OK, 66 ok, no page errors | 192 s | old-scratch/b5-logs/test-b4.log |
| test-b3.mjs | ALL OK, 56 ok, 0 failed, 0 page errors | 130 s | old-scratch/b5-logs/test-b3.log |
| circuit-test.mjs | PASSED, 24 ok, 0 failed, 0 page errors | 137 s | old-scratch/b5-logs/circuit-test.log |
| drift-test.mjs | ALL OK, 42 ok | 89 s | old-scratch/b5-logs/drift-test.log |
| test-b1.mjs | ALL CHECKS OK, 140 ok, no page errors | 523 s | old-scratch/b5-logs/test-b1.log |

Two regressions were found by the tests and fixed (not worked around):
1. **test-b4's drive to the off-road park got stuck** at the village's south gap (27 bumps, stuck 5×, 230 s instead of 42 s).
   Cause: the link road now starts at that gap, and `V.route`'s 內湖 wrapper treated the few metres north of the junction,
   and the stretch where the link and the off-road cement road lie on top of each other, as 「in 內湖」. The route then went
   north to the junction first and the robot swerved into the wall heads. Fixes in neihu.js: `inLink` stops at the junction
   (nothing of the link is north of z 94), the wrapper falls through to the old route within 14 m of the junction, and the
   link is 6 m wide at the junction (like the cement road) so the grass next to the wall heads stays grass. After the fix
   the leg is exactly the v21 one again: 42.3 s, 1 bump (traffic), stuck 0, reversed 0.
2. **The HUD road label overlapped 「直接回車庫」 at 800×360** (phone held sideways) — fixed by the media query above.

neihu-test adds to the v1 list: the converter re-run; the seven landmarks at their OSM places (max off ≤ 3 m) with a name
sign and 126–245 colliders each; 132 big signs on 18 roads; the HUD road name matching the road under the car on all
three driving legs; the HUD overlap sweep at five sizes; a street and an air shot of each landmark; the label hidden back
at the garage.

## Screenshots

old-scratch/b5-logs/shots/ (from neihu-test):
- nh-3-arrive-gangqian, nh-4-e-內湖路一段, nh-4-s-港墘路, nh-4-n-港墘路, nh-5-building-blocks, nh-6-walk
- nh-7a-street-gangqian, 7b-eye-gangqian, 7c-street-west, 7d-drone-gangqian, 7e-drone-high, 7f-wende-station,
  7g-lishan-school, 7h-entry-valley, 7i-hills-edge, nh-8-home
- per landmark: nh-7j-<k> (street) and nh-7k-<k>-air for k = bihu, nhps, lishan, dgq, lib, church, mrt; nh-7j-bigsign

Work-in-progress probe shots are in old-scratch/b5-land/land-work/ (lm-*.png, a-*.png, world-*.png).

## Perf (390×844, swiftshader, renderer.info; v21 numbers in brackets)

| View | Draw calls | Triangles |
|---|---|---|
| street at 港墘 | 184 (182) | 1.10M (1.09M) |
| cockpit | 120 (118) | 1.08M (1.07M) |
| street looking west | 165 (233) | 1.05M (1.20M) |
| drone at 130 m | 189 (185) | 1.11M (1.10M) |
| high drone (whole map) | 247 (245) | 1.22M (1.21M) |
| 文德 station | 141 (139) | 1.01M (1.00M) |
| 麗山高中 | 127 (124) | 0.97M (0.97M) |
| entry valley | 193 (191) | 1.16M (1.11M) |
| hill edge | 17 (17) | 48k (48k) |
| on foot | 67 (65) | 160k (148k) |
| 碧湖公園 street / air | 49 / 47 | 132k / 122k |
| 內湖國小 street / air | 124 / 68 | 320k / 182k |
| 麗山國中 street / air | 71 / 64 | 161k / 147k |
| 大港墘公園 street / air | 37 / 197 | 87k / 1.12M |
| 西湖圖書館 street / air | 67 / 181 | 162k / 1.11M |
| 湖光教會 street / air | 40 / 183 | 100k / 1.11M |
| 港墘站 street / air | 72 / 178 | 171k / 1.08M |
| big sign close up | 112 | 1.19M |

About 102 calls and 0.9M triangles of each driving view are the player's own GC8. 內湖 itself: 199 meshes, 399k triangles,
13,900 colliders, built in 370–530 ms in the page (it shares the machine with the other agents' tests). The landmark and sign geometry is merged into the same per-material,
per-tile banks as the rest of 內湖, so it adds meshes only where it adds a new tile/material pair (199 vs 210 in v1 —
fewer, because the box moved and the tiling changed). update() is unchanged: a cull pass every 8 m, no per-frame
allocations. Robot driving: 0.35–0.49 ms per step.

## Open issues and limits

- **The flatPoly fix changes the look of v21 areas**: lake, pitches, lawns and some roofs that were invisible are now
  drawn. Intended, but it is a visible difference from the shipped page.
- **Landmark heights and sizes are guesses** (see the per-landmark lists). Only footprints and positions are survey data.
- **西湖圖書館's vertical name** is drawn as a horizontal plate; the sign atlas has no vertical text.
- **麗山國中 has no modelled teaching building of its own** — the OSM buildings inside the ring are re-skinned (cell 24)
  rather than rebuilt from photo -1.
- **No traffic or pedestrians in 內湖** (unchanged from v1), and the streets are flat (y = 0).
- **Some wide street views reach about 300 draw calls** at camera angles that look along several hundred metres of city
  (probe shots lib2/church2/mrt2). The test's own spots stay at ≤ 193.
- **湖光教會's portico sits on the longest OSM edge**, which may not be the real street front if OSM's footprint is
  rotated from the photo's viewpoint.
- **The HUD road label sits under the HUD layer** (z-index 2 against the HUD's 3), so a toast (「到內湖了！」 etc.) covers
  it for its two or three seconds instead of being covered by it. On a phone held sideways the label and a toast share
  that band of the screen.
- **The link road and the off-road park's cement road share about 10 m of tarmac** at the village's south gap. Routes and
  surfaces are handled (see the test section), but it is a junction where two roads overlap rather than meet.
