// Локальный просмотр версии для планшета: node tablet/serve.js  →  http://localhost:4173/
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };
http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(4173, () => console.log("http://localhost:4173/"));
