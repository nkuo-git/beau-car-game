# 輾扁 (b7-crush): the monster truck drives over things and flattens them

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

old-scratch/b5-land (the v23 trial page). old-scratch/b5-land, old-scratch/b6-orbay, old-scratch/b4-neihu, old-scratch/b3-int and the 萬能軟體 repo (nkuo-git/carid-pwa) were not touched.
Nothing was published, committed or pushed.

Nick (2026-10-07): 「可以輾別人」, then 「怪獸卡車啥都可輾」.

Only the pink monster truck (PERF.big) crushes. Every other car keeps exactly today's collision and bump — the crush
option is not even passed to drive.js for them. Police cars just block, as before.

## What happens

Driving the monster truck into something small puts a **temporary piece of terrain** (a "pad") where that thing is: a flat
top with a 2 m smooth ramp round it. The wheels climb it with the normal terrain physics (terrain.js ride, which the
monster always has on), so the truck tips up, rides over and comes back down — no special-cased animation. While the truck
is on top, the pad sinks from the thing's own height down to flat (0.55 s), and the thing is flattened with it:

- **Cars** (traffic cars and the park's junk cars): `lod.setSquash(0–1)` presses the body group down (scale y 1 → 0.4,
  slightly wider and longer) and hides the glass at 30 % — roof down, windows gone. A crunch when it is hit, breaking
  glass when the roof goes.
- **Roadside things** (bins, light boxes, scooters, benches…): they are baked into the big world-space merged banks, so
  crushing one does a **one-off vertex edit** inside its collider footprint (y *= 0.14/height) and uploads only that range
  of the attribute buffer (`attribute.updateRanges`). Done once, never per frame.

Once something has been hit it keeps going flat even if the truck drives off it, so nothing is left squashed half way.

**People are never crushed.** When a traffic car is hit, the driver (and 45 % of the time a passenger) **jumps out on the
side away from the truck and runs away** (peds `bail()` → flee mode, 3.6–5.2 s, then they walk back to the pavement), and
the driver is hidden from the cab. The pedestrian pool is 14 people and was usually full, so `bail()` now releases the
farthest person (> 25 m, not one that is falling/getting up/going through a door) to make room — the driver always gets
out. Pedestrians keep today's fall-and-get-up, children are never hit (npc.js already never lets a car hit a kid), and the
crush never reports a 'hit' crime.

**Police**: a crush on the village streets reports a `'crush'` crime, +1★, toast 「你把別人的東西輾扁了！警察來了」. Inside the
off-road park (`world.terrainAt`) it is free. Driving along flattening a whole row would otherwise be 1★ every 1.5 s, so
crush.js only reports **one crime per 8 s** (CRIME_GAP) — one crush, or one spree, is 1★.

**Nothing in your own garage crushes** (`inGarage()` in town.src.js): your other cars, the tool stuff, the roller door.
That also keeps the garage-page driving in test-b4 exactly as it was.

## The off-road park's junk cars

offroad.js has a new flat show area beside the ramp at (12…44, 117…131), gravel, with a 1.5 m earth ramp at x 15.4–26.2,
and `P.show = { x0, x1, z0, z1, cx, cz, ramp, cars }` with **5 junk cars in a row** at x 27.2…35.6, z 124. town.src.js
builds them from the light-car models (carlod.js, non-big keys) in faded matte looks, **one per frame** and only when you
are within 170 m, so arriving at the park does not stutter. First one you flatten: toast 「輾扁了！」.

A junk car comes back (stands up again, squash reset) 30 s after it was crushed when you are not on it, or 2 s after you
go more than 50 m away, or when you go back to the garage page. Until they are crushed they block normal cars (collider
with `junk: true`, re-registered only when the set changes, `colVer`); for the monster truck they are not colliders at all
— it just drives up.

## Which object types crush

Classified by collider size, the same trick street.js uses for shadows (`can(c)` in crush.js), so it covers everything in
the world with a small collider, not a hand-written list:

| crushes | what it is (size) |
|---|---|
| 路上的車 (traffic cars) | npc.js, via `me.crush` → `wreck()` → `hitTraffic()` |
| 垃圾車 (park junk cars) | `junk: true` |
| 垃圾桶 | circle r 0.32 h 0.95 |
| 店門口的燈箱、立牌 | circle r 0.28 h 1.3 / r 0.3 h 1.4 |
| 門口的矮柱、花盆、矮樹叢 | circle r 0.18–0.25 h 0.8–0.9 |
| 細桿子、小招牌、站牌 (≤ 3 m) | circle r ≤ 0.1, e.g. the bus-stop sign r 0.1 h 2.9 |
| 停著的機車 | box 0.82 × 0.3 h 1.1 |
| 板凳 (street benches) | box 0.9 × 0.22 h 0.9 |
| 內湖的矮欄杆、矮圍籬 | boxes h ≤ 1.35 and ≤ 1.7 m half-size |

Rule: circles with r ≤ 0.62 and h ≤ 1.6, or r ≤ 0.1 and h ≤ 3.0; boxes with h ≤ 1.35 and hx, hz ≤ 1.7; plus junk cars.

**Never crushed**: houses and walls, the 文湖線 piers, lamp posts and power poles (r 0.22, h 6.2–9), bus shelters
(h 2.6), trees above a sapling (h > 1.6), the big road signs and gantries, police cars (`police`), pedestrians and
anything else npc.js flags (`npc`), your own cars and the dealer's display cars (car-length boxes, hx ≈ 2.2 > 1.7), the
roller doors and everything inside your garage.

Two notes on the brief:
- There are **no street-parked NPC light cars** in this build (the only parked light cars are your own, in the garage), so
  "parked LOD cars" has no instances outside the park's junk cars.
- The little **stools and benches around the trees come from npc.js** (`npc: 'bench' / 'stool'`). They are drawn in npc.js's
  own group, which the flatten path (which only knows the world banks) cannot touch, so they are left out: crushing them
  would remove the collider while the thing stayed standing. Street benches do crush.

## Files

New: **crush.js** (`createCrush`, ~300 lines: pads, flatten, junk cars, bail/sound/police hooks) and **crush-test.mjs**.
Changed: carlod.js (`setSquash`), terrain.js (`extraH` in createRide), drive.js (`crush` option: crushed colliders do not
block anyone, `can`/`hit` on contact, `extraH` = the pads), walk.js (walkers ignore crushed colliders), npc.js
(traffic `wreck`/`wrecks`/`recycle`, `b.crush` in hitTest, peds `bail`), police-ai.js (`crush: 1`, its message),
offroad.js (the show area, its ramp, `P.show`), town.src.js (`makeCrush()`, wiring, `crushStep`, `inGarage`),
build-art.mjs / build-app.mjs (crush.js in the bundle, after npc.js).

No new save fields: nothing about crushing is persistent, so garage.src.html `save()` is untouched. Going back to the
garage page clears the pads, puts the crushed traffic cars back into the NPC pool and stands the park's junk cars up
again; flattened roadside things stay flat (see Open issues).

## Perf (the phone question)

crush.js `update()` **0.008–0.012 ms per frame average** over 3685 stepped frames (0.0082 ms in the last run), max
0.9–4.1 ms depending on the run. The max is a one-off: the frame
that flattens a prop's vertices (a few hundred to a few thousand vertices, uploaded as one buffer range). Steady state
with pads on screen is a loop over 16 pooled pads. No per-frame allocations: pads, colliders, the updateRange objects and
the crime position are all pooled; `heightAt` is an allocation-free loop over the pads; the mesh list is cached with world
bounding spheres and only rebuilt when the village is. npc.js in the same run: 0.14 ms average. Draw calls in the
screenshots: 195 / 388k tris (crushed car), 117 / 410k (the junk row in the park).

## Tests

All run one at a time, blocking, logs in **old-scratch/b7-logs/**, after `node build-art.mjs --yaris`:

| test | result |
|---|---|
| crush-test | ALL OK — 27 checks, 0 failed, 0 page errors |
| test-b4 | ALL CHECKS OK — 66 ok, 227 s |
| test-b1 | ALL CHECKS OK — 140 ok, 670 s |
| test-b3 | ALL OK — 56 ok, 0 failed |
| neihu-test | ALL OK — 29 ok, 0 failed |
| circuit-test | PASSED — 24 ok, 0 failed |
| drift-test | ALL OK — 42 ok, 107 s |
| free-test | ALL OK |

No check was weakened. Two checks in crush-test were made **more** exact while fixing real bugs: the climb check now reads
the highest body height during the drive (it used to read it after the truck had already come down), and the "drives on"
check now measures how far and how fast it got away from the wreck instead of the speed at one arbitrary moment (5 s later
the truck had reached the end of the street and was stopped against something).

crush-test covers: the GC8 ramming a traffic car and a roadside thing (nothing crushes, it bumps and is blocked); the
monster truck crushing a traffic car (out of the traffic flow, body scale y 0.4, glass gone, driver gone, 2 people out and
running, nobody down, knocks unchanged, 1★); the truck climbing 1.88 m over it and driving on; a roadside thing flattened
(5764 vertices pressed down, bins and scooters among the types, 1★, the truck is not stopped); the park's 5 junk cars in a
row with their pads, 3 crushed in one run with **no** star, the 「輾扁了！」 toast, and all 5 standing again after driving
away; the crushed traffic car recycled into the NPC pool after ~20 s with the traffic flow still healthy; and the frame
cost. Screenshots in **old-scratch/b7-logs/shots/**: crush-1-gc8-bump, 2-crushed-car, 3-drives-on, 4-flat-prop, 5-junk-row,
6-junk-crushed, 7-park-after.

## Porting

**src/port-crush.mjs** — `node port-crush.mjs <dir> [--dry]`. It copies crush.js and crush-test.mjs and makes 34
exact-anchor edits in 10 files; if any anchor is missing or ambiguous it writes nothing and says which. It is idempotent
(an edit already in place is reported "already"). Checked: `--dry` against old-scratch/b5-land → all OK, 10 files would change;
`--dry` against old-scratch/b7-crush → 0 files. Run `node build-art.mjs --yaris` afterwards. The anchors stay away from town.src.js's
BIG_SPOTS / bigMarks / room / village code, so it can run after port-orbay.mjs.

## Open issues

- The flatten edits vertex positions only, not normals, so a flattened thing keeps its original shading. It reads as a
  crushed object; recomputing normals would cost more than it is worth.
- Flattened roadside things **stay flat for the rest of the session** (only the park's junk cars come back). The village
  is built once per page load and kept between trips, so what you flattened is still flat (and still not blocking) when
  you go out again; a reload puts it all back. Nothing about it is saved.
- The 「輾扁了！」 toast is once per session (a flag in crush.js), not stored in the save.
- The 8 s crime throttle means a long crushing spree is 1★ per 8 s rather than per object — deliberate, otherwise one
  street is instantly 3★.
- The monster truck's price is still 800 萬 in PERF (left alone on purpose — the coordinator changes it to 100 萬 when
  merging).
