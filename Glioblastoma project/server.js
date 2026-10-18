import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleGuidance } from "./api/guidance.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const staticFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/upload.css", "upload.css"],
  ["/dist/", "dist/index.html"],
  ["/dist/index.html", "dist/index.html"],
  ["/dist/app.js", "dist/app.js"],
  ["/dist/upload.css", "dist/upload.css"],
]);

async function readLimitedBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new RangeError("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/guidance") {
    if (request.method !== "POST") return sendJson(response, 405, { error: "Use POST." });
    let body;
    try {
      body = await readLimitedBody(request, 4096);
    } catch (error) {
      return sendJson(response, error instanceof RangeError ? 413 : 400, { error: "Request could not be read." });
    }
    const headers = new Headers(request.headers);
    headers.set("x-real-ip", request.socket.remoteAddress || "local");
    const webRequest = new Request(`http://${request.headers.host || "localhost"}/api/guidance`, {
      method: request.method,
      headers,
      body,
    });
    try {
      const result = await handleGuidance(webRequest);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch {
      sendJson(response, 500, { error: "The guidance service is temporarily unavailable." });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const relativePath = staticFiles.get(url.pathname);
  if (!relativePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const filePath = path.join(projectRoot, relativePath);
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": contents.length,
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`AfterScan ready at http://127.0.0.1:${port}`);
});
