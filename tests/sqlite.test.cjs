'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const folder=()=>fs.mkdtempSync(path.join(os.tmpdir(),'mf-sqlite-'));
function dataset(txs=[]){return {version:3,transactions:txs,budgets:{Moradia:100000,Alimentação:50000},settings:{opening:12300,income:262500,fixed:100000,existing:25000,reserve:20000}};}
const tx=(id='t1')=>({id,date:'2026-11-06',description:'Supermercado',kind:'expense',amount:4590,category:'Alimentação',origin:'manual'});
test('inicializa banco SQLite real e salva centavos corretamente',()=>{
 const d=folder(), file=path.join(d,'finance.sqlite');let db=new FinanceDB(file);
 assert.equal(db.load('real'),null);
 db.save('real',dataset([tx()]));
 assert.equal(db.load('real').transactions[0].amount,4590);
 assert.equal(db.load('real').budgets.Moradia,100000);
 assert.equal(db.load('real').settings.income,262500);
 assert.deepEqual(db.integrity(),['ok']);db.close();
 assert.equal(fs.readFileSync(file).toString('ascii',0,15),'SQLite format 3');
 db=new FinanceDB(file);
 assert.equal(db.load('real').transactions.length,1);
 assert.equal(db.load('real').settings.opening,12300);
 db.close();fs.rmSync(d,{recursive:true,force:true});
});
test('demonstração jamais altera dados pessoais',()=>{
 const db=new FinanceDB(':memory:');db.save('real',dataset([tx('real')]));
 db.save('demo',dataset([tx('demo')]));
 const demo=db.load('demo');demo.transactions[0].amount=900000;
 db.save('demo',demo);
 assert.equal(db.load('real').transactions[0].amount,4590);
 assert.equal(db.load('demo').transactions[0].amount,900000);
 db.close();
});
test('operação inválida não apaga dados: transação atômica e validação',()=>{
 const db=new FinanceDB(':memory:');db.save('real',dataset([tx()]));
 assert.throws(()=>db.save('real',dataset([{...tx(),amount:-2}])));
 assert.equal(db.load('real').transactions[0].amount,4590);
 assert.throws(()=>db.save('real',dataset([tx('same'),tx('same')])));
 assert.equal(db.load('real').transactions.length,1);
 assert.throws(()=>db.load('adm'),/Perfil inválido/);
 db.close();
});
test('salva descrições com aspas e comandos SQL como texto simples',()=>{
 const db=new FinanceDB(':memory:');
 db.save('real',dataset([{...tx(),description:"O'Connor; DROP TABLE transactions; --"}]));
 assert.equal(db.load('real').transactions[0].description,"O'Connor; DROP TABLE transactions; --");
 assert.equal(db.integrity()[0],'ok');db.close();
});
test('cópia SQLite é íntegra e reabre após backup online',async()=>{
 const d=folder(),file=path.join(d,'finance.sqlite'),copy=path.join(d,'backup.sqlite');const db=new FinanceDB(file);
 db.save('real',dataset([tx()]));await db.backupTo(copy);
 const restored=new FinanceDB(copy);
 assert.equal(restored.load('real').transactions[0].amount,4590);
 assert.deepEqual(restored.integrity(),['ok']);restored.close();db.close();
 fs.rmSync(d,{recursive:true,force:true});
});
test('backup JSON da v0.3 pode ser importado com version 3',()=>{
 const db=new FinanceDB(':memory:');db.save('real',dataset([tx()]));
 assert.equal(db.load('real').version,5);db.close();
});
