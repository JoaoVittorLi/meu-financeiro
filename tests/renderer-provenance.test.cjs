'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {makeManifest,validateManifest,verifyArchive,checkFreshBundle,createArchiveReader,hash,MANIFEST}=require('../scripts/renderer-provenance.cjs');
const ts=require('typescript');
const sha='a'.repeat(40);
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-b00-'));
 fs.mkdirSync(path.join(root,'app','vendor'),{recursive:true});
 fs.mkdirSync(path.join(root,'node_modules','typescript'),{recursive:true});
 fs.writeFileSync(path.join(root,'node_modules','typescript','package.json'),JSON.stringify({name:'typescript',version:'5.8.3'}));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.9.5-beta.3',devDependencies:{electron:'45.2.3'}}));
 for(const [name,contents] of Object.entries({
  'index.html':'<!doctype html><script src="app.js"></script>',
  'app.js':'function renderIntelligencePrivacy(){}function renderIntelligenceFinancialContext(){}',
  'style.css':'.mf-select-popover{z-index:600}',
  'intelligence.css':'.mf-ai-drawer{z-index:500}',
  'vendor/LICENSE_REACT.txt':'MIT license fixture',
  'vendor/react.min.js':'test fixture'
 }))fs.writeFileSync(path.join(root,'app',name),contents);
 const release=()=>fs.rmSync(root,{recursive:true,force:true});
 return {root,release};
}
test('B00 records version, commit, toolchain and exact renderer asset hashes',()=>{
 const {root,release}=fixture();
 try{
  const manifest=makeManifest(root,sha,{node:'v22.16.0',typescript:'5.8.3'});
  assert.equal(manifest.sourceCommit,sha);assert.equal(manifest.version,'0.9.5-beta.3');
  assert.equal(manifest.toolchain.typescript,'5.8.3');
  assert.equal(manifest.assets['app/app.js'],hash(fs.readFileSync(path.join(root,'app/app.js'))));
  assert.ok(!Object.keys(manifest.assets).includes(MANIFEST));
  assert.equal(validateManifest(root,manifest,sha),true);
 }finally{release()}
});

test('B00 normalizes nested archive paths for Windows and POSIX readers',()=>{
 // ASAR uses dirname() and then split(path.sep) when traversing its header.
 // A forward-slash dirname with two segments is one nonexistent key on Windows.
 for(const paths of [path.win32,path.posix]){
  const header={files:{app:{files:{vendor:{files:{'LICENSE_REACT.txt':'MIT'}}}}}};
  const extract=(_archive,name)=>{
   let node=header;
   for(const part of paths.dirname(name).split(paths.sep))node=node.files?.[part];
   const file=node?.files?.[paths.basename(name)];
   if(!file)throw new Error('not found in archive: '+name);
   return file;
  };
  if(paths===path.win32)assert.throws(()=>extract('fixture.asar','app/vendor/LICENSE_REACT.txt'),/not found/);
  const read=createArchiveReader(extract,paths);
  assert.equal(read('fixture.asar','app/vendor/LICENSE_REACT.txt'),'MIT');
  assert.throws(()=>read('fixture.asar','app/vendor/MISSING.txt'),/not found/);
 }
});
test('B00 rejects old bundles, tampered CSS and a different commit',()=>{
 const {root,release}=fixture();
 try{
  let manifest=makeManifest(root,sha,{node:'v22.16.0',typescript:'5.8.3'});
  assert.throws(()=>validateManifest(root,manifest,'b'.repeat(40)),/Commit/);
  fs.writeFileSync(path.join(root,'app/style.css'),'/* tampered */');
  assert.throws(()=>validateManifest(root,manifest,sha),/Hash.*style.css/);
  fs.writeFileSync(path.join(root,'app/app.js'),'/* old version */');
  assert.throws(()=>makeManifest(root,sha,{node:'v22',typescript:'5.8.3'}),/Bundle desatualizado/);
 }finally{release()}
});
test('B00 refuses package versions and missing frontend assets not matching manifest',()=>{
 const {root,release}=fixture();
 try{
  const manifest=makeManifest(root,sha,{node:'v22',typescript:'5.8.3'});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.9.4',devDependencies:{electron:'45.2.3'}}));
  assert.throws(()=>validateManifest(root,manifest,sha),/Versão/);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.9.5-beta.3',devDependencies:{electron:'45.2.3'}}));
  fs.writeFileSync(path.join(root,'app/vendor/rogue.js'),'surprise');
  assert.throws(()=>validateManifest(root,manifest,sha),/Lista/);
 }finally{release()}
});
test('B00 compares every ASAR renderer byte, including package version',async()=>{
 const {root,release}=fixture();
 try{
  const manifest=makeManifest(root,sha,{node:'v22',typescript:'5.8.3'});
  fs.writeFileSync(path.join(root,MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  const archive=path.join(root,'app.asar');fs.writeFileSync(archive,'synthetic-asar');
  const reader=async(_,name)=>fs.readFileSync(path.join(root,name));
  assert.equal(await verifyArchive(root,archive,reader,sha),true);
  let corrupt=false;
  const bad=async(_,name)=>name==='app/app.js'?Buffer.from('old renderer'):reader(_,name);
  try{await verifyArchive(root,archive,bad,sha)}catch(e){corrupt=/ASAR.*app.js/.test(e.message)}
  assert.equal(corrupt,true);
 }finally{release()}
});

// F08: a previous renderer with the correct E3/E4.1 markers must not receive
// a fresh commit SHA merely because the package version changed.
test('F08 rejects stale but marker-complete renderer and changed TS source',()=>{
 const {root,release}=fixture();
 try{
  fs.mkdirSync(path.join(root,'src'));
  const source=path.join(root,'src','app.ts');
  fs.writeFileSync(source,'function renderIntelligencePrivacy(){}\nfunction renderIntelligenceFinancialContext(){}\n');
  fs.writeFileSync(path.join(root,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2019',module:'none',outFile:'app/app.js',removeComments:true},files:['src/app.ts']}));
  // Simulate the actual TypeScript compilation used by npm run compile.
  const program=ts.createProgram([source],{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None,outFile:path.join(root,'app','app.js'),removeComments:true});
  const result=program.emit();assert.equal(result.emitSkipped,false);
  const proof=checkFreshBundle(root);assert.equal(proof.inputSHA256['src/app.ts'].length,64);
  const manifest=makeManifest(root,sha,{node:'v22.16.0',typescript:'5.8.3'});
  assert.equal(validateManifest(root,manifest,sha),true);
  // Same version, both E3 markers remain, but the new source was not built.
  fs.writeFileSync(source,fs.readFileSync(source,'utf8')+'function newerScreen(){}\n');
  assert.throws(()=>makeManifest(root,sha,{node:'v22.16.0',typescript:'5.8.3'}),/Bundle desatualizado/);
  assert.throws(()=>validateManifest(root,manifest,sha),/Bundle desatualizado/);
  // Recompile fixes the bundle, but the original manifest must still fail.
  const fresh=ts.createProgram([source],{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None,outFile:path.join(root,'app','app.js'),removeComments:true});
  assert.equal(fresh.emit().emitSkipped,false);
  assert.throws(()=>validateManifest(root,manifest,sha),/Fonte ou compilação diferente/);
  const updated=makeManifest(root,sha,{node:'v22.16.0',typescript:'5.8.3'});
  assert.equal(validateManifest(root,updated,sha),true);
 }finally{release()}
});
