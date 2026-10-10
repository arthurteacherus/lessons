// Сервис-воркер: после первой загрузки программа открывается и работает без интернета.
// Стратегия: сначала из кэша, а свежую версию тихо подтягиваем в фоне (обновление — со 2-го запуска).
// Версию сборки и список файлов подставляет build.js.
const CACHE = "lc-__BUILD__";
const ASSETS = __ASSETS__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lc-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Яндекс.Диск и прочее — напрямую
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : null);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || new Response("Нет сети, а страницы нет в кэше", { status: 503 });
    })
  );
});
