'use strict';
/* Persistência local com node:sqlite (incluído no Node 24 do Electron 45).
   Todos os valores monetários são inteiros em centavos. */
const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_CATEGORIES = [
  ['Moradia','#884bff'],['Alimentação','#bc80ff'],['Transporte','#db6ff5'],
  ['Saúde','#7549d8'],['Lazer','#a58cf4'],['Educação','#5b4da5'],
  ['Assinaturas','#4a386f'],['Compras','#7555bd'],['Contas','#c090e5'],
  ['Outros','#3f375a'],['Salário','#27c498']
];
const CAT = DEFAULT_CATEGORIES.map(([name])=>name);
function normalizeLabel(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR').replace(/\s+/g,' ').trim();
}
function categoryName(name){
  const value=String(name||'').trim();
  if(!value||value.length>50||/[\x00-\x1f<>]/.test(value))throw new Error('Informe uma categoria de até 50 caracteres.');
  return value;
}
function categoryColor(color){
  if(typeof color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(color))throw new Error('Cor da categoria inválida.');
  return color.toLowerCase();
}
function matchRule(description,scope,rules){
  const hay=normalizeLabel(description);
  for(const rule of rules){
    if(rule.scope!=='both'&&rule.scope!==scope)continue;
    const needle=normalizeLabel(rule.pattern);
    if(!needle)continue;
    if((rule.matchMode==='exact'&&hay===needle)||
      (rule.matchMode==='starts'&&hay.startsWith(needle))||
      (rule.matchMode==='contains'&&hay.includes(needle))) return rule.category;
  }
  return null;
}
const KEYS = ['opening','income','fixed','existing','reserve'];
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
  return {version:4, transactions, budgets, settings};
}
function checkProfile(profile){if(profile!=='real'&&profile!=='demo') throw new Error('Perfil inválido');return profile;}
class FinanceDB {
 constructor(filename){
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
   const seed=this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in) VALUES (?,?,1)');
   for(const [name,color] of DEFAULT_CATEGORIES)seed.run(name,color);
   // Compatibilidade: categorias pré-existentes em lançamentos manuais e orçamentos.
   const legacy=this.db.prepare(`SELECT category AS name FROM transactions UNION SELECT category AS name FROM budgets`);
   for(const {name} of legacy.all()){
     if(typeof name==='string'&&name.trim()&&name.length<=50)
       this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in) VALUES (?, ?,0)').run(name,'#884bff');
   }
   this.db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES (?,?)').run('schema_version','1');
   this.db.prepare('UPDATE app_meta SET value=? WHERE key=?').run('3','schema_version');
 }
 load(profile){
   checkProfile(profile);
   if(!this.db.prepare('SELECT 1 FROM profiles WHERE profile=?').get(profile))return null;
   const budgets=Object.fromEntries(this.listCategories().categories.map(c=>[c.name,0]));
   for(const r of this.db.prepare('SELECT category, amount_cents FROM budgets WHERE profile=?').all(profile))budgets[r.category]=r.amount_cents;
   const settings={opening:0,income:0,fixed:0,existing:0,reserve:0};
   for(const r of this.db.prepare('SELECT name, value_cents FROM financial_settings WHERE profile=?').all(profile))if(KEYS.includes(r.name))settings[r.name]=r.value_cents;
   const transactions=this.db.prepare('SELECT id,date,description,kind,amount_cents AS amount,category,origin FROM transactions WHERE profile=? ORDER BY date,id').all(profile).map(x=>({...x}));
   return {version:4,transactions,budgets,settings};
 }
 save(profile,payload){
   checkProfile(profile);const value=validate(payload);
   this.db.exec('BEGIN IMMEDIATE');
   try{
     this.db.prepare('INSERT OR IGNORE INTO profiles(profile) VALUES (?)').run(profile);
     this.db.prepare('DELETE FROM transactions WHERE profile=?').run(profile);
     this.db.prepare('DELETE FROM budgets WHERE profile=?').run(profile);
     this.db.prepare('DELETE FROM financial_settings WHERE profile=?').run(profile);
     // Ao restaurar JSON legado, preserve categorias presentes mesmo sem cadastro prévio.
     const existingCategories=new Set(this.listCategories().categories.map(x=>x.name));
     for(const name of new Set([...value.transactions.map(t=>t.category),...Object.keys(value.budgets)])){
       if(!existingCategories.has(name)){
         this.db.prepare('INSERT OR IGNORE INTO categories(name,color,built_in) VALUES (?, ?,0)').run(categoryName(name),'#884bff');
         existingCategories.add(name);
       }
     }
     const addTx=this.db.prepare('INSERT INTO transactions (profile,id,date,description,kind,amount_cents,category,origin) VALUES (?,?,?,?,?,?,?,?)');
     for(const t of value.transactions) addTx.run(profile,t.id,t.date,t.description,t.kind,t.amount,t.category,t.origin);
     const addBudget=this.db.prepare('INSERT INTO budgets(profile,category,amount_cents) VALUES(?,?,?)');
     const allowed=new Set(this.listCategories().categories.map(x=>x.name));
     for(const [name,amount] of Object.entries(value.budgets)){
       if(!allowed.has(name))throw new Error('Categoria de orçamento desconhecida: '+name);
       addBudget.run(profile,name,amount);
     }
     const addSetting=this.db.prepare('INSERT INTO financial_settings(profile,name,value_cents) VALUES (?,?,?)');
     for(const [name,amount] of Object.entries(value.settings))addSetting.run(profile,name,amount);
     this.db.exec('COMMIT');
     return {ok:true,txCount:value.transactions.length};
   }catch(err){this.db.exec('ROLLBACK');throw err;}
 }
 listCategories(){
   const categories=this.db.prepare('SELECT name,color,built_in AS builtIn FROM categories ORDER BY built_in DESC,name COLLATE NOCASE').all().map(x=>({...x}));
   const rules=this.db.prepare('SELECT id,pattern,match_mode AS matchMode,category,scope,priority,enabled FROM category_rules ORDER BY priority ASC,id ASC').all().map(x=>({...x}));
   return {categories,rules};
 }
 upsertCategory({previousName,name,color}){
   const label=categoryName(name), hex=categoryColor(color), previous=String(previousName||'').trim();
   this.db.exec('BEGIN IMMEDIATE');
   try{
     if(previous){
       const row=this.db.prepare('SELECT name,built_in FROM categories WHERE name=?').get(previous);
       if(!row)throw new Error('Categoria não encontrada.');
       if(row.built_in&&row.name!==label)throw new Error('Categorias padrão podem mudar de cor, mas não de nome.');
       const clash=this.db.prepare('SELECT name FROM categories WHERE name=? COLLATE NOCASE').get(label);
       if(clash&&clash.name.toLowerCase()!==row.name.toLowerCase())throw new Error('Já existe uma categoria com esse nome.');
       if(row.name!==label){
         this.db.prepare('UPDATE categories SET name=?,color=? WHERE name=?').run(label,hex,row.name);
         this.db.prepare('UPDATE transactions SET category=? WHERE category=?').run(label,row.name);
         this.db.prepare('UPDATE budgets SET category=? WHERE category=?').run(label,row.name);
       }else this.db.prepare('UPDATE categories SET color=? WHERE name=?').run(hex,row.name);
     }else{
       if(this.db.prepare('SELECT 1 FROM categories WHERE name=? COLLATE NOCASE').get(label))throw new Error('Já existe uma categoria com esse nome.');
       this.db.prepare('INSERT INTO categories(name,color,built_in) VALUES(?,?,0)').run(label,hex);
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
     this.db.prepare('SELECT 1 FROM budgets WHERE category=? AND amount_cents>0 LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM category_rules WHERE category=? LIMIT 1').get(row.name),
     this.db.prepare('SELECT 1 FROM bank_category_overrides WHERE category=? LIMIT 1').get(row.name)
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
     this.db.prepare('UPDATE category_rules SET pattern=?,match_mode=?,category=?,scope=?,priority=? WHERE id=?').run(pattern,matchMode,category,scope,priority,id);
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
     this.db.prepare('INSERT INTO bank_category_overrides(account_id,external_id,category) VALUES(?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET category=excluded.category').run(accountId,externalId,name);
   }
   return this.bankOverview();
 }
 bankOverview(){
   const accounts=this.db.prepare(`SELECT account_id AS id,item_id AS itemId,name,subtype,currency,balance_cents AS balance,updated_at AS updatedAt FROM bank_accounts ORDER BY name`).all().map(x=>({...x}));
   const rules=this.listCategories().rules.filter(x=>x.enabled);
   const categories=new Set(this.listCategories().categories.map(x=>x.name));
   const transactions=this.db.prepare(`SELECT b.external_id AS id,b.account_id AS accountId,a.name AS accountName,b.date,b.description,b.amount_cents AS amount,b.status,b.category AS bankCategory,o.category AS overrideCategory FROM bank_transactions b JOIN bank_accounts a USING(account_id) LEFT JOIN bank_category_overrides o ON o.account_id=b.account_id AND o.external_id=b.external_id ORDER BY date DESC,id DESC LIMIT 2500`).all().map(x=>{
     const fromRule=matchRule(x.description,'bank',rules);
     const category=x.overrideCategory||fromRule||(categories.has(x.bankCategory)?x.bankCategory:'Outros');
     const categorySource=x.overrideCategory?'manual':fromRule?'rule':'bank';
     const {overrideCategory,...safe}=x;
     return {...safe,category,categorySource};
   });
   const items=this.db.prepare(`SELECT item_id AS itemId,institution,status,consent_expires_at AS consentExpiresAt,last_sync_at AS lastSyncAt FROM bank_items ORDER BY last_sync_at DESC`).all().map(x=>({...x}));
   const last=this.db.prepare(`SELECT completed_at AS completedAt,new_count AS newCount,total_count AS totalCount FROM bank_sync_history ORDER BY id DESC LIMIT 1`).get()||null;
   return {accounts,transactions,items,last};
 }
 ingestBank(itemId,payload){
   if(typeof itemId!=='string'||!itemId.trim()||!payload||!Array.isArray(payload.data))throw new Error('Lote bancário inválido.');
   const item=payload.item||{},now=new Date().toISOString();
   // Valida tudo antes de iniciar a transação: nenhuma importação parcial.
   const entries=payload.data.map(({account,transactions})=>{
     if(!account||typeof account.id!=='string'||typeof account.name!=='string'||!Array.isArray(transactions))throw new Error('Conta bancária inválida.');
     const balance=account.balance==null?null:Math.round(Number(account.balance)*100);
     if(balance!==null&&!Number.isSafeInteger(balance))throw new Error('Saldo inválido.');
     const clean=transactions.map(t=>{
       if(!t||typeof t.id!=='string'||!t.id||!Number.isFinite(Number(t.amount))||typeof t.description!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(t.date||''))throw new Error('Transação bancária inválida.');
       const amount=Math.round(Number(t.amount)*100);
       if(!Number.isSafeInteger(amount))throw new Error('Valor bancário inválido.');
       return {id:t.id,date:t.date.slice(0,10),description:t.description.slice(0,180),amount,status:String(t.status||'UNKNOWN').slice(0,30),category:String(t.category||'Outros').slice(0,70)};
     });
     return {account,balance,transactions:clean};
   });
   this.db.exec('BEGIN IMMEDIATE');
   try{
     this.db.prepare(`INSERT INTO bank_items(item_id,institution,status,consent_expires_at,last_sync_at) VALUES(?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET institution=excluded.institution,status=excluded.status,consent_expires_at=excluded.consent_expires_at,last_sync_at=excluded.last_sync_at`).run(itemId,String(item.connector?.name||'Meu Pluggy').slice(0,100),String(item.status||'UPDATED').slice(0,40),item.consentExpiresAt||null,now);
     const addAccount=this.db.prepare(`INSERT INTO bank_accounts(account_id,item_id,name,subtype,currency,balance_cents,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET name=excluded.name,subtype=excluded.subtype,balance_cents=excluded.balance_cents,updated_at=excluded.updated_at`);
     const addTx=this.db.prepare(`INSERT INTO bank_transactions(account_id,external_id,date,description,amount_cents,status,category,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account_id,external_id) DO UPDATE SET date=excluded.date,description=excluded.description,amount_cents=excluded.amount_cents,status=excluded.status,updated_at=excluded.updated_at`);
     let newCount=0,totalCount=0;
     const exists=this.db.prepare('SELECT 1 FROM bank_transactions WHERE account_id=? AND external_id=?');
     for(const e of entries){
       addAccount.run(e.account.id,itemId,e.account.name.slice(0,140),String(e.account.subtype||'').slice(0,50),'BRL',e.balance,now);
       for(const t of e.transactions){if(!exists.get(e.account.id,t.id))newCount++;
         addTx.run(e.account.id,t.id,t.date,t.description,t.amount,t.status,t.category,now);totalCount++;
       }
     }
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
module.exports={FinanceDB, validate,matchRule,normalizeLabel};
