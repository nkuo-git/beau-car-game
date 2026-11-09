# Batch 81 (trial v93): convenience-store shopping + car trunk

Nick 2026-11-08: buy anything in the store, pick it off the shelf yourself, pay the clerk, get caught if you don't pay, pay with race money; put the shopping in the trunk yourself (open, put in, close). Mock https://claude.ai/artifact/92aQZm3v7VrFZPDEmsz6Yx, Nick chose "照這樣做". Open questions in the mock got no answer, so the recommended defaults were used: 9 items, bought things only go into a trunk, only 村口超商.

## Where
- `interiors.js` storeFloor: `F.spots.shop` (9 spots, each with `item`) and `F.spots.till` (one, in front of the counter). The spots map now passes `item` through. The ice-cream spot sits 0.5 m in front of the freezer (closer and the walk grid can't reach it).
- `mart.src.js` (new, appended after seat.src.js in build-art.mjs and build-app.mjs):
  - `martAct(t)` inside the live store: till (1.5 m, only with a basket) → `結帳 · N 元` (clerk greeting toast every 20 s); shelf spot (1.15 m) → `拿 · 名 價 元`.
  - Basket max 12. `martPay(y)`: race money is in 萬 (integer), so the store breaks whole 萬 into `GAME.yuan` (0..9999, saved).
  - `martLeave(H)` from `ldLeave`: unpaid basket → bag + `stolen`, 3 beeps, `police.crime('steal')` (+1★, message in police-ai `CRIME_MSG.steal`), toast after 60 ms (ldLeave clears toasts).
  - `martArrest()` from `onArrest`: stolen items removed from the bag.
  - HUD: `.mt-pill` + `.mt-list` appended to `stage`; the pill is placed under whichever of `.wk-chip/.wk-act/.wk-act2` are visible (re-measured only when that set or the stage height changes). `MART.sig = null` forces a redraw ('' was a real state once and hid nothing).
  - Trunk: `trunkProbe(S)` measures the full car in its own frame (+x forward): local bbox (skips seated riders, wings, hidden meshes), then raycasts straight down every 0.1 m from the rear: `x0` rear, `y` deck height at x0+0.3, `xh` where the height jumps (rear window) clamped to x0+0.55..1.3, `hatch` when the deck is above 72 % of the height, `bed` for p8. Cached on `S._trunk`.
  - `trunkVis(S)`: a paint-coloured lid on a hinge group (sedan: hinge at xh, swings −1.15 rad; hatch: hinge near the roof edge, swings −1.25 rad), a black plate under it, 4 bag boxes (canvas texture). Overlay only: the car's own body stays.
  - `martTrunkAct(t)` from `homeWalk` (outside, on foot, car paused, within 1.25 m of the point 0.55 m behind the rear): 打開後車廂 / 放進去 / 關後車廂 / 放進車斗. `martStep` (after seatsStep) animates, auto-closes at 6 m or when the car moves, shows ceil(items/3) bags, and sets `walker.setAction2(關後車廂)` while open with a bag.
- Save: `yuan`, `trunk{car: [item keys]}` (max 40 per car, load filters unknown cars/keys).
- `town.src.js`: homeWalk → martTrunkAct; live-interior setAction → martAct first; ldLeave → martLeave; onArrest → martArrest; driveStep → martStep.

## Test
`mart-test.mjs` (GC8 full run; `MCAR=yaris` hatch, `MCAR=p8` bed). It moves the car with `drv.teleport` to the street in front of the store. Reachability of the spots uses the floor's walk grid (`I.floors[0].nav`, flood fill from inside the door), not straight-line walks (shelves are in the way).

## Numbers
Trunk open on the street: 227 calls / 0.63M triangles (+6 small meshes). Store till frame: 116 calls / 0.44M.
