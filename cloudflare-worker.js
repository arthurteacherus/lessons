// Посредник для планшетной версии «Конструктора уроков» (Cloudflare Workers, бесплатный тариф).
// Зачем: Яндекс.Диск не разрешает браузеру напрямую скачивать/загружать содержимое файла (CORS).
// Этот маленький сервис передаёт запрос на серверы Яндекса и возвращает ответ браузеру.
// Что он НЕ делает: не хранит данные, не видит ваш токен Яндекса (ссылки на скачивание/загрузку уже
// подписаны Яндексом), отвечает только странице arthurteacherus.github.io и ходит только на
// серверы скачивания/загрузки Яндекс.Диска.
const ALLOWED_ORIGIN = "https://arthurteacherus.github.io";

function hostAllowed(host) {
  return /^(downloader|uploader[\w-]*)\.disk\.yandex\.(ru|net|com)$/.test(host) || /^uploader[\w.-]*\.yandex\.(net|ru)$/.test(host);
}

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.headers.get("Origin") !== ALLOWED_ORIGIN) return new Response("forbidden", { status: 403 });

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get("u"));
    } catch (e) {
      return new Response("bad url", { status: 400, headers: cors });
    }
    if (target.protocol !== "https:" || !hostAllowed(target.hostname)) {
      return new Response("host not allowed", { status: 403, headers: cors });
    }

    const init = { method: request.method, redirect: "follow" };
    if (request.method === "PUT") init.body = await request.arrayBuffer();
    const upstream = await fetch(target.toString(), init);

    const headers = new Headers(cors);
    const type = upstream.headers.get("Content-Type");
    if (type) headers.set("Content-Type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
