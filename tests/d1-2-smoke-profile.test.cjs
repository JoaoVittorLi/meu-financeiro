'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {isolateSmokeProfile}=require('../electron/smoke-profile.cjs');
function mock(packaged=false){let location=null;return {app:{isPackaged:packaged,setPath:(name,p)=>{assert.equal(name,'userData');location=p}},get location(){return location}}}
test('D1.2 — sem sinalizador não altera perfil real',()=>{const m=mock();assert.equal(isolateSmokeProfile(m.app,{directory:undefined,defaultApp:true}),false);assert.equal(m.location,null)});
test('D1.2 — perfil temporário em Electron de desenvolvimento é isolado',()=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-'));try{const m=mock();assert.equal(isolateSmokeProfile(m.app,{directory:p,defaultApp:true}),true);assert.equal(m.location,fs.realpathSync(p));}finally{fs.rmSync(p,{recursive:true,force:true})}});
test('D1.2 — nega binário empacotado, caminho genérico, relativo e produção',()=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),'mf-d1-electron-'));try{assert.throws(()=>isolateSmokeProfile(mock(true).app,{directory:p,defaultApp:true}),/apenas/);assert.throws(()=>isolateSmokeProfile(mock().app,{directory:p,defaultApp:false}),/apenas/);assert.throws(()=>isolateSmokeProfile(mock().app,{directory:'.',defaultApp:true}),/absoluto/);assert.throws(()=>isolateSmokeProfile(mock().app,{directory:os.tmpdir(),defaultApp:true}),/fora/);}finally{fs.rmSync(p,{recursive:true,force:true})}});
test('D1.2 — o Electron só solicita single-instance lock uma vez',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
 assert.equal((source.match(/requestSingleInstanceLock\(/g)||[]).length,1);
 assert.equal((source.match(/app\.on\('second-instance'/g)||[]).length,1);
 assert.match(source,/const smokeProfileActive=isolateSmokeProfile\(app\);[\s\S]*?const isPrimaryInstance=app\.requestSingleInstanceLock\(\)/);
});
