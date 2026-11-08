'use strict';
// B00: stable provenance for the exact renderer compiled, tested, and packaged.
// This module never opens userData, SQLite, credentials, or cloud endpoints.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const MANIFEST='app/renderer-provenance.json';
const SCHEMA='mf-renderer-provenance-v1';
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
 const requiredSourceFeatures=['renderIntelligencePrivacy','renderIntelligenceFinancialContext'];
 const bundle=fs.readFileSync(path.join(root,'app/app.js'),'utf8');
 if(!requiredSourceFeatures.every(x=>bundle.includes(x)))
  throw new Error('Bundle desatualizado: falta Inteligência E3/E4.1. Execute npm run compile.');
 return {
  schema:SCHEMA,sourceCommit:commit,version:pkg.version,
  toolchain:{node:toolchain.node,typescript:toolchain.typescript,electron:pkg.devDependencies?.electron||'not-declared'},
  appEntry:'app/index.html',bundle:'app/app.js',
  assets
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
async function verifyArchive(root,archivePath,reader,expectedCommit=getSha(root)){
 const manifest=loadManifest(root);
 validateManifest(root,manifest,expectedCommit);
 if(!fs.existsSync(archivePath))throw new Error('ASAR não encontrado: '+archivePath);
 const read=reader||((await import('@electron/asar')).extractFile);
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
 }else if(mode==='verify'){
  validateManifest(root,loadManifest(root),getSha(root));console.log('PASS: renderer e checkout correspondem ao manifesto.');
 }else if(mode==='verify-asar'){
  if(!process.argv[3])throw new Error('Informe caminho do app.asar');
  await verifyArchive(root,path.resolve(process.argv[3]));
  console.log('PASS: ASAR corresponde byte a byte ao renderer compilado e testado.');
 }else throw new Error('Uso: renderer-provenance.cjs create|verify|verify-asar <app.asar>');
}
if(require.main===module)main().catch(e=>{console.error('ERRO B00: '+e.message);process.exitCode=1});
module.exports={hash,listAssets,makeManifest,validateManifest,verifyArchive,MANIFEST,SCHEMA};
