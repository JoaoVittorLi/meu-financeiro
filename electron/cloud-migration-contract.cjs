'use strict';

// Lossless inventory of the v0.9.4 desktop relational schema. This is a
// structural migration contract only, NOT a data exporter or cloud importer.
// Separate contract validation, secret handling, referential reconciliation,
// authenticated import and rollback are still required before financial data.
const {REQUIRED_TABLES,inspectDesktopSchema}=require('./cloud-migration-audit.cjs');

// Every persisted table matters. A domain-level JSON sync collection is NOT
// by itself a replacement for all these SQLite tables and their relationships.
const TABLE_KEYS=Object.freeze({
  app_meta: ['key'],
  profiles: ['profile'],
  transactions: ['profile','id'],
  budgets: ['profile','category'],
  financial_settings: ['profile','name'],
  bank_items: ['item_id'],
  bank_accounts: ['account_id'],
  bank_transactions: ['account_id','external_id'],
  bank_sync_history: ['id'],
  categories: ['name'],
  category_rules: ['id'],
  bank_category_overrides: ['account_id','external_id'],
  bank_transaction_notes: ['account_id','external_id'],
  bank_transaction_splits: ['account_id','external_id','position'],
  bank_manual_links: ['account_id','external_id'],
  merchant_aliases: ['id'],
  bank_duplicate_dismissals: ['pair_key'],
  planned_items: ['id'],
  planned_bank_links: ['account_id','external_id'],
  planned_rejected_matches: ['item_id','account_id','external_id'],
  planned_audit: ['id'],
  bank_custom_titles: ['account_id','external_id']
});

const BUSINESS_INVARIANTS=Object.freeze([
  'Preserve os campos brutos de bank_transactions e seus IDs externos.',
  'Não confunda category com nature; Pix para terceiros não é transferência própria.',
  'Preserve splits por posição e sua soma exata em centavos.',
  'Preserve bank_manual_links e planned_bank_links sem contabilizar duas vezes.',
  'Preserve recorrências, exceções, grupos e settled_at em planned_items.',
  'Preserve as decisões de revisão, títulos personalizados e rejeições de sugestão.',
  'Preserve os perfis real e demo separadamente.',
  'Credenciais Meu Pluggy ficam fora do SQLite e nunca entram na migração de dados.',
  'Não copie automaticamente os marcadores de migração local em app_meta como flags cloud.',
  'Nenhum cutover sem rollback, autenticação forte e validação financeira por entidade.'
]);

function inspectMigrationContract(finance){
  const db=finance?.db||finance;
  const base=inspectDesktopSchema(db);
  const required=Object.keys(TABLE_KEYS);
  const unmappedTables=REQUIRED_TABLES.filter(x=>!required.includes(x));
  const unexpectedTables=required.filter(x=>!REQUIRED_TABLES.includes(x));
  const wrongPrimaryKeys=[];
  const absent=new Set(base.missingTables);
  for(const [table, expected] of Object.entries(TABLE_KEYS)){
    if(absent.has(table))continue;
    // PRAGMA uses compile-time, strictly allowlisted table names, never user input.
    const actual=db.prepare('PRAGMA table_info("'+table+'")').all()
      .filter(col=>col.pk>0).sort((a,b)=>a.pk-b.pk).map(x=>x.name);
    if(actual.length!==expected.length || expected.some((key,i)=>key!==actual[i])){
      wrongPrimaryKeys.push({table,expected,actual});
    }
  }
  const structureOK=base.schemaCompatible && !unmappedTables.length &&
    !unexpectedTables.length && !wrongPrimaryKeys.length;
  return {
    ...base,
    structuralContractOK:structureOK,
    tableCount:required.length,
    unmappedTables,
    unexpectedTables,
    wrongPrimaryKeys,
    migrationApproved:false,
    // Deliberately includes no row counts or individual customer information.
    recordsExported:0
  };
}

module.exports={TABLE_KEYS,BUSINESS_INVARIANTS,inspectMigrationContract};
