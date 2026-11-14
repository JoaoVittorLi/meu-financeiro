'use strict';
// D05 E2 canonical hierarchy service. Host must separately enforce profile, owner, and human approval.
// No IPC is exposed here; AI consumers must use the read-only facade.
const {randomUUID,createHash}=require('node:crypto');
const {normalizedName}=require('./d05-hierarchy.cjs');
const {matchRule}=require('./db.cjs');
const ALLOWED_MATCH=new Set(['exact','starts','contains']);
const ALLOWED_SCOPE=new Set(['bank','manual','both']);
function ensureObject(x){if(!x||typeof x!=='object'||Array.isArray(x))throw Error('D05: objeto inválido');return x;}
function ensureId(x,label){if(typeof x!=='string'||!x||x.length>140||/[\x00-\x1f<>]/.test(x))throw Error('D05: '+label+' inválido');return x;}
function ensureText(x,max,label){if(typeof x!=='string'||!x.trim()||x.trim().length>max||/[\x00-\x1f<>]/.test(x))throw Error('D05: '+label+' inválido');return x.trim();}
function ensureHue(v){if(!Number.isInteger(v)||v<0||v>359)throw Error('D05: tonalidade inválida');return v;}
function checkProfile(p){if(p!=='real'&&p!=='demo')throw Error('D05: perfil inválido');return p;}
function sameIdPair(a,b){return a.categoryId===b.categoryId&&a.subcategoryId===b.subcategoryId;}
function inTransaction(db, fn) {
 if(db.isTransaction)throw Error('D05: transação aninhada proibida');
 db.exec('BEGIN IMMEDIATE');
 try{const value=fn();db.exec('COMMIT');return value;}
 catch(e){db.exec('ROLLBACK');throw e;}
}
class D05CategoryService{
 constructor(finance){
  if(!finance||!finance.db)throw Error('D05: FinanceDB obrigatório');
  this.finance=finance;this.db=finance.db;
  if(!this.db.prepare("SELECT 1 FROM app_meta WHERE key='d05_hierarchy_e1'").get())
   throw Error('D05: migração E1 ausente');
 }
 listCatalog({includeInactive=false}={}){
  const parents=this.db.prepare(`SELECT id,name,color,kind,icon_key AS iconKey,hue,
    built_in AS builtIn FROM categories ORDER BY built_in DESC,name COLLATE NOCASE`).all();
  const children=this.db.prepare(`SELECT id,parent_category_id AS parentCategoryId,name,icon_key AS iconKey,
    hue,kind,active,built_in AS builtIn,sort_order AS sortOrder
    FROM subcategories ORDER BY sort_order,id`).all();
  return {contract:'D05/CATEGORY-TARGET-V1',version:1,parents:parents.map(p=>({
    ...p,subcategories:children.filter(s=>s.parentCategoryId===p.id&&(includeInactive||s.active===1))
  }))};
 }
 resolve(target,{allowInactive=false}={}){
  ensureObject(target);
  const categoryId=ensureId(target.categoryId,'categoryId');
  const subcategoryId=target.subcategoryId===null||target.subcategoryId===undefined?null:ensureId(target.subcategoryId,'subcategoryId');
  const parent=this.db.prepare(`SELECT id,name,kind,icon_key AS iconKey,hue
    FROM categories WHERE id=?`).get(categoryId);
  if(!parent)throw Error('D05: categoria inexistente');
  let child=null;
  if(subcategoryId!==null){
   child=this.db.prepare(`SELECT id,parent_category_id AS parentCategoryId,name,
     icon_key AS iconKey,hue,kind,active FROM subcategories WHERE id=?`).get(subcategoryId);
   if(!child||child.parentCategoryId!==categoryId||(!allowInactive&&child.active!==1))
    throw Error('D05: subcategoria ausente, inativa ou incompatível com a categoria-pai');
  }
  return {categoryId,parentName:parent.name,subcategoryId,parent,child};
 }
 resolveLegacy(category,subcategoryId=null){
  const label=ensureText(category,70,'categoria');
  const parent=this.db.prepare('SELECT id FROM categories WHERE name=? COLLATE NOCASE').get(label);
  if(!parent)throw Error('D05: nome de categoria legado desconhecido');
  return this.resolve({categoryId:parent.id,subcategoryId});
 }
 createSubcategory(input){
  ensureObject(input);
  const parent=this.resolve({categoryId:input.parentCategoryId,subcategoryId:null});
  const name=ensureText(input.name,80,'nome');
  const norm=normalizedName(name);
  const iconKey=ensureText(input.iconKey,64,'ícone');
  if(!/^[a-z0-9-]+$/.test(iconKey))throw Error('D05: ícone não suportado');
  const hue=ensureHue(input.hue);
  return inTransaction(this.db,()=>{
   const exists=this.db.prepare('SELECT 1 FROM subcategories WHERE parent_category_id=? AND normalized_name=?').get(parent.categoryId,norm);
   if(exists)throw Error('D05: subcategoria duplicada na categoria-pai');
   const id='sub:custom:'+randomUUID();
   this.db.prepare(`INSERT INTO subcategories
     (id,parent_category_id,name,normalized_name,icon_key,hue,kind,active,built_in,sort_order)
     VALUES(?,?,?,?,?,?,?,1,0,COALESCE((SELECT MAX(sort_order)+1 FROM subcategories WHERE parent_category_id=?),0))`)
    .run(id,parent.categoryId,name,norm,iconKey,hue,parent.parent.kind,parent.categoryId);
   return this.resolve({categoryId:parent.categoryId,subcategoryId:id}).child;
  });
 }
 updateSubcategory(input){
  ensureObject(input);const id=ensureId(input.id,'id');
  return inTransaction(this.db,()=>{
   const prev=this.db.prepare('SELECT * FROM subcategories WHERE id=?').get(id);
   if(!prev)throw Error('D05: subcategoria não encontrada');
   if(prev.built_in)throw Error('D05: catálogo aprovado imutável');
   if(input.parentCategoryId!==undefined&&input.parentCategoryId!==prev.parent_category_id)
     throw Error('D05: reparenting exige preview e fluxo próprio');
   const name=input.name===undefined?prev.name:ensureText(input.name,80,'nome');
   const norm=normalizedName(name);
   const iconKey=input.iconKey===undefined?prev.icon_key:ensureText(input.iconKey,64,'ícone');
   if(!/^[a-z0-9-]+$/.test(iconKey))throw Error('D05: ícone não suportado');
   const hue=input.hue===undefined?prev.hue:ensureHue(input.hue);
   const active=input.active===undefined?prev.active:(input.active===true?1:input.active===false?0:NaN);
   if(![0,1].includes(active))throw Error('D05: estado inválido');
   if(!active&&this.usage(id).total>0)throw Error('D05: subcategoria em uso não pode ser desativada');
   const exists=this.db.prepare('SELECT id FROM subcategories WHERE parent_category_id=? AND normalized_name=?').get(prev.parent_category_id,norm);
   if(exists&&exists.id!==id)throw Error('D05: subcategoria duplicada na categoria-pai');
   this.db.prepare(`UPDATE subcategories SET name=?,normalized_name=?,icon_key=?,hue=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
     .run(name,norm,iconKey,hue,active,id);
   return this.resolve({categoryId:prev.parent_category_id,subcategoryId:id},{allowInactive:true}).child;
  });
 }
 usage(subcategoryId){
  ensureId(subcategoryId,'subcategoryId');
  const items={};
  for(const table of ['transactions','bank_category_overrides','bank_transaction_splits','category_rules','planned_items']){
   const exists=this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
   items[table]=exists?this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE subcategory_id=?`).get(subcategoryId).n:0;
  }
  return {subcategoryId,byTable:items,total:Object.values(items).reduce((a,b)=>a+b,0)};
 }
 previewSubcategoryDelete({id}){
  ensureId(id,'id');
  const row=this.db.prepare(`SELECT id,name,parent_category_id,built_in FROM subcategories WHERE id=?`).get(id);
  if(!row)throw Error('D05: subcategoria inexistente');
  const impact=this.usage(id);
  return {contract:'D05/SUBCATEGORY-DELETE-PREVIEW-V1',id,impact,
    canDelete:!row.built_in&&impact.total===0,
    previewVersion:createHash('sha256').update(JSON.stringify([row,impact])).digest('hex'),
    changesApplied:false};
 }
 previewSubcategoryMove({id,parentCategoryId}){
  ensureId(id,'id');
  const dest=this.resolve({categoryId:parentCategoryId,subcategoryId:null});
  const row=this.db.prepare('SELECT id,name,normalized_name,parent_category_id,built_in FROM subcategories WHERE id=?').get(id);
  if(!row)throw Error('D05: subcategoria inexistente');
  const impact=this.usage(id);
  const collision=this.db.prepare('SELECT id FROM subcategories WHERE parent_category_id=? AND normalized_name=?')
   .get(parentCategoryId,row.normalized_name);
  const canMove=!row.built_in&&impact.total===0&&(!collision||collision.id===id)&&row.parent_category_id!==parentCategoryId;
  return {contract:'D05/SUBCATEGORY-MOVE-PREVIEW-V1',id,parentCategoryId,
   impact,canMove,previewVersion:createHash('sha256').update(JSON.stringify([row,impact,parentCategoryId,dest.parent.kind,collision])).digest('hex'),
   changesApplied:false};
 }
 moveSubcategory({id,parentCategoryId,previewVersion}){
  if(!/^[a-f0-9]{64}$/.test(String(previewVersion||'')))throw Error('D05: prévia de mudança de pai obrigatória');
  return inTransaction(this.db,()=>{
   const p=this.previewSubcategoryMove({id,parentCategoryId});
   if(previewVersion!==p.previewVersion)throw Error('D05: prévia de mudança desatualizada');
   if(!p.canMove)throw Error('D05: subcategoria aprovada, em uso ou nome duplicado; mudança negada');
   const dest=this.resolve({categoryId:parentCategoryId,subcategoryId:null});
   // Transactional DDL ensures trigger is restored even if the update fails and rolls back.
   this.db.exec('DROP TRIGGER d05_subcategories_identity_immutable');
   this.db.prepare(`UPDATE subcategories SET parent_category_id=?,kind=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(parentCategoryId,dest.parent.kind,id);
   this.db.exec(`CREATE TRIGGER d05_subcategories_identity_immutable
     BEFORE UPDATE OF id,parent_category_id ON subcategories
     WHEN NEW.id IS NOT OLD.id OR NEW.parent_category_id IS NOT OLD.parent_category_id
     BEGIN SELECT RAISE(ABORT, 'D05: reparenting requer contrato E2'); END;`);
   return {id,parentCategoryId,changed:true};
  });
 }
 deleteSubcategory(input){
  ensureObject(input);
  return inTransaction(this.db,()=>{
   const preview=this.previewSubcategoryDelete({id:input.id});
   if(!/^[a-f0-9]{64}$/.test(String(input.previewVersion||''))||
      input.previewVersion!==preview.previewVersion)throw Error('D05: prévia de exclusão obrigatória ou desatualizada');
   if(!preview.canDelete)throw Error('D05: subcategoria aprovada ou em uso');
   this.db.prepare('DELETE FROM subcategories WHERE id=?').run(preview.id);
   return {deleted:preview.id,impact:preview.impact};
  });
 }
 listManual({profile,categoryId=null,subcategoryId=undefined,limit=1000}){
  checkProfile(profile);
  if(!Number.isInteger(limit)||limit<1||limit>2500)throw Error('D05: limite inválido');
  if(categoryId!==null)this.resolve({categoryId,subcategoryId:subcategoryId===undefined?null:subcategoryId},{allowInactive:true});
  else if(subcategoryId!==undefined)throw Error('D05: filtro de filho requer pai');
  const sql=`SELECT t.profile,t.id,t.date,t.description,t.kind,t.amount_cents AS amount,t.category,t.origin,
     COALESCE(t.category_id,c.id) AS categoryId,t.subcategory_id AS subcategoryId
     FROM transactions t LEFT JOIN categories c ON c.name=t.category COLLATE NOCASE
     WHERE t.profile=? AND (? IS NULL OR COALESCE(t.category_id,c.id)=?)
       AND (?=0 OR t.subcategory_id IS ?) ORDER BY t.date DESC,t.id LIMIT ?`;
  const count=this.db.prepare(`SELECT COUNT(*) AS n FROM transactions t LEFT JOIN categories c ON c.name=t.category COLLATE NOCASE
     WHERE t.profile=? AND (? IS NULL OR COALESCE(t.category_id,c.id)=?)
       AND (?=0 OR t.subcategory_id IS ?)`).get(profile,categoryId,categoryId,subcategoryId===undefined?0:1,subcategoryId===undefined?null:subcategoryId).n;
  return {items:this.db.prepare(sql).all(profile,categoryId,categoryId,subcategoryId===undefined?0:1,subcategoryId===undefined?null:subcategoryId,limit),
     total:count,truncated:count>limit};
 }
 assignManual({profile,id,target}){
  checkProfile(profile);ensureId(id,'movimentação');
  const resolved=this.resolve(target);
  return inTransaction(this.db,()=>{
   const prior=this.db.prepare('SELECT category,category_id,subcategory_id FROM transactions WHERE profile=? AND id=?').get(profile,id);
   if(!prior)throw Error('D05: lançamento manual não encontrado');
   this.db.prepare(`UPDATE transactions SET category=?,category_id=?,subcategory_id=? WHERE profile=? AND id=?`)
     .run(resolved.parentName,resolved.categoryId,resolved.subcategoryId,profile,id);
   return {profile,id,categoryId:resolved.categoryId,subcategoryId:resolved.subcategoryId,changed:true};
  });
 }
 assignBank({accountId,externalId,target}){
  ensureId(accountId,'conta');ensureId(externalId,'transação');
  const r=this.resolve(target);
  return inTransaction(this.db,()=>{
   const row=this.db.prepare('SELECT status FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId);
   if(!row)throw Error('D05: movimento bancário inexistente');
   this.db.prepare(`INSERT INTO bank_category_overrides
    (account_id,external_id,category,category_id,subcategory_id) VALUES(?,?,?,?,?)
    ON CONFLICT(account_id,external_id) DO UPDATE SET
    category=excluded.category,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id`)
     .run(accountId,externalId,r.parentName,r.categoryId,r.subcategoryId);
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get())
    this.db.prepare('DELETE FROM category_review_applied_labels WHERE account_id=? AND external_id=?').run(accountId,externalId);
   return {accountId,externalId,categoryId:r.categoryId,subcategoryId:r.subcategoryId,status:row.status};
  });
 }
 previewBankBatch({items,target}){
  const r=this.resolve(target);
  if(!Array.isArray(items)||items.length<1||items.length>100)throw Error('D05: lote deve ter entre 1 e 100 movimentos');
  const keys=new Set(),rows=[];
  for(const x of items){
   ensureObject(x);const accountId=ensureId(x.accountId,'conta'),externalId=ensureId(x.externalId,'transação');
   const key=JSON.stringify([accountId,externalId]);if(keys.has(key))throw Error('D05: duplicata no lote');keys.add(key);
   const row=this.db.prepare(`SELECT b.account_id,b.external_id,b.amount_cents,b.status,b.category,
    o.category AS override_category,o.category_id,o.subcategory_id,n.nature
    FROM bank_transactions b LEFT JOIN bank_category_overrides o USING(account_id,external_id)
    LEFT JOIN bank_transaction_notes n USING(account_id,external_id)
    WHERE b.account_id=? AND b.external_id=?`).get(accountId,externalId);
   if(!row)throw Error('D05: transação do lote inexistente');
   rows.push(row);
  }
  rows.sort((a,b)=>a.account_id.localeCompare(b.account_id)||a.external_id.localeCompare(b.external_id));
  const rules=this.db.prepare('SELECT id,pattern,match_mode,category,priority,enabled,category_id,subcategory_id FROM category_rules ORDER BY id').all();
  const splits=this.db.prepare('SELECT account_id,external_id,position,category,amount_cents,category_id,subcategory_id FROM bank_transaction_splits ORDER BY account_id,external_id,position').all();
  const version=createHash('sha256').update(JSON.stringify([r.categoryId,r.parentName,r.subcategoryId,r.child?.name??null,rows,rules,splits])).digest('hex');
  return {contract:'D05/BANK-BATCH-PREVIEW-V1',previewVersion:version,categoryId:r.categoryId,
    subcategoryId:r.subcategoryId,count:rows.length,posted:rows.filter(x=>x.status==='POSTED').length,
    pending:rows.filter(x=>x.status!=='POSTED').length,changesApplied:false};
 }
 assignBankBatch({items,target,previewVersion}){
  if(!/^[a-f0-9]{64}$/.test(String(previewVersion||'')))throw Error('D05: previewVersion obrigatório');
  return inTransaction(this.db,()=>{
   const current=this.previewBankBatch({items,target});
   if(current.previewVersion!==previewVersion)throw Error('D05: prévia desatualizada; revisão obrigatória');
   for(const {accountId,externalId} of items){
    const r=this.resolve(target);
    this.db.prepare(`INSERT INTO bank_category_overrides(account_id,external_id,category,category_id,subcategory_id)
    VALUES(?,?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET
    category=excluded.category,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id`)
    .run(accountId,externalId,r.parentName,r.categoryId,r.subcategoryId);
    if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get())
      this.db.prepare('DELETE FROM category_review_applied_labels WHERE account_id=? AND external_id=?').run(accountId,externalId);
   }
   return {changed:items.length,categoryId:current.categoryId,subcategoryId:current.subcategoryId};
  });
 }
 setBankSplits({accountId,externalId,parts}){
  ensureId(accountId,'conta');ensureId(externalId,'transação');
  if(!Array.isArray(parts)||(parts.length!==0&&(parts.length<2||parts.length>20)))
   throw Error('D05: divisão requer 0 ou 2 a 20 partes');
  return inTransaction(this.db,()=>{
   const tx=this.db.prepare('SELECT amount_cents FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId);
   if(!tx||tx.amount_cents>=0)throw Error('D05: apenas despesa bancária pode ser dividida');
   const valid=parts.map(part=>{
    ensureObject(part);
    if(!Number.isSafeInteger(part.amount)||part.amount<=0)throw Error('D05: valor da parte inválido');
    return {...this.resolve(part.target),amount:part.amount};
   });
   if(valid.length&&valid.reduce((x,p)=>x+p.amount,0)!==-tx.amount_cents)
     throw Error('D05: soma das partes diferente do valor original');
   this.db.prepare('DELETE FROM bank_transaction_splits WHERE account_id=? AND external_id=?').run(accountId,externalId);
   const add=this.db.prepare(`INSERT INTO bank_transaction_splits
    (account_id,external_id,position,category,amount_cents,category_id,subcategory_id)
     VALUES(?,?,?,?,?,?,?)`);
   valid.forEach((part,i)=>add.run(accountId,externalId,i,part.parentName,part.amount,part.categoryId,part.subcategoryId));
   return {accountId,externalId,parts:valid.map(p=>({categoryId:p.categoryId,subcategoryId:p.subcategoryId,amount:p.amount})),sumCents:valid.reduce((n,p)=>n+p.amount,0)};
  });
 }
 previewRule({id=null,pattern,matchMode='contains',scope='both',priority=100,enabled=true,target}){
  const resolved=this.resolve(target),label=ensureText(pattern,120,'padrão');
  if(!ALLOWED_MATCH.has(matchMode)||!ALLOWED_SCOPE.has(scope)||
    !Number.isInteger(priority)||priority<1||priority>999||typeof enabled!=='boolean')
    throw Error('D05: regra inválida');
  if(id!==null&&(!Number.isSafeInteger(id)||id<1||
    !this.db.prepare('SELECT 1 FROM category_rules WHERE id=?').get(id)))
    throw Error('D05: regra de edição não encontrada');
  const currentRules=this.db.prepare(`SELECT id,pattern,match_mode,category,scope,priority,enabled,
    category_id,subcategory_id FROM category_rules ORDER BY priority,id`).all();
  const banks=this.db.prepare(`SELECT b.rowid,b.account_id,b.external_id,b.description,b.amount_cents,b.status,
    n.nature FROM bank_transactions b LEFT JOIN bank_transaction_notes n
    USING(account_id,external_id) ORDER BY b.account_id,b.external_id`).all();
  const manual=this.db.prepare(`SELECT profile,id,description,kind FROM transactions ORDER BY profile,id`).all();
  const candidate={id:id??Number.MAX_SAFE_INTEGER,pattern:label,matchMode,scope,priority,enabled:enabled?1:0,
    category:resolved.parentName};
  const match=(description,source)=>matchRule(description,source,[candidate])!==null;
  const bankMatches=scope!=='manual'?banks.filter(x=>x.status==='POSTED'&&match(x.description,'bank')):[];
  const manualMatches=scope!=='bank'?manual.filter(x=>match(x.description,'manual')):[];
  const sample=[...bankMatches.slice(0,25).map(x=>({source:'bank',accountId:x.account_id,id:x.external_id})),
    ...manualMatches.slice(0,25).map(x=>({source:'manual',profile:x.profile,id:x.id}))].slice(0,50);
  const basis=[id,label,matchMode,scope,priority,enabled,resolved.categoryId,resolved.subcategoryId,
    currentRules,banks,manual];
  return {contract:'D05/RULE-PREVIEW-V1',previewVersion:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),
    categoryId:resolved.categoryId,subcategoryId:resolved.subcategoryId,candidateMatches:bankMatches.length+manualMatches.length,
    candidateBankMatches:bankMatches.length,candidateManualMatches:manualMatches.length,sample,
    possiblePrecedenceConflicts:currentRules.filter(r=>r.enabled&&r.priority<=priority&&r.id!==id).length,
    changesApplied:false};
 }
 saveRule({id=null,pattern,matchMode='contains',scope='both',priority=100,enabled=true,target,previewVersion}){
  const r=this.resolve(target);const text=ensureText(pattern,120,'padrão');
  if(!ALLOWED_MATCH.has(matchMode)||!ALLOWED_SCOPE.has(scope)||!Number.isInteger(priority)||priority<1||priority>999||typeof enabled!=='boolean')
   throw Error('D05: regra inválida');
  if(!/^[a-f0-9]{64}$/.test(String(previewVersion||'')))throw Error('D05: prévia da regra obrigatória');
  return inTransaction(this.db,()=>{
   const preview=this.previewRule({id,pattern,matchMode,scope,priority,enabled,target});
   if(preview.previewVersion!==previewVersion)throw Error('D05: prévia da regra desatualizada');
   if(id===null){
    const info=this.db.prepare(`INSERT INTO category_rules
     (pattern,match_mode,category,scope,priority,enabled,category_id,subcategory_id) VALUES(?,?,?,?,?,?,?,?)`)
      .run(text,matchMode,r.parentName,scope,priority,enabled?1:0,r.categoryId,r.subcategoryId);
    id=Number(info.lastInsertRowid);
   } else {
    if(!Number.isSafeInteger(id)||id<1)throw Error('D05: ID da regra inválido');
    const info=this.db.prepare(`UPDATE category_rules SET pattern=?,match_mode=?,category=?,scope=?,priority=?,enabled=?,category_id=?,subcategory_id=? WHERE id=?`)
     .run(text,matchMode,r.parentName,scope,priority,enabled?1:0,r.categoryId,r.subcategoryId,id);
    if(info.changes!==1)throw Error('D05: regra inexistente');
   }
   return this.db.prepare(`SELECT id,pattern,match_mode AS matchMode,category_id AS categoryId,
       subcategory_id AS subcategoryId,scope,priority,enabled FROM category_rules WHERE id=?`).get(id);
  });
 }
 assignPlanned({id,target}){
  ensureId(id,'lançamento planejado');
  const r=this.resolve(target);
  return inTransaction(this.db,()=>{
   const out=this.db.prepare('UPDATE planned_items SET category=?,category_id=?,subcategory_id=? WHERE id=?')
     .run(r.parentName,r.categoryId,r.subcategoryId,id);
   if(out.changes!==1)throw Error('D05: lançamento planejado inexistente');
   return {id,categoryId:r.categoryId,subcategoryId:r.subcategoryId};
  });
 }
 // An authoritative, capped read view; do not silently merge manual and bank data.
 bankView({categoryId=null,subcategoryId=undefined,accountId=null,limit=2500}={}){
  if(accountId!==null)ensureId(accountId,'conta');
  if(categoryId!==null)this.resolve({categoryId,subcategoryId:subcategoryId===undefined?null:subcategoryId},{allowInactive:true});
  else if(subcategoryId!==undefined)throw Error('D05: filtro de filho requer pai');
  if(!Number.isInteger(limit)||limit<1||limit>2500)throw Error('D05: limite inválido');
  const overview=this.finance.bankOverview();
  const overrides=new Map(this.db.prepare('SELECT account_id,external_id,category_id,subcategory_id FROM bank_category_overrides').all()
    .map(x=>[JSON.stringify([x.account_id,x.external_id]),x]));
  const ruleRows=this.db.prepare(`SELECT id,pattern,match_mode AS matchMode,category AS category,
    scope,priority,enabled,category_id AS categoryId,subcategory_id AS subcategoryId FROM category_rules
    ORDER BY priority,id`).all();
  const catalog=new Map(this.listCatalog({includeInactive:true}).parents.map(x=>[x.name,x.id]));
  const splitRows=this.db.prepare(`SELECT account_id,external_id,position,category_id,subcategory_id
   FROM bank_transaction_splits ORDER BY account_id,external_id,position`).all();
  const splitMap=new Map();
  for(const row of splitRows){
   const key=JSON.stringify([row.account_id,row.external_id]);
   if(!splitMap.has(key))splitMap.set(key,[]);
   splitMap.get(key).push(row);
  }
  const converted=overview.transactions.map(x=>{
   const override=overrides.get(JSON.stringify([x.accountId,x.id]));
   let categoryKey=null,childId=null;
   if(x.categorySource==='manual'&&override&&override.category_id){
    categoryKey=override.category_id;childId=override.subcategory_id;
   } else if(x.categorySource==='rule'){
    const winning=ruleRows.find(rule=>matchRule(x.description,'bank',[rule],{accountId:x.accountId,rowid:x.rowid,status:x.status,
      nature:x.nature&&x.nature!=='auto'?x.nature:x.amount<0?'expense':'income',hasSplits:x.splits.length>0})===x.category);
    if(winning){categoryKey=winning.categoryId;childId=winning.subcategoryId;}
   }
   const id=categoryKey||catalog.get(x.category)||null;
   const valid=id?this.resolve({categoryId:id,subcategoryId:childId},{allowInactive:true}):null;
   const partIds=splitMap.get(JSON.stringify([x.accountId,x.id]))||[];
   const splitView=x.splits.map((part,i)=>({...part,
     categoryId:partIds[i]?.category_id??catalog.get(part.category)??null,
     subcategoryId:partIds[i]?.subcategory_id??null}));
   return {...x,categoryId:valid?.categoryId??null,subcategoryId:valid?.subcategoryId??null,
     splits:splitView};
  });
  const filtered=converted.filter(x=>(accountId===null||x.accountId===accountId)&&
    (categoryId===null||x.categoryId===categoryId)&&
    (subcategoryId===undefined||x.subcategoryId===subcategoryId));
  return {items:filtered.slice(0,limit),visibleCount:filtered.length,truncated:overview.truncated||filtered.length>limit,
    totalBankCount:overview.totalTransactions,source:'bank',scope:'visible-history',status:'partial' in overview?overview.status:'ok'};
 }
 aggregateManual({profile,categoryId=null}){
  const view=this.listManual({profile,categoryId,limit:2500});
  const groups=new Map();
  for(const row of view.items){
   const key=JSON.stringify([row.categoryId,row.subcategoryId]);
   const x=groups.get(key)||{categoryId:row.categoryId,subcategoryId:row.subcategoryId,incomeCents:0,expenseCents:0,count:0};
   x.count++;x[row.kind==='income'?'incomeCents':'expenseCents']+=row.amount;
   groups.set(key,x);
  }
  return {groups:[...groups.values()],truncated:view.truncated,total:view.total,scope:'manual-only'};
 }
 // Portable manual-profile JSON is distinct from full SQLite bank/sync backups.
 exportManualProfile(profile){
  checkProfile(profile);
  const data=this.finance.load(profile);
  if(!data)throw Error('D05: perfil ainda não inicializado');
  const manualTargets=this.db.prepare(`SELECT t.id,COALESCE(t.category_id,c.id) AS categoryId,
     t.subcategory_id AS subcategoryId FROM transactions t LEFT JOIN categories c ON c.name=t.category COLLATE NOCASE
     WHERE t.profile=? ORDER BY t.id`).all(profile);
  const customParents=this.db.prepare(`SELECT id,name,color,kind,icon_key AS iconKey,hue FROM categories
     WHERE built_in=0 ORDER BY id`).all();
  const customChildren=this.db.prepare(`SELECT id,parent_category_id AS parentCategoryId,name,
    icon_key AS iconKey,hue,active,sort_order AS sortOrder FROM subcategories WHERE built_in=0 ORDER BY id`).all();
  return {contract:'D05/MANUAL-PORTABLE-V1',version:1,profile,scope:'manual-only',
    data,manualTargets,customParents,customChildren};
 }
 restoreManualProfile(profile,snapshot){
  checkProfile(profile);ensureObject(snapshot);
  if(snapshot.contract!=='D05/MANUAL-PORTABLE-V1'||snapshot.version!==1||
   snapshot.profile!==profile||snapshot.scope!=='manual-only'||
   !snapshot.data||!Array.isArray(snapshot.manualTargets)||
   !Array.isArray(snapshot.customParents)||!Array.isArray(snapshot.customChildren)||
   snapshot.customParents.length>200||snapshot.customChildren.length>1000)
    throw Error('D05: backup manual incompatível');
  // This endpoint is a MUTATION. IPC host must verify user intent and a verified pre-restore SQLite backup.
  return inTransaction(this.db,()=>{
   for(const p of snapshot.customParents){
    ensureObject(p);
    const id=ensureId(p.id,'ID pai');
    if(!id.startsWith('cat:custom:'))throw Error('D05: ID personalizado inválido');
    const name=ensureText(p.name,50,'categoria personalizada');
    if(typeof p.color!=='string'||!/^#[a-f0-9]{6}$/i.test(p.color)||
      !['expense','income','both'].includes(p.kind))throw Error('D05: categoria personalizada inválida');
    const existing=this.db.prepare('SELECT id,name FROM categories WHERE id=? OR name=? COLLATE NOCASE').all(id,name);
    if(existing.some(e=>e.id!==id||e.name!==name))throw Error('D05: conflito com categoria existente');
    if(!existing.length)this.db.prepare(`INSERT INTO categories(name,color,built_in,emoji,kind,id,icon_key,hue)
     VALUES(?,?,0,'✨',?,?,?,?)`).run(name,p.color,p.kind,id,
       p.iconKey==null?null:ensureText(p.iconKey,64,'ícone'),
       p.hue==null?null:ensureHue(p.hue));
   }
   for(const c of snapshot.customChildren){
    ensureObject(c);
    const id=ensureId(c.id,'ID filho');
    if(!id.startsWith('sub:custom:'))throw Error('D05: ID de filho personalizado inválido');
    const parent=this.resolve({categoryId:c.parentCategoryId,subcategoryId:null});
    const name=ensureText(c.name,80,'nome do filho'),norm=normalizedName(name);
    const icon=ensureText(c.iconKey,64,'ícone');
    if(!/^[a-z0-9-]+$/.test(icon))throw Error('D05: ícone não permitido');
    const hue=ensureHue(c.hue);
    const existing=this.db.prepare('SELECT id,parent_category_id,name FROM subcategories WHERE id=? OR (parent_category_id=? AND normalized_name=?)')
      .all(id,parent.categoryId,norm);
    if(existing.some(e=>e.id!==id||e.parent_category_id!==parent.categoryId||e.name!==name))
      throw Error('D05: conflito com subcategoria existente');
    if(!existing.length)this.db.prepare(`INSERT INTO subcategories
      (id,parent_category_id,name,normalized_name,icon_key,hue,kind,active,built_in,sort_order)
      VALUES(?,?,?,?,?,?,?, ?,0,?)`).run(id,parent.categoryId,name,norm,icon,hue,parent.parent.kind,c.active===0?0:1,
         Number.isSafeInteger(c.sortOrder)&&c.sortOrder>=0?c.sortOrder:0);
   }
   // FinanceDB.save executes inside this transaction, preserving its old link & profile guards.
   const out=this.finance.save(profile,snapshot.data,{inTransaction:true});
   const targets=new Map();
   if(snapshot.manualTargets.length!==snapshot.data.transactions.length)
    throw Error('D05: mapa de IDs de backup incompleto');
   for(const t of snapshot.manualTargets){
    ensureObject(t);const id=ensureId(t.id,'ID de transação');
    if(targets.has(id))throw Error('D05: ID duplicado no backup');
    targets.set(id,t);
   }
   for(const tx of snapshot.data.transactions){
    const id=ensureId(tx.id,'movimento'),t=targets.get(id);
    if(!t)throw Error('D05: movimentação ausente no mapa do backup');
    if(t.categoryId!==null&&t.categoryId!==undefined){
     const dest=this.resolve({categoryId:t.categoryId,subcategoryId:t.subcategoryId??null},{allowInactive:true});
     if(dest.parentName!==tx.category)throw Error('D05: categoria de backup divergente');
     this.db.prepare(`UPDATE transactions SET category_id=?,subcategory_id=? WHERE profile=? AND id=?`)
      .run(dest.categoryId,dest.subcategoryId,profile,id);
    }else if(t.subcategoryId!==null&&t.subcategoryId!==undefined)
      throw Error('D05: filho sem pai no backup');
   }
   if(this.db.prepare('PRAGMA foreign_key_check').all().length)
     throw Error('D05: backup com vínculos inválidos');
   return {contract:'D05/MANUAL-PORTABLE-V1',profile,restored:out.txCount,changesApplied:true};
  });
 }
 asReadOnlyFacade({authorize}={}){
  // The host must verify the ACTUAL owner/session/consent. Renderer/model args are never authority.
  if(typeof authorize!=='function')throw Error('D05: autorizador de leitura obrigatório');
  const checked=(scope,run)=>{
   if(authorize(scope)!==true)throw Error('D05: acesso não autorizado');
   return run();
  };
  return Object.freeze({
   list:()=>checked({capability:'taxonomy'},()=>this.listCatalog()),
   resolve:target=>checked({capability:'taxonomy'},()=>this.resolve(target)),
   manual:args=>checked({capability:'manual',profile:args?.profile},()=>this.listManual(args)),
   bank:args=>checked({capability:'bank',accountId:args?.accountId??null},()=>this.bankView(args)),
   aggregate:args=>checked({capability:'manual',profile:args?.profile},()=>this.aggregateManual(args)),
   previewBankBatch:args=>checked({capability:'bank',accountIds:args?.items?.map(x=>x.accountId)},()=>this.previewBankBatch(args))
  });
 }
}
module.exports={D05CategoryService};
