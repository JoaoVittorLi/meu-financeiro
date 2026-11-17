'use strict';
// RC-ALL-02.2: explicit packaged distribution identity. No runtime environment
// variable can grant a packaged RC access to the stable financial profile.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync,backup}=require('node:sqlite');
const crypto=require('node:crypto');
const EXPERIMENTAL_NAME='Meu Financeiro RC Experimental';
const STABLE_NAME='Meu Financeiro';
const EXPERIMENTAL_ID='app.local.meufinanceiro.rcall01';
const STABLE_ID='app.local.meufinanceiro';
const ISOLATED_DIR='MeuFinanceiro-RC-ALL-01-Experimental';
const STABLE_CANDIDATES=Object.freeze([STABLE_NAME,'meu-financeiro-desktop']);
function releaseChannel(app,metadata=require('../package.json')){
 if(!app.isPackaged)return 'development';
 // Older RC installers have no marker; default to ISOLATED, never stable.
 const marker=metadata?.mfDistributionChannel??'experimental';
 if(marker!=='stable'&&marker!=='experimental')
  throw Error('Identidade de distribuição inválida. Perfil financeiro bloqueado.');
 if(marker==='stable'&&app.getName()!==STABLE_NAME)
  throw Error('Identidade estável incompatível com o pacote. Perfil bloqueado.');
 // Legacy electron-builder RC packages may expose the npm name rather
 // than the configured productName. Either identity remains ISOLATED only.
 if(marker==='experimental'&&
    app.getName()!==EXPERIMENTAL_NAME&&app.getName()!=='meu-financeiro-desktop')
  throw Error('Identidade experimental incompatível com o pacote. Perfil bloqueado.');
 return marker;
}
function assertSafeProfilePath(root){
 if(fs.existsSync(root)&&fs.lstatSync(root).isSymbolicLink())
  throw Error('Perfil financeiro é um link simbólico. Abertura negada.');
 const db=path.join(root,'meu-financeiro.sqlite');
 if(fs.existsSync(db)&&fs.lstatSync(db).isSymbolicLink())
  throw Error('Banco financeiro é um link simbólico. Abertura negada.');
 return db;
}
function stableProfileDirectory(app){
 const appData=app.getPath('appData');
 // Both candidates belong to the same Windows user, never the RC folder.
 const known=STABLE_CANDIDATES.map(name=>path.join(appData,name));
 const present=known.filter(dir=>fs.existsSync(assertSafeProfilePath(dir)));
 if(present.length>1)throw Error(
  'Foram encontrados dois perfis financeiros anteriores. Nenhum foi modificado. Confirme o perfil correto antes da atualização.');
 const chosen=present[0]||known[0];
 assertSafeProfilePath(chosen);
 return chosen;
}
function experimentalProfileDirectory(app){
 const isolated=path.join(app.getPath('appData'),ISOLATED_DIR);
 assertSafeProfilePath(isolated);
 fs.mkdirSync(isolated,{recursive:true,mode:0o700});
 return isolated;
}
function verifySQLiteFile(file){
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  const check=db.prepare('PRAGMA integrity_check').get();
  if(!check||Object.values(check)[0]!=='ok')
   throw Error('Integridade SQLite inválida; instalação anterior preservada.');
  const hasProfiles=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='profiles'").get();
  if(!hasProfiles)throw Error('Banco existente sem estrutura financeira reconhecida; migração bloqueada.');
 }finally{db.close();}
}
// Capture the *current* verified SQLite state, including uncheckpointed WAL, before
// each stable startup/migration. A backup from the same app version can be stale.
// Keep historical snapshots immutable; only reuse one if the online snapshot's
// SHA-256 is identical. The Pluggy safeStorage vault remains in its original path.
async function sqliteSha256(file){
 const hash=crypto.createHash('sha256');
 for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
}
async function stablePreMigrationBackup(root,version){
 const file=assertSafeProfilePath(root);
 if(!fs.existsSync(file))return {existing:false,backup:null};
 verifySQLiteFile(file);
 const label=String(version||'unknown').replace(/[^a-zA-Z0-9.-]/g,'_').slice(0,80);
 const directory=path.join(root,'copias-de-seguranca');
 assertSafeProfilePath(directory);
 if(fs.existsSync(directory)&&fs.lstatSync(directory).isSymbolicLink())
  throw Error('Pasta de backup inválida; instalação anterior preservada.');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const stem='pre-upgrade-'+label;
 const primary=path.join(directory,stem+'.sqlite');
 const temporary=primary+'.partial';
 // Previous interrupted backup is evidence of an incomplete migration attempt.
 // Do not delete or bypass it silently.
 if(fs.existsSync(temporary))
  throw Error('Backup parcial anterior requer conferência. Nenhuma migração executada.');
 const uuidSuffix=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.sqlite$/i;
 const snapshots=fs.readdirSync(directory).filter(name=>
  name===stem+'.sqlite'||
  (name.startsWith(stem+'-')&&uuidSuffix.test(name.slice(stem.length+1))));
 const source=new DatabaseSync(file,{readOnly:true});
 try{
  await backup(source,temporary);
  verifySQLiteFile(temporary);
  const currentHash=await sqliteSha256(temporary);
  for(const name of snapshots){
   const candidate=path.join(directory,name);
   const stat=fs.lstatSync(candidate);
   if(stat.isSymbolicLink()||!stat.isFile())
    throw Error('Backup existente inválido; instalação anterior preservada.');
   verifySQLiteFile(candidate);
   if(await sqliteSha256(candidate)===currentHash){
    fs.rmSync(temporary,{force:true});
    return {existing:true,backup:candidate};
   }
  }
  // Never overwrite a valid older snapshot, even if both runs share a version.
  const destination=snapshots.length?
   path.join(directory,stem+'-'+crypto.randomUUID()+'.sqlite'):primary;
  if(fs.existsSync(destination))
   throw Error('Colisão de nome no backup. Nenhuma migração executada.');
  fs.renameSync(temporary,destination);
  return {existing:true,backup:destination};
 }catch(error){
  try{fs.rmSync(temporary,{force:true});}catch(_){}
  throw error;
 }finally{source.close();}
}
function channelStatus(channel){
 return {channel,isolated:channel!=='stable'&&channel!=='development',
  connectionEnabled:channel==='stable'||channel==='development'};
}
module.exports={releaseChannel,stableProfileDirectory,experimentalProfileDirectory,
 stablePreMigrationBackup,channelStatus,STABLE_NAME,EXPERIMENTAL_NAME,
 STABLE_ID,EXPERIMENTAL_ID,ISOLATED_DIR,STABLE_CANDIDATES};
