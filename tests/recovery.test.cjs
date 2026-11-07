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
