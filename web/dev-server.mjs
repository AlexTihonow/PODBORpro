import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 5173);
// API_URL=http://localhost:8080 — проксировать /api на Go-сервер и работать с
// настоящей базой. Без API_URL клиент работает в демо-режиме (заглушки в браузере).
const apiUrl = process.env.API_URL ? new URL(process.env.API_URL) : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function proxy(request, response) {
  const target = new URL(request.url ?? "/", apiUrl);
  const send = target.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = send(
    target,
    { method: request.method, headers: { ...request.headers, host: target.host } },
    (res) => {
      response.writeHead(res.statusCode ?? 502, res.headers);
      res.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    console.error(`API ${request.method} ${request.url}: ${error.message}`);
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { code: "bad_gateway", message: `Сервер API недоступен (${apiUrl.origin})` } }));
  });
  request.pipe(upstream);
}

function sendIndex(response, file) {
  let html = readFileSync(file, "utf8");
  if (apiUrl) {
    html = html.replace("<head>", `<head>\n    <script>window.PODBOR_CONFIG = { useStubs: false };</script>`);
  }
  response.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
  response.end(html);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (apiUrl && (pathname === "/api" || pathname.startsWith("/api/"))) {
    proxy(request, response);
    return;
  }

  let file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!file.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(pathname)) {
      response.writeHead(404).end("Not found");
      return;
    }
    file = join(root, "index.html");
  }

  if (file === join(root, "index.html")) {
    sendIndex(response, file);
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, () => {
  const mode = apiUrl ? `API → ${apiUrl.origin}` : "демо-режим";
  console.log(`ПОДБОРпро: http://localhost:${port} (${mode})`);
});
