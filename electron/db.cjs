'use strict';
/* Persistência local com node:sqlite (incluído no Node 24 do Electron 45).
   Todos os valores monetários são inteiros em centavos. */
const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { migrateHierarchy } = require('./d05-hierarchy.cjs');
const DEFAULT_CATEGORIES = [
  ['Moradia','#3e9a85'],['Alimentação','#d6934b'],['Transporte','#4489ba'],
  ['Saúde','#cb6d76'],['Lazer','#2aa898'],['Educação','#4c7fb2'],
  ['Assinaturas','#718096'],['Compras','#b5874f'],['Contas','#5d86a1'],
  ['Outros','#87929c'],['Salário','#279c72'],
  ['Transferências','#538faf'],['Rendimentos','#40ac89'],['Reembolsos','#55a6b0']
];
const CAT = DEFAULT_CATEGORIES.map(([name])=>name);
const DEFAULT_EMOJIS = Object.freeze({
  'Moradia':'🏠','Alimentação':'🍽️','Transporte':'🚗','Saúde':'💊',
  'Lazer':'🎮','Educação':'📚','Assinaturas':'📱','Compras':'🛍️',
  'Contas':'🧾','Outros':'✨','Salário':'💰',
  'Transferências':'🏦','Rendimentos':'📈','Reembolsos':'💸'
});
const ALLOWED_EMOJIS = Object.freeze([
  '🏠','🏡','🔑','🪴','🍽️','🍔','🍕','🥗','🥑','☕','🍿','🛒','🛍️',
  '🚗','🚕','🚌','🚲','⛽','✈️','🧳','💊','🩺','💅','🧴','🧘',
  '🎮','🎬','🎵','🎧','📚','🎓','💻','📱','📺','📷','🎨','🎟️',
  '⚽','🏋️','🏆','🐶','🐱','🐾','💰','💸','💳','🏦','📈','🪙',
  '🧾','💡','⚡','💧','📦','🎁','❤️','🌸','🌿','⭐','✨','🎯','🔧'
]);
function categoryEmoji(emoji,existing='✨') {
  const value=emoji==null ? existing : String(emoji);
  if(!ALLOWED_EMOJIS.includes(value))throw new Error('Escolha um dos emojis disponíveis.');
  return value;
}

function normalizeLabel(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR').replace(/\s+/g,' ').trim();
}
function categoryDecisionFingerprint(row){
 const nature=row.nature&&row.nature!=='auto'?row.nature:row.amount<0?'expense':'income';
 return require('node:crypto').createHash('sha256').update(JSON.stringify([row.accountId,row.externalId||row.id,row.date,row.description,row.amount,row.status,nature,row.overrideCategory])).digest('hex');
}
function effectiveBankOverride(row,label){
 return label&&(!label.category||label.category===row.overrideCategory)&&label.fingerprint!==categoryDecisionFingerprint(row)?null:row.overrideCategory;
}
function categoryName(name){
  const value=String(name||'').trim();
  if(!value||value.length>50||/[\x00-\x1f<>]/.test(value))throw new Error('Informe uma categoria de até 50 caracteres.');
  return value;
}
function categoryKind(value){
  if(!['expense','income','both'].includes(value))throw new Error('Tipo de categoria inválido.');
  return value;
}
function categoryColor(color){
  if(typeof color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(color))throw new Error('Cor da categoria inválida.');
  return color.toLowerCase();
}
function matchRule(description,scope,rules,context={}){
  const hay=normalizeLabel(description);
  for(const rule of rules){
    if(rule.enabled===0)continue;
    if(rule.scope!=='both'&&rule.scope!==scope)continue;
    // Supervised rules use this same matcher. Missing context fails closed.
    if(rule.constraint){
      const c=rule.constraint;
      if(scope!=='bank'||context.accountId!==c.accountId||context.nature!==c.nature||
        !Number.isInteger(context.rowid)||context.rowid<=c.afterRowid||context.status!=='POSTED'||context.hasSplits)continue;
    }
    const needle=normalizeLabel(rule.pattern);
    if(!needle)continue;
    if((rule.matchMode==='exact'&&hay===needle)||
      (rule.matchMode==='starts'&&hay.startsWith(needle))||
      (rule.matchMode==='contains'&&hay.includes(needle))) return rule.category;
  }
  return null;
}
// Categorias originais da instituição (em inglês) são mapeadas sem modificar o extrato bruto.
// Categoria Transferências não equivale à natureza financeira transfer: um Pix a terceiro
// permanece como receita/despesa até confirmação explícita de movimentação entre contas próprias.
const BANK_PROVIDER_CATEGORIES = Object.freeze({
 'Groceries':'Alimentação','Food delivery':'Alimentação','Eating out':'Alimentação',
 'Shopping':'Compras','Electronics':'Compras','Clothing':'Compras',
 'Salary':'Salário','Pharmacy':'Saúde','Healthcare':'Saúde','Health insurance':'Saúde',
 'Gas stations':'Transporte','Transportation':'Transporte','Vehicle maintenance':'Transporte',
 'Taxi and ride-hailing':'Transporte','Parking':'Transporte','Automotive':'Transporte',
 'Digital services':'Assinaturas','Electricity':'Contas','Tickets':'Lazer',
 'Proceeds interests and dividends':'Rendimentos',
 'Same person transfer':'Transferências','Transfer - PIX':'Transferências','Transfers':'Transferências'
});
function providerCategory(original,categories){
 const translated=BANK_PROVIDER_CATEGORIES[String(original||'')];
 return translated&&categories.has(translated)?translated:(categories.has(original)?original:'Outros');
}
const KEYS = ['opening','income','fixed','existing','reserve'];
const NATURES = ['auto','income','expense','transfer','ignore'];
function simpleText(value,max=180){
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error('Texto inválido.');
  return value.trim();
}
function bankKey(input){
  const accountId=String(input?.accountId||''),externalId=String(input?.externalId||'');
  if(!accountId||!externalId||accountId.length>150||externalId.length>150)throw new Error('Movimentação inválida.');
  return {accountId,externalId};
}

function isCents(n, allowNegative = false) {
  return Number.isSafeInteger(n) && n <= 100_000_000_000 && (allowNegative ? n >= -100_000_000_000 : n >= 0);
}
function validate(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.transactions) ||
      !payload.budgets || !payload.settings || payload.transactions.length > 30000) throw new Error('Estrutura de dados inválida.');
  const transactions = payload.transactions.map(t => {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || t.id.length < 1 || t.id.length > 120 ||
        typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
        Number.isNaN(Date.parse(t.date + 'T00:00:00Z')) ||
        !['income','expense'].includes(t.kind) || !isCents(t.amount) || t.amount === 0 ||
        typeof t.description !== 'string' || !t.description.trim() || t.description.length > 180 ||
        typeof t.category !== 'string' || !t.category.trim() || t.category.length > 70) throw new Error('Lançamento inválido.');
    return {id:t.id,date:t.date,kind:t.kind,amount:t.amount,description:t.description,category:t.category,origin:String(t.origin||'manual').slice(0,40)};
  });
  if (new Set(transactions.map(t=>t.id)).size !== transactions.length) throw new Error('Identificadores duplicados.');
  const budgets = {};
  if(Object.keys(payload.budgets).length>200) throw new Error('Muitas categorias no orçamento.');
  for(const [raw,value] of Object.entries(payload.budgets)){
    const cat=categoryName(raw);
    if(!isCents(value))throw new Error('Orçamento inválido: '+cat);
    budgets[cat]=value;
  }
  const settings={};
  for(const k of KEYS){const value=payload.settings[k] ?? 0;if(!isCents(value,k==='opening'))throw new Error('Configuração inválida: '+k);settings[k]=value;}
  return {version:5, transactions, budgets, settings};
}
function checkProfile(profile){if(profile!=='real'&&profile!=='demo') throw new Error('Perfil inválido');return profile;}
class FinanceDB {
 constructor(filename){
   // Capture the original pre-migration state for on-disk legacy databases.
   const existingFile = filename && filename !== ':memory:' && path.resolve(filename);
   const hadLegacyFile = Boolean(existingFile && fs.existsSync(existingFile) && fs.statSync(existingFile).size > 0);
   if (!filename || filename === ':memory:') { this.filename = filename || ':memory:'; }
   else { this.filename=path.resolve(filename); fs.mkdirSync(path.dirname(this.filename),{recursive:true,mode:0o700}); }
   this.db = new DatabaseSync(this.filename);
   this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
   this.db.exec(`
     CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
     CREATE TABLE IF NOT EXISTS profiles (
       profile TEXT PRIMARY KEY CHECK(profile IN ('real','demo')),
       initialized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE IF NOT EXISTS transactions (
       profile TEXT NOT NULL REFERENCES profiles(profile) ON DELETE CASCADE,
       id TEXT NOT NULL,
       date TEXT NOT NULL,
       description TEXT NOT NULL,
       kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
       amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
       category TEXT NOT NULL,
       origin TEXT NOT NULL,
       PRIMARY KEY(profile,id)
     );
     CREATE INDEX IF NOT EXISTS idx_tx_profile_date ON transactions(profile,date);
     CREATE TABLE IF NOT EXISTS budgets (
       profile TEXT NOT NULL REFERENCES profiles(profile) ON DELETE CASCADE,
       category TEXT NOT NULL,
       amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
       PRIMARY KEY(profile,category)
     );
     CREATE TABLE IF NOT EXISTS financial_settings (
       profile TEXT NOT NULL REFERENCES profiles(profile) ON DELETE CASCADE,
       name TEXT NOT NULL,
       value_cents INTEGER NOT NULL,
       PRIMARY KEY(profile,name)
     );
   `);
   // v0.5: tabelas aditivas, preservando integralmente os dados da v0.4.
   this.db.exec(`
     CREATE TABLE IF NOT EXISTS bank_items (
       item_id TEXT PRIMARY KEY,
       institution TEXT NOT NULL DEFAULT 'Meu Pluggy',
       status TEXT NOT NULL DEFAULT 'UNKNOWN',
       consent_expires_at TEXT,
       last_sync_at TEXT
     );
     CREATE TABLE IF NOT EXISTS bank_accounts (
       account_id TEXT PRIMARY KEY,
       item_id TEXT NOT NULL REFERENCES bank_items(item_id),
       name TEXT NOT NULL,
       subtype TEXT,
       currency TEXT NOT NULL DEFAULT 'BRL',
       balance_cents INTEGER,
       updated_at TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS bank_transactions (
       account_id TEXT NOT NULL REFERENCES bank_accounts(account_id),
       external_id TEXT NOT NULL,
       date TEXT NOT NULL,
       description TEXT NOT NULL,
       amount_cents INTEGER NOT NULL,
       status TEXT NOT NULL,
       category TEXT NOT NULL DEFAULT 'Outros',
       updated_at TEXT NOT NULL,
       PRIMARY KEY (account_id,external_id)
     );
     CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date);
     CREATE TABLE IF NOT EXISTS bank_sync_history (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       item_id TEXT NOT NULL,
       completed_at TEXT NOT NULL,
       new_count INTEGER NOT NULL,
       total_count INTEGER NOT NULL
     );
   `);
   // v0.6: categorias/regras são aditivas. Os extratos originais da Pluggy nunca são editados.
   this.db.exec(`
     CREATE TABLE IF NOT EXISTS categories (
       name TEXT PRIMARY KEY COLLATE NOCASE,
       color TEXT NOT NULL,
       built_in INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE IF NOT EXISTS category_rules (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       pattern TEXT NOT NULL,
       match_mode TEXT NOT NULL CHECK(match_mode IN ('contains','starts','exact')),
       category TEXT NOT NULL REFERENCES categories(name) ON UPDATE CASCADE ON DELETE RESTRICT,
       scope TEXT NOT NULL CHECK(scope IN ('both','bank','manual')),
       priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 999),
       enabled INTEGER NOT NULL DEFAULT 1
     );
     CREATE TABLE IF NOT EXISTS bank_category_overrides (
       account_id TEXT NOT NULL,
       external_id TEXT NOT NULL,
       category TEXT NOT NULL REFERENCES categories(name) ON UPDATE CASCADE ON DELETE RESTRICT,
       PRIMARY KEY(account_id,external_id),
       FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
     );
   `);
   // v0.7: edições e conciliações pessoais, sem tocar no extrato original.
   this.db.exec(`
     CREATE TABLE IF NOT EXISTS bank_transaction_notes (
       account_id TEXT NOT NULL,
       external_id TEXT NOT NULL,
       merchant TEXT NOT NULL DEFAULT '',
       note TEXT NOT NULL DEFAULT '',
       nature TEXT NOT NULL DEFAULT 'auto' CHECK(nature IN ('auto','income','expense','transfer','ignore')),
       reviewed_at TEXT,
       PRIMARY KEY(account_id,external_id),
       FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS bank_transaction_splits (
       account_id TEXT NOT NULL,
       external_id TEXT NOT NULL,
       position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 19),
       category TEXT NOT NULL REFERENCES categories(name) ON UPDATE CASCADE ON DELETE RESTRICT,
       amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
       PRIMARY KEY(account_id,external_id,position),
       FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS bank_manual_links (
       account_id TEXT NOT NULL,
       external_id TEXT NOT NULL,
       manual_id TEXT NOT NULL UNIQUE,
       linked_at TEXT NOT NULL,
       PRIMARY KEY(account_id,external_id),
       FOREIGN KEY(account_id,external_id) REFERENCES bank_transactions(account_id,external_id) ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS merchant_aliases (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       pattern TEXT NOT NULL,
       display_name TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
      CREATE TABLE IF NOT EXISTS bank_duplicate_dismissals (
        pair_key TEXT PRIMARY KEY, dismissed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bank_tx_amount_date ON bank_transactions(amount_cents,date);

   `);
   // Migração aditiva: preserva dados, regras e categorias já cadastradas.
   const columns=this.db.prepare('PRAGMA table_info(categories)').all().map(x=>x.name);
   if(!columns.includes('emoji')){
     this.db.exec("ALTER TABLE categories ADD COLUMN emoji TEXT NOT NULL DEFAULT '✨'");
     const updateOld=this.db.prepare('UPDATE categories SET emoji=? WHERE name=?');
     for(const [name] of DEFAULT_CATEGORIES)updateOld.run(DEFAULT_EMOJIS[name]||'✨',name);
   }
   // v0.9.4: tipo de categoria é APENAS um agrupamento visual; não converte Pix em
   // transferências próprias nem altera a natureza dos movimentos originais.
   if(!columns.includes('kind')){
     this.db.exec("ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense','income','both'))");
     this.db.prepare("UPDATE categories SET kind='income' WHERE name IN ('Salário','Rendimentos','Reembolsos')").run();
     this.db.prepare("UPDATE categories SET kind='both' WHERE name IN ('Transferências','Outros')").run();
   }
   const seed=this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in,emoji) VALUES (?,?,1,?)');
   for(const [name,color] of DEFAULT_CATEGORIES)seed.run(name,color,DEFAULT_EMOJIS[name]||'✨');
   this.db.prepare("UPDATE categories SET kind='income' WHERE name IN ('Salário','Rendimentos','Reembolsos') AND kind='expense'").run();
   this.db.prepare("UPDATE categories SET kind='both' WHERE name IN ('Transferências','Outros') AND kind='expense'").run();
   // Compatibilidade: categorias pré-existentes em lançamentos manuais e orçamentos.
   const legacy=this.db.prepare(`SELECT category AS name FROM transactions UNION SELECT category AS name FROM budgets`);
   for(const {name} of legacy.all()){
     if(typeof name==='string'&&name.trim()&&name.length<=50)
       this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in) VALUES (?, ?,0)').run(name,'#87929c');
   }
   this.db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES (?,?)').run('schema_version','1');
   // Os zeros de versões antigas eram criados por padrão e significavam 'sem limite'.
   // Uma nova edição explícita para zero, a partir desta versão, permanece distinta.
   if(!this.db.prepare("SELECT 1 FROM app_meta WHERE key='budget_zero_migration_094'").get()){
     this.db.prepare('DELETE FROM budgets WHERE amount_cents=0').run();
     this.db.prepare("INSERT INTO app_meta(key,value) VALUES('budget_zero_migration_094','done')").run();
   }
   this.db.prepare('UPDATE app_meta SET value=? WHERE key=?').run('6','schema_version');
   if (!this.db.prepare("SELECT 1 FROM app_meta WHERE key='d05_hierarchy_e1'").get() && hadLegacyFile) {
     const rescuePath = this.filename + '.d05-before-v7.sqlite';
     if (!fs.existsSync(rescuePath)) {
       // VACUUM INTO includes committed WAL changes. Never overwrite a rescue copy.
       this.db.prepare('VACUUM INTO ?').run(rescuePath);
       try { fs.chmodSync(rescuePath, 0o600); } catch (_) { /* Windows ACL is authoritative */ }
     }
   }
   migrateHierarchy(this.db);
 }
 load(profile){
   checkProfile(profile);
   if(!this.db.prepare('SELECT 1 FROM profiles WHERE profile=?').get(profile))return null;
   const budgets={};
   for(const r of this.db.prepare('SELECT category, amount_cents FROM budgets WHERE profile=?').all(profile))budgets[r.category]=r.amount_cents;
   const settings={opening:0,income:0,fixed:0,existing:0,reserve:0};
   for(const r of this.db.prepare('SELECT name, value_cents FROM financial_settings WHERE profile=?').all(profile))if(KEYS.includes(r.name))settings[r.name]=r.value_cents;
   const transactions=this.db.prepare('SELECT id,date,description,kind,amount_cents AS amount,category,origin FROM transactions WHERE profile=? ORDER BY date,id').all(profile).map(x=>({...x}));
   return {version:5,transactions,budgets,settings};
 }
 /** Guard against stale renderer snapshots; this checks authoritative SQLite links.
  * Called within BEGIN IMMEDIATE before replacing manual rows.
  */
 assertLinkedManualChangesAllowed(incoming){
   const nextById=new Map(incoming.map(t=>[t.id,t]));
   const linked=this.db.prepare(`
     SELECT t.id,t.date,t.kind,t.amount_cents AS amount
     FROM bank_manual_links l
     JOIN transactions t ON t.profile='real' AND t.id=l.manual_id
   `).all();
   for(const prior of linked){
     const next=nextById.get(prior.id);
     if(!next || next.date!==prior.date || next.amount!==prior.amount || next.kind!==prior.kind){
       throw new Error('Lançamento vinculado a movimentação bancária. Desvincule antes de alterar data, valor, tipo ou excluir.');
     }
   }
 }
 save(profile,payload,{inTransaction=false}={}){
   checkProfile(profile);const value=validate(payload);
   if(inTransaction && !this.db.isTransaction)throw new Error('Transação externa ausente.');
   if(!inTransaction && this.db.isTransaction)throw new Error('Transação inesperada.');
   if(!inTransaction)this.db.exec('BEGIN IMMEDIATE');
   try{
     // Verify authoritative bank links BEFORE deleting local rows.
     if(profile==='real')this.assertLinkedManualChangesAllowed(value.transactions);
     // A legacy flat renderer must never silently erase existing D05 child links.
     const oldCategoryLinks = new Map(this.db.prepare(
       'SELECT id,category,category_id,subcategory_id FROM transactions WHERE profile=?'
     ).all(profile).map(row => [row.id,row]));
     this.db.prepare('INSERT OR IGNORE INTO profiles(profile) VALUES (?)').run(profile);
     this.db.prepare('DELETE FROM transactions WHERE profile=?').run(profile);
     this.db.prepare('DELETE FROM budgets WHERE profile=?').run(profile);
     this.db.prepare('DELETE FROM financial_settings WHERE profile=?').run(profile);
     // Ao restaurar JSON legado, preserve categorias presentes mesmo sem cadastro prévio.
     const existingCategories=new Set(this.listCategories().categories.map(x=>x.name));
     for(const name of new Set([...value.transactions.map(t=>t.category),...Object.keys(value.budgets)])){
       if(!existingCategories.has(name)){
         this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in) VALUES (?, ?,0)').run(categoryName(name),'#87929c');
         existingCategories.add(name);
       }
     }
     const addTx=this.db.prepare('INSERT INTO transactions (profile,id,date,description,kind,amount_cents,category,origin,category_id,subcategory_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
     for(const t of value.transactions) {
       const prior=oldCategoryLinks.get(t.id);
       const keep=prior && prior.category===t.category ? prior : null;
       addTx.run(profile,t.id,t.date,t.description,t.kind,t.amount,t.category,t.origin,
         keep?.category_id ?? null, keep?.subcategory_id ?? null);
     }
     const addBudget=this.db.prepare('INSERT INTO budgets(profile,category,amount_cents) VALUES(?,?,?)');
     const allowed=new Set(this.listCategories().categories.map(x=>x.name));
     for(const [name,amount] of Object.entries(value.budgets)){
       if(!allowed.has(name))throw new Error('Categoria de orçamento desconhecida: '+name);
       addBudget.run(profile,name,amount);
     }
     const addSetting=this.db.prepare('INSERT INTO financial_settings(profile,name,value_cents) VALUES (?,?,?)');
     for(const [name,amount] of Object.entries(value.settings))addSetting.run(profile,name,amount);
     if(profile==='real')this.pruneInvalidManualLinks();
     if(!inTransaction)this.db.exec('COMMIT');
     return {ok:true,txCount:value.transactions.length};
   }catch(err){if(!inTransaction)this.db.exec('ROLLBACK');throw err;}
 }
 listCategories(){
   const categories=this.db.prepare('SELECT name,color,emoji,kind,built_in AS builtIn FROM categories ORDER BY built_in DESC,name COLLATE NOCASE').all().map(x=>({...x}));
   const rules=this.db.prepare('SELECT id,pattern,match_mode AS matchMode,category,scope,priority,enabled FROM category_rules ORDER BY priority ASC,id ASC').all().map(x=>({...x}));
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_rule_constraints'").get()){
     const constraints=new Map(this.db.prepare('SELECT rule_id,account_id AS accountId,nature,after_rowid AS afterRowid FROM category_rule_constraints').all().map(x=>[x.rule_id,{accountId:x.accountId,nature:x.nature,afterRowid:x.afterRowid}]));
     for(const rule of rules)if(constraints.has(rule.id))rule.constraint=constraints.get(rule.id);
   }
   return {categories,rules};
 }
 upsertCategory({previousName,name,color,emoji,kind}){
   const label=categoryName(name), hex=categoryColor(color), previous=String(previousName||'').trim();
   this.db.exec('BEGIN IMMEDIATE');
   try{
     if(previous){
       const row=this.db.prepare('SELECT name,built_in FROM categories WHERE name=?').get(previous);
       if(!row)throw new Error('Categoria não encontrada.');
       if(row.built_in&&row.name!==label)throw new Error('Categorias padrão podem mudar de cor, mas não de nome.');
       const clash=this.db.prepare('SELECT name FROM categories WHERE name=? COLLATE NOCASE').get(label);
       if(clash&&clash.name.toLowerCase()!==row.name.toLowerCase())throw new Error('Já existe uma categoria com esse nome.');
       const icon=categoryEmoji(emoji,this.db.prepare('SELECT emoji FROM categories WHERE name=?').get(row.name)?.emoji||'✨');
       const previousKind=this.db.prepare('SELECT kind FROM categories WHERE name=?').get(row.name).kind;
       const chosenKind=kind===undefined?previousKind:categoryKind(kind);
       if(row.built_in&&chosenKind!==previousKind)throw new Error('O tipo das categorias padrão não pode ser alterado.');
       if(row.name!==label){
         this.db.prepare('UPDATE categories SET name=?,color=?,emoji=?,kind=? WHERE name=?').run(label,hex,icon,chosenKind,row.name);
         this.db.prepare('UPDATE transactions SET category=? WHERE category=?').run(label,row.name);
         this.db.prepare('UPDATE budgets SET category=? WHERE category=?').run(label,row.name);
         if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_items'").get())this.db.prepare('UPDATE planned_items SET category=? WHERE category=?').run(label,row.name);
       }else this.db.prepare('UPDATE categories SET color=?,emoji=?,kind=? WHERE name=?').run(hex,icon,chosenKind,row.name);
     }else{
       if(this.db.prepare('SELECT 1 FROM categories WHERE name=? COLLATE NOCASE').get(label))throw new Error('Já existe uma categoria com esse nome.');
       this.db.prepare('INSERT INTO categories(name,color,built_in,emoji,kind) VALUES(?,?,0,?,?)').run(label,hex,categoryEmoji(emoji),categoryKind(kind||'expense'));
     }
     this.db.exec('COMMIT');return this.listCategories();
   }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 deleteCategory(name){
   const row=this.db.prepare('SELECT name,built_in FROM categories WHERE name=?').get(name);
   if(!row)throw new Error('Categoria não encontrada.');
   if(row.built_in)throw new Error('Categorias padrão não podem ser excluídas.');
   const usages=[
     this.db.prepare('SELECT 1 FROM transactions WHERE category=? LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM budgets WHERE category=? LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM category_rules WHERE category=? LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM bank_category_overrides WHERE category=? LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM bank_transaction_splits WHERE category=? LIMIT 1').get(row.name),
     ...(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_items'").get()?[this.db.prepare('SELECT 1 FROM planned_items WHERE category=? LIMIT 1').get(row.name)]:[])
   ];
   if(usages.some(Boolean))throw new Error('Categoria em uso. Reclassifique os lançamentos, ajuste o orçamento e remova as regras antes de excluir.');
   this.db.exec('BEGIN IMMEDIATE');
   try{this.db.prepare('DELETE FROM budgets WHERE category=?').run(row.name);this.db.prepare('DELETE FROM categories WHERE name=?').run(row.name);this.db.exec('COMMIT');return this.listCategories();}
   catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 upsertRule(input){
   const pattern=String(input?.pattern||'').trim();
   const category=String(input?.category||'').trim();
   const matchMode=String(input?.matchMode||'contains');
   const scope=String(input?.scope||'both');
   const priority=Number(input?.priority ?? 100);
   if(!pattern||pattern.length>120||/[\x00-\x1f]/.test(pattern))throw new Error('Informe um texto de identificação de até 120 caracteres.');
   if(!['contains','starts','exact'].includes(matchMode)||!['both','bank','manual'].includes(scope))throw new Error('Tipo de regra inválido.');
   if(!Number.isInteger(priority)||priority<1||priority>999)throw new Error('Prioridade deve estar entre 1 e 999.');
   if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(category))throw new Error('Categoria da regra não existe.');
   if(input?.id!=null){
     const id=Number(input.id);
     if(!Number.isInteger(id)||id<=0||!this.db.prepare('SELECT 1 FROM category_rules WHERE id=?').get(id))throw new Error('Regra não encontrada.');
     this.db.prepare(`UPDATE category_rules SET pattern=?,match_mode=?,category=?,scope=?,priority=?,
      category_id=CASE WHEN category=? THEN category_id ELSE NULL END,
      subcategory_id=CASE WHEN category=? THEN subcategory_id ELSE NULL END WHERE id=?`)
       .run(pattern,matchMode,category,scope,priority,category,category,id);
   }else this.db.prepare('INSERT INTO category_rules(pattern,match_mode,category,scope,priority) VALUES(?,?,?,?,?)').run(pattern,matchMode,category,scope,priority);
   return this.listCategories();
 }
 deleteRule(id){
   const n=Number(id);if(!Number.isInteger(n)||n<=0)throw new Error('Regra inválida.');
   this.db.prepare('DELETE FROM category_rules WHERE id=?').run(n);
   return this.listCategories();
 }
 overrideBankCategory({accountId,externalId,category}){
   if(typeof accountId!=='string'||typeof externalId!=='string'||!accountId||!externalId)throw new Error('Movimentação bancária inválida.');
   if(!this.db.prepare('SELECT 1 FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId))throw new Error('Movimentação não encontrada.');
   if(category===null){
     this.db.prepare('DELETE FROM bank_category_overrides WHERE account_id=? AND external_id=?').run(accountId,externalId);
   }else{
     const name=categoryName(category);
     if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(name))throw new Error('Categoria inexistente.');
     this.db.prepare(`INSERT INTO bank_category_overrides(account_id,external_id,category) VALUES(?,?,?)
      ON CONFLICT(account_id,external_id) DO UPDATE SET
      category_id=CASE WHEN category=excluded.category THEN category_id ELSE NULL END,
      subcategory_id=CASE WHEN category=excluded.category THEN subcategory_id ELSE NULL END,
      category=excluded.category`).run(accountId,externalId,name);
   }
   // An explicit human correction supersedes supervised provenance, including
   // when the user deliberately chooses the same category again.
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get())this.db.prepare('DELETE FROM category_review_applied_labels WHERE account_id=? AND external_id=?').run(accountId,externalId);
   return this.bankOverview();
 }
 // Importação de sugestões de categorias: validação estrita, idempotência e operação atômica.
 // O arquivo só contém IDs e fingerprints, nunca Client Secret / dados de autenticação.
 importCategoryPack(input){
   if(!input||input.format!=='meu-financeiro-categorias-v1'||!Array.isArray(input.rules)||!Array.isArray(input.decisions)||input.rules.length>100||input.decisions.length>10000)
      throw new Error('Pacote de categorias inválido.');
   const {createHash}=require('node:crypto');
   const existingRules=new Set(this.listCategories().rules.map(x=>[normalizeLabel(x.pattern),x.matchMode,x.category,x.scope].join('|')));
   const possibleRules=[];
   for(const rule of input.rules){
     const pattern=String(rule.pattern||'').trim(),category=categoryName(rule.category),matchMode=String(rule.matchMode||'contains'),scope='bank',priority=Number(rule.priority);
     if(!pattern||pattern.length>120||/[\x00-\x1f]/.test(pattern)||!['contains','starts','exact'].includes(matchMode)||!Number.isInteger(priority)||priority<1||priority>999)
       throw new Error('Regra sugerida inválida.');
     if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(category))throw new Error('Categoria não encontrada: '+category);
     const key=[normalizeLabel(pattern),matchMode,category,scope].join('|');
     if(existingRules.has(key))continue;
     existingRules.add(key);possibleRules.push({pattern,matchMode,category,scope,priority});
   }
   const decisions=[];
   const known=new Set();
   for(const entry of input.decisions){
     const {accountId,externalId}=bankKey(entry);const category=categoryName(entry.category);
     if(entry.confidence!=='alta'||!/^[a-f0-9]{64}$/i.test(String(entry.fingerprint||'')))throw new Error('Decisão individual inválida.');
     if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(category))throw new Error('Categoria não encontrada: '+category);
     const key=accountId+'|'+externalId;if(known.has(key))throw new Error('Decisão duplicada.');known.add(key);
     const row=this.db.prepare('SELECT description,amount_cents FROM bank_transactions WHERE account_id=? AND external_id=?').get(accountId,externalId);
     if(!row)continue; // Histórico pode ter evoluído desde a geração do pacote.
     const fingerprint=createHash('sha256').update(row.description+'|'+row.amount_cents).digest('hex');
     if(fingerprint!==entry.fingerprint)continue; // Mudança no banco: não aplica classificação antiga.
     const override=this.db.prepare('SELECT 1 FROM bank_category_overrides WHERE account_id=? AND external_id=?').get(accountId,externalId);
     if(!override)decisions.push({accountId,externalId,category});
   }
   this.db.exec('BEGIN IMMEDIATE');
   try{
     const insertRule=this.db.prepare('INSERT INTO category_rules(pattern,match_mode,category,scope,priority,enabled) VALUES(?,?,?,?,?,1)');
     for(const rule of possibleRules)insertRule.run(rule.pattern,rule.matchMode,rule.category,rule.scope,rule.priority);
     const insertOverride=this.db.prepare('INSERT OR IGNORE INTO bank_category_overrides(account_id,external_id,category) VALUES(?,?,?)');
     for(const entry of decisions)insertOverride.run(entry.accountId,entry.externalId,entry.category);
     this.db.exec('COMMIT');
     return {rulesAdded:possibleRules.length,overridesAdded:decisions.length,checked:input.decisions.length,missingOrChanged:input.decisions.length-decisions.length};
   }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 // User-controlled metadata never modifies data imported from a financial institution.
 getBankTransaction({accountId,externalId}){
   const key=bankKey({accountId,externalId});
   const row=this.db.prepare('SELECT date,amount_cents AS amount,status,description FROM bank_transactions WHERE account_id=? AND external_id=?').get(key.accountId,key.externalId);
   if(!row)throw new Error('Movimentação não encontrada.');
   return {...key,...row};
 }
 editBankTransaction(input){
   const key=bankKey(input);this.getBankTransaction(key);
   const merchant=simpleText(input.merchant||'',100);
   const note=simpleText(input.note||'',600);
   const nature=String(input.nature||'auto');
   if(!NATURES.includes(nature))throw new Error('Natureza de movimentação inválida.');
   const current=this.db.prepare('SELECT reviewed_at FROM bank_transaction_notes WHERE account_id=? AND external_id=?').get(key.accountId,key.externalId);
   const reviewedAt=typeof input.reviewed==='boolean'?(input.reviewed?new Date().toISOString():null):(current?.reviewed_at||null);
   this.db.prepare(`INSERT INTO bank_transaction_notes(account_id,external_id,merchant,note,nature,reviewed_at)
     VALUES (?,?,?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET
       merchant=excluded.merchant,note=excluded.note,nature=excluded.nature,reviewed_at=excluded.reviewed_at`).run(key.accountId,key.externalId,merchant,note,nature,reviewedAt);
   return this.bankOverview();
 }
 batchBankChanges(input,{inTransaction=false}={}){
   const items=input?.items;
   if(!Array.isArray(items)||!items.length||items.length>100)throw new Error('Selecione entre 1 e 100 movimentações.');
   const category=input?.category==null?null:categoryName(input.category);
   const reviewed=input?.reviewed;
   const nature=input?.nature==null?null:String(input.nature);
   if(category===null&&typeof reviewed!=='boolean'&&nature===null)throw new Error('Nenhuma alteração selecionada.');
   if(nature!==null&&!NATURES.includes(nature))throw new Error('Natureza inválida.');
   if(category!==null&&!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(category))throw new Error('Categoria inválida.');
   const keys=items.map(bankKey);
   if(new Set(keys.map(x=>x.accountId+'|'+x.externalId)).size!==keys.length)throw new Error('Movimentação duplicada na seleção.');
   if(inTransaction&&!this.db.isTransaction)throw new Error('Transação externa ausente.');
   if(!inTransaction)this.db.exec('BEGIN IMMEDIATE');
   try{
     for(const key of keys){
       this.getBankTransaction(key);
       if(category!==null)this.db.prepare(`INSERT INTO bank_category_overrides(account_id,external_id,category) VALUES(?,?,?)
         ON CONFLICT(account_id,external_id) DO UPDATE SET
          category_id=CASE WHEN category=excluded.category THEN category_id ELSE NULL END,
          subcategory_id=CASE WHEN category=excluded.category THEN subcategory_id ELSE NULL END,
          category=excluded.category`).run(key.accountId,key.externalId,category);
       if(category!==null&&this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get())this.db.prepare('DELETE FROM category_review_applied_labels WHERE account_id=? AND external_id=?').run(key.accountId,key.externalId);
       if(typeof reviewed==='boolean'||nature!==null){
         this.db.prepare(`INSERT OR IGNORE INTO bank_transaction_notes(account_id,external_id) VALUES (?,?)`).run(key.accountId,key.externalId);
         if(typeof reviewed==='boolean')this.db.prepare('UPDATE bank_transaction_notes SET reviewed_at=? WHERE account_id=? AND external_id=?').run(reviewed?new Date().toISOString():null,key.accountId,key.externalId);
         if(nature!==null)this.db.prepare('UPDATE bank_transaction_notes SET nature=? WHERE account_id=? AND external_id=?').run(nature,key.accountId,key.externalId);
       }
     }
     if(!inTransaction)this.db.exec('COMMIT');return inTransaction?{changed:keys.length}:this.bankOverview();
   }catch(err){if(!inTransaction)this.db.exec('ROLLBACK');throw err;}
 }
 setBankSplits(input){
   const key=bankKey(input),tx=this.getBankTransaction(key);
   if(tx.amount>=0)throw new Error('Só é possível dividir uma despesa.');
   const parts=input?.parts;
   if(!Array.isArray(parts)||parts.length>20||parts.length===1)throw new Error('Use de 2 a 20 partes, ou limpe a divisão.');
   if(parts.length){
     let total=0;
     for(const part of parts){
       if(!Number.isSafeInteger(part.amount)||part.amount<=0)throw new Error('Valor de parte inválido.');
       if(!this.db.prepare('SELECT 1 FROM categories WHERE name=?').get(part.category))throw new Error('Categoria da divisão inválida.');
       total+=part.amount;
     }
     if(total!==Math.abs(tx.amount))throw new Error('A soma das partes precisa ser exatamente igual à compra.');
   }
   this.db.exec('BEGIN IMMEDIATE');
   try{
     this.db.prepare('DELETE FROM bank_transaction_splits WHERE account_id=? AND external_id=?').run(key.accountId,key.externalId);
     const insert=this.db.prepare('INSERT INTO bank_transaction_splits(account_id,external_id,position,category,amount_cents) VALUES (?,?,?,?,?)');
     parts.forEach((part,index)=>insert.run(key.accountId,key.externalId,index,part.category,part.amount));
     this.db.exec('COMMIT');return this.bankOverview();
   }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 linkManualTransaction(input){
   const key=bankKey(input),tx=this.getBankTransaction(key);
   const manualId=input.manualId;
   if(manualId===null){this.db.prepare('DELETE FROM bank_manual_links WHERE account_id=? AND external_id=?').run(key.accountId,key.externalId);return this.bankOverview();}
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_bank_links'").get()&&this.db.prepare('SELECT 1 FROM planned_bank_links WHERE account_id=? AND external_id=?').get(key.accountId,key.externalId))throw new Error('Esta movimentação já foi vinculada a um compromisso planejado.');
   if(tx.status!=='POSTED')throw new Error('Espere a movimentação ser confirmada antes de vincular.');
   if(typeof manualId!=='string'||!manualId||manualId.length>120)throw new Error('Lançamento manual inválido.');
   const manual=this.db.prepare('SELECT * FROM transactions WHERE profile=? AND id=?').get('real',manualId);
   if(!manual)throw new Error('Lançamento manual não encontrado.');
   if(manual.amount_cents!==Math.abs(tx.amount)||manual.kind!==(tx.amount>=0?'income':'expense'))throw new Error('Valores ou tipos diferentes. Revise antes de vincular.');
   const difference=Math.abs((Date.parse(manual.date+'T00:00:00Z')-Date.parse(tx.date+'T00:00:00Z'))/86400000);
   if(difference>3)throw new Error('Datas com diferença acima de três dias.');
   this.db.prepare(`INSERT INTO bank_manual_links(account_id,external_id,manual_id,linked_at) VALUES(?,?,?,?)
     ON CONFLICT(account_id,external_id) DO UPDATE SET manual_id=excluded.manual_id,linked_at=excluded.linked_at`).run(key.accountId,key.externalId,manualId,new Date().toISOString());
   return this.bankOverview();
 }
 saveMerchantAlias(input){
   const pattern=simpleText(input?.pattern||'',120),displayName=simpleText(input?.displayName||'',100);
   if(pattern.length<3||!displayName)throw new Error('Informe uma descrição de três caracteres ou mais e um nome.');
   if(input?.id!=null){
     const id=Number(input.id);
     if(!Number.isInteger(id)||id<1||!this.db.prepare('SELECT 1 FROM merchant_aliases WHERE id=?').get(id))throw new Error('Estabelecimento não encontrado.');
     this.db.prepare('UPDATE merchant_aliases SET pattern=?,display_name=? WHERE id=?').run(pattern,displayName,id);
   }else this.db.prepare('INSERT INTO merchant_aliases(pattern,display_name) VALUES(?,?)').run(pattern,displayName);
   return this.bankOverview();
 }
 deleteMerchantAlias(id){
   const num=Number(id);if(!Number.isInteger(num)||num<=0)throw new Error('Identificador inválido.');
   this.db.prepare('DELETE FROM merchant_aliases WHERE id=?').run(num);return this.bankOverview();
 }
 pruneInvalidManualLinks(){
   this.db.exec(`DELETE FROM bank_manual_links WHERE NOT EXISTS (
     SELECT 1 FROM transactions t JOIN bank_transactions b
       ON b.account_id=bank_manual_links.account_id AND b.external_id=bank_manual_links.external_id
     WHERE t.profile='real' AND t.id=bank_manual_links.manual_id
       AND t.amount_cents=abs(b.amount_cents)
       AND t.kind=CASE WHEN b.amount_cents>=0 THEN 'income' ELSE 'expense' END
       AND b.status='POSTED'
       AND abs(julianday(t.date)-julianday(b.date))<=3
   )`);
 }
 /** Non-destructive review suggestions: NEVER delete or merge a banking row automatically. */
 suspectedDuplicates(){
  const rows=this.db.prepare(`SELECT b1.account_id AS accountIdA,b1.external_id AS externalIdA,
     b2.account_id AS accountIdB,b2.external_id AS externalIdB,
     b1.description,b1.amount_cents AS amount,b1.date,a1.name AS accountName
     FROM bank_transactions b1
     JOIN bank_accounts a1 ON a1.account_id=b1.account_id
     JOIN bank_transactions b2 ON b2.account_id>b1.account_id
      AND b2.amount_cents=b1.amount_cents AND b2.status='POSTED'
      AND b2.date BETWEEN date(b1.date,'-1 day') AND date(b1.date,'+1 day')
      AND b2.description=b1.description COLLATE NOCASE
     JOIN bank_accounts a2 ON a2.account_id=b2.account_id AND a2.name=a1.name
     WHERE b1.status='POSTED' AND length(trim(b1.description))>=8 AND b1.amount_cents<>0
     ORDER BY b1.date DESC LIMIT 80`).all();
  const dismissed=new Set(this.db.prepare('SELECT pair_key FROM bank_duplicate_dismissals').all().map(r=>r.pair_key));
  return rows.map(row=>({...row,pairKey:[row.accountIdA,row.externalIdA,row.accountIdB,row.externalIdB].join('|')}))
    .filter(row=>!dismissed.has(row.pairKey)).slice(0,20);
 }
 dismissDuplicate(pairKey){
  if(typeof pairKey!=='string'||pairKey.length<20||pairKey.length>650||pairKey.split('|').length!==4)throw new Error('Identificador de aviso inválido.');
  if(!this.suspectedDuplicates().some(row=>row.pairKey===pairKey))throw new Error('Este aviso não está mais disponível.');
  this.db.prepare('INSERT OR IGNORE INTO bank_duplicate_dismissals(pair_key,dismissed_at) VALUES(?,?)').run(pairKey,new Date().toISOString());
  return this.bankOverview();
 }
 bankOverview(){
   const reviewLabels=this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_review_applied_labels'").get()?new Map(this.db.prepare('SELECT * FROM category_review_applied_labels').all().map(r=>[JSON.stringify([r.account_id,r.external_id]),r])):new Map();
   const accounts=this.db.prepare(`SELECT account_id AS id,item_id AS itemId,name,subtype,currency,balance_cents AS balance,updated_at AS updatedAt FROM bank_accounts ORDER BY name`).all().map(x=>({...x}));
   const rules=this.listCategories().rules.filter(x=>x.enabled);
   const categoryInfo=this.listCategories().categories;
   const categories=new Set(categoryInfo.map(x=>x.name));
   const kindByCategory=new Map(categoryInfo.map(x=>[x.name,x.kind]));
   const aliases=this.db.prepare('SELECT id,pattern,display_name AS displayName FROM merchant_aliases ORDER BY length(pattern) DESC,id ASC').all();
   const splits=this.db.prepare(`SELECT account_id AS accountId,external_id AS externalId,category,amount_cents AS amount FROM bank_transaction_splits ORDER BY position`).all();
   const splitMap=new Map();for(const x of splits){const key=x.accountId+'|'+x.externalId;if(!splitMap.has(key))splitMap.set(key,[]);splitMap.get(key).push({category:x.category,amount:x.amount});}
   const transactions=this.db.prepare(`SELECT b.rowid AS rowid,b.external_id AS id,b.account_id AS accountId,a.name AS accountName,b.date,b.description,b.amount_cents AS amount,b.status,b.category AS bankCategory,
     o.category AS overrideCategory,n.merchant,n.note,n.nature,n.reviewed_at AS reviewedAt,l.manual_id AS linkedManualId
     FROM bank_transactions b JOIN bank_accounts a USING(account_id)
     LEFT JOIN bank_category_overrides o ON o.account_id=b.account_id AND o.external_id=b.external_id
     LEFT JOIN bank_transaction_notes n ON n.account_id=b.account_id AND n.external_id=b.external_id
     LEFT JOIN bank_manual_links l ON l.account_id=b.account_id AND l.external_id=b.external_id
     ORDER BY b.date DESC,b.external_id DESC LIMIT 2500`).all().map(x=>{
       const originalOverride=x.overrideCategory;
       x.overrideCategory=effectiveBankOverride(x,reviewLabels.get(JSON.stringify([x.accountId,x.id])));
       const fromRule=matchRule(x.description,'bank',rules,{accountId:x.accountId,rowid:x.rowid,status:x.status,nature:x.nature&&x.nature!=='auto'?x.nature:x.amount<0?'expense':'income',hasSplits:splitMap.has(x.accountId+'|'+x.id)});
       const category=x.overrideCategory||fromRule||providerCategory(x.bankCategory,categories);
       const categorySource=x.overrideCategory?'manual':fromRule?'rule':'bank';
       const {overrideCategory,...safe}=x;
       const merchant=x.merchant||aliases.find(a=>normalizeLabel(x.description).includes(normalizeLabel(a.pattern)))?.displayName||'';
       const savedSplits=splitMap.get(x.accountId+'|'+x.id)||[];
       const splitOutdated=savedSplits.length>0&&savedSplits.reduce((sum,part)=>sum+part.amount,0)!==Math.abs(x.amount);
       return {...safe,category,categorySource,supervisedOutdated:!!originalOverride&&!x.overrideCategory,merchant,note:x.note||'',nature:x.nature||'auto',reviewed:!!x.reviewedAt,
         splits:splitOutdated?[]:savedSplits,splitOutdated};
   });
   // Dashboard aggregates use the ENTIRE local bank history, never only the 2,500 visible rows.
   const ledger=this.db.prepare(`SELECT b.rowid AS rowid,b.account_id AS accountId,b.external_id AS externalId,b.date,b.description,b.status,
     b.amount_cents AS amount,b.category AS bankCategory,o.category AS overrideCategory,n.nature
     FROM bank_transactions b
     LEFT JOIN bank_category_overrides o USING(account_id,external_id)
     LEFT JOIN bank_transaction_notes n USING(account_id,external_id)
     WHERE b.status='POSTED' ORDER BY b.date`).all();
   const dayMap=new Map();
   for(const x of ledger){
     x.overrideCategory=effectiveBankOverride(x,reviewLabels.get(JSON.stringify([x.accountId,x.externalId])));
     const nature=x.nature&&x.nature!=='auto'?x.nature:(x.amount>=0?'income':'expense');
     if(nature==='transfer'||nature==='ignore')continue;
     if(!dayMap.has(x.date))dayMap.set(x.date,{date:x.date,income:0,expense:0,categories:new Map(),incomeCategories:new Map()});
     const day=dayMap.get(x.date),amount=Math.abs(x.amount);
     if(nature==='income'){
       day.income+=amount;
       const proposed=x.overrideCategory||matchRule(x.description,'bank',rules,{...x,nature,hasSplits:splitMap.has(x.accountId+'|'+x.externalId)})||(normalizeLabel(x.description).includes('PIX DEVOLVIDO')?'Reembolsos':providerCategory(x.bankCategory,categories));
       const category=kindByCategory.get(proposed)==='expense'?'Outros':proposed;
       day.incomeCategories.set(category,(day.incomeCategories.get(category)||0)+amount);
       continue;
     }
     if(nature!=='expense')continue;
     day.expense+=amount;
     const parts=splitMap.get(x.accountId+'|'+x.externalId)||[];
     const ok=parts.length&&parts.reduce((sum,part)=>sum+part.amount,0)===amount;
     const category=x.overrideCategory||matchRule(x.description,'bank',rules,{...x,nature,hasSplits:splitMap.has(x.accountId+'|'+x.externalId)})||providerCategory(x.bankCategory,categories);
     for(const part of ok?parts:[{category,amount}]){
       const bucket=kindByCategory.get(part.category)==='income'?'Outros':part.category;
       day.categories.set(bucket,(day.categories.get(bucket)||0)+part.amount);
     }
   }
   const dailyTotals=[...dayMap.values()].map(x=>({date:x.date,income:x.income,expense:x.expense,
     categories:[...x.categories].map(([name,total])=>({name,total})),
     incomeCategories:[...x.incomeCategories].map(([name,total])=>({name,total}))}));
   const totalTransactions=this.db.prepare('SELECT COUNT(*) AS total FROM bank_transactions').get().total;
   const items=this.db.prepare(`SELECT item_id AS itemId,institution,status,consent_expires_at AS consentExpiresAt,last_sync_at AS lastSyncAt FROM bank_items ORDER BY last_sync_at DESC`).all().map(x=>({...x}));
   const last=this.db.prepare(`SELECT completed_at AS completedAt,new_count AS newCount,total_count AS totalCount FROM bank_sync_history ORDER BY id DESC LIMIT 1`).get()||null;
   return {accounts,transactions,items,last,totalTransactions,truncated:totalTransactions>transactions.length,aliases,dailyTotals,suspectedDuplicates:this.suspectedDuplicates()};
 }
 ingestBank(itemId,payload){
   if(typeof itemId!=='string'||!itemId.trim()||!payload||!Array.isArray(payload.data))throw new Error('Lote bancário inválido.');
   const item=payload.item||{},now=new Date().toISOString();
   // Valida tudo antes de iniciar a transação: nenhuma importação parcial.
   const seenAccounts=new Set();
   const entries=payload.data.map(({account,transactions})=>{
     if(!account||typeof account.id!=='string'||typeof account.name!=='string'||!Array.isArray(transactions))throw new Error('Conta bancária inválida.');
     if(seenAccounts.has(account.id))throw new Error('Conta bancária duplicada no mesmo lote.');
     seenAccounts.add(account.id);
     const owner=this.db.prepare('SELECT item_id FROM bank_accounts WHERE account_id=?').get(account.id);
     if(owner&&owner.item_id!==itemId)throw new Error('Esta conta bancária já está vinculada a outra conexão.');
     const seenTransactions=new Set();
     const balance=account.balance==null?null:Math.round(Number(account.balance)*100);
     if(balance!==null&&!Number.isSafeInteger(balance))throw new Error('Saldo inválido.');
     const clean=transactions.map(t=>{
       if(!t||typeof t.id!=='string'||!t.id||!Number.isFinite(Number(t.amount))||typeof t.description!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(t.date||''))throw new Error('Transação bancária inválida.');
       if(seenTransactions.has(t.id))throw new Error('Movimentação bancária duplicada no mesmo lote.');
       seenTransactions.add(t.id);
       const amount=Math.round(Number(t.amount)*100);
       if(!Number.isSafeInteger(amount))throw new Error('Valor bancário inválido.');
       return {id:t.id,date:t.date.slice(0,10),description:t.description.slice(0,180),amount,status:String(t.status||'UNKNOWN').slice(0,30),category:String(t.category||'Outros').slice(0,70)};
     });
     return {account,balance,transactions:clean};
   });
   this.db.exec('BEGIN IMMEDIATE');
   try{
     this.db.prepare(`INSERT INTO bank_items(item_id,institution,status,consent_expires_at,last_sync_at) VALUES(?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET institution=excluded.institution,status=excluded.status,consent_expires_at=excluded.consent_expires_at,last_sync_at=excluded.last_sync_at`).run(itemId,String(item.connector?.name||'Instituição conectada').slice(0,100),String(item.status||'UPDATED').slice(0,40),item.consentExpiresAt||null,now);
     const addAccount=this.db.prepare(`INSERT INTO bank_accounts(account_id,item_id,name,subtype,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET name=excluded.name,subtype=excluded.subtype,balance_cents=excluded.balance_cents,updated_at=excluded.updated_at`);
     const addTx=this.db.prepare(`INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET date=excluded.date,description=excluded.description,amount_cents=excluded.amount_cents,status=excluded.status,updated_at=excluded.updated_at`);
     let newCount=0,totalCount=0;
     const exists=this.db.prepare('SELECT status,amount_cents,description FROM bank_transactions WHERE account_id=? AND external_id=?');
     const unreview=this.db.prepare('UPDATE bank_transaction_notes SET reviewed_at=NULL WHERE account_id=? AND external_id=?');
     for(const e of entries){
       addAccount.run(e.account.id,itemId,e.account.name.slice(0,140),String(e.account.subtype||'').slice(0,50),'BRL',e.balance,now);
       for(const t of e.transactions){const previous=exists.get(e.account.id,t.id);
         if(!previous)newCount++;
         else if(previous.status!==t.status||previous.amount_cents!==t.amount||previous.description!==t.description)unreview.run(e.account.id,t.id);
         addTx.run(e.account.id,t.id,t.date,t.description,t.amount,t.status,t.category,now);totalCount++;
       }
     }
     this.pruneInvalidManualLinks();
     this.db.prepare('INSERT INTO bank_sync_history(item_id,completed_at,new_count,total_count) VALUES(?,?,?,?)').run(itemId,now,newCount,totalCount);
     this.db.exec('COMMIT');return {newCount,totalCount};
   }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 integrity(){return this.db.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check);}
 async backupTo(destination){
   if(typeof destination!=='string'||!destination.toLowerCase().endsWith('.sqlite')) throw new Error('Destino de backup inválido');
   if(path.resolve(destination)===this.filename)throw new Error('Backup não pode sobrescrever o banco ativo');
   await backup(this.db,destination);
   return {ok:true,path:destination};
 }
 close(){this.db.close();}
}
module.exports={FinanceDB, validate,matchRule,normalizeLabel,providerCategory,categoryDecisionFingerprint,effectiveBankOverride,categoryEmoji,ALLOWED_EMOJIS};
