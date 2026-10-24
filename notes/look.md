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
