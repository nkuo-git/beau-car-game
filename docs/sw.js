// 大便龍的改車遊戲 — Service Worker（build-site.mjs 從 src/site/sw.src.js 產生，不要直接改 docs/sw.js）
// 跟萬能軟體的 sw.js 同一個做法：殼先存起來（離線也打得開），新版先在旁邊待命，畫面上按了「更新」才接手（不自己更新）

const V = "4"; // 跟 index.html 裡 game.css／game.js 後面的 ?v= 一樣：換版就換網址，任何一層快取都不會給到舊檔
const CACHE = "beaucar-v" + V;
// 車身檔（tune/<車>.glb?h=<雜湊>）：網址帶內容的雜湊，車身沒改網址就不變 → 放在另一個不會隨版號清掉的快取，換版不用重新下載（每台 1–2 MB）
const GLB_CACHE = "beaucar-glb";
const GLB = ["./tune/supra-lod.glb?h=1ff75170", "./tune/gtr-lod.glb?h=4bd6b3dc", "./tune/gc8-lod.glb?h=19a13ada", "./tune/yaris-lod.glb?h=d9db9130", "./tune/p918-lod.glb?h=0ee9057b", "./tune/sp3-lod.glb?h=312b720a", "./tune/jesko-lod.glb?h=f98af4da", "./tune/monster-lod.glb?h=91f92e5f", "./tune/supra.glb?h=f69628b4", "./tune/gtr.glb?h=4f4f4a5c", "./tune/sp3.glb?h=dc0369f5", "./tune/jesko.glb?h=218ad737", "./tune/yaris.glb?h=97cc1c84", "./tune/gc8.glb?h=054e4976", "./tune/p918.glb?h=67c1216a", "./tune/monster.glb?h=d023a5e6"];

const SHELL = [
  "./",
  "./index.html",
  "./game.css?v=" + V,
  "./game.js?v=" + V,
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 一個檔失敗不讓整個安裝失敗；cache: "reload" 繞過瀏覽器自己的 HTTP 快取
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })))))
    // 不 skipWaiting：等畫面上的「更新」被按了才接手
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set(GLB.map((u) => new URL(u, self.registration.scope).href));
  event.waitUntil(
    caches.keys()
      // 只清自己的舊版（同一個網域上還有萬能軟體的快取，不能動）
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("beaucar-v") && k !== CACHE).map((k) => caches.delete(k))))
      // 車身檔：現在用不到的（舊的雜湊）才刪
      .then(() => caches.open(GLB_CACHE))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => !keep.has(r.url)).map((r) => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 查 App 有沒有新版（GitHub API）、登入和雲端存檔（Firebase：*.googleapis.com、*.firebaseapp.com）一律走網路
  if (url.hostname === "api.github.com" || /(^|\.)googleapis\.com$|(^|\.)firebaseapp\.com$/.test(url.hostname)) return;

  // 導覽：先連網，失敗才用快取的殼（離線時至少開得起來）；只管遊戲首頁（試玩頁 try/ 這種別的頁不要存成首頁）
  if (req.mode === "navigate") {
    const home = new URL("./", self.registration.scope).pathname;
    if (url.pathname !== home && url.pathname !== home + "index.html") return;
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || Response.error()))
    );
    return;
  }

  // 車身檔：有就直接用（網址帶雜湊，內容不會變）
  if (url.origin === self.location.origin && /\/tune\/[^/]+\.glb$/.test(url.pathname) && url.searchParams.has("h")) {
    event.respondWith(
      caches.open(GLB_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // 其他（CSS / JS / 圖示 / 字型 / CDN 上的 three.js）：先用快取，同時在背景更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
