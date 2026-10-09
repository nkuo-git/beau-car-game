# 路變大＋越野車什麼都輾 (b9-wide)

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

old-scratch/b8-rel. Nothing was published, committed or pushed, and the 萬能軟體 repo (nkuo-git/carid-pwa) was not touched. One slip: a scratch file
was created in old-scratch/b8-rel/wide-work/ by mistake and removed straight away (b8-rel's content is unchanged).

Nick (2026-10-09): 「改車加上這些變動: 路變大 越車可碾任何東西」. Code marker: `第 9 批（路變大）`.

## 1. Wider roads (×1.5, centerlines unchanged)

**Village (village.js `ROADS`)**

| Road | Before | After |
|---|---|---|
| main | 9 | 13.5 (E0–E1 tapers `[12, 12.4, 13.5, 13.5]` so the circuit gate stays 12) |
| street | 8 / 7 | 12 / 10.5 |
| farm | 6 | 9 |

These were moved out by half the extra width (main 2.25, 12 m road 2, 10.5 m road 1.75, farm 1.5):
- every house `row(...)`;
- the pole lines and `mirrorPole`;
- lamps, flags and signs;
- the convenience store (`村口超商`, −2.25 m);
- the expressway approach;
- the gantry (`G = frame(-485, 0, 8.85…)`);
- the dealer kerbs and fences.

**Other village files**
- **street.js:** the street-name plates, bus stop, booth, bins and scooters are on the new edge, and sidewalks start at the new edge.
- **police.js:** `LOT.z0` is 7.5 (was 6).
- **offroad.js:** the ACCESS road is `w: 9`, `hw = 4.5` and the `onAccess` limit is 4.9. The boards are at z ±9.15.

**內湖 roads**
- **Converter, neihu-conv.mjs:** `const WIDEN = 1.5` is applied in `roadW()` after the 弄 cap, and the data carries `wide: 1.5`, `v: 2`.
- **How buildings were moved back:** buildings overlapping the new road edge are pulled back, with looser limits (`3*WIDEN`, area ratio > 0.45, vertex move < `5*WIDEN`). Ones that cannot be pulled back are dropped. Real OSM shapes are trimmed the same way.
- **Result:** 196 buildings pulled back and 49 dropped (before: 130 and 11). There are 4374 buildings left, plus 288 signs and 422 roads.
- **Landmarks:** the 7 landmark polygons are unchanged. Next to the library and the church, the road is narrowed locally (a new block before 「西邊的入口」):
  - 內湖路一段 15.8 → 15.3 m for 3 segments;
  - 江南街 10.5 → 7.0 m for 2 segments.
- **`signAt`:** it now tries the 4 nearest edges (`signAt1`), which keeps the 港墘站 sign.
- **neihu.js:** `readData()` returns `wide`.
  - Lane counts, the centerline style, red lines and the big-sign test use `r.w / D.wide`, so the marking style is the same as before.
  - **Link road:** `W0` is 13.5, the shoulders are 9, and the edge lines are at ±6.45.
- **Library colliders:** after the narrowing, every wall of 西湖圖書館 could be reached. Before, it had only a central 14×14 box, and cars drove 12 m into it. Now each wall has a 3 m thick inner wall collider, and the round corner is a circle.

**Unchanged:** the expressway (its 3.75 m lanes were already wide enough), the race circuit and the drag strip.

**Everything that reads `V.roads` / `N.data.roads` follows automatically:** traffic, police paths, NPC walk paths, the minimap, the road-name lookup and auto-drive. The garage, shop, dealer and off-road garage driveways still connect (test-b1 / test-b4 drive in and out of all of them).

## 2. Off-road vehicles crush anything (crush.js)

- **The gate is `PERF[cur].offroad`** (`offK()` in town.src.js); today that is only the monster truck. Other cars are unchanged: crush is not even passed to drive.js.
- **What it crushes:**
  - cars, including police cars;
  - lamps, trees, poles, traffic lights, walls, fences and signs;
  - houses and buildings in the village and 內湖, including the landmarks (library and church colliders share `g` = GB−1 / GB−2).
- **What it never crushes:**
  - people and children (`npc` / `person` colliders);
  - anything marked `noCrush`: MRT piers, station columns, station entrances, link-road guardrails and gantry posts, BARS, and everything from village `stripColliders` (circuit / drag strip);
  - the rectangles from `crushSafe()`: your garage, the off-road garage, 阿輝改車廠 (shop), the car dealer, the off-road dealer shed, the gun shop, the police station and its lot, and the temple;
  - boxes longer than 14 m half-size.
- **Enterable houses are crushable.** While a house is flat, its door says 「房子被壓扁了，等一下才會修好」 (town.src.js atDoor).
- **How flattening works:**
  1. On hit, the collider group is marked `crushed` on the original collider (`src`). Groups are the same `g`, plus smaller colliders inside a tall box.
  2. Triangles of the merged world banks that belong to it are picked time-sliced (≤ 1.6 ms per frame, owner = the nearest footprint).
  3. They are scaled down in y over 0.6 s to a low rubble height, and only those ranges are uploaded (`updateRanges`, one range object per segment).
  4. Rubble (InstancedMesh pool of 192) and cartoon dust (pool of 36), a crunch sound, no fire.
  5. 內湖 trees use their InstancedMesh (`c.im`, `ti`).
- **Police cars:** `police-ai.wreck()` squashes the car (scale 1.07 / 0.4 / 1.07), turns off lights and siren, and the officer gets out on the far side and runs ('flee'). This adds crime `crushCop` (+2★, 「你把警車輾扁了！」). The wreck is removed after 20 s. CRIME_GAP and the 3★ max are unchanged.
- **Restore:**
  - each crushed item comes back after the player has been more than 140 m away for 25 s (reverse order, waiting for overlapping later jobs);
  - everything is restored on reset / leaving to the garage page, and on reload.
- **Pedestrians dive away** (npc.js `dive()`):
  - triggered when a crusher is closing in (ahead < max(8.5, 0.9·v), < 2 s away, within the lane);
  - they shout 「哇！」 (a pooled sprite, 4 of them), jump sideways, fall, lie 0.45–0.85 s, get up and flee;
  - children too;
  - if the truck still reaches them, the old push-aside applies; they are never under the wheels.

## 3. Files and anchors (old-scratch/b9-wide)

| File | What changed |
|---|---|
| village.js | `ROADS` widths; the `第 9 批` comments on rows, poleLine, signs, store, gantry; `stripColliders` → `noCrush` |
| street.js | plates, bus stop, bins, scooters, sidewalks |
| police.js | `LOT` |
| offroad.js | ACCESS `w: 9` / `hw = 4.5` / boards |
| neihu-conv.mjs | `WIDEN`, `roadW`, pull-back limits, landmark clearance block, `signAt1` |
| neihu-data.js | regenerated (original kept at wide-work/neihu-data.orig.js) |
| neihu.js | `readData` `wide`; lane markings; `GB` building group ids; `noCrush` on MRT and link-road parts; sign pole `reach`; tree `im`/`ti`; library wall colliders; landmark `g` |
| crush.js | `canAny`, `groupOf`, `bigHit`, `selectStep`, `bigTick`, `restoreJob`, `copHit`, `fxInit`, warm-up |
| drive.js | colGrid `src: c`; crushed check on `src`; `camBlock` |
| police-ai.js | `crushCop`, `wreck()`, `wreckTick`, officer 'flee' |
| npc.js | `dive()`, `fleeFrom()`, `shout` sprite pool, `st.dives` |
| town.src.js | `offK`, `crushSafe`, makeCrush `any` / `protect` / `copWreck`, atDoor toast |
| crush-test.mjs | sections 6–7 (see below) |

No new save fields.

## 4. Re-applying on a newer trunk

1. Diff each file above against old-scratch/b8-rel and port the `第 9 批` hunks.
2. For 內湖, copy neihu-conv.mjs and run `node neihu-conv.mjs` to regenerate neihu-data.js. If the OSM file or landmarks changed, check wide-work/lm-overlap.mjs, conflicts.mjs and colcover.mjs.
3. Build: `node build-art.mjs --yaris && node make-free.mjs`.

## 5. Tests (all run one at a time)

| Test | Result |
|---|---|
| test-b1 | 140 OK |
| test-b4 | 74 OK |
| test-b3 | 56 OK |
| neihu-test | 29 OK |
| circuit-test | 24 OK |
| drift-test | 42 OK |
| free-test | 2 OK |
| crush-test | **48 OK** (was 27) |

The new crush-test checks:
- the GC8 only bumps a house;
- the monster flattens a house, a tree and a pole, then drives on;
- a police car is flattened, giving +2★ and an officer who flees unharmed;
- garage, shop and gun shop are protected;
- an adult and a child dive away and stand again beside the truck;
- a 內湖 multi-box building flattens as a whole;
- crushed things are restored after the player is away;
- roads are wider in the village and 內湖, and the main-road surface reaches ±6.2 m;
- the 內湖 HUD road name is correct;
- village traffic keeps running for 30 s.

Logs are in old-scratch/b9-logs/.

## 6. Performance (renderer.info at the start of the drive, the same 5 spots, b8-rel → b9-wide)

GC8, portrait:

| Spot | Draw calls | Triangles |
|---|---|---|
| village-main | 318 → 308 | 1.278M → 1.241M |
| village-core | 150 → 151 | 1.076M → 1.074M |
| village-west | 218 → 220 | 1.250M → 1.250M |
| 內湖 entry | 182 → 182 | 1.100M → 1.088M |
| 內湖 mid | 215 → 215 | 1.268M → 1.258M |

Monster truck, portrait:

| Spot | Draw calls | Triangles |
|---|---|---|
| village-main | 224 → 217 | 447k → 414k |
| 內湖 mid | 119 → 119 | 415k → 405k |

Landscape is similar: within ±2 calls, with slightly fewer triangles.

Cost of crushing:
- crush.js averages about 0.03 ms per frame;
- picking triangles takes at most about 2 ms in a frame, spread over the frames after a hit (SwiftShader);
- the one-time warm-up is spread over frames (1500 colliders per frame).

## 7. Known issues

- Power wires between flattened poles stay in the air.
- Meshes with a rotated transform are not flattened (mostly the police station and gun shop, which are protected anyway).
- `reach` on 內湖 big sign poles is set but not used by crush.js yet: the overhanging arm flattens only within the margin.
- More 內湖 fill buildings were dropped (49 vs 11) to make room. Real OSM buildings were trimmed and none of the 7 landmarks moved.
- 江南街 and 內湖路一段 are locally narrower beside the library and church, so the landmarks stay in place.
- Other 內湖 OSM buildings still have small pre-existing collider gaps on some edges (19 of 755 road-facing edges, before: 24 of 834).
