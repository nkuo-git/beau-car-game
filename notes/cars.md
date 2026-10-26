# 10 new cars, cockpits, pop-up headlights, tilt steering (content 16, 2026-10-17)

Nick asked for 10 more cars modelled from web photos. The photos were only used to look at; they are never in the game or the repo. Names are made-up badges, not real brands.

| key | button | price (萬) | notes |
|---|---|---|---|
| `rx7` | R7 轉子跑車 | 100 | rotary sound, pop-up headlights |
| `ae86` | 86 豆腐車 | 75 | black/white, pop-up headlights |
| `altis` | 小黃 計程車 | 45 | taxi; the most common new car in traffic |
| `civic` | FK 大尾翼掀背 | 115 | |
| `evo` | E9 拉力房車 | 100 | AWD |
| `aventador` | AV12 剪刀門 | 1200 | |
| `senna` | SN8 大尾翼 | 1500 | mid-engine |
| `huayra` | HY 風神 | 4500 | mid-engine |
| `laferrari` | LF 紅色流線 | 5000 | mid-engine |
| `chiron` | C16 馬蹄超跑 | 8000 | W16, AWD |

- Each car has `<car>-look.js` / `<car>-spec.js`, a garage body (`body-*-q.glb`), a light-weight body (`body-*-lod.glb`) and wide-body settings. They are bundled in build-art.mjs / build-app.mjs through the `CARS` list. See `src/CARS-CONTRACT.md`.
- Traffic (npc.js) also uses the new cars.
- 阿財車行 has more cars than its 6 turntables. Tapping a car further down the list swaps the turntables to that batch (town.src.js `padOff`).
- Cockpits: every new car has a first-person interior (cabin.js), with a steering wheel that turns and a red top marker.

## Pop-up headlights 跳燈 (popup.js; mock https://claude.ai/artifact/NjStMe4AhSWuk9dBUELzde)
- 86 and R7 get a 「跳燈」 button next to 手煞車 (drive.js `setPop`). In portrait it sits above 手煞車; in landscape it sits to the left. The L key also works.
- Each press raises or lowers the covers and switches the lamps on or off (`popStep` animates).
- The state is saved per car in `GAME.pop` (`{car: 1}`, saved as `pop`). A borrowed car's state is not saved.
- Friends see the lamps (`pl` in `netState`).

## Tilt steering 轉手機開車
- Nick: 「你看可不可以把手機本身改成可以方向盤的模式」.
- The 「⋯」 row gets a 🎮 button: 「方向盤 按鈕 ⬅➡ / 轉手機 📱」.
- drive.js `setTilt` reads gravity from `devicemotion`. Tilting 30° is full lock; the middle 2° does nothing.
- The setting is kept per phone in `localStorage` `carid.tilt`. It is not in the save and is not moved over.
- If the phone sends no sensor data for 1.5 s, it says 「這支手機不能轉手機開車」 and switches back to buttons.

## Real rear-view mirrors (第 25 批, 2026-10-21)
- Nick: 「第一人稱駕駛的時候 後照鏡要真的顯示後方景色 有車子也要顯示出來 且會跟著開車方向移動」.
- town.src.js `MIR` / `mirrorSet` / `mirrorStep`: in the driver's-seat view only, a backward camera at the driver's eye height (car centre line) draws the scene into a 512×170 render target every 3rd frame, with your own car hidden for that pass. The inside mirror (cabin.js `cabin.userData.mirror`, a hidden quad in front of the painted mirror) and both side-mirror glasses (`S.mats.mirrorGlass` meshes) get `MIR.mat` with UVs from `mirUV` (inside: straight back; left: left-behind; right: right-behind; flipped like a mirror). Leaving the driver's view (or stowing the car) puts the original materials back.
- Cost: one extra pass of about 87 calls / 0.38M tris (mirror-test, village road) every 3rd frame, only in the driver’s view.
- Test: `mirror-test.mjs`.

## Tuned top speeds = real-world records (第 46 批, trial v59, 2026-10-26)
- Nick: 「你去查世界記錄遊戲中的車在真實世界改到多快 你就讓遊戲裡改到多快」.
- `PERF[k].top` (garage.src.html) is the fastest measured speed of a modified car of that model. `vmaxOf(k, hp = hpOf(k))` goes linearly from stock `vmax` (no parts) to `top` (all parts) by added hp.
- Used by:
  - the town drive: town.src.js `perf.vmax`, which drives `drive.js`'s gearing and governor;
  - your car in the 400 m: race.src.js `mySetup().vmax` → `racer` `fd`.
- Not used by the 400 m / circuit opponents or the dealer label (still stock).
- No new UI.

| car | stock | tuned | record (research 2026-10-26) |
|---|---|---|---|
| GC8 | 250 | 288 | AFP GC8, 1/4-mile trap, Santa Pod 2014 (engine swap) |
| GR Yaris | 230 | 250 | Lamspeed, 1/4-mile trap, ~2024 |
| SUPRA (A80) | 300 | 387 | Ekanoo Racing 2JZ drag Supra, 1/4-mile trap, Bahrain 2014 |
| GT-R (R34) | 290 | 346 | Veilside R34, closed road, NZ 1999 |
| 918 | 345 | 351 | Weissach, runway mile, 2018 (best measured) |
| JESKO | 330 | 413 | Jesko Absolut 0-400-0 runs 2024 (best measured; no aftermarket record) |
| R7 (FD) | 250 | 389 | Racing Beat FD, Bonneville 1995 (three-rotor) |
| C16 (Chiron) | 350 | 490 | Chiron Super Sport 300+ prototype, Ehra-Lessien 2019 |
| 86 (AE86) | 190 | 254 | 3S-GTE swap, 1/4-mile trap (low confidence) |
| AV12 | 345 | 350 | Underground Racing twin-turbo, standing half-mile 2015 |
| 小黃 (Corolla) | 180 | 241 | E110 Corolla 3S-GTE, standing half-mile 2019 (different generation) |
| FK | 272 | 275 | Stage 2 FK8, Autobahn speedometer video 2022 (low) |
| E9 (Evo IX) | 250 | 299 | Extreme Tuners, 1/4-mile trap 2017–18 |
| monster truck | 110 | 160 | Raminator, Guinness 2014 |
| SP3, SN8, HY, LF | same | same | no modified run found; LF's 372 is an unverified speedometer video |

- A "trap" is the speed at the end of a 1/4 mile. The car's true top would be higher, but nobody has measured it.
- Test: `top-test.mjs` (Node, ~1 s) checks every car flat out on a flat plane through `drive.js`:
  - no parts reach `vmax`;
  - all parts reach `top`;
  - half the parts land in between.
- drift-test checks the in-game wiring: SUPRA `carInfo.vmax` goes 300 → 387 → 300, and the 400 m `fd` scales too.
