'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {validateBackupFile,listAutoBackups,automaticBackup,restoreBackup}=require('../electron/recovery.cjs');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-recovery-'));
  const file=path.join(root,'meu-financeiro.sqlite');
  return {root,file,backups:path.join(root,'backups')};
}
const dataset=(label)=>({transactions:[{id:'t-'+label,date:'2026-11-06',description:'Movimentação '+label,kind:'expense',amount:1234,category:'Outros',origin:'manual'}],budgets:{},settings:{opening:100000,income:0,fixed:0,existing:0,reserve:0}});

test('cópia íntegra permite restauração do histórico, categorias e regras',async()=>{
 const f=fixture();let db=new FinanceDB(f.file);
 db.save('real',dataset('inicial'));
 db.upsertCategory({name:'Pets',color:'#abcabc',emoji:'🐾'});
 db.upsertRule({pattern:'Petshop',category:'Pets',matchMode:'contains',scope:'both',priority:10});
 const archive=path.join(f.root,'meus-dados.sqlite');
 await db.backupTo(archive);assert.deepEqual(validateBackupFile(archive).ok,true);
 db.save('real',dataset('alterado'));
 db.upsertCategory({previousName:'Pets',name:'Petiscos',color:'#abcabc',emoji:'🍿'});
 const result=await restoreBackup(db,archive,f.file,f.backups);db=result.db;
 assert.equal(db.load('real').transactions[0].id,'t-inicial');
 assert.equal(db.listCategories().categories.find(c=>c.name==='Pets').emoji,'🐾');
 assert.equal(db.listCategories().rules[0].category,'Pets');
 assert(fs.existsSync(result.recovery));
 assert.deepEqual(db.integrity(),['ok']);db.close();fs.rmSync(f.root,{recursive:true,force:true});
});

test('arquivo inválido ou sem tabelas não substitui o banco existente',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);db.save('real',dataset('original'));
 const invalid=path.join(f.root,'invalido.sqlite');fs.writeFileSync(invalid,'NOT SQLITE');
 assert.throws(()=>validateBackupFile(invalid));
 await assert.rejects(()=>restoreBackup(db,invalid,f.file,f.backups));
 assert.equal(db.load('real').transactions[0].id,'t-original');
 const other=path.join(f.root,'outro.sqlite');
 const {DatabaseSync}=require('node:sqlite');const x=new DatabaseSync(other);x.exec('CREATE TABLE other (id INTEGER)');x.close();
 assert.throws(()=>validateBackupFile(other),/não pertence|Formato|não reconhecido/);
 db.close();fs.rmSync(f.root,{recursive:true,force:true});
});

test('cópias automáticas diárias não duplicam e mantêm 7 datas',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);db.save('real',dataset('automatico'));
 for(let i=1;i<=9;i++){
   const d=new Date(Date.UTC(2026,9,i));
   assert.equal((await automaticBackup(db,f.backups,{now:d,keep:7})).created,true);
 }
 assert.equal(listAutoBackups(f.backups).length,7);
 assert.equal((await automaticBackup(db,f.backups,{now:new Date(Date.UTC(2026,9,9)),keep:7})).created,false);
 const last=listAutoBackups(f.backups)[0];assert(last.name.includes('2026-10-09'));
 assert(validateBackupFile(path.join(f.backups,last.name)).ok);
 db.close();fs.rmSync(f.root,{recursive:true,force:true});
});

test('emojis em categorias preservados após atualização e nova abertura',()=>{
 const f=fixture();let db=new FinanceDB(f.file);
 db.upsertCategory({name:'Pets',color:'#ff7799',emoji:'🐶'});
 db.close();db=new FinanceDB(f.file);
 assert.equal(db.listCategories().categories.find(c=>c.name==='Pets').emoji,'🐶');
 db.upsertCategory({previousName:'Pets',name:'Animais',color:'#cc7799',emoji:'🐱'});
 assert.equal(db.listCategories().categories.find(c=>c.name==='Animais').emoji,'🐱');
 assert.throws(()=>db.upsertCategory({name:'Texto',color:'#884bff',emoji:'not emoji'}),/emoji/);
 db.close();fs.rmSync(f.root,{recursive:true,force:true});
});

test('D1.1 — cópia diária preexistente corrompida não é considerada válida nem sobrescrita',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('protegido'));
  fs.mkdirSync(f.backups,{recursive:true});
  const file=path.join(f.backups,'meu-financeiro-2026-11-10.sqlite');
  const corrupted=Buffer.from('NOT A FINANCE SQLITE BACKUP');
  fs.writeFileSync(file,corrupted);
  await assert.rejects(()=>automaticBackup(db,f.backups,{now:new Date('2026-11-10T12:00:00.000Z')}));
  assert.deepEqual(fs.readFileSync(file),corrupted);
  assert.equal(db.load('real').transactions[0].id,'t-protegido');
  assert.deepEqual(db.integrity(),['ok']);
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('D1.1 — backup parcial inválido não é publicado nem elimina a cópia anterior íntegra',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('anterior'));
  const previous=await automaticBackup(db,f.backups,{now:new Date('2026-11-09T12:00:00.000Z')});
  assert.equal(previous.created,true);
  assert.equal(validateBackupFile(previous.file).ok,true);
  const broken={async backupTo(destination){
    fs.writeFileSync(destination,'NOT A VALID SQLITE FILE');
    return {ok:true,path:destination};
  }};
  await assert.rejects(()=>automaticBackup(broken,f.backups,{now:new Date('2026-11-10T12:00:00.000Z')}));
  assert.equal(fs.existsSync(path.join(f.backups,'meu-financeiro-2026-11-10.sqlite')),false);
  assert.equal(validateBackupFile(previous.file).ok,true);
  assert.equal(listAutoBackups(f.backups).length,1);
  assert.equal(fs.readdirSync(f.backups).some(name=>name.includes('.partial-')),false);
  assert.equal(db.load('real').transactions[0].id,'t-anterior');
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('D1.1 — cópia diária alterada depois da validação é rejeitada na próxima verificação',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('integro'));
  const date=new Date('2026-11-10T12:00:00.000Z');
  const saved=await automaticBackup(db,f.backups,{now:date});
  assert.equal(saved.created,true);
  assert.equal((await automaticBackup(db,f.backups,{now:date})).created,false);
  const corrupted=Buffer.alloc(128,0x41);
  fs.writeFileSync(saved.file,corrupted);
  await assert.rejects(()=>automaticBackup(db,f.backups,{now:date}));
  assert.deepEqual(fs.readFileSync(saved.file),corrupted);
  assert.equal(db.load('real').transactions[0].id,'t-integro');
  assert.deepEqual(db.integrity(),['ok']);
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('D1.1 — validação do backup WAL não deixa auxiliares .partial após sucesso',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('wal-limpo'));
  const saved=await automaticBackup(db,f.backups,{now:new Date('2026-11-11T12:00:00.000Z')});
  assert.equal(saved.created,true);
  assert.equal(validateBackupFile(saved.file).ok,true);
  assert.equal(fs.readdirSync(f.backups).filter(name=>name.includes('.partial-')).length,0);
  assert.equal(db.load('real').transactions[0].id,'t-wal-limpo');
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('Preflight v7 — backup/restore accepts CURRENT D05 schema without accepting future v8',async()=>{
 const f=fixture();let db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('schema-v7'));
  assert.equal(db.db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value,'7');
  const backup=path.join(f.root,'snapshot-v7.sqlite');
  await db.backupTo(backup);
  assert.equal(validateBackupFile(backup).ok,true);
  db.save('real',dataset('substituido'));
  const restored=await restoreBackup(db,backup,f.file,f.backups);
  db=restored.db;
  assert.equal(db.load('real').transactions[0].id,'t-schema-v7');
  assert.deepEqual(db.integrity(),['ok']);
  const future=path.join(f.root,'future-v8.sqlite');
  await db.backupTo(future);
  const {DatabaseSync}=require('node:sqlite');
  const futureSql=new DatabaseSync(future);
  futureSql.prepare("UPDATE app_meta SET value='8' WHERE key='schema_version'").run();
  futureSql.close();
  assert.throws(()=>validateBackupFile(future),/versão mais recente/);
  assert.throws(()=>new FinanceDB(future),/futura incompatível/);
  await assert.rejects(()=>restoreBackup(db,future,f.file,f.backups),/versão mais recente/);
  assert.equal(db.load('real').transactions[0].id,'t-schema-v7');
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
test('Preflight v7 — backup with broken foreign keys rejected while valid snapshot survives',async()=>{
 const f=fixture();let db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('validado'));
  const safe=path.join(f.root,'valid.sqlite');
  const invalid=path.join(f.root,'broken-fk.sqlite');
  await db.backupTo(safe);await db.backupTo(invalid);
  const {DatabaseSync}=require('node:sqlite');
  const corrupted=new DatabaseSync(invalid);
  corrupted.exec('PRAGMA foreign_keys=OFF');
  corrupted.prepare("UPDATE transactions SET profile='missing-profile' WHERE id='t-validado'").run();
  corrupted.close();
  assert.equal(validateBackupFile(safe).ok,true);
  assert.throws(()=>validateBackupFile(invalid),/referências financeiras inválidas/);
  await assert.rejects(()=>restoreBackup(db,invalid,f.file,f.backups));
  assert.equal(db.load('real').transactions[0].id,'t-validado');
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('restoreBackup remove auxiliares .importacao-*-wal e -shm após rejeitar cópia WAL corrompida',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('wal-ativo'));
  const walCorrupt=path.join(f.root,'wal-corrupt.sqlite');
  const {DatabaseSync}=require('node:sqlite');
  const seed=new DatabaseSync(walCorrupt);
  seed.exec('PRAGMA journal_mode=WAL; CREATE TABLE profiles(id TEXT PRIMARY KEY); CREATE TABLE transactions(id TEXT PRIMARY KEY, profile TEXT REFERENCES profiles(id)); CREATE TABLE budgets(id TEXT PRIMARY KEY); CREATE TABLE financial_settings(id TEXT PRIMARY KEY); CREATE TABLE app_meta(key TEXT PRIMARY KEY, value TEXT);');
  seed.exec("INSERT INTO app_meta(key,value) VALUES ('schema_version','7');");
  seed.exec('PRAGMA foreign_keys=OFF; INSERT INTO transactions(id,profile) VALUES (\'orphan\',\'missing-profile\');');
  seed.close();
  // Ensure header flags stay in WAL mode (bytes 18-19 = 2,2) so readOnly open creates -shm/-wal
  const raw=fs.readFileSync(walCorrupt);
  raw[18]=2;raw[19]=2;
  fs.writeFileSync(walCorrupt,raw);

  await assert.rejects(()=>restoreBackup(db,walCorrupt,f.file,f.backups),/referências financeiras inválidas/);
  const leftovers=fs.readdirSync(path.dirname(f.file)).filter(n=>n.startsWith('.importacao-'));
  assert.deepEqual(leftovers,[]);
  assert.equal(db.load('real').transactions[0].id,'t-wal-ativo');
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('FinanceDB e restoreBackup liberam handle SQLite e removem auxiliares .importacao-* quando probe falha após schema_version em WAL',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('ativo-wal'));
  const walTriggerBkp=path.join(f.root,'wal-trigger-fail.sqlite');
  await db.backupTo(walTriggerBkp);
  const {DatabaseSync}=require('node:sqlite');
  const seeded=new DatabaseSync(walTriggerBkp);
  seeded.exec("PRAGMA journal_mode=WAL; CREATE TRIGGER abort_probe BEFORE INSERT ON app_meta BEGIN SELECT RAISE(ABORT, 'PROBE_FAIL_WAL'); END;");
  seeded.close();
  const raw=fs.readFileSync(walTriggerBkp);
  raw[18]=2;raw[19]=2;
  fs.writeFileSync(walTriggerBkp,raw);

  const directProbe=path.join(f.root,'direct-probe.sqlite');
  fs.copyFileSync(walTriggerBkp,directProbe);
  assert.throws(()=>new FinanceDB(directProbe),/PROBE_FAIL_WAL/);
  fs.unlinkSync(directProbe);
  fs.rmSync(directProbe+'-wal',{force:true});
  fs.rmSync(directProbe+'-shm',{force:true});

  await assert.rejects(()=>restoreBackup(db,walTriggerBkp,f.file,f.backups),/PROBE_FAIL_WAL/);
  const leftovers=fs.readdirSync(path.dirname(f.file)).filter(n=>n.startsWith('.importacao-'));
  assert.deepEqual(leftovers,[]);
  assert.equal(db.load('real').transactions[0].id,'t-ativo-wal');
  assert.deepEqual(db.integrity(),['ok']);
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});

test('restoreBackup preserva erro primário e continua limpeza de sufixos se fs.rmSync de staging lançar EBUSY',async()=>{
 const f=fixture();const db=new FinanceDB(f.file);
 const origRmSync=fs.rmSync;
 const attempted=[];
 try{
  db.save('real',dataset('primario-preservado'));
  const walCorrupt=path.join(f.root,'wal-broken-fk.sqlite');
  const {DatabaseSync}=require('node:sqlite');
  const seed=new DatabaseSync(walCorrupt);
  seed.exec('PRAGMA journal_mode=WAL; CREATE TABLE profiles(id TEXT PRIMARY KEY); CREATE TABLE transactions(id TEXT PRIMARY KEY, profile TEXT REFERENCES profiles(id)); CREATE TABLE budgets(id TEXT PRIMARY KEY); CREATE TABLE financial_settings(id TEXT PRIMARY KEY); CREATE TABLE app_meta(key TEXT PRIMARY KEY, value TEXT);');
  seed.exec("INSERT INTO app_meta(key,value) VALUES ('schema_version','7');");
  seed.exec("PRAGMA foreign_keys=OFF; INSERT INTO transactions(id,profile) VALUES ('orphan','missing-profile');");
  seed.close();
  const raw=fs.readFileSync(walCorrupt);
  raw[18]=2;raw[19]=2;
  fs.writeFileSync(walCorrupt,raw);

  fs.rmSync=(targetPath,options)=>{
   const str=String(targetPath||'');
   if(str.includes('.importacao-')){
    attempted.push(str);
    if(str.endsWith('.sqlite')){
     throw Object.assign(new Error('EBUSY: simulated lock'),{code:'EBUSY'});
    }
   }
   return origRmSync.call(fs,targetPath,options);
  };

  await assert.rejects(()=>restoreBackup(db,walCorrupt,f.file,f.backups),/referências financeiras inválidas/);
  assert.equal(attempted.some(p=>p.endsWith('-wal')),true);
  assert.equal(attempted.some(p=>p.endsWith('-shm')),true);
  assert.equal(db.load('real').transactions[0].id,'t-primario-preservado');
 }finally{
  fs.rmSync=origRmSync;
  for(const name of fs.readdirSync(path.dirname(f.file)).filter(n=>n.startsWith('.importacao-'))){
   origRmSync.call(fs,path.join(path.dirname(f.file),name),{force:true});
  }
  db.close();
  origRmSync.call(fs,f.root,{recursive:true,force:true});
 }
});

test('restoreBackup restaura cópia WAL pré-v7 (schema_version=6) sem deixar .importacao-*.d05-before-v7.sqlite na pasta ativa',async()=>{
 const f=fixture();let db=new FinanceDB(f.file);
 try{
  db.save('real',dataset('legado-v6'));
  const v6Backup=path.join(f.root,'legacy-v6.sqlite');
  await db.backupTo(v6Backup);
  const {DatabaseSync}=require('node:sqlite');
  const downgraded=new DatabaseSync(v6Backup);
  downgraded.exec("PRAGMA journal_mode=WAL; DELETE FROM app_meta WHERE key='d05_hierarchy_e1'; UPDATE app_meta SET value='6' WHERE key='schema_version';");
  downgraded.close();
  const raw=fs.readFileSync(v6Backup);
  raw[18]=2;raw[19]=2;
  fs.writeFileSync(v6Backup,raw);

  db.save('real',dataset('atual-v7'));
  const restored=await restoreBackup(db,v6Backup,f.file,f.backups);
  db=restored.db;

  const leftovers=fs.readdirSync(path.dirname(f.file)).filter(n=>n.startsWith('.importacao-'));
  assert.deepEqual(leftovers,[]);
  assert.equal(db.load('real').transactions[0].id,'t-legado-v6');
  assert.equal(db.db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value,'7');
  assert.equal(db.db.prepare("SELECT value FROM app_meta WHERE key='d05_hierarchy_e1'").get().value,'1');
  assert.deepEqual(db.integrity(),['ok']);
  assert.equal(validateBackupFile(restored.recovery).ok,true);

  const checkSource=new DatabaseSync(v6Backup,{readOnly:true});
  try{
   assert.equal(checkSource.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value,'6');
  }finally{checkSource.close();}
 }finally{db.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
