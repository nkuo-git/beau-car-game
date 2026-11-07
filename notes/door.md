# Live interiors: real windows, doors you open (batch 65, trial v77)

Nick 2026-11-04: 「所有建築的窗戶真的可以看外面 門也要自己開 每棟都可以上每層樓」 + 「每棟房子裡的人會進出 會動 / 公寓不要有人」.
Plan told to Nick (three steps, each to the trial page): 1 windows show the real outside + doors you open (this batch), 2 every building can go up each floor, 3 residents walk around and go in/out. Village buildings first; Neihu later. Decision card 透天厝幾層: Nick chose 「1 層＋頂樓」 on 2026-11-04 (step 2: houses stay 1 floor, stairs up to the roof).

## What changed
- `interiors.js` `buildInterior(b, { live: true })`:
  - no painted window views (`viewBand`), so the window holes are real holes;
  - the front door leaves (hinged glass doors) and the store's sliding door are moving pieces (`F.moving` → `movingPiece`, `I.setDoorT(t)`, `I.doorCols(t)` = leaf colliders in world space);
  - the outer-wall door openings are recorded as portals (`I.portals`: world `a`, `b`, `y1`);
  - the colliders that used to block the exits (`colBox(..., xb = true)`) are dropped.
  - `I.doorStyle`: `hinge` (houses, farmhouse, apartment: 「開門」), `auto` (store: slides open within 2.8 m), `open` (shop fronts `b.front === 'shop'`, temple).
- `town.src.js` LD module (before `warmHouses`):
  - outside: `ldScan` finds the door you stand at (`interiorFor(b).enter` rect, lateral `hx+0.6`, depth −0.6…2.4); 「開門」 (`LD_OPEN`) builds the interior (`ldBuild`), switches the building's village box colliders off (`c.off = true`), adds the interior colliders (`ldcols`) and leaf colliders (`ldleaf`), and opens the door (0.6 s, smoothstep). Auto and open styles build as soon as you are at the door.
  - crossing the facade (`lz < hz − 0.12`) = `ldEnter` (no fade: `indoor = { …, live: true }`, character into the interior scene, `houseSet(null)` keeps your position); back out (`lz > hz + 0.12`) = `ldLeave`.
  - inside, the live front door is not a walk.js door (`ldExits` filters `to: 'outside'`); near it the button is 「開門」 again if it has closed.
  - while the building is built its wall box is off, so walk.js treats the doorway as open and leaves it out of `walker.doors`; `ldDrop` calls `walker.setDoors('village')` again (outside, not on a roof/balcony) so the door is back (the 「按「開門」」 hint) after you leave.
  - the hinged door closes 0.8 s after you are 3.2 m away; the building is put away (`ldDrop`) when the door is shut and you are 6 m away (22 m for auto/open), when you drive, on `leaveHouse`/`aptOut`/trip end.
  - drawing: inside (`ldIndoorDraw`) = the village with the camera lifted to the building's real height (`b.y + floor·3.3`) → `clearDepth` → the interior (`LOOK.raw`, no look-wrapper side effects). Outside with the door open (`ldPortal`) = the interior drawn to a render target (0.7× the canvas) from the same camera (y − b.y; you are borrowed into `LD.proxy` so you show inside too) and a portal quad in the village sampling it by screen position, depth-tested against the world; skipped when the quad is off-screen.
  - if the village pass was not drawn this frame (`renderer.info.render.frame` did not move — the tests' `__noDraw`), the interior is not drawn on top either.
- `apt.js`: the front-door glass and its middle bar are their own InstancedMesh (`apt-door`, same material as `apt-glass`: shells are now 6 InstancedMesh). `aptHide(slot, door, glass)` zero-scales that apartment's instance: door glass while its door is open or you are inside, all window glass while you are inside (the shell's glass boxes are opaque).
- Apartments have no residents (`houseFolks` only for kind `house`).
- `look.js`: `LOOK.raw(sc, cam)`.
- Balcony and roof doors (`aptOut` / `aptIn`) still use the fade.

## Numbers (swiftshader 390×844, 普通)
- inside a house: the house pass 12 calls / 11.6k tris; whole frame (village + house) about 102 calls / 0.41M.
- apartment lobby (building pass) 14 calls / 11k tris.

## Tests
- `door-test.mjs` (new): house (closed door holds, 「開門」, portal shows the inside, walk in/out with no fade, the doorway from inside shows the street, door closes and the building is put away, wall box back), store auto door, shop front, apartment (no people, glass hidden/restored), summit apartment (heights), 高 and 超高.
  Pixel checks compare the screenshot at the doorway with the same view drawn alone (village only / interior only with a magenta clear); the walker is shrunk for those because walk.js resets `visible` every frame.
- `apt-test`, `test-b1`, `test-app-b1`, `test-b3`: `H.toDoor` presses 「開門」 and walks in for buildings with `interiorFor`; `H.toExit` walks out of a live front door (pressing 「開門」 if it closed); `inInfo.doors` ignores the live front door.
- `test-app-b1` runs on `docs/`: its new checks only pass after the site is rebuilt with this batch (上線).

# Batch 66 (trial v78): walk up to the roof of every village house

Nick 2026-11-04 picked 「1 層＋頂樓」 for 透天厝: houses stay one floor, and the stairs go up to a walkable roof. Step 2 of the plan in this note's first part. Only village houses built by `village.js house()` (kind house/shop, `b.roof`); the farmhouse, temple, store, apartment (its roof keeps the fade) and Neihu are unchanged.

## What changed
- `village.js house()`: the old random roof hut / water tank is replaced by a stair hut right over the interior stairwell (`hutSS` = the stairs' side: away from the door, or a position hash when the door is in the middle; same formula as `interiors.js houseInfo`, written to the building as `b.ss`). Hut = concrete box `[stairwell x ±0.12, zSB−0.11 … zP]`, 3.15 m high, a dark doorway on its back face (only the outward face: from inside it does not block the view), a water tank on top (`roofR` keeps the rnd order). The building record gets `ss`, `roof: true`, `hut` (local rect, for the test).
- `interiors.js`: with `live` and `b.roof` a house gets one more floor, `roofFloor(H, n)` labelled 頂樓: the stair hut inside (stairs going down, lamp), a doorway in the back wall (`out: -1` → a portal), and parapet colliders round the roof (1.2 m). `F.roof = { hx, hz, X0, X1 }`; `I.roofFl` = its index (−1 = none). The 1F stairs now go up (`stairShaft` up/down from the floor count).
- `town.src.js` (LD, `LDR = { on, y, dist0 }`):
  - walking up the stairs swaps to the 頂樓 floor like any other floor (no fade).
  - on the 頂樓 floor, stepping out of the doorway (`lz < zSB − 0.25`) = `ldRoofOut`: back to the village scene, ground height = roof (`walkWorld` heightAt: `LDR.on && ldOnRoof` → `LDR.y`), colliders = village + this floor's (heights shifted to world: the camera line uses world heights, otherwise the camera went through the hut), no doors, no car reach.
  - walking back into the hut (`lz > zSB`, between the stairwell walls) = `ldRoofIn` (indoor again on the 頂樓 floor).
  - `ldStep` returns right after `ldRoofOut` (otherwise the "door shut and 6 m away" rule dropped the building the same frame and you fell to the street); far from the house (teleport, 去這裡) = `ldDrop` → `ldRoofDrop`.
  - portals: `ldQuads` makes quads for floor 0 and the roof floor (`userData.fl`); `ldPortal` on the roof draws the interior from the roof height and shows only the roof quad.
  - the front door closes behind you as before; inside, 「開門」 by the door opens it again.
- Known: right at the doorway the camera can trail outside the hut for a moment, and the interior is drawn over the village (same x-ray as the front door since batch 65).

## Numbers (swiftshader 390×844, 普通)
- on the roof looking at the hut doorway (village + hut interior through the doorway): about 98–130 calls / 0.39–0.53M triangles.
- the 頂樓 floor itself: 4 calls / 4.6k triangles.

## Tests
- `door-test.mjs` section 3b: all 81 village houses have 1F + 頂樓 and the hut sits over the stairwell (`b.hut` vs `F.stair`, 2 cm); up the stairs (no fade, height smooth), out onto the roof (world scene, y = b.y + 3.3), the parapet holds (back, both sides), the hut doorway shows the stairs (pixel check vs the interior drawn alone from the roof height), back in, down, 「開門」, out of the front door. 31 ok.

# Batch 70 (trial v82): residents who move about and come and go

Nick 2026-11-04 「每棟房子裡的人會進出 會動／公寓不要有人」; 2026-11-07 「第二項可以做了」, mock https://claude.ai/artifact/LZZ8z4aRBsKmvnPMCp2qKQ, card 「照這樣做」. Step 3 of the plan at the top of this note. Village only (Neihu later).

## What changed
- `folks.js` (new, `window.createFolks({ I, b, scene, makeCharacter, randomLook, hooks })`): the residents of the one built (live) building, `LD.folks`.
  - Per floor, lazily: a seeded rnd per building (same people every visit): houses/shops 1–3 (the shop's boss counts as one and never leaves the counter), temple 0–2 praying, apartment none. People are placed on the floor's `spots` (sit / stand / pray / counter).
  - Walking: `interiors.js` now exports each floor's `nav` = the 0.1 m occupancy grid `walkInit/walkSync` already build for the player (person radius 0.32 baked in); `route()` = BFS (4-neighbour) from the nearest free cell (≤1.2 m) to the goal's, then string-pulled with a 0.05 m line-of-sight test; the last point is the exact spot. ~0.1–0.5 ms per path.
  - Cycle: sit 15–60 s / stand 4–20 s / pray 8–28 s → pick another free spot (`next`) or, on floor 0 with a `leave` hook, 18 % walk to the inside door point (`doorPts()`: portal centre ±0.7 m inside / 1.0 m outside, towards the floor's centre), ask the door to open every frame (`hooks.openDoor`), walk out to the outside point and hand over to npc.js (`hooks.leave(look, wx, wz, heading)`); on failure they stand there 20–40 s and try again later.
  - Yielding: a walker stops when the player is within 1.05 m ahead (or another walker within 0.6 m, lower index wins); after 2.5 s waiting it re-routes.
  - `arrive(look)`: a new resident at the inside door point (same look as the pedestrian), who stands 0.3–0.8 s then goes to find a spot.
  - `colliders`: circle colliders of the standing/walking people on the current floor, pushed into `walker.setMovers` in `npcStep` so they block you; sitting people don't.
  - Test hooks: `_leave(f)`, `_route`, `_free`, `_nearFree`.
- `npc.js`: `onEnter(p, d, near)` hook for the `enter` mode and (near) for a `walk` toward `HOME` within 4 m: `true` = the house took the person (released, `st.handed`), `'wait'` = stand at the door until it opens (`p.waitDoor`, animation idle), else walk in and vanish as before. `setHome(b)` = the built building: `newGoal` sends 50 % of people in its component (8–150 m) there. `spawnAt(x, z, heading, look)` = a resident coming out becomes a pedestrian at the door (`st.fromHome`), `spawnHome(look, back)` (test) = a pedestrian from a nearby door walking to HOME. Both use `freeOrFar`: when all 14 slots are busy the farthest walker (>25 m from you and from here, not sitting/talking/entering) is recycled (`st.recycled`); `st.lastFail` says why a spawn failed.
- `town.src.js`: `LDF_HOOKS` (door = `LD.t`, openDoor = `LD.hold = 0.6` + hinge `want = 1`, player = walker position, leave = `NPC.peds.spawnAt`); `npcEnter(p, d, near)` opens the door within 3.5 m, returns `'wait'` while a hinge door is < 0.6 open, `true` once the person is at the door line (`LD.folks.arrive`). `ldBuild` creates the folks (not for apartments) and `setHome(b)`; `ldDrop` disposes; `ldStep` ticks `hold`, keeps a hinge door from closing while `hold > 0`, calls `LD.folks.update(dt)` after the door animation and `setFloor` when you change floors. The old static `houseFolks()` is gone (`indoor.folks` only holds the police station's people now).
- `build-art.mjs` / `build-app.mjs`: `folks.js` after `interiors.js`.

## Numbers (swiftshader 390×844, 普通)
- inside a house with 2 residents: house pass 13 calls / 19k tris, whole frame 218 calls / 0.54M; `folks.update` ≈ 0.02 ms per frame; creating a building's residents ≈ 8 ms (characters).

## Tests
- `folks-test.mjs` (new, 18 checks, ~1 min): every village building gets residents off-line (90 buildings: counts, boss at every counter, nobody standing in a wall, everyone can route to the door, apartments none); walk into the nearest house (residents in the house scene, movers); told to move → someone walks, never through walls, settles again; you stand in his way → he waits; forced leave → door opens by itself, he becomes a pedestrian with the same look, door closes again; `spawnHome` → door opens ~3 m before he arrives, he becomes a resident with the same look and goes to find a spot; draw calls / update ms; house put away and repopulated the same; shop boss stays at the counter; apartment has nobody and is not a HOME.
- Gotchas: `window.__IN()` is a snapshot — re-call it after walking in (stale `indoor`); a pedestrian slot object is reused as soon as it is released, so "is he gone" must be checked by position/look, not by `p.gone`.
