# Big map, opponents on the minimap, rear-end bumps (2026-10-10)

Nick, 2026-10-10:
- 「可以瀏覽完整地圖」
- 「連線或比賽時 可以從地圖看到對手位置」
- 「比賽時撞到前車 要考量物理慣性合理的減速 不是整個完全停住」

Mock https://claude.ai/artifact/VF5wb2U1PpAnzBRyJsSSW6. Nick: 「大地圖OK 可以開始做 做完再一起上線」. Trial v30 (bumps) → v31 (big map), shipped together as content 7.

## Rear-end bumps (drive.js, circuit.js)
- Moving colliders: `drive.addColliders` entries can carry `vx, vz` (m/s) and `m` (mass relative to you, default 1).
- The closing speed is computed relative to that velocity.
- `impact()` then applies an equal-mass momentum exchange with restitution 0.15. It adds `1.15·w·m/(1+m)` along the normal to `st.v`.
- The other car's share goes into `src.dvx/dvz` (consumed by its owner). The wrapper's `vx/vz` is updated at once so the remaining substeps of the same frame don't hit again.
- Static colliders (walls, parked cars) keep the old behaviour exactly; drift-test compares against the trunk drive.js.
- circuit.js:
  - Puts each AI's velocity on its `AIC` box.
  - Before `aiStep`, consumes `dvx/dvz`: the forward part goes into `a.v`, the sideways part into `a.pushD` (lateral drift that decays, clamped inside the track).
  - The race object exposes `colliders` (for the test).
- Numbers (bump-test, GT-R):
  - 120 km/h into an 80 km/h car → you 95, it 101 (momentum 200 → 195).
  - Wall: still stops.
  - Hit from behind at 110 while doing 60 → you 88, it 81.
  - Side rub: no speed loss.
- Police cars and traffic don't pass `vx/vz` yet, so they still act like walls.

## Big map (bigmap.js + glue in town.src.js)
- `createBigMap({ parent: stage, world: VIL, layer, me, route, dots, dest, onGo, onOpen, onClose })`.
- It's a full-stage overlay (`.bm`, z 30) with:
  - one 2D canvas;
  - pan (1 finger), pinch / wheel zoom, ＋ － 📍;
  - tap a place → card (name, straight-line distance, 「去這裡」 → `setDest`);
  - ✕ / Esc / Android back to close (garage.src.html `caridExitFullscreen` closes it first).
- Drawing:
  - The same base layer as the minimap (`walker.mapLayer`), plus `world.mapLive` for Neihu, plus the orange route.
  - Place icons: `DRIVE_DEST` + circuit (`BIGMAP_STYLE`). Dots: police markers + race markers. Then your arrow.
  - The OSM credit is always shown.
- It only draws while open: every frame while dragging, 4×/s otherwise. A draw is ~1 ms in headless Chromium. No 3D cost.
- Opening it while driving: `drv.setInput({ brake: 0.5 })`, so the car rolls to a stop. Walking: `walker.setInput({0,0})`. Closing gives control back. `body.bigmap` hides `#drivebar`.
- Minimap tap:
  - `drive.setMapTap({label,onClick})` / `walker.setMapTap(...)`: the minimap gets `pointer-events:auto` and an orange inner border, plus a label strip at its bottom.
  - `mapStep()` (end of `driveStep`) sets it only when the mode changes:
    - 「🗺 大地圖」 when driving or walking;
    - 「看整個賽道」/「回來」 in a circuit race;
    - nothing in the mud race, the 400 m race, jail, indoors, auto-drive or a door fade.
- Circuit race:
  - `drive.setMapView(box)` turns the minimap north-up over the whole track, with your arrow at your position. Places outside the box are hidden.
  - `drive.setMarkers(list, 'race')` is a second tagged marker list: one dot per AI, `label` = its position, red if ahead of you, grey if behind. The dots are updated in place every frame (no allocations).
- Drive-together friends (online step 2) will use the same `dots` with `name` (drawn as a label next to the dot).

## Tests
circuit-test (37 ok) covers:
- Walking: label, open, cover, OSM credit, pick shop card, zoom, 去這裡 → dest + pill + toast.
- A real mouse drag pans the map; tapping the dealer icon picks it; ✕ closes.
- Driving: open → throttle does nothing; Esc → throttle works.
- Race grid: label 看整個賽道; dots 1–3 red; tap → whole-track view; tap → back; an AI collider `dvx` → AI speed.
- Screenshots: `ci-bigmap-walk.png`, `ci-05-minimap-whole-track.png`.

bump-test (Node, 7 ok) covers drive.js moving colliders.
