# 山、隧道、海邊 (第 27 批): every hill drivable, two tunnels, no invisible walls, a beach and sea round the map

Nick (2026-10-23): 「每座山都可開／要有隧道／往內湖的那個車庫會被山擋住／不要空氣屏障」.
Mock https://claude.ai/artifact/NZ8YUwjuVLyJ4EPExuh7YZ. For the map edge Nick picked 「海邊」 on the decision card
(「最外面一圈是沙灘和海，開到水邊車子會慢慢停下來」). Trial page v46. Code: `src/hills.js` (new), plus small changes in
village.js, neihu.js, race.src.js, town.src.js, drive.js, walk.js, terrain.js. Test: `src/hills-test.mjs`.

## What is there

- **24 hills, all real terrain** (`HILL_LIST` in hills.js). They replace the decorative ones you used to drive through:
  village.js `hill()` (2 inside the highway loop, 12 in the far ring, 3 + 2 south of the village) and the 3 half-domes
  north of the circuit in race.src.js. Some moved so they don't sit on houses, trees or lamps (see the comments in the list).
  - Shape: `(1 − u²)^1.5 × (1 ± 5 % noise) + 0.15 m ripple`, wobbly edge (not a perfect circle), `rx`/`rz` for oval hills.
    Height ÷ radius ≈ 0.33: the steepest slope on any hill is about 34° (test: < 35°). A GC8 drives up a 48 m hill in ~14 s.
  - Each hill has its own grid (3.5–13 m cells). `V.heightAt` is exactly the drawn triangles (diagonal 00–11 like mountain.js);
    the test raycasts the meshes against `heightAt`.
  - Trees on the hills (113, one merged mesh) have circle colliders (r 0.48, so they don't block the camera); crushable.
  - The ground near the 6 homes is held flat (`homeKeep`: 0 within R1 + 8 of a home, full at R1 + 22). The 內湖隧道 hill
    touched the back of home 5 without it.
- **Home 4's hill** (−214, 182) moved to (−262, 196): the tower ramp is clear.
- **Two tunnels** (both straight along z):
  - 快速道路隧道: the highway's west straight (x −1030) through a new hill (−1012, −140). Twin bores (a wall on the median),
    z −216 … −60.5, 156 m.
  - 內湖隧道: the road to Neihu (x −112) through a new oval hill (−122, 243). One bore, z 215 … 273.5, 59 m.
  - Where the hill is ≥ 9.4 m above the road it's a tunnel (arch top 7.4 m); from the hill foot to the portal the road runs
    in a cut (retaining walls, the top 0.8 m acts as a railing). Each portal: concrete face + green name plate.
  - Inside: walls/arch are MeshBasic (unlit), rows of lamps, a dark overlay on the road. When the camera is inside,
    the sun and sky light dim to 0.42 (`HL.update`); they come back when you leave, go indoors, race, or go home.
- **Two levels in a tunnel zone** — only for the player. `HL.level(y)` runs every frame from the player's height
  (town.src.js `hillsStep`): y > 4.5 = on the hill (upper level), else in the tunnel (lower level).
  - Lower: town.src.js `proxyWorld` uses `V.heightAt` (the road, 0 m); the tunnel walls (`lowCols`) block.
  - Upper: `proxyWorld` uses `HL.topAt` / `topN` (the hill surface); the portal railings (`highCols`) block you from driving
    off the top into the cut; the village colliders inside the tunnel zone (highway rails, link guardrails: `tunVil`) are
    switched off. village.js splits highway rail runs at the tunnel boundary so those boxes don't stick out.
  - Traffic, police and pedestrians always use `V.heightAt` (the road). The corridor (tunnel + cut) skips the tunnel hill
    in `heightAt`, so the road stays flat for everyone.
  - `setCamCeil`: under the arch the chase camera stays below 6.8 m.
- **No invisible walls**: the village north (z −114.5) and south (z 94) boundary boxes are gone, and so is the wall at the
  end of the 400 m strip (x 761). Past the strip there is a sand run-off (x 760 … 1000, round end): sand = terrain.js
  surface 7, a road car slows to ~38 km/h.
- **The island**: a rounded rectangle, waterline x −1830 … 2560, z −1280 … 2380 (corner radius 320). The 70 m inside the
  waterline is beach (falls from 0 to the sea level −0.55); outside, the sea floor gets deeper. Grass is laid on a 40 m
  grid wherever there was no ground (village, Neihu ring) — same mesh as the beach and sea floor, sand is a vertex
  attribute (`sandShader` swaps the grass texture for sand). Hill feet near the water are sandy too.
  - Sea: one big plane with the land cut out, slightly transparent, slow normal-map ripples.
  - Surfaces (`surfaceAt`): 7 sand, 9 shallow water (drive.js `SURF[9]`, cap 12 km/h), 10 deep water (cap 0; reverse
    still works). First time in deep water: 「前面是海，倒車回去」. The walker can't step where the water is ≥ 0.55 m deep
    (`V.walkable`, walk.js). `HL.walkBounds` replaces the old village walking box.
- **Neihu's ring of hills** (neihu.js) is drivable too: `ringAt` / `ringN` (same diagonal as the drawn grid), heights fade
  to 0 over 320 m at the ring edge so it meets the island grass; area polygons that leave the ring are skipped; the hill
  trees have colliders. Flattened near homes like the other hills (bigger radius: the ring grid is 25 m).

## terrain.js fix (all terrain, not just these hills)

Driving down a steep slope, a car hopped and flew (up to 3 m above the ground, 7 s of air on one hill): when the chassis
or a wheel was pushed out of the ground, the "lift" step set the vertical speed to 0, so the car left the slope and fell.
Now it keeps the ground's own vertical speed when that is downward (`fl = min(0, ground speed)`); upward and flat ground
behave exactly as before. Down the same hill: 0.1 s of air.

## Tests (hills-test.mjs, ~2 min, ALL CHECKS OK)

World facts (hills, tunnels, no walls, mesh = height incl. the Neihu ring, < 35°, homes/highway/link road flat, surfaces);
GC8 up and down the hill inside the highway loop; through both tunnels (flat, no bumps, camera under the roof, dimmed
inside); up the tunnel hill and over the top (upper level, rails below don't block, portal railing stops you); into the
sea and back out; walker stops in the water; past the strip end onto the sand; out of the village north and south;
draw calls and the cost of `HL.update`.

## Performance

13 meshes (hills in 5 position groups, island, sea, tunnel walls, lamps, dark road, plates, trees), ~63k triangles,
built in ~150–230 ms (desktop). Measured in the test (chase camera): hilltop 138 calls / 1.03M triangles; inside 快速道路隧道
151 / 1.04M; its portal 150 / 1.04M (156 / 1.07M with traffic); run-off 130 / 0.99M; beach 115 / 0.94M; 內湖隧道 portal
by home 4 177 / 1.14M. `HL.update` ~0.0002 ms a frame; one `heightAt` ~0.0002 ms.

## Known

- Grass colour seams where the island grass meets the Neihu ring and at some hill feet.
- Where two hills overlap the valley is a V (a car's centre sits ~0.9 m above the lowest point there).
- The style change (realistic look) is a separate decision; see the style mock.

## Batch 34 fix (2026-10-24): NaN position crashed `hillsMax`
world-test (two phones, 400 m together) threw `Cannot read properties of undefined (reading 'length')` every frame from `surfaceAt → lift → hillsMax`: the bucket lookup `near(x, z)` compared `i < 0 || i >= nx` and NaN passes both, so `BUCK[NaN]` is undefined. The friend's car has no position until its first packet arrives, and proxyWorld asks the ground height for it. `near` now returns `EMPTY` unless the index is in range (NaN included), which gives the same NaN height the pre-hills world gave, without throwing. Found because world-test had not been run since the hills shipped (content 19).

## Batch 85 (2026-11-10, trial v96): 內湖隧道 4× longer, curved
Nick: 「內湖隧道變長4倍」 (was 58 m, straight on x −112, z 215.5–273.5). A straight 232 m tunnel does not fit: home 4 is
just north, and 80 m south of the north portal the road has to turn east to home 5 / the Neihu entrance (portal to
home 5's frontage is only ~150 m). So the road now goes into the hill at the same north portal and loops through it:
- **Path** (`NTUN_DEF`, `arcPath` → `NTUN = { P, len, G }`): from (−112, 215.5) heading south: arc R 45 turning 75° west,
  9.8 m straight, arc R 44 turning back 165°, 38.4 m straight east → east portal (−105.0, 348.0) heading +x. 233.8 m (4.03×).
  `G` = segments (line: start + direction; arc: centre, radius, start heading, sweep) for exact `segNear` / `segFrame`.
- **Hill** (`NT_HILL`, `ridgeH`): the old ellipse (`NT_OV`, unchanged near home 4) max a ridge of round bumps every 3 m
  along the path (22 m high / 64 m radius in the middle; low and narrow at the north end where it joins the ellipse; 14 m /
  33 m at the east end, stopping 6 m before the portal so the slope by home 5's apartment stays under 35°). Grid cell 4 m
  (`H.cs`). Portal cover: north 9.87 m, east 10.18 m (`T.clr`, ≥ CLR 9.4). Steepest 33.7° at (−98, 326).
- **Tunnel object** (`tunnels()`): every tunnel now has `near(x, z, o)` → `o.s` (along), `o.u` (sideways, + = n = (tz, −tx)),
  `o.d`, and `frame(s, o)` → position + tangent. Straight: s = z, u = x − centre. Curved (`T.path`): `SG` = north extension
  (straight north to the grid edge) + the path + east extension (straight east to the grid edge); s0 0, s1 len are the
  portals, sc0/sc1 the cut ends; `bb` = bounding box for early-out. `tunAt` = |u| < hw and s0 < s < s1, `corrAt` = sc0…sc1;
  `inTunnel` (module level, used by village.js / look.js) goes through `tunIn`.
- `hillsMax(x, z, h, skipK)` now skips only the hill of tunnel `skipK` (was: x range of any tunnel hill).
- Build: grid lines on x0/x1/xE and zN/ze0/ze1; cut cells = north strip (x0…x1, z < zN) + east strip (ze0…ze1, x > xE);
  retaining walls through one `retain(alongZ, line, side, keep)` (z-lines for the north cut, x-lines for the east cut);
  interior sweep, lamps, dark road, portals, plates, railings all through `PT(s, u, y, a)` (straight tunnel output is the
  same as before); inside walls (`lowCols`) for the curve = rotated 4 m boxes along both sides; portal railing collider
  rotated with the tangent; trees skip within hw + 9 of the path; minimap strokes the path.
- **Road** (neihu.js `LK`): straight south from LINK_J to z 194, then `NTUN_LINK.pts` (every 3 m), then 25 m east out of
  the cut to (−80, 348), then a short bezier to P2 and the entrance as before. Guardrails, markings, gantries, the valley
  carve and the route graph all follow LK automatically; the "back to the village" gantry lands at (−80, 348), outside.
- Test: hills-test drives the curved one in the right lane at 50 km/h (`H.lane(T, s0, s1, 3.4)`; the straight one still
  22 m/s), "middle of the tunnel" by s, info check `curved && len > 225 && clr ≥ 9.4`, new shots `9-neihu-tunnel-in`,
  `9-neihu-tunnel-east`. Perf: north portal 153 calls / 0.49M, inside the bend 133 / 0.44M, east portal 143 / 0.47M;
  hills total 13 meshes / 68k triangles (was 63k).
