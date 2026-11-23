'use strict';
// M3 / RC-ALL-FULL: canonical supervised personal-write proposal gateway.
// No generic IPC or autonomous AI SQLite writes. Production commits stay disabled
// unless MAIN grants explicit owner-consented capability (or synthetic factory vault).
const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { D05CategoryService } = require('./d05-category-service.cjs');
const { assertSyntheticVault } = require('./intelligence-category-vault.cjs');

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

const ACTIONS = new Set([
  'manual.categorize',
  'manual.batch-categorize',
  'bank.categorize',
  'bank.batch-categorize',
  'bank.split',
  'rule.save',
  'planning.categorize',
  'budgets.reorganize'
]);

const UNDOABLE_ACTIONS = new Set([
  'manual.categorize',
  'manual.batch-categorize',
  'bank.categorize',
  'bank.batch-categorize',
  'bank.split',
  'planning.categorize',
  'budgets.reorganize'
]);

function denyReserved(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) =>
      [
        'owner',
        'approved',
        'gestureVerified',
        'verifiedGesture',
        'finance',
        'sql',
        'db',
        'vault',
        'filePath',
        'scope',
        'environment',
        'allowWrite'
      ].includes(k)
    )
  ) {
    throw Error('PersonalWrite: entrada ou autorização adulterada');
  }
}

class D05PersonalWriteGateway {
  constructor({
    finance,
    readSession,
    confirm,
    backupDirectory,
    approvedForPersonal,
    m3CapabilityCheck = () => false,
    syntheticVault = null,
    clock = () => Date.now(),
    ttlMs = 5 * 60 * 1000,
    faults = {}
  } = {}) {
    if (
      typeof finance !== 'function' ||
      typeof readSession !== 'function' ||
      typeof confirm !== 'function' ||
      typeof backupDirectory !== 'function' ||
      typeof approvedForPersonal !== 'function'
    ) {
      throw Error('PersonalWrite: hooks de MAIN obrigatórios');
    }
    this.finance = finance;
    this.readSession = readSession;
    this.confirm = confirm;
    this.backupDirectory = backupDirectory;
    this.approvedForPersonal = approvedForPersonal;
    this.m3CapabilityCheck = typeof m3CapabilityCheck === 'function' ? m3CapabilityCheck : () => false;
    this.syntheticVault = syntheticVault;
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.previews = new Map();
    this.busy = false;
    this.faults = faults;
  }

  stopAll() {
    this.previews.clear();
  }

  fault(stage) {
    const x = this.faults[stage];
    if (x === true) throw Error('SYNTHETIC_FAULT_' + stage);
    if (typeof x === 'function') x();
  }

  verify(event, input, action) {
    denyReserved(input);
    const s = this.readSession(event, input);
    const owner = event?.sender?.id;
    if (!Number.isInteger(owner) || owner < 0 || !s || s.owner !== owner) {
      throw Error('PersonalWrite: proprietário inválido');
    }
    if (action && !ACTIONS.has(action)) throw Error('PersonalWrite: ação não suportada');
    if (s.profile === 'real' && typeof input.accountId === 'string' && input.accountId !== s.activeAccountId) {
      throw Error('PersonalWrite: conta fora da autorização');
    }
    return { s, owner };
  }

  service() {
    return new D05CategoryService(this.finance());
  }

  capture(action, request, s) {
    const finance = this.finance();
    const sql = finance.db;
    const svc = this.service();
    const v = request.target ? svc.resolve(request.target) : null;
    if (
      request.target &&
      (!Object.prototype.hasOwnProperty.call(request.target, 'subcategoryId') ||
        Object.keys(request.target).some((k) => !['categoryId', 'subcategoryId'].includes(k)))
    ) {
      throw Error('PersonalWrite: destino D05 incompleto ou ambíguo');
    }
    const after = v
      ? {
          categoryId: v.categoryId,
          subcategoryId: v.subcategoryId,
          category: v.parentName,
          subcategory: v.child?.name || null
        }
      : null;

    if (action === 'manual.categorize') {
      if (request.profile !== s.profile || typeof request.id !== 'string') {
        throw Error('PersonalWrite: perfil manual inválido');
      }
      const before = sql
        .prepare(
          'SELECT profile,id,date,kind,amount_cents,category,category_id,subcategory_id FROM transactions WHERE profile=? AND id=?'
        )
        .get(s.profile, request.id);
      if (!before || !after) throw Error('PersonalWrite: movimentação inválida');
      return { before, after, accountId: null, amountCents: before.amount_cents };
    }

    if (action === 'manual.batch-categorize') {
      if (request.profile !== s.profile || !after) throw Error('PersonalWrite: lote manual inválido');
      const rawItems = Array.isArray(request.items) ? request.items : [];
      if (!rawItems.length || rawItems.length > 100) throw Error('PersonalWrite: lote manual inválido');
      const seen = new Set();
      const before = [];
      for (const item of rawItems) {
        const id = typeof item === 'string' ? item : item?.id;
        if (typeof id !== 'string' || !id || seen.has(id)) {
          throw Error('PersonalWrite: item ou duplicata inválida no lote manual');
        }
        seen.add(id);
        const row = sql
          .prepare(
            'SELECT profile,id,date,kind,amount_cents,category,category_id,subcategory_id FROM transactions WHERE profile=? AND id=?'
          )
          .get(s.profile, id);
        if (!row) throw Error('PersonalWrite: movimentação manual inexistente');
        before.push(row);
      }
      before.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return {
        before,
        after,
        accountId: null,
        amountCents: before.reduce((n, r) => n + Math.abs(r.amount_cents), 0)
      };
    }

    if (action === 'bank.categorize' || action === 'bank.batch-categorize' || action === 'bank.split') {
      if (s.profile !== 'real' || typeof s.activeAccountId !== 'string' || !s.activeAccountId) {
        throw Error('PersonalWrite: conta bancária não autorizada no MAIN');
      }
      const items =
        action === 'bank.batch-categorize'
          ? request.items
          : [{ accountId: request.accountId, externalId: request.externalId }];
      if (!Array.isArray(items) || !items.length || items.length > 100) {
        throw Error('PersonalWrite: lote inválido');
      }
      const seen = new Set();
      const before = [];
      for (const id of items) {
        if (
          !id ||
          id.accountId !== s.activeAccountId ||
          typeof id.externalId !== 'string' ||
          !id.externalId ||
          Object.keys(id).some((k) => !['accountId', 'externalId'].includes(k))
        ) {
          throw Error('PersonalWrite: transação de outra conta');
        }
        const k = id.accountId + '|' + id.externalId;
        if (seen.has(k)) throw Error('PersonalWrite: ID duplicado');
        seen.add(k);
        const row = sql
          .prepare(
            'SELECT account_id,external_id,status,amount_cents,category FROM bank_transactions WHERE account_id=? AND external_id=?'
          )
          .get(id.accountId, id.externalId);
        if (!row) throw Error('PersonalWrite: registro bancário inexistente');
        const override =
          sql
            .prepare(
              'SELECT category,category_id,subcategory_id FROM bank_category_overrides WHERE account_id=? AND external_id=?'
            )
            .get(id.accountId, id.externalId) || null;
        const splits = sql
          .prepare(
            'SELECT position,category,category_id,subcategory_id,amount_cents FROM bank_transaction_splits WHERE account_id=? AND external_id=? ORDER BY position'
          )
          .all(id.accountId, id.externalId);
        before.push({ row, override, splits });
      }
      if (action !== 'bank.split' && !after) throw Error('PersonalWrite: destino hierárquico obrigatório');
      if (action === 'bank.batch-categorize') {
        const preview = svc.previewBankBatch({ items, target: request.target });
        if (preview.previewVersion !== request.previewVersion || preview.count !== items.length) {
          throw Error('PersonalWrite: previewVersion do lote desatualizado');
        }
      }
      if (action === 'bank.split') {
        if (!Array.isArray(request.parts)) throw Error('PersonalWrite: partes ausentes');
        for (const part of request.parts) {
          if (!part || !Number.isSafeInteger(part.amount) || part.amount <= 0) {
            throw Error('PersonalWrite: parcela inválida');
          }
          svc.resolve(part.target);
        }
      }
      return {
        before,
        after,
        accountId: s.activeAccountId,
        amountCents: before.reduce((n, x) => n + Math.abs(x.row.amount_cents), 0),
        splitsAfter: action === 'bank.split' ? request.parts : null
      };
    }

    if (action === 'rule.save') {
      if (s.profile !== 'real' || !s.activeAccountId) {
        throw Error('PersonalWrite: regras bancárias sem conta selecionada');
      }
      // E2's rule schema has no account-bound future-only constraint. Personal
      // rule writes remain blocked until S3 lands account/afterRowid constraint support.
      throw Error('PersonalWrite: regra pessoal sem contrato por conta/afterRowid');
    }

    if (action === 'planning.categorize') {
      if (s.profile !== 'real' || !after || typeof request.id !== 'string') {
        throw Error('PersonalWrite: planejamento inválido');
      }
      const before = sql
        .prepare('SELECT id,category,category_id,subcategory_id,amount_cents,account_id FROM planned_items WHERE id=?')
        .get(request.id);
      if (!before || (before.account_id && before.account_id !== s.activeAccountId)) {
        throw Error('PersonalWrite: compromisso fora da conta');
      }
      return { before, after, accountId: before.account_id || null, amountCents: before.amount_cents };
    }

    if (action === 'budgets.reorganize') {
      if (request.profile !== s.profile) throw Error('PersonalWrite: perfil de orçamento inválido');
      const month = request.month == null ? null : String(request.month).trim();
      if (month !== null && !/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) {
        throw Error('PersonalWrite: mês de orçamento inválido');
      }
      const applyRecurring = month === null ? true : request.applyRecurring === true;
      const rawBudgets = Array.isArray(request.budgets) ? request.budgets : [];
      if (!rawBudgets.length || rawBudgets.length > 50) {
        throw Error('PersonalWrite: lote de orçamentos inválido');
      }
      const allowedCats = new Map(
        sql.prepare("SELECT name,kind FROM categories WHERE kind!='income'").all().map((c) => [c.name, c])
      );
      const seenCats = new Set();
      const normalizedBudgets = [];
      for (const item of rawBudgets) {
        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          Object.keys(item).some((k) => !['category', 'amountCents'].includes(k))
        ) {
          throw Error('PersonalWrite: item de orçamento inválido');
        }
        const cat = String(item.category || '').trim();
        if (!cat || !allowedCats.has(cat) || seenCats.has(cat)) {
          throw Error('PersonalWrite: categoria de orçamento inválida ou duplicada');
        }
        if (!Number.isSafeInteger(item.amountCents) || item.amountCents < 0 || item.amountCents > 100_000_000_000) {
          throw Error('PersonalWrite: valor de orçamento inválido');
        }
        seenCats.add(cat);
        normalizedBudgets.push({ category: cat, amountCents: item.amountCents });
      }
      normalizedBudgets.sort((a, b) => a.category.localeCompare(b.category, 'en'));

      const updateIncome = request.updateIncomeSetting === true;
      let salaryCents = null;
      if (updateIncome) {
        if (!Number.isSafeInteger(request.salaryCents) || request.salaryCents <= 0 || request.salaryCents > 100_000_000_000) {
          throw Error('PersonalWrite: valor de salário inválido para configuração');
        }
        salaryCents = request.salaryCents;
      }

      const priorRecurringBudgets = applyRecurring
        ? normalizedBudgets.map((nb) => {
            const row = sql
              .prepare('SELECT amount_cents FROM budgets WHERE profile=? AND category=?')
              .get(s.profile, nb.category);
            return { category: nb.category, existed: !!row, amount_cents: row ? row.amount_cents : null };
          })
        : [];
      const hasMonthlyTable = !!sql
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monthly_budgets'")
        .get();
      const priorMonthlyBudgets = month && hasMonthlyTable
        ? normalizedBudgets.map((nb) => {
            const row = sql
              .prepare('SELECT amount_cents FROM monthly_budgets WHERE profile=? AND month=? AND category=?')
              .get(s.profile, month, nb.category);
            return { category: nb.category, existed: !!row, amount_cents: row ? row.amount_cents : null };
          })
        : [];
      let incomeSetting = null;
      if (updateIncome) {
        const incRow = sql
          .prepare("SELECT value_cents FROM financial_settings WHERE profile=? AND name='income'")
          .get(s.profile);
        incomeSetting = { existed: !!incRow, value_cents: incRow ? incRow.value_cents : null };
      }
      const totalCents = normalizedBudgets.reduce((acc, b) => acc + b.amountCents, 0);
      return {
        before: {
          profile: s.profile,
          month,
          applyRecurring,
          budgets: priorRecurringBudgets,
          monthlyBudgets: priorMonthlyBudgets,
          incomeSetting
        },
        after: {
          month,
          applyRecurring,
          budgets: normalizedBudgets,
          updateIncomeSetting: updateIncome,
          salaryCents
        },
        accountId: null,
        amountCents: totalCents
      };
    }

    throw Error('PersonalWrite: operação não disponível');
  }

  async prepare(event, input) {
    const action = input?.action;
    const { s, owner } = this.verify(event, input, action);
    const request = { ...input };
    delete request.sessionToken;
    delete request.action;
    const state = this.capture(action, request, s);
    const db = this.finance();
    const digest = hash([state, this.catalogRevision(db)]);
    const id = randomUUID();
    const nonce = randomUUID();
    const expiresAt = this.clock() + this.ttlMs;
    this.previews.set(id, {
      id,
      owner,
      session: s,
      action,
      request,
      digest,
      nonce,
      expiresAt,
      db,
      accountId: state.accountId,
      before: state.before,
      after: state.after,
      splitsAfter: state.splitsAfter || null,
      amountCents: state.amountCents
    });
    if (this.previews.size > 60) this.previews.delete(this.previews.keys().next().value);
    const personalAuthorized = this.approvedForPersonal() === true || this.m3CapabilityCheck() === true;
    const affectedCount = Array.isArray(state.before)
      ? state.before.length
      : Array.isArray(state.after?.budgets)
        ? state.after.budgets.length
        : 1;
    return {
      contract: 'D05/PERSONAL-SUPERVISED-PREVIEW-V1',
      proposalId: id,
      nonce,
      expiresAt,
      action,
      source: s.profile === 'demo' ? 'manual' : action.startsWith('manual.') || action === 'budgets.reorganize' ? 'manual' : 'bank',
      profile: s.profile,
      accountId: state.accountId,
      before: state.before,
      after: state.after,
      amountCents: state.amountCents,
      affectedCount,
      changesApplied: false,
      personalWriteAuthorized: personalAuthorized,
      needs: personalAuthorized ? 'NATIVE_CONFIRMATION' : 'OWNER_APPROVAL_AND_QA',
      readOnly: true
    };
  }

  catalogRevision(finance) {
    const sql = finance.db;
    return {
      categories: sql.prepare('SELECT id,name,kind FROM categories ORDER BY id').all(),
      subcategories: sql
        .prepare('SELECT id,parent_category_id,name,active FROM subcategories ORDER BY id')
        .all(),
      rules: sql
        .prepare('SELECT id,pattern,match_mode,category,priority,enabled,category_id,subcategory_id FROM category_rules ORDER BY id')
        .all()
    };
  }

  ensureSynthetic() {
    if (!this.syntheticVault) return false;
    assertSyntheticVault(this.syntheticVault, this.finance());
    return true;
  }

  execute(service, action, request) {
    if (action === 'manual.categorize') return service.assignManual(request);
    if (action === 'manual.batch-categorize') {
      const ids = request.items.map((x) => (typeof x === 'string' ? x : x.id));
      let last = null;
      for (const id of ids) {
        last = service.assignManual({ profile: request.profile, id, target: request.target });
      }
      return {
        profile: request.profile,
        changed: ids.length,
        ids,
        categoryId: last?.categoryId ?? null,
        subcategoryId: last?.subcategoryId ?? null
      };
    }
    if (action === 'bank.categorize') return service.assignBank(request);
    if (action === 'bank.batch-categorize') return service.assignBankBatch(request);
    if (action === 'bank.split') return service.setBankSplits(request);
    if (action === 'planning.categorize') return service.assignPlanned(request);
    if (action === 'budgets.reorganize') {
      const sql = service.db;
      const month = request.month == null ? null : String(request.month).trim();
      const applyRecurring = month === null ? true : request.applyRecurring === true;
      let totalBudgetCents = 0;
      if (month) {
        sql.exec(`
          CREATE TABLE IF NOT EXISTS monthly_budgets (
            profile TEXT NOT NULL REFERENCES profiles(profile) ON DELETE CASCADE,
            month TEXT NOT NULL CHECK(month GLOB '20[0-9][0-9]-[0-1][0-9]'),
            category TEXT NOT NULL,
            amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
            updated_at TEXT NOT NULL,
            PRIMARY KEY(profile,month,category)
          );
        `);
        const upsertMonthly = sql.prepare(
          'INSERT INTO monthly_budgets(profile,month,category,amount_cents,updated_at) VALUES(?,?,?,?,?) ' +
            'ON CONFLICT(profile,month,category) DO UPDATE SET amount_cents=excluded.amount_cents,updated_at=excluded.updated_at'
        );
        const nowIso = new Date().toISOString();
        for (const b of request.budgets) {
          upsertMonthly.run(request.profile, month, b.category, b.amountCents, nowIso);
        }
      }
      const upsertBudget = applyRecurring
        ? sql.prepare(
            'INSERT INTO budgets(profile,category,amount_cents) VALUES(?,?,?) ' +
              'ON CONFLICT(profile,category) DO UPDATE SET amount_cents=excluded.amount_cents'
          )
        : null;
      for (const b of request.budgets) {
        if (upsertBudget) upsertBudget.run(request.profile, b.category, b.amountCents);
        totalBudgetCents += b.amountCents;
      }
      const incomeUpdated = request.updateIncomeSetting === true;
      if (incomeUpdated) {
        sql
          .prepare(
            "INSERT INTO financial_settings(profile,name,value_cents) VALUES(?,'income',?) " +
              'ON CONFLICT(profile,name) DO UPDATE SET value_cents=excluded.value_cents'
          )
          .run(request.profile, request.salaryCents);
      }
      return {
        profile: request.profile,
        month,
        applyRecurring,
        updatedCount: request.budgets.length,
        totalBudgetCents,
        incomeUpdated
      };
    }
    throw Error('PersonalWrite: ação não implementada');
  }

  ensureReceipt(sql) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS d05_personal_supervised_receipts (' +
        'proposal_id TEXT PRIMARY KEY,owner INTEGER NOT NULL,nonce_hash TEXT NOT NULL,' +
        'scope_hash TEXT NOT NULL,action TEXT NOT NULL,committed_at TEXT NOT NULL,' +
        'result_json TEXT NOT NULL,backup_path TEXT NOT NULL,' +
        "before_json TEXT,undo_state TEXT NOT NULL DEFAULT 'available')"
    );
    const cols = new Set(sql.prepare('PRAGMA table_info(d05_personal_supervised_receipts)').all().map((c) => c.name));
    if (!cols.has('before_json')) sql.exec('ALTER TABLE d05_personal_supervised_receipts ADD COLUMN before_json TEXT');
    if (!cols.has('undo_state')) {
      sql.exec("ALTER TABLE d05_personal_supervised_receipts ADD COLUMN undo_state TEXT NOT NULL DEFAULT 'available'");
    }
  }

  receipt(event, input) {
    const { s, owner } = this.verify(event, input);
    if (typeof input.proposalId !== 'string') throw Error('PersonalWrite: ID do recibo inválido');
    const sql = this.finance().db;
    if (
      !sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get()
    ) {
      return { status: 'unavailable', changesApplied: false };
    }
    this.ensureReceipt(sql);
    const scopeHash = hash([s.owner, s.token, s.profile, s.activeAccountId || null]);
    let row = sql
      .prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=? AND owner=? AND scope_hash=?')
      .get(input.proposalId, owner, scopeHash);
    if (row) {
      return {
        status: 'applied',
        changesApplied: true,
        undoState: row.undo_state || 'available',
        receipt: JSON.parse(row.result_json)
      };
    }
    // After a TEST vault restart, webContents.id and token necessarily change.
    // Only the factory-signed synthetic vault may recover a receipt under a
    // newly consented session matching both profile and account identity.
    // This does NOT reopen personal/production receipts across owners.
    if (!this.syntheticVault) return { status: 'unavailable', changesApplied: false };
    this.ensureSynthetic();
    row = sql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(input.proposalId);
    if (!row) return { status: 'unavailable', changesApplied: false };
    const persisted = JSON.parse(row.result_json);
    if (
      persisted.syntheticOnly !== true ||
      persisted.profile !== s.profile ||
      (persisted.accountId || null) !== (s.activeAccountId || null)
    ) {
      return { status: 'unavailable', changesApplied: false };
    }
    return {
      status: 'applied',
      recovered: true,
      changesApplied: true,
      undoState: row.undo_state || 'available',
      receipt: persisted
    };
  }

  listReceipts(event, input = {}) {
    const { s, owner } = this.verify(event, input || {});
    const limit = Number.isInteger(input?.limit) ? Math.min(50, Math.max(1, input.limit)) : 20;
    const sql = this.finance().db;
    if (
      !sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get()
    ) {
      return [];
    }
    this.ensureReceipt(sql);
    const scopeHash = hash([s.owner, s.token, s.profile, s.activeAccountId || null]);
    const rows = sql
      .prepare(
        'SELECT proposal_id,action,committed_at,undo_state,result_json FROM d05_personal_supervised_receipts WHERE owner=? AND scope_hash=? ORDER BY committed_at DESC LIMIT ?'
      )
      .all(owner, scopeHash, limit);
    return rows.map((r) => ({
      proposalId: r.proposal_id,
      action: r.action,
      committedAt: r.committed_at,
      undoState: r.undo_state || 'available',
      receipt: JSON.parse(r.result_json)
    }));
  }

  async confirmPreview(event, input) {
    const { s, owner } = this.verify(event, input);
    const id = input.proposalId;
    if (typeof id !== 'string' || typeof input.nonce !== 'string') {
      return { status: 'denied', changesApplied: false };
    }
    // A committed operation is idempotent across retries and process restart;
    // do not require an in-memory proposal after the first successful COMMIT.
    const knownSql = this.finance().db;
    if (
      knownSql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get()
    ) {
      this.ensureReceipt(knownSql);
      const previous = knownSql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
      if (previous) {
        const scopeHash = hash([s.owner, s.token, s.profile, s.activeAccountId || null]);
        if (previous.owner !== owner || previous.nonce_hash !== hash(input.nonce) || previous.scope_hash !== scopeHash) {
          return { status: 'denied', changesApplied: false };
        }
        return {
          status: 'applied',
          replayed: true,
          changesApplied: true,
          undoState: previous.undo_state || 'available',
          receipt: JSON.parse(previous.result_json)
        };
      }
    }

    const p = this.previews.get(id);
    if (!p || p.owner !== owner || p.session !== s || p.expiresAt <= this.clock() || p.nonce !== input.nonce) {
      return { status: 'stale', changesApplied: false };
    }
    if (this.busy) return { status: 'denied', changesApplied: false, reason: 'Confirmação em andamento' };

    const synthetic = this.ensureSynthetic();
    const m3Allowed = this.m3CapabilityCheck() === true;
    if (!synthetic && this.approvedForPersonal() !== true && !m3Allowed) {
      return {
        status: 'denied',
        changesApplied: false,
        personalWriteAuthorized: false,
        reason: 'Escrita pessoal ainda não homologada/aprovada pelo proprietário.'
      };
    }

    const db = this.finance();
    if (p.db !== db || (!synthetic && (db.filename === ':memory:' || !path.isAbsolute(db.filename)))) {
      return { status: 'denied', changesApplied: false, reason: 'SQLite sem isolamento comprovado' };
    }

    const sql = db.db;
    const scopeHash = hash([s.owner, s.token, s.profile, s.activeAccountId || null]);
    this.busy = true;
    let begun = false;
    let committed = false;
    let backup = null;
    try {
      this.ensureReceipt(sql);
      const previous = sql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
      if (previous) {
        if (previous.owner !== owner || previous.nonce_hash !== hash(input.nonce) || previous.scope_hash !== scopeHash) {
          return { status: 'denied', changesApplied: false };
        }
        return {
          status: 'applied',
          replayed: true,
          changesApplied: true,
          undoState: previous.undo_state || 'available',
          receipt: JSON.parse(previous.result_json)
        };
      }

      const freshState = this.capture(p.action, p.request, s);
      if (hash([freshState, this.catalogRevision(db)]) !== p.digest) {
        return { status: 'stale', changesApplied: false, reason: 'Prévia desatualizada' };
      }

      const freshAffected = Array.isArray(freshState.before)
        ? freshState.before.length
        : Array.isArray(freshState.after?.budgets)
          ? freshState.after.budgets.length
          : 1;
      const accepted = await this.confirm({
        kind: 'write',
        owner,
        action: p.action,
        profile: s.profile,
        accountId: s.activeAccountId || null,
        proposalId: id,
        amountCents: freshState.amountCents,
        count: freshAffected,
        after: freshState.after,
        syntheticOnly: synthetic
      });
      if (accepted !== true) return { status: 'denied', changesApplied: false, reason: 'Usuário cancelou' };

      if (
        p.expiresAt <= this.clock() ||
        this.verify(event, input).s !== s ||
        this.finance() !== db ||
        hash([this.capture(p.action, p.request, s), this.catalogRevision(db)]) !== p.digest
      ) {
        return { status: 'stale', changesApplied: false, reason: 'Alteração durante o consentimento' };
      }

      const folder = this.backupDirectory();
      fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
      backup = path.join(folder, 'd05-personal-before-' + id + '.sqlite');
      await db.backupTo(backup);
      if (fs.statSync(backup).size <= 0) throw Error('PersonalWrite: backup vazio');

      if (
        this.verify(event, input).s !== s ||
        this.finance() !== db ||
        hash([this.capture(p.action, p.request, s), this.catalogRevision(db)]) !== p.digest
      ) {
        return { status: 'stale', changesApplied: false, reason: 'Alteração durante backup' };
      }

      sql.exec('BEGIN IMMEDIATE');
      begun = true;
      if (hash([this.capture(p.action, p.request, s), this.catalogRevision(db)]) !== p.digest) {
        throw Error('PersonalWrite: prévia stale dentro da transação');
      }
      const result = this.execute(new D05CategoryService(db), p.action, p.request);
      this.fault('after_apply');
      if (!result || typeof result !== 'object' || result instanceof Promise) {
        throw Error('PersonalWrite: resultado inválido');
      }
      const receipt = {
        proposalId: id,
        action: p.action,
        profile: s.profile,
        accountId: p.accountId,
        changesApplied: true,
        syntheticOnly: synthetic,
        amountCents: freshState.amountCents,
        affectedCount: freshAffected,
        after: freshState.after,
        splitsAfter: freshState.splitsAfter || null,
        result,
        backupVerified: true,
        undoAvailable: UNDOABLE_ACTIONS.has(p.action),
        committedAt: new Date(this.clock()).toISOString()
      };
      sql
        .prepare(
          'INSERT INTO d05_personal_supervised_receipts (' +
            'proposal_id,owner,nonce_hash,scope_hash,action,committed_at,result_json,backup_path,before_json,undo_state) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(
          id,
          owner,
          hash(input.nonce),
          scopeHash,
          p.action,
          receipt.committedAt,
          JSON.stringify(receipt),
          backup,
          JSON.stringify(freshState.before),
          'available'
        );
      this.fault('after_receipt');
      sql.exec('COMMIT');
      begun = false;
      committed = true;
      this.fault('after_commit');
      this.previews.delete(id);
      return { status: 'applied', changesApplied: true, syntheticOnly: synthetic, undoState: 'available', receipt };
    } catch (err) {
      if (begun) {
        try {
          sql.exec('ROLLBACK');
          begun = false;
        } catch {
          return {
            status: 'recovery_required',
            changesApplied: null,
            reason: 'Não foi possível comprovar rollback; consulte o recibo.'
          };
        }
      }
      if (committed) {
        return {
          status: 'recovery_required',
          changesApplied: null,
          reason: 'Falha após COMMIT; consulte o recibo. Não reexecute.'
        };
      }
      return { status: 'stale', changesApplied: false, reason: 'Falha antes do COMMIT; transação revertida.' };
    } finally {
      this.busy = false;
    }
  }

  _verifyStillAtAppliedState(sql, persisted, before) {
    const a = persisted.action;
    const after = persisted.after;
    if (a === 'manual.categorize' || a === 'manual.batch-categorize') {
      const items = a === 'manual.categorize' ? [before] : before;
      for (const item of items) {
        const cur = sql
          .prepare('SELECT category,category_id,subcategory_id FROM transactions WHERE profile=? AND id=?')
          .get(persisted.profile, item.id);
        if (
          !cur ||
          cur.category !== after.category ||
          (cur.category_id ?? null) !== (after.categoryId ?? null) ||
          (cur.subcategory_id ?? null) !== (after.subcategoryId ?? null)
        ) {
          return false;
        }
      }
      return true;
    }
    if (a === 'bank.categorize' || a === 'bank.batch-categorize') {
      for (const entry of before) {
        const cur = sql
          .prepare(
            'SELECT category,category_id,subcategory_id FROM bank_category_overrides WHERE account_id=? AND external_id=?'
          )
          .get(entry.row.account_id, entry.row.external_id);
        if (
          !cur ||
          cur.category !== after.category ||
          (cur.category_id ?? null) !== (after.categoryId ?? null) ||
          (cur.subcategory_id ?? null) !== (after.subcategoryId ?? null)
        ) {
          return false;
        }
      }
      return true;
    }
    if (a === 'planning.categorize') {
      const cur = sql.prepare('SELECT category,category_id,subcategory_id FROM planned_items WHERE id=?').get(before.id);
      return Boolean(
        cur &&
          cur.category === after.category &&
          (cur.category_id ?? null) === (after.categoryId ?? null) &&
          (cur.subcategory_id ?? null) === (after.subcategoryId ?? null)
      );
    }
    if (a === 'bank.split') {
      const entry = before[0];
      const curSplits = sql
        .prepare(
          'SELECT position,category_id,subcategory_id,amount_cents FROM bank_transaction_splits WHERE account_id=? AND external_id=? ORDER BY position'
        )
        .all(entry.row.account_id, entry.row.external_id);
      const expected = Array.isArray(persisted.splitsAfter) ? persisted.splitsAfter : [];
      if (curSplits.length !== expected.length) return false;
      for (let i = 0; i < curSplits.length; i++) {
        if (
          curSplits[i].amount_cents !== expected[i].amount ||
          (curSplits[i].category_id ?? null) !== (expected[i].target?.categoryId ?? null) ||
          (curSplits[i].subcategory_id ?? null) !== (expected[i].target?.subcategoryId ?? null)
        ) {
          return false;
        }
      }
      return true;
    }
    if (a === 'budgets.reorganize') {
      const targetBudgets = Array.isArray(after?.budgets) ? after.budgets : [];
      if (!targetBudgets.length) return false;
      const month = after?.month || null;
      const applyRecurring = month === null ? true : after?.applyRecurring === true;
      for (const b of targetBudgets) {
        if (month) {
          const mcur = sql
            .prepare('SELECT amount_cents FROM monthly_budgets WHERE profile=? AND month=? AND category=?')
            .get(persisted.profile, month, b.category);
          if (!mcur || mcur.amount_cents !== b.amountCents) return false;
        }
        if (applyRecurring) {
          const cur = sql
            .prepare('SELECT amount_cents FROM budgets WHERE profile=? AND category=?')
            .get(persisted.profile, b.category);
          if (!cur || cur.amount_cents !== b.amountCents) return false;
        }
      }
      if (after.updateIncomeSetting === true) {
        const inc = sql
          .prepare("SELECT value_cents FROM financial_settings WHERE profile=? AND name='income'")
          .get(persisted.profile);
        if (!inc || inc.value_cents !== after.salaryCents) return false;
      }
      return true;
    }
    return false;
  }

  _restoreBeforeState(sql, persisted, before) {
    const a = persisted.action;
    if (a === 'manual.categorize' || a === 'manual.batch-categorize') {
      const stmt = sql.prepare(
        'UPDATE transactions SET category=?,category_id=?,subcategory_id=? WHERE profile=? AND id=?'
      );
      const items = a === 'manual.categorize' ? [before] : before;
      for (const item of items) {
        stmt.run(item.category, item.category_id ?? null, item.subcategory_id ?? null, persisted.profile, item.id);
      }
      return;
    }
    if (a === 'bank.categorize' || a === 'bank.batch-categorize') {
      const del = sql.prepare('DELETE FROM bank_category_overrides WHERE account_id=? AND external_id=?');
      const upsert = sql.prepare(
        'INSERT INTO bank_category_overrides(account_id,external_id,category,category_id,subcategory_id) VALUES(?,?,?,?,?) ' +
          'ON CONFLICT(account_id,external_id) DO UPDATE SET category=excluded.category,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id'
      );
      for (const entry of before) {
        if (!entry.override) {
          del.run(entry.row.account_id, entry.row.external_id);
        } else {
          upsert.run(
            entry.row.account_id,
            entry.row.external_id,
            entry.override.category,
            entry.override.category_id ?? null,
            entry.override.subcategory_id ?? null
          );
        }
      }
      return;
    }
    if (a === 'planning.categorize') {
      sql
        .prepare('UPDATE planned_items SET category=?,category_id=?,subcategory_id=? WHERE id=?')
        .run(before.category, before.category_id ?? null, before.subcategory_id ?? null, before.id);
      return;
    }
    if (a === 'bank.split') {
      const entry = before[0];
      sql
        .prepare('DELETE FROM bank_transaction_splits WHERE account_id=? AND external_id=?')
        .run(entry.row.account_id, entry.row.external_id);
      const add = sql.prepare(
        'INSERT INTO bank_transaction_splits(account_id,external_id,position,category,amount_cents,category_id,subcategory_id) VALUES(?,?,?,?,?,?,?)'
      );
      const oldSplits = Array.isArray(entry.splits) ? entry.splits : [];
      oldSplits.forEach((sp, i) => {
        add.run(
          entry.row.account_id,
          entry.row.external_id,
          i,
          sp.category || 'Outros',
          sp.amount_cents,
          sp.category_id ?? null,
          sp.subcategory_id ?? null
        );
      });
      return;
    }
    if (a === 'budgets.reorganize') {
      const month = before.month || null;
      if (month && Array.isArray(before.monthlyBudgets)) {
        const delMonthly = sql.prepare('DELETE FROM monthly_budgets WHERE profile=? AND month=? AND category=?');
        const upsertMonthly = sql.prepare(
          'INSERT INTO monthly_budgets(profile,month,category,amount_cents,updated_at) VALUES(?,?,?,?,?) ' +
            'ON CONFLICT(profile,month,category) DO UPDATE SET amount_cents=excluded.amount_cents,updated_at=excluded.updated_at'
        );
        const nowIso = new Date().toISOString();
        for (const item of before.monthlyBudgets) {
          if (!item.existed) {
            delMonthly.run(persisted.profile, month, item.category);
          } else {
            upsertMonthly.run(persisted.profile, month, item.category, item.amount_cents, nowIso);
          }
        }
      }
      const delBudget = sql.prepare('DELETE FROM budgets WHERE profile=? AND category=?');
      const upsertBudget = sql.prepare(
        'INSERT INTO budgets(profile,category,amount_cents) VALUES(?,?,?) ' +
          'ON CONFLICT(profile,category) DO UPDATE SET amount_cents=excluded.amount_cents'
      );
      for (const item of before.budgets || []) {
        if (!item.existed) {
          delBudget.run(persisted.profile, item.category);
        } else {
          upsertBudget.run(persisted.profile, item.category, item.amount_cents);
        }
      }
      if (before.incomeSetting) {
        if (!before.incomeSetting.existed) {
          sql.prepare("DELETE FROM financial_settings WHERE profile=? AND name='income'").run(persisted.profile);
        } else {
          sql
            .prepare(
              "INSERT INTO financial_settings(profile,name,value_cents) VALUES(?,'income',?) " +
                'ON CONFLICT(profile,name) DO UPDATE SET value_cents=excluded.value_cents'
            )
            .run(persisted.profile, before.incomeSetting.value_cents);
        }
      }
    }
  }

  async undoReceipt(event, input) {
    const { s, owner } = this.verify(event, input);
    const id = input?.proposalId;
    if (typeof id !== 'string' || !id) throw Error('PersonalWrite: ID do recibo inválido');
    if (this.busy) return { status: 'denied', changesApplied: false, reason: 'Operação em andamento' };

    const synthetic = this.ensureSynthetic();
    const m3Allowed = this.m3CapabilityCheck() === true;
    if (!synthetic && this.approvedForPersonal() !== true && !m3Allowed) {
      return { status: 'denied', changesApplied: false, reason: 'Reversão pessoal não habilitada.' };
    }

    const db = this.finance();
    if (!db || (!synthetic && (db.filename === ':memory:' || !path.isAbsolute(db.filename)))) {
      return { status: 'denied', changesApplied: false, reason: 'SQLite sem isolamento comprovado' };
    }
    const sql = db.db;
    if (
      !sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d05_personal_supervised_receipts'").get()
    ) {
      return { status: 'unavailable', changesApplied: false };
    }
    this.ensureReceipt(sql);
    const scopeHash = hash([s.owner, s.token, s.profile, s.activeAccountId || null]);
    const row = sql.prepare('SELECT * FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
    if (!row) return { status: 'unavailable', changesApplied: false };
    if (row.owner !== owner || row.scope_hash !== scopeHash) {
      return { status: 'denied', changesApplied: false, reason: 'Recibo pertence a outro escopo.' };
    }
    const persisted = JSON.parse(row.result_json);
    if (!UNDOABLE_ACTIONS.has(persisted.action) || !row.before_json) {
      return { status: 'unsupported', changesApplied: false, reason: 'Ação não possui snapshot reversível.' };
    }
    if ((row.undo_state || 'available') !== 'available') {
      return { status: 'already_undone', changesApplied: false, receipt: persisted };
    }
    const before = JSON.parse(row.before_json);
    if (!this._verifyStillAtAppliedState(sql, persisted, before)) {
      return {
        status: 'stale',
        changesApplied: false,
        reason: 'Os registros foram alterados após a aplicação; reversão automática bloqueada.'
      };
    }

    const accepted = await this.confirm({
      kind: 'undo',
      owner,
      action: persisted.action,
      profile: s.profile,
      accountId: persisted.accountId || null,
      proposalId: id,
      amountCents: persisted.amountCents || 0,
      count: persisted.affectedCount || 1,
      after: persisted.after,
      syntheticOnly: synthetic
    });
    if (accepted !== true) return { status: 'denied', changesApplied: false, reason: 'Reversão cancelada' };

    this.busy = true;
    let begun = false;
    try {
      const recheckRow = sql.prepare('SELECT undo_state FROM d05_personal_supervised_receipts WHERE proposal_id=?').get(id);
      if (!recheckRow || recheckRow.undo_state !== 'available') {
        return { status: 'already_undone', changesApplied: false };
      }
      if (
        this.verify(event, input).s !== s ||
        this.finance() !== db ||
        !this._verifyStillAtAppliedState(sql, persisted, before)
      ) {
        return { status: 'stale', changesApplied: false, reason: 'Alteração detectada durante a confirmação de desfazer.' };
      }

      const folder = this.backupDirectory();
      fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
      const undoBackup = path.join(folder, 'd05-personal-before-undo-' + id + '.sqlite');
      await db.backupTo(undoBackup);
      if (fs.statSync(undoBackup).size <= 0) throw Error('PersonalWrite: backup pré-reversão vazio');

      sql.exec('BEGIN IMMEDIATE');
      begun = true;
      if (!this._verifyStillAtAppliedState(sql, persisted, before)) {
        throw Error('PersonalWrite: estado alterado antes do rollback');
      }
      this._restoreBeforeState(sql, persisted, before);
      const upd = sql
        .prepare("UPDATE d05_personal_supervised_receipts SET undo_state='undone' WHERE proposal_id=? AND undo_state='available'")
        .run(id);
      if (upd.changes !== 1) throw Error('PersonalWrite: recibo já revertido');
      sql.exec('COMMIT');
      begun = false;
      return {
        status: 'undone',
        changesApplied: true,
        undoBackupPath: undoBackup,
        receipt: { ...persisted, undoState: 'undone', undoneAt: new Date(this.clock()).toISOString() }
      };
    } catch (err) {
      if (begun) {
        try {
          sql.exec('ROLLBACK');
          begun = false;
        } catch {
          return { status: 'recovery_required', changesApplied: null, reason: 'Falha ao reverter transação.' };
        }
      }
      return { status: 'stale', changesApplied: false, reason: String(err?.message || 'Falha ao desfazer.') };
    } finally {
      this.busy = false;
    }
  }
}

module.exports = { D05PersonalWriteGateway, ACTIONS, UNDOABLE_ACTIONS };
