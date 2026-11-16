'use strict';
// Runtime proof for the exact bundle loaded by BrowserWindow sandbox:true.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {generate,OUTPUT}=require('../scripts/build-preload.cjs');
const root=path.resolve(__dirname,'..');

test('sandboxed preload is deterministic and uses only require("electron")',()=>{
 const bundled=generate(root);
 assert.equal(fs.readFileSync(path.join(root,OUTPUT),'utf8'),bundled);
 const deps=[...bundled.matchAll(/\brequire\s*\(\s*(['"])(.*?)\1\s*\)/g)]
  .map(m=>m[2]);
 assert.deepEqual(deps,['electron']);
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
 assert.match(main,/preload:path\.join\(__dirname,'preload-bundled\.cjs'\)/);
 assert.match(main,/contextIsolation:true,nodeIntegration:false,sandbox:true/);
});

test('sandboxed preload exposes named financeDesktop IPC methods without local require',async()=>{
 const source=generate(root),calls=[];
 let exposed=null;
 const electron={
  contextBridge:{exposeInMainWorld:(name,api)=>{
   assert.equal(name,'financeDesktop');
   exposed=api;
  }},
  ipcRenderer:{
   invoke:async(channel,input)=>{
    calls.push({channel,input});
    if(channel==='d05:session-authorize')
     return {token:'SYNTHETIC_TEST_GRANT',profile:'demo',expiresAt:Date.now()+60000};
    return {ok:true};
   },
   on:()=>{},
   removeListener:()=>{}
  }
 };
 vm.runInNewContext(source,{
  require:name=>{
   assert.equal(name,'electron','Sandbox preload tentou importar módulo local.');
   return electron;
  }
 },{filename:'electron/preload-bundled.cjs',timeout:2000});
 assert(exposed&&Object.isFrozen(exposed));
 // Check complete API equivalence, so no D01–D05/I2 method vanishes
 // from the sandbox bundle despite compiling successfully.
 let original=null;
 const raw=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
 vm.runInNewContext(raw,{require:name=>{
  if(name==='electron')return {
   contextBridge:{exposeInMainWorld:(label,api)=>{assert.equal(label,'financeDesktop');original=api;}},
   ipcRenderer:electron.ipcRenderer
  };
  if(name==='./d05-preload-bridge.cjs')
   return require('../electron/d05-preload-bridge.cjs');
  throw Error('Unexpected preload dependency: '+name);
 }},{filename:'electron/preload.cjs',timeout:2000});
 assert(original&&Object.isFrozen(original));
 assert.deepEqual(Object.keys(exposed),Object.keys(original));
 assert.equal(Object.keys(exposed).filter(key=>key.startsWith('d05')).length,26);
 assert.equal(typeof exposed.info,'function');
 assert.equal(typeof exposed.d05Catalog,'function');
 assert.equal(typeof exposed.d05PersonalWriteConfirm,'function');
 assert.equal(exposed.ipcRenderer,undefined);
 await assert.rejects(exposed.d05Catalog(),/autorize sessão/);
 const authorization=await exposed.d05SessionAuthorize({profile:'demo'});
 assert.equal(authorization.profile,'demo');
 await exposed.d05Catalog();
 assert.equal(calls.at(-1).channel,'d05:catalog');
 assert.equal(calls.at(-1).input.sessionToken,'SYNTHETIC_TEST_GRANT');
 await exposed.info();
 assert.equal(calls.at(-1).channel,'finance:info');
});

test('generated sandbox preload and 67 D05 glyphs survive real ASAR packaging byte-for-byte',async()=>{
 const {createPackage,extractFile}=await import('@electron/asar');
 const packageConfig=require('../package.json');
 const files=packageConfig.build?.files||[];
 assert(files.includes('electron/**/*'),'Windows package must include generated preload');
 assert(files.includes('shared/**/*'),'Windows package must include local SVG registry');
 assert.equal(packageConfig.build.asar,true);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-q1-preload-asar-'));
 const stage=path.join(temp,'staging'),archive=path.join(temp,'app.asar');
 try{
  for(const directory of ['electron','shared'])
   fs.mkdirSync(path.join(stage,directory),{recursive:true});
  const expected=generate(root);
  const disk=fs.readFileSync(path.join(root,OUTPUT),'utf8');
  assert.equal(disk,expected,'Compile must generate the Windows preload');
  fs.writeFileSync(path.join(stage,OUTPUT),disk);
  fs.copyFileSync(path.join(root,'shared/d05-svg-registry.json'),
   path.join(stage,'shared/d05-svg-registry.json'));
  fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify({main:'electron/main.cjs'}));
  await createPackage(stage,archive);
  assert.equal(extractFile(archive,OUTPUT).toString('utf8'),expected);
  const registry=JSON.parse(extractFile(archive,'shared/d05-svg-registry.json').toString('utf8'));
  assert.equal(Object.keys(registry.glyphs).length,67);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
