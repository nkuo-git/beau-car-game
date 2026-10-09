# 越野車車庫 (b6-orbay): a dedicated annex for off-road vehicles at home

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

old-scratch/b5-land (the v23 trial page). old-scratch/b5-land, old-scratch/b4-neihu, old-scratch/b3-int and the 萬能軟體 repo (nkuo-git/carid-pwa) were not touched; nothing was
published, committed or pushed.

Nick, 2026-10-07: 「越野車專屬位」.

Before this batch the monster truck (and any other vehicle with no light model / `PERF.big`) waited on **大車位** — two
hand-painted yellow rectangles on the bare concrete apron in front of the garage roller door (`BIG_SPOTS`, `bigMarks()`
in town.src.js). Two spots, no roof, no door, nothing to look at. That is all gone; in its place there is a real
building.

## A. Where it is

A separate annex **west of the white-marble garage**, same style (white marble outside, concrete inside):

| | world x | world z |
|---|---|---|
| annex (outside wall faces) | −342 … −320 | −109 … −91.5 |
| inside (0.3 m walls) | −341.7 … −320.3 | −108.7 … −91.8 |
| roller door (east wall) | at x −320 | −101 … −94 (7 m wide, 4.4 m high) |
| concrete lane outside the door | −320 … −313 | −109 … −86.5 |

Inside height 5 m to the ceiling, 5.3 m to the roof slab, 5.8 m to the parapet. The main garage is at x −313…−287,
z −110.5…−92.2, so the two buildings share a 7 m gap that the new lane runs through.

Why there, and what it had to miss:

- **West house row** (透天厝) x −340…−319.6, z −89.5…−77, 9.9 m tall — the annex south wall stops at z −91.5, 2 m clear
  (their eaves/signs stick out on the *other* side, z −76.4, so nothing overhangs the annex).
- **Paddy field** x −386…−344, z −110…−94 — the annex west wall stops at x −342.
- **Boundary wall / trees** z −116…−113 and the tree ring at z ≈ −110.3…−111.8 — the annex north wall stops at z −109.
- **NPC lanes and the walk graph** have no edges in x −360…−312, z −116…−88, so no resident or AI car is routed through
  the annex or the new lane. The lane is pushed into `V.roads` as `kind: 'drive'`, which npc.js ignores (its `KIND` only
  has main/street/farm) but the mini-map still draws.
- The 內湖 link road at (−112, 94) and the off-road cement road are both hundreds of metres away.

East and south were tried first and rejected: east of the garage the corridor to the next house row is only 2.5 m, and
south there is not enough forecourt left in front of the garage door.

**The one thing that had to move**: the two flower beds in the front yard were z −91…−80 (11 m long). A car coming west
out of the forecourt had only a 1.2 m slot between the west bed and the garage wall. Both beds are now z −86…−80 (6 m) —
shortened by the same amount so the forecourt still looks symmetric — and the shrub/tree spacing was re-fitted to the
shorter bed. That opens a clean 7 m route: forecourt → west at z ≈ −88 → north at x ≈ −316.5 → west through the roller
door at z ≈ −97.5.

**Driving the truck out is a curve, not a corner.** The lane is 7 m wide and the garage wall is straight across from the
door, so a 7.3 m truck cannot drive out east and then turn south — it ends up nose-to-wall. It has to start turning
right while it is still in the doorway, which the 7 m opening allows (the tail swings north to z ≈ −100.3, still inside
the opening, and the nose reaches x ≈ −314 at worst, about 1 m clear of the garage). Route that works, from the aisle:
(−318, −95) → (−316.5, −90) → (−310, −86) → the forecourt. Aiming straight out of the door first (or at the forecourt
from inside) wedges the truck at x ≈ −322. Coming home is the mirror image and is easier, because the aisle is 9.4 m.

## B. What is in it

- **4 bays**, 4.6 × 7.5 m each, centres x −339.4 / −334.8 / −330.2 / −325.6, z −104.95, heading π/2 (nose north, you
  drive in). The monster truck is 3.81 m across the tyres and 7.3 m long, so each bay leaves ~0.4 m a side.
- **Aisle** 9.4 m deep (z −101.2 … −91.8) — enough to reverse a 7.3 m truck out of a bay and turn it to face the door.
- **Yellow lines** round every bay and 「越野車」 painted on the floor of each one; 「越野車專用」 on a sign board over the
  door outside, lit by two small spots.
- **Roller door** in the east wall: 23 slats on one `InstancedMesh` that roll up into the box over the lintel, exactly
  like room.js's garage door; same 「開鐵捲門」 button, same open/close times, same remote-close rule.
- **Lights**: ceiling strips (self-lit `MeshBasic` quads) plus two warning lamps by the door. The inside materials get a
  cheap self-lit wash in `onBeforeCompile` (`totalEmissiveRadiance += diffuseColor.rgb * 0.34`, roof 0.16) so the
  interior is not a flat grey box — no extra lights, no extra draw calls.
- **Props**: a tyre rack with six tyres, a tool wall + workbench, two oil drums, mud patches on the floor, the door
  threshold and rails. The rack, the bench and the drums have colliders; the mud does not.

## C. How it behaves

- Every owned off-road vehicle (`!liftOK(k)`, i.e. no light model or `PERF.big`, and it has a LOD) gets **its own bay,
  ordered by price** (`baySpot(k)` in town.src.js, same `byPrice` ordering the old `bigSpot` used) — so the same vehicle
  is always in the same bay. A fifth one would get `null`, exactly as a third one did before.
- Driving home: drive into a bay, stop, press 下車 → the car straightens onto the bay centre (nose in or nose out, both
  count) and stays there; the toast says 「怪獸卡車 停好了：越野車車庫 1 號格」.
- On foot you walk in and press 「上車 · 怪獸卡車」 like any other parked car; you drive out through the roller door.
- The dealer delivery for an off-road vehicle goes to its bay: 「… 車行幫你開回家了：停在越野車車庫」.
- **Only off-road vehicles**: `orbaySpot()` returns null when `liftOK(cur)`, so a normal car parked in a bay is not
  "parked" there — it has no spot and the bays stay for the trucks. Normal cars still park on the garage lifts.
- `bayTaken(i, skip)` stops two vehicles claiming the same bay.
- **Old saves still load**: nothing in `GAME.park` changed. `normPark()` already dropped non-`liftOK` cars from the lift
  decks, and bays are not saved — they are derived from `GAME.owned` every trip, like the old 大車位 was.

## D. Colliders, camera, mini-map

- 5 static wall boxes (h 5.2) + the tyre rack + the bench + 2 drums go into `V.colliders` at build time, so **drive.js
  and walk.js get exactly the same set** (both read `V.colliders` when they are created).
- The door is the only moving collider: `OB.doorCols(open)` returns one box when the door is shut. town.src.js's
  `orbayStep()` adds/removes it under the tag `'orbay'` for the car (clear at `door.t ≥ 0.9`) and for the walker (clear
  at `≥ 0.55`, the same threshold walk.js uses for the garage door), and drops it entirely while you are inside a house
  (interiors.js). An overlap check against every other collider and building in the village reports **0 overlaps**.
- Walking inside, `gcam.maxY` is clamped to 4.75 m so the third-person camera does not poke through the ceiling.
- `OB.cull(camera)` hides the roof mesh when the camera is inside the footprint and above 4.4 m — the same trick
  room.js uses, so you can see the truck in its bay from the chase camera.
- Mini-map: the wall colliders are h ≥ 4 boxes, which the map already draws as buildings, and the lane is a `V.roads`
  entry, so the annex appears like the garage without any map-specific code. It is also pushed into `V.buildings` as
  `kind: 'garage'` **with no `door`**, so interiors.js, the residents and the traffic ignore it. It has no `DEST` entry,
  so it gets no 去哪裡 pin.
- `V.surfaceAt` is wrapped so the annex floor and the lane report surface 3 (concrete).

## E. Cost

| | draw calls | triangles |
|---|---|---|
| at home, annex hidden | 225 | 1,315,870 |
| at home, annex drawn | 231 | 1,316,914 |

**+6 draw calls, +1,044 triangles.** The whole annex is 6 merged meshes — `orbay-main` (inside), `orbay-ext` (outside
walls), `orbay-roof`, `orbay-sign`, `orbay-glow` (the lit quads) and one `InstancedMesh` for the 23 door slats. Build
time 5–12 ms. Nothing allocates per frame: `OB.update(dt)` only moves the door's instance matrices while it is opening
or closing, and `cull()` toggles one `visible` flag.

## F. Code

- **orbay.js** (new, in the bundle lists of both build-art.mjs and build-app.mjs, after neihu.js) exports
  `buildOrbay(V, { renderer })`, `orbayFonts()` and `ORBAY_TEXT`. It builds the geometry with the same `PB` merged-
  geometry builder offroad.js uses, pushes its colliders/place/areas/roads/building into `V`, and returns
  `{ group, door, bays, zones, place, size, box, signs, doorCols, inside, cull, update, info, dispose }`.
  Fonts are loaded by unicode subset, so `orbayFonts()` joins the 出門中 preload with the other modules'.
- **town.src.js**: `BIG_SPOTS` / `bigSpot()` / `bigMarks()` are gone; `baySpot()` / `bayTaken()` take their place.
  New: `obDoor`, `OB_OPEN`, `openOrbay()`, `orbayAct(t)` (the 開鐵捲門 button, from the driver seat and on foot),
  `orbaySpot(t)` (the bay 下車 spot) and `orbayStep()` (door colliders + remote close). `parkSpot()` asks `orbaySpot()`
  first; `driveStep()` calls `OB.update` / `orbayStep`; `driveFrame()` calls `OB.cull`.
- **village.js**: the two front-yard flower beds shortened (see A).
- **port-orbay.mjs**: ports the lot to another trunk. It copies orbay.js, test-b4.mjs and test-app-b4.mjs and makes 24
  anchored edits in town.src.js, village.js, build-art.mjs and build-app.mjs. Every anchor is an exact literal; if one
  is missing or ambiguous nothing is written at all, and running it twice is a no-op (`already`). `--dry` checks only.
  Checked with `node port-orbay.mjs ../b5-land --dry` → all OK (3 copied, 4 files would change). Also run for real on a
  scratch copy of b5-land's four files (old-scratch/b6-work/porttest): the result is byte-identical to b6-orbay's town.src.js and
  village.js, and a second run changes nothing. (An earlier version would have re-inserted the five pure-insertion edits
  on a second run, because the anchor survives inside the inserted text; it now checks for the inserted text first.)

## G. Tests

**test-b4.mjs** (and the same edits in **test-app-b4.mjs**) grew two sections. The old 大車位 section 12 is now
「越野車專屬位」, and section 13 (the dealer) checks the bay instead of the apron. The hook exports `OB`, `orbaySpot`,
`parkSpot`, `baySpot` and `CABIN_EYE`. New checks:

- the truck waits in bay 1 as its light model when you leave the house, not on a lift, with no 大車位 marks left;
- the annex measures up (4 bays 4.6 × 7.5 m, 5 m inside, a 4.4 m door, the 「越野車專用」 sign, 6 meshes / 1044 tris)
  and draws on the mini-map;
- on foot: the garage door, the walk west along the lane, 「開鐵捲門」 at the annex door, walking in to the truck with
  nothing clipping the walker and the camera under the ceiling;
- walking in and pressing 「上車 · 怪獸卡車」: it becomes the full model and drives, GC8 stays in the garage;
- reversing out of the bay, turning in the aisle and driving out through the door;
- the **closed** door stops the truck inside (x −323.15) and 「開鐵捲門」 from the driver seat lets it out;
- driving into bay 1 and pressing 下車: it straightens onto the spot and says 「怪獸卡車 停好了：越野車車庫 1 號格」;
- getting back in and driving out to the forecourt along the lane;
- the dealer delivery: 「怪獸卡車 車行幫你開回家了：停在越野車車庫」, bay 1, no lift, no name plate;
- a **normal** car is stopped by the annex wall from outside (x −344.33) and `orbaySpot` / `parkSpot` give it no bay.

Screenshots: `b4-14-orbay-outside`, `-15-orbay-inside`, `-16-orbay-minimap`, `-17-monster-in-bay`, `-18-monster-out`,
`-19-monster-parked` (in old-scratch/b6-logs/b4/).

Runs (logs in old-scratch/b6-logs/), one at a time after `node build-art.mjs --yaris`:

| test | result |
|---|---|
| test-b4 | ALL CHECKS OK, 74 checks, 232 s |
| test-b1 | ALL CHECKS OK, 140 checks, 593 s |
| test-b3 | ALL OK: 0 failed, 0 page errors, 163 s |
| neihu-test | ALL OK: 0 failed, 0 page errors, 197 s |
| circuit-test | PASSED: 0 failed, 0 page errors (re-run after a container restart cut the first run) |
| drift-test | ALL OK, 87 s |
| free-test | ALL OK |

**test-app-b4.mjs** was edited the same way but not run here: it needs a built App repo.

## H. Open issues

- **The chase camera culls the roof.** Sitting in the truck inside the annex you can see sky and trees over the walls
  (`b4-17-monster-in-bay.png`). It is the same `cull()` trick room.js uses for the garage, so it behaves like the
  garage, but the annex is taller and the hole is more obvious. Lowering the camera instead of hiding the roof would
  fix it.
- **Bay 1 (the west end) needs a three-point turn** to get out — reverse, full right lock, then forward. The test does
  exactly that. Bays 2–4 have more room because the truck can swing through the empty bays next to them.
- Stale `b4-*.png` files from the b5-land copy are still sitting in old-scratch/b6-orbay; the real screenshots are in
  old-scratch/b6-logs/b4/.
