/* ============================================================
   서비스 워커 — 오프라인에서도 앱이 열리게 한다
   ------------------------------------------------------------
   지하철이나 데이터가 안 터지는 곳에서도 문제를 풀 수 있어야 하니
   앱을 이루는 파일 전부를 미리 받아 둔다.

   파일을 고치면 아래 CACHE 버전을 올려야 브라우저가 새로 받는다.
   ============================================================ */

var CACHE = "examhub-v10";

/* 스코프 기준 상대 경로 — GitHub Pages 하위 경로에서도 그대로 동작한다 */
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",

  "./app/",
  "./app/index.html",
  "./app/css/style.css",
  "./app/data/curriculum.js",
  "./app/data/questions.js",
  "./app/js/store.js",
  "./app/js/app.js",
  "./app/js/calendar.js",
  "./app/js/gcal.js",
  "./app/js/sync.js",
  "./app/js/views/home.js",
  "./app/js/views/schedule.js",
  "./app/js/views/plan.js",
  "./app/js/views/quiz.js",
  "./app/js/views/weakness.js",
  "./app/js/views/review.js",
  "./app/js/views/stats.js",
  "./app/js/views/import.js",
  "./app/js/views/editor.js",
  "./app/js/views/account.js",
  "./app/js/views/data.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 하나라도 실패하면 통째로 실패하지 않도록 개별로 받는다 */
      return Promise.all(ASSETS.map(function (url) {
        return c.add(url).catch(function (err) {
          console.warn("캐시 실패:", url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN 등 외부는 건드리지 않는다

  /* HTML 은 브라우저 캐시를 건너뛰고 받는다.
     GitHub Pages 가 HTML 에 10분짜리 캐시를 걸어 두는데, 그 사이에는
     새로 올린 화면 대신 예전 HTML 이 나온다. 예전 HTML 은 예전 ?v= 를
     가리키므로 고친 게 전혀 반영되지 않는다. */
  var netReq = (req.mode === "navigate" || req.destination === "document")
    ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" })
    : req;

  /* 네트워크를 먼저 보되, 안 되면 캐시로 — 새 배포를 빨리 반영하면서 오프라인도 된다 */
  e.respondWith(
    fetch(netReq).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      /* ignoreSearch: 페이지는 js/store.js?v=10 처럼 버전을 붙여 부르는데
         미리 받아 둔 건 ?v= 가 없는 주소다. 쿼리를 무시하고 찾아야 맞물린다. */
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        /* 앱 내부 경로면 앱 껍데기라도 돌려준다 */
        if (req.mode === "navigate") {
          return caches.match("./app/index.html") || caches.match("./index.html");
        }
      });
    })
  );
});
