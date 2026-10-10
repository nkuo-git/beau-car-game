# Online step 1: ghost leaderboard (2026-10-10)

Nick picked 「做1236」 from the online plan (mock https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo, approved by Nick and his parents), then 「開始做吧」.
This is step 1 (panels 1, 2, 7, 8): name, 連線 menu, leaderboard, ghost car. Next: drive together → race together → visit garages.

## What it does
- Title bar: 「👥 連線」 next to 「☁ 登入」. Not signed in → 「要先登入才能連線」 + Google sign-in (cloud.js `login`).
- First time: 「取一個名字」 (2–10 characters; letters, digits, spaces; no swear words, email, URL or phone number). Stored in `players/{uid}` and `localStorage beau.name.<uid>`.
  The email is never shown. 「改名字」 in the menu renames, and also renames the leaderboard rows this session has seen.
- 連線 menu: 🏆 排行榜, your name, a note that the other modes are still being made.
- Leaderboard: tabs 400 公尺 / 賽車場一圈 / 爬山 × 大家 / 同一台車（current car）. Top 20 (the list scrolls).
  Your row is framed; if you are not in the top 20, 「⋮」 and your row (with your rank from a count query) sit under the list.
  The 朋友 filter from the mock waits for rooms (step 2).
- 「👻 跟第 1 名的鬼影車跑」 (「跟自己的」 if you are first) downloads that run's ghost and calls `window.beauGame.setGhost`. The sheet says where to go; if you are driving, the route is set.
- 「不用同時上線。你的最好成績會自己上傳。」

## Game side (src/ghost.js module + src/ghost.src.js glue, appended after neihu.src.js)
- `ghostRecorder(c)`: 10 samples a second, interpolated between frames. c=3 (x, z, heading) or c=1 (drag: nose distance).
  Preallocated `Float32Array`, nothing allocated per frame.
- Pack: first sample as ints (×10 m, ×100 rad, heading unwrapped), then Int16 little-endian deltas, base64.
  A 60 s hill climb is about 4.8 KB; a 2-minute lap about 10 KB; a drag run under 1 KB.
- After each run the game fires `window` event `beau-run` `{ board: 'hill'|'lap'|'drag', car, t, g }`:
  - hill: start gate to finish (same as the HUD, 0.01 s);
  - lap: every completed lap in a circuit race (first lap starts when you cross the line from the grid);
  - drag: the 400 m time without reaction (the 「400 公尺」 row); the ghost replays from green, so its own reaction is included.
- Ghost car: the light car (carlod.js) of that model (falls back to GC8), pale blue, opacity 0.42, no depth write, front faces only.
  Its tag 「👻 名字 時間」 is a fixed-screen-size sprite. It lives in `TR.scene` (not `VIL.group`), so crush.js, colliders, police and NPCs never see it.
- Replay:
  - hill: starts when the time trial starts and uses the trial clock; after you finish it runs to its end.
  - lap: restarts at every line crossing (clock = race time − lap start).
  - drag: in your own lane, from green.
  - Result text: hill toast 「比鬼影快／慢 N 秒」; drag result row 「👻 名字 N 秒：你比鬼影…」.
- `window.beauGame`: `cars()`, `cur`, `setGhost(board, {name, car, t, g})` (refuses a bad pack or the wrong kind), `clearGhost()`, `ghost` (state).
  The trial artifact has no site code, so nobody listens to `beau-run` there.

## Site side (src/site/online.js, after cloud.js in build-site.mjs)
- Uses `window.beauCloud` from cloud.js (`user`, `backend()`, `login()`) and the `beau-user` event. cloud.js's Firebase backend gained `nameGet/namePut/lbTop/lbRank/lbGet/lbPut/lbName/ghostGet`.
- Upload: each `beau-run` goes to `localStorage beau.lbq` (best per board+car), then `flush()` once signed in with a name.
  - It writes `lb/<board>-<car>` and `lb/<board>` only when faster than your cloud row (read once per session).
  - Each write is a batch of `runs/{uid}` plus `ghosts/{uid}`.
  - Offline or failed: kept for later (retries on `online`, sign-in, and the next run).
- Firestore layout:
  - `players/{uid}` = `{name, t}`
  - `lb/{board}/runs/{uid}` = `{name, car, t, at}`
  - `lb/{board}/ghosts/{uid}` = `{name, car, t, hz, c, n, s, d}`
  - `board` = `drag|lap|hill` (everyone: each person's best with any car) or `drag-gc8` etc. (same car)
- Only single-field queries (`orderBy('t')`, `where('t','<',x)` count), so no composite indexes are needed.

## Firestore rules (Nick / a parent must paste these in the Firebase console → Firestore → Rules → Publish)
Until then the leaderboard says 「排行榜現在打不開」 and uploads stay queued on the phone. Cloud saves keep working (same `saves` rule).
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 雲端存檔：只能讀寫自己的
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // 連線的名字：只能讀寫自己的
    match /players/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['name', 't'])
        && request.resource.data.name is string
        && request.resource.data.name.size() >= 2 && request.resource.data.name.size() <= 10;
    }
    // 排行榜：登入的人都看得到；只能寫自己的那一行，而且只能變快
    match /lb/{board}/runs/{uid} {
      allow read: if request.auth != null;
      allow create: if okRun(board, uid);
      allow update: if okRun(board, uid) && request.resource.data.t <= resource.data.t;
    }
    // 鬼影車（每一行的那一趟）
    match /lb/{board}/ghosts/{uid} {
      allow read: if request.auth != null;
      allow create: if okGhost(board, uid);
      allow update: if okGhost(board, uid) && request.resource.data.t <= resource.data.t;
    }
    function okBoard(board, uid) {
      return request.auth != null && request.auth.uid == uid
        && board.matches('(drag|lap|hill)(-[a-z0-9]+)?');
    }
    function okRun(board, uid) {
      let d = request.resource.data;
      return okBoard(board, uid)
        && d.keys().hasOnly(['name', 'car', 't', 'at'])
        && d.name is string && d.name.size() >= 2 && d.name.size() <= 10
        && d.car is string && d.car.size() <= 10
        && d.t is number && d.t > 1 && d.t < 900;
    }
    function okGhost(board, uid) {
      let d = request.resource.data;
      return okBoard(board, uid)
        && d.keys().hasOnly(['name', 'car', 't', 'hz', 'c', 'n', 's', 'd'])
        && d.d is string && d.d.size() < 200000
        && d.t is number && d.t > 1 && d.t < 900;
    }
  }
}
```

## Tests
- `node online-test.mjs ../docs/try ../out/online/online` → 35 ok. It uses a fake Firestore in Node with the same write rules:
  - chips fit at 390 px;
  - sign-in, then names (refused and accepted);
  - upload, slower, faster, other car, bad runs;
  - offline queue, then upload after sign-in;
  - board order, your rank below the top 20, same car, hill;
  - ghost button sets the game's ghost and the car gets built;
  - broken ghosts are refused;
  - cloud error message.
- mountain-test: the climb sends `beau-run` (samples, start gate, top). The second, slower climb with that ghost checks:
  - the ghost is not out before the gate;
  - at 15 s it is on the recorded line (0 m) and on the ground;
  - it is ahead of you, see-through, with a tag, not in the village group;
  - the top says 「比鬼影慢 N 秒」.
- circuit-test: both laps sent (time, positions, start and end at the line). In the rematch:
  - the ghost starts at the line crossing;
  - it drives the recorded lap;
  - 放棄比賽 puts it away.
- test-b1: the drag run is sent. A rematch with that ghost checks that it runs in your lane exactly as recorded, and the result line.

## Numbers
- Ghost car: about 4 draw calls + 1 sprite, 20–25k triangles. Hill-climb view with the ghost: 168 calls / 1.15M tris (summit view without: 171 / 1.12M).
