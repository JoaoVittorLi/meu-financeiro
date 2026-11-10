'use strict';
// B00: stable provenance for the exact renderer compiled, tested, and packaged.
// This module never opens userData, SQLite, credentials, or cloud endpoints.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const MANIFEST='app/renderer-provenance.json';
const SCHEMA='mf-renderer-provenance-v2';
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function readPackage(root){return JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));}
function listAssets(root){
 const directory=path.join(root,'app'),result=[];
 function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const full=path.join(dir,entry.name),rel=path.relative(root,full).split(path.sep).join('/');
   if(rel===MANIFEST)continue;
   if(entry.isSymbolicLink())throw new Error('Renderer não permite links simbólicos: '+rel);
   if(entry.isDirectory())walk(full);
   else if(entry.isFile())result.push(rel);
  }
 }
 walk(directory);
 for(const required of ['app/app.js','app/index.html','app/style.css','app/intelligence.css'])
  if(!result.includes(required))throw new Error('Arquivo obrigatório não encontrado: '+required);
 return result.sort();
}
function getSha(root){
 const value=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(!/^[a-f0-9]{40}$/.test(value))throw new Error('SHA de origem não encontrado.');
 if(process.env.CIRCLE_SHA1&&process.env.CIRCLE_SHA1!==value)
  throw new Error('Checkout diferente do SHA informado pelo CircleCI.');
 return value;
}
function getTypescript(root){
 const loc=require.resolve('typescript/package.json',{paths:[root]});
 return JSON.parse(fs.readFileSync(loc,'utf8')).version;
}
// F08: verify compiler output against the exact checked-out TypeScript inputs.
// This is a second, independent check: markers and matching package versions are insufficient.
function checkFreshBundle(root){
 const configPath=path.join(root,'tsconfig.json');
 // The minimal B00 unit fixtures intentionally have no TypeScript project.
 // Real production builds always carry a tsconfig and record a source proof.
 if(!fs.existsSync(configPath))return null;
 const ts=require('typescript');
 const config=ts.readConfigFile(configPath,ts.sys.readFile);
 if(config.error)throw new Error('F08: tsconfig ilegível: '+ts.flattenDiagnosticMessageText(config.error.messageText,' '));
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root,undefined,configPath);
 if(parsed.errors.length||!parsed.fileNames.length)
  throw new Error('F08: tsconfig incompleto ou inválido.');
 const outputPath=path.join(root,'app','app.js');
 let generated=null;
 const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options});
 const diagnostics=ts.getPreEmitDiagnostics(program);
 const result=program.emit(undefined,(name,contents)=>{
  if(path.resolve(name)===path.resolve(outputPath))generated=Buffer.from(contents,'utf8');
 });
 const failures=[...diagnostics,...result.diagnostics].filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(failures.length)throw new Error('F08: compilação inválida: '+ts.flattenDiagnosticMessageText(failures[0].messageText,' '));
 if(!generated)throw new Error('F08: compilação não emitiu app/app.js.');
 const bundleFile=fs.readFileSync(outputPath);
 if(hash(generated)!==hash(bundleFile))
  throw new Error('F08: Bundle desatualizado frente às fontes TypeScript. Execute npm run compile.');
 const inputPaths=['tsconfig.json',...parsed.fileNames.map(file=>{
  const relative=path.relative(root,file).split(path.sep).join('/');
  if(relative.startsWith('../')||path.isAbsolute(relative))throw new Error('F08: arquivo de fonte fora do projeto: '+relative);
  return relative;
 })];
 return {compilerOutputSHA256:hash(generated),inputSHA256:Object.fromEntries(inputPaths.sort().map(rel=>[rel,hash(fs.readFileSync(path.join(root,rel)))]))};
}
function checkCheckout(root){
 const changed=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
 const unexpected=changed.filter(x=>x!=='app/app.js');
 if(unexpected.length)throw new Error('Fontes alteradas fora do commit: '+unexpected.join(', '));
}
function makeManifest(root,commit,toolchain){
 const pkg=readPackage(root);
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('SHA inválido.');
 if(!/^\d+\.\d+\.\d+/.test(pkg.version))throw new Error('Versão inválida.');
 const assets=Object.fromEntries(listAssets(root).map(x=>[x,hash(fs.readFileSync(path.join(root,x)))]));
 const sourceProof=checkFreshBundle(root);
 const requiredSourceFeatures=['renderIntelligencePrivacy','renderIntelligenceFinancialContext'];
 const bundle=fs.readFileSync(path.join(root,'app/app.js'),'utf8');
 if(!requiredSourceFeatures.every(x=>bundle.includes(x)))
  throw new Error('Bundle desatualizado: falta Inteligência E3/E4.1. Execute npm run compile.');
 return {
  schema:SCHEMA,sourceCommit:commit,version:pkg.version,
  toolchain:{node:toolchain.node,typescript:toolchain.typescript,electron:pkg.devDependencies?.electron||'not-declared'},
  appEntry:'app/index.html',bundle:'app/app.js',
  sourceProof,assets
 };
}
function validateManifest(root,manifest,expectedCommit){
 if(!manifest||manifest.schema!==SCHEMA||typeof manifest.assets!=='object'||!manifest.assets)
  throw new Error('Manifesto de renderer inválido.');
 if(manifest.sourceCommit!==expectedCommit)throw new Error('Commit diferente do manifesto de renderer.');
 const pkg=readPackage(root);
 if(manifest.version!==pkg.version)throw new Error('Versão do renderer difere do package.json.');
 if(manifest.toolchain?.typescript!==getTypescript(root))throw new Error('Compilador diferente do manifesto.');
 if(manifest.toolchain?.electron!==pkg.devDependencies?.electron)throw new Error('Electron diferente do manifesto.');
 const currentProof=checkFreshBundle(root);
 if(JSON.stringify(manifest.sourceProof||null)!==JSON.stringify(currentProof))
  throw new Error('F08: Fonte ou compilação diferente da prova incluída no manifesto.');
 const paths=listAssets(root);
 if(JSON.stringify(paths)!==JSON.stringify(Object.keys(manifest.assets).sort()))
  throw new Error('Lista de arquivos do renderer foi alterada.');
 for(const name of paths){
  const expected=manifest.assets[name];
  if(!/^[a-f0-9]{64}$/.test(expected)||hash(fs.readFileSync(path.join(root,name)))!==expected)
   throw new Error('Hash do renderer não confere: '+name);
 }
 return true;
}
function loadManifest(root){return JSON.parse(fs.readFileSync(path.join(root,MANIFEST),'utf8'));}
// Manifest paths stay portable (POSIX). ASAR traverses nested directories using
// path.sep, so its API must receive native paths on Windows as well as Linux.
function createArchiveReader(extractFile,pathApi=path){
 return (archive,name)=>extractFile(archive,pathApi.normalize(name));
}
async function verifyArchive(root,archivePath,reader,expectedCommit=getSha(root)){
 const manifest=loadManifest(root);
 validateManifest(root,manifest,expectedCommit);
 if(!fs.existsSync(archivePath))throw new Error('ASAR não encontrado: '+archivePath);
 const read=reader||createArchiveReader((await import('@electron/asar')).extractFile);
 const inside=JSON.parse(Buffer.from(await read(archivePath,MANIFEST)).toString('utf8'));
 if(JSON.stringify(inside)!==JSON.stringify(manifest))throw new Error('Manifesto interno não corresponde ao testado.');
 for(const [name,expected] of Object.entries(manifest.assets)){
  if(hash(Buffer.from(await read(archivePath,name)))!==expected)
   throw new Error('ASAR possui arquivo diferente do renderer testado: '+name);
 }
 const packed=JSON.parse(Buffer.from(await read(archivePath,'package.json')).toString('utf8'));
 if(packed.version!==manifest.version)throw new Error('ASAR possui versão diferente.');
 return true;
}
async function main(){
 const root=path.resolve(__dirname,'..'),mode=process.argv[2];
 if(mode==='create'){
  checkCheckout(root);
  const manifest=makeManifest(root,getSha(root),{node:process.version,typescript:getTypescript(root)});
  fs.writeFileSync(path.join(root,MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  console.log('Renderer documentado: '+manifest.sourceCommit+' v'+manifest.version+'; '+Object.keys(manifest.assets).length+' arquivos.');
 }else if(mode==='check-bundle'){
  const proof=checkFreshBundle(root);
  if(!proof)throw new Error('F08: projeto sem tsconfig.json');
  console.log('PASS F08: app.js recompilado virtualmente bate com fontes ('+Object.keys(proof.inputSHA256).length+' entradas).');
 }else if(mode==='verify'){
  validateManifest(root,loadManifest(root),getSha(root));console.log('PASS: renderer e checkout correspondem ao manifesto.');
 }else if(mode==='verify-asar'){
  if(!process.argv[3])throw new Error('Informe caminho do app.asar');
  await verifyArchive(root,path.resolve(process.argv[3]));
  console.log('PASS: ASAR corresponde byte a byte ao renderer compilado e testado.');
 }else throw new Error('Uso: renderer-provenance.cjs create|check-bundle|verify|verify-asar <app.asar>');
}
if(require.main===module)main().catch(e=>{console.error('ERRO B00: '+e.message);process.exitCode=1});
module.exports={hash,listAssets,checkFreshBundle,makeManifest,validateManifest,verifyArchive,createArchiveReader,MANIFEST,SCHEMA};
