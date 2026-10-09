# 山 (第 14 批): a mountain you can drive up

Nick (2026-10-09): 「車可開到山上」. Mock https://claude.ai/artifact/NhH4i6Gw2C8Yk2ZhEx6Poj, approved 「好」. Trial page v29.

## What is there

- **Where**: north of the village. The road starts at the north-east corner of the street that runs past your garage
  (street corner G→C, the vertex nearest (−252.5, −69.5)). It goes through a gap in the north boundary wall
  (x −256…−244) and climbs north in switchbacks.
- **Size**: about 102 m high, about 1 km of road (the mock said 120 m and 1.5 km; the box north of the village is
  only ~430 × 580 m, and a taller mountain made cliffs). 12 % grade on the straights, 8 % through the 4 hairpins.
- **Road**: 9 m asphalt with the village main-road texture (white edges, double yellow). Guardrails on the downhill side
  and round the outside of each hairpin. 「急彎」 signs 32 m before each hairpin (both directions), convex mirrors,
  hazard chevrons. Start gantry (white line) near the bottom, chequered finish gantry 30 m before the top, 「往山頂」 sign.
- **Summit**: parking with stall lines, stone terrace, a red pavilion (two-tier roof, curled corners, benches,
  stone table), wooden viewpoint railings on the south and east edges, a 「山頂觀景台／海拔 N 公尺」 sign.
- **Dirt shortcut** (「越野車捷徑」): a brown trail straight up the slope from (−224, −150) to the summit. Surface 5 (dirt).
  The monster truck climbs it (~25–45 s with the test bot); road cars can try but it is steep grass/dirt.
- **Trees**: ~950 (round trees and pines), jittered grid with a density noise; none near the road, trail or summit.
- **「去山頂」** in the where-to list (DEST.mountain, green 山 icon). It shows the way (route + chip + beacon) like every
  other destination; nothing drives for you.
- **爬山計時賽**: drive uphill through the start gantry → timer panel (top left, same look as the mud-race panel);
  finish at the finish gantry or by entering the summit (so the monster shortcut counts). Best per car in the save:
  `best: { hill: { <car>: seconds } }`. Cancelled if you get out, get caught, start a race, drive back down below the
  start, leave the mountain, or take more than 10 minutes. The result stays 4 s (hidden at once when you get out).
- First time at the summit: toast 「到山頂了！海拔 N 公尺，下車去涼亭看風景」.

## How it is built (src/mountain.js)

- `mountainLayout(start)`: centerline from control points as straights + true circular fillets (1 m points),
  height profile (grade per segment, smoothed, integrated), then a 2.5 m height grid over the box
  x −505…−75, z −700…−117.5: Shepard interpolation of "extruded" road samples every 6 m (flat within FLAT 6.5 m of the
  road, then sloping toward the next road leg or toward a dome shape), far blend to the dome, noise, flattened summit,
  edge fade to 0 at the box border (24 m).
- `heightAt`: on the road (within 5.1 m of the centerline) it is the road profile itself (1 m points, same as the drawn
  asphalt + 0.05); 5.1–6.5 m blends to the grid; elsewhere it is the exact grid triangle (diagonal 00–11) — same as the
  drawn terrain. Using the grid on the road made cars hop going downhill fast (2.4 s of air at 80 km/h); the profile
  is smooth (0 s air at 110 km/h).
- `buildMountain(V)` wraps V.heightAt / normalAt / terrainAt / surfaceAt / route / mapDraw; outside the box everything
  answers exactly as before. Road cars switch to terrain ride when `terrainAt` is true (terrain.js).
- Surfaces: 3 road and summit, 5 trail, 1 grass; the village side falls through to the old surfaceAt.
- Meshes: terrain `mt-hill` (village ground material + vertex colours, ~80k tris), `mt-road`, `mt-road-join`,
  `mt-trail`, and the merged props in 100 m chunks (`mt-main`, `mt-sign`). 46 meshes, ~111k tris total.
- `V.roads` gets the road (kind 'mount', noNpc): the minimap draws it and police-ai builds its nav graph on it
  (its first point is a street vertex, so it splices in as a T-junction). No traffic or pedestrians on the mountain.
- `places.mountain` = 山頂 (zone = summit rect, spawn in the parking).

## Changes elsewhere

- village.js: north wall split (gap x −256…−244); the two north-row trees and the east half of the paddy at
  (−282…−232, −108…−92) are not drawn where the road goes (random numbers still consumed, so nothing else moves);
  the five hills north of the village (3 near, 2 far) removed; the shed at (−485, −330) removed.
- police-ai.js: police cars and officers stand at `heightAt` on terrain (they were at y 0), and the car pitches with
  the slope.
- crush.js: flattening works on slopes — ground height per vertex (`heightOf`), rubble and dust at ground height;
  `trail` meshes are skipped like roads. Village (height 0) behaviour is unchanged. Crushing on the mountain is not a
  crime (terrainAt, same as the off-road park). Pavilion, viewpoint railings and summit sign are noCrush.
- town.src.js: buildMountain + fonts, arrival toast, the time trial (hillStep / hillHud).
- drive.js: DEST.mountain. garage.src.html: 「去山頂」 button; `best` in save()/load/restart.

## Numbers

- Build: ~330 ms in the browser (layout ~230 ms).
- Driving view (390×844, swiftshader): summit 171 calls / 1.12M tris; looking from the viewpoint 154 / 0.40M;
  halfway 150 / 1.07M; foot (village) 182 / 1.17M.
- GC8 bot: up in ~60 s (85 km/h max), down ~66 s.

## Test

`node mountain-test.mjs ../out/mt/mt` — 34 ok: button, size, route, surfaces, road list; GC8 up with the time trial
(start, finish, best saved, slower run keeps the best), stays on the road (≤0.05 m, no air) up and down; get out at the
summit, walk to the pavilion, railing stops you; monster truck up the shortcut; tree and guardrail flattened onto the
slope/road, no stars, pavilion not crushable; police cars chase up the road and sit on the slope.

## Known

- No night, so no lights from the viewpoint (the mock mentioned them).
- No sitting animation in the pavilion; you can walk in.
- The flanks beyond the upper hairpins are steep-ish (slope 0.7–1.4) — fine for looks; road cars stay on the road.
