'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {FinanceDB,ALLOWED_EMOJIS}=require('../electron/db.cjs');
const folder=()=>fs.mkdtempSync(path.join(os.tmpdir(),'mf-reliability-'));
function data(desc='Compra antiga'){return{transactions:[{id:'m1',date:'2026-11-06',description:desc,kind:'expense',amount:2200,category:'Alimentação',origin:'manual'}],budgets:{'Alimentação':50000},settings:{opening:0,income:262500,fixed:100000,existing:0,reserve:20000}};}
const ITEM='11111111-1111-4111-8111-111111111111',ACC='22222222-2222-4222-8222-222222222222',TX='33333333-3333-4333-8333-333333333333';
function bank(){return{item:{status:'UPDATED'},data:[{account:{id:ACC,name:'Itaú',currencyCode:'BRL',balance:100,type:'BANK'},transactions:[{id:TX,date:'2026-11-06',description:'IFOOD',amount:-10,status:'POSTED',category:'Outros'}]}]};}
test('categorias padrão possuem emojis e personalizadas persistem em reinicialização',()=>{
 const dir=folder(),file=path.join(dir,'d.sqlite');
 let db=new FinanceDB(file);
 assert.equal(db.listCategories().categories.find(x=>x.name==='Moradia').emoji,'🏠');
 db.upsertCategory({name:'Pets',color:'#ff66aa',emoji:'🐾'});
 db.upsertCategory({previousName:'Moradia',name:'Moradia',color:'#12aabb',emoji:'🏡'});
 db.close();db=new FinanceDB(file);
 assert.equal(db.listCategories().categories.find(x=>x.name==='Pets').emoji,'🐾');
 assert.equal(db.listCategories().categories.find(x=>x.name==='Moradia').emoji,'🏡');
 assert.throws(()=>db.upsertCategory({name:'Insegura',color:'#ff66aa',emoji:'<script>'}),/emoji/);
 assert(ALLOWED_EMOJIS.includes('🏠'));
 db.close();fs.rmSync(dir,{recursive:true,force:true});
});
test('migração de banco anterior adiciona emoji sem perder as regras ou as transações',()=>{
 const dir=folder(),file=path.join(dir,'legacy.sqlite');
 let db=new FinanceDB(file);db.save('real',data());db.upsertCategory({name:'Pets',color:'#bb88ff'});db.upsertRule({pattern:'IFOOD',matchMode:'contains',scope:'bank',category:'Pets',priority:5});db.close();
 const legacy=new DatabaseSync(file);legacy.exec('ALTER TABLE categories RENAME TO categories_old');
 legacy.exec(`CREATE TABLE categories (name TEXT PRIMARY KEY COLLATE NOCASE,color TEXT NOT NULL,built_in INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO categories(name,color,built_in,created_at) SELECT name,color,built_in,created_at FROM categories_old;`);
 // Teste isolado: abandona estrutura reconstruída e reinstala a versão de tabela antiga sem exigir relações de FK.
 legacy.exec('PRAGMA foreign_keys=OFF; DROP TABLE categories_old;');
 // Prove the exact historical failure: a D05 trigger can still reference
 // the now-missing parent even though the real categories table exists.
 const damaged=legacy.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND sql LIKE '%categories_old%'").all();
 assert(damaged.some(x=>x.name==='d05_transactions_insert_relationship'));
 const invalidFK=legacy.prepare('PRAGMA foreign_key_list(subcategories)').all();
 assert(invalidFK.some(x=>x.table==='categories_old'));
 legacy.close();
 db=new FinanceDB(file);
 assert.equal(db.load('real').transactions.length,1);
 assert.equal(db.listCategories().categories.find(x=>x.name==='Pets').emoji,'✨');
 assert.equal(db.listCategories().categories.find(x=>x.name==='Moradia').emoji,'🏠');
 assert.equal(db.listCategories().rules.find(r=>r.pattern==='IFOOD')?.category,'Pets');
 assert.equal(db.load('real').transactions[0].amount,2200);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM subcategories').get().n,61);
 const childFk=db.db.prepare('PRAGMA foreign_key_list(subcategories)').all();
 assert(childFk.some(x=>x.table==='categories'));
 assert(!childFk.some(x=>x.table==='categories_old'));
 const rewritten=db.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'd05_%_relationship'").all();
 assert(rewritten.length>0);
 assert(rewritten.every(x=>!x.sql.includes('categories_old')));
 assert.equal(db.db.prepare('PRAGMA foreign_key_check').all().length,0);
 assert.deepEqual(db.integrity(),['ok']);
 db.close();fs.rmSync(dir,{recursive:true,force:true});
});
