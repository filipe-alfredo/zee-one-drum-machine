/**
 * Save-target abstraction shared by WAV exports.
 *
 * The target is requested BEFORE the (asynchronous) offline audio render so a
 * browser keeps its transient user activation. Electron supplies a native
 * dialog through the preload bridge; browsers use the File System Access API.
 * Without either API, a regular browser download is used instead: there is no
 * chosen folder or write-back handle, but the export still works everywhere.
 */

function hasDesktopBridge() {
  return typeof window !== 'undefined'
    && Boolean(window.zeeoneDesktop)
    && typeof window.zeeoneDesktop.chooseSavePath === 'function';
}

function hasPickerApi() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/** Last-resort save target: let the browser handle the download. */
export function downloadBlob(blob, name) {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
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
    } else if (target.method === 'download') {
      if (!downloadBlob(blob, target.name)) {
        throw new Error('This browser cannot download files.');
      }
    } else {
      throw new Error(`Unsupported save target: ${target.method}`);
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
