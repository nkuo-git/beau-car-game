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
