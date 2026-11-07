'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {FinanceDB}=require('../electron/db.cjs');
const {PlanningStore}=require('../electron/planning.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
function setup(balance=1000,tx=[]){
 const db=new FinanceDB(':memory:');
 db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Conta teste',balance},transactions:tx}]});
 return {db,plan:new PlanningStore(db)};
}
const tx=(id,date,amount)=>({id,date,amount,status:'POSTED',description:'Movimentação '+id,category:'Outros'});
const TODAY='2026-11-06';
test('linha do tempo inclui todos os dias e estima histórico com diferença diária',()=>{
 const {db,plan}=setup(1000,[tx('saida','2026-11-02',-100),tx('entrada','2026-11-04',200),tx('hoje','2026-11-06',-30)]);
 const data=plan.monthTimeline({today:TODAY,month:'2026-11'});
 assert.equal(data.rows.length,30);
 assert.equal(data.rows[0].date,'2026-11-01');
 assert.equal(data.rows.at(-1).date,'2026-11-30');
 assert.equal(data.rows[0].closing,93000);
 assert.equal(data.rows[1].closing,83000);
 assert.equal(data.rows[3].closing,103000);
 assert.equal(data.rows[4].closing,103000);
 assert.equal(data.rows[5].closing,100000);
 assert.equal(data.rows[0].phase,'estimated_history');
 assert.equal(data.rows[5].phase,'projection');
 assert.match(data.historicalNotice,/não representam saldo bancário histórico confirmado/i);
 db.close();
});
test('linha do tempo futura possui 31 dias com saldo após vencimentos',()=>{
 const {db,plan}=setup(1000);
 plan.create({title:'Conta futura',kind:'expense',amount:20000,dueDate:'2026-12-10',category:'Contas'});
 const data=plan.monthTimeline({today:TODAY,month:'2026-12'});
 assert.equal(data.rows.length,31);
 assert.equal(data.rows[0].date,'2026-12-01');
 assert.equal(data.rows.at(-1).date,'2026-12-31');
 assert.equal(data.rows.find(r=>r.date==='2026-12-09').closing,100000);
 assert.equal(data.rows.find(r=>r.date==='2026-12-10').closing,80000);
 assert.equal(data.historicalNotice,null);
 db.close();
});
test('um dia sem lançamento tem variação zero; parcelas e estimativas preservam cenário',()=>{
 const {db,plan}=setup(1500);
 plan.create({title:'Compra prevista',kind:'expense',amount:60000,dueDate:'2026-11-08',category:'Compras'});
 plan.create({title:'Bônus incerto',kind:'income',amount:20000,dueDate:'2026-11-09',category:'Salário',certainty:'estimated'});
 const conservative=plan.monthTimeline({today:TODAY,month:'2026-11'});
 assert.equal(conservative.rows.find(r=>r.date==='2026-11-07').closing,150000);
 assert.equal(conservative.rows.find(r=>r.date==='2026-11-08').closing,90000);
 assert.equal(conservative.rows.find(r=>r.date==='2026-11-09').closing,90000);
 assert.equal(conservative.rows.find(r=>r.date==='2026-11-10').closing,90000);
 const optimistic=plan.monthTimeline({today:TODAY,month:'2026-11',includeEstimatedIncome:true});
 assert.equal(optimistic.rows.find(r=>r.date==='2026-11-09').closing,110000);
 db.close();
});
test('não altera o planejamento, rejeita meses anteriores e datas inválidas',()=>{
 const {db,plan}=setup();
 const before=plan.list({today:TODAY}).length;
 assert.throws(()=>plan.monthTimeline({today:TODAY,month:'2026-10'}),/inválido/);
 assert.throws(()=>plan.monthTimeline({today:TODAY,month:'2026-13'}),/inválido/);
 assert.equal(plan.overview({today:TODAY,month:'2026-11'}).timeline.rows.length,30);
 assert.equal(plan.list({today:TODAY}).length,before);
 db.close();
});
