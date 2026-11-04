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
