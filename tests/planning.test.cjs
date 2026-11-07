'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore,nextOccurrence,addDay}=require('../electron/planning.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
function seed(finance,tx=[]){finance.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Itaú',balance:2500,type:'BANK',currencyCode:'BRL'},transactions:tx}]});}
function tx(id,amount,date='2026-11-10',description='Aluguel'){return{id,amount,date,description,status:'POSTED',category:'Moradia'};}
const TODAY='2026-11-06';
function testdb(transactions=[]){const f=new FinanceDB(':memory:');seed(f,transactions);const p=new PlanningStore(f);return {f,p};}
function add(p,params={}){return p.create({title:'Aluguel',kind:'expense',amount:100000,dueDate:'2026-11-10',category:'Moradia',certainty:'confirmed',...params}).ids[0];}
test('recorrência preserva dia de origem e edição pontual não modifica demais parcelas',()=>{
 const {f,p}=testdb();const batch=p.create({title:'Conta',kind:'expense',amount:3000,dueDate:'2027-01-31',category:'Contas',mode:'monthly',count:3});
 const records=p.list({today:TODAY});assert.deepEqual(records.map(x=>x.dueDate),['2027-01-31','2027-02-28','2027-03-31']);
 p.edit({id:batch.ids[1],title:'Conta alterada',dueDate:'2027-03-02'});
 assert.equal(p.list({today:TODAY}).find(x=>x.id===batch.ids[0]).title,'Conta');
 assert.equal(p.list({today:TODAY}).find(x=>x.id===batch.ids[1]).title,'Conta alterada');
 assert.equal(nextOccurrence('2028-02-29',1,'yearly'),'2029-02-28');f.close();
});
test('parcelamento distribui centavos sem erros e não cria 0 reais',()=>{
 const {f,p}=testdb();const ids=p.create({title:'Celular',kind:'expense',amount:10000,dueDate:'2026-11-18',category:'Compras',mode:'installments',count:3}).ids;
 const v=p.list({today:TODAY}).filter(x=>ids.includes(x.id));assert.equal(v.reduce((s,x)=>s+x.amount,0),10000);
 assert.deepEqual(v.map(x=>x.amount),[3334,3333,3333]);
 assert.throws(()=>p.create({title:'B',kind:'expense',amount:2,dueDate:TODAY,category:'Outros',mode:'installments',count:4}),/valor total/);f.close();
});
test('projeção diária conta previsto uma vez e não desconta pagamento já refletido no saldo',()=>{
 const {f,p}=testdb([tx('pago',-1000,'2026-11-05','Energia')]);
 const aluguel=add(p),energia=add(p,{title:'Energia',amount:100000,dueDate:'2026-11-12'});
 let forecast=p.projection({today:TODAY,start:TODAY,end:'2026-11-15'});
 assert.equal(forecast.anchor,250000);assert.equal(forecast.rows.find(x=>x.date==='2026-11-10').closing,150000);
 // A quitação de energia é o valor completo planejado neste cenário.
 p.edit({id:energia,amount:100000});
 p.link({itemId:energia,accountId:ACCOUNT,externalId:'pago'});
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-15'}).rows.at(-1).closing,150000);
 assert.equal(p.list({today:TODAY}).find(x=>x.id===energia).effectiveStatus,'paid');
 f.close();
});
test('pagamento parcial e total são únicos; editar, desfazer e proibir uso em duas contas',()=>{
 const {f,p}=testdb([tx('parte1',-400,'2026-11-09'),tx('parte2',-600,'2026-11-12')]);const id=add(p);
 let result=p.link({itemId:id,accountId:ACCOUNT,externalId:'parte1'});assert.equal(result.remaining,60000);
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).effectiveStatus,'pending');
 const other=add(p,{title:'Outro'});assert.throws(()=>p.link({itemId:other,accountId:ACCOUNT,externalId:'parte1'}),/vinculada/);p.setStatus(other,'cancelled');
 result=p.link({itemId:id,accountId:ACCOUNT,externalId:'parte2'});assert.equal(result.remaining,0);
 const today=p.projection({today:TODAY,start:TODAY,end:'2026-11-15'});assert.equal(today.rows.at(-1).closing,250000);
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).effectiveStatus,'paid');
 p.unlink({itemId:id,accountId:ACCOUNT,externalId:'parte2'});
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,60000);
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-15'}).rows.at(-1).closing,190000);
 f.close();
});
test('valor diferente exige edição explícita sem alterar o original, vínculo incorreto pode ser desfeito',()=>{
 const {f,p}=testdb([tx('pagamento',-950,'2026-11-10')]);const id=add(p);
 assert.equal(p.link({itemId:id,accountId:ACCOUNT,externalId:'pagamento'}).remaining,5000);
 p.edit({id,amount:95000});assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,0);
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-11'}).rows.at(-1).closing,250000);
 p.unlink({itemId:id,accountId:ACCOUNT,externalId:'pagamento'});
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,95000);
 f.close();
});
test('receita incerta excluída por padrão e alternativa pode ser exibida',()=>{
 const {f,p}=testdb();add(p,{title:'Bônus',kind:'income',amount:150000,dueDate:'2026-11-15',certainty:'estimated'});
 const base=p.projection({today:TODAY,start:TODAY,end:'2026-11-15'});assert.equal(base.rows.at(-1).closing,250000);
 const alternative=p.projection({today:TODAY,start:TODAY,end:'2026-11-15',includeEstimatedIncome:true});assert.equal(alternative.rows.at(-1).closing,400000);f.close();
});
test('pagamento manual só depois da data, reversível, não duplica em projeções',()=>{
 const {f,p}=testdb();const id=add(p,{dueDate:'2026-11-05'});
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-07'}).rows[0].closing,150000);
 p.setStatus(id,'settled_manual');assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-07'}).rows[0].closing,250000);
 p.setStatus(id,'planned');assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-07'}).rows[0].closing,150000);
 f.close();
});
test('sugestões usam semelhança, rejeição e exclusividade; não vinculam automaticamente',()=>{
 const {f,p}=testdb([tx('banco1',-1000,'2026-11-06','Pagamento aluguel')]);const id=add(p);const found=p.suggest(TODAY);
 assert.equal(found.find(x=>x.itemId===id).externalId,'banco1');
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).links.length,0);
 p.reject({itemId:id,accountId:ACCOUNT,externalId:'banco1'});
 assert.equal(p.suggest(TODAY).some(x=>x.itemId===id),false);
 f.close();
});
test('nome personalizado nunca modifica descrição importada',()=>{
 const {f,p}=testdb([tx('bb',-30,'2026-11-05','PIX ORIGINAL')]);
 p.renameBank({accountId:ACCOUNT,externalId:'bb',title:'Conta importante'});
 assert.equal(p.bankTitles()[0].title,'Conta importante');
 assert.equal(f.bankOverview().transactions[0].description,'PIX ORIGINAL');f.close();
});
test('cancelamento remove previsão sem apagar histórico, dados persistem no mesmo SQLite',()=>{
 const {f,p}=testdb();const id=add(p);p.setStatus(id,'cancelled');
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-15'}).rows.at(-1).closing,250000);
 assert.ok(p.history(id).some(x=>x.action==='cancelled'));f.close();
});
test('backup e reabertura preservam planejamento, nomes personalizados e extrato original',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf08-'));const file=path.join(root,'dados.sqlite'),copy=path.join(root,'copy.sqlite');
 const finance=new FinanceDB(file);seed(finance,[tx('persist',-28,'2026-11-06','Banco original')]);const p=new PlanningStore(finance);
 const id=add(p,{title:'Conta teste',dueDate:'2026-11-15',amount:2800});p.renameBank({accountId:ACCOUNT,externalId:'persist',title:'Loja personalizada'});
 await finance.backupTo(copy);finance.close();const reopened=new FinanceDB(copy),again=new PlanningStore(reopened);
 assert.equal(again.list({today:TODAY}).find(x=>x.id===id).title,'Conta teste');
 assert.equal(again.bankTitles()[0].title,'Loja personalizada');assert.equal(reopened.bankOverview().transactions[0].description,'Banco original');
 reopened.close();fs.rmSync(root,{recursive:true,force:true});
});
test('sincronização que altera pagamento conciliado reabre pendência sem duplicação',()=>{
 const {f,p}=testdb([tx('alteravel',-1000,'2026-11-06')]);const id=add(p);
 p.link({itemId:id,accountId:ACCOUNT,externalId:'alteravel'});assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,0);
 seed(f,[{...tx('alteravel',-1000,'2026-11-06'),status:'PENDING'}]);
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,100000);
 assert.equal(p.projection({today:TODAY,start:TODAY,end:'2026-11-15'}).rows.at(-1).closing,150000);
 seed(f,[tx('alteravel',-1000,'2026-11-06')]);assert.equal(p.list({today:TODAY}).find(x=>x.id===id).remaining,0);f.close();
});
test('categoria personalizada renomeada preserva classificação do compromisso',()=>{
 const {f,p}=testdb();f.upsertCategory({name:'Delivery',color:'#884bff',emoji:'🍔'});
 const id=add(p,{category:'Delivery',title:'Pedido do fim de semana'});
 f.upsertCategory({previousName:'Delivery',name:'Refeições prontas',color:'#bc80ff',emoji:'🍕'});
 assert.equal(p.list({today:TODAY}).find(x=>x.id===id).category,'Refeições prontas');
 assert.throws(()=>f.deleteCategory('Refeições prontas'),/em uso/);f.close();
});
test('um pagamento não pode vincular compromisso e registro manual ao mesmo tempo',()=>{
 const {f,p}=testdb([tx('shared',-1000,'2026-11-06')]);const id=add(p,{dueDate:'2026-11-06'});
 f.save('real',{transactions:[{id:'manual-x',date:TODAY,description:'Aluguel',kind:'expense',amount:100000,category:'Moradia'}],budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}});
 p.link({itemId:id,accountId:ACCOUNT,externalId:'shared'});
 assert.throws(()=>f.linkManualTransaction({accountId:ACCOUNT,externalId:'shared',manualId:'manual-x'}),/compromisso planejado/);
 f.close();
});
test('projeção de mês futuro transporta despesas anteriores e vencidas',()=>{
 const {f,p}=testdb();add(p,{title:'Vencida',dueDate:'2026-11-04',amount:40000});add(p,{title:'Ainda neste mês',dueDate:'2026-11-15',amount:30000});
 const result=p.projection({today:TODAY,start:'2026-12-01',end:'2026-12-05'});
 assert.equal(result.rows[0].opening,180000);f.close();
});
