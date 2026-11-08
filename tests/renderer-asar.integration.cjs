'use strict';
// Runs with the declared @electron/asar dependency: no Electron download,
// signing, installer, credentials, or user database is needed.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {makeManifest,verifyArchive,MANIFEST}=require('../scripts/renderer-provenance.cjs');
const sha='a'.repeat(40);

test('B00 real ASAR preserves nested license and rejects missing or changed bytes',async()=>{
 const asar=await import('@electron/asar');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-real-asar-'));
 const root=path.join(temp,'source'),stage=path.join(temp,'stage');
 try{
  const pkg=require('../package.json');
  fs.mkdirSync(path.join(root,'app','vendor'),{recursive:true});
  fs.mkdirSync(path.join(root,'node_modules','typescript'),{recursive:true});
  fs.writeFileSync(path.join(root,'node_modules','typescript','package.json'),JSON.stringify({version:pkg.devDependencies.typescript}));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:pkg.version,devDependencies:{electron:pkg.devDependencies.electron}}));
  for(const [name,content] of Object.entries({
   'index.html':'<!doctype html>',
   'app.js':'function renderIntelligencePrivacy(){}function renderIntelligenceFinancialContext(){}',
   'style.css':'body{}',
   'intelligence.css':'.intelligence{}',
   'vendor/LICENSE_REACT.txt':'MIT license fixture',
   'vendor/react.min.js':'/* synthetic renderer dependency */'
  }))fs.writeFileSync(path.join(root,'app',name),content);
  const manifest=makeManifest(root,sha,{node:process.version,typescript:pkg.devDependencies.typescript});
  fs.writeFileSync(path.join(root,MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  fs.cpSync(root,stage,{recursive:true,filter:src=>!src.includes('node_modules')});
  const archive=path.join(temp,'valid.asar');
  await asar.createPackage(stage,archive);
  assert.equal(asar.extractFile(archive,path.normalize('app/vendor/LICENSE_REACT.txt')).toString(),'MIT license fixture');
  assert.equal(await verifyArchive(root,archive,undefined,sha),true);

  fs.writeFileSync(path.join(stage,'app/vendor/LICENSE_REACT.txt'),'changed');
  const changed=path.join(temp,'changed.asar');
  await asar.createPackage(stage,changed);
  await assert.rejects(verifyArchive(root,changed,undefined,sha),/ASAR.*LICENSE_REACT/);

  fs.unlinkSync(path.join(stage,'app/vendor/LICENSE_REACT.txt'));
  const missing=path.join(temp,'missing.asar');
  await asar.createPackage(stage,missing);
  await assert.rejects(verifyArchive(root,missing,undefined,sha),/LICENSE_REACT.*not found/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
