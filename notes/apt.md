# Apartment home (batch 60, trial v72, 2026-10-31)

Nick (2026-10-31): 「自己家改成在旁邊的公寓／每間房子都可以上頂樓或每一層樓／每間房間格局不一樣人裡面的人要可以動」.
Mock https://claude.ai/artifact/GahqJPKLLPf5FYXmHeq2wU (v1), Nick tapped 「照草稿做」. Order agreed: apartment home first (this batch),
then stairs/roofs in every village house, then varied layouts + residents that move around.

## What it is
- Every one of the 6 homes (round tower garages, village.js `HOME_SITES`) gets a 5-storey apartment block beside it, on the left of the
  shutter line, 26 m from the tower centre, facing the same street (`apt.js aptLotOf`: tower-local (lx 4, lz 26), heading = tower heading + π/2;
  per-site override `HOME_SITES[n].apt = { lx, lz }` — home 5 (內湖入口) is pushed back 3 m because the access road comes in diagonally
  and its guardrail touched the apartment's corner).
- Shell: `apt.js buildApt()` → 5 geometry/material parts (tiles, concrete, glass, metal, white), 4.4k triangles; town.src.js `aptExt()`
  draws all six as 5 InstancedMesh (5 draw calls total). Windows on every face, recessed balconies on 2F–4F (right half, sliding door + AC),
  1F glass double door with canopy, step and name plate, roof parapet, stair head with steel door, water tank, two clothes racks, planters.
- Village side (village.js, HOME_SITES loop): one `buildings` entry `{ kind: 'apt', name: 'X的公寓', slot, door }`, one solid box collider
  (noCrush, 17.5 m high — nothing crushes or knocks it over), a concrete pad from the door to the street, and `nearApt()` so bamboo/trees/kerbs
  skip it. hills.js `homeKeep` also flattens the apartment rectangle (+1 m margin, 14 m blend; widening the tower circle instead made the hill south of home 4 steeper than 35°), mountain.js `HOMEPAD` widened west to x −312.5 (home 2 sits at the
  summit height; `b.y` copied from `slots[1].y`), circuit.js keep box widened west to x 138 (home 3).
- Inside: interiors.js `kind 'apt'` (`aptFloor`): 1F lobby (mailboxes, notice board, bench, scooter, plants, 管理室 door), lift + stairs
  reaching every floor, 2F/3F/5F corridors with neighbours' closed doors, **4F = Nick's flat**: 玄關, 客廳 (sofa, TV, dining table), 房間
  (bed = 睡覺, wardrobe = 換衣服), 廚房 (L kitchen, fridge), 廁所 (tub, toilet, sink). Built in ~170 ms, 42k triangles, 9 draws; lobby 11 calls.
- Lift: standing in the lift car (`I.lift` rect) shows a panel like the tower's (`.elpanel.apt`: 4F 5F 頂樓 / 1F 2F 3F); a button fades to that
  floor (`aptLiftGo`, spawn in the lift car). 頂樓 goes outside.
- Outside levels (town.src.js `APTU`): the roof (16.5 m) and the 4F balcony (9.9 m) are real outdoor places in the world scene:
  `aptOut(e)` disposes the interior, adds only that level's colliders (parapets, stair head, side walls; `A.roof.cols` / `A.balc.cols`
  via `aptColsAt`), overrides the walker's `heightAt` inside the footprint (`walkWorld`), sets one door back inside (`aptIn: true` →
  `aptIn()` → `enterApt(b, floor, spawn)`), camera maxY under the balcony ceiling. `aptDown()` undoes it (walking back in, 直接回車庫,
  arrest). Reached by the 4F living-room door (`exitZone … 'balc'`), the 5F stairs (`stairShaft` top exit → `'roof'`) or the lift panel.
- Sleep / dress: `goSleep(B)` generalised (B = feet/head/y/heading/wake/w/by): `towerBed()` for the tower's little house (still works) and
  `aptBed()` for the flat's bed (`I.spots.sleep[0]`); wake point beside the bed. `aptWalk()` offers 睡覺 within 1.9 m of the bed and
  換衣服 within 0.95 m of the wardrobe (`I.spots.dress`). The tower's bed/wardrobe stay until Nick says to drop them.

## Gotchas
- walk.js doors: `setDoors()` and `teleport()` re-arm every door by zone — a door whose zone you are standing in starts disarmed and only
  re-arms when you leave it (|lateral| > w + 0.35, or 3.5 m away). The balcony is 1.4 m deep and the door point gets pushed 0.4 m out of the
  wall by `freeAt`, so the whole balcony is inside the zone: the spawn has to be *beside* the door (balcony x +2.3, roof z +1.8), and
  `aptOut` teleports first, then calls `setDoors`. Tests approach these doors sideways (apt-test `toBack`).
- `walker.telemetry()` has no y; the character's height is `walker.character.group.position.y`.
- The interior is at y 0 in its own scene even for the summit apartment; only the outdoor levels add `b.y`.
- Building `rot` + `door.ry` follow the house convention (local +z = front, door just outside the wall, ry = rot).

## Numbers (apt-test, 390×844, 普通)
lobby 11 calls / 12.7k tris · 4F corridor 11 / 18.8k · balcony 132–137 / 0.52–0.54M · roof 308 / 0.78M (sees the whole village) ·
street by the door 104 / 0.44M · shell 4.4k tris per block, 5 draw calls for all six.

## Tests
`node apt-test.mjs ../out/apt/apt` (25 ok, ~1.5 min): six blocks, summit height, walk in, lobby, lift panel, 4F rooms, random walk in every
room (no wall/furniture penetration, camera under ceiling), 睡覺 (lie down, dark, 睡飽了！, wake beside the bed), 換衣服, balcony (height,
parapet, back in), roof via lift and via the 5F stairs (height, parapets on all four sides, back to 5F), lift 1F and out the front door.

## Batch 61 (trial v73): the whole block is my home, stairs are walked
Nick 2026-11-02: 「整棟公寓都是我家／樓梯要自己走」.
- Floors 2–5 are all my flat (same plan as 4F; per-floor colours in interiors.js `APT_PAL`: walls, sofa, quilt). 2F–4F have the
  balcony (`hasBalc`), 5F has a plain front wall. Every floor has 睡覺 / 換衣服 (town.src.js `aptWalk`: `I.floor >= 1`).
- Balconies on 2F–4F are real: `aptOut` offsets apt.js's 4F balcony level by `dy = (floor − 3)·3.3` (height, colliders, camera ceiling).
- Stairs: the old stair exit zones (teleport to the next floor) are gone. interiors.js `stairShaft` now leaves the flight ends open and
  publishes `F.stair` (local box of side a = up flight, side b = down flight, zSB / zL / zS1, up, down, rise 3.3, top 'roof' on 5F);
  `buildInterior` copies it per floor, `setFloor` sets `I.stair`.
- town.src.js `walkWorld().heightAt` indoors = `stairY(x, z)`: a two-flight U stair has an upper and a lower flight over the same xz,
  so it returns the candidate surface nearest the previous frame's height (`STAIR.y`). `stairStep()` (after `walker.update`) swaps the
  visible floor once you are past half a storey (`rise/2 + 0.12`, up or down): `I.setFloor`, swap colliders, folks, doors, then
  `walker.teleport(same xz, { keepCamera, keepMotion })` — y shifts by ∓3.3 and the stair geometry of the next floor lines up, so it is
  seamless (no fade). On 5F going up past 0.82·rise → `goDoor(aptOut({ to: 'roof' }))`. In the shaft the camera may rise to 4.6 m.
- walk.js `teleport(…, { keepMotion: true })` keeps the speed (new option; default unchanged).
- 1F has no way down (the down side is walled at zSB).
- Village houses use the same `stairShaft`; they are all 1 floor now, so nothing changes there until they get floors again.

apt-test (31 ok): stairs 1F → landing (1.65 m) → 2F and back down (one floor swap each way, biggest height step 0.019 m per frame, no fade),
no way down from 1F, 2F flat + real 2F balcony (3.3 m), 5F flat without balcony, 5F stairs walk out onto the roof.

## Batch 63 (trial v75): marble, no lift
Nick 2026-11-02: 「公寓改大理石風格／不用電梯」.
- Shell (apt.js): the tile texture is now white marble (`aptMarble(g, w, h, nx, ny, rnd, o)` draws slab-by-slab veins clipped to each slab, seams on
  the slab lines so texture repeats hide behind seams; outside = 2 × 4 slabs of 80 × 40 cm per 1.6 m, roughness 0.32).
- Inside (interiors.js): `surfAtlas` sheet is 512 × 640 (one more row): `marble` (floor, 80 cm slabs, PER 1.6) and `marbleW` (wall, 120 × 60 cm,
  PER 2.4), both drawn with apt.js `aptMarble` (interiors.js imports it; apt.js comes first in the bundle). Lobby, corridors, stair shaft, entry
  and living room: marble walls (material 'floor' = the shiny standard one) and floors; bedrooms keep the per-floor wall colour on a marble floor;
  kitchen / bathroom keep their tiles. Stair treads use `stairShaft(…, { tread: 'marble' })`.
- The lift is gone: no lift room, no `F.lift` (so no lift panel; town.src.js's apt panel code just never fires), the corridor wall where the lift
  door was is solid. Stairs are the only way up (batch 61 walked stairs); the roof is reached from the 5F stairs.
- apt-test (27 ok): lift checks replaced by stairs 1F → 4F (three flights), 4F → 5F → roof, and 5F → 1F (four flights) before leaving; shell screenshot `apt-0-shell.png`.

## Still to do (later batches)
Stairs in every village house to each floor and the roof (some houses 2–3 floors again), different layouts per house, residents moving inside.
