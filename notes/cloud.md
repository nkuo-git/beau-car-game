# Login + cloud saves (2026-10-09)

Nick: 「要做登入功能 讓每個人資料存在雲端」 → his own Firebase project `beau-car-game`, Google sign-in (no password; picked on a card), mock approved ("好"):
https://claude.ai/artifact/MGRTHMPeLjNTEvcJzZtmpq

## Where it lives
- `src/site/cloud.js`: the whole feature, a block appended to `game.js` after `site.js` (both the main and the /try/ builds). Shipped to the main site as content 3 (2026-10-09); first trialed on /try/.
- UI: `src/site/index.src.html` (`#cloudChip` in the app bar and the `#cloudDlg` sheet: 登入 / 帳號 / 要用哪一個進度？) plus `.cloudchip`/`.cl-*` in `site.css`. Without cloud.js, the chip stays `hidden`.
- `garage.src.html` `save()` fires `window` event `beau-save` after writing `carid.tune`. cloud.js debounces it by 2.5 s and uploads.

## Firebase
- Web config (public) is in cloud.js. The SDK is lazy-imported from `https://www.gstatic.com/firebasejs/10.14.1/` (app, auth, firestore-lite), only once signed in or on tapping 登入.
- Firestore `saves/{uid}` = `{v:1, t, keys:{the 6 migration keys, raw strings}, sum:{money,cars,cups}}`. Rules: owner read/write only.
- Authorized domain: `nkuo-git.github.io`.

## Sync rules
Local meta `beau.cloud` = `{uid, email, h}`, where `h` is the hash of `carid.tune` at the last moment local == cloud. On sign-in or open, it reads the cloud doc:
- **Cloud empty**: upload.
- **Equal**: nothing to do.
- **Local empty, or local unchanged since `h`**: apply the cloud copy (write the keys, block `setItem`, `location.replace`).
- **Cloud unchanged since `h`**: upload.
- **Otherwise** (both changed, or first sign-in on this device): ask 用雲端的 / 用這支手機的 (the second overwrites the cloud).

Other behavior:
- Uploads skip when `carid.tune` still hashes to `h`. This saves Firestore writes, since the game saves on boot.
- Offline or a failed write sets `dirty`, then retries on `online` and `visibilitychange`.
- Logging out keeps local progress.

## App (Android WebView)
Google blocks web sign-in inside WebViews, so the shell does it natively:
- `BeauCarApp.googleSignIn()` uses Credential Manager `GetSignInWithGoogleOption` with the **web** client ID `793707590323-fv2r1c0gu48qr3qulsrmr5f0dms22njk.apps.googleusercontent.com`.
- The result goes to `window.beauGoogleSignIn(idToken, err)`, where err is `cancel` / `noacct` / `fail`. The web side then calls `signInWithCredential(GoogleAuthProvider.credential(idToken))`.
- An old shell (no `googleSignIn`) shows 「要先更新 App 才能登入…」.
- Needs an **Android app in the Firebase project**: package `com.nkuo.beaucargame` plus the release cert SHA-1 `D6:1F:9B:DC:CE:50:E6:F6:27:ED:DB:07:4A:B6:C2:88:CC:74:3D:66`. This is public. It was read from the public apk-2 APK's v2 signing block, not from the keystore. Without it, Credential Manager returns a developer error and the shell sends `fail`.
- Shipped with content 3: the merge to main released apk-4 (apk-3 was a branch-only compile check).
- `.github/workflows/android.yml`: only main creates a Release. `workflow_dispatch` on another branch just compiles and uploads the artifact.

## /try/ page
- `docs/try/` = trial build for things that need the real network (the artifact CSP blocks Firebase). It has 「（試玩）」 in the title, noindex, and no service worker. It reuses main's `docs/tune/*.glb` via `../tune/`.
- Same origin as the main site, so it **shares localStorage** (same save) in a browser.
- The root `sw.js` now only handles navigations to its own home page, so /try/ never overwrites its cache. The content 2 SW deployed before this lacks that guard: offline-only risk until the next 上線.

## Test
`node cloud-test.mjs ../docs/try ../out/cloud/cloud` → 20 ok. It uses a fake backend (`window.__beauCloudBackend`) with the cloud kept in Node, two "phones" (one open at a time), offline, old and new app shells.
