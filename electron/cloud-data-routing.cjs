'use strict';

// Migration routing contract, NOT a data uploader.
// The owner's one-click flow must preserve all local decisions while the
// backend re-fetches current bank balances/transactions from Pluggy.
// Nothing may be silently dropped when Pluggy's historical coverage differs
// from the installed SQLite snapshot.
const {TABLE_KEYS}=require('./cloud-migration-contract.cjs');

// Personal data must be migrated once AND then synchronized bidirectionally.
const PERSONAL_TABLES=Object.freeze([
  'profiles','transactions','budgets','financial_settings',
  'categories','category_rules','bank_category_overrides',
  'bank_transaction_notes','bank_transaction_splits','bank_manual_links',
  'merchant_aliases','bank_duplicate_dismissals',
  'planned_items','planned_bank_links','planned_rejected_matches',
  'planned_audit','bank_custom_titles'
]);
// These items are produced by Pluggy. Their original SQLite identifiers and
// historical rows remain needed for reconciliation before cutover.
const PLUGGY_TABLES=Object.freeze([
  'bank_items','bank_accounts','bank_transactions','bank_sync_history'
]);
const INTERNAL_TABLES=Object.freeze(['app_meta']);

const ALL_TABLES=Object.freeze([...PERSONAL_TABLES,...PLUGGY_TABLES,...INTERNAL_TABLES]);
if(new Set(ALL_TABLES).size!==ALL_TABLES.length ||
  ALL_TABLES.length!==Object.keys(TABLE_KEYS).length ||
  Object.keys(TABLE_KEYS).some(t=>!ALL_TABLES.includes(t))) {
  throw new Error('Contrato de sincronização incompleto: alguma tabela SQLite não foi classificada.');
}

const REQUIREMENTS=Object.freeze([
  'A primeira transferência preserva as 17 tabelas de preferências, regras, manuais, orçamentos e planejamento.',
  'A conexão Pluggy refaz a leitura de contas e lançamentos diretamente do servidor, usando credenciais apenas no servidor.',
  'A identidade bancária é estável por account_id + external_id; não inserir um lançamento duplicado a cada atualização.',
  'A migração de categorias e títulos não pode alterar description original da instituição.',
  'Os vínculos de lançamentos manuais, splits e planejamentos não são validados até os IDs bancários existirem na nuvem.',
  'Se o Pluggy não fornecer parte do histórico, conservar a cópia original e preparar backfill histórico protegido para esses IDs.',
  'Não apagar banco local nem anunciar sincronização ativa antes de reconciliação e rollback testados.',
  'O aplicativo desktop só deve passar a gravar na nuvem depois de confirmado o cutover; evitar dois bancos graváveis em paralelo.'
]);

function migrationRoutingOverview(){
  return {mode:'personal_first_pluggy_refresh',
    personalTables:[...PERSONAL_TABLES],
    bankProviderTables:[...PLUGGY_TABLES],
    localOnlyTables:[...INTERNAL_TABLES],
    // All 22 tables are accounted for; some are consumed for reconciliation,
    // not copied as the primary remote bank data source.
    totalMappedTables:ALL_TABLES.length,
    verificationMandatory:true,
    realTransferEnabled:false,
    backgroundSyncEnabled:false,
    serverPluggyConfigured:false};
}

module.exports={PERSONAL_TABLES,PLUGGY_TABLES,INTERNAL_TABLES,ALL_TABLES,
  REQUIREMENTS,migrationRoutingOverview};
