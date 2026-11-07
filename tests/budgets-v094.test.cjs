'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACC='22222222-2222-4222-8222-222222222222';
const ZERO_SETTINGS={opening:0,income:0,fixed:0,existing:0,reserve:0};
function payload(transactions=[]){return {version:5,transactions,budgets:{},settings:ZERO_SETTINGS};}
function bank(){return {item:{status:'UPDATED'},data:[{account:{id:ACC,name:'Banco de teste',balance:1200},transactions:[
{id:'salary',date:'2026-11-06',description:'Salário',amount:2600,status:'POSTED',category:'Salary'},
{id:'rendimento',date:'2026-11-06',description:'Rendimentos',amount:0.25,status:'POSTED',category:'Proceeds interests and dividends'},
{id:'pix',date:'2026-11-06',description:'Pix enviado a familiar',amount:-120,status:'POSTED',category:'Transfer - PIX'},
{id:'groceries',date:'2026-11-06',description:'Compra supermercado',amount:-32,status:'POSTED',category:'Groceries'},
{id:'mismatch',date:'2026-11-06',description:'Despesa classificada incorretamente como salário',amount:-5,status:'POSTED',category:'Salary'}]}]};}
test('categorias padrão distinguem receitas, gastos e entradas/saídas sem mudar natureza de Pix',()=>{
 const db=new FinanceDB(':memory:');const kinds=Object.fromEntries(db.listCategories().categories.map(c=>[c.name,c.kind]));
 assert.equal(kinds['Salário'],'income');assert.equal(kinds['Rendimentos'],'income');assert.equal(kinds['Reembolsos'],'income');
 assert.equal(kinds['Alimentação'],'expense');assert.equal(kinds['Transferências'],'both');assert.equal(kinds['Outros'],'both');
 db.ingestBank(ITEM,bank());const day=db.bankOverview().dailyTotals.find(x=>x.date==='2026-11-06');
 assert.equal(day.income,260025);assert.equal(day.expense,15700);
 assert.equal(day.incomeCategories.find(x=>x.name==='Salário').total,260000);
 assert.equal(day.incomeCategories.find(x=>x.name==='Rendimentos').total,25);
 assert.equal(day.categories.find(x=>x.name==='Transferências').total,12000);
 assert.equal(day.categories.find(x=>x.name==='Outros').total,500);
 assert.equal(day.categories.find(x=>x.name==='Alimentação').total,3200);
 db.editBankTransaction({accountId:ACC,externalId:'pix',nature:'transfer'});
 const after=db.bankOverview().dailyTotals.find(x=>x.date==='2026-11-06');
 assert.equal(after.expense,3700);assert(!after.categories.some(x=>x.name==='Transferências'));
 db.close();
});
test('tipo personalizado persiste e tipo padrão é imutável sem perder registros',()=>{
 const db=new FinanceDB(':memory:');db.upsertCategory({name:'Trabalho extra',emoji:'💰',color:'#aabbcc',kind:'income'});
 assert.equal(db.listCategories().categories.find(c=>c.name==='Trabalho extra').kind,'income');
 db.upsertCategory({previousName:'Trabalho extra',name:'Bicos',emoji:'💰',color:'#aabbcc',kind:'income'});
 assert.equal(db.listCategories().categories.find(c=>c.name==='Bicos').kind,'income');
 assert.throws(()=>db.upsertCategory({previousName:'Salário',name:'Salário',emoji:'💰',color:'#aabbcc',kind:'expense'}),/tipo|padrão/);
 assert.deepEqual(db.integrity(),['ok']);db.close();
});
test('limite zero explícito e sem limite são diferentes após salvar e reabrir',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v094-'));const file=path.join(dir,'data.sqlite');
 let db=new FinanceDB(file);db.save('real',{...payload(),budgets:{Alimentação:0,Moradia:20000}});
 assert.equal(db.load('real').budgets.Alimentação,0);assert.equal(db.load('real').budgets.Moradia,20000);
 assert.equal(Object.hasOwn(db.load('real').budgets,'Compras'),false);
 db.close();db=new FinanceDB(file);
 assert.equal(db.load('real').budgets.Alimentação,0);
 const n=db.load('real');delete n.budgets.Alimentação;db.save('real',n);
 assert.equal(Object.hasOwn(db.load('real').budgets,'Alimentação'),false);
 db.close();fs.rmSync(dir,{recursive:true,force:true});
});
test('migração interpreta zeros legados como não cadastrados e preserva limites existentes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v094-'));const file=path.join(dir,'data.sqlite');
 const db=new DatabaseSync(file);db.exec(`CREATE TABLE profiles(profile TEXT PRIMARY KEY, initialized_at TEXT);CREATE TABLE transactions(profile TEXT,id TEXT,date TEXT,description TEXT,kind TEXT,amount_cents INTEGER,category TEXT,origin TEXT,PRIMARY KEY(profile,id));CREATE TABLE budgets(profile TEXT,category TEXT,amount_cents INTEGER,PRIMARY KEY(profile,category));CREATE TABLE financial_settings(profile TEXT,name TEXT,value_cents INTEGER,PRIMARY KEY(profile,name));CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT);INSERT INTO profiles VALUES('real','2026-11-07');INSERT INTO budgets VALUES('real','Compras',0),('real','Moradia',80000);`);db.close();
 const newer=new FinanceDB(file);let budgets=newer.load('real').budgets;
 assert.equal(Object.hasOwn(budgets,'Compras'),false);assert.equal(budgets.Moradia,80000);
 newer.save('real',{...payload(),budgets:{Compras:0,Moradia:80000}});newer.close();
 const again=new FinanceDB(file);budgets=again.load('real').budgets;
 assert.equal(budgets.Compras,0);assert.equal(budgets.Moradia,80000);
 assert.deepEqual(again.integrity(),['ok']);again.close();fs.rmSync(dir,{recursive:true,force:true});
});
