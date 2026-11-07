'use strict';
const {app,BrowserWindow,session,ipcMain,dialog,shell,safeStorage}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {FinanceDB}=require('./db.cjs');
const {prepareCloudMigration,migrationLocalStatus}=require('./cloud-onboarding.cjs');
const {uploadPersonalQuarantine,CONSENT}=require('./cloud-personal-uploader.cjs');
const {PREVIEW_ORIGIN,allowedLoginNavigation,checkPreviewIdentity,testPreviewQuarantine}=require('./cloud-preview-identity.cjs');
const {PlanningStore}=require('./planning.cjs');
const {automaticBackup,restoreBackup,listAutoBackups,validateBackupFile}=require('./recovery.cjs');
const {PluggyVault}=require('./pluggy-vault.cjs');
const {PluggyClient}=require('./pluggy.cjs');
let planner=null, db=null, mainWindow=null, vault=null, syncing=false, restoring=false, autoBackupBusy=false, cloudPreparationBusy=false, backupTimer=null, cloudAuthWindow=null, cloudAuthPromise=null;
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
// The browser-based Access login stays in an isolated Chromium partition.
// Cookies remain there, not in the application's local file:// renderer.
// This verifies only the preview health endpoint. No financial upload occurs.
function cloudPreviewSession(){
  const ses=session.fromPartition('persist:mf-cloud-preview');
  ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ses.setPermissionCheckHandler(()=>false);
  return ses;
}
async function previewIdentityStatus(){
  const ses=cloudPreviewSession();
  return checkPreviewIdentity((url,init)=>ses.fetch(url,init));
}
async function connectPreviewIdentity(){
  const ses=cloudPreviewSession();
  const existing=await checkPreviewIdentity((url,init)=>ses.fetch(url,init));
  if(existing.connected)return existing;
  if(cloudAuthPromise){
    if(cloudAuthWindow&&!cloudAuthWindow.isDestroyed())cloudAuthWindow.focus();
    return cloudAuthPromise;
  }
  const browser=new BrowserWindow({
    parent:mainWindow||undefined,
    width:690,height:790,minWidth:500,minHeight:530,
    title:'Meu Financeiro — autenticação protegida',autoHideMenuBar:true,
    backgroundColor:'#0b0a11',show:false,
    webPreferences:{
      partition:'persist:mf-cloud-preview',
      sandbox:true,nodeIntegration:false,contextIsolation:true,
      webSecurity:true,devTools:false,webviewTag:false
    }
  });
  cloudAuthWindow=browser;
  browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  // Restrict navigation to the known Preview and the single configured
  // Cloudflare Access team. Never allow file:, data:, or arbitrary domains.
  browser.webContents.on('will-navigate',(event,details)=>{
    const url=typeof details==='string'?details:details.url;
    if(!allowedLoginNavigation(url))event.preventDefault();
  });
  browser.webContents.on('will-redirect',(event,details)=>{
    const url=typeof details==='string'?details:details.url;
    if(!allowedLoginNavigation(url))event.preventDefault();
  });
  // No downloads from a remote authentication window.
  const onDownload=(event,webContents)=>{
    if(webContents===browser.webContents)event.preventDefault();
  };
  ses.on('will-download',onDownload);
  cloudAuthPromise=new Promise(resolve=>{
    let ended=false,checking=false;
    let interval;
    const settle=(result)=>{
      if(ended)return;
      ended=true;
      if(interval)clearInterval(interval);
      ses.removeListener('will-download',onDownload);
      cloudAuthWindow=null;cloudAuthPromise=null;
      if(!browser.isDestroyed())browser.close();
      resolve(result);
    };
    const check=async()=>{
      if(ended||checking||browser.isDestroyed())return;
      checking=true;
      try{
        const result=await checkPreviewIdentity((url,init)=>ses.fetch(url,init));
        if(result.connected)settle(result);
      }finally{checking=false;}
    };
    browser.once('ready-to-show',()=>browser.show());
    browser.on('closed',()=>settle({
      connected:false,reason:'login_closed',
      financialSyncEnabled:false,recordsTransferred:0
    }));
    browser.webContents.on('did-stop-loading',()=>void check());
    interval=setInterval(()=>void check(),4000);
    browser.loadURL(PREVIEW_ORIGIN+'/sync.html').catch(()=>settle({
      connected:false,reason:'login_window_failed',
      financialSyncEnabled:false,recordsTransferred:0
    }));
  });
  return cloudAuthPromise;
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
 ipcMain.handle('cloud:access-status',async(event)=>{
   requireAppSender(event);
   return previewIdentityStatus();
 });
 ipcMain.handle('cloud:access-connect',async(event)=>{
   requireAppSender(event);
   if(restoring||cloudPreparationBusy)
     throw new Error('Conclua a operação local antes de entrar na nuvem.');
   return connectPreviewIdentity();
 });
 ipcMain.handle('cloud:quarantine-demo',async(event)=>{
   requireAppSender(event);
   if(restoring||syncing||cloudPreparationBusy)
     throw new Error('Outra operação financeira está em andamento.');
   const ses=cloudPreviewSession();
   const identity=await checkPreviewIdentity((url,options)=>ses.fetch(url,options));
   if(!identity.connected)return {ok:false,reason:'login_required',
     realRecordsSent:0,financialSyncEnabled:false};
   return testPreviewQuarantine((url,options)=>ses.fetch(url,options));
 });
 ipcMain.handle('cloud:transfer-personal',async(event)=>{
   requireAppSender(event);
   if(syncing||restoring||autoBackupBusy||cloudPreparationBusy)
     throw new Error('Existe outra operação em andamento.');
   // This is an explicit data transfer consent, NOT consent for cloud cutover.
   // It is the only way real personal records may leave the desktop.
   const prompt=await dialog.showMessageBox(mainWindow,{
     type:'warning',title:'Conferir migração pessoal protegida',
     message:'Autoriza copiar suas personalizações financeiras para a quarentena privada da Cloudflare?',
     detail:'Envia categorias, regras, orçamentos, transações manuais, títulos, notas, divisões, planejamentos e identificadores vinculados. O backup SQLite permanecerá no seu computador. Os dados ficarão guardados no ambiente de testes protegido, para conferência. O Itaú não será consultado por este envio. A sincronização financeira NÃO será ativada nesta etapa.',
     buttons:['Cancelar','Autorizo o envio para conferência'],
     defaultId:0,cancelId:0,noLink:true
   });
   if(prompt.response!==1)
     return {cancelled:true,financialSyncEnabled:false,recordsSent:0};
   const ses=cloudPreviewSession();
   const identity=await checkPreviewIdentity((url,options)=>ses.fetch(url,options));
   if(!identity.connected)
     throw new Error('Faça login no Preview protegido antes de enviar os dados.');
   cloudPreparationBusy=true;
   try{
     return await prepareCloudMigration({
       finance:db,backupFolder:backupsDirectory(),
       onValidatedSnapshot:(snapshot)=>uploadPersonalQuarantine(
         snapshot,(url,options)=>ses.fetch(url,options),
         app.getPath('userData'),{consent:CONSENT}
       )
     });
   }finally{cloudPreparationBusy=false;}
 });
 ipcMain.handle('cloud:migration-status',(event)=>{
   requireAppSender(event);
   return migrationLocalStatus(backupsDirectory());
 });
 ipcMain.handle('cloud:prepare-migration',async(event)=>{
   requireAppSender(event);
   if(syncing||restoring||autoBackupBusy||cloudPreparationBusy)
     throw new Error('Há outra operação em andamento. Conclua-a antes de preparar a nuvem.');
   cloudPreparationBusy=true;
   try{
     // One click, no SQLite file picker or file upload.
     return await prepareCloudMigration({finance:db,backupFolder:backupsDirectory()});
   }finally{cloudPreparationBusy=false;}
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
   if(syncing||restoring||autoBackupBusy||cloudPreparationBusy)throw new Error('Conclua a sincronização ou cópia em andamento antes de restaurar.');
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
 ipcMain.handle('categories:import-pack',async(event)=>{
   requireAppSender(event);
   if(syncing||restoring||autoBackupBusy)throw new Error('Conclua a sincronização ou cópia de segurança antes de importar.');
   const selected=await dialog.showOpenDialog(mainWindow,{title:'Importar sugestões de categorias',properties:['openFile'],filters:[{name:'Sugestões de categorias (JSON)',extensions:['json']}]});
   if(selected.canceled||!selected.filePaths?.[0])return {cancelled:true};
   const filename=selected.filePaths[0];
   const stats=fs.statSync(filename);if(stats.size>2_000_000)throw new Error('Arquivo de categorias muito grande.');
   const pack=JSON.parse(fs.readFileSync(filename,'utf8'));
   const confirm=await dialog.showMessageBox(mainWindow,{type:'question',buttons:['Cancelar','Aplicar sugestões'],defaultId:0,cancelId:0,
      title:'Aplicar categorização sugerida?',message:'Adicionar regras e categorizações ao seu histórico?',
      detail:'Somente classificações confiáveis. Correções manuais existentes e valores bancários serão preservados. Criaremos uma cópia de segurança antes.'});
   if(confirm.response!==1)return {cancelled:true};
   if(syncing||restoring||autoBackupBusy)throw new Error('Aguarde a operação em andamento.');
   autoBackupBusy=true;
   try{
     fs.mkdirSync(backupsDirectory(),{recursive:true,mode:0o700});
     const pathBackup=path.join(backupsDirectory(),'antes-da-categorizacao-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
     await db.backupTo(pathBackup);
     const result=db.importCategoryPack(pack);
     return {...result,data:titledBankData(),categories:db.listCategories()};
   }finally{autoBackupBusy=false;}
 });
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
 ipcMain.handle('bank:dismiss-duplicate',(event,pairKey)=>{requireAppSender(event);return db.dismissDuplicate(pairKey);});

 // Planejamento financeiro: todas as alterações passam por operações validadas no processo principal.
 ipcMain.handle('plan:overview',(event,options)=>{requireAppSender(event);return planner.overview(options||{});});
 ipcMain.handle('plan:simulate',(event,options)=>{requireAppSender(event);return planner.simulatePurchase(options||{});});
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
app.on('before-quit',()=>{if(backupTimer)clearInterval(backupTimer);if(cloudAuthWindow&&!cloudAuthWindow.isDestroyed())cloudAuthWindow.close();if(db){db.close();db=null;}});
