// Bridge between the game (a normal web page) and the desktop app. Only these few calls are exposed.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('stickApp', {
  platform: process.platform,
  writeSave: (slot, json) => ipcRenderer.send('save:write', slot, json),
  deleteSave: slot => ipcRenderer.send('save:delete', slot),
  readSave: slot => ipcRenderer.sendSync('save:read', slot),
  openSaveFolder: () => ipcRenderer.send('save:folder'),
  quit: () => ipcRenderer.send('app:quit'),
});
