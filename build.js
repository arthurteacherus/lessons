// Сборка версии для планшета из ТОЙ ЖЕ программы, что и на ноутбуке:
//   node build.js        → создаёт папку tablet/dist (её содержимое загружается на GitHub Pages)
// Исходники ноутбучной версии (desktop-app) не изменяются — из них только читаем.
// Что делает: компилирует интерфейс (JSX → JS) заранее, подключает слой для браузера (platform.js),
// переключатель «Палец/Мышь» (tablet-ui.js), манифест и сервис-воркер (работа без интернета).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "desktop-app", "renderer");
const OUT = path.join(__dirname, "dist");

global.window = global;
global.self = global;
global.document = { addEventListener() {} };
const Babel = require(path.join(SRC, "vendor", "babel.min.js"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "vendor", "fonts"), { recursive: true });

const html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) throw new Error("Не найден скрипт приложения в desktop-app/renderer/index.html");
const appJs = Babel.transform(m[1], { presets: ["react"] }).code;
fs.writeFileSync(path.join(OUT, "app.js"), appJs, "utf8");

const md5Src = fs.readFileSync(path.join(__dirname, "md5.js"), "utf8");
const platformSrc = fs.readFileSync(path.join(__dirname, "platform.js"), "utf8");
fs.writeFileSync(path.join(OUT, "platform.js"), md5Src + "\n" + platformSrc, "utf8");
fs.copyFileSync(path.join(__dirname, "tablet-ui.js"), path.join(OUT, "tablet-ui.js"));
fs.copyFileSync(path.join(__dirname, "manifest.webmanifest"), path.join(OUT, "manifest.webmanifest"));
fs.copyFileSync(path.join(__dirname, "icon-192.png"), path.join(OUT, "icon-192.png"));
fs.copyFileSync(path.join(__dirname, "icon-512.png"), path.join(OUT, "icon-512.png"));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

// vendor: React, шрифты, логотип (без тяжёлого Babel — он тут не нужен)
for (const f of ["react.production.min.js", "react-dom.production.min.js", "logo.png"]) {
  fs.copyFileSync(path.join(SRC, "vendor", f), path.join(OUT, "vendor", f));
}
for (const f of fs.readdirSync(path.join(SRC, "vendor", "fonts"))) {
  fs.copyFileSync(path.join(SRC, "vendor", "fonts", f), path.join(OUT, "vendor", "fonts", f));
}

// index.html: заменить Babel и текстовый скрипт на готовые файлы + подключения PWA
let page = html
  .replace('<script src="vendor/babel.min.js"></script>', "")
  .replace(/<script type="text\/babel"[^>]*>[\s\S]*?<\/script>/, '<script src="platform.js"></script>\n<script src="tablet-ui.js"></script>\n<script src="app.js"></script>');
page = page.replace(
  "</head>",
  `<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#132c53">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
</head>`
);
page = page.replace(
  "</body>",
  `<script>if ("serviceWorker" in navigator) { var hadController = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener("controllerchange", function () { if (hadController) location.reload(); }); window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }</script>
</body>`
);
fs.writeFileSync(path.join(OUT, "index.html"), page, "utf8");

// сервис-воркер со списком файлов и версией сборки
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== ".nojekyll") files.push(path.relative(OUT, p).split(path.sep).join("/"));
  }
})(OUT);
const hash = crypto.createHash("sha1");
files.forEach((f) => hash.update(fs.readFileSync(path.join(OUT, f))));
const build = hash.digest("hex").slice(0, 10);
const assets = ["./", ...files.filter((f) => f !== "sw.js")];
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8").split("__BUILD__").join(build).split("__ASSETS__").join(JSON.stringify(assets));
fs.writeFileSync(path.join(OUT, "sw.js"), sw, "utf8");

const total = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`Готово: ${path.relative(ROOT, OUT)} — ${files.length + 1} файлов, ${(total / 1024 / 1024).toFixed(1)} МБ, сборка ${build}`);
