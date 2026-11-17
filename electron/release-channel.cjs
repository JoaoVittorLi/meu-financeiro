'use strict';
// RC-ALL-02.2: explicit packaged distribution identity. No runtime environment
// variable can grant a packaged RC access to the stable financial profile.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync,backup}=require('node:sqlite');
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
// A verified online SQLite backup captures WAL as well. Never copy the vault:
// Windows safeStorage must read the original encrypted file in the same profile.
async function stablePreMigrationBackup(root,version){
 const file=assertSafeProfilePath(root);
 if(!fs.existsSync(file))return {existing:false,backup:null};
 verifySQLiteFile(file);
 const label=String(version||'unknown').replace(/[^a-zA-Z0-9.-]/g,'_').slice(0,80);
 const directory=path.join(root,'copias-de-seguranca');
 assertSafeProfilePath(directory);
 if(fs.existsSync(directory)&&fs.lstatSync(directory).isSymbolicLink())
  throw Error('Pasta de backup inválida; instalação anterior preservada.');
 const destination=path.join(directory,'pre-upgrade-'+label+'.sqlite');
 if(fs.existsSync(destination)){
  if(fs.lstatSync(destination).isSymbolicLink())throw Error('Backup de atualização inválido.');
  verifySQLiteFile(destination);
  return {existing:true,backup:destination};
 }
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const temporary=destination+'.partial';
 if(fs.existsSync(temporary))throw Error('Backup parcial anterior requer conferência. Nenhuma migração executada.');
 const source=new DatabaseSync(file,{readOnly:true});
 try{
  await backup(source,temporary);
  verifySQLiteFile(temporary);
  fs.renameSync(temporary,destination);
 }catch(error){
  try{fs.rmSync(temporary,{force:true});}catch(_){}
  throw error;
 }finally{source.close();}
 return {existing:true,backup:destination};
}
function channelStatus(channel){
 return {channel,isolated:channel!=='stable'&&channel!=='development',
  connectionEnabled:channel==='stable'||channel==='development'};
}
module.exports={releaseChannel,stableProfileDirectory,experimentalProfileDirectory,
 stablePreMigrationBackup,channelStatus,STABLE_NAME,EXPERIMENTAL_NAME,
 STABLE_ID,EXPERIMENTAL_ID,ISOLATED_DIR,STABLE_CANDIDATES};
