/**
 * File-based workspace persistence built on the browser File System Access API.
 *
 * There is no localStorage auto-save. A workspace is only persisted after the
 * user saves it to a file (or opens an existing one). While a file handle is
 * active, mutations are written back to that same file, so repeated saves do
 * not create "workspace (2).json", "(3).json" etc.
 *
 * The last handle is kept in IndexedDB so the startup dialog can offer to
 * reopen it. Handles cannot be stored in localStorage.
 */

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
    const handle = await readLastHandle();
    return handle ? { name: handle.name || 'workspace.json' } : null;
  }

  setHandle(handle) {
    this.handle = handle;
    this.onStatus(handle ? `Saved: ${handle.name}` : 'No workspace file');
    if (handle) writeLastHandle(handle).catch(() => {});
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
    if (!hasPickerApi()) {
      this.toast.show('Saving to a file requires Chrome or Edge (File System Access API).');
      return false;
    }

    try {
      let handle = this.handle;
      if (!handle || saveAs) {
        handle = await window.showSaveFilePicker({
          suggestedName: this.handle ? this.handle.name : 'zeeone_drum_workspace.json',
          types: [{ description: 'ZeeOne Workspace', accept: { 'application/json': ['.json'] } }],
        });
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

  /** Open a workspace and keep its handle for future writes. */
  async open() {
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

  /** Reopen the last workspace; permission is requested from the click gesture. */
  async openLast() {
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
