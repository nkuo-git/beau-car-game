# walk.js (b2-walk) — final report summary (agent done ~07:50 UTC)

> 這是遊戲還在「大便龍的萬能軟體」裡的時候，做這一塊的工作記錄（2026-09／10，英文）。檔名現在都在 repo 的 `src/`；
> 裡面提到的 `old-scratch/…` 記錄檔、截圖、port-*.mjs 都在舊的暫存資料夾，沒有搬進 repo（要重看就重跑測試）。

Files: src/walk.js (IIFE, exports createWalker; API in header), walk-test.html (REFERENCE WIRING: carList, onGetIn, getOut, driveAct, doorStep, stepAll, start), walk-test.mjs (56/56 OK; phases: bundle smoke garage pad collide camera doors cycle keys walkout shots api), walk-shots/ (22 PNGs). Tested with village.js/town.src.js from b1-int (short highway). Only charstub tested (character.js not ready then).

## API
createWalker({ scene, camera, world: V, colliders, character, hudParent, onDoor(door, zone), onGetIn(car), keyboard=true, doors='village', mapLayer?, bounds? }) — starts paused.
- update(dt): every frame after drv.update, ALSO while driving (camera handover after 上車).
- telemetry(): { x,z,heading,speed,vx,vz,state,mode(off|out|walk|in|seat),running,paused,near,action,camMode,camYaw,camPitch,camDist,camWant,hidden,zone,dest,destDist }
- getOut(drv, S, { key, name, h?, door? }) → car | null (null if |v|≥1, paused, or no room → toast 「這裡太擠了，下不了車」). drv.pause(); car stays with collider; exits left→right→behind→front.
- getIn(car?) = 上車: walk to door, sit, hide, onGetIn(car). car.drive true = same car, walker already drv.resume().
- setCars(list, { keepParked }) list [{ key, name?, x, z, heading, hx, hz, cx?, cz?, h?, door?, object?, solid? }]; 上車 within 1.6 m; keepParked:false at new trip.
- setGarage(GAR, { close, doorAction }) — call after GAR.group placed; door collider follows roller door (pass at t≥0.55); 開鐵捲門 inside+outside; 關鐵捲門 only with close:true.
- setAction({label,onClick,icon}|null) priority page > garage door > 上車; E key.
- setDoors(list|'village'|null) [{x,z,ry,w?}] (113 village doors default); onDoor fires once per approach, no button.
- addColliders(list, tag)/removeColliders(tag) (box/circle; y0 above head = camera only); setMovers(array) re-read per frame (NPCs/traffic).
- setButtons([{id,label,onClick(walker,id),key}]) + play(state) for batch-3 punch.
- setDestination, setCamera({mode follow|eye, yaw, pitch, dist, maxY, hold}), setInput, setCharacter, pause({hide}), resume({blend}), teleport, toast, dispose. Getters: action, character, cars, parked, doors, cameraMode, mode, hud, mapLayer.
Controls: lower-left joystick zone 58%×46% of stage (half push walk 1.4 m/s, full run 4.5 m/s), drag elsewhere = camera; WASD/Shift/E/C.
HUD (390×844, stage 390×560): top-left dest chip + big action; top-right 124 px minimap + 44 px first-person toggle; bottom-left joystick; bottom-right setButtons column; toast at 34%.

## Wiring into town.src.js (see walk-test.html)
1. Bundle: add 'walk.js' (later 'character.js') after 'drive.js' in build-art.mjs list and build-app.mjs line 23.
2. startDrive(): after dcam: walker = createWalker({ scene: TR.scene, camera: dcam, world: VIL, colliders: stripColliders(), character: buildCharacter(look), hudParent: stage, keyboard: true, onDoor, onGetIn }); walker.setGarage(GAR).
3. Start on foot: replace makeDrv(spawn)+toast: put tripS.car visible at VIL.places.garage.spawn, tripPose = that; walker.setCars(walkCars(), { keepParked:false }); walker.teleport(garWorld({ x:-4.6, z:-7.7, heading:-1.05 })); walker.resume(). walkCars(): bay LODs { key, name: CARS[k].btn[0], ...garWorld(GAR.spots.bays[i]), hx/hz/cx/cz from LODS[k], object: LODS[k].lod.car } + trip car only while no drive; never the driven car.
4. driveStep: remove early `if (!drv) return`; order GAR.door.update(dt) → doorStep() → if (drv) { drv.update(dt) … } → walker.update(dt).
5. 下車: drv.setAction(homeAct(t) || bayAct(t) || (Math.abs(t.v) < 1 ? OUT : null)); OUT.onClick → walker.getOut(drv, tripS, { key: cur, name }); if car: dvoice?.dispose(); dvoice=null; store pose. REMOVE 停好熄火, parkHome, parkStep (turntable spin).
6. onGetIn(car): car.drive → recreate dvoice only; trip car on turntable → makeDrv({x,z,heading}); bay LOD → load full model like swapTripCar (built[k] or loadCar(k)); leave old trip car at its pose (drv.dispose() moves it to origin — put back); hide LOD; makeDrv at LOD pose. Walker stays off/hidden while loading; on fail walker.resume(). Always walker.setCars(walkCars()) after.
7. doorStep (runs on foot too): switch drive 'garage' colliders at door t 0.9 (was in homeAct); auto-close >30 m from door using PLAYER position (walker.telemetry() when walker.mode !== 'off' else drive); skip if a parked car under door; remove auto-close from homeAct.
8. Parked cars as drive colliders incl. cars left outside bays (current poses); arrangeCars must respect per-trip poses.
9. setDest → walker?.setDestination(d). 10. leaveDrive → walker.pause({ hide:true }) (keep walker).
11. Optional: drive.js H.layer = o.mapLayer || mapLayer(); pass mapLayer: walker.mapLayer (saves ~16 MB canvas; layer 2119×1888).
12. Batch-3 hooks: setButtons+play('punch'), setMovers, onDoor/setDoors/addColliders/setCamera({maxY}) for interiors.

## Known issues
1. Drive HUD has one action slot: near closed door 開鐵捲門 takes it, 下車 only after door open → add separate 下車 button (e.g. drive bar).
2. Auto-walk to car door is not pathfinding (cancels after 0.5 s stuck / 5 s: 「過不去：走到車門旁邊再按一次」).
3. Trees/bushes not in V.colliders (walk/drive through). Balcony camera boxes derived from V.buildings (house/shop ≥2 floors, 1.12 m deep, y 2.7) — retune if facades change.
4. Narrow alleys: camera pulls in to ~1.35 m.
5. Minimap base drawn twice unless step 11.
6. Parked car shadow found by name 'drive-shadow'.
7. Toasts use setTimeout.
8. Only charstub tested.
9. walk.js depends on room.js members: size, door.{t, moving, open, close}, colliders(open, true) with door box LAST, toWorld — lift/bedroom rework must keep them (walk-test collide/walkout phases catch it).
