'use strict';
// Stable packaging is an explicit BUILD action, never a runtime environment flag.
// Keep the ordinary dist:windows path experimental and isolated by default.
const {build,Platform,Arch}=require('electron-builder');
const pkg=require('../package.json');
const {STABLE_NAME,STABLE_ID}=require('../electron/release-channel.cjs');
if(process.platform!=='win32')throw Error('A distribuição estável somente pode ser empacotada no runner Windows.');
if(pkg.build?.appId!=='app.local.meufinanceiro.rcall01')
 throw Error('Base experimental inesperada: recusar empacotamento.');
const config={
 ...pkg.build,appId:STABLE_ID,productName:STABLE_NAME,
 extraMetadata:{...pkg.build.extraMetadata,
  mfDistributionChannel:'stable',productName:STABLE_NAME}
};
const targets=Platform.WINDOWS.createTarget(['nsis'],Arch.x64);
build({targets,config,publish:'never'}).then(()=>{
 console.log('Stable build created with packaged app identity and stable profile continuity; Windows QA still required.');
}).catch(error=>{console.error('Stable build failed:',String(error?.message||error));process.exitCode=1;});
