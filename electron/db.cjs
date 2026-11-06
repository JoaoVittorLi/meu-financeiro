'use strict';
/* Persistência local com node:sqlite (incluído no Node 24 do Electron 45).
   Todos os valores monetários são inteiros em centavos. */
const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const CAT = ['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Assinaturas','Compras','Contas','Outros'];
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
  for (const cat of CAT) { const value=payload.budgets[cat] ?? 0; if(!isCents(value))throw new Error('Orçamento inválido: '+cat); budgets[cat]=value; }
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
   this.db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES (?,?)').run('schema_version','1');
 }
 load(profile){
   checkProfile(profile);
   if(!this.db.prepare('SELECT 1 FROM profiles WHERE profile=?').get(profile))return null;
   const budgets=Object.fromEntries(CAT.map(cat=>[cat,0]));
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
     const addTx=this.db.prepare('INSERT INTO transactions (profile,id,date,description,kind,amount_cents,category,origin) VALUES (?,?,?,?,?,?,?,?)');
     for(const t of value.transactions) addTx.run(profile,t.id,t.date,t.description,t.kind,t.amount,t.category,t.origin);
     const addBudget=this.db.prepare('INSERT INTO budgets(profile,category,amount_cents) VALUES(?,?,?)');
     for(const [name,amount] of Object.entries(value.budgets))addBudget.run(profile,name,amount);
     const addSetting=this.db.prepare('INSERT INTO financial_settings(profile,name,value_cents) VALUES (?,?,?)');
     for(const [name,amount] of Object.entries(value.settings))addSetting.run(profile,name,amount);
     this.db.exec('COMMIT');
     return {ok:true,txCount:value.transactions.length};
   }catch(err){this.db.exec('ROLLBACK');throw err;}
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
module.exports={FinanceDB, validate};
