'use strict';

// Pre-migration structural audit. Intentionally read-only.
// Never serializes transaction rows, balances, credentials or personal notes.
const REQUIRED_TABLES = Object.freeze([
  'app_meta', 'profiles', 'transactions', 'budgets', 'financial_settings',
  'bank_items', 'bank_accounts', 'bank_transactions', 'bank_sync_history',
  'categories', 'category_rules', 'bank_category_overrides',
  'bank_transaction_notes', 'bank_transaction_splits', 'bank_manual_links',
  'merchant_aliases', 'bank_duplicate_dismissals', 'planned_items',
  'planned_bank_links', 'planned_rejected_matches', 'planned_audit',
  'bank_custom_titles'
]);

// These columns embody invariants which must survive any future cloud migration.
const REQUIRED_COLUMNS = Object.freeze({
  transactions: ['profile', 'id', 'date', 'description', 'kind', 'amount_cents', 'category', 'origin'],
  budgets: ['profile', 'category', 'amount_cents'],
  bank_accounts: ['account_id', 'item_id', 'balance_cents', 'updated_at'],
  bank_transactions: ['account_id', 'external_id', 'date', 'description', 'amount_cents', 'status', 'updated_at'],
  categories: ['name', 'color', 'emoji', 'kind'],
  category_rules: ['id', 'pattern', 'match_mode', 'category', 'scope', 'priority', 'enabled'],
  bank_transaction_notes: ['account_id', 'external_id', 'nature', 'reviewed_at'],
  bank_transaction_splits: ['account_id', 'external_id', 'position', 'category', 'amount_cents'],
  bank_manual_links: ['account_id', 'external_id', 'manual_id'],
  bank_custom_titles: ['account_id', 'external_id', 'title'],
  planned_items: ['id', 'group_id', 'group_type', 'title', 'kind', 'amount_cents', 'due_date', 'certainty', 'status'],
  planned_bank_links: ['item_id', 'account_id', 'external_id'],
  planned_rejected_matches: ['item_id', 'account_id', 'external_id'],
  planned_audit: ['item_id', 'action', 'at']
});

function inspectDesktopSchema(database) {
  const db = database?.db || database;
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Banco SQLite inválido.');
  const available = new Set(db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all().map(row => row.name));
  const missingTables = REQUIRED_TABLES.filter(name => !available.has(name));
  const missingColumns = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!available.has(table)) continue;
    // Table names are exclusively trusted compile-time constants above.
    const existing = new Set(db.prepare('PRAGMA table_info("' + table + '")').all().map(row => row.name));
    for (const column of columns) {
      if (!existing.has(column)) missingColumns.push(table + '.' + column);
    }
  }
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all().length;
  const integrityResult = db.prepare('PRAGMA quick_check').get();
  const integrityOK = integrityResult?.quick_check === 'ok';
  return {
    // Structural compatibility is not proof that financial migration is ready.
    schemaCompatible: missingTables.length === 0 && missingColumns.length === 0 &&
      foreignKeyViolations === 0 && integrityOK,
    checkedTables: REQUIRED_TABLES.length,
    missingTables,
    missingColumns,
    foreignKeyViolationCount: foreignKeyViolations,
    integrityOK,
    // Never return the current data, values, rows, or confidential identifiers.
    financialDataIncluded: false
  };
}

module.exports = { REQUIRED_TABLES, REQUIRED_COLUMNS, inspectDesktopSchema };
