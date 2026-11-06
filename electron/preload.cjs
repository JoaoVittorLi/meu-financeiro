'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Exposição mínima: nada de ipcRenderer genérico ou acesso a arquivos pelo renderer.
contextBridge.exposeInMainWorld('financeDesktop', Object.freeze({
  load: (profile) => ipcRenderer.invoke('finance:load',profile),
  save: (profile,data) => ipcRenderer.invoke('finance:save',profile,data),
  info: () => ipcRenderer.invoke('finance:info'),
  backupSQLite: () => ipcRenderer.invoke('finance:backup'),
  openDataFolder: () => ipcRenderer.invoke('finance:open-data-folder')
}));
