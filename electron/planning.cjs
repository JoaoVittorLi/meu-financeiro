'use strict';
// Central de Planejamento: camada aditiva no SQLite existente.
// Valores sempre em centavos; extratos originais nunca são alterados.
const {randomUUID}=require('node:crypto');
const {migrateHierarchy}=require('./d05-hierarchy.cjs');
const MAX=100_000_000_000;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const KINDS=['income','expense'];
const CERTAINTIES=['confirmed','estimated'];
const STATUSES=['planned','cancelled','settled_manual','settled'];
function dateOK(d){if(typeof d!=='string'||!DATE.test(d))return false;const [y,m,day]=d.split('-').map(Number);return y>=2000&&y<=2100&&new Date(Date.UTC(y,m-1,day)).toISOString().slice(0,10)===d;}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDay(iso,n){const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);}
function nextOccurrence(start,number,mode){
 const [y,m,d]=start.split('-').map(Number);
 if(mode==='weekly')return addDay(start,number*7);
 const step=mode==='yearly'?number*12:number;
 const first=new Date(Date.UTC(y,m-1+step,1));
 const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
}
function money(v){if(!Number.isSafeInteger(v)||v<=0||v>MAX)throw new Error('Informe um valor válido em centavos.');return v;}
function text(v,max,label){if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new Error(label+' inválido.');return v.trim();}
function optional(v,max){return v==null?'':text(String(v),max,'Texto');}
function requiredDate(d){if(!dateOK(d))throw new Error('Data inválida.');return d;}
function normalized(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function bankStatus(v){return v==='POSTED';}
function decideStatus(item,today){if(item.status==='cancelled')return 'cancelled';if(item.status==='settled'||item.status==='settled_manual')return 'paid';if(item.remaining<=0)return 'paid';return item.dueDate<today?'overdue':'pending';}
class PlanningStore {
 constructor(finance){this.fin=finance;this.db=finance.db;this.db.exec(`
 CREATE TABLE IF NOT EXISTS planned_items(
  id TEXT PRIMARY KEY, group_id TEXT, group_type TEXT NOT NULL DEFAULT 'single', occurrence INTEGER NOT NULL DEFAULT 1,
  total_occurrences INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0), due_date TEXT NOT NULL,
  category TEXT NOT NULL, account_id TEXT, notes TEXT NOT NULL DEFAULT '',
  certainty TEXT NOT NULL DEFAULT 'confirmed' CHECK(certainty IN ('confirmed','estimated')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','cancelled','settled_manual','settled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, settled_at TEXT
 );
 CREATE INDEX IF NOT EXISTS idx_planned_date ON planned_items(due_date,status);
 CREATE TABLE IF NOT EXISTS planned_bank_links(
  item_id TEXT NOT NULL REFERENCES planned_items(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, external_id TEXT NOT NULL,
  linked_at TEXT NOT NULL, PRIMARY KEY(account_id,external_id),
  FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
 );
 CREATE INDEX IF NOT EXISTS idx_planned_links_item ON planned_bank_links(item_id);
 CREATE TABLE IF NOT EXISTS planned_rejected_matches(
  item_id TEXT NOT NULL REFERENCES planned_items(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, external_id TEXT NOT NULL,
  PRIMARY KEY(item_id,account_id,external_id)
 );
 CREATE TABLE IF NOT EXISTS planned_audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL, action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS bank_custom_titles(
  account_id TEXT NOT NULL, external_id TEXT NOT NULL, title TEXT NOT NULL,
  PRIMARY KEY(account_id,external_id),
  FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
 );
 `);
 // PlanningStore creates planned_items after FinanceDB startup; include D05 refs safely.
 migrateHierarchy(this.db);
 }
 log(itemId,action,details=''){this.db.prepare('INSERT INTO planned_audit(item_id,action,details,at) VALUES(?,?,?,?)').run(itemId,action,String(details).slice(0,300),new Date().toISOString());}
 validateInput(input){
  const title=text(input?.title,140,'Nome');const kind=input?.kind;if(!KINDS.includes(kind))throw new Error('Tipo de transação inválido.');
  const amount=money(input?.amount);const dueDate=requiredDate(input?.dueDate);
  const category=text(input?.category||'Outros',70,'Categoria');
  const notes=input?.notes?text(input.notes,600,'Observação'):'';
  const certainty=input?.certainty||'confirmed';if(!CERTAINTIES.includes(certainty))throw new Error('Confiança inválida.');
  const accountId=input?.accountId?text(input.accountId,150,'Conta'):null;
  if(accountId&&!this.db.prepare('SELECT 1 FROM bank_accounts WHERE account_id=?').get(accountId))throw new Error('Conta bancária não encontrada.');
  if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(category))throw new Error('Categoria não encontrada.');
  return {title,kind,amount,dueDate,category,notes,certainty,accountId};
 }
 create(input){
  const base=this.validateInput(input);
  const mode=input?.mode||'once';if(!['once','monthly','weekly','yearly','installments'].includes(mode))throw new Error('Repetição inválida.');
  const count=mode==='once'?1:Number(input?.count||12);
  if(!Number.isInteger(count)||count<1||count>36)throw new Error('Escolha de 1 a 36 ocorrências.');
  const now=new Date().toISOString(),group=count>1?randomUUID():null;const ids=[];
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const stmt=this.db.prepare(`INSERT INTO planned_items(id,group_id,group_type,occurrence,total_occurrences,title,kind,amount_cents,due_date,category,account_id,notes,certainty,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'planned',?,?)`);
   for(let i=0;i<count;i++){
    const id=randomUUID();ids.push(id);
    const amount=mode==='installments'?Math.floor(base.amount/count)+(i<base.amount%count?1:0):base.amount;
    if(amount<1)throw new Error('O valor total precisa cobrir todas as parcelas.');
    const date=mode==='once'?base.dueDate:nextOccurrence(base.dueDate,i,mode==='installments'?'monthly':mode);
    requiredDate(date);
    stmt.run(id,group,mode,i+1,count,base.title,base.kind,amount,date,base.category,base.accountId,base.notes,base.certainty,now,now);
    this.log(id,'created',`${mode} ${i+1}/${count}`);
   }
   this.db.exec('COMMIT');return {ids,count};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 item(id){const row=this.db.prepare('SELECT * FROM planned_items WHERE id=?').get(id);if(!row)throw new Error('Lançamento planejado não encontrado.');return row;}
 edit(input){const row=this.item(input?.id);if(row.status==='cancelled')throw new Error('Reative o lançamento antes de editar.');
  const validated=this.validateInput({...row,title:input.title??row.title,kind:input.kind??row.kind,amount:input.amount??row.amount_cents,dueDate:input.dueDate??row.due_date,category:input.category??row.category,notes:input.notes??row.notes,certainty:input.certainty??row.certainty,accountId:input.accountId===undefined?row.account_id:input.accountId});
  if(row.status!=='planned' && (validated.amount!==row.amount_cents||validated.kind!==row.kind))throw new Error('Desfaça a quitação antes de alterar valor ou tipo.');
  const linked=this.linkedTotal(row.id);if(linked>validated.amount)throw new Error('Valor menor que os pagamentos já vinculados.');
  this.db.prepare(`UPDATE planned_items SET title=?,kind=?,amount_cents=?,due_date=?,category=?,account_id=?,notes=?,certainty=?,updated_at=? WHERE id=?`).run(validated.title,validated.kind,validated.amount,validated.dueDate,validated.category,validated.accountId,validated.notes,validated.certainty,new Date().toISOString(),row.id);
  this.log(row.id,'edited',`Vencimento ${row.due_date} → ${validated.dueDate}; valor ${row.amount_cents} → ${validated.amount}`);return {ok:true};
 }
 setStatus(id,status){const item=this.item(id);if(!['planned','cancelled','settled_manual'].includes(status))throw new Error('Situação inválida.');
  const count=this.db.prepare('SELECT COUNT(*) AS n FROM planned_bank_links WHERE item_id=?').get(id).n;
  if(count&&status!=='planned')throw new Error('Desvincule os pagamentos bancários antes de alterar a situação.');
  if(status==='settled_manual'&&item.due_date>isoToday())throw new Error('Não é possível confirmar pagamento futuro.');
  const settled=status==='settled_manual'?new Date().toISOString():null;
  this.db.prepare('UPDATE planned_items SET status=?,settled_at=?,updated_at=? WHERE id=?').run(status,settled,new Date().toISOString(),id);
  this.log(id,status,status==='settled_manual'?'Pagamento marcado manualmente como refletido no saldo atual.':'');return {ok:true};
 }
 linkedTotal(id){const r=this.db.prepare(`SELECT COALESCE(SUM(abs(b.amount_cents)),0) AS total FROM planned_bank_links l JOIN bank_transactions b USING(account_id,external_id) WHERE l.item_id=? AND b.status='POSTED'`).get(id);return r.total;}
 link(input){const item=this.item(input?.itemId);if(item.status==='cancelled'||item.status==='settled_manual')throw new Error('Reative o lançamento para vinculá-lo.');
  const accountId=text(input?.accountId,150,'Conta'),externalId=text(input?.externalId,150,'Movimentação');
  const bank=this.db.prepare('SELECT b.*,n.nature FROM bank_transactions b LEFT JOIN bank_transaction_notes n USING(account_id,external_id) WHERE b.account_id=? AND b.external_id=?').get(accountId,externalId);
  if(!bank||!bankStatus(bank.status))throw new Error('Selecione uma movimentação bancária confirmada.');
  if((bank.amount_cents>0?'income':'expense')!==item.kind)throw new Error('Entrada e saída não são compatíveis.');
  if(bank.nature==='transfer'||bank.nature==='ignore')throw new Error('Transações internas/ignoradas não podem quitar contas.');
  if(item.account_id&&item.account_id!==accountId)throw new Error('Essa movimentação pertence a outra conta.');
  if(this.db.prepare('SELECT 1 FROM bank_manual_links WHERE account_id=? AND external_id=?').get(accountId,externalId))throw new Error('Esta movimentação já está vinculada a um registro manual.');
  if(this.db.prepare('SELECT 1 FROM planned_bank_links WHERE account_id=? AND external_id=?').get(accountId,externalId))throw new Error('Movimentação já vinculada a outro compromisso.');
  const current=this.linkedTotal(item.id);
  // Valor maior que o planejado requer atualização explícita do valor previsto antes de vincular.
  if(current+Math.abs(bank.amount_cents)>item.amount_cents)throw new Error('O pagamento excede o valor planejado. Ajuste o valor previsto antes de vincular.');
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('INSERT INTO planned_bank_links(item_id,account_id,external_id,linked_at) VALUES(?,?,?,?)').run(item.id,accountId,externalId,new Date().toISOString());
   const next=current+Math.abs(bank.amount_cents);
   this.db.prepare('UPDATE planned_items SET status=?,settled_at=?,updated_at=? WHERE id=?').run(next===item.amount_cents?'settled':'planned',next===item.amount_cents?new Date().toISOString():null,new Date().toISOString(),item.id);
   this.log(item.id,'linked',`${accountId}:${externalId} ${bank.amount_cents}`);
   this.db.exec('COMMIT');return {ok:true,remaining:item.amount_cents-next};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 unlink(input){const item=this.item(input?.itemId);const accountId=text(input?.accountId,150,'Conta'),externalId=text(input?.externalId,150,'Movimentação');
  const link=this.db.prepare('SELECT 1 FROM planned_bank_links WHERE item_id=? AND account_id=? AND external_id=?').get(item.id,accountId,externalId);if(!link)throw new Error('Vínculo não encontrado.');
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('DELETE FROM planned_bank_links WHERE item_id=? AND account_id=? AND external_id=?').run(item.id,accountId,externalId);
   this.db.prepare("UPDATE planned_items SET status='planned',settled_at=NULL,updated_at=? WHERE id=?").run(new Date().toISOString(),item.id);
   this.log(item.id,'unlinked',accountId+':'+externalId);this.db.exec('COMMIT');return {ok:true};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 reject(input){this.item(input?.itemId);const accountId=text(input?.accountId,150,'Conta'),externalId=text(input?.externalId,150,'Movimentação');
  this.db.prepare('INSERT OR IGNORE INTO planned_rejected_matches(item_id,account_id,external_id) VALUES(?,?,?)').run(input.itemId,accountId,externalId);
  this.log(input.itemId,'ignored',accountId+':'+externalId);return {ok:true};
 }
 renameBank(input){const accountId=text(input?.accountId,150,'Conta'),externalId=text(input?.externalId,150,'Movimentação');const title=input.title?text(input.title,140,'Nome'):'';
  if(!this.db.prepare('SELECT 1 FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId))throw new Error('Movimentação bancária não encontrada.');
  if(title)this.db.prepare('INSERT INTO bank_custom_titles(account_id,external_id,title) VALUES(?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET title=excluded.title').run(accountId,externalId,title);
  else this.db.prepare('DELETE FROM bank_custom_titles WHERE account_id=? AND external_id=?').run(accountId,externalId);
  return {ok:true};
 }
 bankTitles(){return this.db.prepare('SELECT account_id AS accountId,external_id AS externalId,title FROM bank_custom_titles').all();}
 list({today=isoToday(),start=null,end=null}={}){
  if(!dateOK(today))throw new Error('Data atual inválida.');
  if(start!==null)requiredDate(start);if(end!==null)requiredDate(end);
  const rows=this.db.prepare(`SELECT id,group_id AS groupId,group_type AS groupType,occurrence,total_occurrences AS totalOccurrences,title,kind,
  amount_cents AS amount,due_date AS dueDate,category,account_id AS accountId,notes,certainty,status,created_at AS createdAt,updated_at AS updatedAt,settled_at AS settledAt
  FROM planned_items WHERE (? IS NULL OR due_date>=?) AND (? IS NULL OR due_date<=?) ORDER BY due_date,id LIMIT 5000`).all(start,start,end,end);
  const linked=this.db.prepare(`SELECT l.item_id AS itemId,l.account_id AS accountId,l.external_id AS externalId,b.date,b.description,b.amount_cents AS amount,b.status,b.updated_at AS updatedAt
    FROM planned_bank_links l JOIN bank_transactions b USING(account_id,external_id) ORDER BY b.date`).all();
  const map=new Map();for(const x of linked){if(!map.has(x.itemId))map.set(x.itemId,[]);map.get(x.itemId).push(x);}
  return rows.map(x=>{
   const links=map.get(x.id)||[];const paid=links.filter(z=>z.status==='POSTED').reduce((s,z)=>s+Math.abs(z.amount),0);
   const status=x.status==='settled'&&paid<x.amount?'planned':x.status;
   const remaining=status==='settled_manual'||status==='cancelled'?0:Math.max(0,x.amount-paid);
   return {...x,status,links,paid,remaining,overpaid:Math.max(0,paid-x.amount),effectiveStatus:decideStatus({...x,status,remaining},today)};
  });
 }
 suggest(today=isoToday()){
  const items=this.list({today}).filter(x=>x.status==='planned'&&x.remaining>0&&x.dueDate>=addDay(today,-45)&&x.dueDate<=addDay(today,15));
  const banks=this.db.prepare(`SELECT b.account_id AS accountId,b.external_id AS externalId,b.date,b.description,b.amount_cents AS amount,b.category,a.name AS accountName,
  o.category AS overrideCategory,n.nature
  FROM bank_transactions b JOIN bank_accounts a USING(account_id)
  LEFT JOIN bank_category_overrides o USING(account_id,external_id)
  LEFT JOIN bank_transaction_notes n USING(account_id,external_id)
  WHERE b.status='POSTED' AND b.date>=? AND b.date<=?
   AND NOT EXISTS (SELECT 1 FROM planned_bank_links l WHERE l.account_id=b.account_id AND l.external_id=b.external_id)
   AND NOT EXISTS (SELECT 1 FROM bank_manual_links m WHERE m.account_id=b.account_id AND m.external_id=b.external_id)
  ORDER BY b.date DESC LIMIT 2000`).all(addDay(today,-65),today);
  const rejected=new Set(this.db.prepare('SELECT item_id,account_id,external_id FROM planned_rejected_matches').all().map(r=>`${r.item_id}|${r.account_id}|${r.external_id}`));
  const matches=[];
  for(const item of items){
   let best=[];
   for(const tx of banks){
    if(rejected.has(`${item.id}|${tx.accountId}|${tx.externalId}`))continue;
    if(tx.nature==='transfer'||tx.nature==='ignore'||(tx.amount>0?'income':'expense')!==item.kind)continue;
    if(item.accountId&&item.accountId!==tx.accountId)continue;
    const distance=Math.abs(Math.round((Date.parse(item.dueDate+'T00:00:00Z')-Date.parse(tx.date+'T00:00:00Z'))/86400000));
    if(distance>12)continue;
    const delta=Math.abs(item.remaining-Math.abs(tx.amount));
    if(delta>Math.max(2500,Math.round(item.remaining*.30)))continue;
    const amountScore=Math.round(48*Math.max(0,1-delta/Math.max(item.remaining,1)));
    const dateScore=Math.round(34*(1-distance/13));
    const names=normalized(item.title).split(' ').filter(x=>x.length>3),description=normalized(tx.description);
    const nameScore=names.some(w=>description.includes(w))?10:0;
    const categoryScore=(tx.overrideCategory||tx.category)===item.category?5:0;
    const score=Math.min(99,amountScore+dateScore+nameScore+categoryScore+(item.accountId?3:0));
    if(score>=45)best.push({itemId:item.id,accountId:tx.accountId,externalId:tx.externalId,date:tx.date,description:tx.description,amount:tx.amount,accountName:tx.accountName,score});
   }
   best.sort((a,b)=>b.score-a.score);matches.push(...best.slice(0,3));
  }
  return matches.sort((a,b)=>b.score-a.score).slice(0,100);
 }
 projection({today=isoToday(),start=today,end=addDay(today,60),includeEstimatedIncome=false}={}){
  requiredDate(today);requiredDate(start);requiredDate(end);
  if(start<today)start=today;if(end<start)throw new Error('Selecione datas futuras.');
  const days=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
  if(days>2000)throw new Error('Escolha um período de até 2.000 dias.');
  const accounts=this.db.prepare('SELECT balance_cents AS balance,updated_at AS observedAt FROM bank_accounts').all();
  const knownAccounts=accounts.filter(a=>Number.isSafeInteger(a.balance));
  const bankBalance=knownAccounts.reduce((s,a)=>s+a.balance,0);
  // updated_at means when we OBSERVED the amount, not the date of the bank ledger.
  // The provider does not currently expose a trustworthy balance-as-of timestamp to this schema.
  const observedAt=accounts.map(a=>a.observedAt).filter(Boolean).sort()[0]||null; // oldest contributing account
  const missingBalances=accounts.filter(a=>!Number.isSafeInteger(a.balance)).length;
  const observationAgeHours=observedAt?Math.max(0,(Date.now()-Date.parse(observedAt))/3600000):null;
  const quality=knownAccounts.length===0?'manual':missingBalances?'incomplete':
    observationAgeHours===null||!Number.isFinite(observationAgeHours)?'unknown':
    observationAgeHours>=24?'stale':'unverified';
  const manual=this.fin.load('real');const manualBalance=(manual?.settings.opening||0)+(manual?.transactions||[]).filter(t=>t.date<=today).reduce((s,t)=>s+(t.kind==='income'?t.amount:-t.amount),0);
  // Não mesclar fontes: banco se presente; caso contrário, total estritamente manual.
  const anchor=knownAccounts.length?bankBalance:manualBalance,source=knownAccounts.length?'bank':'manual';
  const all=this.list({today});
  const eligible=all.filter(i=>i.effectiveStatus!=='paid'&&i.status==='planned'&&i.remaining>0 && !(i.kind==='income'&&i.certainty==='estimated'&&!includeEstimatedIncome));
  const events=new Map();for(const item of eligible){const day=item.dueDate<today?today:item.dueDate;if(!events.has(day))events.set(day,[]);events.get(day).push(item);}
  let balance=anchor,rows=[];const carry=eligible.filter(i=>(i.dueDate<today?today:i.dueDate)<start);
  for(const item of carry)balance+=item.kind==='income'?item.remaining:-item.remaining;
  // atrasados são debitados no dia corrente, não em datas já refletidas no saldo.
  for(let day=start;day<=end;day=addDay(day,1)){
   const opening=balance,items=events.get(day)||[];
   const incoming=items.filter(i=>i.kind==='income').reduce((s,i)=>s+i.remaining,0);
   const outgoing=items.filter(i=>i.kind==='expense').reduce((s,i)=>s+i.remaining,0);
   balance+=incoming-outgoing;
   rows.push({date:day,opening,incoming,outgoing,closing:balance,items:items.map(i=>({id:i.id,title:i.title,kind:i.kind,amount:i.remaining,overdue:i.dueDate<today}))});
  }
  const min=rows.reduce((v,r)=>Math.min(v,r.closing),rows[0]?.closing??anchor),negative=rows.filter(r=>r.closing<0).map(r=>r.date);
  return {anchor,source,anchorDate:today,asOf:this.db.prepare('SELECT MAX(last_sync_at) AS last FROM bank_items').get().last||null,
    // Even a recent API read is not proof that the institution's balance is current.
    reference:{quality,observedAt,missingBalances,totalAccounts:accounts.length,observationAgeHours:observationAgeHours===null?null:Math.round(observationAgeHours)},
    includeEstimatedIncome,rows,minimum:min,negativeDays:negative,uncertainIncomeExcluded:all.filter(i=>i.status==='planned'&&i.kind==='income'&&i.certainty==='estimated'&&i.remaining>0).length};
 }
 /** Read-only purchase scenario. The SAME daily projection used by Planning is the baseline. */
 simulatePurchase({today=isoToday(),amount,installments=1,monthlyRate=0,firstDueDate=null,includeEstimatedIncome=false}={}){
  requiredDate(today);money(amount);
  if(!Number.isInteger(installments)||installments<1||installments>60)throw new Error('Escolha de 1 a 60 parcelas.');
  if(typeof monthlyRate!=='number'||!Number.isFinite(monthlyRate)||monthlyRate<0||monthlyRate>30)throw new Error('Juros mensais inválidos.');
  const due=requiredDate(firstDueDate|| (installments===1?today:nextOccurrence(today,1,'monthly')));
  if(due<today||due>addDay(today,365))throw new Error('Primeiro vencimento fora do período permitido.');
  const rate=monthlyRate/100;
  // Equal installments when financed. At zero interest, distribute residual cents exactly.
  const installmentAmount=rate===0?Math.floor(amount/installments):Math.round(amount*rate/(1-Math.pow(1+rate,-installments)));
  if(installmentAmount<1)throw new Error('Valor insuficiente para distribuir as parcelas.');
  const schedule=Array.from({length:installments},(_,index)=>({
    date:nextOccurrence(due,index,'monthly'),
    amount:rate===0?installmentAmount+(index<amount%installments?1:0):installmentAmount
  }));
  const total=schedule.reduce((n,p)=>n+p.amount,0);
  if(!Number.isSafeInteger(total)||total>MAX)throw new Error('Valor total da compra excede o limite.');
  const end=[addDay(schedule.at(-1).date,30),addDay(today,90)].sort().at(-1); // include near-term obligations beyond the last installment
  const base=this.projection({today,start:today,end,includeEstimatedIncome});
  const payments=new Map(schedule.map(x=>[x.date,x.amount]));
  let cumul=0,minimum=Number.POSITIVE_INFINITY,worstDay=today,negativeDays=0,belowReserveDays=0;
  const manual=this.fin.load('real');const reserve=manual?.settings?.reserve||0;
  const monthly=new Map();
  for(const day of base.rows){
    cumul+=payments.get(day.date)||0;
    const remaining=day.closing-cumul;
    if(remaining<minimum){minimum=remaining;worstDay=day.date;}
    if(remaining<0)negativeDays++;
    if(remaining<reserve)belowReserveDays++;
    monthly.set(day.date.slice(0,7),{month:day.date.slice(0,7),withoutPurchase:day.closing,withPurchase:remaining});
  }
  const noFunds=base.source==='manual'&&base.anchor===0&&(!manual?.transactions?.length);
  const risk=minimum<0?'risk':minimum<reserve?'caution':
    noFunds||base.reference.quality==='stale'||base.reference.quality==='incomplete'||base.reference.quality==='unknown'?'unknown':'estimate';
  return {engine:'planning',principal:amount,monthly:installmentAmount,total,interest:total-amount,installments,
   schedule,firstDueDate:due,reserve,baselineMinimum:base.minimum,minimumAfterPurchase:minimum,
   worstDay,negativeDays,belowReserveDays,anchor:base.anchor,source:base.source,reference:base.reference,
   risk,rows:[...monthly.values()],estimatedIncomeIncluded:includeEstimatedIncome,
   warning:'Estimativa baseada em dados e compromissos cadastrados. Saldos bancários podem estar desatualizados; não representa garantia de capacidade de pagamento.'};
 }
 /** Timeline for the full selected month. Past dates are RECONSTRUCTIONS, not bank statements. */
 monthTimeline({today=isoToday(),month=today.slice(0,7),includeEstimatedIncome=false}={}){
  requiredDate(today);
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<today.slice(0,7)||month>'2100-12')throw new Error('Mês da linha do tempo inválido.');
  const first=month+'-01',last=nextOccurrence(first,1,'monthly');
  const end=addDay(last,-1),start=first<today?today:first;
  const future=this.projection({today,start,end,includeEstimatedIncome});
  const futureByDate=new Map(future.rows.map(row=>[row.date,{...row,phase:'projection'}]));
  if(first>=today)return {month,rows:future.rows.map(x=>({...x,phase:'projection'})),historicalNotice:null};
  // Reverse the recorded cash movements from the most recent available anchor.
  // This is NOT a reliable historic statement: balance timestamps and full history
  // coverage are not guaranteed by a provider's sync time.
  let cashMovements;
  if(future.source==='bank'){
   cashMovements=this.db.prepare(`SELECT b.date, SUM(b.amount_cents) AS net,
      SUM(CASE WHEN b.amount_cents>0 THEN b.amount_cents ELSE 0 END) AS incoming,
      SUM(CASE WHEN b.amount_cents<0 THEN -b.amount_cents ELSE 0 END) AS outgoing
      FROM bank_transactions b JOIN bank_accounts a ON a.account_id=b.account_id
      WHERE a.balance_cents IS NOT NULL AND b.status='POSTED' AND b.date>=? AND b.date<=?
      GROUP BY b.date`).all(first,today);
  }else{
   const manual=this.fin.load('real');const m=new Map();
   for(const tx of manual?.transactions||[]){
    if(tx.date<first||tx.date>today)continue;
    const r=m.get(tx.date)||{date:tx.date,net:0,incoming:0,outgoing:0};
    const signed=tx.kind==='income'?tx.amount:-tx.amount;
    r.net+=signed;if(signed>=0)r.incoming+=signed;else r.outgoing-=signed;
    m.set(tx.date,r);
   }
   cashMovements=[...m.values()];
  }
  const flow=new Map(cashMovements.map(r=>[r.date,r]));
  const historical=new Map();
  let latest=future.anchor;
  for(let date=addDay(today,-1);date>=first;date=addDay(date,-1)){
   const tomorrow=flow.get(addDay(date,1));
   latest-=tomorrow?.net||0;
   const f=flow.get(date)||{net:0,incoming:0,outgoing:0};
   historical.set(date,{date,opening:latest-f.net,incoming:f.incoming,outgoing:f.outgoing,
     closing:latest,items:[],phase:'estimated_history'});
  }
  const rows=[];
  for(let d=first;d<=end;d=addDay(d,1)){
   const row=historical.get(d)||futureByDate.get(d);
   if(row)rows.push(row);
  }
  return {month,rows,historicalNotice:'Dias anteriores a hoje são estimativas reconstruídas a partir das movimentações disponíveis. Não representam saldo bancário histórico confirmado.'};
 }
 overview(opts={}){
  const today=opts.today||isoToday();const items=this.list({today});const suggestions=this.suggest(today);
  const start=opts.start||today,end=opts.end||addDay(today,60);
  const projection=this.projection({today,start,end,includeEstimatedIncome:!!opts.includeEstimatedIncome});
  const timeline=this.monthTimeline({today,month:opts.month||today.slice(0,7),includeEstimatedIncome:!!opts.includeEstimatedIncome});
  return {items,suggestions,bankTitles:this.bankTitles(),projection,timeline,generatedAt:new Date().toISOString()};
 }
 history(itemId){this.item(itemId);return this.db.prepare('SELECT action,details,at FROM planned_audit WHERE item_id=? ORDER BY id DESC LIMIT 50').all(itemId);}
}
module.exports={PlanningStore,dateOK,addDay,nextOccurrence,isoToday};
