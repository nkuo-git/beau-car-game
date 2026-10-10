# Known-issue fixes 5–12 (2026-10-10, Nick: 「修5-12」)

Shipped together with online steps 2–4 as content 8 (try page `docs/try` first).

## 5 Sky inside the off-road garage
The chase camera of big cars is pulled higher than the annex ceiling (6.5 m), so `OB.cull` hid the roof.
`drive.js` got `setCamCeil(fn)`: after placing the chase camera it clamps `y` to `fn(x, z)` and re-aims.
`town.src.js`: `drv.setCamCeil((x, z) => OB.inside(x, z, 0.6) ? OB.size.ceil - 0.75 : Infinity)`.

## 6 Bay 1 needed a three-point turn
`orbay.js` bays now use `rot: -π/2` (nose towards the aisle). test-b4 / test-app-b4: the bay faces the aisle,
the bot drives straight out (no reversing), parking is now reverse-in (ob4), walking to the truck uses its real nose.

## 7 Picking a destination inside the annex got stuck at the roller door
`setDest` in `town.src.js` opens the annex door when you are driving inside it (`openOrbay()`); test ob7.

## 8 Crushed things came back late (140 m / 25 s)
`crush.js`: every crush (props too) is a BIG job with recorded vertex segments. Phases 0 select → 1 fall → 2 flat →
4 grow (0.8 s, `setK` kf → 1) → 5 restore. Regrow starts after `BACK` 20 s when you are ≥ `BACK_D` 15 m from the
bounds and no later overlapping job exists (`lap`, using `ov`). `settle()` finishes growing jobs that overlap a new
crush. `REC_MAX` 96 (oldest/farthest restored first).

## 9 Wires hanging in the air; the Neihu big-sign arm
LineSegments `wires` (village) / `st-wires` (street) are collected; `wireDrop(px, pz)` drops chains whose end is within
1.3 m of the pole (`yf = g + (y − g)·f²`), `setK` interpolates them. The pole job's `ov = M + 36`.
Signs: `M = max(M, src.reach)` so the whole arm flattens.
crush-test 6g clears police stars while it waits (being arrested goes back to the garage and restores everything).

## 10 Neihu traffic and pedestrians
One combined graph (no second traffic system): `neihu.js` adds `V.npcRoads` — cls ≤ 4 (trunk … residential), split at
junctions (3+ pieces), straight continuations merged, OSM `oneway=-1` reversed; `kind` main / street / alley
(alley = new `KIND`, 25 km/h), `ow` 1 = one-way, `so` = sidewalk centre offset (w/2 + sw/2, or w/2 + 0.75).
`V.npcOnRoad(x, z)` = inside a cls ≤ 4 carriageway (10 m grid).
`npc.js`:
- roadNet: `pre` roads skip the T-split search and merging; node lookup uses a 1 m grid (same result as the linear scan);
  dead-end pruning up to 60 rounds.
- laneGraph: one-way = one lane on the centre line; very short pre roads pull their stop lines in instead of being
  dropped; fit checks every 2 m on pre roads; conflict sampling 1 m on pre junctions; Tarjan SCC at the end —
  pre edges in SCCs < 12 edges are `dead` (no spawn, removed from every `next`).
- walkGraph: side lines at `r.so`; pre side lines every 1 m, dodge search 0.3 m, and a sample is not walkable when it
  lies on another carriageway (dual carriageways drawn as two one-way ways); dead-end check and crossing test use grids
  / bboxes; walk nodes in a 50 m grid (`W.NG`) so "wander" goals are picked nearby; `reattach` skips far side lines.
- Cost: `NPC.load.graphs` ≈ 650–950 ms on the test machine (was ≈ 280). 938 Neihu lanes / 49 km, ~2900 sidewalk pieces.
neihu-test 4b checks the graph, cars (≥ 4 around, > 15 km/h, on the road), people (≥ 5, never in a car lane except
crossings), nobody hit, ms/frame, and that going home puts Neihu's cars/people away.

## 11 「下車」 over the pedals on small stages; landscape phones
Small-stage container query moves `.dv-act2` left (bottom 98 px). Landscape fullscreen driving (`max-height: 560px`):
`#destTog` 「📍 去哪裡 ▾」 folds the destination list (3-column grid when open, closes on pick or > 4 m/s).
`.dv-hb` nowrap. Android `setTextZoom(100)` so the system font size can't blow up the HUD (needs a new APK).

Follow-up (Nick: 「按鈕不用總是全部顯示…點了再列出來 再點一次就收起來」, plus a button-size setting after two
same-model phones looked different because of Android "display size"): in fullscreen driving at every size only
`#destTog` and `#moreTog` 「⋯」 show. 「⋯」 opens sound, fullscreen, camera and `#sizeTog` 「Aa」; tap again, pick a
destination, or drive off (> 4 m/s; 8 s timer if opened while already moving) folds them (town.src.js `FOLD`,
`foldStep`). 「Aa」 opens `#sizePop` 小/中/大 = CSS `--hudz` 0.8/1/1.15 applied with `zoom` to the drive/walk HUD,
`#drivebar` and the fullscreen button; stored per device in localStorage `carid.btnsize` (not in the save).
Neihu people: sidestepping someone on a `side` edge may not step onto a car lane (`onLane`); stepping around a
parked car still can, after checking for traffic.

## 12 Police / traffic cars stopped you like a wall
npc.js and police-ai.js colliders carry `vx/vz/m/dvx/dvz`; drive.js resolves the bump by momentum and the car consumes
the push next frame (see notes/bigmap.md for the rear-end bump model).
