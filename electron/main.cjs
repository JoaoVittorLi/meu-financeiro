'use strict';
const {app,BrowserWindow,session,ipcMain,dialog,shell,safeStorage}=require('electron');
const path=require('node:path');
const {FinanceDB}=require('./db.cjs');
const {PluggyVault}=require('./pluggy-vault.cjs');
const {PluggyClient}=require('./pluggy.cjs');
let db=null, mainWindow=null, vault=null, syncing=false;
if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
function requireAppSender(event){
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
 ipcMain.handle('bank:status',async(event)=>{
   requireAppSender(event);
   return {config:await vault.status(),data:db.bankOverview()};
 });
 ipcMain.handle('bank:configure',async(event,config)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Sincronização em andamento.');
   const saved=await vault.put(config||{});
   return {config:saved,data:db.bankOverview()};
 });
 ipcMain.handle('bank:forget',async(event)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Sincronização em andamento.');
   await vault.clear();
   return {config:await vault.status(),data:db.bankOverview()};
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
     return {newCount,totalCount,config:await vault.status(),data:db.bankOverview()};
   }finally{syncing=false;}
 });
 // Categorização local: operações explícitas, sem expor SQL ao renderer.
 ipcMain.handle('categories:status',(event)=>{requireAppSender(event);return db.listCategories();});
 ipcMain.handle('categories:save',(event,input)=>{requireAppSender(event);return db.upsertCategory(input);});
 ipcMain.handle('categories:delete',(event,name)=>{requireAppSender(event);return db.deleteCategory(name);});
 ipcMain.handle('rules:save',(event,input)=>{requireAppSender(event);return db.upsertRule(input);});
 ipcMain.handle('rules:delete',(event,id)=>{requireAppSender(event);return db.deleteRule(id);});
 ipcMain.handle('bank:categorize',(event,input)=>{requireAppSender(event);return db.overrideBankCategory(input);});
 ipcMain.handle('finance:open-data-folder',async(event)=>{
   requireAppSender(event);return shell.openPath(app.getPath('userData'));
 });
 createWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{dialog.showErrorBox('Erro ao iniciar Meu Financeiro','Não foi possível abrir o banco de dados: '+error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(db){db.close();db=null;}});
