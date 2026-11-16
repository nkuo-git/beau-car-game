# Batch 95 (trial v107): pets + 「不抓」 (police don't arrest you)

Nick 2026-11-15: 「可以開槍掃射對方或揍跟撞對方 但不會被抓 / 可以花重金買寵物 / 寵物是那三隻 / 他會一直跟著你 可以幫你打警察或人 / 你開車可以讓寵物騎沙灘車跟在你後面」.
Mock https://claude.ai/artifact/JiamLyxU1TobxZU6T6cgko, Nick 2026-11-16 card 「照這樣做」, then 「做好就上線」 (shipped with v106 as content 48).

Content rules kept: kids and the street animals are never targets (pet, punch, gun), knocked-down people get up (npc.js knock, no blood), police never shoot. The phone build uses real money.

## 🚓 抓／不抓
- A button in the 「⋯」 row (`#copTog`, garage.src.html after the AT/MT button; garage.css `.coptog`, same long `:not(...)` chain as the base rule so the walking / pressed / landscape variants win).
- Per phone: localStorage `carid.cops` = `'off'` (不抓) / `'on'`. Not in the save, not migrated.
- `police-ai.js setLenient(on)`: while lenient `crime()` returns before adding anything; turning it on clears existing stars (`clearStars('警察不會抓你了')`) and sends the cars home. `pet.src.js petTripStart` re-applies it every trip.
- Pressed it reads 「🚓 不抓」 on an orange pill; toast 「🚓 不抓：警察不會抓你了」 / 「🚓 抓：警察會抓你了」.

## 大便龍寵物店 (petshop.js)
- West of the big parking lot, where the last paddy was (village.js: that paddy is popped; `places.petshop`, building kind `petshop`, door ry π/2 = walk −x to enter). In `crushSafe` and `noCrush`.
- Inside is its own scene (like the gun shop): `buildPetShopInterior({ makeAnimal, makeCharacter })`, built on first entry and kept. Three stands (PODS) with the pig, 粉紅, chameleon on display; `zoneAt` → 0/1/2.
- Prices (萬): pig 2000, pinky 2000, chameleon 3000. `petBuy` checks money, pushes to `GAME.pets`, makes it the one that follows (`GAME.pet`), saves.

## Following (pet.src.js, appended after mart.src.js in both build lists)
- `petModeNow()`: `hide` (not on a trip, races, jailed, riding the tower lift), `car` (walker `seat`, or walker `off` while not sleeping / fading through a door / at the gun desk), else `walk`.
- Walking: a trail ring buffer (`petTrail(200, 0.25)`, x/y/z/arc length plus a live point). The pet walks the trail 1.3 m behind (1.8 running), speed ≤ 6.2 m/s. Resets to your feet on a scene change, a jump of more than 4 m, a floor change (|dy| > 1.5) or when 10 m behind. If the floor moves under a standing player (escalator) the trail's y moves too. You jump → it hops 0.12 s later (vy 3.2).
- `walker.shift` (MRT, escalators) is wrapped (`petWrapShift`): the trail and the pet move rigidly with you.
- Name tag sprite 「🐾 名字」 so you can tell it from the street animals.

## Helping you fight
- `doPunch` → `petHit(hit)`: the pet runs at whoever you punched (cop or adult). Guns `onCrime` → `petCrime`: `shoot`/`shootCop` → whoever is at the hit point; `gunfire` → nearest standing cop within 30 m.
- 「🐾上」 under 揍 (`PET_B`, key P, `walkBtns` appends it while you have a pet): nearest standing cop or adult within 14 m, things behind you count 2.2× farther.
- `petAtkStep`: runs ≤ 6.8 m/s, within 0.85 m knocks: peds `NPC.peds.knock(p, dx, dz, 3.5)` + scare; cops `police.knockCop` (down 2.4 s like a punch). Then a 1.3 s angry stomp and back to the trail. Gives up after 6 s or when you go indoors. Pet attacks are not your crime (they never call `police.crime`).
- `petPedOK`: active, not gone, not a kid, not an animal, not sitting / entering a house / diving.

## Riding the ATV
- Z2 LOD (`LOD_CARS.z2`, `buildLodCar('z2', data, look)` with the pet's colour: pig `#f4a9bd`, pinky `#ff5fa2`, chameleon `#7d55d6`), loaded once.
- Kid-sized: the ATV is scaled per pet (`ATV_SC`: pig / 粉紅 0.75, chameleon 1; `atvS(k)`), the pet group gets the inverse scale while mounted so the pet keeps its own size.
- The pet sits on the seat (`PET_RIDE`, ATV-local unscaled: pig [−0.30, 0.875, 0], 粉紅 [−0.32, 0.835, 0], chameleon [−0.25, 0.62, 0]; the seat top is ≈ 0.88; state `sit`).
- Helmet (`petHelmet`, on the head bone, `PET_HELM` centre / radius / tilt per kind): a hemisphere with vertex colours, shell in a colour that shows on that pet (`PET_HELM_COL`: pig orange, 粉紅 blue, chameleon yellow), a white stripe down the middle, a dark rim at the bottom; no visor (it covered the eyes). The white pig with a white helmet was invisible in screenshots.
- Its own car trail (640 × 0.6 m). Gap 6 m + 0.35 × car speed, ≤ 31 m/s, accel 7 / brake 12 m/s². Appears only once the car has driven gap + 1 m (no popping in next to you). More than 220 m behind → jumps to 70 m behind. Brakes for people and cops in front; pushed away within 3.4 m of the car (reversing); `free` mode drives straight at the trail point and re-joins; a 0.3 s check short-cuts when the trail loops back past it.
- Getting out: it hops off next to the parked ATV and runs to you; the ATV stays where it stopped.

## Lobby
- Pets you own but didn't take wander in the tower's 1F lobby (south strip in front of the sofa and west strip in front of the trophy case, via a waypoint), only when you are within 45 m and not in a friend's garage. Walking up to one: 「🐾 帶X出門」 swaps (`petSwap`).
- Garage page (`petsPage` from the page loop): all owned pets wander in `room.group`.

## Save
`pets: ['pig','pinky','cham' …]` (unique, filtered), `pet` (must be in pets; else the first). Old saves have none.

## Test
`pet-test.mjs ../out/pet/pt` (26 ok, about 1.5 min): 0 out with no pet; 1 🚓 in 「⋯」 (no overlap, saved per phone, 不抓 = no stars, 抓 again = stars, switching clears them); 2 walk into the shop, buy the pig (−2000), the chameleon with too little money, the pig follows in the shop and comes out; 3 follow walking / running / jumping / teleport; 4 🐾上 knocks an adult down (0★), kids and street animals never targets, punch → the pet goes for the same person; 5 get in the GC8: the pet on its ATV with a helmet, drive on the 400 m strip, the ATV follows and stops behind; 6 下車: hops off, runs to you; 7 buy 粉紅: plays in the lobby, 「🐾 帶粉紅出門」 swaps; 8 直接回車庫 (`#driveHome`): both pets in the garage page, reload keeps them.
- Test gotchas: walk.js buttons fire on `pointerdown` (dispatch a PointerEvent, `.click()` does nothing); the ATV LOD loads asynchronously, so wait with `waitForFunction(…, { polling: 200 })` between evaluates; get out with `leaveCar()` (the tower roller door button otherwise steals the action).
- Draw calls (390×844, 普通): walking with the pig 168 calls / 0.71M; driving with the ATV 194 / 0.60M (ATV + pet ≈ 6 calls); pet shop inside 8 / 10k; lobby with a pet 96 / 0.42M.

## Batch 96 (trial v108, 2026-11-16): cheaper
Nick: 「寵物太貴了」 (no amount given) → ten times cheaper: pig 200, pinky 200, cham 300 萬 (`PET_KINDS` in petshop.js and `PET_PRICE` in pet.src.js must match). pet-test seeds 650 萬 (pig + pinky = 400, then 250 < 300 for the chameleon).
