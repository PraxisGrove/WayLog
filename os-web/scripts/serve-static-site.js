const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requestedDir = process.argv[2] ?? ".";
const publicDir = path.resolve(root, requestedDir);
const port = Number(process.env.PORT ?? 4173);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function getFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const cleanPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(publicDir, "." + cleanPath);

  if (!filePath.startsWith(publicDir)) {
    return undefined;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  const filePath = getFilePath(request.url ?? "/");

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(ext) ?? "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`WayLog official site running at http://localhost:${port}`);
});
