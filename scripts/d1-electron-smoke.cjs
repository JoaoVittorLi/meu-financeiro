'use strict';
// D1.2 real Electron smoke: renderer DOM + preload IPC + real SQLite.
// Strictly synthetic data; requires installed dev Electron and a GUI.
// Cannot pass merely because the script exists or Electron failed to launch.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const net=require('node:net'),{spawn}=require('node:child_process');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const {validateBackupFile}=require('../electron/recovery.cjs');
const project=path.resolve(__dirname,'..');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const settings={opening:0,income:0,fixed:0,existing:0,reserve:0};
// Single source of truth for all eight Windows areas and the visual QA matrix.
const SMOKE_VIEWS=Object.freeze([
 'Visão geral','Movimentações','Planejamento','Orçamentos',
 'Minhas contas','Simular compra','Inteligência','Configurações'
]);
const SMOKE_PRESETS=Object.freeze([
 {width:1366,height:768,theme:'light',motion:'no-preference'},
 {width:1366,height:768,theme:'dark',motion:'reduce'},
 {width:1920,height:1080,theme:'light',motion:'reduce'},
 {width:1920,height:1080,theme:'dark',motion:'no-preference'}
]);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function availablePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
function createSyntheticProfile(profile){
 const db=new FinanceDB(path.join(profile,'meu-financeiro.sqlite'));
 try{
  db.save('real',{version:5,transactions:[{
    id:'synthetic-manual',date:'2026-11-10',description:'SYNTHETIC MANUAL',
    kind:'expense',amount:1234,category:'Outros',origin:'manual'
  }],budgets:{Alimentação:0},settings:{...settings}});
  db.save('demo',{version:5,transactions:[],budgets:{},settings:{...settings}});
  db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{
    account:{id:ACCOUNT,name:'SYNTHETIC ACCOUNT',balance:null,type:'BANK',currencyCode:'BRL'},
    transactions:[{id:'synthetic-bank',date:'2026-11-10',description:'SYNTHETIC BANK',
      amount:-12.34,status:'POSTED',category:'Groceries'}]
  }]});
  new PlanningStore(db);
 }finally{db.close();}
}
function launch(profile,port){
 const electron=require('electron');
 assert.equal(typeof electron,'string','Electron binário ausente: execute npm ci do lockfile antes do teste');
 const env={...process.env,MF_DESKTOP_SMOKE_DIR:profile};
 delete env.ELECTRON_RUN_AS_NODE;
 const args=['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1',
   '--remote-allow-origins=*','--user-data-dir='+profile,project];
 const child=spawn(electron,args,{cwd:project,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const recent=[];
 child.on('error',error=>recent.push(error.message));
 for(const stream of [child.stdout,child.stderr])
  stream.on('data',chunk=>{if(recent.length<30)recent.push(String(chunk).slice(0,500))});
 return {child,logs:()=>recent.slice(-12).join('')};
}
async function awaitTarget(port,child){
 for(let attempt=0;attempt<160;attempt++){
  if(child.exitCode!==null)throw Error('Electron saiu antes do CDP: '+child.exitCode);
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(800)});
   if(response.ok){
    const targets=await response.json();
    const page=targets.find(t=>t.type==='page'&&/app\/index\.html/.test(t.url));
    if(page && page.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
   }
  }catch{}
  await delay(250);
 }
 throw Error('Timeout ao abrir app/index.html no Electron (40 s)');
}
async function connect(url){
 const socket=new WebSocket(url),pending=new Map();
 let index=0;
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',()=>reject(Error('CDP WebSocket não abriu')),{once:true});
 });
 socket.addEventListener('message',event=>{
  let parsed;try{parsed=JSON.parse(event.data)}catch{return}
  const operation=pending.get(parsed.id);if(!operation)return;
  pending.delete(parsed.id);clearTimeout(operation.timer);
  parsed.error?operation.reject(Error(JSON.stringify(parsed.error))):operation.resolve(parsed.result);
 });
 socket.addEventListener('close',()=>{
  for(const op of pending.values()){clearTimeout(op.timer);op.reject(Error('CDP fechou durante a operação'))}
  pending.clear();
 });
 return {socket,send:(method,params={})=>new Promise((resolve,reject)=>{
  const id=++index;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},12000);
  pending.set(id,{resolve,reject,timer});
  socket.send(JSON.stringify({id,method,params}));
 })};
}
async function evaluate(cdp,body){
 const response=await cdp.send('Runtime.evaluate',{
  expression:'(async()=>{'+body+'})()',awaitPromise:true,returnByValue:true
 });
 if(response.exceptionDetails)throw Error('Renderer: '+(response.exceptionDetails.text||JSON.stringify(response.exceptionDetails)));
 return response.result&&response.result.value;
}
// CDP's device override controls the viewport. documentElement.clientWidth
// excludes the classic vertical scrollbar on Windows and is NOT the viewport.
async function waitForEmulatedViewport(cdp,cfg,{attempts=20,intervalMs=100}={}){
 let actual=null;
 for(let attempt=0;attempt<attempts;attempt++){
  actual=await evaluate(cdp,
   'return {width:window.innerWidth,height:window.innerHeight,'+
   'clientWidth:document.documentElement.clientWidth}');
  if(actual&&Math.abs(actual.width-cfg.width)<=2&&Math.abs(actual.height-cfg.height)<=2)
   return actual;
  if(attempt+1<attempts)await delay(intervalMs);
 }
 throw Error('Viewport emulado não aplicado: esperado '+cfg.width+'x'+cfg.height+
  ', observado '+(actual?.width??'?')+'x'+(actual?.height??'?')+
  ' (conteúdo '+(actual?.clientWidth??'?')+'px).');
}
async function start(profile){
 const port=await availablePort(),running=launch(profile,port);
 try{
  const endpoint=await awaitTarget(port,running.child),cdp=await connect(endpoint);
  await cdp.send('Runtime.enable');
  // A Chrome tab exists before React and preload have finished loading.
  // Assert actual bridge + DOM readiness instead of relying on a sleep.
  for(let i=0;i<80;i++){
   try{
    const ready=await evaluate(cdp,'return !!(window.financeDesktop && document.querySelector(\"button.nav-item[aria-label=\\\"Visão geral\\\"]\"))');
    if(ready)return {...running,cdp};
   }catch{}
   await delay(250);
  }
  throw Error('Renderer/preload não ficaram prontos em 20 s');
 }catch(error){
  running.child.kill();
  throw Error(error.message+'; Electron output: '+running.logs());
 }
}
async function closeCleanly(running){
 if(running.child.exitCode!==null)throw Error('Electron encerrou antes do fechamento solicitado');
 const exited=new Promise(resolve=>running.child.once('exit',code=>resolve(code)));
 try{await running.cdp.send('Browser.close')}catch{} // Browser.close can close CDP before ack.
 const code=await Promise.race([exited,delay(10000).then(()=>null)]);
 if(code===null){running.child.kill();throw Error('Electron não encerrou em 10 segundos: '+running.logs())}
 assert.equal(code,0,'Electron não encerrou normalmente');
 try{running.cdp.socket.close()}catch{}
}
async function checkNavigation(cdp){
 const pages=SMOKE_VIEWS;
 for(const label of pages){
  const result=await evaluate(cdp,
   'const label='+JSON.stringify(label)+';'+
   'const find=()=>[...document.querySelectorAll("button.nav-item")].find(b=>b.getAttribute("aria-label")===label);'+
   'const b=find();if(!b)throw Error("Botão ausente: "+label);b.click();'+
   'await new Promise(r=>setTimeout(r,120));'+
   'return {selected:find()?.getAttribute("aria-current"),visible:document.querySelector(".mf-workspace-bar strong")?.textContent===label};');
  assert.equal(result.selected,'page','Navegação não selecionou '+label);
  assert.equal(result.visible,true,'Navegação não exibiu '+label);
 }
}
async function visualMatrix(cdp){
 // Real browser evidence, rather than asserting CSS tokens exist.
 // Views are generated exclusively from the temporary synthetic profile.
 const output=process.env.MF_SMOKE_OUTPUT_DIR||
  fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-synthetic-visual-'));
 fs.mkdirSync(output,{recursive:true});
 const cases=SMOKE_PRESETS;
 const pages=SMOKE_VIEWS;
 await cdp.send('Page.enable');
 const rows=[];
 for(const cfg of cases){
  await cdp.send('Emulation.setDeviceMetricsOverride',{
   width:cfg.width,height:cfg.height,deviceScaleFactor:1,mobile:false
  });
  await cdp.send('Emulation.setEmulatedMedia',{features:[
   {name:'prefers-reduced-motion',value:cfg.motion},
   {name:'prefers-color-scheme',value:cfg.theme}
  ]});
  // Wait for Chromium to apply device metrics; do not assume the CDP ack
  // means the renderer has already completed a layout pass.
  await waitForEmulatedViewport(cdp,cfg);
  const appearance=await evaluate(cdp,
   'window.MFAppearance.set('+JSON.stringify(cfg.theme)+');return document.documentElement.dataset.theme');
  assert.equal(appearance,cfg.theme,'Tema do aplicativo não foi aplicado');
  for(const label of pages){
   const state=await evaluate(cdp,
    'const label='+JSON.stringify(label)+';'+
    'const button=[...document.querySelectorAll("button.nav-item")].find(b=>b.getAttribute("aria-label")===label);'+
    'if(!button)throw Error("Navegação ausente: "+label);button.click();'+
    'await new Promise(r=>setTimeout(r,180));'+
    'return {title:document.querySelector(".mf-workspace-bar strong")?.textContent,'+
    'selected:button.getAttribute("aria-current"),viewportWidth:window.innerWidth,'+
    'viewportHeight:window.innerHeight,contentWidth:document.documentElement.clientWidth,'+
    'scrollWidth:document.documentElement.scrollWidth,'+
    'theme:document.documentElement.dataset.theme,'+
    'reduced:matchMedia("(prefers-reduced-motion: reduce)").matches};');
   assert.equal(state.title,label,'Breadcrumb divergente do destino');
   assert.equal(state.selected,'page','Navegação não atualizou aria-current');
   assert.equal(state.theme,cfg.theme,'Tema foi perdido na navegação');
   assert.equal(state.reduced,cfg.motion==='reduce','Preferência de movimento ignorada');
   assert(Math.abs(state.viewportWidth-cfg.width)<=2&&Math.abs(state.viewportHeight-cfg.height)<=2,
    'Viewport emulado divergente em '+label+': esperado '+cfg.width+'x'+cfg.height+
    ', observado '+state.viewportWidth+'x'+state.viewportHeight);
   assert(Number.isFinite(state.contentWidth)&&state.contentWidth>0&&
    state.contentWidth<=state.viewportWidth+2,
    'Largura de conteúdo inválida em '+label+': '+state.contentWidth+'/'+state.viewportWidth);
   assert(state.scrollWidth<=state.contentWidth+2,
    'Overflow horizontal global em '+label+' '+cfg.width+': '+state.scrollWidth+'/'+state.contentWidth);
   const safe=({ 'Visão geral':'overview','Movimentações':'transactions',
      'Planejamento':'planning','Orçamentos':'budgets',
      'Minhas contas':'accounts','Simular compra':'simulator',
      'Inteligência':'intelligence','Configurações':'settings'})[label];
   assert(safe,'Área desconhecida na matriz: '+label);
   const name=[cfg.width+'x'+cfg.height,cfg.theme,cfg.motion,safe].join('-')+'.png';
   const shot=await cdp.send('Page.captureScreenshot',{
    format:'png',captureBeyondViewport:false,fromSurface:true
   });
   assert(shot.data&&shot.data.length>150,'Captura PNG vazia');
   const png=Buffer.from(shot.data,'base64');
   assert(png.length>100&&png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
    'CDP não entregou uma imagem PNG íntegra');
   fs.writeFileSync(path.join(output,name),png);
   rows.push({page:label,width:cfg.width,height:cfg.height,theme:cfg.theme,
     reduced:state.reduced,viewportWidth:state.viewportWidth,viewportHeight:state.viewportHeight,
     contentWidth:state.contentWidth,scrollWidth:state.scrollWidth,screenshot:name});
  }
 }
 fs.writeFileSync(path.join(output,'visual-matrix.json'),JSON.stringify(rows,null,2)+'\n');
 assert.equal(rows.length,cases.length*pages.length);
 return {count:rows.length,output};
}

async function smoke(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-'));
 let running=null;
 try{
  createSyntheticProfile(profile);
  running=await start(profile);
  const info=await evaluate(running.cdp,'return await window.financeDesktop.info()');
  assert.equal(path.resolve(info.path),path.join(profile,'meu-financeiro.sqlite'),'Perfil financeiro NÃO ISOLADO');
  assert.deepEqual(info.integrity,['ok']);
  const bank=await evaluate(running.cdp,'return (await window.financeDesktop.bankStatus()).data');
  assert.equal(bank.accounts.find(a=>a.id===ACCOUNT).balance,null,'Saldo desconhecido convertido em zero');
  assert.equal(bank.totalTransactions,1);
  const cat=await evaluate(running.cdp,
   'return await window.financeDesktop.categorySave({name:"SYNTHETIC CATEGORY",color:"#aabbcc",emoji:"🎯"})');
  assert(cat.categories.some(x=>x.name==='SYNTHETIC CATEGORY'));
  await evaluate(running.cdp,
   'const d=await window.financeDesktop.load("real");'+
   'd.transactions[0].description="SYNTHETIC EDITED";'+
   'd.transactions[0].category="SYNTHETIC CATEGORY";'+
   'd.budgets["SYNTHETIC CATEGORY"]=0;await window.financeDesktop.save("real",d);return true');
  await evaluate(running.cdp,
   'return await window.financeDesktop.bankLinkManual({accountId:"'+ACCOUNT+'",externalId:"synthetic-bank",manualId:"synthetic-manual"})');
  const planned=await evaluate(running.cdp,
   'return await window.financeDesktop.planCreate({title:"SYNTHETIC BILL",kind:"expense",amount:7300,dueDate:"2026-11-20",category:"Contas"})');
  const id=planned.ids[0];assert(id,'Compromisso não criado');
  await evaluate(running.cdp,
   'return await window.financeDesktop.planEdit({id:'+JSON.stringify(id)+',title:"SYNTHETIC BILL EDITED"})');
  await checkNavigation(running.cdp);
  const visuals=await visualMatrix(running.cdp);
  assert.equal(visuals.count,SMOKE_VIEWS.length*SMOKE_PRESETS.length,'Matriz visual incompleta');
  const copies=await evaluate(running.cdp,'return await window.financeDesktop.backupStatus()');
  assert(copies.copies>0,'Backup automático não foi gerado');
  await closeCleanly(running);running=null;
  running=await start(profile);
  const again=await evaluate(running.cdp,'return await window.financeDesktop.load("real")');
  assert.equal(again.transactions[0].description,'SYNTHETIC EDITED');
  assert.equal(again.transactions[0].category,'SYNTHETIC CATEGORY');
  assert.equal(again.budgets['SYNTHETIC CATEGORY'],0);
  const relinked=await evaluate(running.cdp,'return (await window.financeDesktop.bankStatus()).data.transactions');
  assert.equal(relinked.find(t=>t.id==='synthetic-bank').linkedManualId,'synthetic-manual');
  const plan=await evaluate(running.cdp,'return await window.financeDesktop.planOverview()');
  assert(plan.items.some(p=>p.id===id&&p.title==='SYNTHETIC BILL EDITED'));
  const backups=fs.readdirSync(path.join(profile,'copias-de-seguranca')).filter(n=>n.endsWith('.sqlite'));
  assert(backups.length>0,'Arquivo físico do backup ausente');
  for(const filename of backups)assert.equal(validateBackupFile(path.join(profile,'copias-de-seguranca',filename)).ok,true);
  await closeCleanly(running);running=null;
  console.log('PASS: Electron real, navegação DOM, preload IPC, SQLite isolado, persistência após reiniciar e backups.');
 }finally{
  if(running)running.child.kill();
  fs.rmSync(profile,{recursive:true,force:true});
 }
}
if(require.main===module)smoke().catch(e=>{console.error('FAIL REAL ELECTRON D1.2:',e);process.exitCode=1});
module.exports={availablePort,createSyntheticProfile,awaitTarget,checkNavigation,visualMatrix,waitForEmulatedViewport,SMOKE_VIEWS,SMOKE_PRESETS};
