/** Minimal native-save bridge; the renderer has no Node access. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zeeoneDesktop', {
  isElectron: true,
  chooseSavePath: options => ipcRenderer.invoke('zeeone:choose-save-path', options),
  writeFile: options => ipcRenderer.invoke('zeeone:write-file', options),
});
