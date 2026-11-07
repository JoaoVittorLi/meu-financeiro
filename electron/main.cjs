'use strict';
const {app,BrowserWindow,session,ipcMain,dialog,shell,safeStorage}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {FinanceDB}=require('./db.cjs');
const {PlanningStore}=require('./planning.cjs');
const {automaticBackup,restoreBackup,listAutoBackups,validateBackupFile}=require('./recovery.cjs');
const {PluggyVault}=require('./pluggy-vault.cjs');
const {PluggyClient}=require('./pluggy.cjs');
let planner=null, db=null, mainWindow=null, vault=null, syncing=false, restoring=false, autoBackupBusy=false, backupTimer=null;
function backupsDirectory(){return path.join(app.getPath('userData'),'copias-de-seguranca');}
async function ensureAutomaticBackup(){
  if(!db||restoring||syncing||autoBackupBusy)return;
  autoBackupBusy=true;
  try{await automaticBackup(db,backupsDirectory());}
  catch(_){console.warn('Uma cópia de segurança automática não pôde ser concluída.');}
  finally{autoBackupBusy=false;}
}

if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
function requireAppSender(event){
 if(restoring)throw new Error('A restauração dos seus dados está em andamento.');
 const url=event.senderFrame?.url || '';
 if(!event.sender || event.sender.isDestroyed() ||
   !url.startsWith('file://') || !url.endsWith('/app/index.html') ||
   event.sender!==mainWindow?.webContents) throw new Error('Origem da requisição negada.');
}
function createWindow(){
 mainWindow=new BrowserWindow({
   width:1500,height:940,minWidth:1000,minHeight:680,
   backgroundColor:'#0b0a11',title:'Meu Financeiro',show:false,
   icon:path.join(__dirname,'../app/icon.png'),
   autoHideMenuBar:true,
   webPreferences:{
     preload:path.join(__dirname,'preload.cjs'),
     contextIsolation:true,nodeIntegration:false,sandbox:true,
     webSecurity:true,devTools:!app.isPackaged
   }
 });
 mainWindow.once('ready-to-show',()=>mainWindow.show());
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',(event)=>event.preventDefault());
 mainWindow.loadFile(path.resolve(__dirname,'../app/index.html'));
}
app.whenReady().then(()=>{
 app.setAppUserModelId('app.local.meufinanceiro');
 const filename=path.join(app.getPath('userData'),'meu-financeiro.sqlite');
 db=new FinanceDB(filename);
 planner=new PlanningStore(db);
 vault=new PluggyVault(app.getPath('userData'),safeStorage);
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 ipcMain.handle('finance:load',(event,profile)=>{requireAppSender(event);return db.load(profile);});
 ipcMain.handle('finance:save',(event,profile,data)=>{requireAppSender(event);return db.save(profile,data);});
 ipcMain.handle('finance:info',(event)=>{requireAppSender(event);return {engine:'sqlite',path:filename,appVersion:app.getVersion(),integrity:db.integrity()};});
 ipcMain.handle('finance:backup',async(event)=>{
   requireAppSender(event);
   const result=await dialog.showSaveDialog(mainWindow,{title:'Salvar cópia do banco de dados',defaultPath:'MeuFinanceiro-backup-'+new Date().toISOString().slice(0,10)+'.sqlite',filters:[{name:'Banco SQLite',extensions:['sqlite']}]});
   if(result.canceled||!result.filePath)return {cancelled:true};
   return db.backupTo(result.filePath);
 });
 ipcMain.handle('finance:backup-status',(event)=>{
   requireAppSender(event);
   const copies=listAutoBackups(backupsDirectory());
   return {copies:copies.length,last:copies[0]?.modified||null};
 });
 ipcMain.handle('finance:open-backups',(event)=>{requireAppSender(event);
   fs.mkdirSync(backupsDirectory(),{recursive:true,mode:0o700});return shell.openPath(backupsDirectory());
 });
 ipcMain.handle('finance:restore',async(event)=>{
   requireAppSender(event);
   if(syncing||restoring||autoBackupBusy)throw new Error('Conclua a sincronização ou cópia em andamento antes de restaurar.');
   const picked=await dialog.showOpenDialog(mainWindow,{title:'Escolher cópia de segurança do Meu Financeiro',properties:['openFile'],filters:[{name:'Cópia completa',extensions:['sqlite']}]});
   if(picked.canceled||!picked.filePaths?.[0])return {cancelled:true};
   // Confirma formato e integridade antes de mostrar qualquer opção destrutiva.
   validateBackupFile(picked.filePaths[0]);
   const confirmation=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancelar','Restaurar meus dados'],defaultId:0,cancelId:0,noLink:true,
     title:'Confirmar restauração',message:'Substituir os dados atuais por esta cópia?',
     detail:'Seus dados voltarão ao estado da cópia. Antes da restauração, salvaremos uma cópia dos dados atuais. Sua conexão bancária permanecerá configurada.'});
   if(confirmation.response!==1)return {cancelled:true};
   restoring=true;
   try{
     const result=await restoreBackup(db,picked.filePaths[0],filename,backupsDirectory());
     db=result.db;
     planner=new PlanningStore(db);
     const state={ok:true};
     mainWindow.webContents.reload();
     return state;
   }catch(error){
     if(error.recoveredDb){db=error.recoveredDb;planner=new PlanningStore(db);}
     throw new Error('Não foi possível restaurar seus dados: '+error.message);
   }finally{restoring=false;}
 });
 function titledBankData(){const data=db.bankOverview();const titles=new Map(planner.bankTitles().map(x=>[x.accountId+'|'+x.externalId,x.title]));return {...data,transactions:data.transactions.map(t=>({...t,customTitle:titles.get(t.accountId+'|'+t.id)||''}))};}
 ipcMain.handle('bank:status',async(event)=>{
   requireAppSender(event);
   return {config:await vault.status(),data:titledBankData()};
 });
 ipcMain.handle('bank:configure',async(event,config)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Sincronização em andamento.');
   const saved=await vault.put(config||{});
   return {config:saved,data:titledBankData()};
 });
 ipcMain.handle('bank:forget',async(event)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Sincronização em andamento.');
   await vault.clear();
   return {config:await vault.status(),data:titledBankData()};
 });
 ipcMain.handle('bank:sync',async(event)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Uma sincronização já está em andamento.');
   const config=await vault.get();
   if(!config)throw new Error('Configure sua conexão Pluggy primeiro.');
   syncing=true;
   try{
     const client=new PluggyClient();
     await client.authenticate(config.clientId,config.clientSecret);
     let newCount=0,totalCount=0;
     for(const id of config.itemIds){
       const payload=await client.syncItem(id);
       const added=db.ingestBank(id,payload);
       newCount+=added.newCount;totalCount+=added.totalCount;
     }
     return {newCount,totalCount,config:await vault.status(),data:titledBankData()};
   }finally{syncing=false;}
 });
 // Categorização local: operações explícitas, sem expor SQL ao renderer.
 ipcMain.handle('categories:status',(event)=>{requireAppSender(event);return db.listCategories();});
 ipcMain.handle('categories:save',(event,input)=>{requireAppSender(event);return db.upsertCategory(input);});
 ipcMain.handle('categories:delete',(event,name)=>{requireAppSender(event);return db.deleteCategory(name);});
 ipcMain.handle('rules:save',(event,input)=>{requireAppSender(event);return db.upsertRule(input);});
 ipcMain.handle('rules:delete',(event,id)=>{requireAppSender(event);return db.deleteRule(id);});
 ipcMain.handle('bank:categorize',(event,input)=>{requireAppSender(event);return db.overrideBankCategory(input);});
 ipcMain.handle('bank:edit-detail',(event,input)=>{requireAppSender(event);return db.editBankTransaction(input);});
 ipcMain.handle('bank:batch',(event,input)=>{requireAppSender(event);return db.batchBankChanges(input);});
 ipcMain.handle('bank:split',(event,input)=>{requireAppSender(event);return db.setBankSplits(input);});
 ipcMain.handle('bank:link-manual',(event,input)=>{requireAppSender(event);return db.linkManualTransaction(input);});
 ipcMain.handle('bank:merchant-alias',(event,input)=>{requireAppSender(event);return db.saveMerchantAlias(input);});
 ipcMain.handle('bank:delete-alias',(event,id)=>{requireAppSender(event);return db.deleteMerchantAlias(id);});

 // Planejamento financeiro: todas as alterações passam por operações validadas no processo principal.
 ipcMain.handle('plan:overview',(event,options)=>{requireAppSender(event);return planner.overview(options||{});});
 ipcMain.handle('plan:create',(event,payload)=>{requireAppSender(event);const out=planner.create(payload);return {...out,overview:planner.overview()};});
 ipcMain.handle('plan:edit',(event,payload)=>{requireAppSender(event);planner.edit(payload);return planner.overview();});
 ipcMain.handle('plan:status',(event,id,status)=>{requireAppSender(event);planner.setStatus(id,status);return planner.overview();});
 ipcMain.handle('plan:link',(event,payload)=>{requireAppSender(event);planner.link(payload);return planner.overview();});
 ipcMain.handle('plan:unlink',(event,payload)=>{requireAppSender(event);planner.unlink(payload);return planner.overview();});
 ipcMain.handle('plan:reject',(event,payload)=>{requireAppSender(event);planner.reject(payload);return planner.overview();});
 ipcMain.handle('plan:rename',(event,payload)=>{requireAppSender(event);planner.renameBank(payload);return {overview:planner.overview(),data:titledBankData()};});
 ipcMain.handle('plan:history',(event,id)=>{requireAppSender(event);return planner.history(id);});
 ipcMain.handle('finance:open-data-folder',async(event)=>{
   requireAppSender(event);return shell.openPath(app.getPath('userData'));
 });
 createWindow();
 void ensureAutomaticBackup();
 backupTimer=setInterval(()=>void ensureAutomaticBackup(),60*60*1000);
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{dialog.showErrorBox('Erro ao iniciar Meu Financeiro','Não foi possível abrir o banco de dados: '+error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(backupTimer)clearInterval(backupTimer);if(db){db.close();db=null;}});
