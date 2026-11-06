'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');const os=require('node:os');const fs=require('node:fs');
const {FinanceDB}=require('../electron/db.cjs');
const {PluggyClient}=require('../electron/pluggy.cjs');
const {PluggyVault}=require('../electron/pluggy-vault.cjs');
const ITEM='11111111-1111-4111-8111-111111111111';
const ACC='22222222-2222-4222-8222-222222222222';
const TX1='33333333-3333-4333-8333-333333333333';
const TX2='44444444-4444-4444-8444-444444444444';
function dataset(txs=[]){return{transactions:txs,budgets:{},settings:{opening:0,income:0,fixed:0,existing:0,reserve:0}};}
function payload(transactions){return {item:{status:'UPDATED',consentExpiresAt:'2027-12-01T00:00:00Z'},data:[{account:{id:ACC,name:'Conta Itaú',currencyCode:'BRL',balance:555.55,type:'BANK'},transactions}]};}
const t1={id:TX1,amount:-15.45,date:'2026-11-06T00:00:00Z',description:'Café',status:'POSTED',category:null};
const t2={id:TX2,amount:100,date:'2026-11-06T00:00:00Z',description:'Pix recebido',status:'PENDING',category:'Outros'};
test('importação bancária deduplica; não altera lançamentos manuais nem perfil demo',()=>{
 const db=new FinanceDB(':memory:');
 db.save('real',dataset([{id:'manual-1',amount:1000,date:'2026-11-06',description:'Manual',kind:'expense',category:'Outros'}]));
 db.save('demo',dataset([]));
 assert.deepEqual(db.ingestBank(ITEM,payload([t1,t2])),{newCount:2,totalCount:2});
 assert.deepEqual(db.ingestBank(ITEM,payload([t1,t2])),{newCount:0,totalCount:2});
 const bank=db.bankOverview();
 assert.equal(bank.accounts[0].balance,55555);
 assert.equal(bank.transactions.length,2);
 assert.equal(bank.transactions.find(x=>x.id===TX1).amount,-1545);
 assert.equal(bank.transactions.find(x=>x.id===TX2).status,'PENDING');
 assert.equal(db.load('real').transactions.length,1);
 assert.equal(db.load('demo').transactions.length,0);
 assert.deepEqual(db.integrity(),['ok']);db.close();
});
test('transação bancária atualizada conserva id e muda status/valor',()=>{
 const db=new FinanceDB(':memory:');
 db.ingestBank(ITEM,payload([t1]));
 assert.deepEqual(db.ingestBank(ITEM,payload([{...t1,amount:-16.50,status:'POSTED'}])),{newCount:0,totalCount:1});
 assert.equal(db.bankOverview().transactions[0].amount,-1650);
 db.close();
});
test('lote inválido não altera SQLite bancário nem o manual',()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,payload([t1]));
 assert.throws(()=>db.ingestBank(ITEM,payload([{...t1,amount:'foo'}])));
 assert.equal(db.bankOverview().transactions[0].amount,-1545);
 assert.equal(db.bankOverview().last.totalCount,1);db.close();
});
test('cliente Pluggy usa auth, accounts e cursor e nunca redireciona para URLs externas',async()=>{
 const calls=[];
 const mocks=[
  {apiKey:'api-test'},
  {id:ITEM,status:'UPDATED',consentExpiresAt:'2027-12-01T00:00:00.000Z'},
  {results:[{id:ACC,name:'Itaú',type:'BANK',currencyCode:'BRL',balance:10}]},
  {results:[t1],next:`?accountId=${ACC}&after=abc123`},
  {results:[t2],next:null}
 ];
 const client=new PluggyClient({fetchFn:async(url,options)=>{calls.push({url,method:options.method,auth:options.headers['X-API-KEY']});return{ok:true,json:async()=>mocks.shift()};}});
 await client.authenticate('client-id','client-secret');
 const result=await client.syncItem(ITEM);
 assert.equal(result.data[0].transactions.length,2);
 assert.equal(calls.length,5);
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].auth,undefined);
 assert.equal(calls[3].auth,'api-test');
 assert(calls.every(x=>x.url.startsWith('https://api.pluggy.ai/')));
});
test('API não prossegue com consentimento expirado e preserva banco',async()=>{
 const db=new FinanceDB(':memory:');db.ingestBank(ITEM,payload([t1]));
 let calls=0;
 const client=new PluggyClient({fetchFn:async()=>({ok:true,json:async()=>{calls++;return {status:'UPDATED',consentExpiresAt:'2020-01-01T00:00:00Z'};}})});
 client.apiKey='fake';
 await assert.rejects(()=>client.syncItem(ITEM),/expirada/);
 assert.equal(calls,1);
 assert.equal(db.bankOverview().transactions.length,1);db.close();
});
test('cofre guarda somente criptografia simulada e não expõe segredo no status',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pluggy-test-'));
 const crypto={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async(x)=>Buffer.from(x,'utf8').reverse(),decryptStringAsync:async(x)=>({result:Buffer.from(x).reverse().toString('utf8'),shouldReEncrypt:false})};
 const vault=new PluggyVault(folder,crypto);
 await vault.put({clientId:'abc',clientSecret:'segredo-NUNCA-ENVIAR',itemIds:[ITEM]});
 const contents=fs.readFileSync(path.join(folder,'pluggy-credentials.enc'),'utf8');
 assert(!contents.includes('segredo-NUNCA-ENVIAR'));
 assert.equal((await vault.status()).configured,true);
 assert(!JSON.stringify(await vault.status()).includes('segredo'));
 assert.equal((await vault.get()).clientSecret,'segredo-NUNCA-ENVIAR');
 await vault.clear();assert.equal((await vault.status()).configured,false);
 fs.rmSync(folder,{recursive:true,force:true});
});
