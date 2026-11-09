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

# Batch 83 (trial v94): the trunk opens like the real car (lid cut out of the body)

Nick 2026-11-09: 「你去查那些車是如何開後車箱的 不是直接在原車加上一片東西」. The batch 81 overlay lid (a paint-coloured board on top of the body) is gone; the moving part is now cut out of the car's own body meshes.

## How each car opens (`TRUNK_KIND` in mart.src.js)
- `trunk` (sedans: gc8, gtr, altis, evo): boot lid hinged just behind the rear window, swings up −1.15 rad. Region: x ≤ xh−0.03, yC ≤ y ≤ h0+0.12, |z| ≤ 0.35 W (taillights at the corners stay on the body). A wing whose centre is in the region rides on the lid.
- `hatch` (yaris, supra, rx7, ae86, civic): whole tailgate incl. the rear window, hinged at the roof edge, −1.25 rad.
- `frunk` (mid-engine: p918, sp3, jesko, chiron, aventador, huayra, laferrari): the storage is at the front (KBB "What is a frunk"); front lid hinged at the windshield base (`xw`: first 0.1 m step from the nose where the top rises > 0.055 m, clamped x1−2 … x1−0.75), +1.1 rad. Button 「打開前車廂」, toasts say 前車廂.
- `swing` (jp4, k2): side-hinged rear door with the spare wheel (like the real Wrangler/Jimny), hinge on the right rear corner, swings 1.75 rad about y.
- `drop` (p8): tailgate hinged at the bottom (bumper top), drops 1.5 rad. Bed: put in without opening, 「放下尾門」/「關尾門」/「放進車斗」.
- `none`: senna (no usable trunk) → no trunk buttons. Ridden vehicles and the monster truck still have none.

## Cut
- `trunkProbe(S)` additionally finds `yB` (bumper top) with horizontal rays from behind (lower half only), `xr` (tailgate face), `yTop`, and per kind `hinge`, `axis`, `ang`, `inR(x,y,z)` (car-local test), `cav` (dark BackSide box for the cavity), `bagAt`.
- `trunkCut(S,P)`: for each body mesh (interior group excluded), triangles whose centroid is in `inR` go to a `lid` geometry, the rest to `rest`. Both share the original attributes (only a new index; Uint32 when > 65535 verts), so mask shaders/uv stay the same. Cached in `S._lidCut`; never dispose the split geometries (shared attributes).
- `trunkSplit(V,on)`: on open, the mesh gets `rest` and a lid mesh (same material, `matrixAutoUpdate=false`, matrix = inv(car.matrixWorld)·mesh.matrixWorld) goes under hinge → inner (offset −hinge). On close, everything is restored (the body is whole again).

## Test
mart-test: GC8 checks the lid is cut (lids > 0, > 300 triangles, body not whole while open, whole again after closing). `MCAR=yaris|p918|jp4|p8` (any car in TRUNK_KIND works) run the trunk part only: kind, angle, cut, put 4 things → 2 bags, close → body whole.
