# Seats — every seat can be sat in (batch 57, trial v70)

Nick 2026-10-30: 「車子的每個位子都可以坐」. Mock `/mnt/project-files/car-game/seats/seats-v1.jpg`
(source `seats/src/mock.html`), card answer 「好，照圖做」. Then 「你去網路上查有一些車本來就只有兩個座位」:
seat counts follow the real cars.

## What the player sees
- Walking next to your own car: 「上車」 (drive, as before) and a new dark pill 「選位子」 below it
  (walk.js `setAction2`, `.wk-act2`). Tap → 「要坐哪裡？」: the car seen from above, nose up, one orange
  button per seat on its real side (GC8 is right-hand drive, so 駕駛座 is on the right); 駕駛座 says 「（開車）」;
  grey = someone sits there (name), yellow = you; caption 「點一個位子就走過去坐」.
- Driver's seat → the usual drive. Any other seat → you walk to that side's door, sit, and the car does not move
  (the drive is paused like after getting out; engine off). HUD: 「換位子」, 「下車」, eye button top right
  (first person from that seat's eyes ↔ outside orbit camera; drag to look / orbit; remembered as `SCAM.pref`).
  First person keeps the rear-view mirrors live (town.src.js `mirrorStep` want). 「換位子」 → 駕駛座 = drive
  (resume, engine on, camera mode follows the eye toggle).
- Driving in the chase view you now see yourself in the driver's seat, hands on the wheel turning with the steering
  (`mySitOn` / `mySitSteer`); first person hides it (no head in the way). Z2 keeps batch 56's rider; monster truck
  has no cabin → no seats.
- Shared world: a friend's car that is parked (he walks, `pk`/`pv`) or stopped (he drives, |v| < 1) within 2.4 m
  → 「選位子」 → picker 「要坐X的車哪裡？」 (driver's seat grey with his name) → his phone gets the invite card
  「🚗 X想坐你的車 / 副駕駛座（你開車，他坐著）」 好／不要 (same path as the doorbell: `matches/{id}` kind `ride`
  + `world/ch/{to}/{from}` with `s`, `k`; blocked / invites-off people can't ask; no rule change needed).
  好 → you walk to his door and sit; your own car is parked where you left it (`borParkMine`, sent as `pv`);
  his light car is swapped for the full model (you can see the cabin), wheels roll / steer from his movement;
  top-left pill 「🚗 坐在 X 的車上」; 下車 only when the car is stopped (button greys while moving); 換位子 any time.
  He goes home / races / leaves the world / changes car / disconnects → you are put out next to his car with a toast.
  The owner sees 「🚗 X坐上你的車了」 / 「X下車了」 and the rider sitting in his own car; everybody else sees riders
  (and drivers) seated inside the cars (`seatPeers`: `P.chr` parented into the car body with `seatPlace`).

## Code
- `cabin.js` (batch 57, committed before this note): rear benches, `cabinSeats(key)` → per-seat `{ n, drv, rear, mid,
  hip, eye, side, wheel… }`, `seatPlace(C, s, P)` (sits a character once), `seatSteer`. Supra is 2+2; two-seaters
  (p918/sp3/jesko/rx7/aventador/senna/huayra/laferrari/chiron) have no rear row.
- `walk.js`: `getIn(car, { seat })` walks to that seat's door and calls `onGetIn(car, seat)` without resuming the
  drive when `seat.i > 0`; `getOut(drv, S, { seat, paused })`; `exitAt(car, seat)` (get out of a car that is not a
  drv — a friend's car); `follow(x, z, heading)` (the walker's position follows the friend's car while riding, so the
  map, traffic and police see you there); `setAction2`.
- `seat.src.js` (new, bundled after net.src.js in build-art.mjs and build-app.mjs): picker + seated HUD (`seatUi`),
  camera (`SCAM`, `seatCamTick`, blends), `PAX` (own car passenger), `HOP` (friend's car: ask / board / full-car
  swap / follow / get out), `MYSIT` (you seated), `seatPeers` (friends seated), `seatsStep(dt)` called from
  `driveStep` right after `netStep`, `seatsEnd(why)` from `leaveDrive` ('home') and `net.leave()` ('leave'),
  `seatNetHop(s)` / `seatHostOk(d)` for net.src.js. `body.seated` hides `#drivebar` while seated as a passenger.
- `town.src.js`: `onGetIn(car, seat)` (hop → `hopBoard`; seat.i > 0 → `paxStart`, also after `switchCar` via
  `PAX.want`); `outAt(spot, op)` returns the car; `stowFull` → `seatDetach`; `mirrorStep` want.
- `net.src.js`: `world/p` gets `st` (my seat in my own car, 0 = driver), `o 5` + `rd [owner, seat, car]` while riding,
  `nr` (I'm in a circuit / mud race → riders get out); `snap()` parses them; `netInvite` accepts kind `ride`
  (asks `seatHostOk` first); API `rideAns`, `rideOk`, `info.seat`; `netDropObj` detaches riders first; `netToast`
  goes to the seated toast while PAX/HOP.
- `site/world.js`: `send()` adds st/rd/nr; `rideAsk` / `onRide` / `rideOff` (one-shot: once answered the match is
  removed; the ride itself lives in `world/p`); `invites()` busy rule for `ride` = `W.match || W.lent || !net.rideOk`.
- `garage.src.html` `disposeCar`: removes `userData.seated` children first (characters share materials).
- `race.src.js`: 400 m race shows you in the driver's seat too (`mySitOn`), removed on exit.

## Gotchas
- Characters are shared-material objects: never let `disposeCar` traverse them (hence `userData.seated` + `seatDetach`).
- `seatsStep` must run after `netStep` (camera uses the friend's car position of this frame; `hopStep` re-hides the
  light car every frame because netStep shows it).
- While riding, `drv` is null (own car parked) → `netStep`'s "me" falls back to `HOP.last` for distance culling.
- `mirrorStep` runs in the render frame, not in `driveStep` — tests must read `MIR.on` after a drawn frame.
- walk.js locks buttons for 0.35 s after `resume()` (`lockT`): tests step ≥ 30 frames before clicking 「選位子」.

## Tests
- `seats-test.mjs` (own car): picker layout, passenger seat (car does not move, first person at the seat's eyes,
  mirrors), eye toggle + orbit drag, 換位子 → rear seat → driver (drive), driver visible in chase with hands turning,
  下車 on the passenger side, 「上車」 after, two-seater layout, drive out with the driver visible, draw calls.
- `world-test.mjs` 9e (friend's car): 選位子 next to A's stopped car, picker with A's name on the driver's seat,
  A's card (不要 → toast; 好 → board, full car, pill, o 5 + rd, A sees B seated), A drives (B follows, 下車 greyed),
  換位子 (A sees it), eye, 下車 when stopped, A goes home → B dropped next to the car.
