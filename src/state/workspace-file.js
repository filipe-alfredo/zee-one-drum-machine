/**
 * File-based workspace persistence built on the browser File System Access API.
 *
 * There is no localStorage auto-save. A workspace is only persisted after the
 * user saves it to a file (or opens an existing one). While a file handle is
 * active, mutations are written back to that same file, so repeated saves do
 * not create "workspace (2).json", "(3).json" etc.
 *
 * The last handle is kept in IndexedDB so the startup dialog can offer to
 * reopen it. Handles cannot be stored in localStorage. Browsers without the
 * picker API still get a plain JSON download; it can be imported again, but
 * there is no handle to write back to.
 */

import { downloadBlob } from '../utils/file-output.js';

const DB_NAME = 'zeeone_drum_machine';
const STORE_NAME = 'workspace-files';
const LAST_HANDLE_KEY = 'last';
const WRITE_DELAY_MS = 120;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (_) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readLastHandle() {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(LAST_HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
    } catch (_) {
      database.close();
      resolve(null);
    }
  });
}

async function writeLastHandle(handle) {
  const database = await openDatabase();
  if (!database) return;
  await new Promise(resolve => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(handle, LAST_HANDLE_KEY);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); resolve(); };
    } catch (_) {
      database.close();
      resolve();
    }
  });
}

function hasPickerApi() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

const DESKTOP_METHODS = [
  'chooseSavePath', 'chooseOpenPath', 'readFile', 'writeFile',
  'getLastWorkspace', 'setLastWorkspace',
];

/** Electron keeps workspace paths in the main process, not in origin-bound IDB. */
function getDesktopApi() {
  if (typeof window === 'undefined' || !window.zeeoneDesktop) return null;
  const api = window.zeeoneDesktop;
  return DESKTOP_METHODS.every(name => typeof api[name] === 'function') ? api : null;
}

function baseName(filePath) {
  return String(filePath).split(/[\\/]/).pop() || 'workspace.json';
}

/** A FileSystemFileHandle-shaped adapter over the native save/open bridge. */
function createDesktopHandle(api, info) {
  const filePath = info && info.filePath;
  if (!filePath) return null;

  return {
    name: (info && info.name) || baseName(filePath),
    filePath,
    async getFile() {
      const text = await api.readFile({ filePath });
      return { text: async () => text };
    },
    async createWritable() {
      let aborted = false;
      return {
        async write(data) {
          if (aborted) return;
          const text = typeof data === 'string' ? data : await data.text();
          await api.writeFile({
            filePath,
            data: new TextEncoder().encode(text).buffer,
          });
        },
        async close() {},
        async abort() { aborted = true; },
      };
    },
  };
}

async function requestWritePermission(handle) {
  if (typeof handle.requestPermission !== 'function') return true;
  const result = await handle.requestPermission({ mode: 'readwrite' });
  return result === 'granted';
}

export class WorkspaceFileController {
  constructor({ state, toast, onStatus, onWorkspaceLoaded }) {
    this.state = state;
    this.toast = toast;
    this.onStatus = onStatus || (() => {});
    this.onWorkspaceLoaded = onWorkspaceLoaded || (() => {});
    this.handle = null;
    this.writeTimer = null;
    this.writing = false;
    this.writeQueued = false;
  }

  get fileName() {
    return this.handle ? this.handle.name : null;
  }

  /** Info used by the startup dialog to enable the "Open Last" button. */
  async getLastInfo() {
    const desktop = getDesktopApi();
    if (desktop) {
      const info = await desktop.getLastWorkspace();
      return info ? { name: info.name || baseName(info.filePath) } : null;
    }
    const handle = await readLastHandle();
    return handle ? { name: handle.name || 'workspace.json' } : null;
  }

  setHandle(handle) {
    this.handle = handle;
    this.onStatus(handle ? `Saved: ${handle.name}` : 'No workspace file');
    const desktop = getDesktopApi();
    if (desktop && handle && handle.filePath) {
      desktop.setLastWorkspace({ filePath: handle.filePath }).catch(() => {});
    } else if (!desktop && handle) {
      writeLastHandle(handle).catch(() => {});
    }
  }

  clearHandle() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = null;
    this.handle = null;
    this.writeQueued = false;
    this.onStatus('No workspace file');
  }

  /** Called by AppState.persist() after every mutation. */
  notifyChanged() {
    if (!this.handle || this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, WRITE_DELAY_MS);
  }

  serialize() {
    return `${JSON.stringify(this.state.getExportData(), null, 2)}\n`;
  }

  async writeTo(handle) {
    if (!handle || typeof handle.createWritable !== 'function') {
      throw new Error('This browser cannot write to files.');
    }
    const desktop = getDesktopApi();
    if (desktop && handle.filePath) {
      await desktop.writeFile({
        filePath: handle.filePath,
        data: new TextEncoder().encode(this.serialize()).buffer,
      });
      return;
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(this.serialize());
    } catch (error) {
      if (typeof writable.abort === 'function') await writable.abort();
      throw error;
    }
    await writable.close();
  }

  /** Debounced writeback while a workspace file is open. */
  async flush() {
    if (!this.handle) return;
    if (this.writing) {
      this.writeQueued = true;
      return;
    }

    this.writing = true;
    try {
      await this.writeTo(this.handle);
      this.onStatus(`Auto-Saved: ${this.handle.name}`);
    } catch (error) {
      this.toast.show(`Could not auto-save: ${error.message}`);
    } finally {
      this.writing = false;
      if (this.writeQueued) {
        this.writeQueued = false;
        this.flush();
      }
    }
  }

  /** Save to the open file, or pick a file on the first save. */
  async save({ saveAs = false } = {}) {
    const desktop = getDesktopApi();
    if (!desktop && !hasPickerApi()) {
      const name = (this.handle && this.handle.name) || 'zeeone_drum_workspace.json';
      const blob = new Blob([this.serialize()], { type: 'application/json' });
      if (!downloadBlob(blob, name)) {
        this.toast.show('This browser cannot download the workspace file.');
        return false;
      }
      this.toast.show(`Workspace downloaded: ${name} (open it to enable auto-save)`);
      return true;
    }

    try {
      let handle = this.handle;
      if (!handle || saveAs) {
        const suggestedName = this.handle ? this.handle.name : 'zeeone_drum_workspace.json';
        if (desktop) {
          const choice = await desktop.chooseSavePath({
            title: 'Save workspace',
            suggestedName,
            filters: [{ name: 'ZeeOne Workspace', extensions: ['json'] }],
          });
          if (!choice || choice.canceled) return false;
          handle = createDesktopHandle(desktop, choice);
        } else {
          handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description: 'ZeeOne Workspace', accept: { 'application/json': ['.json'] } }],
          });
        }
      }
      if (!handle) return false;

      await this.writeTo(handle);
      this.setHandle(handle);
      this.toast.show(`Workspace saved: ${handle.name}`);
      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      this.toast.show(`Could not save workspace: ${error.message}`);
      return false;
    }
  }

  async loadFrom(handle) {
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    if (!this.state.importWorkspace(data)) {
      this.toast.show('Invalid ZeeOne Workspace file');
      return false;
    }
    await this.onWorkspaceLoaded();
    return true;
  }

  /** Open a workspace and keep its handle/path for future writes. */
  async open() {
    const desktop = getDesktopApi();
    if (desktop) {
      try {
        const choice = await desktop.chooseOpenPath({
          title: 'Open workspace',
          filters: [{ name: 'ZeeOne Workspace', extensions: ['json'] }],
        });
        if (!choice || choice.canceled) return false;
        const handle = createDesktopHandle(desktop, choice);
        if (!handle) return false;

        this.clearHandle();
        if (!await this.loadFrom(handle)) return false;
        this.setHandle(handle);
        this.toast.show(`Workspace loaded: ${handle.name}`);
        return true;
      } catch (error) {
        this.toast.show(`Could not open workspace: ${error.message}`);
        return false;
      }
    }

    if (typeof window === 'undefined' || typeof window.showOpenFilePicker !== 'function') return false;

    try {
      const handles = await window.showOpenFilePicker({
        types: [{ description: 'ZeeOne Workspace', accept: { 'application/json': ['.json'] } }],
      });
      const handle = handles && handles[0];
      if (!handle) return false;

      this.clearHandle();
      if (!await this.loadFrom(handle)) return false;
      this.setHandle(handle);
      this.toast.show(`Workspace loaded: ${handle.name}`);
      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      this.toast.show(`Could not open workspace: ${error.message}`);
      return false;
    }
  }

  /**
   * Reopen the last workspace. Electron reads the native path remembered by
   * the main process; browsers reuse the IndexedDB handle after asking for
   * permission from this click gesture.
   */
  async openLast() {
    const desktop = getDesktopApi();
    if (desktop) {
      try {
        const info = await desktop.getLastWorkspace();
        if (!info || !info.filePath) {
          this.toast.show('No recent workspace to open');
          return false;
        }
        const handle = createDesktopHandle(desktop, info);

        this.clearHandle();
        if (!await this.loadFrom(handle)) return false;
        this.setHandle(handle);
        this.toast.show(`Workspace loaded: ${handle.name}`);
        return true;
      } catch (error) {
        this.toast.show(`Could not open last workspace: ${error.message}`);
        return false;
      }
    }

    const handle = await readLastHandle();
    if (!handle) {
      this.toast.show('No recent workspace to open');
      return false;
    }

    try {
      if (!await requestWritePermission(handle)) {
        this.toast.show('Permission denied for the last workspace');
        return false;
      }
      this.clearHandle();
      if (!await this.loadFrom(handle)) return false;
      this.setHandle(handle);
      this.toast.show(`Workspace loaded: ${handle.name}`);
      return true;
    } catch (error) {
      this.toast.show(`Could not open last workspace: ${error.message}`);
      return false;
    }
  }

  /** Fallback for browsers without the picker API: import without a handle. */
  async openFile(file) {
    try {
      const data = JSON.parse(await file.text());
      this.clearHandle();
      if (!this.state.importWorkspace(data)) {
        this.toast.show('Invalid ZeeOne Workspace file');
        return false;
      }
      await this.onWorkspaceLoaded();
      this.toast.show('Workspace loaded (use Save As to enable auto-save)');
      return true;
    } catch (_) {
      this.toast.show('Invalid JSON workspace file');
      return false;
    }
  }
}
