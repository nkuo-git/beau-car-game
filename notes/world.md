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
- Max 16 at once: 「世界滿了（最多 16 個人），等一下再來。」

## Data (Realtime Database)
```
world/s/{0..15}   uid                                  (16 slots = capacity)
world/m/{uid}     {n, car, l, ch, s, j, w, inv}
world/p/{uid}     {t, x, z, h, v, o, k, rp, rs}        8/s moving, heartbeat 1.5 s / 3 s
world/e/{uid}     {e, t}
world/bl/{uid}/{other}   other's name                  (block)
world/ch/{to}/{from}     {kind, t, id}                 (invite)
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
- net.src.js draws all name boards as one mesh with one canvas atlas (1 draw call) while in the world: slot 1 = you (orange 「名字（你）」), then online people in join order (「小明的車庫」), the rest 「空的」. Offline the boards stay blank.
- Stop (under 4 m/s) within 6 m of a door: button 「🚗 看小明的車庫」 → the site drives you home and opens the garage visit (world.js `visitStreet`); your own slot says 「🏠 回你的車庫」.
- Walking view on the street: ~59 draw calls, 0.21 M triangles.
