# 畫質 (第 29 批): three looks — 最真實 / 漂亮 / 順

Nick (2026-10-23): 「畫面風格不要像卡通…模仿仿真遊戲」 → style mock https://claude.ai/artifact/4qQroLLTQSbopBgVqoHeHv
(5 looks rendered in the game). Then 「畫面有辦法比你給的範例更真實嗎」 → look 5 「最真實」 was added. Nick picked it:
「就用5號的真實度」. The mock promised a 畫質 setting because look 5 is heavy. Trial page v47 (with the Neihu house variety,
neihu.md 第 28 批). Code: `src/look.js` (new). Test: `src/look-test.mjs`.

## Levels

| level | name | what |
|---|---|---|
| 0 | 順 | the old look, untouched (cartoon colours, no shadows) |
| 1 | 漂亮 | mock look 3: Sky.js sky with clouds + a PMREM reflection map of it, sun shadows, haze; world-space detail noise in every Standard material (grain on grey, patchy greens, olive tint, tree-crown clumps); smoothed hill/tree normals; old tree crowns replaced by leaf-card trees |
| 2 | 最真實 | mock look 5: level 1 + procedural PBR detail/normal maps (asphalt, grass, concrete) and macro relief on grass/hills, car paint reflects the sky (envMap + clearcoat), grass tufts near the camera, denser leaves, GTAO (half size), a little bloom, vignette |

- UI: fullscreen driving, 「⋯」 → 「✨」 (left of 🎮) → 「畫質 最真實／漂亮／順」 (town.src.js `lookSet`, `lookOpen`; garage.css `.looktog`, `.lookpop`).
  Toast 「畫質：最真實（準備中⋯）」 then 「畫質：最真實」.
- Saved per phone in localStorage `carid.look` (`'0'|'1'|'2'`), like the button size: not in the save, not moved by 搬家, not in the cloud.
- Never picked: `LOOK.pref` = 0 on a software GPU (SwiftShader/llvmpipe, so all the old tests keep running on 順),
  2 if the GPU can render half-float targets (almost every phone), else 1.
- The level is applied during loading (「畫面準備中⋯」 + `renderer.compile`) so the first drive doesn't stutter.

## How it is built

- Only the trip scene (`TR.scene`) changes. `renderer.render` is wrapped: when the trip scene is drawn **to the screen**
  at level > 0, `frame()` runs first (shadow camera follows, tree LOD, grass cells, car paint, tunnel/tower fill,
  incremental scan of new objects), then level 1 renders with exposure 0.45, level 2 runs the post chain.
  Renders into a target (the mirrors) pass straight through: no post, the shadow map from the main pass.
  Any other Scene (garage page, interiors) puts the car paint back and uses the old exposure.
- Everything is undoable (`apply(0)`): sky material, fog colour, lights (hills.js `lights` bases are updated with `setBase`
  so tunnel dimming keeps working), env map, shadow flags (`SHAD`), materials (`onBeforeCompile`/`customProgramCacheKey`
  saved in `userData.lk`), collapsed crown triangles (`TRK`), smoothed normals/colours (`SMO`), Neihu tree geometry/material (`NHT`),
  hidden painted shadows (`st-shadow`), car `shadowSide` (`SSIDE`). The test checksums village geometry before/after.
- Light: sun 4.6 (elevation 38°, azimuth 233°), hemi 0.12, env 0.3, ACES exposure 0.45.
  The reflection map is rendered **without the sun disc** (`showSunDisc = 0`), otherwise the env light carries the sun
  into every shadow and shadows look washed out.
- Shadows: one 2048 map over ±60 m, centre 35 m ahead of the camera, snapped to shadow texels (no shimmer);
  near/far 100/500 around the target with bias −0.0001. `shadowMap.autoUpdate = false`, `needsUpdate` once per main render.
  PCFShadowMap (PCFSoftShadowMap was removed in r186). Ground-like names (`GROUND` regex) receive but don't cast.
  The player's car materials get `shadowSide = DoubleSide`: the bodies are open shells, with the default back-face
  shadow pass only a ring of edge would cast.
- Trees: crowns are found once (`prep`: green, small, connected triangles), collapsed to a point and replaced by
  InstancedMesh leaf cards in 200 m cells (near 110/230 cards per tree, far 36). Neihu `nh-trees-*` swap geometry
  and material (immediately — their original geometry has no normals and would compile the shared leaf material
  as FLAT_SHADED; three doesn't notice that per mesh). crush.js `o.treeK(j, k)` squashes the cards of a crushed tree.
- Cards and grass keep their normal on the back face (`normal = normalize(vNormal)`), otherwise half of them are dark.
- Level 2 post chain (hand-written, no EffectComposer):
  1. scene → HalfFloat MSAA×4 target with a depth-stencil texture (`resolveDepthBuffer`; stencil for the tower shaft hole).
  2. GTAOPass at half size using that depth (`setGBuffer`, normals from depth): no extra scene pass. AO fades out 70–170 m.
     Grass and leaf cards write alpha 0 into the scene target (`lkMask` uniform, only during this pass) and the GTAO blend
     multiplies by that alpha, so AO doesn't blacken dense blades.
  3. UnrealBloomPass (0.07, radius 0.35, threshold 10) at half size.
  4. One quad: ACES + sRGB + vignette.
- Procedural textures (`makeTex`, 512², time-sliced): asphalt chips (Worley), grass blades, concrete. The grass blades are
  rasterised straight into a Float32 array (canvas strokes took ~5 s): 0.8 s for all three on the test machine.
- Tunnels (hills.js `dimK`) and the tower (`indoor` → town.src.js `inTower`): hemi light goes to 1.5 with a neutral colour,
  env +0.3 — the sun is blocked there. The tower's own meshes (`plain` → `GAR.group`) don't get the ground detail patch.
- Mirrors (town.src.js `mirrorSet`): the mirror picture is half-float at level 1–2 (the HDR sky would clip in 8-bit),
  8-bit at level 0 (as before; mirror-test reads it as bytes).

## Cost (SwiftShader, 960×576)

From look-test.mjs (`perf` line), calls / triangles:

| place | 順 | 漂亮 | 最真實 |
|---|---|---|---|
| highway | 260 / 1.33M | 499 / 2.35M | 518 / 2.27M |
| village | | 521 / 2.58M | 540 / 2.68M |
| mountain top | | 539 / 2.24M | 558 / 2.78M |
| Neihu | | 456 / 2.14M | 475 / 2.30M |
| tunnel | | 450 / 1.67M | 469 / 1.95M |
| tower lobby | | | 603 |

Shadows are most of the extra calls (the shadow pass draws casters again). Mirror pass 94 calls.
First switch to 最真實 ~1.6 s (textures 0.9 s, trees 0.3 s), done under 「畫面準備中⋯」 when the level is already picked.
`frame()` JS while driving: 0.23 ms average, ~10 ms worst (grass cells).
On a weak phone 最真實 can be slow: Nick can pick 漂亮 or 順 in ⋯ → ✨.

## Batch 30 — time of day, lamps, wet road (trial v48, 2026-10-24)

Nick's father: 「什麼時候會變晚上的街景?」; decision card → 「自動輪流」. Only levels 1–2 change; 順 is untouched.

- **Clock**: `DAY_MIN = 24` real minutes per game day, read from the phone clock
  (`((Date.now()/60000) % 24) / 24 × 24` hours), so every player sees the same time without any network.
  `look.hour`, `look.setHour(h | null)` (tests pin 13:00; look-test does too, because the sun now moves), `look.night` (lamp factor 0–1), `look.sun` (elevation °).
- **Sun path** (`timeStep`, every frame, cheap): rises 06:00 east, 55° at noon (south), sets 18:00 west; azimuth 360 − (h − 6)·15.
  Factors from elevation: `day` (sun intensity 4.6 × smoothstep(−6°, 8°)), `warm` (dusk colours below 22°), `night` (below −1°…−10°),
  `lamp` (lamps on from +8° down to −2°), `moon` (moon light fades in −6°…−9°). Below the horizon the moon (48°, az 300, bluish 0.5)
  drives the DirectionalLight so there are still shadows. Shadow axes `LX/LY` are recomputed each frame.
- **Sky / env**: Sky shader uniforms follow the sun (turbidity 6→8, rayleigh 1.3→2.0 at dusk); the PMREM reflection map is built per
  elevation band (`h` > 35°, `m`, `l`, `d` < 4°, `n` night) the first time that band is reached and cached (`ENVS`), so no per-frame cost;
  `carEnv` materials get the new map when the band changes. Fog, hemi colour/intensity, env intensity and exposure lerp day → dusk → night
  (`DUSK`, `NIGHT` tables). The night sky is plain dark (no stars yet).
- **Lamps** (both levels, created with `lampsOn()` when leaving 順 and kept in the scene at intensity 0 by day, so shaders compile once):
  4 PointLights parked on the 4 lamp heads nearest a point 12 m ahead of the camera (every 10 frames; `lampList()` = village poles with
  a lamp (village.js now exports `poles`), highway lamps every 60 m from s = 30 on both sides of the median, the 5 parking-lot lamps → 107 heads),
  and 2 SpotLights for the player's headlights placed each frame from the car's matrix (`carDims` → town.src.js `fullBox`).
  Sign materials (emissiveMap === map, intensity < 0.5: village `sign`/`sign2`, Neihu, mountain, offroad) get +0.5 emissive at night.
  The 'glow' lamp heads / light boxes are MeshBasic and already read as lit. Bloom goes 0.07/10 → 0.3/2.2 at night (level 2).
- **Car lamps**: `night(k)` callback → town.src.js `lookNight`: `PAINT_NIGHT` (masks.js, shared uniform `uNight` in the paint shader:
  headlamp mask glows white, tail `red` mask glows red) and `buildLodCar.night(on)` (carlod.js: every live LOD car — traffic, friends — gets
  `lights` on through the existing emissive table). Rendering any other scene (garage page) sends 0 and the world re-sends on the next frame.
- **Wet road** (level 2 only, while `lamp` > 0 — as if it rained at dusk): in the PBR patch, upward non-green ground gets darker (0.62, puddles 0.55),
  roughness 0.30/0.04, and within 1 m of the camera's ground height a planar reflection is mixed in (Fresnel × 0.35 outside puddles, 1 inside;
  `textureLod` blur 4.5 outside puddles). The reflection is the whole scene rendered once more from the mirrored camera into a half-size
  HalfFloat RT with an oblique near plane (`wetRender`), ground meshes (`GND`: GROUND names, `ground`, `lk-grass`) hidden; the shared
  `tRefl` uniform is nulled during that pass (feedback loop). Shadows are computed once per frame (the reflection pass consumes `needsUpdate`).
- Tests: `night-test.mjs` (13:00 / 17:45 / 22:00 at dealer, shop, highway; lamps, headlights, signs, car lamps, wet pass, dark picture, 漂亮 has no
  reflection pass, back to 順 restores everything, clock). look-test pins 13:00.

Cost (SwiftShader 960×576, night-test `perf`, 最真實 calls / tris, "+wet" = the reflection pass inside that total):

| place | 13:00 | 22:00 (wet pass) | 22:00 漂亮 |
|---|---|---|---|
| dealer | 541 / 2.69M | 772 / 4.13M (+472) | 504 / 2.38M |
| shop | 548 / 2.72M | 830 / 4.49M (+507) | 532 / 2.57M |
| highway | 518 / 2.41M | 808 / 4.26M (+504) | 517 / 2.42M |

So at dusk/night 最真實 roughly doubles the triangles (the mirrored scene); 漂亮 costs the same as by day (+4 point lights, +2 spot lights in every shader).
Known gaps: no stars/moon disc, highway lamp pools are faint (heads 11 m up), house windows stay dark, police cars and traffic have no real light cones.

## Batch 31 — smoother day/night, weaker dusk and headlights, a clock, ambient sound (trial v49, 2026-10-24)

The parent's feedback on v48 from the phone: sky changes visibly stepped, the dusk sun was too strong, the headlights blew out the picture
(a white blob in front of the car, worse on the wet road), there was no way to tell the game time, and getting out of the car left silence.

- **Gradual transitions** (look.js): the PMREM reflection map is now cached per 5° of sun elevation (`TD.band` = `b0`…`b10` + `n`) instead of
  5 coarse bands, so a band swap is barely visible (each map is built the first time it is needed, ~30 ms). The 4 pooled street lamps fade
  with camera distance (`LAMP.fade0/fade1` = 50→88 m), so a lamp entering the nearest-4 set starts dark instead of popping on; the set is also
  recomputed at once when the camera jumps > 6 m (teleport, respawn). Traffic/friend LOD car lamps follow the same 0–1 `lamp` factor
  (`buildLodCar.night(k)` scales the emissive table; was a boolean at k > 0.5).
- **Weaker dusk**: sun intensity × (1 − 0.6·warm) (`DUSK.sunK`; at 3.6° elevation 1.4 instead of 3.5), `DUSK.envI` 0.55→0.4, mie 0.006→0.004,
  dusk exposure 0.5→0.45.
- **Weaker headlights / reflections**: own headlights 520→150 cd with physical decay 2 and penumbra 0.7; night bloom 0.3→0.18, threshold 2.2→2.6;
  wet-road base reflection 0.35→0.28.
- **Clock**: a 12 px bar on top of the minimap (`.dv-mapt` in drive.js, `.wk-mapt` in walk.js; `drive.setClock(s)` / `walker.setClock(s)`),
  fed by town.src.js `clockStep` every 15 frames with `☀`/`🌙` + HH:MM of `LOOK.hour`; hidden at level 0 (順 has no day and night).
- **Ambient sound** (sound.js `ambient()`, town.src.js `ambStep` every 6 frames while `DRIVE.on`, disposed on returning to the garage page or
  entering a race scene): wind = looped noise → 380 Hz low-pass with a 0.13 Hz swell (louder on foot: 1 vs 0.55 in the car, 0.3 indoors);
  birds = 2–3-note sine chirps every 1.6–4 s by day; crickets = 4.3 kHz sine gated at 28 Hz by night (`LOOK.night`, 0 at level 0); up to 3
  traffic voices (sawtooth + triangle sub → 320 Hz low-pass → stereo pan) for the nearest `NPC.traffic.cars` within 80 m, gain
  0.26 / (1 + (d/15)²) × speed factor, pitch 48 + 3.1·v Hz. Everything goes through the engine audio master gain (mute/volume as before);
  `S.rec.n` keeps the shared context awake while it runs. All parameters move with `setTargetAtTime`, so the 10 Hz update never clicks.
- Tests: night-test.mjs now 18 checks (bands `b10`/`b0`/`n`, dusk sun 1–2, headlights 150, lamp fade past 55 m, traffic lamps part-way on
  at 17:45, clock text at 22:00 and 13:00 on foot, ambient state driving / in 順 / after getting out; HUD screenshots `nt-hud-22.png`,
  `nt-hud-walk.png`). Cost unchanged from batch 30 (same calls/tris; the audio graph is ~25 nodes).

## Batch 32 — night sky, lit windows, police light, headlight pools, brighter highway lamps (trial v50, 2026-10-24)

The parent asked for the first three items of the "not done" list; this is the night part (`src/look.js`, NSKY constants).
Everything lives in the scene all the time at 漂亮/最真實 and is transparent / intensity 0 by day, so nothing recompiles when night comes.
- Stars: one `Points` (900 points on a 870 m hemisphere, `sizeAttenuation: false`, vertex colours, `toneMapped: false`), re-centred on the
  camera in `onBeforeRender` like the sky dome; opacity = night² × (1 − cave) (none in the tunnel / tower). Moon: a 24 m `CircleGeometry`
  860 m away in the moon-light direction (`MOON.elev/az`, the same light that casts the night shadows), facing the camera; opacity = `TD.moon`.
- Windows: village.js now exports `houses` (the `stHouses` list street.js already had). One additive mesh of quads 6 cm in front of the
  façade: 'door' houses ≥ 4.6 m wide get their two ground-floor windows (60 % of houses, warm HDR colour, the second window 75 %),
  shops get the whole front (85 %, whitish). Opacity = `TD.lamp`. Shuttered houses have no light. Neihu's façades are a texture atlas, so
  Neihu has none (its signs were already emissive).
- Police: police-ai `syncOut` copies `c.lights` onto `npcCars[i].lights`; town passes `police: () => police.npcCars` and
  `traffic: () => NPC.traffic.cars` to `createLook`. One PointLight (70, 34 m, decay 2) sits on the roof of the nearest police car that
  has its lights on (≤ 70 m, fading 45–70), colour red / blue every 0.4 s (0.8 s cycle like the light bar). One light, not two, so the
  material shaders see 5 point lights instead of 6.
- Headlight pools: an `InstancedMesh` of 12 additive 9.5 × 4.4 m ground quads with a radial-gradient canvas texture, one in front of
  each of the 12 nearest traffic cars (`active`, `kind 'car'`, not crushed) and police cars within 110 m; opacity 0.34 × lamp k.
  Recomputed every frame (a selection sort over ~40 cars, no allocation; `POOLC` reused).
- Lamp factor: `lampList` now also fills `lampKs` (1 for poles, 2.2 for the 11 m highway heads, 1.4 for the 6.3 m parking-lot heads), so
  the highway lamps are 396 and actually light the road (the parent said they looked dim).
- Tests: night-test.mjs +6 checks (night objects present but off at 13:00, windows part-way at 17:45, stars/moon/windows at 22:00, highway
  lamps 396 vs village 180, pool count = cars within 110 m and the nearest pool's position, a faked police car → red/blue roof light).

## Batch 34 — longer headlights, 12-minute day, bloom only at night (trial v50, 2026-10-24)

Nick (2026-10-24): 「第一人稱晚上車燈可以照遠一點嗎 不然看不清楚路」, 「一天時間改成12分鐘」, 「面像太陽的時候光線還是有點太亮 至少要讓我看得到前方的景物」.

- **Headlights** (`LAMP.headI/headDecay/headDist/headAim`): the two SpotLights now use decay 0.6 (was the physical 2), intensity 18 (was 150), distance 150 m (was 70) and aim 60 m ahead (was 30). Falloff 18 / d^0.6: 5 m → 6.8 (same as before, so the bumper is not blown out again), 30 m → 2.3 (was 0.17), 60 m → 1.5 (was 0.04). night-test checks the four numbers and the aim distance.
- **Beam patch** (`NS.beam`, `NSKY.beamL/beamW/beamI` = 70 m × 18 m × 0.65): the SpotLights alone could not light the road: at 0.62 m height the beam meets the road at ~1° (grazing), so Lambert gives almost nothing however bright the light (a 200 cd try lit the trees and guardrails 60–100 m away white and left the tarmac dark). So the road gets an additive, fog-free quad from the front bumper to 70 m ahead (canvas alpha: Gaussian across, widening with distance; (1-u)² along, zero at the very start), positioned with the car's world matrix (follows slope), opacity 0.65 × lamp factor, off by day, culled from the wet reflection by back-face (one-sided, seen from below). night-test checks visible/opacity/position at 22:00 and hidden at 13:00.
- **12-minute day**: `DAY_MIN = 12` (was 24); `hourNow()` is unchanged otherwise, so everybody still shares the time from the phone clock. night-test's 順 check computes the clock with % 12.
- **Bloom** strength/threshold now lerp with `TD.night` instead of `TD.lamp`: at dusk the lamps come on while the sun is still up, and with the low threshold (2.6) the sky around the sun bloomed into a white sheet. Now the glow only grows after dark. The dusk sun itself was already weakened in batch 31 (`DUSK.sunK`).
- **Dusk glare** (Nick: facing the sun you could not see anything ahead): `DUSK` turbidity 8 → 6, mie 0.004 → 0.002, mieDirectionalG 0.8 → 0.7 at full warm (`DUSK.g`), exposure 0.45 → 0.38; the wet road (`wetK`, reflection pass) now follows `TD.night` instead of `TD.lamp`, because at dusk it mirrored the bright sky around the sun onto the whole road. Probe shots: out/head/hd-sun-17.3|17.7-highway|dealer-follow|eye.jpg (car pointed at the sun azimuth).
- **Sun disc clamp** (`POST.skyMax = 6`): the real cause of the whole-frame wash when facing the sun at ~10° elevation (17:20 game time) was the Sky shader's sun disc (thousands in linear) fed into the bloom: even 0.07 × a huge value smears the whole screen peach-white (the follow view was as washed as the driver's seat). The visible sky material's fragment output is now `min(texColor, 6)`; the PMREM env sky is untouched (it never had the sun disc). At 4° the sun is already dim in that shader, which is why 17:42 looked fine.
- **Windshield from inside** (masks.js `patchGlass`): the glass layer's alpha grows with its own reflection (`refl × 0.9`), so in the driver's-seat view facing the low sun the whole windshield turned opaque white. Back faces (`!gl_FrontFacing`, i.e. seen from inside) now get colour × 0.3 and refl × 0.2; the outside look is unchanged.
- Test hook: `LOOK._az()` returns the sun azimuth (degrees) so a probe can point the car at the sun.

# Roads and houses more real (batch 35, content 22, trial v51, 2026-10-24)

Nick: 「先把路跟房子做更真」. All picture levels get the texture and geometry changes; 漂亮／最真實 also get the road shader.

- **Road textures** (village.js `roadTex` / `hwyTex`, 512² → 1024², still 10 m per tile so mountain.js' uv assumptions hold; `RU` unchanged): shared `asphalt()` draws large soft tone blotches, two sizes of aggregate, soft wheel-track darkening, oil drips in the tracks, 2–3 repair patches with a dark sealed border, 4–7 wandering tar cracks (dark line + faint light halo), sandy grime along the edges; `paintLine()` draws a line and then wears it (chips showing asphalt, one faded stretch, dirty edges). Everything stochastic is drawn three times (y, y±H) so the tile still wraps along the road. The concrete farm column has expansion joints every 5 m and grass creeping in at the sides.
- **Road shader** (look.js `ROADX`, only on materials with `userData.role = 'road'`: village road/hwy, neihu road, circuit asph, the 400 m strip; `roadOf()` in the cache key): within 170 m: paint (bright, or saturated red/yellow) is mixed toward asphalt by a two-octave wear mask; ridged-noise cracks (`1 − |2n − 1|`, threshold 0.90–0.985, gated by a 20 m-scale noise so only some stretches crack); darker patches (`step(0.64, noise 0.09)`) and ±3.5% tone variation. `concU` (village only) skips the concrete farm column (u ≥ farm start). Roles are explicit so colour guessing is not needed; neihu/circuit paint is a separate material so only cracks/patches apply there.
- **Curbs** (village.js, after the junction slabs): a 12 cm × 30 cm concrete curb in 2 m pieces along both edges of every `main`/`street` road (top + inner face + outer face, `U.conc`, alternate pieces 5% darker). Skipped where `blocked()`: junction slabs (`NBOX`, +0.4 m), within w/2 + 0.7 m of any `drive`/`link` road (shop, dealer, police, gun shop, garage mouths), the big parking lot (+0.6 m), `nearHome(…, 9)` (home 1's apron), the off-road garage door (x −342…−318, z −80…−74), x > −62 (track end) and x < −514 (highway junction). Visual only: no collider, cars and walkers ignore it (the village ground is flat). ~900 pieces ≈ 5.5k triangles.
- **House details** (village.js `house()`, no extra `rnd()` calls — choices use `hash2` of the position so every other random feature stays as before): dark skirting (踢腳, 32 cm, 3.5 cm proud) on the wall stretches of the ground floor (not over shutters/doors/shop fronts), door step, window sill + lintel under/over the two `winP` windows, shutter side rails, a downpipe at one front corner (5-sided cylinder + elbow), a meter box where there is wall (door houses; shutter houses with a gap between shutter and door), a coping slab on the front parapet. ~100 triangles per house.
- **Facades** (street.js `fac`): `bumpMap = tex.fac`, `FAC_BUMP = 0.012`, with `#include <normal_fragment_maps>` replaced so the bump samples the tiled uv (`fract` with the neighbouring sample also wrapped, textureGrad with the continuous gradient) — the grout lines read as grooves. Per-type roughness via `vRect` (二丁掛 0.6, 馬賽克 0.66, 洗石子 0.84, 粉光 0.9) blended by texel brightness (dark grout stays rough). Because the include is consumed, look.js' `PBRN` no longer applies to facades (it only ever affected up-facing / green pixels, so nothing is lost).
- Numbers (probe, 960×576 → 1280×720 shots, 13:00): 最真實 street by the houses 629 calls / 2.94M tris, low road view 494 / 2.09M; 順 same street 334 / 1.50M, low road view 200 / 0.72M.

## Batch 37 — lighter 漂亮 + brighter night (trial v53, 2026-10-25)

Nick: 「漂亮那階不順 有些舊手機跑不太動」 (first said 順, corrected to 漂亮) → chose options 1 2 3; plus 「晚上整體的光線不要太過黑 開車看不太到 不然就是車燈要能照廣照遠一點」.
- **Pixels (漂亮 only, while out driving/walking):** garage.src.html `pxLow` caps the drawing buffer at 0.7 M pixels (fullscreen 1.1 M, small view = DPR); town.src.js `pxStep()` runs in driveStep and on leaving the world, calls `resize()` only when it flips.
- **Shadows:** look.js `SHL[lv]`: 漂亮 1024² over ±40 m centred 22 m ahead, 最真實 unchanged 2048² / ±60 m / 35 m. `shadowCfg(lv)` sets map size / camera and `TEXEL`; called on lights-on and on 漂亮↔最真實 switches. Far objects drop out of the shadow pass by the shadow camera's frustum.
- **Lights (漂亮):** every light costs in every lit shader even at intensity 0, so 漂亮 builds 2 street-lamp PointLights (`LAMP.nLow`), 1 headlight SpotLight centred on the nose, and no police roof PointLight (`NS.pol` null; the LOD police car's own light bar still flashes). 最真實 keeps 4 / 2 / 1. Switching 漂亮↔最真實 rebuilds the lamps (`lampsOff(); lampsOn()`).
- **Brighter night (both tiers):** `NIGHT` hemi 0.55 → 0.95, colour #34405e → #46536f, ground #14161c → #1c1f27, fog #0a0d15 → #161c29, env 0.12 → 0.18, exposure 0.95 → 1.15; moon 0.5 → 0.8. night-test's 22:00 picture mean 24.6 → 31.6 / 255.
- **Headlights (both tiers):** road beam quad 70 → 100 m long, 18 → 30 m wide, opacity 0.65 → 0.8, texture wider near the car (half-width 0.32 + 0.68u) and slower fall-off ((1−u)^1.6); SpotLight distance 150 → 200 m, aim 60 → 70 m, cone 0.5 → 0.72 rad.
- `info()` adds `sh`, `shR`, `nLamp`, `nHead`, `polOn`. night-test checks them (漂亮 2 / 1 / no police light / 1024 / 40 m vs 最真實 4 / 2 / yes / 2048 / 60 m) and `pxLow` on at 漂亮, off at 順.

## Batch 39 — 最真實 goes further (trial v54, 2026-10-25)

Nick: 「最真實還能怎麼讓他跟真實(以後最真實就是不管手機 能做多好就做多好)」 → offered 4, he said 「好 做1234 只做在最真實」. Only LV 2 changes; 漂亮 and 順 are untouched.
1. **Shadows:** `SHL[2]` 2048² / ±60 m → 4096² (clamped to `maxTextureSize`) over ±110 m centred 60 m ahead, `shadow.radius` 3.5 (漂亮 2) — softer PCF edge, shadows reach much farther.
2. **Own car reflects its surroundings:** `CUBE` — a 256² half-float `WebGLCubeRenderTarget` + `CubeCamera(0.5, 450)` 1.1 m above the car; `cubeStep()` renders 2 faces per frame (a full cube every 3 frames) with the car and the grass hidden, then sets `texture.needsPMREMUpdate` so three rebuilds the blurred env. `carEnvTex()` hands the car paint the cube after the first full cycle (sky env before that). Costs roughly 2 extra scene passes per frame.
3. **Supersampling:** garage.src.html `pxHigh` — while driving/walking at 最真實 the pixel ratio is 2 × DPR, capped at 8.3 M drawing-buffer pixels; town.src.js `pxStep()` flips it like `pxLow`.
4. **Walls:** the pbr branch of `COLOR` adds concrete detail on vertical, non-green faces within 90 m (triplanar `tCoA`, `MB.wallS`/`wallK`) plus vertical rain streaks (`MB.streak`); `PBRN` adds the concrete normal within 60 m (`MB.wallN`). The house facade material (street.js `fac`) replaces `normal_fragment_maps` itself, so it gets the colour detail only.
- Default for phones that never chose: `pref` → 漂亮 (`mobile` UA check); desktop with half-float still → 最真實; swiftshader → 順.
- `info()` adds `shRad`, `cube`, `cubeCalls`, `carCube`. night-test checks 4096 / 110 m / radius 3.5, the 2× buffer and the live cube.

## Batch 40 — slower dusk (trial v55, 2026-10-25)

Nick: 「你有用到硬體加速嗎／傍晚變晚上天色變黑的太快」.
- Hardware acceleration: yes — three.js draws with WebGL on the GPU; the APK's WebView is hardware accelerated by default (targetSdk 34, nothing turns it off). Added `powerPreference: 'high-performance'` to the renderer (only matters on machines with two GPUs).
- Dusk: the day is still 12 real minutes with 6 of daylight, but the clock is warped: `hourAt(ms)` = u − `DAY_SLOW`·(6/π)·sin(π(u−6)/6) with `DAY_SLOW = 0.65`, so time runs at 0.35× around 06:00/18:00 and 1.65× around noon/midnight (6, 12, 18, 24 stay fixed). Sun 8° → full night (−10°) now takes ≈ 90 s of real time (was ≈ 37 s). The HUD clock shows the warped hour. night-test checks the clock formula, the dusk length and that daytime is still 6 min.

## Batch 41 — phone 最真實 back to the pre-39 one (trial v56, 2026-10-25)

Nick: 「最真實好像超過我手機能耐了 看能怎樣改善或者回到前一版」. look.js `MAX = !mobile` (same `mobile` check as `pref`, includes the `BeauCarApp` UA): on phones 最真實 drops all four batch-39 additions — shadow `SHL_PHONE` 2048 / ±60 m / 35 m ahead / radius 1, no live cube (`cubeStep` skipped, `carEnvTex` = sky env), no 2× supersampling (town.src.js `pxStep` needs `LOOK.max`), no wall detail (`COLOR(pbr, road, wall)` with `wall = pbr && MAX`; program cache key gets `px`). Computers keep the full batch-39 tier. `LOOK.max` / `LOOK.setMax(on)` (re-runs `shadowCfg`, recompiles the patched materials) let night-test check both paths.
Same batch: site.js checks GitHub for a new APK every 10 minutes instead of every hour (Nick waited for the in-app update bar).
Also batch 41 (same afternoon, Nick 「漂亮的畫質可以再略降一點／畫質直接改成 超高、高、普通」):
- Names: 順 / 漂亮 / 最真實 → **普通 / 高 / 超高** (look.js `LOOK_NAMES`, the ✨ menu buttons, the toast). Code and notes still say LV 0/1/2.
- 高 (LV 1) lighter: pixel cap 0.7 M → 0.5 M (garage.src.html `pxLow`; never below 1 css px), and `COLOR(..., lite)` skips the fine/medium ground noise and the roughness noise at LV 1 (tint, desaturation and leaf cards stay).

## Batch 42 (2026-10-25, trial v56): pick 畫質 on the garage page

Nick: 「在這個頁面就要可以改畫質 剛剛開太高 結果現在可能跑不動 根本進不去遊戲」 (screenshot of the garage page). Mock https://claude.ai/artifact/TLQFrSZLr8ANofjVMfnZsT.

- garage.src.html `#lookRow` under 出門: 畫質 超高／高／普通 + one tip line (`#lookTip`); hidden while driving or racing (garage.css).
- Same setting as ⋯ → ✨ (`carid.look`); `lookBtns` lights both rows.
- Before the first trip LOOK does not exist yet: the tap only saves the choice, and the trip builds that level. The never-chosen default comes from `lookCaps(renderer).pref` (look.js; the GPU and phone detection moved out of `createLook`).
- After a trip LOOK exists: the tap calls `lookSet(lv, true)` straight away.
- night-test sections 0 and 8 cover it.

## Batch 43 (2026-10-26, trial v57): 高 lighter again

Nick: 「畫質"高"再降低一點 能降什麼」. I offered six options and he picked 「123」.

- **1. No sun shadows at 高.** `shadowCfg` turns `R.shadowMap.enabled` and `dl.castShadow` off when the level is 1 and disposes the shadow map.
  - The painted ground shadows (`st-shadow`) stay visible at 高; `visit` hides them only at 超高, and `apply` restores `HIDE` when switching to 高.
  - `info().sh` / `shR` report 0 when the shadow map is off.
- **2. Pixel cap 0.5 M → 0.35 M** (garage.src.html `pxLow`). The ratio may now drop to 0.75 (below 1 = upscaled), so the cap really applies on phones whose screens already exceed 0.35 M CSS pixels.
- **3. Trees are the 普通 trees at 高.** `crownsOn(on, cards)` keeps the smoothed green normals for any level above 0. Collapsing the crowns, the leaf-card cells and the Neihu card swap happen only at 超高 (`CARDS`). `lodStep` does nothing without cards.
- **Tests:**
  - look-test section 8 has a new check; section 11 switches 高 → 超高 → 高; the button labels check now expects 超高/高/普通 (it was still on the old names).
  - night-test: 高 shadow map 0; the pixel cap is 0.35 M plus a 1280×720 check that the ratio goes below 1.
- look-test 18 ok: 高 highway 262 calls / 1.33 M tris (was ~500; 普通 260).

## Batch 44 (2026-10-26, content 25): headlights wider and farther, street lamps fade in

Nick: 「車燈可以再廣再遠一點 路燈照到的時候要漸漸的變亮 不要突然變亮 弄好就可以上線」.

- **Why lamps popped:** every recalculation (each 10 frames or after a 6 m camera jump) moved the PointLights straight onto the nearest n lamps at full strength. The camera-distance fade (50–88 m) did not help, because a lamp often joined the nearest n while it was already well inside 50–88 m (on the highway the next pair joins at about 72 m, roughly 150 of 396 at once; at 高 there are only 2 lights, so it was worse).
- **Fix (look.js `lampPick` / `lampStep`):**
  - Each light keeps its lamp while that lamp is still in the nearest n. The (n+1)-th is also kept when it is less than about 14 % farther (squared distance × 1.3), so two lamps at a tie do not swap back and forth.
  - Changing lamp: the light fades out over `LAMP.down` 0.5 s, moves, then fades in over `LAMP.up` 1.2 s (smoothstep). A free light prefers a slot that is still on the same lamp, otherwise the dimmest.
  - A camera jump over 20 m in one frame (去這裡, going home, lamps just switched on) snaps every light to its place, since the whole picture changed anyway.
  - The camera-distance fade is now computed every frame (it used to step every 10 frames).
- **Headlights (`LAMP`, `NSKY`):**
  - SpotLight decay 0.6 → 0.5, distance 200 → 280 m, aimed 70 → 90 m ahead, cone 0.72 → 0.95 rad. Intensity stays 18, so the front of the car is only slightly brighter (5 m: 6.8 → 8.0), while at 100 m it is about 1.7× (1.0 → 1.74 after three.js's distance window) and at 150 m about 3× (0.42 → 1.24).
  - Road beam patch 100 → 150 m long, 30 → 40 m wide, and the texture fades more slowly along its length (`(1-u)^1.1` instead of `^1.6`).
- **Tests:** night-test `__lampDrive` drives about 60 m up the highway, recording every street lamp light frame by frame. It checks that at least one lamp came on along the way and that no lamp rose by more than 99 (of 396) between frames, at 超高 (4 lights) and at 高 (2 lights). The headlight and beam checks moved to the new numbers.
  - Against the old look.js the same drive rose by 244 (超高) and 396 (高) in one frame, so the check really catches the pop. With the fix: 51.5 and 49.
  - The drive ends with a 1-pixel `readPixels`: swiftshader had about 14 s of queued frames after it, so the next check (1280×720 window) saw no ResizeObserver frame in time. The resize check now waits until the drawing buffer really changes instead of a fixed 300 ms.

## Batch 47 (2026-10-27, trial v60): rain now and then

Nick: 「好 做下雨 偶爾可以讓它下雨 但這樣跑得動嗎?」. Rain exists only at 高 and 超高; 普通 has no weather, the same way it has no time of day.

- **When (look.js `rainAt`):** by the phone's clock, so every phone agrees without being online. Time is cut into 4-minute slots; an integer hash (`hash01`) gives each slot a 25 % chance of rain at strength 0.55–1. The first 40 s of a slot fade from the previous slot's strength, so rain starts and stops smoothly and back-to-back rainy slots join. Over a week: rain about 28 % of the time, about 70 short showers per real day, longest dry spell about 1.5 h.
  - The trial page (`TRIAL_FREE` → `createLook({ trialRain })`) also rains 0.9 from 15 s after the first trip out, for about 3 minutes (`trialK`).
  - Tests pin it: `LOOK.setRain(k, snap = true)` (null = back to the clock). look-test and night-test call `setRain(0)` next to `setHour`, because a clock-based shower would otherwise land in their pixel comparisons a quarter of the time.
- **Raindrops (`rainOn` / `rainStep`):** one mesh, one draw call, 3000 streaks at 高 and 5000 at 超高. Fewer are drawn in light rain (`drawRange`). Each streak is a quad whose position is computed entirely in the vertex shader:
  - it wraps around the camera in a 24 m box, 16 m tall (fading out from 7 to 12 m away; the fog does the far rain);
  - it falls at 9.5 m/s ± 20 % and drifts with a slow wind (a direction per slot, eased over 8 s; the drift is integrated on the CPU so a wind change never jumps the drops);
  - it is stretched along (rain velocity − camera velocity) × 0.04 s, so driving fast slants the rain toward you;
  - it is at least ~1.5 px wide at any distance (`uPx`), otherwise far streaks alias away;
  - near/far fade; in the driver's seat (camera inside the car box) nothing within 2.6 m, so no rain inside the cabin;
  - at night, streaks inside the headlight cone (to 40 m) are lit.
  - Hidden inside tunnels and the tower (`cave`), in the wet-road reflection pass and in the car's cube reflection.
- **Sky and light (`timeStep`, `skyPatch`):** in rain the sky shader (`lkRain`, `lkRainL`) mixes toward one flat gray whose brightness follows the sun height (`TD.rainL` = 0.01 + 0.7 · smoothstep(−4°, 30°)), a bit brighter overhead, keeping ±30 % of the cloud pattern; no sun disc. A first try that just desaturated the real sky failed at dusk: the glow around a low sun is tens of times brighter than the rest, so it stayed a white band and the far hills (fogged, and sheened at 高) turned white.
  - The fog takes the rain sky's horizon gray, so far hills melt into it, and closes in to 60–600 m (from 150–1500).
  - Sun ×0.2 by day (moon ×0.65 at night, so rainy nights are not black); daytime sky light +0.55 and gray; stars and moon hidden; exposure ×1.15.
  - Reflection maps get a rain variant per sun band in 3 steps (`TD.env` = band + `r1`/`r2`). The cache is now LRU with at most 12 maps (one is ~6 MB of GPU memory).
- **Wet road:** gets wet over 35 s, dries over 160 s.
  - 超高: the existing wet-road shader and reflection pass (night-only until now) also run in rain by day. Daytime puddle reflections are dimmed ×0.4 (`wetR`), there are fewer puddles by day (`wetP`) and wobble while it rains (`wetRain`, `wetT`), otherwise the bright overcast sky made the puddles look like snow. After the rain at dusk the reflection is weaker (same white-glare problem as batch 34). Inside a tunnel the road is dry.
  - 高: new `WETL` chunk (uniform `lkWet`): upward, non-green ground ×0.55 darker and roughness 0.34, so it picks up a gray sheen from the sky map.
- **Sound (sound.js `ambient`):** a rain channel (noise, highpass 500 / lowpass 7 kHz, muffled to 1.6 kHz while sitting in the car), gain 0.08 × rain. Birds stop, crickets drop, wind a bit stronger. town.src.js `ambStep` passes `rain` / `rainIn`.
- **Bug found on the way:** in `postRender` the line setting the final exposure had been swallowed by the inline `//` comment before it (since batch 34), so 超高 always used exposure 0.45 (dusk 0.38 and night 1.15 never applied). It now runs. Night at 超高 is a bit brighter than before, as batch 37 intended.
- **Cost (rain-test, 960×576, same frame dry → rain):**
  - 高: +1 draw call, +6000 triangles. Street 272 → 273 calls (1.30 M → 1.31 M), highway 268 → 269, night 275 → 276, dusk 271 → 272. The rain's own JS is about 0.05 ms per frame (look total 0.27 ms).
  - 超高: rain by day turns on the wet-road reflection pass, which until now ran only at night. Street 555 → 813 calls (3.1 M → 4.5 M), highway 580 → 844, dusk 600 → 893. At night (already wet) 847 → 869. So a rainy day on 超高 costs the same as a night on 超高.
  - 普通: nothing (no rain).
  - New reflection maps at the rain thresholds (0.25 / 0.75) cost one PMREM each, a short hitch like the existing sun bands.
- **Tests:** rain-test.mjs, 17 ok (about 17 min). look-test and night-test now pin `setRain(0)`.
