'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {FinanceDB}=require('../electron/db.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222';
function bank(description='Pix enviado Minha Mãe',amount=-20,category='Transfer - PIX'){return {item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'Teste',balance:100},transactions:[{id:'txA',date:'2026-11-06',description,amount,status:'POSTED',category}]}]};}
test('transferências são categorias sem alterar natureza financeira de Pix a terceiros',()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,bank());
 const row=db.bankOverview().transactions[0];
 assert.equal(row.category,'Transferências');assert.equal(row.nature,'auto');
 const day=db.bankOverview().dailyTotals.find(x=>x.date==='2026-11-06');
 assert.equal(day.expense,2000);assert.equal(day.categories.find(x=>x.name==='Transferências').total,2000);
 assert(db.listCategories().categories.some(x=>x.name==='Transferências'&&x.emoji==='🏦'));
 db.close();
});
test('rendimento é traduzido e outras correções manuais têm precedência',()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,bank('Rendimentos REND PAGO APLIC AUT MAIS',0.01,'Proceeds interests and dividends'));
 assert.equal(db.bankOverview().transactions[0].category,'Rendimentos');
 db.overrideBankCategory({accountId:ACCOUNT,externalId:'txA',category:'Outros'});
 assert.equal(db.bankOverview().transactions[0].category,'Outros');db.close();
});
test('pacote AI: valida fingerprint, aplica sem tocar extrato e não reaplica duplicado',()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,bank('Entrada PAGTO Salários',1234.56,'Shopping'));
 const before=db.db.prepare('SELECT * FROM bank_transactions').all();
 const description='Entrada PAGTO Salários';const amount=123456;
 const pack={format:'meu-financeiro-categorias-v1',rules:[{pattern:'Entrada PAGTO',matchMode:'starts',category:'Salário',priority:35}],decisions:[{accountId:ACCOUNT,externalId:'txA',category:'Salário',confidence:'alta',fingerprint:createHash('sha256').update(description+'|'+amount).digest('hex')}]};
 const a=db.importCategoryPack(pack);assert.equal(a.rulesAdded,1);assert.equal(a.overridesAdded,1);
 const b=db.importCategoryPack(pack);assert.equal(b.rulesAdded,0);assert.equal(b.overridesAdded,0);
 assert.deepEqual(db.db.prepare('SELECT * FROM bank_transactions').all(),before);
 assert.equal(db.bankOverview().transactions[0].category,'Salário');
 assert.deepEqual(db.integrity(),['ok']);db.close();
});
test('pacote adulterado é rejeitado antes de alterar dados',()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,bank());
 const pack={format:'meu-financeiro-categorias-v1',rules:[{pattern:'PIX',matchMode:'contains',category:'Desconhecida',priority:1}],decisions:[]};
 assert.throws(()=>db.importCategoryPack(pack),/Categoria não encontrada/);
 assert.equal(db.listCategories().rules.length,0);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM bank_category_overrides').get().n,0);db.close();
});
