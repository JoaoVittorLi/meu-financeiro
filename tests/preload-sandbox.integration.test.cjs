'use strict';
// Runtime proof for the exact bundle loaded by BrowserWindow sandbox:true.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
