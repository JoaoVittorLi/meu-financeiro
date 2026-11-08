'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Exposição mínima: nada de ipcRenderer genérico ou acesso a arquivos pelo renderer.
contextBridge.exposeInMainWorld('financeDesktop', Object.freeze({
  load: (profile) => ipcRenderer.invoke('finance:load',profile),
  save: (profile,data) => ipcRenderer.invoke('finance:save',profile,data),
  info: () => ipcRenderer.invoke('finance:info'),
  backupSQLite: () => ipcRenderer.invoke('finance:backup'),
  cloudMigrationStatus: () => ipcRenderer.invoke('cloud:migration-status'),
  prepareCloudMigration: () => ipcRenderer.invoke('cloud:prepare-migration'),
  cloudAccessStatus: () => ipcRenderer.invoke('cloud:access-status'),
  connectCloudAccess: () => ipcRenderer.invoke('cloud:access-connect'),
  previewQuarantineDemo: () => ipcRenderer.invoke('cloud:quarantine-demo'),
  transferPersonalCloud: () => ipcRenderer.invoke('cloud:transfer-personal'),
  cloudPersonalSyncStatus: () => ipcRenderer.invoke('cloud:personal-sync-status'),
  cloudBankParity: () => ipcRenderer.invoke('cloud:bank-parity'),
  cloudE1Audit: () => ipcRenderer.invoke('cloud:e1-audit'),
  onCloudPersonalUpdated: (callback) => {
    if(typeof callback!=='function')throw new TypeError('Callback inválido.');
    const listener=(_event,data)=>callback({inbound:data?.inbound||0,conflicts:data?.conflicts||0});
    ipcRenderer.on('cloud:personal-updated',listener);
    return () => ipcRenderer.removeListener('cloud:personal-updated',listener);
  },
  backupStatus: () => ipcRenderer.invoke('finance:backup-status'),
  restoreSQLite: () => ipcRenderer.invoke('finance:restore'),
  openBackupsFolder: () => ipcRenderer.invoke('finance:open-backups'),
  openDataFolder: () => ipcRenderer.invoke('finance:open-data-folder'),
  bankStatus: () => ipcRenderer.invoke('bank:status'),
  bankConfigure: (config) => ipcRenderer.invoke('bank:configure',config),
  bankSync: () => ipcRenderer.invoke('bank:sync'),
  bankForget: () => ipcRenderer.invoke('bank:forget'),
  categoriesStatus: () => ipcRenderer.invoke('categories:status'),
  importCategoryPack: () => ipcRenderer.invoke('categories:import-pack'),
  categorySave: (input) => ipcRenderer.invoke('categories:save',input),
  categoryDelete: (name) => ipcRenderer.invoke('categories:delete',name),
  ruleSave: (input) => ipcRenderer.invoke('rules:save',input),
  ruleDelete: (id) => ipcRenderer.invoke('rules:delete',id),
  bankCategorize: (input) => ipcRenderer.invoke('bank:categorize',input),
  bankEditDetail: (input) => ipcRenderer.invoke('bank:edit-detail',input),
  bankBatch: (input) => ipcRenderer.invoke('bank:batch',input),
  bankSplit: (input) => ipcRenderer.invoke('bank:split',input),
  bankLinkManual: (input) => ipcRenderer.invoke('bank:link-manual',input),
  bankMerchantAlias: (input) => ipcRenderer.invoke('bank:merchant-alias',input),
  bankDeleteAlias: (id) => ipcRenderer.invoke('bank:delete-alias',id),
  bankDismissDuplicate: (pairKey) => ipcRenderer.invoke('bank:dismiss-duplicate',pairKey),
  planOverview: (options) => ipcRenderer.invoke('plan:overview',options),
  planSimulate: (options) => ipcRenderer.invoke('plan:simulate',options),
  planCreate: (payload) => ipcRenderer.invoke('plan:create',payload),
  planEdit: (payload) => ipcRenderer.invoke('plan:edit',payload),
  planStatus: (id,status) => ipcRenderer.invoke('plan:status',id,status),
  planLink: (payload) => ipcRenderer.invoke('plan:link',payload),
  planUnlink: (payload) => ipcRenderer.invoke('plan:unlink',payload),
  planReject: (payload) => ipcRenderer.invoke('plan:reject',payload),
  planRename: (payload) => ipcRenderer.invoke('plan:rename',payload),
  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiCapabilities: () => ipcRenderer.invoke('ai:capabilities'),
  aiConnect: () => ipcRenderer.invoke('ai:connect'),
  aiDisconnect: () => ipcRenderer.invoke('ai:disconnect'),
  aiModelAvailable: () => ipcRenderer.invoke('ai:model-available'),
  aiRunDemo: (input) => ipcRenderer.invoke('ai:run-demo',input),
  onAIDelta: (callback) => {
    if(typeof callback!=='function')throw new TypeError('Callback inválido.');
    const listener=(_event,data)=>callback(typeof data?.delta==='string'?data.delta:'');
    ipcRenderer.on('ai:delta',listener);
    return () => ipcRenderer.removeListener('ai:delta',listener);
  },
  planHistory: (id) => ipcRenderer.invoke('plan:history',id)
}));
