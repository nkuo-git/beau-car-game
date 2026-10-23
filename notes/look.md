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

See the numbers printed by look-test.mjs (`perf` line). Roughly, highway: 順 ~290 calls / 1.4M tris, 漂亮 ~540 / 2.1M,
最真實 ~560 / 2.3–2.9M; tower lobby 最真實 ~690 / 3.1M. Shadows are most of the extra calls (the shadow pass draws casters again).
`frame()` JS averages ~1–3 ms on the test machine while driving (grass cells are the spikes).
On a weak phone 最真實 can be slow: Nick can pick 漂亮 or 順 in ⋯ → ✨.
