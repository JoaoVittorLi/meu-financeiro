'use strict';
// Explicit renderer API only. The Integrator must merge this into the existing
// contextBridge.exposeInMainWorld('financeDesktop', ...) object in preload.cjs.
// This module does not authorize anything; MAIN enforces all permissions.
function createD05PreloadBridge(ipcRenderer){
 if(!ipcRenderer||typeof ipcRenderer.invoke!=='function')throw Error('IPC do Electron obrigatório');
 let access=null;
 const invoke=(channel,input={})=>{
  if(!access?.token||access.expiresAt<=Date.now())return Promise.reject(Error('D05: autorize sessão de consulta.'));
  return ipcRenderer.invoke(channel,{...(input||{}),sessionToken:access.token});
 };
 return Object.freeze({
  d05SessionAuthorize:async input=>{
   const result=await ipcRenderer.invoke('d05:session-authorize',input);
   if(!result?.token||!Number.isFinite(result.expiresAt))throw Error('D05: concessão de leitura inválida');
   access=result;return {profile:result.profile,expiresAt:result.expiresAt};
  },
  d05Receipt:input=>invoke('d05:receipt',input),
  d05PersonalWritePreview:input=>invoke('d05:personal-write-preview',input),
  d05PersonalWriteConfirm:input=>invoke('d05:personal-write-confirm',input),
  d05PersonalWriteReceipt:input=>invoke('d05:personal-write-receipt',input),
  d05BankAccountAuthorize:input=>invoke('d05:account-authorize',input),
  d05Catalog:()=>invoke('d05:catalog'),
  d05Resolve:target=>invoke('d05:resolve',target),
  d05ManualList:input=>invoke('d05:manual-list',input),
  d05BankList:input=>invoke('d05:bank-list',input),
  d05AggregateManual:input=>invoke('d05:aggregate-manual',input),
  d05SubcategoryUsage:input=>invoke('d05:subcategory-usage',input),
  d05SubcategoryDeletePreview:input=>invoke('d05:subcategory-delete-preview',input),
  d05SubcategoryMovePreview:input=>invoke('d05:subcategory-move-preview',input),
  d05CreateSubcategory:input=>invoke('d05:subcategory-create',input),
  d05UpdateSubcategory:input=>invoke('d05:subcategory-update',input),
  d05DeleteSubcategory:input=>invoke('d05:subcategory-delete',input),
  d05MoveSubcategory:input=>invoke('d05:subcategory-move',input),
  d05AssignManual:input=>invoke('d05:assign-manual',input),
  d05AssignBank:input=>invoke('d05:assign-bank',input),
  d05BankBatchPreview:input=>invoke('d05:bank-batch-preview',input),
  d05BankBatchApply:input=>invoke('d05:bank-batch-apply',input),
  d05BankSplits:input=>invoke('d05:bank-splits',input),
  d05RulePreview:input=>invoke('d05:rule-preview',input),
  d05RuleSave:input=>invoke('d05:rule-save',input),
  d05AssignPlanned:input=>invoke('d05:planned-assign',input)
 });
}
module.exports={createD05PreloadBridge};
