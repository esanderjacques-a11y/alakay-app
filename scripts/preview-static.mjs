import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const publicDir = join(root, "public");
const nextStaticDir = join(root, ".next", "static");
const appDir = join(root, ".next", "server", "app");
const logPath = join(root, "preview-static.log");

function log(message) {
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}

process.on("uncaughtException", (error) => {
  log(`uncaught: ${error.stack || error.message}`);
});

process.on("unhandledRejection", (error) => {
  log(`unhandled: ${error?.stack || error}`);
});

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath)
    .on("error", (error) => {
      log(`stream error: ${error.stack || error.message}`);
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end("Server error");
    })
    .pipe(response);
}

function safeJoin(base, requestPath) {
  const filePath = normalize(join(base, requestPath));
  return filePath.startsWith(base) ? filePath : null;
}

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/_next/static/")) {
    const filePath = safeJoin(nextStaticDir, pathname.replace("/_next/static/", ""));
    return filePath ? sendFile(response, filePath) : response.end("Not found");
  }

  const publicPath = safeJoin(publicDir, pathname.replace(/^\//, ""));
  if (publicPath && existsSync(publicPath) && statSync(publicPath).isFile()) {
    return sendFile(response, publicPath);
  }

  return sendFile(response, join(appDir, "index.html"));
}).listen(port, () => {
  log(`Static preview ready at http://localhost:${port}`);
});
