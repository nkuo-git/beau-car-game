# Batch 86 (trial v97): three plush animals replace about half the pedestrians

Nick 2026-11-08: 「把很多的行人換成這三隻動物但撞到它們不會被抓 / 要注意三隻動物走路要順暢大約人的一半高 白色那隻用小跳的移動不要跳太高 / 粉色那隻用彩色的腳走 / 全身彩色那隻變色龍用四隻紫色的腳爬 / 注意變色龍是三隻裏最大隻的其他2隻一樣大 還有走路姿勢要自然不要歪歪斜斜的或很畸形」.
The pig and chameleon videos came that day; the pink one on 2026-11-10 (「補上漏掉的那隻動物」), with 「做完全部直接上線」 (no mock round).
The videos (Nick's own plush toys) were only looked at; nothing from them is in the game.

## Model (`src/animals.js`, new; bundled right after character.js)
- Everything is procedural: one SkinnedMesh per animal with vertex colours, plus a soft round shadow quad = 2 draw calls.
  - One shared MeshStandardMaterial with a per-vertex `rough` attribute (eyes shiny), via onBeforeCompile, cache key `beau-animal-1`.
  - Geometry is built once per kind and shared; each animal has its own bones.
  - Skinning: rigid, or a two-bone blend (`mix2`).
  - Bind pose = translations only: `Skeleton(bones, inverse = translate(−abs))`, `mesh.bind(skeleton, identity)`.
  - `boundingSphere` is set by hand (skinned meshes).
- Kinds:
  - **pig**: white, round body and big head, pink snout, small arms and legs.
    - Moves in small hops: 5–11 cm high, hop length 0.3–0.8 m.
    - Squashes on landing; ears on a spring; legs tuck in the air.
    - Only moves forward while in the air: the root's x offset is `(smooth(q) − f)·L`, so its feet stay planted on the ground.
  - **pinky**: long snout, big ears, fleecy bottom, two-segment legs striped green/orange/brown (by model y), striped feet.
    - Biped IK walk (`ik2`, knee forward). Small quick steps, because the legs are short: λ 0.26–0.5 m, duty 0.62 → 0.4.
    - Crouches 3 cm while walking so the planted foot can reach.
  - **cham**: rainbow stripes swept along a Catmull-Rom centreline with a spiral tail (duplicate rings at stripe borders keep the colours sharp).
    - Purple crest, googly eyes that move on their own, four purple two-segment legs with three-toed feet.
    - Trot with diagonal pairs; elbows back, knees forward.
    - The legs are bent in the rest pose (`CLEG`: elbow/knee 0.1 off the line), so the planted foot can reach the ground with a stride.
    - IK subtracts the rest angles (`len.ruF/rlF/ruH/rlH`).
    - Gentle S-sway of the spine; the tail sways.
    - Scale `CHAM_SC` 1.2.
- Sizes: pig 0.83 m, pinky 0.91 m (ears), chameleon 0.98 m tall and 2.06 m long. A person is about 1.7 m.
- Triangles: pig 5.1k, pinky 7.4k, chameleon 15.3k.
- `update` costs about 10 µs per animal per frame.
- API = character.js: `C.group`, `C.update(dt, { speed, state })` with states idle, walk, run, talk, sit, fall, getup, wave (angry), plus `C.height`, `C.radius` and `C.look`.
  - Other fields: `C.animal` (the kind), `C.setLook({ animal })`, `C.dispose()` (keeps the shared geometry).
  - getup (0.9 s) and wave (1.5 s) are one-shots, like npc.js `send`.
  - Falling: the pig and pinky fall on their backs and kick their feet; the chameleon rolls onto its side.
- `src/animal-view.html`: picture page.
  - Usage: `node shot.mjs out.png 'a=all&human=1&v=front34' 1400 700 animal-view.html`.
  - Gait strips: `a=cham&st=walk&sp=0.8&frames=8&fdt=0.07&cols=4`.

## Pedestrians (`npc.js`)
- New options: `makeAnimal`, `randomAnimal`, `animalShare`. town.src.js passes `buildAnimal`, `randomAnimal` and `NPC_ANIMALS = 0.5`.
- `takeChar(kind)`:
  - `'h'` = must be a person: benches, chatting pairs, people bailing out of crushed cars, people walking out of a house (spawnAt/spawnHome).
  - Default: drawn by share. If the pool has none of that kind and no build budget is left this frame, it takes whatever the pool has.
- `prewarm` builds `round(n·share)` animals.
- `p.animal` is the kind ('' for people).
- Animals never:
  - sit on benches or chat;
  - walk to the house you opened (`HOME`, folks.js), and are never handed to onEnter.
- Animals can still walk into ordinary doors (they just disappear, like people).
- Speed:
  - Walking `baseV` is 0.68–0.94 m/s.
  - flee/dodge run at 0.62× a person's speed.
  - Collision radius goes up to 0.45 (chameleon).
- Collider height = `ch.height`; the 「哇！」 bubble is placed at `ch.height + 0.45`.
- Cars still knock them over (cartoon fall, lie, get up, angry wave). `onHit` is still called.

## Police / guns
- town.src.js `npcHit`: for animals, the toast reads 「撞到小動物了！牠會自己爬起來」 / 「小心，有小動物！」 and nothing is reported to the police.
- police-ai.js:
  - `crime('hit' | 'punch', pos)` returns without a star when `pos.animal`.
  - The punch target search skips animals (like kids).
  - `carHit` knocks animals but reports no crime.
- guns.js pedestrian targets skip animals (like kids).

## Tests
- `animal-test.mjs` (Node, 1 s, 24 checks), covering:
  - sizes; the chameleon is the biggest; pig and pinky are the same size;
  - 2 draws each; shared geometry;
  - foot slide while planted < 3 cm (pinky 0.1–0.3 cm, chameleon 0.3–0.9 cm, pig 0);
  - nothing leans to one side; the pig hops ≤ 12 cm;
  - fall, get up, wave; setLook; cost.
- test-b1 section 2c (`B1_STOP=animals` stops after it), covering:
  - about half the people are animals; none sit or chat;
  - they are slower than people;
  - driving into one makes it fall with the animal toast and no star, and `crime('hit')` on an animal gives 0;
  - it lies down and gets up;
  - screenshot `-2c-animals.png` with the three animals lined up in front of the car.
- The human hit check now picks a person (`!o.animal`) and also checks the stars (≥ 2).

## Batch 89 (trial v100, 2026-11-14): shorter chameleon legs, shorter pinky snout

Nick: 「便色龍腳太長」「粉紅色豬鼻子太長」.
- Chameleon: the centre line is 6 cm lower (`CHAM_DY`, unscaled; it fades back to 0 toward the tail root so the curled tail stays above the ground).
  - The lower half of each body ring is deeper by `belly(s)` (up to 7.5 cm between s 0.5 and 1.05).
  - Legs are shorter: shoulder/hip 0.42 → 0.36, elbow/knee 0.22 → 0.19, lx 0.1 → 0.085.
  - Result: the visible leg is about a third shorter (unscaled ~0.35 → ~0.23), and the height is still 0.91 m (still the biggest).
  - Eyes moved down with the head.
  - animal-test 24 ok (cham foot slide 1.0 cm at 0.85 m/s, limit 3 cm).
- Pinky: the snout sticks out 9.5 cm past the head instead of 15.5 (cap to x 0.19, nose at 0.233).

## Batch 96 (trial v108, 2026-11-16): chameleon legs shorter again, pinky nose shorter again
Nick: 「便色龍腳短一點 / 粉紅豬鼻子太長了」 (again after batch 89).
- Chameleon: `CLEG` shoulder/hip u 0.36 → 0.27, elbow/knee l 0.19 → 0.15; `CHAM_DY` −0.06 → −0.07; `belly` 0.075 → 0.115. Leg showing under the belly 0.22 → 0.17 (hind 0.20 → 0.15, unscaled), and the upper leg seen from the side is a lot shorter. Back height 0.90 m (pinky with ears 0.91; animal-test allows 2 cm, so the chameleon still counts as the biggest; do not lower the centre line further without raising something else). Stride and lift × `LEG_K` 0.78; sit drop −0.12 → −0.10 so the belly stays off the ground. animal-test foot slide 0.8–1.4 cm (limit 3).
- Pinky: the whole nose (cap, pad, nostrils) moved 4 cm back into the head along its slope (`NB`): the part showing goes 9.5 → 5.5 cm; length 0.43 → 0.39 m.
- Before/after: /mnt/project-files/car-game/animals/animals-v108.jpg.

## Batch 97 (trial v109, 2026-11-17): chameleon legs shorter again, all three cuter
Nick: 「變色龍腳變短」「所有寵物便可愛一點」.
- Chameleon legs: `CLEG` shoulder/hip u 0.27 → 0.21, elbow/knee l 0.15 → 0.115, lx ±0.085 → ±0.075; `belly` 0.115 → 0.155 (rounder belly, back height unchanged at about 0.90 m, still the biggest of the three); `LEG_K` (stride) 0.78 → 0.64. The leg showing under the belly is about 12 cm (was 17).
- Cute faces (new helpers after `cap`: `onEll` = a point, normal and tangents on the head ellipsoid; `decal` = a flat ellipsoid or any geometry stuck on that point; `cuteEye` = a big glossy black eye with two white glints; `smile` = a small torus arc):
  - pig: bigger eyes with glints, pink blush on both cheeks, a small smile under a slightly smaller, lower snout;
  - pinky: bigger eyes with glints, blush;
  - chameleon: bigger pupils with glints, a smile along the snout, pink blush.
  These are the same animals everywhere (street, MRT, pets).
- Triangles: pig 6.3k, pinky 8.5k, chameleon 17.0k (animal-test limit 18k); still 2 draw calls each. animal-test 24 ok.
- Before/after: /mnt/project-files/car-game/animals/animals-v109.jpg.
