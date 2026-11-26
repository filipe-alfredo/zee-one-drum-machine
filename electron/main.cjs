/**
 * Electron shell for the browser-only renderer.
 *
 * ES Modules cannot be loaded from file://, so the main process serves the
 * project over a random loopback port (never 8765/8766/8777). The renderer
 * itself keeps using plain browser APIs plus the narrow save-file bridge in
 * preload.cjs.
 */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SMOKE = process.argv.includes('--smoke') || process.env.ZEEONE_SMOKE === '1';

const MIME_TYPES = new Map([
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

const pendingSaves = new Map();
let staticServer = null;
let mainWindow = null;

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

function createStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const urlPath = new URL(request.url, 'http://localhost').pathname;
        let filePath = resolveRequestPath(urlPath);
        if (!filePath) {
          response.writeHead(403).end('Forbidden');
          return;
        }

        try {
          await fs.access(filePath);
        } catch (_) {
          filePath = path.join(filePath, 'index.html');
        }

        const data = await fs.readFile(filePath);
        const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase())
          || 'application/octet-stream';
        response.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
          'Cache-Control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : data);
      } catch (_) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      }
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function registerSaveHandlers() {
  ipcMain.handle('zeeone:choose-save-path', async (event, options = {}) => {
    const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showSaveDialog(parent, {
      title: options.title || 'Save file',
      defaultPath: options.suggestedName || 'export.wav',
      buttonLabel: 'Save',
      filters: Array.isArray(options.filters) ? options.filters : [{ name: 'All files', extensions: ['*'] }],
      properties: ['showOverwriteConfirmation'],
    });

    if (result.canceled || !result.filePath) return { canceled: true };

    const requestId = `save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingSaves.set(requestId, result.filePath);
    return {
      canceled: false,
      requestId,
      name: path.basename(result.filePath),
    };
  });

  ipcMain.handle('zeeone:write-file', async (_event, { requestId, data } = {}) => {
    const filePath = pendingSaves.get(requestId);
    if (!filePath) throw new Error('The chosen save location is no longer available.');

    const bytes = Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data));
    await fs.writeFile(filePath, bytes);
    pendingSaves.delete(requestId);
    return { saved: true, bytes: bytes.length };
  });
}

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'ZeeOne Drum Machine',
    backgroundColor: '#0b0b0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('ZeeOne Electron renderer loaded.');
    try {
      const features = await mainWindow.webContents.executeJavaScript(`({
        savePicker: typeof window.showSaveFilePicker,
        openPicker: typeof window.showOpenFilePicker,
        desktopBridge: Boolean(window.zeeoneDesktop)
      })`);
      console.log('ZeeOne Electron file APIs:', JSON.stringify(features));
    } catch (error) {
      console.error('Could not inspect file APIs:', error);
    }
    if (SMOKE) {
      setTimeout(() => app.quit(), 500);
    }
  });

  await mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  try {
    staticServer = await createStaticServer();
    const { port } = staticServer.address();
    registerSaveHandlers();
    await createWindow(`http://127.0.0.1:${port}/index.html`);
  } catch (error) {
    console.error('Could not start ZeeOne Drum Machine:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && staticServer) {
    const { port } = staticServer.address();
    createWindow(`http://127.0.0.1:${port}/index.html`).catch(error => console.error(error));
  }
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  pendingSaves.clear();
});
