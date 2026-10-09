# Adding a car to the 3D garage (contract for car builders)

Nick (the user, writes Traditional Chinese) has a 3D garage page (claude.ai artifact) for his tuning game.
Every car is built **in code from Nick's photos** (no downloaded models: the container cannot reach model sites).
His bar: 「長得跟真車一樣」 (must look like the real car) and rotatable 360°.
The best worked example is the Nissan R34 GT-R: `gtr-body.mjs`, `gtr-look.js`, `GTR_SPEC` in `supra.js`.
Read those three plus `parts.js`, `masks.js` (look at the shader in `patchPaint` to see what each mask channel does)
and `body.mjs` (helpers `curve, sdf2d, look, smin, smax, rbox`) before you start.

Directory: this repo's `src/` folder (called `SUPRA3D` below; it used to be a scratch folder).
Reference photos: the 萬能軟體 Claude project's files `tune-game/ref/` — modelling reference only, never put into the game.

## Rules
- **Do not edit any shared file** (body.mjs, masks.js, parts.js, supra.js, gtr-*, garage.src.html, build-art.mjs,
  view.html, cview.html, make.mjs, make-car.mjs, camfit.mjs, shot.mjs, overlay.py, check-bundle.mjs).
  Other agents are building other cars in the same folder at the same time. If you truly need a shared change,
  describe it in your final report instead.
- Only create files whose names start with your key (`<key>-*.js|mjs`, `body-<key>*.glb`, folder `<key>3d/` for
  scratch work: crops, fit scripts, renders).
- No network access is needed or available for models/photos. Do not download anything.
- Code comments in Traditional Chinese (match the existing files). Keep lines/code style like gtr-*.
- CPU is shared (4 cores, 5 workers). Mesh at h=0.03 while iterating on shape, h=0.016 for the final mesh.

## Coordinates
Meters. x forward (nose at +x), y up (ground y=0 at stock ride height), z to the car's RIGHT side.
Center the car's length on x=0 (nose ≈ +L/2, tail ≈ −L/2). The body is mirror-symmetric in z; meshes store the right half.
Photo camera params `c = {a, d, h, tx, ty, fov, rl}`: camera at `(tx + cos(a)·d, h, −sin(a)·d)` looking at `(tx, ty, 0)`,
`fov` = vertical field of view in degrees, `rl` = image roll in degrees. a>0 → camera on the car's LEFT (z<0);
a=0 front, a=90 left side, a=180 rear, a=−90 right side.

## Tools
- `camfit.mjs`: `setSize(W,H)` (the photo's pixel size), `proj`, `back` (pixel → plane), `hit(px, c, sdf)` (pixel → body
  surface point + normal), `ratioAt`, `fit(pts, ratios, lo, hi)` (fit a camera from 3D↔pixel pairs; pts may be a function
  of c so you can fit extra unknowns such as the plate position). Good constraints: wheel centers (rim-lip ellipse
  centers), tire contact points, license-plate corners (EU 520×110 mm; Italian front 360×110; JP 330×165; US 305×152),
  known height/width/wheelbase, and rim ellipse minor/major ratio = |view·z|.
- Mesh: write `<key>-body.mjs` exporting `BOUNDS = [x0, y0, x1, y1, zmax]` and `makeSDF()`, then
  `node make-car.mjs <key> 0.016` → `body-<key>.glb` + `body-<key>-q.glb` (keep the -q file under ~2 MB).
- Render: `node shot.mjs out.png 'car=<key>&v=photo1' W H cview.html`
  (`v` = a camera from your `<KEY>_CAMS`, or side|front|rear|top|front34|rear34|low|custom&a=..&d=..&h=..&tx=..&ty=..&fov=..&rl=..;
  extra params: bg=none (transparent, for overlays), paint, kit, wing, liv=0|1, ride, rim, caliper, studio=dark, tint).
  One Chromium launch per shot (5–30 s).
- Overlay on the photo: `python3 overlay.py photo.jpg render.png out.png 0.55` (also writes out-side.png).
- Bundle check: `node check-bundle.mjs <key>-look.js <key>-spec.js` must print `bundle ok`.

## Files you deliver (all in SUPRA3D = src/)
1. `<key>-body.mjs` — SDF body (node only). Side/plan/front profile extrusions intersected and rounded, a separate cabin,
   wheel arches cut out, arch lips, recesses for intakes/grilles (see gtr-body.mjs). Surface features that are only
   color (windows, lights, grille mesh, panel gaps, vents) belong in the masks, not the SDF, unless depth really shows.
2. `<key>-look.js` — `export const <KEY>_LOOK = (() => { ...; return { side, rear, top, fronts: { base: front },
   livery, frontLivery, livDefault, nose: () => 'base', U: { uXr, uXf, uFx, uRx, uWell, uWellR, uGlassY } }; })();`
   same structure as GTR_LOOK. Mask channels (see masks.js `patchPaint`): side R=side glass G=black B=gaps;
   front R=lamp chrome/lit G=black B=amber A=lens-dark / mesh; rear R=red lamp G=black B=reverse lamp A=gaps;
   top R=matte G=black B=gaps A=glass (windshield/rear glass). `livery(side, style)` returns a canvas (BOX.side)
   drawn per style key (`'none'` is handled by the garage), `frontLivery(style, nose)` likewise (BOX.front).
   Place features by ray-casting photo pixels onto your SDF (`camfit.hit`), like gtr3d/hit.mjs did.
3. `<key>-spec.js` —
   - `export const <KEY>_SPEC = { look, paint, metal, seat, wheels: { xf, xr, RF, RR, rimF, rimR, trackF, trackR, wF, wR, style },
     mirror(paint, mats, s), wings: { stock: fn, ... }, wing, interior: {...}, build(body, paint, mats) => (kit, ctx) => {...}, kit }`
     (`R`/`rim` also accepted when front = rear). `style` may be a function `(rim, w, mats) => THREE.Object3D` that builds your
     own spokes (outer face toward +z, use mats.chrome for the rim-colored parts so the garage's rim color works; see
     multiSpoke in parts.js); set `fn.capInset` for the center cap depth. Custom parts (mirrors, wing, exhaust, diffuser,
     splitter) are functions in this file; reuse parts.js ones when they fit (gtWing, lip, exhaust, aeroKit).
   - `export const <KEY>_CAMS = { photo1: {...}, photo2: {...} }` — your fitted photo cameras (for cview.html).
   - `export const <KEY>_GARAGE = { name, sub, paints, opts, state }` for the garage page, e.g.
     `{ name: 'Nissan Skyline GT-R', sub: '… · 3D 試做版', paints: [['#1d4fc9','灣岸藍'], ...6–9 real colors, first = photo car],
       opts: { wing: [['stock','原廠'],['none','不要']], kit: [['stock','原廠'],['track','賽道']],
               height: [['0','原廠'],['-0.03','降低'],['-0.05','貼地']], livery: [['xxx','名稱'],['none','不要']] },
       state: { paint, rim: 'chrome'|'gunmetal'|'black'|'gold'|'white', caliper: '#hex', wing, kit, height, livery, tint: 'light' } }`
     Labels in Traditional Chinese. (A 寬體/widebody kit will be added to every car later by someone else; do not build it.)
   Imports: one line each, only from `'three'`, `'./parts.js'`, `'./masks.js'`, `'./<key>-look.js'`.
4. **Bundle rule**: the garage page concatenates masks.js, gtr-look.js, parts.js, supra.js and every car's look/spec file
   into ONE module after deleting lines that start with `import ` and the `export ` keyword. So use only `export const` /
   `export function`, and every other top-level name must start with `<KEY>_` (or live inside an IIFE).

## How to work (what worked for the GT-R)
1. Look at the photos closely (crop + zoom with PIL, draw a pixel grid) and write down the car's real dimensions.
2. Fit each photo's camera (camfit.fit). Aim for a few pixels of error.
3. Build the body SDF; render with the photo camera (bg=none) and overlay on the photo; fix silhouette, wheel arches,
   greenhouse, nose/tail shape until they line up. Iterate several times.
4. Masks: windows, lights, grille, intakes, vents, gaps, badges. Then parts: wheels (the real design), mirrors, wing, exhaust.
5. Check side, front, rear, top, front34, rear34 and a dark-studio shot for holes, seams, z-fighting, black blotches.
6. Run the bundle check.

## Final report (your last message)
Files created, `<KEY>_CAMS`, the car's dimensions used, which options/liveries exist, 3–4 paths to final images
(photo overlays + a front34 and rear34 render), and an honest list of what still does not look like the real car.
