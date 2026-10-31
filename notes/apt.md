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
  skip it. hills.js `homeKeep` flattening widened (R1+20 … R1+34), mountain.js `HOMEPAD` widened west to x −312.5 (home 2 sits at the
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

## Still to do (later batches)
Stairs in every village house to each floor and the roof (some houses 2–3 floors again), different layouts per house, residents moving inside.
