'use strict';
// D05 E2 installable IPC adapter. Integrator owns electron/main.cjs and preload.cjs.
// All authorization is host-side; renderer-supplied consent or owner is never accepted.
const {D05CategoryService}=require('./d05-category-service.cjs');
const CHANNELS=Object.freeze({
 catalog:'d05:catalog',manualList:'d05:manual-list',bankList:'d05:bank-list',
 aggregateManual:'d05:aggregate-manual',resolve:'d05:resolve',
 createSubcategory:'d05:subcategory-create',updateSubcategory:'d05:subcategory-update',
 deleteSubcategory:'d05:subcategory-delete',moveSubcategory:'d05:subcategory-move',
 subcategoryDeletePreview:'d05:subcategory-delete-preview',subcategoryMovePreview:'d05:subcategory-move-preview',usageSubcategory:'d05:subcategory-usage',
 assignManual:'d05:assign-manual',assignBank:'d05:assign-bank',
 batchPreview:'d05:bank-batch-preview',batchApply:'d05:bank-batch-apply',
 splits:'d05:bank-splits',rulePreview:'d05:rule-preview',saveRule:'d05:rule-save',assignPlanned:'d05:planned-assign'
});
function installD05Ipc({ipcMain,finance,requireAppSender,authorizeRead,authorizeWrite}={}){
 if(!ipcMain||typeof ipcMain.handle!=='function'||typeof requireAppSender!=='function'||
  typeof authorizeRead!=='function'||typeof authorizeWrite!=='function')
  throw Error('D05: owner, session and access control hooks required');
 // Dynamic DB binding avoids keeping a closed handle after SQLite restore.
 const getService=()=>new D05CategoryService(typeof finance==='function'?finance():finance);
 const read=(channel,scope,handler)=>{
  ipcMain.handle(channel,(event,input)=>{
   requireAppSender(event);
   if(authorizeRead(event,scope,input)!==true)throw Error('D05: leitura não autorizada');
   return handler(getService(),input);
  });
 };
 const write=(channel,action,handler)=>{
  ipcMain.handle(channel,async(event,input)=>{
   requireAppSender(event);
   // Host can ask the user through Electron's trusted native dialog and
   // atomically commit the D05 operation with a durable receipt. Never trust
   // a renderer-supplied approved/owner/consent flag.
   const commit=()=>handler(getService(),input);
   const permit=await authorizeWrite(event,action,input,commit);
   // Test/legacy authorizers returning true are still required to pass the
   // host gate; RC authorization instead owns the atomic commit/receipt.
   if(permit===true)return commit();
   if(permit===false||permit===null||permit===undefined)throw Error('D05: confirmação humana obrigatória');
   return permit;
  });
 };
 read(CHANNELS.catalog,{source:'taxonomy'},service=>service.listCatalog());
 read(CHANNELS.resolve,{source:'taxonomy'},(service,input)=>service.resolve(input));
 read(CHANNELS.manualList,{source:'manual'},(service,input)=>service.listManual(input));
 read(CHANNELS.bankList,{source:'bank'},(service,input)=>service.bankView(input));
 read(CHANNELS.aggregateManual,{source:'manual'},(service,input)=>service.aggregateManual(input));
 read(CHANNELS.usageSubcategory,{source:'taxonomy'},(service,input)=>service.usage(input?.id));
 read(CHANNELS.subcategoryDeletePreview,{source:'taxonomy'},(service,input)=>service.previewSubcategoryDelete(input));
 read(CHANNELS.subcategoryMovePreview,{source:'taxonomy'},(service,input)=>service.previewSubcategoryMove(input));
 read(CHANNELS.batchPreview,{source:'bank'},(service,input)=>service.previewBankBatch(input));
 read(CHANNELS.rulePreview,{source:'rules'},(service,input)=>service.previewRule(input));
 write(CHANNELS.createSubcategory,'subcategory.create',(service,input)=>service.createSubcategory(input));
 write(CHANNELS.updateSubcategory,'subcategory.update',(service,input)=>service.updateSubcategory(input));
 write(CHANNELS.deleteSubcategory,'subcategory.delete',(service,input)=>service.deleteSubcategory(input));
 write(CHANNELS.moveSubcategory,'subcategory.move',(service,input)=>service.moveSubcategory(input));
 write(CHANNELS.assignManual,'manual.categorize',(service,input)=>service.assignManual(input));
 write(CHANNELS.assignBank,'bank.categorize',(service,input)=>service.assignBank(input));
 write(CHANNELS.batchApply,'bank.batch-categorize',(service,input)=>service.assignBankBatch(input));
 write(CHANNELS.splits,'bank.split',(service,input)=>service.setBankSplits(input));
 write(CHANNELS.saveRule,'rule.save',(service,input)=>service.saveRule(input));
 write(CHANNELS.assignPlanned,'planning.categorize',(service,input)=>service.assignPlanned(input));
 return {channels:CHANNELS,get service(){return getService();}};
}
module.exports={installD05Ipc,CHANNELS};
