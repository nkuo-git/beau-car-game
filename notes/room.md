# Online steps 2–4: rooms, drive together, race together, visit garages (2026-10-10)

Nick: 「那可以開始做上面12點的前3點」 (online plan mock https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo, panels 2–6 and 9; Nick and parents approved it).
Trial: docs/try (needs Firebase; the artifact trial page can't reach it, so there the game side does nothing).

## What it does
- 👥 連線 menu: 開一個房間 / 輸入房間碼加入 / 🏆 排行榜 / 🚗 參觀車庫. A room has a 4-character code (no 0/O/1/I/L), up to 4 people, code-only (no list of rooms, no strangers).
- Room view: big code tiles, who is in (host first, then join order; each has 🚗 車庫), host buttons 一起出門 and 🏁 一起比賽, 離開房間 / 關掉房間（大家都會離開）.
- 一起出門: every phone goes out (walking at its own garage). In the game: friends' cars (light LOD car with their paint/rims/wing) or walking characters, a name tag (fixed screen size), a shadow, dots with initials on the minimap and the big map.
  In free driving a friend's car is a moving collider (bump physics like race opponents); during any race cars pass through each other. Nobody can run anyone over (walkers are not colliders for cars; same rules as before).
- Room pill in the game, right side under the round buttons (top 196 px): 「房間 CODE · n 個人」 (tap → room view), 💬 opens 5 preset emotes (👍 😂 好車！ 跟我來 比一場？), 1.2 s throttle. No typing anywhere. (Mock had the emotes on the left; moved right so they don't cover the destination list.)
- 一起比賽 (host picks): 賽車場 3 laps, 400 公尺, 爬山. 泥巴賽 shows 「下次做」.
  Everyone is seated at the start (different grid slots / lanes / spots), says ready, the host sets `go = server now + 4.5 s` when all are ready (or 30 s with at least one), synced start. Hill: brakes held until go; quit with 「放棄這場」. Drag: friend #1 is a solid car in the other lane, more friends are ghost cars; green light follows server time every frame (slow phones stay in sync); in full screen the drag panel is hidden and 「放棄這場」 shows on the right.
  Results card on every phone (same order): 再來一場 (host only) / 回房間 (ends the race, back to free driving).
- 參觀車庫 (garage page only): from the room (🚗 車庫) or by tapping a name on the leaderboard. Full car in the middle, 上一台/下一台, ♥ 讚 (toggle), 「只能看，不能改別人的車、也不能拿走。」. Page parts hide, the view grows to min(78vh, 640 px). Your own cars come back on ✕.

## Data (Firebase Realtime Database, asia-southeast1)
URL in src/site/cloud.js `RTDB_URL`. Firestore free writes can't take 8 Hz positions, so rooms use RTDB.
```
rooms/{code}  host, at, race{seq,kind,go}, s{0..3: uid}, m{uid:{n,car,l,ch,s,j}}, p{uid:{t,x,z,h,v,o,k,rp,rs}}, e{uid:{e,t}}, r{seq:{uid:{t}}}
garages/{uid} {n, t, cur, cars{k: look}}      likes/{uid}/{from} = true
```
- p: 8/s while moving, heartbeat 1.5 s outside / 3 s otherwise; o 0 = not out, 1 car, 2 walking, 3 drag strip. Receivers draw 220 ms behind server time, extrapolate ≤ 0.5 s, drop a peer after 6 s without data.
- r/{seq}/{uid}.t: 0 = ready, seconds = finished, −1 = didn't finish. Races with seq ≤ the seq at join time are ignored; a race that was ended (回房間) never restarts (`NET.doneSeq`).
- onDisconnect removes your s/m/p/e; the host leaving removes the room.
- Rules: /mnt/project-files/online/rtdb-rules.json (copied at the end), pasted by a parent 2026-10-10. RTDB rules have no `numChildren()`, so max 4 is done with slots: `s/N` can only be claimed empty or released by its owner, and `m/{uid}.s` must point at your slot (join = one multi-path update of `s/N` + `m/uid`).

## Code
- src/net.src.js (appended after ghost.src.js in build-art.mjs and build-app.mjs): `window.beauGame.net` {join, leave, host, members, snap, emote, clock, state, look, garage, race, results, where, info}, `beauGame.visit(d)`, `beauGame.visiting`; events `beau-net` {emote, ready, fin, again, room}. `netStep(dt)` runs in driveStep.
- circuit.js createCircuitRace: `grid`, `startIn()`, `rivals [{name,p,fin}]`, `result:false`. walk.js `setMarkers(list, tag)`. race.src.js has `if (R.net)` hooks; `R.greenNow` (wall clock at green).
- src/site/room.js (after online.js in build-site.mjs): rooms, send loop, host tick, garage publish (8 s debounce after `beau-save`), visit + likes. online.js exposes `window.beauNetUI` for its views.
- cloud.js `rt()` lazily imports firebase-database and returns get/set/update/remove/on/disc/discOff/conn/now.

## Test: src/room-test.mjs (`node room-test.mjs ../docs/try ../out/room/room`, ~4 min, 49 ok)
Two phones = two Chromium instances (one GPU process each) sharing a fake RTDB hosted in Node (rules subset, listeners, onDisconnect).
This machine draws with SwiftShader at <1 fps, so the test: replaces the animation loop with a 30 ms timer, draws only every 300th tick (every tick for 1.5 s before screenshots / draw-call counts), uses software compositing (`--disable-gpu-compositing`, rAF went 0.3 → 10 fps), force-clicks and polls with timers.
Draw calls with a friend's car in view next to the drag strip: 348 calls, 1.51 M triangles.

## Rules (rtdb-rules.json)
Any change must be re-pasted by a parent in the Firebase console (Realtime Database → 規則 → 發布).
```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null && $code.matches(/^[2-9A-HJKMNP-Z]{4}$/)",
        ".write": "auth != null && $code.matches(/^[2-9A-HJKMNP-Z]{4}$/) && (!data.exists() || data.child('host').val() === auth.uid)",
        ".validate": "!newData.exists() || newData.child('host').isString()",
        "host": {
          ".validate": "newData.isString() && (newData.val() === auth.uid || newData.val() === data.val())"
        },
        "at": {
          ".validate": "newData.isNumber()"
        },
        "race": {
          ".validate": "newData.hasChildren(['seq', 'kind', 'go']) && newData.child('seq').isNumber() && newData.child('go').isNumber() && newData.child('kind').isString() && newData.child('kind').val().length <= 10"
        },
        "m": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && data.parent().parent().child('host').exists()",
            ".validate": "!newData.exists() || (newData.hasChildren(['n', 'car', 's']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('car').isString() && newData.child('car').val().length <= 12 && newData.child('s').isString() && newData.child('s').val().matches(/^[0-3]$/) && newData.parent().parent().child('s').child(newData.child('s').val()).val() === auth.uid)"
          }
        },
        "p": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && data.parent().parent().child('m').child($uid).exists()",
            ".validate": "!newData.exists() || (newData.child('x').isNumber() && newData.child('z').isNumber() && newData.child('h').isNumber())"
          }
        },
        "e": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && data.parent().parent().child('m').child($uid).exists()",
            ".validate": "!newData.exists() || (newData.child('e').isNumber() && newData.child('t').isNumber())"
          }
        },
        "r": {
          "$seq": {
            "$uid": {
              ".write": "auth != null && auth.uid === $uid && data.parent().parent().parent().child('m').child($uid).exists()",
              ".validate": "!newData.exists() || newData.child('t').isNumber()"
            }
          }
        },
        "s": {
          "$n": {
            ".write": "auth != null && $n.matches(/^[0-3]$/) && data.parent().parent().child('host').exists() && ((!data.exists() && newData.val() === auth.uid) || (data.val() === auth.uid && !newData.exists()))",
            ".validate": "!newData.exists() || newData.isString()"
          }
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "garages": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "!newData.exists() || (newData.child('n').isString() && newData.child('n').val().length <= 12)"
      }
    },
    "likes": {
      "$uid": {
        ".read": "auth != null",
        "$from": {
          ".write": "auth != null && auth.uid === $from && $from !== $uid",
          ".validate": "!newData.exists() || newData.val() === true"
        }
      }
    }
  }
}
```
