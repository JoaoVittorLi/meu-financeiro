'use strict';
// Recuperação local com verificação de integridade e rollback.
// Apenas arquivos SQLite do Meu Financeiro são aceitos; segredos bancários NÃO fazem parte do banco.
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const {FinanceDB} = require('./db.cjs');

const REQUIRED = ['profiles', 'transactions', 'budgets', 'financial_settings'];
const verifiedDailyBackups=new Map();
// The automatic backup timer runs hourly. Check complete SQLite integrity only
// when a daily file is first observed or its metadata has changed.
function verifyExistingDailyBackup(filename){
  const stat=fs.statSync(filename);
  const previous=verifiedDailyBackups.get(filename);
  if(previous&&previous.size===stat.size&&previous.mtimeMs===stat.mtimeMs&&previous.ino===stat.ino)return;
  validateBackupFile(filename);
  verifiedDailyBackups.set(filename,{size:stat.size,mtimeMs:stat.mtimeMs,ino:stat.ino});
}
function validateBackupFile(filename){
  const info = fs.statSync(filename);
  if (!info.isFile() || info.size < 100 || info.size > 512 * 1024 * 1024) throw new Error('Cópia de segurança inválida ou grande demais.');
  const magic = Buffer.alloc(16);
  const fd=fs.openSync(filename,'r');try{fs.readSync(fd,magic,0,16,0);}finally{fs.closeSync(fd);}
  if(magic.toString('ascii')!=='SQLite format 3\x00')throw new Error('O arquivo selecionado não é uma cópia válida de dados.');
  const check = new DatabaseSync(filename,{readOnly:true});
  try{
    if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('A cópia está danificada.');
    const present=new Set(check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
    if(REQUIRED.some(t=>!present.has(t)))throw new Error('Esta cópia não pertence ao Meu Financeiro.');
    // Evita importar um SQLite genérico que possui tabelas semelhantes.
    if(!present.has('app_meta'))throw new Error('Formato de cópia não reconhecido.');
    const tables=check.prepare('SELECT value FROM app_meta WHERE key=?').get('schema_version');
    if(!tables || !/^\d+$/.test(String(tables.value)))throw new Error('Versão da cópia não reconhecida.');
    if(Number(tables.value)>6)throw new Error('Esta cópia pertence a uma versão mais recente do aplicativo.');
  }finally{check.close();}
  return {ok:true,bytes:info.size};
}
function listAutoBackups(folder){
  if(!fs.existsSync(folder))return [];
  return fs.readdirSync(folder).filter(n=>/^meu-financeiro-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n))
    .map(n=>({name:n,modified:fs.statSync(path.join(folder,n)).mtime.toISOString()}))
    .sort((a,b)=>b.name.localeCompare(a.name));
}
async function automaticBackup(db,folder,{now=new Date(),keep=7}={}){
  fs.mkdirSync(folder,{recursive:true,mode:0o700});
  const day=now.toISOString().slice(0,10);
  const file=path.join(folder,`meu-financeiro-${day}.sqlite`);
  // Never report an existing daily backup as valid before checking its
  // SQLite format, schema and integrity. Preserve suspicious files for review.
  if(fs.existsSync(file)){
    verifyExistingDailyBackup(file);
    return {created:false,file};
  }
  const partial=file+'.partial-'+randomUUID();
  try{
    await db.backupTo(partial+'.sqlite');
    // A failed or incomplete backup must not be published under the daily name
    // or trigger retention deletion of older valid backups.
    validateBackupFile(partial+'.sqlite');
    fs.renameSync(partial+'.sqlite',file);
    const stat=fs.statSync(file);
    verifiedDailyBackups.set(file,{size:stat.size,mtimeMs:stat.mtimeMs,ino:stat.ino});
    for(const entry of listAutoBackups(folder).slice(keep)){
      fs.rmSync(path.join(folder,entry.name),{force:true});
      verifiedDailyBackups.delete(path.join(folder,entry.name));
    }
    return {created:true,file};
  }finally{
    // PRAGMA quick_check may create WAL/SHM companions for a temporary
    // SQLite backup in WAL mode. Remove ALL temporary files, not just .sqlite.
    for(const suffix of ['', '-wal', '-shm'])
      fs.rmSync(partial+'.sqlite'+suffix,{force:true});
  }
}
async function restoreBackup(currentDb,source,activeFile,folder){
  const id=randomUUID();
  const staging=path.join(path.dirname(activeFile),'.importacao-'+id+'.sqlite');
  const oldFile=activeFile+'.anterior-'+id;
  let movedOld=false,movedNew=false,closed=false;
  fs.mkdirSync(folder,{recursive:true,mode:0o700});
  try{
    if(path.resolve(source)===path.resolve(activeFile))throw new Error('Escolha uma cópia diferente do arquivo ativo.');
    fs.copyFileSync(source,staging,fs.constants.COPYFILE_EXCL);
    validateBackupFile(staging);
    // Testa upgrade em cópia isolada; nunca modifica o arquivo escolhido.
    const probe=new FinanceDB(staging);
    try{
      if(probe.integrity().join(',')!=='ok')throw new Error('A cópia não passou na verificação de integridade.');
      probe.load('real');
      probe.listCategories();
      probe.bankOverview();
    }finally{probe.close();}
    const rescue=path.join(folder,'antes-da-restauracao-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+id.slice(0,8)+'.sqlite');
    await currentDb.backupTo(rescue);
    validateBackupFile(rescue);
    currentDb.close();closed=true;
    if(fs.existsSync(activeFile+'-wal')||fs.existsSync(activeFile+'-shm'))throw new Error('A cópia ativa ainda está em uso por outro processo.');
    fs.renameSync(activeFile,oldFile);movedOld=true;
    fs.renameSync(staging,activeFile);movedNew=true;
    const restored=new FinanceDB(activeFile);
    if(restored.integrity().join(',')!=='ok'){
      restored.close();throw new Error('O banco restaurado apresentou problema de integridade.');
    }
    fs.rmSync(oldFile,{force:true});
    return {db:restored,recovery:rescue};
  }catch(error){
    // Se a troca começou, reabre o banco anterior e entrega o handle de recuperação.
    if(movedOld){
      try{
        if(movedNew)fs.rmSync(activeFile,{force:true});
        fs.renameSync(oldFile,activeFile);
        error.recoveredDb=new FinanceDB(activeFile);
      }catch(fatal){
        error.message+=' Não foi possível reabrir automaticamente a versão anterior; consulte suas cópias locais.';
      }
    }else if(closed){
      try{error.recoveredDb=new FinanceDB(activeFile);}catch(_){error.message+=' Não foi possível reabrir a base atual.';}
    }
    throw error;
  }finally{
    fs.rmSync(staging,{force:true});
  }
}
module.exports={validateBackupFile,listAutoBackups,automaticBackup,restoreBackup};
