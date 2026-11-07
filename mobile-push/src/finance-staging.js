// Migration staging for a **synthetic** v0.9.4-like SQLite dataset.
//
// This is NOT the production finance database. No user-supplied financial
// records are accepted by this module. It creates only isolated mf_stage_*
// tables and inserts fixed, fictitious examples to verify lossless relations.
//
// In Cloudflare Durable Objects, PRAGMA user_version is unsupported. We use
// an explicit version table instead. Financial sync stays code-locked.
export const STAGING_SCHEMA_VERSION=1;

const DEFINITIONS=Object.freeze({
  app_meta:"key TEXT PRIMARY KEY,value TEXT NOT NULL",
  profiles:"profile TEXT PRIMARY KEY CHECK(profile IN ('real','demo')),initialized_at TEXT NOT NULL",
  transactions:"profile TEXT NOT NULL REFERENCES mf_stage_profiles(profile),id TEXT NOT NULL,date TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('income','expense')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),category TEXT NOT NULL,origin TEXT NOT NULL,PRIMARY KEY(profile,id)",
  budgets:"profile TEXT NOT NULL REFERENCES mf_stage_profiles(profile),category TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),PRIMARY KEY(profile,category)",
  financial_settings:"profile TEXT NOT NULL REFERENCES mf_stage_profiles(profile),name TEXT NOT NULL,value_cents INTEGER NOT NULL,PRIMARY KEY(profile,name)",
  bank_items:"item_id TEXT PRIMARY KEY,institution TEXT NOT NULL,status TEXT NOT NULL,consent_expires_at TEXT,last_sync_at TEXT",
  bank_accounts:"account_id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES mf_stage_bank_items(item_id),name TEXT NOT NULL,subtype TEXT,currency TEXT NOT NULL,balance_cents INTEGER,updated_at TEXT NOT NULL",
  bank_transactions:"account_id TEXT NOT NULL REFERENCES mf_stage_bank_accounts(account_id),external_id TEXT NOT NULL,date TEXT NOT NULL,description TEXT NOT NULL,amount_cents INTEGER NOT NULL,status TEXT NOT NULL,category TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id)",
  bank_sync_history:"id INTEGER PRIMARY KEY AUTOINCREMENT,item_id TEXT NOT NULL,completed_at TEXT NOT NULL,new_count INTEGER NOT NULL,total_count INTEGER NOT NULL",
  categories:"name TEXT PRIMARY KEY COLLATE NOCASE,color TEXT NOT NULL,built_in INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,emoji TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('expense','income','both'))",
  category_rules:"id INTEGER PRIMARY KEY AUTOINCREMENT,pattern TEXT NOT NULL,match_mode TEXT NOT NULL CHECK(match_mode IN ('contains','starts','exact')),category TEXT NOT NULL REFERENCES mf_stage_categories(name),scope TEXT NOT NULL CHECK(scope IN ('both','bank','manual')),priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 999),enabled INTEGER NOT NULL DEFAULT 1",
  bank_category_overrides:"account_id TEXT NOT NULL,external_id TEXT NOT NULL,category TEXT NOT NULL REFERENCES mf_stage_categories(name),PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)",
  bank_transaction_notes:"account_id TEXT NOT NULL,external_id TEXT NOT NULL,merchant TEXT NOT NULL,note TEXT NOT NULL,nature TEXT NOT NULL CHECK(nature IN ('auto','income','expense','transfer','ignore')),reviewed_at TEXT,PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)",
  bank_transaction_splits:"account_id TEXT NOT NULL,external_id TEXT NOT NULL,position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 19),category TEXT NOT NULL REFERENCES mf_stage_categories(name),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),PRIMARY KEY(account_id,external_id,position),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)",
  bank_manual_links:"account_id TEXT NOT NULL,external_id TEXT NOT NULL,manual_id TEXT NOT NULL UNIQUE,linked_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)",
  merchant_aliases:"id INTEGER PRIMARY KEY AUTOINCREMENT,pattern TEXT NOT NULL,display_name TEXT NOT NULL,created_at TEXT NOT NULL",
  bank_duplicate_dismissals:"pair_key TEXT PRIMARY KEY,dismissed_at TEXT NOT NULL",
  planned_items:"id TEXT PRIMARY KEY,group_id TEXT,group_type TEXT NOT NULL,occurrence INTEGER NOT NULL,total_occurrences INTEGER NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('income','expense')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),due_date TEXT NOT NULL,category TEXT NOT NULL,account_id TEXT,notes TEXT NOT NULL,certainty TEXT NOT NULL CHECK(certainty IN ('confirmed','estimated')),status TEXT NOT NULL CHECK(status IN ('planned','cancelled','settled_manual','settled')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,settled_at TEXT",
  planned_bank_links:"item_id TEXT NOT NULL REFERENCES mf_stage_planned_items(id),account_id TEXT NOT NULL,external_id TEXT NOT NULL,linked_at TEXT NOT NULL,PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)",
  planned_rejected_matches:"item_id TEXT NOT NULL REFERENCES mf_stage_planned_items(id),account_id TEXT NOT NULL,external_id TEXT NOT NULL,PRIMARY KEY(item_id,account_id,external_id)",
  planned_audit:"id INTEGER PRIMARY KEY AUTOINCREMENT,item_id TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,at TEXT NOT NULL",
  bank_custom_titles:"account_id TEXT NOT NULL,external_id TEXT NOT NULL,title TEXT NOT NULL,PRIMARY KEY(account_id,external_id),FOREIGN KEY(account_id,external_id) REFERENCES mf_stage_bank_transactions(account_id,external_id)"
});
export const STAGING_TABLES=Object.freeze(Object.keys(DEFINITIONS));
const T='2026-11-07T12:00:00.000Z';
function one(sql,query,...args){return sql.exec(query,...args).one();}
function scalar(sql,query,...args){return Number(Object.values(one(sql,query,...args))[0]);}

export function ensureStagingSchema(storage){
  const sql=storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS mf_stage_version (version INTEGER PRIMARY KEY, created_at TEXT NOT NULL)');
  for(const [name,definition] of Object.entries(DEFINITIONS)){
    // Identifiers/definitions are compile-time constants, never user-supplied.
    sql.exec('CREATE TABLE IF NOT EXISTS mf_stage_'+name+' ('+definition+')');
  }
  const versions=sql.exec('SELECT version FROM mf_stage_version').toArray();
  if(versions.some(v=>v.version!==STAGING_SCHEMA_VERSION))
    throw new Error('Versão de esquema fictício incompatível; não modificar dados.');
  if(versions.length===0){
    sql.exec('INSERT INTO mf_stage_version (version,created_at) VALUES (?,?)',STAGING_SCHEMA_VERSION,T);
  }
  // "IF NOT EXISTS" is not enough: detect accidental schema drift in staging.
  const found=sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mf_stage_%'").toArray().map(x=>x.name);
  const expected=['mf_stage_version',...STAGING_TABLES.map(x=>'mf_stage_'+x)];
  const missing=expected.filter(x=>!found.includes(x));
  if(missing.length)throw new Error('Esquema de teste incompleto.');
  return {schemaVersion:STAGING_SCHEMA_VERSION,tableCount:STAGING_TABLES.length};
}

function seedSynthetic(sql){
  // Static, *fictional* values only. INSERT OR IGNORE makes repeat tests idempotent.
  // Never use this importer for real bank, payroll or account data.
  sql.exec("INSERT OR IGNORE INTO mf_stage_app_meta VALUES ('schema_version','6')");
  sql.exec("INSERT OR IGNORE INTO mf_stage_profiles VALUES ('demo',?)",T);
  for(const [name,kind,emoji] of [['Alimentação','expense','🍽️'],['Moradia','expense','🏠'],['Salário','income','💰']]){
    sql.exec("INSERT OR IGNORE INTO mf_stage_categories (name,color,built_in,created_at,emoji,kind) VALUES (?,'#884bff',0,?,?,?)",name,T,emoji,kind);
  }
  sql.exec("INSERT OR IGNORE INTO mf_stage_category_rules (id,pattern,match_mode,category,scope,priority,enabled) VALUES (1,'MERCADO','contains','Alimentação','bank',10,1)");
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_items VALUES ('synthetic-item','BANCO FICTÍCIO','UPDATED',NULL,?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_accounts VALUES ('synthetic-account','synthetic-item','Conta fictícia','CHECKING','BRL',4000,?)",T);
  // All amounts are integer cents. One original bank record remains immutable.
  for(const [id,desc,amount,cat] of [
    ['test-bank-1','MERCADO FICTICIO',-2500,'Alimentação'],
    ['test-bank-2','ALUGUEL FICTICIO',-3500,'Moradia'],
    ['test-bank-3','PAGAMENTO FICTICIO',10000,'Salário']
  ])sql.exec(
    "INSERT OR IGNORE INTO mf_stage_bank_transactions VALUES ('synthetic-account',?,'2026-11-07',?,?,'POSTED',?,?)",
    id,desc,amount,cat,T
  );
  sql.exec("INSERT OR IGNORE INTO mf_stage_transactions VALUES ('demo','synthetic-manual','2026-11-07','Mercado manual fictício','expense',2500,'Alimentação','manual')");
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_manual_links VALUES ('synthetic-account','test-bank-1','synthetic-manual',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_transaction_notes VALUES ('synthetic-account','test-bank-1','Mercado fictício','','expense',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_category_overrides VALUES ('synthetic-account','test-bank-1','Alimentação')");
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_transaction_splits VALUES ('synthetic-account','test-bank-2',0,'Moradia',2000)");
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_transaction_splits VALUES ('synthetic-account','test-bank-2',1,'Moradia',1500)");
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_custom_titles VALUES ('synthetic-account','test-bank-2','Aluguel de teste')");
  sql.exec("INSERT OR IGNORE INTO mf_stage_planned_items (id,group_id,group_type,occurrence,total_occurrences,title,kind,amount_cents,due_date,category,account_id,notes,certainty,status,created_at,updated_at,settled_at) VALUES ('synthetic-plan',NULL,'single',1,1,'Aluguel fictício','expense',3500,'2026-11-07','Moradia','synthetic-account','','confirmed','settled',?,?,?)",T,T,T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_planned_bank_links VALUES ('synthetic-plan','synthetic-account','test-bank-2',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_planned_audit (id,item_id,action,details,at) VALUES (1,'synthetic-plan','link','fixtures',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_budgets VALUES ('demo','Alimentação',5000)");
  sql.exec("INSERT OR IGNORE INTO mf_stage_financial_settings VALUES ('demo','reserve',3000)");
  sql.exec("INSERT OR IGNORE INTO mf_stage_merchant_aliases VALUES (1,'MERCADO','Mercado fictício',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_duplicate_dismissals VALUES ('synthetic-dismissal',?)",T);
  sql.exec("INSERT OR IGNORE INTO mf_stage_bank_sync_history VALUES (1,'synthetic-item',?,3,3)",T);
}

function verifySynthetic(sql){
  const bank=scalar(sql,"SELECT COALESCE(SUM(amount_cents),0) AS amount FROM mf_stage_bank_transactions WHERE account_id='synthetic-account' AND status='POSTED'");
  const bankCount=scalar(sql,"SELECT COUNT(*) AS n FROM mf_stage_bank_transactions WHERE account_id='synthetic-account'");
  const manualLinked=scalar(sql,"SELECT COUNT(*) AS n FROM mf_stage_transactions t JOIN mf_stage_bank_manual_links l ON l.manual_id=t.id WHERE t.profile='demo'");
  const manualNotLinked=scalar(sql,"SELECT COALESCE(SUM(CASE WHEN t.kind='income' THEN t.amount_cents ELSE -t.amount_cents END),0) AS amount FROM mf_stage_transactions t WHERE t.profile='demo' AND NOT EXISTS (SELECT 1 FROM mf_stage_bank_manual_links l WHERE l.manual_id=t.id)");
  const splitTotal=scalar(sql,"SELECT COALESCE(SUM(amount_cents),0) AS amount FROM mf_stage_bank_transaction_splits WHERE account_id='synthetic-account' AND external_id='test-bank-2'");
  const plannedLinked=scalar(sql,"SELECT COALESCE(SUM(ABS(b.amount_cents)),0) AS amount FROM mf_stage_planned_bank_links l JOIN mf_stage_bank_transactions b ON b.account_id=l.account_id AND b.external_id=l.external_id WHERE l.item_id='synthetic-plan'");
  const plannedAmount=scalar(sql,"SELECT amount_cents FROM mf_stage_planned_items WHERE id='synthetic-plan'");
  const actualTitle=one(sql,"SELECT title FROM mf_stage_bank_custom_titles WHERE external_id='test-bank-2'").title;
  const originalDescription=one(sql,"SELECT description FROM mf_stage_bank_transactions WHERE external_id='test-bank-2'").description;
  const originalBalance=scalar(sql,"SELECT balance_cents FROM mf_stage_bank_accounts WHERE account_id='synthetic-account'");
  const errors=[];
  if(bankCount!==3)errors.push('Contagem do extrato de teste divergiu.');
  if(bank!==4000||manualNotLinked!==0)errors.push('Fluxo de caixa contabilizado duas vezes.');
  if(manualLinked!==1)errors.push('Vínculo manual/banco não preservado.');
  if(splitTotal!==3500)errors.push('Divisão da compra não fecha o valor original.');
  if(plannedLinked!==plannedAmount||plannedAmount!==3500)errors.push('Compromisso vinculado não foi reconciliado.');
  if(actualTitle!=='Aluguel de teste'||originalDescription!=='ALUGUEL FICTICIO')errors.push('Descrição original alterada.');
  if(originalBalance!==4000)errors.push('Saldo fictício inesperado.');
  return {ok:errors.length===0,errors,
    bankRecordCount:bankCount,manualLinkedCount:manualLinked,
    originalCashflowCents:bank,canonicalCashflowCents:bank+manualNotLinked,
    splitReconciled:splitTotal===3500,plannedReconciled:plannedLinked===plannedAmount,
    originalDescriptionPreserved:originalDescription==='ALUGUEL FICTICIO'};
}

// Only this method is exposed to the test-only route: no importing endpoints.
export function runSyntheticMigrationDryRun(storage){
  const structure=ensureStagingSchema(storage);
  const result=storage.transactionSync(()=>{
    seedSynthetic(storage.sql);
    const validation=verifySynthetic(storage.sql);
    if(!validation.ok)throw new Error('Falha ao conferir dados fictícios: '+validation.errors.join(' '));
    return validation;
  });
  return {
    ...structure,mode:'synthetic_only',realFinancialDataAccepted:false,
    financialMigrationActivated:false,recordsImportedFromDevice:0,
    ...result
  };
}
