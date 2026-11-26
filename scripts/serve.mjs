/**
 * Zero-dependency static server for local development.
 *
 * This script is NOT part of the application: it only serves files over HTTP
 * so the browser can load the ES Modules. The app itself remains browser-only.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT, 10) || 8765;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.wav', 'audio/wav'],
  ['.woff2', 'font/woff2'],
  ['.mp3', 'audio/mpeg'],
]);

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative || 'index.html');

  // Prevent path traversal outside the project directory.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

const server = createServer(async (request, response) => {
  try {
    const urlPath = new URL(request.url, 'http://localhost').pathname;
    let filePath = resolveRequestPath(urlPath);
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    let stats;
    try {
      stats = await readFile(filePath);
    } catch (_) {
      // Directory requests fall back to index.html.
      filePath = path.join(filePath, 'index.html');
      stats = await readFile(filePath);
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.byteLength,
    });
    response.end(request.method === 'HEAD' ? undefined : stats);
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop that server or run: PORT=9000 npm start`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ZeeOne Drum Machine: http://127.0.0.1:${port}/index.html`);
  console.log('Press Ctrl+C to stop.');
});
