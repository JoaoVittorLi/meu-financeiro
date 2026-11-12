'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {availablePort,awaitTarget,connect,evaluate}=require('./d1-electron-smoke.cjs');
const {seedQ1}=require('./q1-fixture.cjs');
async function launchQ1({profile,size='1366x768',infoFile}={}){
 if(!profile){profile=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-q1-'));seedQ1(profile);}
 const resolved=fs.realpathSync(profile),temp=fs.realpathSync(os.tmpdir()),relative=path.relative(temp,resolved);
 assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^mf-d1-electron-[A-Za-z0-9_-]+$/.test(path.basename(resolved)),'Perfil Q1 precisa ser temporário e isolado');
 const port=await availablePort(),env={...process.env,MF_DESKTOP_SMOKE_DIR:resolved,MF_Q1_NATIVE_SIZE:size};delete env.ELECTRON_RUN_AS_NODE;
 const logFile=path.join(resolved,'q1-'+size+'-electron.txt'),log=fs.createWriteStream(logFile,{flags:'a'});
 const child=spawn(require('electron'),['--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+resolved,path.resolve(__dirname,'..')],{env,windowsHide:false,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log);child.stderr.pipe(log);
 try{
  const endpoint=await awaitTarget(port,child),cdp=await connect(endpoint);await cdp.send('Runtime.enable');
  for(let i=0;i<80;i++){
   if(await evaluate(cdp,'return !!window.financeDesktop && !!document.querySelector("button.nav-item")'))break;
   await new Promise(r=>setTimeout(r,100));
  }
  const info=await evaluate(cdp,'return await window.financeDesktop.info()');assert.equal(path.resolve(info.path),path.join(resolved,'meu-financeiro.sqlite'));assert.deepEqual(info.integrity,['ok']);
  const metadata={profile:resolved,port,endpoint,pid:child.pid,requestedCapture:size,logFile,version:info.appVersion,sqliteIsolated:true,sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
  if(infoFile)fs.writeFileSync(infoFile,JSON.stringify(metadata,null,2));
  return {child,cdp,metadata};
 }catch(e){child.kill();throw e;}
}
if(require.main===module)launchQ1({profile:process.env.MF_Q1_REUSE_PROFILE,size:process.env.MF_Q1_CAPTURE_SIZE||'1366x768',infoFile:process.env.MF_Q1_INFO_FILE}).then(r=>{console.log(JSON.stringify(r.metadata));r.child.on('exit',code=>{r.cdp.socket.close();console.log('Q1_EXIT='+code);process.exitCode=code??1;});}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={launchQ1};
