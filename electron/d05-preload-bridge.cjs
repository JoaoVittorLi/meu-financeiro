'use strict';
// Explicit renderer API only. The Integrator must merge this into the existing
// contextBridge.exposeInMainWorld('financeDesktop', ...) object in preload.cjs.
// This module does not authorize anything; MAIN enforces all permissions.
function createD05PreloadBridge(ipcRenderer){
 if(!ipcRenderer||typeof ipcRenderer.invoke!=='function')throw Error('IPC do Electron obrigatório');
 return Object.freeze({
  d05Catalog:()=>ipcRenderer.invoke('d05:catalog'),
  d05Resolve:target=>ipcRenderer.invoke('d05:resolve',target),
  d05ManualList:input=>ipcRenderer.invoke('d05:manual-list',input),
  d05BankList:input=>ipcRenderer.invoke('d05:bank-list',input),
  d05AggregateManual:input=>ipcRenderer.invoke('d05:aggregate-manual',input),
  d05SubcategoryUsage:input=>ipcRenderer.invoke('d05:subcategory-usage',input),
  d05SubcategoryDeletePreview:input=>ipcRenderer.invoke('d05:subcategory-delete-preview',input),
  d05SubcategoryMovePreview:input=>ipcRenderer.invoke('d05:subcategory-move-preview',input),
  d05CreateSubcategory:input=>ipcRenderer.invoke('d05:subcategory-create',input),
  d05UpdateSubcategory:input=>ipcRenderer.invoke('d05:subcategory-update',input),
  d05DeleteSubcategory:input=>ipcRenderer.invoke('d05:subcategory-delete',input),
  d05MoveSubcategory:input=>ipcRenderer.invoke('d05:subcategory-move',input),
  d05AssignManual:input=>ipcRenderer.invoke('d05:assign-manual',input),
  d05AssignBank:input=>ipcRenderer.invoke('d05:assign-bank',input),
  d05BankBatchPreview:input=>ipcRenderer.invoke('d05:bank-batch-preview',input),
  d05BankBatchApply:input=>ipcRenderer.invoke('d05:bank-batch-apply',input),
  d05BankSplits:input=>ipcRenderer.invoke('d05:bank-splits',input),
  d05RulePreview:input=>ipcRenderer.invoke('d05:rule-preview',input),
  d05RuleSave:input=>ipcRenderer.invoke('d05:rule-save',input),
  d05AssignPlanned:input=>ipcRenderer.invoke('d05:planned-assign',input)
 });
}
module.exports={createD05PreloadBridge};
