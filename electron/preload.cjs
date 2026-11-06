'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Exposição mínima: nada de ipcRenderer genérico ou acesso a arquivos pelo renderer.
contextBridge.exposeInMainWorld('financeDesktop', Object.freeze({
  load: (profile) => ipcRenderer.invoke('finance:load',profile),
  save: (profile,data) => ipcRenderer.invoke('finance:save',profile,data),
  info: () => ipcRenderer.invoke('finance:info'),
  backupSQLite: () => ipcRenderer.invoke('finance:backup'),
  openDataFolder: () => ipcRenderer.invoke('finance:open-data-folder'),
  bankStatus: () => ipcRenderer.invoke('bank:status'),
  bankConfigure: (config) => ipcRenderer.invoke('bank:configure',config),
  bankSync: () => ipcRenderer.invoke('bank:sync'),
  bankForget: () => ipcRenderer.invoke('bank:forget'),
  categoriesStatus: () => ipcRenderer.invoke('categories:status'),
  categorySave: (input) => ipcRenderer.invoke('categories:save',input),
  categoryDelete: (name) => ipcRenderer.invoke('categories:delete',name),
  ruleSave: (input) => ipcRenderer.invoke('rules:save',input),
  ruleDelete: (id) => ipcRenderer.invoke('rules:delete',id),
  bankCategorize: (input) => ipcRenderer.invoke('bank:categorize',input)
}));
