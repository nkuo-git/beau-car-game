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
