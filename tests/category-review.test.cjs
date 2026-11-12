'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FinanceDB}=require('../electron/db.cjs');
const {CategoryReviewService,READ_CONSENT,WRITE_CONSENT,specific}=require('../electron/category-review.cjs');
const ITEM='11111111-1111-4111-8111-111111111111',ACCOUNT='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
const tx=(id,extra={})=>({id,date:'2026-11-10',description:'CAFETERIA FLORESTA',amount:-15,status:'POSTED',category:'Outros',...extra});
test('rule management preview identifies the old and new category even without affected transactions',()=>{
 const f=fixture();try{
  const rule=f.accept();const p=f.prepare('manage-rule',{ruleId:rule.ruleId,change:'edit',category:'Transporte'});
  assert.equal(p.affected.length,0);assert.equal(p.rule.previousCategory,'Alimentação');assert.equal(p.rule.category,'Transporte');assert.equal(p.rule.nature,'expense');assert.equal(p.rule.accountName,'SYNTHETIC 22');
  assert.equal(f.db.listCategories().rules[0].category,'Alimentação');
 }finally{f.close();}
});
function fixture(filename=':memory:',options={}){
 const db=new FinanceDB(filename);let now=1;
 const service=new CategoryReviewService(db,{syntheticProfile:true,clock:()=>now});
 const ingest=(rows,account=ACCOUNT)=>db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:account,name:'SYNTHETIC '+account.slice(0,2),balance:null},transactions:rows}]});
 ingest([tx('a'),tx('b'),tx('c'),tx('old'),tx('pending',{status:'PENDING'})]);
 for(const id of ['a','b','c'])db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:'Alimentação'});
 const authorize=(owner=1)=>service.authorize({consent:READ_CONSENT},owner);
 let grant=authorize();
 const list=()=>service.list({token:grant.token},1);
 const prepare=(action,payload)=>service.prepare({token:grant.token,action,payload},1);
 const confirm=p=>service.confirm({token:grant.token,id:p.id,digest:p.digest,consent:WRITE_CONSENT},1);
 const classify=(ids,category='Alimentação')=>prepare('classify',{items:ids.map(id=>service.publicRow(service.row({accountId:ACCOUNT,externalId:id}))),category});
 const accept=extra=>confirm(prepare('rule',{suggestionId:list().suggestions[0].id,...extra}));
 return {db,service,ingest,list,prepare,confirm,classify,accept,grant,authorize,now:n=>now=n,close:()=>db.close(),...options};
}
const withFixture=(name,fn)=>test(name,async()=>{const f=fixture();try{await fn(f);}finally{f.close();}});

test('personal profile gate precedes SQL, and does not create a schema in FinanceDB',()=>{
 assert.throws(()=>new CategoryReviewService({get db(){throw Error('must not access');}}),/somente/);
 const db=new FinanceDB(':memory:');try{assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'category_review_%'").get().n,0);}finally{db.close();}
});
withFixture('grants expire, belong to sender, do not authorize writes, and are revocable',f=>{
 assert.throws(()=>f.service.list({},1),/Autorização/);
 assert.throws(()=>f.service.list({token:f.grant.token},2),/Autorização/);
 const p=f.prepare('rule',{suggestionId:f.list().suggestions[0].id});
 assert.throws(()=>f.service.confirm({token:f.grant.token,id:p.id,digest:p.digest},1),/explicitamente/);
 assert.throws(()=>f.service.confirm({token:f.grant.token,id:p.id,digest:p.digest,consent:WRITE_CONSENT},2),/Autorização/);
 f.now(p.expiresAt);assert.throws(()=>f.confirm(p),/expirada/);
 f.now(f.grant.expiresAt);assert.throws(()=>f.list(),/expirada/);
});
withFixture('specific exact patterns use human examples and explain confidence without percentages',f=>{
 const r=f.list(),s=r.suggestions[0];assert.equal(r.scanned,5);assert.equal(s.confidence,'high');assert.equal(s.evidenceCount,3);assert.equal(s.examples.length,3);assert.equal(s.matchMode,'exact');assert.equal(s.accountId,ACCOUNT);assert.equal(s.compatible,4);
 for(const text of ['PIX','PAGAMENTO CARTAO','TED 123456','Transferência para 123'])assert.equal(specific(text),false);
 f.ingest([tx('generic',{description:'PIX'})]);f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'generic',category:'Alimentação'});
 assert.equal(f.list().suggestions.length,1);
});
withFixture('ambiguous history is low confidence; one and two examples are low and medium',f=>{
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'b',category:'Transporte'});
 assert.equal(f.list().suggestions[0].confidence,'low');assert.equal(f.list().suggestions[0].conflicts.length,2);
 for(const id of ['b','c'])f.db.overrideBankCategory({accountId:ACCOUNT,externalId:id,category:null});
 assert.equal(f.list().suggestions[0].confidence,'low');
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'b',category:'Alimentação'});assert.equal(f.list().suggestions[0].confidence,'medium');
});
withFixture('future approval preserves history, raw data, import idempotency, account and nature boundaries',f=>{
 const raw=f.db.db.prepare('SELECT * FROM bank_transactions ORDER BY rowid').all();
 const receipt=f.accept();assert.equal(receipt.historicalChanges,0);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Outros');
 const future=tx('future');f.ingest([future]);f.ingest([future]);
 const row=f.db.bankOverview().transactions.find(t=>t.id==='future');assert.equal(row.category,'Alimentação');assert.equal(row.categorySource,'rule');
 assert.equal(f.db.db.prepare("SELECT COUNT(*) AS n FROM bank_transactions WHERE external_id='future'").get().n,1);
 f.ingest([tx('other')],OTHER);f.ingest([tx('income',{amount:15}),tx('new-pending',{status:'PENDING'})]);
 const bank=f.db.bankOverview();for(const id of ['other','income','new-pending'])assert.equal(bank.transactions.find(t=>t.id===id).category,'Outros');
 assert.deepEqual(f.db.db.prepare('SELECT * FROM bank_transactions WHERE rowid<=5 ORDER BY rowid').all(),raw);
 assert.equal(bank.dailyTotals[0].categories.find(c=>c.name==='Alimentação').total,6000);
});
withFixture('edit, deny, defer, suppression and new manual evidence survive the decision flow',f=>{
 let s=f.list().suggestions[0];f.confirm(f.prepare('decision',{suggestionId:s.id,state:'deferred'}));assert.equal(f.list().suggestions[0].state,'deferred');
 f.confirm(f.prepare('decision',{suggestionId:s.id,state:'denied'}));assert.equal(f.list().suggestions.length,0);
 f.ingest([tx('new-evidence')]);f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'new-evidence',category:'Alimentação'});
 assert.equal(f.list().suggestions.length,1);f.accept({category:'Transporte'});
 assert.equal(f.list().decisions[0].state,'edited');f.ingest([tx('future')]);assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='future').category,'Transporte');
});
withFixture('manual precedence, splits, POSTED/PENDING, transfers and source separation',f=>{
 f.accept();f.ingest([tx('future'),tx('split'),tx('transfer'),tx('ignore')]);
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'future',category:'Lazer'});
 f.db.setBankSplits({accountId:ACCOUNT,externalId:'split',parts:[{category:'Transporte',amount:1000},{category:'Lazer',amount:500}]});
 for(const [externalId,nature] of [['transfer','transfer'],['ignore','ignore']])f.db.editBankTransaction({accountId:ACCOUNT,externalId,nature,merchant:'',note:''});
 const bank=f.db.bankOverview();assert.equal(bank.transactions.find(t=>t.id==='future').category,'Lazer');assert.equal(bank.transactions.find(t=>t.id==='split').category,'Outros');
 assert.equal(require('../electron/db.cjs').matchRule('CAFETERIA FLORESTA','manual',f.db.listCategories().rules),null);
 for(const id of ['a','split','transfer','ignore','pending'])assert.throws(()=>f.classify([id]),/Preserve/);
});
withFixture('retroactive classification has its own preview/confirmation and can be undone exactly',f=>{
 f.accept();const p=f.classify(['old']);assert.equal(p.affected.length,1);assert.equal(p.affected[0].category,'Outros');assert.equal(p.affected[0].newCategory,'Alimentação');
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Outros');
 const receipt=f.confirm(p);assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Alimentação');
 assert.equal(f.confirm(p).replayed,true);assert.equal(f.list().audit.filter(c=>c.action==='classify').length,1);
 f.confirm(f.prepare('undo',{commandId:receipt.id}));assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Outros');
 assert.equal(f.list().audit.find(c=>c.id===receipt.id).undoState,'undone');
 assert.throws(()=>f.prepare('undo',{commandId:receipt.id}),/indisponível/);
});
withFixture('stale descriptions, amounts, categories, status and new rule conflicts block commits',f=>{
 const p=f.classify(['old']);f.ingest([tx('old',{amount:-16})]);assert.throws(()=>f.confirm(p),/desatualizad/);assert.equal(f.db.db.prepare("SELECT COUNT(*) AS n FROM category_review_commands").get().n,0);
 const r=f.prepare('rule',{suggestionId:f.list().suggestions[0].id});f.db.upsertRule({pattern:'CAFETERIA',category:'Lazer',scope:'bank',matchMode:'contains',priority:1});assert.throws(()=>f.confirm(r),/Conflito/);
});
withFixture('atomic rollback includes both batch labels and audit on a forced second-row failure',f=>{
 f.ingest([tx('old2')]);const p=f.classify(['old','old2']);
 f.db.db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON bank_category_overrides WHEN NEW.external_id='old2' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
 assert.throws(()=>f.confirm(p),/synthetic failure/);
 assert.equal(f.db.db.prepare("SELECT COUNT(*) AS n FROM bank_category_overrides WHERE external_id IN ('old','old2')").get().n,0);
 assert.equal(f.list().audit.length,0);assert.equal(f.db.integrity()[0],'ok');
 f.db.db.exec('DROP TRIGGER fail_second');f.confirm(p);assert.equal(f.list().audit.length,1);
});
withFixture('undo refuses later manual edits and reimport changes',f=>{
 const receipt=f.confirm(f.classify(['old']));f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'old',category:'Lazer'});
 assert.throws(()=>f.prepare('undo',{commandId:receipt.id}),/Conflito/);
 assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Lazer');
});
withFixture('rule approval undo is safe before new imports; later use requires an impact preview',f=>{
 const receipt=f.accept();f.confirm(f.prepare('undo',{commandId:receipt.id}));assert.equal(f.list().rules.length,0);
 f.confirm(f.prepare('forget',{}));const next=f.accept();f.ingest([tx('future')]);assert.throws(()=>f.prepare('undo',{commandId:next.id}),/importações/);
});
withFixture('pause, resume, category edit and delete have estimated impact and use existing rules',f=>{
 const r=f.accept();f.ingest([tx('future')]);
 const manage=(change,extra={})=>f.confirm(f.prepare('manage-rule',{ruleId:r.ruleId,change,...extra}));
 const p=f.prepare('manage-rule',{ruleId:r.ruleId,change:'pause'});assert.equal(p.affectedTotal,1);f.confirm(p);assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='future').category,'Outros');
 manage('resume');manage('edit',{category:'Lazer'});assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='future').category,'Lazer');
 manage('delete');assert.equal(f.list().rules.length,0);
});
withFixture('incompatible category, duplicate identity, oversize and untrusted operations are rejected',f=>{
 assert.throws(()=>f.classify(['old'],'Salário'),/incompatível/);
 assert.throws(()=>f.classify(['old','old']),/duplicada/);
 assert.throws(()=>f.classify(Array(101).fill('old')),/100 registros/);
 assert.throws(()=>f.prepare('sql',{sql:'DELETE FROM bank_transactions'}),/não suportada/);
 assert.throws(()=>f.prepare('rule',{suggestionId:f.list().suggestions[0].id,priority:0}),/Prioridade/);
 assert.throws(()=>f.service.queue({token:f.grant.token,filters:{start:'garbage'}},1),/Período/);
});
withFixture('PENDING is not itself a review issue and low confidence cannot enter a bulk approval',f=>{
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'pending',category:'Alimentação'});
 f.db.editBankTransaction({accountId:ACCOUNT,externalId:'pending',nature:'auto',merchant:'',note:'',reviewed:true});
 let q=f.service.queue({token:f.grant.token},1);assert(!q.rows.some(r=>r.externalId==='pending'));
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'b',category:'Transporte'});f.ingest([tx('old2')]);
 q=f.service.queue({token:f.grant.token,filters:{confidence:'low'}},1);assert(q.rows.length>0);assert(q.rows.every(r=>!r.batchEligible));
 assert.throws(()=>f.classify(['old','old2']),/Baixa confiança/);f.confirm(f.classify(['old']));
});
withFixture('review scans beyond the 2,500-row renderer cache without missing keyset pages',f=>{
 f.ingest(Array.from({length:2510},(_,i)=>tx('many-'+i,{description:'SYNTHETIC SEM CATEGORIA'})));
 assert.equal(f.db.bankOverview().truncated,true);assert.equal(f.list().scanned,2515);
 let cursor=0,ids=[];do{const q=f.service.queue({token:f.grant.token,after:cursor,limit:100},1);ids.push(...q.rows.map(r=>r.externalId));cursor=q.nextCursor;}while(cursor!==null);
 assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,2515);assert(ids.includes('many-2509'));
});
withFixture('learning never reinforces its own classifications; forgetting keeps rules and audit',f=>{
 const before=f.list().suggestions[0].evidenceCount;f.confirm(f.classify(['old']));assert.equal(f.list().suggestions[0].evidenceCount,before);
 const r=f.accept();f.confirm(f.prepare('forget',{}));assert.equal(f.list().rules[0].id,r.ruleId);assert.equal(f.list().decisions.length,0);assert(f.list().audit.length>=3);
});
withFixture('individual review preserves manual category and metadata and can restore its previous review state',f=>{
 f.db.editBankTransaction({accountId:ACCOUNT,externalId:'a',nature:'auto',merchant:'Café de teste',note:'Observação sintética',reviewed:false});
 const before=f.service.row({accountId:ACCOUNT,externalId:'a'}),p=f.prepare('reviewed',{items:[f.service.publicRow(before)]});
 const receipt=f.confirm(p),after=f.service.row({accountId:ACCOUNT,externalId:'a'});
 assert.equal(after.overrideCategory,'Alimentação');assert(after.reviewedAt);assert.equal(after.note,before.note);assert.equal(after.merchant,before.merchant);
 f.confirm(f.prepare('undo',{commandId:receipt.id}));assert.deepEqual(f.service.row({accountId:ACCOUNT,externalId:'a'}),before);
});
withFixture('rejecting a low-confidence suggestion does not remove the bulk safety guard',f=>{
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'b',category:'Compras'});f.ingest([tx('old2')]);
 const s=f.list().suggestions[0];assert.equal(s.confidence,'low');assert.equal(s.conflicts.length,2);
 f.confirm(f.prepare('decision',{suggestionId:s.id,state:'denied'}));assert.equal(f.list().suggestions.length,0);
 assert.throws(()=>f.classify(['old','old2']),/Baixa confiança/);
});
withFixture('audit insertion failure rolls back categories and review metadata together',f=>{
 const before=f.service.row({accountId:ACCOUNT,externalId:'old'}),p=f.classify(['old']);
 f.db.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON category_review_commands BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 assert.throws(()=>f.confirm(p),/audit unavailable/);assert.deepEqual(f.service.row({accountId:ACCOUNT,externalId:'old'}),before);
 assert.equal(f.db.db.prepare('SELECT COUNT(*) AS n FROM category_review_applied_labels').get().n,0);
});
withFixture('preview after the first hundred rule matches refuses a changed unshown record',f=>{
 const receipt=f.accept();f.ingest(Array.from({length:105},(_,i)=>tx('future-'+i)));
 const p=f.prepare('manage-rule',{ruleId:receipt.ruleId,change:'pause'});assert.equal(p.affectedTotal,105);assert.equal(p.affected.length,100);
 f.ingest([tx('future-104',{amount:-17})]);assert.throws(()=>f.confirm(p),/desatualizada/);assert.equal(f.list().rules[0].enabled,1);
});
withFixture('invalid calendar dates, expired/revoked grants and tampered receipts fail closed',f=>{
 assert.throws(()=>f.service.queue({token:f.grant.token,filters:{start:'2026-02-31'}},1),/Período/);
 const p=f.classify(['old']);f.confirm(p);
 assert.throws(()=>f.confirm({...p,digest:'0'.repeat(64)}),/inválida/);
 f.service.revoke({token:f.grant.token},1);assert.throws(()=>f.confirm(p),/Autorização/);
});
withFixture('reimport invalidates supervised historical labels but preserves a later explicit human override',f=>{
 f.confirm(f.classify(['old']));assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Alimentação');
 f.ingest([tx('old',{description:'ESTABELECIMENTO DIFERENTE',amount:-99})]);
 let row=f.db.bankOverview().transactions.find(t=>t.id==='old');assert.equal(row.category,'Outros');assert.equal(row.supervisedOutdated,true);
 assert(f.service.queue({token:f.grant.token},1).rows.find(t=>t.externalId==='old').reasons.includes('outdated_classification'));
 assert.equal(f.db.bankOverview().dailyTotals[0].categories.find(c=>c.name==='Alimentação').total,4500);
 const resolved=f.confirm(f.classify(['old'],'Transporte'));assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Transporte');
 f.confirm(f.prepare('undo',{commandId:resolved.id}));assert.equal(f.db.bankOverview().transactions.find(t=>t.id==='old').category,'Outros');
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'old',category:'Alimentação'});
 f.ingest([tx('old',{description:'OUTRA DESCRICAO',amount:-100})]);row=f.db.bankOverview().transactions.find(t=>t.id==='old');assert.equal(row.category,'Alimentação');assert.equal(row.supervisedOutdated,false);
});
withFixture('marking reviewed or editing a note does not resurrect a rejected pattern',f=>{
 const s=f.list().suggestions[0];f.confirm(f.prepare('decision',{suggestionId:s.id,state:'denied'}));
 f.confirm(f.prepare('reviewed',{items:[f.service.publicRow(f.service.row({accountId:ACCOUNT,externalId:'a'}))]}));
 f.db.editBankTransaction({accountId:ACCOUNT,externalId:'b',nature:'auto',merchant:'Nome pessoal de teste',note:'Anotação nova',reviewed:true});
 assert.equal(f.list().suggestions.length,0);
});
withFixture('a human reaffirmation of the same category protects it from supervised undo',f=>{
 const receipt=f.confirm(f.classify(['old']));
 f.db.overrideBankCategory({accountId:ACCOUNT,externalId:'old',category:'Alimentação'});
 assert.throws(()=>f.prepare('undo',{commandId:receipt.id}),/Conflito/);
});
test('additive schema, reopen, real SQLite backup and restored rule behavior',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mf-review-persistence-')),filename=path.join(directory,'source.sqlite'),backup=path.join(directory,'backup.sqlite');
 let f=fixture(filename);try{
  const r=f.accept();const auditId=f.confirm(f.classify(['old'])).id;await f.db.backupTo(backup);f.close();f=null;
  const db=new FinanceDB(backup);try{
   const service=new CategoryReviewService(db,{syntheticProfile:true}),grant=service.authorize({consent:READ_CONSENT},1);
   const list=service.list({token:grant.token},1);assert.equal(list.rules[0].id,r.ruleId);assert(list.audit.some(c=>c.id===auditId));assert.equal(list.decisions[0].state,'accepted');
   db.ingestBank(ITEM,{item:{status:'UPDATED'},data:[{account:{id:ACCOUNT,name:'SYNTHETIC',balance:null},transactions:[tx('after-restore')]}]});assert.equal(db.bankOverview().transactions.find(t=>t.id==='after-restore').category,'Alimentação');assert.deepEqual(db.integrity(),['ok']);
  }finally{db.close();}
 }finally{if(f)f.close();fs.rmSync(directory,{recursive:true,force:true});}
});
