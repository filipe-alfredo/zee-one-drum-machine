import { downloadBlob } from './helpers.js';

/**
 * Save-target abstraction shared by WAV exports.
 *
 * The target is requested BEFORE the (asynchronous) offline audio render so a
 * browser keeps its transient user activation. Electron supplies a native
 * dialog through the preload bridge; browsers use the File System Access API.
 * Browsers without either API fall back to a normal download.
 */

function hasDesktopBridge() {
  return typeof window !== 'undefined'
    && Boolean(window.zeeoneDesktop)
    && typeof window.zeeoneDesktop.chooseSavePath === 'function';
}

function hasPickerApi() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/** Ask where to save. Returns null when the user cancels. */
export async function requestSaveTarget({
  suggestedName,
  description = 'File',
  mimeType = 'application/octet-stream',
  extensions = [],
}) {
  if (hasDesktopBridge()) {
    const choice = await window.zeeoneDesktop.chooseSavePath({
      title: `Save ${description}`,
      suggestedName,
      filters: [{ name: description, extensions }],
    });
    if (!choice || choice.canceled) return null;
    return {
      method: 'desktop',
      requestId: choice.requestId,
      name: choice.name || suggestedName,
    };
  }

  if (hasPickerApi()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description,
          accept: { [mimeType]: extensions.map(extension => `.${extension}`) },
        }],
      });
      if (!handle) return null;
      return {
        method: 'picker',
        handle,
        name: handle.name || suggestedName,
      };
    } catch (error) {
      if (error && error.name === 'AbortError') return null;
      throw error;
    }
  }

  return { method: 'download', name: suggestedName };
}

/** Write the rendered blob to the target chosen above. */
export async function writeSaveTarget(target, blob, { toast = null, successMessage = null } = {}) {
  if (!target) return false;

  try {
    if (target.method === 'desktop') {
      if (typeof window.zeeoneDesktop.writeFile !== 'function') {
        throw new Error('The desktop save bridge is unavailable.');
      }
      await window.zeeoneDesktop.writeFile({
        requestId: target.requestId,
        data: await blob.arrayBuffer(),
      });
    } else if (target.method === 'picker') {
      if (typeof target.handle.createWritable !== 'function') {
        throw new Error('This browser cannot write to files.');
      }
      const writable = await target.handle.createWritable();
      try {
        await writable.write(blob);
      } catch (error) {
        if (typeof writable.abort === 'function') await writable.abort();
        throw error;
      }
      await writable.close();
    } else {
      downloadBlob(blob, target.name);
    }

    const message = typeof successMessage === 'function'
      ? successMessage(target.name)
      : `Saved ${target.name}`;
    if (toast) toast.show(message);
    return true;
  } catch (error) {
    if (toast) toast.show(`Could not save ${target.name}: ${error.message}`);
    return false;
  }
}
