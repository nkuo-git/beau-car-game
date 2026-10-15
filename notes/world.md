# One shared world instead of rooms (2026-10-11)

Nick: 「不用房間 選擇連線的人就加入一個永久的世界 大家都可以持續看到對方 隨時可以看有誰在線上 就發起比賽 各人有自己的車庫 所以路上會有很多個車庫屬於不同人」, then 「不用世界碼 反正就只有一個世界 選擇連線 就進入這個唯一的世界 爸媽已同意」.
Mock: https://claude.ai/artifact/QDwK28dEsEkumkvR2AiP9Y (Nick said 好). Replaces content 8's rooms (src/site/room.js, notes/room.md); the game side (net.src.js) is mostly the same.
Garage street: 6 garages (Nick asked to cut it from 12 to 6), see below.

## What it does
- 👥 連線 menu: 「大家都在同一個世界。現在有 N 個人在線上。」, 進入世界 / 🏆 排行榜 / 🚗 參觀別人的車庫. Entering is remembered (localStorage `beau.world`), so the next launch goes in by itself; 離開世界 forgets it.
- 線上的人（n/16）: avatar, name, car, where (`net.place()`: 在車庫 / 在比賽 / 在山頂… / 在路上). Buttons: 去找他 (only when you are out and they are not in a garage or race), 🏁, 🚗, 🚫. 別人找我比賽 開/關 (localStorage `beau.inv`, `m.inv`). 封鎖的人 list with 解除封鎖.
- In the game the pill reads 「👥 n 人在線上」; tapping it opens the list. Friends further than 320 m are map dots only (no car/character drawn). Up to 15 others are drawn.
- 去找他: `VIL.places.friend` follows the friend every frame; arrived within 14 m.
- 🏁: pick 賽車場 3 圈 / 400 公尺 / 爬山 → 「等 X 回答⋯」 (20 s bar, 取消). The other phone gets a card 「🏁 X 找你比…！ 他開 GC8」 好／不要 with a 15 s bar (no answer = 不要). Invites are one at a time; while racing or asking someone, invites are auto-answered as busy.
- Race: same as rooms (seats both at the start, server-time start, results). 再比一次 = the one who asked. 回去開車 ends the match; the other side's card then says 「對方離開了」 (their own race keeps going).
- 🚫 block: both sides stop seeing each other (list, cars, map, emotes) and the blocked one can't send invites (rules too).
- Max 6 at once (16 until 2026-10-11 evening; one per garage on the garage street): 「世界滿了（最多 6 個人），等一下再來。」

## Data (Realtime Database)
```
world/s/{0..5}    uid                                  (6 slots = capacity = garage street #1–6; rules accept 0..15)
world/m/{uid}     {n, car, l, ch, s, j, w, inv}
world/p/{uid}     {t, x, z, h, v, o, k, rp, rs, w, pc, jl}   8/s moving, heartbeat 1.5 s / 3 s
world/e/{uid}     {e, t}
world/bl/{uid}/{other}   other's name                  (block)
world/ch/{to}/{from}     {kind, t, id}                 (invite)
borrow/q/{owner}/{from}  {c, t, id}                    (borrow: the code typed; only the owner reads it)
borrow/a/{from}/{owner}  {id, ok, t, k, l, pt, ty, x, z, h, left, wait}   (owner's answer / 拿回來 ok −9)
borrow/r/{owner}/{from}  {id, x, z, h, t}              (returned: where it is parked)
matches/{id}      {a, b, kind, at, ok(0/1/-1 no/-2 busy), seq, go}, r/{seq}/{uid}: {t}
garages/{uid}, likes/{uid}/{from}                      (unchanged)
```
- Join = one multi-path update of `s/N` + `m/uid`; a slot can be taken if empty, yours, or its owner has no `m` (stale). onDisconnect on `world` removes your s/m/p/e and your invites; each player also sets onDisconnect remove on the current `matches/{id}`.
- Connection blip: if the server removed you, `onMembers` sees you missing and the client claims a slot again (same or another).
- Stale cleanup: every 30 s each client removes members whose position is older than 150 s (rules allow it after 120 s), then their slot and position.
- Bandwidth: every client listens to all of `world/p` (~100 B × 8/s per moving player, deltas only). Fine on the free plan for a handful of kids; 16 players all driving ≈ 200 KB/s total.

## Rules
In /mnt/project-files/online/rtdb-rules.json and below. They keep the old `rooms` part so content 10 (still on the phones) works until this ships; remove `rooms` after 上線.
A parent has to paste them: Firebase console → Realtime Database → 規則 → paste → 發布.

```json
{
  "rules": {
    "world": {
      ".read": "auth != null",
      "s": {
        "$n": {
          ".write": "auth != null && $n.matches(/^([0-9]|1[0-5])$/) && (!newData.exists() || newData.val() === auth.uid) && (!data.exists() || data.val() === auth.uid || !root.child('world/m/' + data.val()).exists())",
          ".validate": "newData.isString()"
        }
      },
      "m": {
        "$uid": {
          ".write": "auth != null && (auth.uid === $uid || (!newData.exists() && (root.child('world/p/' + $uid + '/t').val() < now - 120000 || (!root.child('world/p/' + $uid).exists() && data.child('j').val() < now - 120000))))",
          ".validate": "newData.hasChildren(['n', 'car', 's', 'j']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('car').isString() && newData.child('car').val().length <= 12 && newData.child('s').isString() && newData.child('s').val().matches(/^([0-9]|1[0-5])$/) && newData.parent().parent().child('s').child(newData.child('s').val()).val() === $uid && newData.child('j').isNumber()",
          "w": {
            ".validate": "newData.isString() && newData.val().length <= 16"
          },
          "inv": {
            ".validate": "newData.isNumber()"
          }
        }
      },
      "p": {
        "$uid": {
          ".write": "auth != null && ((auth.uid === $uid && (!newData.exists() || root.child('world/m/' + $uid).exists())) || (!newData.exists() && !root.child('world/m/' + $uid).exists()))",
          ".validate": "newData.child('x').isNumber() && newData.child('z').isNumber() && newData.child('h').isNumber() && newData.child('t').isNumber()"
        }
      },
      "e": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid && (!newData.exists() || root.child('world/m/' + $uid).exists())",
          ".validate": "newData.child('e').isNumber() && newData.child('t').isNumber()"
        }
      },
      "bl": {
        "$uid": {
          "$o": {
            ".write": "auth != null && auth.uid === $uid && $o !== $uid",
            ".validate": "newData.isString() && newData.val().length <= 12"
          }
        }
      },
      "ch": {
        "$to": {
          ".write": "auth != null && auth.uid === $to && !newData.exists()",
          "$from": {
            ".write": "auth != null && ((auth.uid === $to && !newData.exists()) || (auth.uid === $from && $from !== $to && (!newData.exists() || (root.child('world/m/' + $to).exists() && !root.child('world/bl/' + $to + '/' + $from).exists() && !root.child('world/bl/' + $from + '/' + $to).exists() && root.child('world/m/' + $to + '/inv').val() !== 0))))",
            ".validate": "newData.hasChildren(['kind', 't', 'id']) && newData.child('kind').isString() && newData.child('kind').val().length <= 10 && newData.child('t').isNumber() && newData.child('id').isString() && newData.child('id').val().length <= 40"
          }
        }
      },
      "$other": {
        ".validate": false
      }
    },
    "matches": {
      "$id": {
        ".read": "auth != null && $id.matches(/^[A-Za-z0-9_-]{1,40}$/)",
        ".write": "auth != null && $id.matches(/^[A-Za-z0-9_-]{1,40}$/) && (data.child('a').val() === auth.uid || data.child('b').val() === auth.uid || (!data.exists() && newData.child('a').val() === auth.uid))",
        ".validate": "newData.hasChildren(['a', 'b', 'kind'])",
        "a": {
          ".validate": "newData.isString() && (!data.exists() || newData.val() === data.val())"
        },
        "b": {
          ".validate": "newData.isString() && newData.val() !== newData.parent().child('a').val() && (!data.exists() || newData.val() === data.val())"
        },
        "kind": {
          ".validate": "newData.isString() && newData.val().length <= 10"
        },
        "at": {
          ".validate": "newData.isNumber()"
        },
        "ok": {
          ".validate": "newData.isNumber()"
        },
        "seq": {
          ".validate": "newData.isNumber()"
        },
        "go": {
          ".validate": "newData.isNumber()"
        },
        "r": {
          "$seq": {
            "$uid": {
              ".validate": "newData.child('t').isNumber() && ($uid === newData.parent().parent().parent().child('a').val() || $uid === newData.parent().parent().parent().child('b').val())"
            }
          }
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "borrow": {
      "q": {
        "$to": {
          ".read": "auth != null && auth.uid === $to",
          ".write": "auth != null && auth.uid === $to && !newData.exists()",
          "$from": {
            ".write": "auth != null && ((auth.uid === $to && !newData.exists()) || (auth.uid === $from && $from !== $to && (!newData.exists() || (root.child('world/m/' + $to).exists() && root.child('world/m/' + $from).exists() && !root.child('world/bl/' + $to + '/' + $from).exists() && !root.child('world/bl/' + $from + '/' + $to).exists()))))",
            ".validate": "newData.hasChildren(['c', 't', 'id'])",
            "c": {
              ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}$/)"
            },
            "t": {
              ".validate": "newData.isNumber()"
            },
            "id": {
              ".validate": "newData.isString() && newData.val().length <= 40"
            },
            "$other": {
              ".validate": false
            }
          }
        }
      },
      "a": {
        "$to": {
          ".read": "auth != null && auth.uid === $to",
          ".write": "auth != null && auth.uid === $to && !newData.exists()",
          "$from": {
            ".write": "auth != null && ((auth.uid === $to && !newData.exists()) || (auth.uid === $from && $from !== $to && (!newData.exists() || root.child('world/m/' + $from).exists())))",
            ".validate": "newData.hasChildren(['id', 'ok', 't'])",
            "id": {
              ".validate": "newData.isString() && newData.val().length <= 40"
            },
            "ok": {
              ".validate": "newData.isNumber()"
            },
            "t": {
              ".validate": "newData.isNumber()"
            },
            "k": {
              ".validate": "newData.isString() && newData.val().length <= 12"
            },
            "l": {
              ".validate": "newData.hasChildren()"
            },
            "pt": {
              ".validate": "newData.hasChildren()"
            },
            "ty": {
              ".validate": "newData.hasChildren()"
            },
            "x": {
              ".validate": "newData.isNumber()"
            },
            "z": {
              ".validate": "newData.isNumber()"
            },
            "h": {
              ".validate": "newData.isNumber()"
            },
            "left": {
              ".validate": "newData.isNumber()"
            },
            "wait": {
              ".validate": "newData.isNumber()"
            },
            "$other": {
              ".validate": false
            }
          }
        }
      },
      "r": {
        "$to": {
          ".read": "auth != null && auth.uid === $to",
          ".write": "auth != null && auth.uid === $to && !newData.exists()",
          "$from": {
            ".write": "auth != null && ((auth.uid === $to && !newData.exists()) || (auth.uid === $from && $from !== $to))",
            ".validate": "newData.hasChildren(['id', 'x', 'z', 'h', 't'])",
            "id": {
              ".validate": "newData.isString() && newData.val().length <= 40"
            },
            "x": {
              ".validate": "newData.isNumber()"
            },
            "z": {
              ".validate": "newData.isNumber()"
            },
            "h": {
              ".validate": "newData.isNumber()"
            },
            "t": {
              ".validate": "newData.isNumber()"
            },
            "$other": {
              ".validate": false
            }
          }
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
    },
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
    }
  }
}
```

## Garage street (車庫街, village.js 第 16 批)
- West of your garage: the corner of the village road (node GW, -345,-72) became a T junction; a dead-end street runs west to GST (-410,-72). 3 small garages on each side (white walls, closed roll-up door, a dark name board). Nick first got 12, then asked for 6 (「車庫改成六間就好」).
- Fields/bamboo there were removed with the throwaway-Builder trick (random numbers still consumed, so nothing else in the village moves). `V.places.garst.slots[i]` = { x, z, ry, sign{x,y,z,ry,w,h}, door{x,z} }, order north/south alternating from the junction.
- net.src.js draws all name boards as one mesh with one canvas atlas (1 draw call) while in the world: each person on their world slot (s 0–5 → garage 1–6; you in orange 「名字（你）」, others 「小明的車庫」), the rest 「空的」. Offline the boards stay blank.
- Stop (under 4 m/s) within 6 m of someone else's door: button 「🚗 看小明的車庫」 → the site drives you home and opens the garage visit (world.js `visitStreet`). Your own garage is the real marble garage (below).
- Walking view on the street: ~59 draw calls, 0.21 M triangles.

## Own garage on the street, v1 (content 12, 2026-10-11) — replaced by v2 below
- Content 12 kept the marble garage at (-300,-97.5) and made its roller door a portal: crossing it teleported you to your small 車庫街 garage (`homeOut`), and a 「進車庫」 button teleported you back (`homeEnter`). Nick 2026-10-13: 「目前開出車庫 他是突然閃跳到街上 可以像之前一樣 順著開出車庫 而且不同人開出來的位置也不同」. All of that code (HOME portal, hedge, 進車庫) is gone.

## Own garage on the street, v2 (第 17 批, 2026-10-13, mock https://claude.ai/artifact/QHscDepQgHfWxNHL8GGNAJ v2, Nick 「可以做了」)
- Nick: 「那不要1號好了 所有人都在車庫街有個固定位置 不管有沒有連線」.
- village.js `GST_LOTS`: 6 lots as big as the marble garage (exterior 32.6 × 18.3 m), doors facing the street (z −72): north row x −370/−404/−438/−472 (lot z −87.3, heading −π/2), south row x −370/−404 (lot z −56.7, heading π/2); faces 20 m apart so trucks can turn. The street runs from GW (-345,-72) to GST (-490,-72). The ground has a hole under every lot (lift pits). The old spot at (-300,-97.5) is grass; its forecourt, planters and lamps stay.
- `VIL.homeAt(n, P)` fills `places.garage` for slot n (lot, door, apron, inside, zone/yard, `via: 'garst'`, `end` = lot centre so 回車庫 drives straight in).
- Your number (town.src.js `homeSlot()`): in the world = your world slot; otherwise the saved `GAME.home` (save key `home`, 0–5); never joined = 0 (#1). First join stores the slot as `GAME.home` (net.src.js `netHomeKeep`), and world.js `claim()` asks for `net.home()` first; if someone else holds it you get another free slot for that visit (the saved number doesn't change).
- `homePlace()` (each trip start and every `homeTick`): when the slot changes, re-fill `places.garage`, move `GAR.group` to the lot, rebuild the other 5 shells and remap everything parked in the garage (`homeMove`: trip poses, the walker, parked full car, PFULL cars). GAR itself is the real garage, so the lifts, bed, door, police hiding (「關鐵捲門」) all work as before content 12.
- Other slots: GAR's exterior (shell, lights, sign band, closed door slats baked from `roomDoorOut`) as 3 InstancedMeshes (`garst-ext-0..2`, own slot scaled to 0). Their name boards are net.src.js's atlas mesh; your own board cell is skipped (GAR has its own sign).
- Colliders: village.js puts one box per lot into `V.colliders` (`slots[i].col`, `noCrush`), so driving, walking, bullets, police sight and the crush tests all see the garages. Your own lot's box gets `off = true` (town.src.js `homeExt`); drive.js, walk.js (body and camera), guns.js and crush.js skip `off` colliders, and GAR's own walls/door take over.
- Your garage now sits by the street, so the full parked car inside (not part of `GAR.interior`) is hidden while the door is shut and the camera is outside (`TR.scene.onBeforeRender` = `garHideFull`, restored in `onAfterRender`). Looking east down the street from x −480: 237 draw calls / 0.46 M triangles (content 12 from the same spot: 229 / 0.44 M).
- Coming home: drive to your door, 「開鐵捲門」, drive in — no 「進車庫」.
- `HOME.in` (inside GAR's box) still means "in the garage" for net: friends don't see you, list says 在車庫.
- Known: friends' garage doors never open, so a friend leaving home appears through the closed door (same as content 12).

## Seeing friends chased / arrested (same mock #2)
- `world/p` carries extra fields while wanted: `w` (stars 1–3), `pc` ([x, z, h] × up to 3 police cars within 200 m, from police-ai `npcCars`), `jl` 1 while caught/jailed. Rules only validate x/z/h/t, so no rules change.
- Receivers: ★ after the name on the tag (tag texture redrawn when the count changes), up to 4 police cars total (police.js `makePoliceCar`, 2 draw calls each, lights flashing, visual only — no collision), interpolated with the same buffer as the friend's car.
- jl 0→1 → toast 「🚓 X被警察抓走了！」 (not when you join while they are already jailed). `place()` says 「在拘留室 m:ss」 in 10-second steps (police-ai `jailLeft`), so the list counts down without writing every second.

## Borrowing a friend's car (第 19 批, 2026-10-15, mock https://claude.ai/artifact/5yJe6e2HjwjbPemrTACohF, Nick 「好」)
Nick: 「可以借別人的車來開 每個人自己手機上會有一個密碼 別人要借你就跟他說密碼。密碼可以自己改。打完密碼就可以上車」.
- Key code: `GAME.key` (4 digits, in the save as `key`; made the first time `net.key()` is asked). Shown only on your own phone: 👥 連線 → 線上的人 → 「🔑 我的車鑰匙密碼」 + 改密碼 (digits only).
- Parked car: when you get out (drv paused, or a car a friend gave back = LOD at `tripPose[cur]`), `netState` sends `pk = [car, x, z, h]`; friends draw your LOD car there (it blocks like a driving one). `borParked()` decides; not inside your garage, not while lent.
- Borrowing (net.src.js `BOR`): walk next to a friend's parked car → 「🔑 借車 · X的 GT-R」 → number pad → event `borrow` → world.js writes `borrow/q`. The OWNER's phone compares the code (the real code never leaves the phone), counts wrong tries per borrower (3 → locked 30 s, ok −3), checks `lendCheck()`, then `lend()` hides its car (`LENT_K`) and answers ok 1 with look/parts/tyres/pose.
- The borrower walks to the door (walk.js getIn with a `borrow` entry); `netBorrowBoard` parks their own car like `switchCar`, loads the friend's car with the friend's look, temporarily swaps `cur`, `CARS[k].state`, `GAME.parts/tyres/dmg[k]` and sets `saveFix` so the save keeps the borrower's own things. Blocked while borrowing: shop/dealers (`bayAct`), the 400 m strip (`trackStep`), lifts/bays when getting out, world race invites/challenges (also blocked while your car is lent).
- Return: getting out (watchdog in `borTick`), 「還車」, leaving the world, going back to the garage page → event `return` → `borrow/r` with the pose (inside your own garage → the original pose). 拿回來 (owner) → ok −9 → the borrower is put on the street next to the car; owner leaves → −8. Owner's side: borrower gone → car stays at the borrower's last driving pose.
- Rules: new top-level `borrow` (q/a/r: `.read` only by `$to`, writes only by `$from`; q needs both in the world and no block). A parent must paste them again.
- world-test 8b covers it (two fake phones).

