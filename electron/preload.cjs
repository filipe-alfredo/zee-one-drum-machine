/** Minimal native file bridge; the renderer has no Node access. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zeeoneDesktop', {
  isElectron: true,
  chooseSavePath: options => ipcRenderer.invoke('zeeone:choose-save-path', options),
  chooseOpenPath: options => ipcRenderer.invoke('zeeone:choose-open-path', options),
  readFile: options => ipcRenderer.invoke('zeeone:read-file', options),
  writeFile: options => ipcRenderer.invoke('zeeone:write-file', options),
  getLastWorkspace: () => ipcRenderer.invoke('zeeone:get-last-workspace'),
  setLastWorkspace: options => ipcRenderer.invoke('zeeone:set-last-workspace', options),
});
