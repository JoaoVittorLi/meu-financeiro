'use strict';
// Application service over FinanceDB. Instantiated only for a validated disposable
// Electron profile. No network, model, arbitrary SQL, or renderer-supplied paths.
const {createHash,randomUUID}=require('node:crypto');
const {normalizeLabel,matchRule,providerCategory,categoryDecisionFingerprint,effectiveBankOverride}=require('./db.cjs');
const READ_CONSENT='SYNTHETIC_CATEGORY_REVIEW_V1';
const WRITE_CONSENT='CONFIRM_CATEGORY_PREVIEW_V1';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key=r=>JSON.stringify([r.accountId,r.externalId]);
const generic=value=>!value||['OUTROS','COMPRAS','TRANSFERENCIAS'].includes(normalizeLabel(value));
function specific(value){
 const s=normalizeLabel(value);
 const meaningful=s.replace(/\b(PIX|TED|DOC|TRANSFERENCIA|TRANSFER|CARTAO|PAGAMENTO|COMPRA|DEBITO|CREDITO|RECEBIDO|ENVIADO|PARA|DE|DA|DO|EM)\b/g,'').replace(/[^A-Z]/g,'');
 return s.length<=120&&meaningful.length>=5;
}
class CategoryReviewService{
 constructor(finance,{syntheticProfile=false,clock=()=>Date.now()}={}){
  // This guard runs BEFORE opening or migrating any tables.
  if(syntheticProfile!==true)throw Error('Revisão supervisionada disponível somente no perfil sintético validado.');
  this.finance=finance;this.sql=finance.db;this.clock=clock;this.grants=new Map();this.previews=new Map();
  this.sql.exec(`
   CREATE TABLE IF NOT EXISTS category_rule_constraints (
    rule_id INTEGER PRIMARY KEY REFERENCES category_rules(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES bank_accounts(account_id) ON DELETE CASCADE,
    nature TEXT NOT NULL CHECK(nature IN ('income','expense')),
    after_rowid INTEGER NOT NULL CHECK(after_rowid>=0));
   CREATE TABLE IF NOT EXISTS category_review_decisions (
    suggestion_id TEXT PRIMARY KEY,evidence_hash TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('accepted','edited','denied','deferred')),
    rule_id INTEGER,decided_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS category_review_commands (
    id TEXT PRIMARY KEY,owner INTEGER NOT NULL,action TEXT NOT NULL,
    applied_at TEXT NOT NULL,receipt TEXT NOT NULL,undo_state TEXT NOT NULL DEFAULT 'available');
   CREATE TABLE IF NOT EXISTS category_review_applied_labels (
    account_id TEXT NOT NULL,external_id TEXT NOT NULL,fingerprint TEXT NOT NULL,category TEXT,
    PRIMARY KEY(account_id,external_id),
    FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE);
  `);
  if(!this.sql.prepare('PRAGMA table_info(category_review_applied_labels)').all().some(c=>c.name==='category'))this.sql.exec('ALTER TABLE category_review_applied_labels ADD COLUMN category TEXT');
 }
 authorize(input,owner){
  if(input?.consent!==READ_CONSENT||!Number.isInteger(owner))throw Error('Confirme a leitura do perfil sintético.');
  this.prune();for(const [t,g] of this.grants)if(g.owner===owner)this.grants.delete(t);
  const token=randomUUID(),expiresAt=this.clock()+15*60*1000;this.grants.set(token,{owner,expiresAt});
  return {token,expiresAt,syntheticOnly:true};
 }
 prune(){
  for(const [t,g] of this.grants)if(g.expiresAt<=this.clock())this.grants.delete(t);
  for(const [id,p] of this.previews)if(p.expiresAt<=this.clock())this.previews.delete(id);
 }
 requireGrant(input,owner){
  this.prune();const g=this.grants.get(input?.token);
  if(!g||g.owner!==owner)throw Error('Autorização de revisão ausente ou expirada.');
  return g;
 }
 revoke(input,owner){
  if(this.grants.get(input?.token)?.owner===owner){this.grants.delete(input.token);for(const [id,p] of this.previews)if(p.token===input.token)this.previews.delete(id);}
  return {revoked:true};
 }
 config(){return this.finance.listCategories();}
 // Stable keyset pagination in SQLite: never route the 2,500-row UI cache into
 // review. Only one page of raw records is held while scanning for patterns.
 pageRows({after=0,limit=200,accountId='',start='',end=''}={}){
  if(!Number.isSafeInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>200||typeof accountId!=='string'||accountId.length>150)throw Error('Paginação inválida.');
  for(const value of [start,end])if(value!==''&&(typeof value!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw Error('Período inválido.');
  if(start&&end&&start>end)throw Error('Período inválido.');
  return this.sql.prepare(`SELECT b.rowid AS rowid,b.account_id AS accountId,b.external_id AS externalId,
   a.name AS accountName,a.item_id AS itemId,b.date,b.description,b.amount_cents AS amount,b.status,b.category AS bankCategory,
   o.category AS overrideCategory,n.nature AS savedNature,n.reviewed_at AS reviewedAt,n.account_id AS noteAccountId,n.note,n.merchant,
   EXISTS(SELECT 1 FROM bank_transaction_splits s WHERE s.account_id=b.account_id AND s.external_id=b.external_id) AS hasSplits,
   l.manual_id AS linkedManualId,d.fingerprint AS decisionFingerprint,d.category AS decisionCategory
   FROM bank_transactions b JOIN bank_accounts a USING(account_id)
   LEFT JOIN bank_category_overrides o USING(account_id,external_id)
   LEFT JOIN bank_transaction_notes n USING(account_id,external_id)
   LEFT JOIN bank_manual_links l USING(account_id,external_id)
   LEFT JOIN category_review_applied_labels d USING(account_id,external_id)
   WHERE b.rowid>? AND (?='' OR b.account_id=?) AND (?='' OR b.date>=?) AND (?='' OR b.date<=?)
   ORDER BY b.rowid LIMIT ?`).all(after,accountId,accountId,start,start,end,end,limit).map(r=>({...r,
    nature:r.savedNature&&r.savedNature!=='auto'?r.savedNature:r.amount<0?'expense':'income'}));
 }
 each(options,visit){let after=0,count=0;for(;;){const rows=this.pageRows({...options,after,limit:200});for(const row of rows){visit(row);count++;}if(rows.length<200)break;after=rows[rows.length-1].rowid;}return count;}
 row(k){
  if(typeof k?.accountId!=='string'||typeof k?.externalId!=='string')throw Error('Identidade bancária inválida.');
  const id=this.sql.prepare('SELECT rowid FROM bank_transactions WHERE account_id=? AND external_id=?').get(k.accountId,k.externalId)?.rowid;
  if(!id)throw Error('Movimentação não encontrada.');return this.pageRows({after:id-1,limit:1})[0];
 }
 eligible(row){return row.status==='POSTED'&&['income','expense'].includes(row.nature)&&row.amount!==0&&!row.hasSplits&&!row.linkedManualId;}
 category(row,config=this.config()){
  const label=this.sql.prepare('SELECT fingerprint,category FROM category_review_applied_labels WHERE account_id=? AND external_id=?').get(row.accountId,row.externalId);
  return effectiveBankOverride(row,label)||matchRule(row.description,'bank',config.rules,row)||providerCategory(row.bankCategory,new Set(config.categories.map(c=>c.name)));
 }
 publicRow(row,config=this.config()){
  const label=this.sql.prepare('SELECT fingerprint,category FROM category_review_applied_labels WHERE account_id=? AND external_id=?').get(row.accountId,row.externalId);
  const supervisedOutdated=!!row.overrideCategory&&!effectiveBankOverride(row,label);
  return {accountId:row.accountId,externalId:row.externalId,accountName:row.accountName,date:row.date,description:row.description,amount:row.amount,status:row.status,nature:row.nature,category:this.category(row,config),manual:!!row.overrideCategory&&!supervisedOutdated,supervisedOutdated,hasSplits:!!row.hasSplits,fingerprint:hash(row)};
 }
 suggestions(includeDecided=false){
  const config=this.config(),groups=new Map();
  const scanned=this.each({},row=>{
   if(!this.eligible(row)||!specific(row.description))return;
   const pattern=normalizeLabel(row.description),id=hash([row.accountId,row.nature,pattern]);
   if(!groups.has(id))groups.set(id,{id,accountId:row.accountId,accountName:row.accountName,nature:row.nature,pattern,total:0,votes:new Map(),examples:[],evidence:[]});
   const g=groups.get(id);g.total++;
   // Learn exclusively from explicit human classifications, never own output.
   const ownLabel=this.sql.prepare('SELECT fingerprint FROM category_review_applied_labels WHERE account_id=? AND external_id=?').get(row.accountId,row.externalId);
   if(row.overrideCategory&&normalizeLabel(row.overrideCategory)!=='OUTROS'&&!ownLabel){
    g.votes.set(row.overrideCategory,(g.votes.get(row.overrideCategory)||0)+1);
    if(g.examples.length<3)g.examples.push(this.publicRow(row,config));
    g.evidence.push([row.rowid,categoryDecisionFingerprint(row)]);
   }
  });
  const suggestions=[];
  for(const g of groups.values()){
   const votes=[...g.votes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));if(!votes.length)continue;
   const chosen=votes.find(([name])=>!generic(name));if(!chosen)continue;
   const [category,count]=chosen,cat=config.categories.find(c=>c.name===category);
   if(!cat||(cat.kind!=='both'&&cat.kind!==g.nature))continue;
   const id=hash([g.id,category]),evidenceHash=hash([g.evidence,g.total,votes]);
   const decision=this.sql.prepare('SELECT state,evidence_hash AS evidenceHash,rule_id AS ruleId FROM category_review_decisions WHERE suggestion_id=?').get(id);
   if(!includeDecided&&decision&&['denied','accepted','edited'].includes(decision.state)&&decision.evidenceHash===evidenceHash)continue;
   // A managed rule, even paused, remains in the rules section instead of being
   // proposed repeatedly. Never infer permission to change its configuration.
   if(!includeDecided&&config.rules.some(r=>r.scope!=='manual'&&normalizeLabel(r.pattern)===g.pattern&&r.category===category&&(!r.constraint||r.constraint.accountId===g.accountId)))continue;
   const confidence=votes.length>1?'low':count>=3?'high':count===2?'medium':'low';
   suggestions.push({id,evidenceHash,name:g.pattern+' → '+category,pattern:g.pattern,matchMode:'exact',scope:'bank',priority:100,
    accountId:g.accountId,accountName:g.accountName,nature:g.nature,category,confidence,examples:g.examples,compatible:g.total,
    evidenceCount:count,conflicts:votes.length>1?votes.map(([name,n])=>name+': '+n):[],state:decision?.state==='deferred'?'deferred':'suggested',
    reason:count+' classificação(ões) manual(is) na mesma conta, natureza e descrição exata.'+(votes.length>1?' Há categorias divergentes; revise individualmente.':' Sem generalizar identificadores PIX ou semelhança de nomes.')});
  }
  return {scanned,completeLocalHistory:true,suggestions:suggestions.sort((a,b)=>b.evidenceCount-a.evidenceCount||a.id.localeCompare(b.id)).slice(0,includeDecided?undefined:100),suggestionsTotal:suggestions.length,suggestionsPartial:!includeDecided&&suggestions.length>100};
 }
 list(input,owner){
  this.requireGrant(input,owner);const config=this.config();
  return {...this.suggestions(),categories:config.categories,rules:config.rules,
   accounts:this.sql.prepare('SELECT account_id AS id,name FROM bank_accounts ORDER BY name,account_id').all(),
   decisions:this.sql.prepare('SELECT suggestion_id AS id,state,decided_at AS decidedAt FROM category_review_decisions ORDER BY decided_at DESC LIMIT 100').all(),
   audit:this.sql.prepare('SELECT id,action,applied_at AS appliedAt,undo_state AS undoState FROM category_review_commands ORDER BY rowid DESC LIMIT 50').all()};
 }
 queue(input,owner){
  this.requireGrant(input,owner);const options=input?.filters||{},config=this.config();
  let after=input.after??0;const limit=input.limit??50;
  if(!Number.isSafeInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Página de revisão inválida.');
  if(options.confidence&&!['high','medium','low','none'].includes(options.confidence))throw Error('Confiança inválida.');
  if(options.pattern&&(typeof options.pattern!=='string'||options.pattern.length>120))throw Error('Padrão inválido.');
  const suggestions=this.suggestions(true).suggestions,rows=[];let scanned=0,last=after,hasMore=false;
  for(;;){
   const page=this.pageRows({...options,after,limit:200});
   for(const row of page){
    scanned++;const category=this.category(row,config),same=suggestions.find(s=>s.accountId===row.accountId&&s.nature===row.nature&&s.pattern===normalizeLabel(row.description));
    const reasons=[];
    if(!['transfer','ignore'].includes(row.nature)){
     if(generic(category))reasons.push('generic_category');
     if(!row.reviewedAt)reasons.push('not_reviewed');
     if(same?.conflicts.length)reasons.push('inconsistent_pattern');
     if(row.hasSplits)reasons.push('split_individual_review');
     if(this.publicRow(row,config).supervisedOutdated)reasons.push('outdated_classification');
    }
    // PENDING alone is never a categorization issue; never approve it in a batch.
    const confidence=same?.confidence||'none';
    if(reasons.length&&(!options.confidence||options.confidence===confidence)&&(!options.pattern||normalizeLabel(row.description)===options.pattern)){
     if(rows.length===limit){hasMore=true;break;}
     rows.push({...this.publicRow(row,config),reasons,confidence,suggestedCategory:same?.category||null,batchEligible:this.eligible(row)&&!row.overrideCategory&&confidence!=='low'});
    }
    last=row.rowid;
   }
   if(hasMore||page.length<200)break;after=page[page.length-1].rowid;
  }
  return {rows,nextCursor:hasMore?last:null,scanned,pageOnly:true,coverage:'Histórico SQLite local; não certifica a cobertura do banco.'};
 }
 validateCategory(category,nature){
  const c=this.config().categories.find(c=>c.name===category);
  if(!c||!['income','expense'].includes(nature)||(c.kind!=='both'&&c.kind!==nature))throw Error('Categoria incompatível com a natureza.');
 }
 prepare(input,owner){
  this.requireGrant(input,owner);if(this.previews.size>=100)throw Error('Muitas prévias abertas. Encerre a sessão.');
  const operation=this.operation(input.action,input.payload||{}),id=randomUUID(),expiresAt=this.clock()+5*60*1000;
  const digest=hash(operation);this.previews.set(id,{id,token:input.token,owner,expiresAt,action:input.action,payload:input.payload||{},operation,digest});
  return {id,digest,expiresAt,action:input.action,syntheticOnly:true,...operation.preview};
 }
 operation(action,payload){
  const config=this.config();
  if(action==='rule'){
   const suggestion=this.suggestions().suggestions.find(s=>s.id===payload.suggestionId);
   if(!suggestion)throw Error('Sugestão desatualizada. Atualize a lista.');
   const category=payload.category||suggestion.category;this.validateCategory(category,suggestion.nature);
   const rule={pattern:suggestion.pattern,matchMode:'exact',scope:'bank',priority:payload.priority??100,category};
   if(!Number.isInteger(rule.priority)||rule.priority<1||rule.priority>999)throw Error('Prioridade inválida.');
   const conflicts=config.rules.filter(r=>r.enabled&&r.scope!=='manual'&&(!r.constraint||r.constraint.accountId===suggestion.accountId)&&matchRule(rule.pattern,'bank',[{...r,constraint:undefined}])!==null);
   if(conflicts.length)throw Error('Conflito com regra existente. Revise a precedência na gestão de regras.');
   const afterRowid=this.sql.prepare('SELECT COALESCE(MAX(rowid),0) AS n FROM bank_transactions').get().n;
   const eligible=[];this.each({accountId:suggestion.accountId},r=>{if(this.eligible(r)&&!r.overrideCategory&&r.nature===suggestion.nature&&normalizeLabel(r.description)===rule.pattern&&eligible.length<101)eligible.push(this.publicRow(r,config));});
   return {action,suggestion,rule,afterRowid,config,
    preview:{title:'Criar regra para próximas importações',summary:'Somente novos registros POSTED da conta e natureza indicadas. O histórico permanece intacto.',rule:{...rule,accountId:suggestion.accountId,accountName:suggestion.accountName,nature:suggestion.nature},examples:suggestion.examples,historicalEligible:eligible.length,historicalPartial:eligible.length>100,affected:[],confidence:suggestion.confidence}};
  }
  if(action==='decision'){
   const s=this.suggestions().suggestions.find(s=>s.id===payload.suggestionId);
   if(!s||!['denied','deferred'].includes(payload.state))throw Error('Decisão inválida ou desatualizada.');
   return {action,suggestion:s,state:payload.state,preview:{title:payload.state==='denied'?'Negar sugestão':'Adiar sugestão',summary:'A decisão será lembrada localmente. Nenhuma categoria ou regra será alterada.',affected:[]}};
  }
  if(action==='classify'||action==='reviewed'){
   if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>100)throw Error('Selecione entre 1 e 100 registros.');
   if(new Set(payload.items.map(key)).size!==payload.items.length)throw Error('Identidade duplicada.');
   const rows=payload.items.map(k=>{const r=this.row(k);if(k.fingerprint!==hash(r))throw Error('Movimentação desatualizada. Atualize a revisão.');return r;});
   const suggested=this.suggestions(true).suggestions;
   for(const r of rows){
    const staleOverride=this.publicRow(r,config).supervisedOutdated;
    if(action==='classify'&&(!this.eligible(r)||(r.overrideCategory&&(!staleOverride||rows.length>1))))throw Error('Preserve classificação manual, splits, vínculos, PENDING e transfer/ignore. Revise individualmente em Movimentações.');
    if(action==='classify')this.validateCategory(payload.category,r.nature);
    const s=suggested.find(s=>s.accountId===r.accountId&&s.nature===r.nature&&s.pattern===normalizeLabel(r.description));
    if(rows.length>1&&s?.confidence==='low')throw Error('Baixa confiança exige revisão individual.');
   }
   return {action,rows,category:action==='classify'?payload.category:null,config,preview:{title:action==='reviewed'?'Marcar seleção como revisada':rows.length===1?'Classificar este registro':'Classificar seleção do histórico',summary:action==='reviewed'?'Somente o estado de revisão destes registros será alterado; categorias e natureza preservadas.':'Confirmação exclusiva destes '+rows.length+' registros; não cria regra futura.',affected:rows.map(r=>({...this.publicRow(r,config),newCategory:action==='classify'?payload.category:this.category(r,config)})),totalCents:rows.reduce((s,r)=>s+Math.abs(r.amount),0)}};
  }
  if(action==='manage-rule'){
   const rule=config.rules.find(r=>r.id===payload.ruleId);
   // Existing human rules retain their original editor and authorization path.
   if(!rule?.constraint||!['pause','resume','delete','edit'].includes(payload.change))throw Error('Selecione uma regra supervisionada e uma operação válida.');
   const category=payload.category||rule.category;this.validateCategory(category,rule.constraint.nature);
   if(payload.change==='edit'||payload.change==='resume'){
    if(config.rules.some(r=>r.id!==rule.id&&r.enabled&&r.scope!=='manual'&&(!r.constraint||r.constraint.accountId===rule.constraint.accountId)&&matchRule(rule.pattern,'bank',[{...r,constraint:undefined}])))throw Error('Conflito de precedência com outra regra.');
   }
   const afterRules=config.rules.filter(r=>r.id!==rule.id||payload.change!=='delete').map(r=>r.id!==rule.id?r:{...r,enabled:payload.change==='pause'?0:payload.change==='resume'?1:r.enabled,category});
   let count=0;const affected=[],impact=createHash('sha256');this.each({accountId:rule.constraint.accountId},r=>{
    if(!r.overrideCategory&&matchRule(r.description,'bank',[{...rule,enabled:1}],r)){
     count++;impact.update(hash(r));if(affected.length<100)affected.push({...this.publicRow(r,config),newCategory:matchRule(r.description,'bank',afterRules,r)||providerCategory(r.bankCategory,new Set(config.categories.map(c=>c.name)))});
    }
   });
   return {action,rule,config,change:payload.change,category,count,affected,impactHash:impact.digest('hex'),
    preview:{title:{pause:'Pausar regra',resume:'Reativar regra',delete:'Excluir regra',edit:'Editar categoria da regra'}[payload.change],summary:count+' registro(s) automáticos compatíveis; overrides e extratos brutos preservados.',affected,affectedTotal:count,partial:count>affected.length}};
  }
  if(action==='undo'){
   const command=this.sql.prepare('SELECT receipt,undo_state AS undoState FROM category_review_commands WHERE id=?').get(payload.commandId);
   if(!command||command.undoState!=='available')throw Error('Ação indisponível para desfazer.');
   const receipt=JSON.parse(command.receipt);
   if(!['classify','reviewed','rule'].includes(receipt.action))throw Error('Esta ação não oferece reversão automática.');
   if(['classify','reviewed'].includes(receipt.action))for(const item of receipt.changes)if(hash(this.row(item.key))!==item.afterFingerprint)throw Error('Conflito com alteração posterior; reversão recusada.');
   if(receipt.action==='rule'){
    const rule=config.rules.find(r=>r.id===receipt.ruleId);
    if(hash(rule)!==receipt.afterFingerprint)throw Error('Regra alterada posteriormente; reversão recusada.');
    let applied=false;this.each({accountId:rule.constraint.accountId},r=>{if(matchRule(r.description,'bank',[rule],r))applied=true;});
    if(applied)throw Error('Regra já aplicada a importações futuras. Pause-a com prévia de impacto.');
   }
   return {action,commandId:payload.commandId,receipt,config,preview:{title:'Desfazer ação confirmada',summary:'Reversão condicionada ao estado atual; alterações posteriores bloqueiam a execução.',affected:receipt.changes?.map(c=>({...c.key,description:c.description,date:c.date,amount:c.amount,accountName:c.accountName,category:receipt.category||c.previousEffective,newCategory:c.beforeCategory||c.previousEffective}))||[]}};
  }
  if(action==='forget')return {action,decisions:this.sql.prepare('SELECT * FROM category_review_decisions ORDER BY suggestion_id').all(),preview:{title:'Apagar preferências de sugestões',summary:'Remove recusas e adiamentos armazenados. Regras ativas, categorias e auditoria financeira serão preservadas.',affected:[]}};
  throw Error('Operação não suportada.');
 }
 validateConfirmation(input,owner){
  this.requireGrant(input,owner);
  if(input.consent!==WRITE_CONSENT)throw Error('Confirme explicitamente a prévia exibida.');
  const prior=this.sql.prepare('SELECT owner,receipt FROM category_review_commands WHERE id=?').get(input.id);
  if(prior){if(prior.owner!==owner)throw Error('Comando pertence a outra origem.');const receipt=JSON.parse(prior.receipt);if(input.digest!==receipt.digest)throw Error('Prévia inválida.');return {...receipt,replayed:true};}
  const p=this.previews.get(input.id);
  if(!p||p.token!==input.token||p.owner!==owner||p.digest!==input.digest)throw Error('Prévia inválida ou expirada.');
  if(hash(this.operation(p.action,p.payload))!==p.digest)throw Error('Prévia desatualizada. Gere uma nova prévia antes de confirmar.');
  return null;
 }
 confirm(input,owner,backup=null){
  const replay=this.validateConfirmation(input,owner);if(replay)return replay;
  const p=this.previews.get(input.id);
  this.sql.exec('BEGIN IMMEDIATE');
  try{
   const operation=this.operation(p.action,p.payload);
   if(hash(operation)!==p.digest)throw Error('Prévia desatualizada. Gere uma nova prévia antes de confirmar.');
   const receipt=this.execute(operation,p.id,owner);receipt.digest=p.digest;if(backup)receipt.backup=backup;
   this.sql.prepare('INSERT INTO category_review_commands(id,owner,action,applied_at,receipt,undo_state) VALUES(?,?,?,?,?,?)').run(p.id,owner,p.action,new Date(this.clock()).toISOString(),JSON.stringify(receipt),['classify','reviewed','rule'].includes(p.action)?'available':'not_applicable');
   this.sql.exec('COMMIT');this.previews.delete(p.id);return receipt;
  }catch(e){this.sql.exec('ROLLBACK');throw e;}
 }
 decide(suggestion,state,ruleId=null){
  this.sql.prepare(`INSERT INTO category_review_decisions(suggestion_id,evidence_hash,state,rule_id,decided_at) VALUES(?,?,?,?,?)
   ON CONFLICT(suggestion_id) DO UPDATE SET evidence_hash=excluded.evidence_hash,state=excluded.state,rule_id=excluded.rule_id,decided_at=excluded.decided_at`).run(suggestion.id,suggestion.evidenceHash,state,ruleId,new Date(this.clock()).toISOString());
 }
 execute(op,id,owner){
  const receipt={id,action:op.action,confirmedBy:'renderer:'+owner,changesApplied:true,syntheticOnly:true};
  if(op.action==='rule'){
   this.finance.upsertRule(op.rule);const ruleId=Number(this.sql.prepare('SELECT last_insert_rowid() AS id').get().id);
   this.sql.prepare('INSERT INTO category_rule_constraints(rule_id,account_id,nature,after_rowid) VALUES(?,?,?,?)').run(ruleId,op.suggestion.accountId,op.suggestion.nature,op.afterRowid);
   this.decide(op.suggestion,op.rule.category===op.suggestion.category?'accepted':'edited',ruleId);
   return {...receipt,ruleId,afterFingerprint:hash(this.config().rules.find(r=>r.id===ruleId)),historicalChanges:0};
  }
  if(op.action==='decision'){this.decide(op.suggestion,op.state);return {...receipt,state:op.state,financialChanges:0};}
  if(op.action==='classify'||op.action==='reviewed'){
   const changes=op.rows.map(r=>({key:{accountId:r.accountId,externalId:r.externalId},description:r.description,date:r.date,amount:r.amount,accountName:r.accountName,beforeCategory:r.overrideCategory,previousEffective:this.category(r,op.config),beforeNotes:r.noteAccountId?{nature:r.savedNature,reviewedAt:r.reviewedAt,note:r.note,merchant:r.merchant}:null,beforeLabel:this.sql.prepare('SELECT fingerprint,category FROM category_review_applied_labels WHERE account_id=? AND external_id=?').get(r.accountId,r.externalId)||null}));
   this.finance.batchBankChanges({items:changes.map(c=>c.key),...(op.action==='classify'?{category:op.category}:{}),reviewed:true},{inTransaction:true});
   for(const c of changes){const current=this.row(c.key);if(op.action==='classify')this.sql.prepare('INSERT INTO category_review_applied_labels(account_id,external_id,fingerprint,category) VALUES(?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET fingerprint=excluded.fingerprint,category=excluded.category').run(c.key.accountId,c.key.externalId,categoryDecisionFingerprint(current),op.category);c.afterFingerprint=hash(this.row(c.key));}
   return {...receipt,category:op.category,changes};
  }
  if(op.action==='manage-rule'){
   if(op.change==='delete')this.finance.deleteRule(op.rule.id);
   else if(op.change==='edit')this.finance.upsertRule({...op.rule,category:op.category});
   else this.sql.prepare('UPDATE category_rules SET enabled=? WHERE id=?').run(op.change==='resume'?1:0,op.rule.id);
   return {...receipt,ruleId:op.rule.id,change:op.change,affected:op.count};
  }
  if(op.action==='undo'){
   if(op.receipt.action==='rule')this.finance.deleteRule(op.receipt.ruleId);
   else for(const c of op.receipt.changes){
    if(c.beforeCategory)this.sql.prepare('UPDATE bank_category_overrides SET category=? WHERE account_id=? AND external_id=?').run(c.beforeCategory,c.key.accountId,c.key.externalId);
    else this.sql.prepare('DELETE FROM bank_category_overrides WHERE account_id=? AND external_id=?').run(c.key.accountId,c.key.externalId);
    if(c.beforeNotes)this.sql.prepare('UPDATE bank_transaction_notes SET nature=?,reviewed_at=?,note=?,merchant=? WHERE account_id=? AND external_id=?').run(c.beforeNotes.nature,c.beforeNotes.reviewedAt,c.beforeNotes.note,c.beforeNotes.merchant,c.key.accountId,c.key.externalId);
    else this.sql.prepare('DELETE FROM bank_transaction_notes WHERE account_id=? AND external_id=?').run(c.key.accountId,c.key.externalId);
    if(c.beforeLabel)this.sql.prepare('INSERT INTO category_review_applied_labels(account_id,external_id,fingerprint,category) VALUES(?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET fingerprint=excluded.fingerprint,category=excluded.category').run(c.key.accountId,c.key.externalId,c.beforeLabel.fingerprint,c.beforeLabel.category);
    else this.sql.prepare('DELETE FROM category_review_applied_labels WHERE account_id=? AND external_id=?').run(c.key.accountId,c.key.externalId);
   }
   this.sql.prepare("UPDATE category_review_commands SET undo_state='undone' WHERE id=?").run(op.commandId);
   return {...receipt,undone:op.commandId};
  }
  if(op.action==='forget'){this.sql.exec('DELETE FROM category_review_decisions');return {...receipt,financialChanges:0};}
  throw Error('Operação não suportada.');
 }
}
module.exports={CategoryReviewService,READ_CONSENT,WRITE_CONSENT,specific};
