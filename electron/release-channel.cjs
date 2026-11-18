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
const PROTECTED_SEGMENTS=Object.freeze(['meu-financeiro-desktop','meu financeiro','meufinanceiro-rc-all-01-experimental']);
function normalizeForCompare(target){
 const resolved=path.resolve(target);
 return process.platform==='win32'?resolved.toLowerCase():resolved;
}
function isSameOrInside(parent,candidate){
 const p=normalizeForCompare(parent),c=normalizeForCompare(candidate);
 const rel=path.relative(p,c);
 return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));
}
function assertNoSymlinkOrJunction(target){
 const resolved=path.resolve(target);
 const root=path.parse(resolved).root;
 const rest=resolved.slice(root.length).split(/[\\/]+/).filter(Boolean);
 let current=root;
 if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())
  throw Error('Caminho isolado contém link simbólico ou junction. Abertura negada.');
 for(const segment of rest){
  current=path.join(current,segment);
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())
   throw Error('Caminho isolado contém link simbólico ou junction. Abertura negada.');
 }
}
function extractExperimentalUserDataOverride({env=process.env,argv=process.argv}={}){
 const hasEnv=Boolean(env&&Object.prototype.hasOwnProperty.call(env,'MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR')&&env.MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR!==undefined);
 let envValue=null;
 if(hasEnv){
  envValue=String(env.MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR);
  if(!envValue.trim())throw Error('Caminho isolado experimental vazio. Perfil financeiro bloqueado.');
 }
 let argValue=null;
 const args=Array.isArray(argv)?argv:[];
 for(let i=0;i<args.length;i++){
  const arg=String(args[i]??'');
  let candidate=null;
  if(arg==='--user-data-dir'){
   const next=args[i+1];
   if(typeof next!=='string'||!next.trim()||next.startsWith('--'))
    throw Error('Argumento --user-data-dir inválido. Perfil financeiro bloqueado.');
   candidate=next;
   i++;
  }else if(arg.startsWith('--user-data-dir=')){
   candidate=arg.slice('--user-data-dir='.length);
   if(!candidate.trim())
    throw Error('Argumento --user-data-dir inválido. Perfil financeiro bloqueado.');
  }
  if(candidate!==null){
   if(argValue!==null&&normalizeForCompare(argValue)!==normalizeForCompare(candidate))
    throw Error('Argumentos --user-data-dir conflitantes. Perfil financeiro bloqueado.');
   argValue=candidate;
  }
 }
 if(envValue!==null&&argValue!==null&&normalizeForCompare(envValue)!==normalizeForCompare(argValue))
  throw Error('Conflito entre MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR e --user-data-dir. Perfil financeiro bloqueado.');
 return envValue??argValue;
}
function validateExperimentalOverridePath(app,rawOverride,{env=process.env}={}){
 if(typeof rawOverride!=='string'||!rawOverride.trim()||rawOverride.includes('\0'))
  throw Error('Caminho isolado experimental inválido. Perfil financeiro bloqueado.');
 const trimmed=rawOverride.trim();
 if(!path.isAbsolute(trimmed))
  throw Error('Caminho isolado experimental precisa ser absoluto. Perfil financeiro bloqueado.');
 if(process.platform==='win32'&&!/^[A-Za-z]:[\\/]/.test(trimmed))
  throw Error('Caminho isolado experimental precisa usar unidade local absoluta. Perfil financeiro bloqueado.');
 const resolved=path.resolve(trimmed);
 if(path.dirname(resolved)===resolved)
  throw Error('Caminho isolado experimental não pode ser a raiz do disco. Perfil financeiro bloqueado.');
 assertNoSymlinkOrJunction(resolved);
 const segments=resolved.split(/[\\/]+/).filter(Boolean).map(s=>s.toLowerCase());
 if(segments.some(seg=>PROTECTED_SEGMENTS.includes(seg)))
  throw Error('Caminho isolado experimental não pode referenciar perfis protegidos. Abertura negada.');
 const appData=path.resolve(app.getPath('appData'));
 if(normalizeForCompare(resolved)===normalizeForCompare(appData))
  throw Error('Caminho isolado experimental não pode apontar para AppData diretamente. Abertura negada.');
 for(const protectedName of [...STABLE_CANDIDATES,ISOLATED_DIR]){
  if(isSameOrInside(path.join(appData,protectedName),resolved))
   throw Error('Caminho isolado experimental não pode apontar para dentro de perfil protegido. Abertura negada.');
 }
 if(env?.LOCALAPPDATA){
  const localPrograms=path.join(path.resolve(env.LOCALAPPDATA),'Programs');
  for(const prog of [STABLE_NAME,EXPERIMENTAL_NAME]){
   if(isSameOrInside(path.join(localPrograms,prog),resolved))
    throw Error('Caminho isolado experimental não pode apontar para pasta de instalação. Abertura negada.');
  }
 }
 assertSafeProfilePath(resolved);
 fs.mkdirSync(resolved,{recursive:true,mode:0o700});
 assertNoSymlinkOrJunction(resolved);
 assertSafeProfilePath(resolved);
 return resolved;
}
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
function experimentalProfileDirectory(app,options={}){
 if(app?.isPackaged===true&&typeof app.getName==='function'&&app.getName()===STABLE_NAME)
  throw Error('Identidade estável não pode usar perfil experimental. Abertura negada.');
 const env=options.env??process.env;
 const argv=options.argv??process.argv;
 const override=extractExperimentalUserDataOverride({env,argv});
 if(override!==null)return validateExperimentalOverridePath(app,override,{env});
 const isolated=path.join(app.getPath('appData'),ISOLATED_DIR);
 assertNoSymlinkOrJunction(isolated);
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
  // Reject any invalid historical backup before deciding an earlier match is reusable.
  const validated=[];
  for(const name of snapshots){
   const candidate=path.join(directory,name);
   const stat=fs.lstatSync(candidate);
   if(stat.isSymbolicLink()||!stat.isFile())
    throw Error('Backup existente inválido; instalação anterior preservada.');
   verifySQLiteFile(candidate);
   validated.push(candidate);
  }
  for(const candidate of validated){
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
 stablePreMigrationBackup,channelStatus,extractExperimentalUserDataOverride,
 validateExperimentalOverridePath,STABLE_NAME,EXPERIMENTAL_NAME,
 STABLE_ID,EXPERIMENTAL_ID,ISOLATED_DIR,STABLE_CANDIDATES};
