'use strict';
const {app,BrowserWindow,session,ipcMain,dialog,shell,safeStorage}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {FinanceDB}=require('./db.cjs');
const {isolateSmokeProfile}=require('./smoke-profile.cjs');
const {releaseChannel,stableProfileDirectory,experimentalProfileDirectory,
 stablePreMigrationBackup,channelStatus,STABLE_ID,EXPERIMENTAL_ID}=require('./release-channel.cjs');
const {q1NativeWindow}=require('./q1-native-window.cjs');
const {prepareCloudMigration,migrationLocalStatus}=require('./cloud-onboarding.cjs');
const {uploadPersonalQuarantine,CONSENT,loadMarker,markerFile}=require('./cloud-personal-uploader.cjs');
const {syncPersonalSafeFields,summary:cloudSafeSyncSummary}=require('./cloud-personal-safe-sync.cjs');
const {compareLocalBankWithPreview}=require('./cloud-bank-parity.cjs');
const {auditE1Windows}=require('./cloud-e1-audit.cjs');
const {PREVIEW_ORIGIN,checkPreviewIdentity,testPreviewQuarantine}=require('./cloud-preview-identity.cjs');
const {pairViaSystemBrowser,cancelBrowserPairing}=require('./cloud-system-browser.cjs');
const {PlanningStore}=require('./planning.cjs');
const {LocalFinancialIntelligence}=require('./financial-intelligence.cjs');
const {IntelligenceOperational}=require('./intelligence-operational.cjs');
const {IC2ReadQueryGateway}=require('./intelligence-ic2-adapter.cjs');
const {RCCategoryGateway}=require('./intelligence-category-rc.cjs');
const {installD05Ipc}=require('./d05-ipc-adapter.cjs');
const {D05RCSecureGate}=require('./d05-rc-gate.cjs');
const {D05PersonalWriteGateway}=require('./d05-personal-gate.cjs');
const {D05AutoCategorization}=require('./d05-auto-categorization.cjs');
const {D05AutoLocalScheduler}=require('./d05-auto-local-scheduler.cjs');
const {D05AutoPreview}=require('./d05-auto-preview.cjs');
const {CategoryReviewService}=require('./category-review.cjs');
const {CategoryReviewBackupGate}=require('./category-review-backup.cjs');
const {automaticBackup,restoreBackup,listAutoBackups,validateBackupFile}=require('./recovery.cjs');
const {PluggyVault}=require('./pluggy-vault.cjs');
const {PluggyClient}=require('./pluggy.cjs');
const {AIAuthVault}=require('./ai-vault.cjs');
const {AIPersonalStore}=require('./ai-personal.cjs');
const {ChatGPTSignIn}=require('./ai-auth.cjs');
const {ChatGPTDemoClient}=require('./ai-client.cjs');
const {buildSyntheticFinancialContext}=require('../shared/ai-financial-context.mjs');
let planner=null, db=null, mainWindow=null, vault=null, categoryRC=null, d05Gate=null, d05PersonalGate=null, autoCategory=null, autoScheduler=null, autoPreviewService=null, autoDailyTimer=null, syncing=false, restoring=false, autoBackupBusy=false, cloudPreparationBusy=false, backupTimer=null, cloudPersonalTimer=null, cloudPersonalBusy=false, cloudAuthPromise=null,cloudAccessAssertion=null;
function backupsDirectory(){return path.join(app.getPath('userData'),'copias-de-seguranca');}
async function ensureAutomaticBackup(){
  if(!db||restoring||syncing||autoBackupBusy)return;
  autoBackupBusy=true;
  try{await automaticBackup(db,backupsDirectory());}
  catch(_){console.warn('Uma cópia de segurança automática não pôde ser concluída.');}
  finally{autoBackupBusy=false;}
}

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
function secureCloudFetch(ses){
  return async(url,options={})=>{
    if(typeof url!=='string'||!url.startsWith(PREVIEW_ORIGIN+'/'))
      throw new Error('Origem de nuvem não autorizada.');
    // On Windows restart the HttpOnly CF_Authorization cookie persists in
    // the isolated profile, while process memory does not.
    let assertion=cloudAccessAssertion;
    if(!assertion){
      const candidates=await ses.cookies.get({url:PREVIEW_ORIGIN,name:'CF_Authorization'});
      assertion=candidates.find(x=>x.name==='CF_Authorization')?.value||null;
    }
    return ses.fetch(url,{
      ...options,headers:{
        ...(options.headers||{}),
        ...(assertion?{'Cf-Access-Jwt-Assertion':assertion}:{})
      }
    });
  };
}
async function tickCloudPersonal(){
  if(experimentalPackaged||smokeProfileActive)return; // RC/smoke never poll personal cloud.
  if(!db||cloudPersonalBusy||syncing||restoring||autoBackupBusy||
     cloudPreparationBusy)return;
  // Never replicate from an unapproved local database: the owner must have
  // completed the original 17-table transfer and retained its marker.
  let marker;
  try{marker=loadMarker(app.getPath('userData'));}catch{return;}
  if(!marker)return;
  cloudPersonalBusy=true;
  try{
    const ses=cloudPreviewSession();
    const client=secureCloudFetch(ses);
    const identity=await checkPreviewIdentity(client);
    if(!identity.connected)return;
    const result=await syncPersonalSafeFields(db,client,{
      maxChanges:100,maxOutbound:20
    });
    if((result.inboundApplied||result.outboundConfirmed)&&
       mainWindow&&!mainWindow.isDestroyed()){
      mainWindow.webContents.send('cloud:personal-updated',{
        inbound:result.inboundApplied,outbound:result.outboundConfirmed,
        conflicts:result.conflicts
      });
    }
  }catch{
    // Keep the local data and pending edits untouched until the next retry.
    // Never log token, personal notes or transaction values.
  }finally{cloudPersonalBusy=false;}
}
async function connectPreviewIdentity(){
  const ses=cloudPreviewSession();
  const existing=await checkPreviewIdentity(secureCloudFetch(ses));
  if(existing.connected)return existing;
  if(cloudAuthPromise)return cloudAuthPromise;
  cloudAuthPromise=pairViaSystemBrowser({
    openBrowser:url=>shell.openExternal(url),
    acceptSession:async({accessAssertion,pilotSession})=>{
      // The browser-to-localhost pairing never exposes tokens in renderer
      // IPC or URLs. Session cookies stay in an isolated Chromium profile.
      await ses.cookies.set({url:PREVIEW_ORIGIN,
        name:'CF_Authorization',value:accessAssertion,
        secure:true,httpOnly:true,sameSite:'no_restriction',path:'/'});
      await ses.cookies.set({url:PREVIEW_ORIGIN,
        name:'mf_push_session',value:pilotSession,
        secure:true,httpOnly:true,sameSite:'strict',path:'/'});
      cloudAccessAssertion=accessAssertion;
      const confirmed=await checkPreviewIdentity(secureCloudFetch(ses));
      if(!confirmed.connected){
        cloudAccessAssertion=null;
        await Promise.allSettled([
          ses.cookies.remove(PREVIEW_ORIGIN,'CF_Authorization'),
          ses.cookies.remove(PREVIEW_ORIGIN,'mf_push_session')
        ]);
      }
      return confirmed;
    }
  }).finally(()=>{cloudAuthPromise=null;});
  return cloudAuthPromise;
}

function createWindow(){
 mainWindow=new BrowserWindow({
   width:1500,height:940,minWidth:1000,minHeight:680,...q1NativeBounds,
   backgroundColor:'#0b0a11',title:'Meu Financeiro',show:false,
   icon:path.join(__dirname,'../app/icon.png'),
   autoHideMenuBar:true,
   webPreferences:{
     preload:path.join(__dirname,'preload-bundled.cjs'),
     contextIsolation:true,nodeIntegration:false,sandbox:true,
     webSecurity:true,devTools:!app.isPackaged
   }
 });
 mainWindow.once('ready-to-show',()=>{
  mainWindow.show();
  if(q1NativeBounds)console.log('[Q1_WINDOW] '+JSON.stringify({bounds:mainWindow.getBounds(),contentBounds:mainWindow.getContentBounds()}));
 });
 if(q1NativeBounds||smokeProfileActive){
  mainWindow.webContents.on('console-message',details=>{if(['warning','error'].includes(details.level))console.error('[Q1_RENDERER] '+JSON.stringify({level:details.level,message:details.message}));});
  mainWindow.webContents.on('render-process-gone',(_event,details)=>console.error('[Q1_RENDERER_GONE] '+JSON.stringify(details)));
  mainWindow.webContents.on('preload-error',(_event,_file,error)=>console.error('[Q1_PRELOAD] '+String(error.message)));
  mainWindow.webContents.on('did-fail-load',(_event,code,description,url)=>console.error('[Q1_LOAD_FAILED] '+JSON.stringify({code,description,url})));
 }
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',(event)=>event.preventDefault());
 mainWindow.loadFile(path.resolve(__dirname,'../app/index.html'));
}
// Profile selection must precede the single-instance lock, SQLite and vaults.
const smokeProfileActive=isolateSmokeProfile(app);
const runtimeChannel=smokeProfileActive?'smoke':releaseChannel(app);
const experimentalPackaged=runtimeChannel==='experimental';
const stablePackaged=runtimeChannel==='stable';
function forbidExperimentalNetwork(){
 if(experimentalPackaged||smokeProfileActive)
  throw Error('RC/smoke isolado: conexão bancária, nuvem e IA externa estão desativadas.');
}
if(experimentalPackaged){
 const isolated=experimentalProfileDirectory(app);
 app.setPath('userData',isolated);
}else if(stablePackaged){
 // Continue the previous stable profile IN PLACE; never import RC data.
 const stableDirectory=stableProfileDirectory(app);
 app.setPath('userData',stableDirectory);
}
const q1NativeBounds=q1NativeWindow(smokeProfileActive);
// Preview portable and installed version share one local finance database.
// Prevent concurrent Electron instances from writing to the same SQLite file.
const isPrimaryInstance=app.requestSingleInstanceLock();
if(!isPrimaryInstance)app.quit();
app.on('second-instance',()=>{
  if(mainWindow&&!mainWindow.isDestroyed()){
    if(mainWindow.isMinimized())mainWindow.restore();
    mainWindow.focus();
  }
});
app.whenReady().then(async()=>{
 if(!isPrimaryInstance)return;
 app.setAppUserModelId(experimentalPackaged?EXPERIMENTAL_ID:STABLE_ID);
 const filename=path.join(app.getPath('userData'),'meu-financeiro.sqlite');
 // Snapshot existing SQLite (including WAL) before FinanceDB migrations.
 const stableSnapshot=stablePackaged?
  await stablePreMigrationBackup(app.getPath('userData'),app.getVersion()):null;
 const profileState=stablePackaged?(stableSnapshot.existing?'existing':'new'):
  experimentalPackaged?'isolated':smokeProfileActive?'isolated':'development';
 db=new FinanceDB(filename);
 planner=new PlanningStore(db);
 let localFinancial,categoryReview,reviewBackupGate;
 let operationalIntelligence,ic2ReadQuery;
 function bindLocalFinancialServices(){
  // A restored/recovered database has a new handle. Never retain grants,
  // previews or a service pointing at the closed pre-restore connection.
  localFinancial=new LocalFinancialIntelligence(db,planner);
  // No new review tables, grants or writes in a personal or packaged profile.
  categoryReview=smokeProfileActive?new CategoryReviewService(db,{syntheticProfile:true}):null;
  reviewBackupGate=categoryReview?new CategoryReviewBackupGate(categoryReview,path.join(app.getPath('userData'),'review-backups'),{syntheticProfile:true}):null;
  operationalIntelligence=new IntelligenceOperational({localFinancial,categoryReview,db});
  // Restoration replaces services, invalidating prior IC2 contexts.
  ic2ReadQuery=new IC2ReadQueryGateway(localFinancial);
  // Personal category work is preview-only; synthetic sandbox remains separate.
  if(d05PersonalGate)d05PersonalGate.stopAll();
  if(d05Gate)d05Gate.stopAll();
  if(categoryRC){categoryRC.stopAll();categoryRC.bindPersonal(db,localFinancial);}
  else categoryRC=new RCCategoryGateway({db,localFinancial});
  // Dedicated per-account opt-in; no elevation of the general AI personal writer.
  autoCategory=new D05AutoCategorization({finance:()=>db,
   backupDirectory:()=>path.join(app.getPath('userData'),'d05-auto-classification-backups')});
  autoScheduler=new D05AutoLocalScheduler({finance:()=>db,engine:()=>autoCategory});
  autoPreviewService=new D05AutoPreview({finance:()=>db,engine:()=>autoCategory});
 }
 bindLocalFinancialServices();
 d05Gate=new D05RCSecureGate({
  finance:()=>db,isIsolated:()=>experimentalPackaged||smokeProfileActive,
  backupDirectory:()=>path.join(app.getPath('userData'),'d05-supervised-backups'),
  confirm:async details=>{
   if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())return false;
   const isRead=details.kind==='read';
   const isAccount=details.kind==='bank-account';
   const dialogResult=await dialog.showMessageBox(mainWindow,{
    type:isRead?'question':'warning',
    buttons:isRead?['Cancelar','Autorizar consulta local']:isAccount?['Cancelar','Autorizar esta conta']:['Cancelar','Confirmar somente no teste'],
    defaultId:0,cancelId:0,noLink:true,
    title:isRead?'D05 — autorizar consulta':isAccount?'D05 — autorizar conta bancária':'D05 — operação supervisionada',
    message:isRead?'Permitir consulta local do perfil pessoal?':isAccount?
     'Autorizar análise de IA SOMENTE LEITURA da conta '+String(details.accountName||'selecionada')+'?':
     'Aplicar '+details.action+' APENAS em dados de demonstração?',
    detail:isRead?
     'A leitura é limitada a esta sessão do Meu Financeiro. Nenhuma alteração será aplicada.':isAccount?
     'O MAIN vinculará somente esta conta à análise I2-E por 15 minutos. Não habilita escrita pessoal.':
     'O MAIN fará backup, revalidará os dados e registrará um recibo SQLite. '+
     'Dados pessoais e contas bancárias reais continuam bloqueados.'
   });
   return dialogResult.response===1&&!mainWindow.isDestroyed();
  }
 });
 // Dedicated personal supervision adapter; write flag is permanently false
 // in this experimental SHA until owner authorizes a separate QA-gated change.
 d05PersonalGate=new D05PersonalWriteGateway({
  finance:()=>db,readSession:(event,input)=>d05Gate.require(event,input),
  backupDirectory:()=>path.join(app.getPath('userData'),'d05-personal-write-backups'),
  approvedForPersonal:()=>false,
  confirm:async details=>{
   if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())return false;
   const result=await dialog.showMessageBox(mainWindow,{
    type:'warning',buttons:['Cancelar','Confirmar somente após homologação'],
    defaultId:0,cancelId:0,noLink:true,
    title:'Escrita financeira supervisionada',
    message:'Confirmar '+String(details.action)+' no contexto autorizado?',
    detail:'Antes da confirmação o sistema revalidará IDs, conta, perfil, prévia e backup. '+
     'A execução pessoal permanece desativada nesta candidata.'
   });
   return result.response===1&&!mainWindow.isDestroyed();
  }
 });
 ipcMain.handle('d05:personal-write-preview',(event,input)=>{
  requireAppSender(event);if(restoring||syncing)throw Error('D05: operação concorrente');
  return d05PersonalGate.prepare(event,input);
 });
 ipcMain.handle('d05:personal-write-confirm',(event,input)=>{
  requireAppSender(event);if(restoring||syncing||autoBackupBusy)
   throw Error('D05: operação concorrente');
  return d05PersonalGate.confirmPreview(event,input);
 });
 ipcMain.handle('d05:personal-write-receipt',(event,input)=>{
  requireAppSender(event);return d05PersonalGate.receipt(event,input);
 });
 // Registered only once; dynamic finance() rebinds after backup/restore.
 installD05Ipc({ipcMain,finance:()=>db,requireAppSender,
  authorizeRead:(event,scope,input)=>!restoring&&!syncing&&d05Gate.read(event,scope,input),
  authorizeWrite:(event,action,input,execute)=>{
   if(restoring||syncing||cloudPreparationBusy||autoBackupBusy)
    throw Error('D05: operação financeira concorrente');
   return d05Gate.write(event,action,input,execute);
  }
 });
 ipcMain.handle('d05:session-authorize',async(event,input)=>{
  requireAppSender(event);
  if(restoring||syncing||cloudPreparationBusy)throw Error('D05: operação financeira em andamento');
  return d05Gate.authorize(event,input);
 });
 ipcMain.handle('d05:account-authorize',async(event,input)=>{
  requireAppSender(event);return d05Gate.authorizeAccount(event,input);
 });
 ipcMain.handle('d05:receipt',(event,input)=>{
  requireAppSender(event);return d05Gate.receipt(event,input);
 });
 ipcMain.handle('finance:review-status',event=>{requireAppSender(event);return {available:!!categoryReview,syntheticOnly:true};});
 for(const [channel,method] of [['authorize','authorize'],['list','list'],['queue','queue'],['prepare','prepare'],['confirm','confirm'],['revoke','revoke']]){
  ipcMain.handle('finance:review-'+channel,(event,input)=>{
   requireAppSender(event);
   if(!categoryReview)throw new Error('Escrita da Inteligência desativada neste perfil. Homologação sintética necessária.');
   if(restoring||syncing||cloudPreparationBusy||autoBackupBusy)throw new Error('Aguarde a operação financeira em andamento.');
   return method==='confirm'?reviewBackupGate.confirm(input,event.sender.id):categoryReview[method](input,event.sender.id);
  });
 }
 ipcMain.handle('finance:read-authorize',(event,input)=>{requireAppSender(event);return localFinancial.authorize(input,event.sender.id);});
 ipcMain.handle('finance:read-query',(event,input)=>{requireAppSender(event);return localFinancial.query(input,event.sender.id);});
 ipcMain.handle('finance:read-revoke',(event,token)=>{requireAppSender(event);return localFinancial.revoke(token,event.sender.id);});
 ipcMain.handle('intelligence:operational-overview',(event,input)=>{
  requireAppSender(event);return operationalIntelligence.overview(input,event.sender.id);
 });
 ipcMain.handle('intelligence:operational-ask',(event,input)=>{
  requireAppSender(event);return operationalIntelligence.ask(input,event.sender.id);
 });
 ipcMain.handle('intelligence:ic2-read-query',(event,input)=>{
  requireAppSender(event);return ic2ReadQuery.ask(input,event.sender.id);
 });
 // I2-B/C: explicitly scoped IPCs. Renderer cannot supply owner, environment,
 // a synthetic IC-READ token, verifiedGesture, or a SQLite filename.
 ipcMain.handle('intelligence:category-personal',(event,input)=>{
  requireAppSender(event);
  return categoryRC.personalCall(input,event.sender.id,{
   activeAccountId:d05Gate.trustedAccount(event)
  });
 });
 ipcMain.handle('intelligence:category-sandbox-start',(event,month)=>{
  requireAppSender(event);
  if(restoring||syncing)throw Error('Operação financeira em andamento.');
  return categoryRC.startSandbox(month,event.sender.id);
 });
 ipcMain.handle('intelligence:category-sandbox-command',async(event,input)=>{
  requireAppSender(event);
  if(restoring||syncing)throw Error('Operação financeira em andamento.');
  return categoryRC.sandboxCall(input,event.sender.id,async preview=>{
   if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())return false;
   const amount=Number.isSafeInteger(preview.amountCents)?
    new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(preview.amountCents/100):
    'não mensurável';
   const choice=await dialog.showMessageBox(mainWindow,{type:'warning',
    title:'Confirmar somente no SQLite sintético',buttons:['Cancelar','Confirmar apenas no teste'],
    defaultId:0,cancelId:0,noLink:true,
    message:'Aplicar '+String(preview.action)+' APENAS no laboratório?',
    detail:'Ambiente: arquivo TEMP sintético, isolado do perfil Windows.\n'+
     'Referências: '+String(preview.changes)+' · Valor amostral: '+amount+
     '\nNenhuma categoria, regra ou movimentação pessoal será modificada.'});
   // Native modal owns focus while open; checking window focus afterwards
   // would incorrectly reject an explicit click on the confirmation button.
   return choice.response===1&&!mainWindow.isDestroyed();
  });
 });
 ipcMain.handle('intelligence:category-sandbox-stop',(event,sessionId)=>{
  requireAppSender(event);return categoryRC.stopSandbox(sessionId,event.sender.id);
 });
 vault=new PluggyVault(app.getPath('userData'),safeStorage);
 const aiVault=new AIAuthVault(app.getPath('userData'),safeStorage);
 const aiAuth=new ChatGPTSignIn({vault:aiVault,openExternal:url=>shell.openExternal(url)});
 const aiPersonal=new AIPersonalStore(app.getPath('userData'),safeStorage);
 const aiDemo=new ChatGPTDemoClient({auth:aiAuth,personalStore:aiPersonal});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 if(smokeProfileActive||experimentalPackaged){
   // RC packaged builds remain offline-only, including Cloudflare/Pluggy/OpenAI.
   // Smoke tests contain invented entries only; forbid outbound HTTP even if
   // a feature unexpectedly attempts to reach Cloudflare/Pluggy/OpenAI.
   for(const ses of [session.defaultSession,session.fromPartition('persist:mf-cloud-preview')])
     ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,done)=>done({cancel:true}));
 }
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
   forbidExperimentalNetwork();
   return previewIdentityStatus();
 });
 ipcMain.handle('cloud:access-connect',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(restoring||cloudPreparationBusy)
     throw new Error('Conclua a operação local antes de entrar na nuvem.');
   return connectPreviewIdentity();
 });
 ipcMain.handle('cloud:quarantine-demo',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(restoring||syncing||cloudPreparationBusy)
     throw new Error('Outra operação financeira está em andamento.');
   const ses=cloudPreviewSession();
   const identity=await checkPreviewIdentity(secureCloudFetch(ses));
   if(!identity.connected)return {ok:false,reason:'login_required',
     realRecordsSent:0,financialSyncEnabled:false};
   return testPreviewQuarantine(secureCloudFetch(ses));
 });
 ipcMain.handle('cloud:transfer-personal',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
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
   const identity=await checkPreviewIdentity(secureCloudFetch(ses));
   if(!identity.connected)
     throw new Error('Faça login no Preview protegido antes de enviar os dados.');
   cloudPreparationBusy=true;
   try{
     return await prepareCloudMigration({
       finance:db,backupFolder:backupsDirectory(),
       onValidatedSnapshot:(snapshot)=>uploadPersonalQuarantine(
         snapshot,secureCloudFetch(ses),
         app.getPath('userData'),{consent:CONSENT}
       )
     });
   }finally{cloudPreparationBusy=false;}
 });
 ipcMain.handle('cloud:bank-parity',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(restoring||syncing||cloudPreparationBusy||autoBackupBusy)
     return {ok:false,reason:'local_operation_in_progress',financialSyncEnabled:false};
   const ses=cloudPreviewSession();
   const client=secureCloudFetch(ses);
   const identity=await checkPreviewIdentity(client);
   if(!identity.connected)return {ok:false,reason:'cloud_login_required',financialSyncEnabled:false};
   return compareLocalBankWithPreview(db,client);
 });
 ipcMain.handle('cloud:e1-audit',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(restoring||syncing||cloudPreparationBusy||autoBackupBusy||cloudPersonalBusy)
     return {ok:false,reason:'local_operation_in_progress',financialSyncEnabled:false};
   const ses=cloudPreviewSession();
   const client=secureCloudFetch(ses);
   const identity=await checkPreviewIdentity(client);
   if(!identity.connected)
     return {ok:false,reason:'cloud_login_required',financialSyncEnabled:false};
   return auditE1Windows(db,client,app.getPath('userData'));
 });
 ipcMain.handle('cloud:personal-sync-status',(event)=>{
   requireAppSender(event);
   return cloudSafeSyncSummary(db.db);
 });
 ipcMain.handle('cloud:migration-status',(event)=>{
   requireAppSender(event);
   return migrationLocalStatus(backupsDirectory());
 });
 ipcMain.handle('cloud:prepare-migration',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
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
   if(syncing||restoring||autoBackupBusy||cloudPreparationBusy||reviewBackupGate?.pending.size)throw new Error('Conclua a sincronização ou cópia em andamento antes de restaurar.');
   const picked=await dialog.showOpenDialog(mainWindow,{title:'Escolher cópia de segurança do Meu Financeiro',properties:['openFile'],filters:[{name:'Cópia completa',extensions:['sqlite']}]});
   if(picked.canceled||!picked.filePaths?.[0])return {cancelled:true};
   // Confirma formato e integridade antes de mostrar qualquer opção destrutiva.
   validateBackupFile(picked.filePaths[0]);
   const confirmation=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancelar','Restaurar meus dados'],defaultId:0,cancelId:0,noLink:true,
     title:'Confirmar restauração',message:'Substituir os dados atuais por esta cópia?',
     detail:'Seus dados voltarão ao estado da cópia. Antes da restauração, salvaremos uma cópia dos dados atuais. Sua conexão bancária permanecerá configurada.'});
   if(confirmation.response!==1)return {cancelled:true};
   if(syncing||restoring||autoBackupBusy||cloudPreparationBusy||reviewBackupGate?.pending.size)throw new Error('Conclua a operação em andamento antes de restaurar.');
   restoring=true;
   try{
     const result=await restoreBackup(db,picked.filePaths[0],filename,backupsDirectory());
     db=result.db;
     planner=new PlanningStore(db);
     bindLocalFinancialServices();
     // Restoring an older snapshot requires a new cloud comparison/approval.
     fs.rmSync(markerFile(app.getPath('userData')),{force:true});
     const state={ok:true};
     mainWindow.webContents.reload();
     return state;
   }catch(error){
     if(error.recoveredDb){db=error.recoveredDb;planner=new PlanningStore(db);bindLocalFinancialServices();}
     throw new Error('Não foi possível restaurar seus dados: '+error.message);
   }finally{restoring=false;}
 });
 function titledBankData(){const data=db.bankOverview();const titles=new Map(planner.bankTitles().map(x=>[x.accountId+'|'+x.externalId,x.title]));return {...data,transactions:data.transactions.map(t=>({...t,customTitle:titles.get(t.accountId+'|'+t.id)||''}))};}
 async function bankStatusSafe(){
  let config,error=null;
  try{config=await vault.status();}
  catch(_){ // Vault error must not hide/erase historical bank rows.
   config={configured:false,clientId:'',itemIds:[],secure:false};
   error='O cofre protegido não pôde ser aberto. O histórico offline permanece disponível; confira a reconexão.';
  }
  return {config,data:titledBankData(),connection:{...channelStatus(runtimeChannel),profileState,error}};
 }
 // P0/v1: native MAIN approval, persisted separately from IC-READ and D05 general write.
 const autoAllowed=()=>{if(!stablePackaged)
  throw Error('Classificação automática pessoal: disponível apenas na distribuição estável homologada.');};
 const autoIdle=()=>{if(syncing||restoring||autoBackupBusy||cloudPreparationBusy)
  throw Error('Classificação automática: aguarde a operação financeira em andamento.');};
 ipcMain.handle('bank:auto-status',event=>{
  requireAppSender(event);return {...autoCategory.status(),available:stablePackaged,jobs:autoScheduler.status({limit:10})};
 });
 ipcMain.handle('bank:auto-configure',async(event,input)=>{
  requireAppSender(event);autoAllowed();autoIdle();
  const ids=input?.accountIds,from=input?.startDate,to=input?.endDate;
  if(!Array.isArray(ids)||ids.length<1||ids.length>40||new Set(ids).size!==ids.length)
   throw Error('Selecione contas válidas.');
  const known=new Map(db.bankOverview().accounts.map(a=>[a.id,a.name]));
  if(ids.some(id=>!known.has(id)))throw Error('Conta bancária desconhecida.');
  if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())
   throw Error('Autorização pessoal exige janela ativa.');
  const answer=await dialog.showMessageBox(mainWindow,{type:'warning',
   buttons:['Cancelar','Autorizar categorização automática'],
   defaultId:0,cancelId:0,noLink:true,title:'Autorizar automação por conta',
   message:'Permitir classificação automática somente nas contas selecionadas?',
   detail:ids.map(id=>'• '+known.get(id)).join('\n')+'\nPeríodo: '+String(from||'')+' a '+String(to||'')+
    '\nUsa somente correções manuais concordantes e aliases explícitos. Alterações incertas vão para revisão. '+
    'Sem LLM externo, sem modificar valores, status ou saldo; revogável nas Movimentações.'});
  requireAppSender(event);autoIdle();
  if(answer.response!==1||!mainWindow||mainWindow.isDestroyed())return {cancelled:true};
  // Native approval grants only the scoped category capability. It NEVER
  // silently applies the first batch; the owner must inspect its preview.
  const authorization=autoCategory.configure({accountIds:ids,startDate:from,endDate:to},true);
  return {authorization,changesApplied:false,previewRequired:true};
 });
 ipcMain.handle('bank:auto-revoke',(event,accountId)=>{
  requireAppSender(event);autoAllowed();autoIdle();return autoCategory.revoke(accountId);
 });
 ipcMain.handle('bank:auto-pause',event=>{
  requireAppSender(event);autoAllowed();return autoScheduler.pause();
 });
 ipcMain.handle('bank:auto-resume',async event=>{
  requireAppSender(event);autoAllowed();autoIdle();
  if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())
   throw Error('Reativação exige aplicativo em primeiro plano.');
  const answer=await dialog.showMessageBox(mainWindow,{type:'question',
   buttons:['Manter pausado','Reativar verificações locais'],
   defaultId:0,cancelId:0,noLink:true,title:'Reativar categorização',
   message:'Retomar as verificações automáticas das contas já autorizadas?',
   detail:'Não altera o consentimento. Não sincroniza contas ou executa com o aplicativo fechado.'});
  requireAppSender(event);autoIdle();
  if(answer.response!==1)return {cancelled:true};
  return autoScheduler.resume();
 });
 // Separate read-only, resumable analysis. Every page is produced in MAIN,
 // never from the renderer's 2,500-row projection.
 ipcMain.handle('bank:auto-preview-start',event=>{
  requireAppSender(event);autoAllowed();autoIdle();return autoPreviewService.start();
 });
 ipcMain.handle('bank:auto-preview-next',(event,id)=>{
  requireAppSender(event);autoAllowed();autoIdle();return autoPreviewService.next(id,{limit:250});
 });
 ipcMain.handle('bank:auto-preview-pause',(event,id)=>{
  requireAppSender(event);autoAllowed();return autoPreviewService.pause(id);
 });
 ipcMain.handle('bank:auto-preview-resume',(event,id)=>{
  requireAppSender(event);autoAllowed();autoIdle();return autoPreviewService.resume(id);
 });
 ipcMain.handle('bank:auto-preview-cancel',(event,id)=>{
  requireAppSender(event);autoAllowed();return autoPreviewService.cancel(id);
 });
 ipcMain.handle('bank:auto-apply',async(event,input)=>{
  requireAppSender(event);autoAllowed();autoIdle();
  const initial=!autoCategory.initialReady();
  if(initial){
   autoPreviewService.assertReady(input?.previewVersion);
   const preview=autoCategory.plan({limit:20000});
   if(!input?.previewVersion||input.previewVersion!==preview.previewVersion||
      preview.candidateCount>preview.candidates.length)
    throw Error('Prévia inicial ausente, alterada ou muito grande. Refaça a análise antes de confirmar.');
   if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())
    throw Error('Confirmação inicial exige janela em primeiro plano.');
   const answer=await dialog.showMessageBox(mainWindow,{type:'warning',
    buttons:['Cancelar','Aplicar lote seguro'],defaultId:0,cancelId:0,noLink:true,
    title:'Confirmar primeira categorização automática',
    message:'Aplicar '+preview.candidateCount+' classificações verificadas?',
    detail:'Analisadas todas as movimentações do período autorizado. '+
     preview.reviewCount+' exigem revisão; nenhuma movimentação original será sobrescrita. '+
     'Backup obrigatório, revalidação do manifesto e recibos SQLite antes de confirmar.'});
   requireAppSender(event);autoIdle();
   if(answer.response!==1)return {cancelled:true,changesApplied:false};
  }
  autoBackupBusy=true;
  try{
   if(initial)await autoCategory.confirmInitialPreview(input.previewVersion);
   return {...await autoScheduler.run('manual'),data:titledBankData(),status:autoCategory.status()};
  }finally{autoBackupBusy=false;}
 });
 ipcMain.handle('bank:auto-correct',async(event,input)=>{
  requireAppSender(event);autoAllowed();autoIdle();
  if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())
   throw Error('Correção pessoal exige aplicativo em primeiro plano.');
  const id=input?.accountId,externalId=input?.externalId;
  const row=db.getBankTransaction({accountId:id,externalId});
  const target=input?.target;
  const resolution=new (require('./d05-category-service.cjs').D05CategoryService)(db).resolve(target);
  if(row.status!=='POSTED')throw Error('Somente POSTED pode ser corrigida nesta rota.');
  const answer=await dialog.showMessageBox(mainWindow,{type:'question',
   buttons:['Cancelar','Corrigir esta classificação'],defaultId:0,cancelId:0,noLink:true,
   title:'Correção humana protegida',
   message:'Confirmar a correção somente desta movimentação?',
   detail:'Destino: '+resolution.parentName+(resolution.child?' › '+resolution.child.name:'')+
    '. A correção humana prevalece sobre a automação. Faz backup e grava recibo; sem alterar valor, data ou extrato.'});
  requireAppSender(event);autoIdle();
  if(answer.response!==1)return {cancelled:true};
  autoBackupBusy=true;
  try{return {...await autoCategory.correct({accountId:id,externalId,target}),
   status:autoCategory.status(),data:titledBankData()};}
  finally{autoBackupBusy=false;}
 });
 ipcMain.handle('bank:auto-review', (event,input)=>{
  requireAppSender(event);return autoCategory.plan(input||{});
 });
 ipcMain.handle('bank:auto-rule-suggestions',(event,input)=>{
  requireAppSender(event);
  if(!stablePackaged)return {contract:'D05/AUTO-RULE-SUGGESTIONS-V1',rules:[],changesApplied:false};
  return autoCategory.suggestRules(input||{});
 });
 ipcMain.handle('bank:auto-receipt',(event,id)=>{
  requireAppSender(event);return autoCategory.receipt(id);
 });
 ipcMain.handle('bank:auto-undo',async(event,input)=>{
  requireAppSender(event);autoAllowed();autoIdle();
  if(!mainWindow||mainWindow.isDestroyed()||!mainWindow.isFocused())
   throw Error('Reversão exige confirmação no aplicativo ativo.');
  const answer=await dialog.showMessageBox(mainWindow,{type:'warning',
   buttons:['Cancelar','Desfazer e proteger da automação'],defaultId:0,cancelId:0,noLink:true,
   title:'Reverter categorização automática',
   message:'Desfazer somente a classificação automática selecionada?',
   detail:'Valores e movimentações originais não serão alterados. A transação será protegida contra nova aplicação automática.'});
  requireAppSender(event);autoIdle();
  if(answer.response!==1)return {cancelled:true};
  autoBackupBusy=true;
  try{return {...await autoCategory.undo(input||{}),status:autoCategory.status(),data:titledBankData()};}
  finally{autoBackupBusy=false;}
 });
 ipcMain.handle('bank:status',async(event)=>{
  requireAppSender(event);return bankStatusSafe();
 });
 ipcMain.handle('bank:configure',async(event,config)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(syncing)throw new Error('Sincronização em andamento.');
   const saved=await vault.put(config||{});
   return {...await bankStatusSafe(),config:saved};
 });
 ipcMain.handle('bank:forget',async(event)=>{
   requireAppSender(event);
   if(syncing)throw new Error('Sincronização em andamento.');
   await vault.clear();
   return bankStatusSafe();
 });
 ipcMain.handle('bank:sync',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
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
     let autoResult={state:'disabled_or_no_evidence',applied:0};
     if(stablePackaged&&autoCategory.status().enabled&&autoCategory.initialReady()){
      autoBackupBusy=true;
      try{autoResult=await autoScheduler.run('sync',{syncId:db.db.prepare('SELECT MAX(id) AS id FROM bank_sync_history').get().id});}
      catch(_){autoResult={state:'failed_safely',error:'Sincronização salva; a automação não foi aplicada. Confira os backups e tente novamente.'};}
      finally{autoBackupBusy=false;}
     }
     return {...await bankStatusSafe(),newCount,totalCount,autoCategorization:autoResult};
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
 // ChatGPT OAuth and fictitious-only tests; strictly isolated from finances.
 ipcMain.handle('ai:status',(event)=>{requireAppSender(event);return aiAuth.status();});
 ipcMain.handle('ai:capabilities',(event)=>{requireAppSender(event);return aiDemo.capabilities();});
 ipcMain.handle('ai:financial-context-demo',(event,source)=>{
   requireAppSender(event);
   // Synthetic-only, non-network, read-only. Never reach FinanceDB, Pluggy or OpenAI.
   return buildSyntheticFinancialContext(source);
 });
 ipcMain.handle('ai:memory-list',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   return aiPersonal.list(await aiDemo.personalSubject());
 });
 ipcMain.handle('ai:memory-add',async(event,input)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.kind!=='string'||typeof input.text!=='string')
     throw new Error('Memória inválida.');
   return aiPersonal.add(await aiDemo.personalSubject(),{kind:input.kind,text:input.text});
 });
 ipcMain.handle('ai:memory-remove',async(event,id)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   return aiPersonal.remove(await aiDemo.personalSubject(),id);
 });
 ipcMain.handle('ai:memory-clear',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   return aiPersonal.clearMemories(await aiDemo.personalSubject());
 });
 ipcMain.handle('ai:usage-summary',async(event)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   return aiPersonal.summary(await aiDemo.personalSubject());
 });
 ipcMain.handle('ai:context-preview',(event,input)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(!input||typeof input!=='object'||typeof input.caseId!=='string'||
     !['auto','low','medium'].includes(input.effort)||typeof input.useSavedMemories!=='boolean')
     throw new Error('Parâmetros de prévia de contexto inválidos.');
   return aiDemo.contextPreview(input);
 });
 ipcMain.handle('ai:connect',(event)=>{requireAppSender(event);forbidExperimentalNetwork();return aiAuth.connect();});
 ipcMain.handle('ai:disconnect',(event)=>{requireAppSender(event);return aiAuth.disconnect();});
 ipcMain.handle('ai:model-available',(event)=>{requireAppSender(event);forbidExperimentalNetwork();return aiDemo.modelAvailable();});
 ipcMain.handle('ai:run-demo',(event,input)=>{
   requireAppSender(event);
   forbidExperimentalNetwork();
   if(!input||typeof input!=='object'||typeof input.caseId!=='string'||input.caseId.length>36||!['auto','low','medium'].includes(input.effort)||input.creditsDisabledConfirmed!==true||typeof input.useSavedMemories!=='boolean')
     throw new Error('Confirmação e parâmetros de teste inválidos.');
   return aiDemo.testDemo({caseId:input.caseId,effort:input.effort,creditsDisabledConfirmed:true,useSavedMemories:input.useSavedMemories,
     onDelta:delta=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('ai:delta',{delta});}});
 });
 ipcMain.handle('finance:open-data-folder',async(event)=>{
   requireAppSender(event);return shell.openPath(app.getPath('userData'));
 });
 createWindow();
 void ensureAutomaticBackup();
 backupTimer=setInterval(()=>void ensureAutomaticBackup(),60*60*1000);
 // Local-only: first opening of the day and extended sessions while app is open.
 // Never starts a new Pluggy sync or operates in the isolated/experimental RC.
 const tickAutoDaily=async()=>{
  if(!stablePackaged||!autoScheduler||!db||syncing||restoring||autoBackupBusy||cloudPreparationBusy)return;
  autoBackupBusy=true;
  try{await autoScheduler.run('daily');}
  catch(_){console.warn('Verificação diária de categorias indisponível; nenhuma sincronização bancária adicional foi feita.');}
  finally{autoBackupBusy=false;}
 };
 autoDailyTimer=setInterval(()=>void tickAutoDaily(),15*60*1000);
 void tickAutoDaily();
 if(!experimentalPackaged&&!smokeProfileActive){
  cloudPersonalTimer=setInterval(()=>void tickCloudPersonal(),60*1000);
  void tickCloudPersonal();
 }
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{dialog.showErrorBox('Erro ao iniciar Meu Financeiro','Não foi possível abrir o banco de dados: '+error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(d05PersonalGate)d05PersonalGate.stopAll();if(d05Gate)d05Gate.stopAll();if(categoryRC)categoryRC.stopAll();if(backupTimer)clearInterval(backupTimer);if(autoDailyTimer)clearInterval(autoDailyTimer);if(cloudPersonalTimer)clearInterval(cloudPersonalTimer);cancelBrowserPairing();if(db){db.close();db=null;}});
