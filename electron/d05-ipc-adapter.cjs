'use strict';
// D05 E2 installable IPC adapter. Integrator owns electron/main.cjs and preload.cjs.
// All authorization is host-side; renderer-supplied consent or owner is never accepted.
const {D05CategoryService}=require('./d05-category-service.cjs');
const CHANNELS=Object.freeze({
 catalog:'d05:catalog',manualList:'d05:manual-list',bankList:'d05:bank-list',
 aggregateManual:'d05:aggregate-manual',resolve:'d05:resolve',
 createSubcategory:'d05:subcategory-create',updateSubcategory:'d05:subcategory-update',
 deleteSubcategory:'d05:subcategory-delete',usageSubcategory:'d05:subcategory-usage',
 assignManual:'d05:assign-manual',assignBank:'d05:assign-bank',
 batchPreview:'d05:bank-batch-preview',batchApply:'d05:bank-batch-apply',
 splits:'d05:bank-splits',saveRule:'d05:rule-save',assignPlanned:'d05:planned-assign'
});
function installD05Ipc({ipcMain,finance,requireAppSender,authorizeRead,authorizeWrite}={}){
 if(!ipcMain||typeof ipcMain.handle!=='function'||typeof requireAppSender!=='function'||
  typeof authorizeRead!=='function'||typeof authorizeWrite!=='function')
  throw Error('D05: owner, session and access control hooks required');
 const service=new D05CategoryService(finance);
 const read=(channel,scope,handler)=>{
  ipcMain.handle(channel,(event,input)=>{
   requireAppSender(event);
   if(authorizeRead(event,scope,input)!==true)throw Error('D05: leitura não autorizada');
   return handler(input);
  });
 };
 const write=(channel,action,handler)=>{
  ipcMain.handle(channel,(event,input)=>{
   requireAppSender(event);
   // Must verify owner, session, scope, human gesture and any backup/preview requirements in MAIN.
   if(authorizeWrite(event,action,input)!==true)throw Error('D05: confirmação humana obrigatória');
   return handler(input);
  });
 };
 read(CHANNELS.catalog,{source:'taxonomy'},()=>service.listCatalog());
 read(CHANNELS.resolve,{source:'taxonomy'},input=>service.resolve(input));
 read(CHANNELS.manualList,{source:'manual'},input=>service.listManual(input));
 read(CHANNELS.bankList,{source:'bank'},input=>service.bankView(input));
 read(CHANNELS.aggregateManual,{source:'manual'},input=>service.aggregateManual(input));
 read(CHANNELS.usageSubcategory,{source:'taxonomy'},input=>service.usage(input?.id));
 read(CHANNELS.batchPreview,{source:'bank'},input=>service.previewBankBatch(input));
 write(CHANNELS.createSubcategory,'subcategory.create',input=>service.createSubcategory(input));
 write(CHANNELS.updateSubcategory,'subcategory.update',input=>service.updateSubcategory(input));
 write(CHANNELS.deleteSubcategory,'subcategory.delete',input=>service.deleteSubcategory(input));
 write(CHANNELS.assignManual,'manual.categorize',input=>service.assignManual(input));
 write(CHANNELS.assignBank,'bank.categorize',input=>service.assignBank(input));
 write(CHANNELS.batchApply,'bank.batch-categorize',input=>service.assignBankBatch(input));
 write(CHANNELS.splits,'bank.split',input=>service.setBankSplits(input));
 write(CHANNELS.saveRule,'rule.save',input=>service.saveRule(input));
 write(CHANNELS.assignPlanned,'planning.categorize',input=>service.assignPlanned(input));
 return {channels:CHANNELS,service};
}
module.exports={installD05Ipc,CHANNELS};
