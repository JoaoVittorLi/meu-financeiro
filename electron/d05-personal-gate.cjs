'use strict';
// M3 / RC-ALL-FULL: canonical supervised personal-write proposal gateway.
// No generic IPC or autonomous AI SQLite writes. Production commits stay disabled
// unless MAIN grants explicit owner-consented capability (or synthetic factory vault).
const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { D05CategoryService } = require('./d05-category-service.cjs');
const { normalizedName } = require('./d05-hierarchy.cjs');
const { PlanningStore } = require('./planning.cjs');
const { assertSyntheticVault } = require('./intelligence-category-vault.cjs');

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

function verifyBackupIntegrity(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size <= 0) {
    throw Error('PersonalWrite: backup vazio');
  }
  const probe = new DatabaseSync(filePath, { readOnly: true });
  try {
    const rows = probe.prepare('PRAGMA integrity_check').all();
    const ok = rows.length === 1 && rows[0]?.integrity_check === 'ok';
    if (!ok) {
      throw Error('PersonalWrite: backup SQLite corrompido na verificação de integridade');
    }
  } finally {
    probe.close();
  }
}

const ACTIONS = new Set([
  'manual.categorize',
  'manual.batch-categorize',
  'bank.categorize',
  'bank.batch-categorize',
  'bank.split',
  'rule.save',
  'rule.toggle',
  'category.create',
  'category.rename',
  'subcategory.create',
  'subcategory.rename',
  'planning.categorize',
  'planning.create',
  'planning.update',
  'planning.status',
  'budgets.reorganize'
]);

const UNDOABLE_ACTIONS = new Set([
  'manual.categorize',
  'manual.batch-categorize',
  'bank.categorize',
  'bank.batch-categorize',
  'bank.split',
  'rule.save',
  'rule.toggle',
  'category.create',
  'category.rename',
  'subcategory.create',
  'subcategory.rename',
  'planning.categorize',
  'planning.create',
  'planning.update',
  'planning.status',
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
      const c = request.constraint;
      if (
        !c ||
        typeof c !== 'object' ||
        Array.isArray(c) ||
        c.accountId !== s.activeAccountId ||
        !['expense', 'income'].includes(c.nature) ||
        !Number.isInteger(c.afterRowid) ||
        c.afterRowid < 0
      ) {
        throw Error('PersonalWrite: regra pessoal sem contrato por conta/afterRowid');
      }
      const pattern = String(request.pattern || '').trim();
      if (!pattern || pattern.length > 120 || /[\x00-\x1f<>]/.test(pattern)) {
        throw Error('PersonalWrite: padrão da regra inválido');
      }
      const matchMode = String(request.matchMode || 'contains');
      if (!['contains', 'starts', 'exact'].includes(matchMode)) {
        throw Error('PersonalWrite: modo de correspondência inválido');
      }
      const priority = Number(request.priority ?? 100);
      if (!Number.isInteger(priority) || priority < 1 || priority > 999) {
        throw Error('PersonalWrite: prioridade da regra inválida');
      }
      if (!after || !v) throw Error('PersonalWrite: destino D05 da regra obrigatório');
      if (v.parent.kind !== 'both' && v.parent.kind !== c.nature) {
        throw Error('PersonalWrite: natureza da regra incompatível com a categoria D05');
      }
      const existing = sql
        .prepare('SELECT id, pattern, match_mode, category, priority, enabled FROM category_rules WHERE LOWER(pattern)=LOWER(?)')
        .all(pattern);
      return {
        before: {
          accountId: s.activeAccountId,
          existingMatches: existing
        },
        after: {
          ...after,
          pattern,
          matchMode,
          scope: 'bank',
          priority,
          constraint: {
            accountId: c.accountId,
            nature: c.nature,
            afterRowid: c.afterRowid
          }
        },
        accountId: s.activeAccountId,
        amountCents: 0
      };
    }

    if (action === 'rule.toggle') {
      if (s.profile !== 'real') {
        throw Error('PersonalWrite: regras disponíveis apenas no perfil real');
      }
      const ruleId = Number(request.id);
      if (!Number.isInteger(ruleId) || ruleId <= 0 || typeof request.enabled !== 'boolean') {
        throw Error('PersonalWrite: parâmetros inválidos para ativar/desativar regra');
      }
      const hasConstraints = !!sql
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_rule_constraints'")
        .get();
      const row = hasConstraints
        ? sql
            .prepare(
              'SELECT r.id,r.pattern,r.category,r.enabled,c.account_id FROM category_rules r LEFT JOIN category_rule_constraints c ON c.rule_id=r.id WHERE r.id=?'
            )
            .get(ruleId)
        : sql.prepare('SELECT id,pattern,category,enabled,NULL AS account_id FROM category_rules WHERE id=?').get(ruleId);
      if (!row) throw Error('PersonalWrite: regra não encontrada');
      if (row.account_id && s.activeAccountId && row.account_id !== s.activeAccountId) {
        throw Error('PersonalWrite: regra pertence a outra conta bancária');
      }
      return {
        before: { id: row.id, pattern: row.pattern, category: row.category, enabled: row.enabled ? 1 : 0 },
        after: { id: row.id, pattern: row.pattern, category: row.category, enabled: request.enabled ? 1 : 0 },
        accountId: row.account_id || s.activeAccountId || null,
        amountCents: 0
      };
    }

    if (action === 'category.create') {
      const name = String(request.name || '').trim();
      if (!name || name.length > 70 || /[\x00-\x1f<>]/.test(name)) {
        throw Error('PersonalWrite: nome de categoria inválido');
      }
      if (sql.prepare('SELECT 1 FROM categories WHERE name=? COLLATE NOCASE').get(name)) {
        throw Error('PersonalWrite: categoria já existe');
      }
      const kind = ['expense', 'income', 'both'].includes(request.kind) ? request.kind : 'expense';
      const color = /^#[0-9a-fA-F]{6}$/.test(String(request.color || '')) ? String(request.color).toLowerCase() : '#6b7280';
      const emoji = typeof request.emoji === 'string' && request.emoji.trim().length > 0 && request.emoji.trim().length <= 16
        ? request.emoji.trim()
        : '✨';
      const iconKey = typeof request.iconKey === 'string' && /^[a-z0-9-]+$/.test(request.iconKey)
        ? request.iconKey
        : 'tag';
      const hue = Number.isInteger(request.hue) && request.hue >= 0 && request.hue <= 359 ? request.hue : 210;
      return {
        before: { existed: false },
        after: { name, kind, color, emoji, iconKey, hue },
        accountId: null,
        amountCents: 0
      };
    }

    if (action === 'category.rename') {
      const currentName = String(request.currentName || '').trim();
      const newName = String(request.newName || '').trim();
      if (!currentName || !newName || newName.length > 70 || /[\x00-\x1f<>]/.test(newName)) {
        throw Error('PersonalWrite: nome inválido para renomear categoria');
      }
      const row = sql
        .prepare('SELECT id, name, color, built_in, emoji, kind FROM categories WHERE name=? COLLATE NOCASE')
        .get(currentName);
      if (!row) throw Error('PersonalWrite: categoria não encontrada');
      if (row.built_in) throw Error('PersonalWrite: categorias padrão do catálogo D05 não podem ser renomeadas');
      const clash = sql.prepare('SELECT name FROM categories WHERE name=? COLLATE NOCASE').get(newName);
      if (clash && clash.name !== row.name) {
        throw Error('PersonalWrite: já existe uma categoria com o novo nome');
      }
      return {
        before: { id: row.id, name: row.name, color: row.color, emoji: row.emoji, kind: row.kind },
        after: { id: row.id, oldName: row.name, newName, category: newName },
        accountId: null,
        amountCents: 0
      };
    }

    if (action === 'subcategory.create') {
      const parent = svc.resolve({ categoryId: request.parentCategoryId, subcategoryId: null });
      const name = String(request.name || '').trim();
      if (!name || name.length > 80 || /[\x00-\x1f<>]/.test(name)) {
        throw Error('PersonalWrite: nome de subcategoria inválido');
      }
      const norm = normalizedName(name);
      if (
        sql
          .prepare('SELECT 1 FROM subcategories WHERE parent_category_id=? AND normalized_name=?')
          .get(parent.categoryId, norm)
      ) {
        throw Error('PersonalWrite: subcategoria duplicada na categoria-pai');
      }
      const iconKey = typeof request.iconKey === 'string' && /^[a-z0-9-]+$/.test(request.iconKey)
        ? request.iconKey
        : parent.parent.iconKey || 'tag';
      const hue = Number.isInteger(request.hue) && request.hue >= 0 && request.hue <= 359
        ? request.hue
        : Number.isInteger(parent.parent.hue)
          ? parent.parent.hue
          : 210;
      return {
        before: { existed: false, parentCategoryId: parent.categoryId },
        after: {
          parentCategoryId: parent.categoryId,
          parentName: parent.parentName,
          category: parent.parentName,
          subcategory: name,
          name,
          norm,
          iconKey,
          hue
        },
        accountId: null,
        amountCents: 0
      };
    }

    if (action === 'subcategory.rename') {
      const subId = String(request.id || '').trim();
      const name = String(request.newName ?? request.name ?? '').trim();
      if (!subId || !name || name.length > 80 || /[\x00-\x1f<>]/.test(name)) {
        throw Error('PersonalWrite: nome inválido para renomear subcategoria');
      }
      const prev = sql.prepare('SELECT * FROM subcategories WHERE id=?').get(subId);
      if (!prev) throw Error('PersonalWrite: subcategoria não encontrada');
      if (prev.built_in) throw Error('PersonalWrite: subcategoria aprovada do catálogo D05 é imutável');
      const norm = normalizedName(name);
      const clash = sql
        .prepare('SELECT id FROM subcategories WHERE parent_category_id=? AND normalized_name=?')
        .get(prev.parent_category_id, norm);
      if (clash && clash.id !== prev.id) {
        throw Error('PersonalWrite: subcategoria duplicada na categoria-pai');
      }
      const parent = svc.resolve({ categoryId: prev.parent_category_id, subcategoryId: null });
      return {
        before: {
          id: prev.id,
          parentCategoryId: prev.parent_category_id,
          name: prev.name,
          normalizedName: prev.normalized_name,
          iconKey: prev.icon_key,
          hue: prev.hue,
          active: prev.active
        },
        after: {
          id: prev.id,
          parentCategoryId: prev.parent_category_id,
          category: parent.parentName,
          oldName: prev.name,
          name,
          subcategory: name,
          normalizedName: norm
        },
        accountId: null,
        amountCents: 0
      };
    }

    if (action === 'planning.create') {
      const store = new PlanningStore(finance);
      if (s.profile === 'real' && typeof request.accountId === 'string' && request.accountId !== s.activeAccountId) {
        throw Error('PersonalWrite: conta fora da autorização');
      }
      const destination = request.target === undefined ? null : svc.resolve(request.target);
      if (destination && request.category && request.category !== destination.parentName) {
        throw Error('PersonalWrite: destino planejado divergente');
      }
      const base = store.validateInput(destination ? { ...request, category: destination.parentName } : request);
      const mode = request.mode || 'once';
      if (!['once', 'monthly', 'weekly', 'yearly', 'installments'].includes(mode)) {
        throw Error('PersonalWrite: repetição inválida no planejamento');
      }
      const count = mode === 'once' ? 1 : Number(request.count || 12);
      if (!Number.isInteger(count) || count < 1 || count > 36) {
        throw Error('PersonalWrite: escolha de 1 a 36 ocorrências');
      }
      if (mode === 'installments' && Math.floor(base.amount / count) < 1) {
        throw Error('PersonalWrite: o valor total precisa cobrir todas as parcelas');
      }
      const totalAmountCents = mode === 'installments' ? base.amount : base.amount * count;
      const existingCount = sql.prepare('SELECT COUNT(*) AS n FROM planned_items').get().n;
      return {
        before: { existed: false, existingCount },
        after: {
          title: base.title,
          kind: base.kind,
          amount: base.amount,
          totalAmountCents,
          dueDate: base.dueDate,
          category: base.category,
          categoryId: destination?.categoryId ?? null,
          subcategoryId: destination?.subcategoryId ?? null,
          subcategory: destination?.child?.name || null,
          accountId: base.accountId,
          notes: base.notes,
          certainty: base.certainty,
          mode,
          count,
          noBankPayment: true
        },
        accountId: base.accountId || null,
        amountCents: totalAmountCents
      };
    }

    if (action === 'planning.update') {
      const store = new PlanningStore(finance);
      if (typeof request.id !== 'string' || !request.id) throw Error('PersonalWrite: planejamento inválido');
      const row = store.item(request.id);
      if (row.status === 'cancelled') throw Error('PersonalWrite: reative o lançamento antes de editar');
      if (s.profile === 'real' && row.account_id && s.activeAccountId && row.account_id !== s.activeAccountId) {
        throw Error('PersonalWrite: compromisso fora da conta');
      }
      if (after && request.category && request.category !== after.category) {
        throw Error('PersonalWrite: destino planejado divergente');
      }
      const merged = store.validateInput({
        ...row,
        title: request.title ?? row.title,
        kind: request.kind ?? row.kind,
        amount: request.amount ?? row.amount_cents,
        dueDate: request.dueDate ?? row.due_date,
        category: after?.category ?? request.category ?? row.category,
        notes: request.notes ?? row.notes,
        certainty: request.certainty ?? row.certainty,
        accountId: request.accountId === undefined ? row.account_id : request.accountId
      });
      if (row.status !== 'planned' && (merged.amount !== row.amount_cents || merged.kind !== row.kind)) {
        throw Error('PersonalWrite: desfaça a quitação antes de alterar valor ou tipo');
      }
      if (store.linkedTotal(row.id) > merged.amount) {
        throw Error('PersonalWrite: valor menor que pagamentos vinculados');
      }
      const nextCatId = after?.categoryId ?? (merged.category === row.category ? row.category_id : null);
      const nextSubId = after ? after.subcategoryId : (merged.category === row.category ? row.subcategory_id : null);
      return {
        before: {
          id: row.id,
          title: row.title,
          kind: row.kind,
          amount_cents: row.amount_cents,
          due_date: row.due_date,
          category: row.category,
          category_id: row.category_id,
          subcategory_id: row.subcategory_id,
          account_id: row.account_id,
          notes: row.notes,
          certainty: row.certainty,
          status: row.status
        },
        after: {
          id: row.id,
          title: merged.title,
          kind: merged.kind,
          amount: merged.amount,
          dueDate: merged.dueDate,
          category: merged.category,
          subcategory: after?.subcategory || null,
          categoryId: nextCatId,
          subcategoryId: nextSubId,
          accountId: merged.accountId,
          notes: merged.notes,
          certainty: merged.certainty,
          noBankPayment: true
        },
        accountId: merged.accountId || null,
        amountCents: merged.amount
      };
    }

    if (action === 'planning.status') {
      const store = new PlanningStore(finance);
      if (typeof request.id !== 'string' || !request.id) throw Error('PersonalWrite: planejamento inválido');
      const row = store.item(request.id);
      if (!['planned', 'cancelled', 'settled_manual'].includes(request.status)) {
        throw Error('PersonalWrite: situação planejada inválida');
      }
      if (s.profile === 'real' && row.account_id && s.activeAccountId && row.account_id !== s.activeAccountId) {
        throw Error('PersonalWrite: compromisso fora da conta');
      }
      const linkedCount = sql.prepare('SELECT COUNT(*) AS n FROM planned_bank_links WHERE item_id=?').get(row.id).n;
      if (linkedCount && request.status !== 'planned') {
        throw Error('PersonalWrite: desvincule os pagamentos bancários antes de alterar a situação');
      }
      const today = (() => {
        const d = new Date(this.clock());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      if (request.status === 'settled_manual' && row.due_date > today) {
        throw Error('PersonalWrite: não é possível marcar pagamento futuro como quitado');
      }
      return {
        before: {
          id: row.id,
          title: row.title,
          status: row.status,
          settled_at: row.settled_at,
          amount_cents: row.amount_cents
        },
        after: {
          id: row.id,
          title: row.title,
          status: request.status,
          noBankPayment: true
        },
        accountId: row.account_id || null,
        amountCents: row.amount_cents
      };
    }

    if (action === 'planning.categorize') {
      if (s.profile !== 'real' || !after || typeof request.id !== 'string') {
        throw Error('PersonalWrite: planejamento inválido');
      }
      const before = sql
        .prepare('SELECT id,category,category_id,subcategory_id,amount_cents,account_id FROM planned_items WHERE id=?')
        .get(request.id);
      if (!before || (before.account_id && s.activeAccountId && before.account_id !== s.activeAccountId)) {
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
        : Number.isInteger(state.after?.count)
          ? state.after.count
          : 1;
    const previewSource =
      s.profile === 'demo'
        ? 'manual'
        : action.startsWith('manual.') ||
            action === 'budgets.reorganize' ||
            action.startsWith('category.') ||
            action.startsWith('subcategory.') ||
            action === 'planning.create' ||
            action === 'planning.update' ||
            action === 'planning.status'
          ? 'manual'
          : 'bank';
    return {
      contract: 'D05/PERSONAL-SUPERVISED-PREVIEW-V1',
      proposalId: id,
      nonce,
      expiresAt,
      action,
      source: previewSource,
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
    if (action === 'rule.save') {
      const sql = service.db;
      const v = service.resolve(request.target);
      const pattern = String(request.pattern || '').trim();
      const matchMode = String(request.matchMode || 'contains');
      const priority = Number(request.priority ?? 100);
      const c = request.constraint;
      sql.exec(`
        CREATE TABLE IF NOT EXISTS category_rule_constraints (
          rule_id INTEGER PRIMARY KEY REFERENCES category_rules(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL,
          nature TEXT NOT NULL CHECK(nature IN ('expense','income')),
          after_rowid INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const ins = sql
        .prepare(
          "INSERT INTO category_rules(pattern,match_mode,category,scope,priority,enabled,category_id,subcategory_id) VALUES(?,?,?,'bank',?,1,?,?)"
        )
        .run(pattern, matchMode, v.parentName, priority, v.categoryId, v.subcategoryId);
      const ruleId = Number(ins.lastInsertRowid);
      sql
        .prepare('INSERT INTO category_rule_constraints(rule_id,account_id,nature,after_rowid) VALUES(?,?,?,?)')
        .run(ruleId, c.accountId, c.nature, c.afterRowid);
      return {
        ruleId,
        pattern,
        matchMode,
        scope: 'bank',
        priority,
        category: v.parentName,
        categoryId: v.categoryId,
        subcategoryId: v.subcategoryId,
        constraint: { accountId: c.accountId, nature: c.nature, afterRowid: c.afterRowid }
      };
    }
    if (action === 'rule.toggle') {
      const ruleId = Number(request.id);
      const enabled = request.enabled ? 1 : 0;
      const res = service.db.prepare('UPDATE category_rules SET enabled=? WHERE id=?').run(enabled, ruleId);
      if (res.changes !== 1) throw Error('PersonalWrite: regra não encontrada para atualização');
      return { id: ruleId, enabled: enabled === 1 };
    }
    if (action === 'category.create') {
      const sql = service.db;
      const name = String(request.name || '').trim();
      const kind = ['expense', 'income', 'both'].includes(request.kind) ? request.kind : 'expense';
      const color = /^#[0-9a-fA-F]{6}$/.test(String(request.color || '')) ? String(request.color).toLowerCase() : '#6b7280';
      const emoji = typeof request.emoji === 'string' && request.emoji.trim().length > 0 && request.emoji.trim().length <= 16
        ? request.emoji.trim()
        : '✨';
      const iconKey = typeof request.iconKey === 'string' && /^[a-z0-9-]+$/.test(request.iconKey)
        ? request.iconKey
        : 'tag';
      const hue = Number.isInteger(request.hue) && request.hue >= 0 && request.hue <= 359 ? request.hue : 210;
      const id = 'cat:custom:' + randomUUID();
      sql
        .prepare('INSERT INTO categories(name,color,built_in,emoji,kind,id,icon_key,hue) VALUES(?,?,0,?,?,?,?,?)')
        .run(name, color, emoji, kind, id, iconKey, hue);
      return { id, name, kind, color, emoji, iconKey, hue };
    }
    if (action === 'category.rename') {
      const sql = service.db;
      const currentName = String(request.currentName || '').trim();
      const newName = String(request.newName || '').trim();
      const row = sql.prepare('SELECT id,name,built_in FROM categories WHERE name=? COLLATE NOCASE').get(currentName);
      if (!row || row.built_in) throw Error('PersonalWrite: categoria não renomeável');
      sql.prepare('UPDATE categories SET name=? WHERE name=? AND built_in=0').run(newName, row.name);
      sql.prepare('UPDATE transactions SET category=? WHERE category=?').run(newName, row.name);
      sql.prepare('UPDATE budgets SET category=? WHERE category=?').run(newName, row.name);
      if (sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monthly_budgets'").get()) {
        sql.prepare('UPDATE monthly_budgets SET category=? WHERE category=?').run(newName, row.name);
      }
      if (sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_items'").get()) {
        sql.prepare('UPDATE planned_items SET category=? WHERE category=?').run(newName, row.name);
      }
      return { id: row.id, oldName: row.name, newName };
    }
    if (action === 'subcategory.create') {
      const parent = service.resolve({ categoryId: request.parentCategoryId, subcategoryId: null });
      const created = service.createSubcategory({
        parentCategoryId: parent.categoryId,
        name: String(request.name || '').trim(),
        iconKey: typeof request.iconKey === 'string' && /^[a-z0-9-]+$/.test(request.iconKey)
          ? request.iconKey
          : parent.parent.iconKey || 'tag',
        hue: Number.isInteger(request.hue) && request.hue >= 0 && request.hue <= 359
          ? request.hue
          : Number.isInteger(parent.parent.hue)
            ? parent.parent.hue
            : 210
      });
      return {
        id: created.id,
        parentCategoryId: created.parentCategoryId,
        parentName: parent.parentName,
        name: created.name
      };
    }
    if (action === 'subcategory.rename') {
      const subId = String(request.id || '').trim();
      const updated = service.updateSubcategory({
        id: subId,
        name: String(request.newName ?? request.name ?? '').trim()
      });
      return { id: updated.id, parentCategoryId: updated.parentCategoryId, name: updated.name };
    }
    if (action === 'planning.create') {
      const store = new PlanningStore(service.finance);
      const out = store.create(request, { inTransaction: true });
      const mode = request.mode || 'once';
      const count = out.count;
      const totalAmountCents = mode === 'installments' ? request.amount : request.amount * count;
      return {
        createdIds: out.ids,
        count,
        mode,
        totalAmountCents,
        noBankPayment: true
      };
    }
    if (action === 'planning.update') {
      const store = new PlanningStore(service.finance);
      store.edit(request, { inTransaction: true });
      return { id: request.id, updated: true, noBankPayment: true };
    }
    if (action === 'planning.status') {
      const store = new PlanningStore(service.finance);
      store.setStatus(request.id, request.status, { inTransaction: true });
      return { id: request.id, status: request.status, noBankPayment: true };
    }
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
        const wasUndone = previous.undo_state === 'undone';
        return {
          status: wasUndone ? 'already_undone' : 'applied',
          replayed: true,
          changesApplied: !wasUndone,
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
        const wasUndone = previous.undo_state === 'undone';
        return {
          status: wasUndone ? 'already_undone' : 'applied',
          replayed: true,
          changesApplied: !wasUndone,
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
          : Number.isInteger(freshState.after?.count)
            ? freshState.after.count
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
      verifyBackupIntegrity(backup);

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
    if (a === 'rule.save') {
      const ruleId = persisted.result?.ruleId;
      if (!Number.isInteger(ruleId)) return false;
      const row = sql
        .prepare(
          'SELECT r.pattern,r.match_mode,r.category,r.enabled,r.category_id,r.subcategory_id,c.account_id,c.nature,c.after_rowid ' +
            'FROM category_rules r LEFT JOIN category_rule_constraints c ON c.rule_id=r.id WHERE r.id=?'
        )
        .get(ruleId);
      return Boolean(
        row &&
          row.pattern === after.pattern &&
          row.match_mode === after.matchMode &&
          row.category === after.category &&
          row.enabled === 1 &&
          (row.category_id ?? null) === (after.categoryId ?? null) &&
          (row.subcategory_id ?? null) === (after.subcategoryId ?? null) &&
          row.account_id === after.constraint?.accountId &&
          row.nature === after.constraint?.nature &&
          row.after_rowid === after.constraint?.afterRowid
      );
    }
    if (a === 'rule.toggle') {
      const cur = sql.prepare('SELECT enabled FROM category_rules WHERE id=?').get(before.id);
      return Boolean(cur && cur.enabled === (after.enabled ? 1 : 0));
    }
    if (a === 'category.create') {
      const catId = persisted.result?.id;
      if (!catId) return false;
      const cat = sql.prepare('SELECT name,built_in FROM categories WHERE id=?').get(catId);
      if (!cat || cat.built_in !== 0 || cat.name !== after.name) return false;
      const subUse = sql.prepare('SELECT 1 FROM subcategories WHERE parent_category_id=? LIMIT 1').get(catId);
      if (subUse) return false;
      for (const tbl of ['transactions', 'budgets', 'monthly_budgets', 'category_rules', 'bank_category_overrides', 'bank_transaction_splits', 'planned_items']) {
        if (!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tbl)) continue;
        if (sql.prepare(`SELECT 1 FROM ${tbl} WHERE category=? LIMIT 1`).get(after.name)) return false;
      }
      return true;
    }
    if (a === 'category.rename') {
      const cur = sql.prepare('SELECT id,name,built_in FROM categories WHERE id=?').get(before.id);
      if (!cur || cur.built_in !== 0 || cur.name !== after.newName) return false;
      return !sql.prepare('SELECT 1 FROM categories WHERE name=? COLLATE NOCASE AND id!=?').get(before.name, before.id);
    }
    if (a === 'subcategory.create') {
      const subId = persisted.result?.id;
      if (!subId) return false;
      const cur = sql.prepare('SELECT id,name,built_in FROM subcategories WHERE id=?').get(subId);
      if (!cur || cur.built_in !== 0 || cur.name !== after.name) return false;
      for (const tbl of ['transactions', 'bank_category_overrides', 'bank_transaction_splits', 'category_rules', 'planned_items']) {
        if (!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tbl)) continue;
        if (sql.prepare(`SELECT 1 FROM ${tbl} WHERE subcategory_id=? LIMIT 1`).get(subId)) return false;
      }
      return true;
    }
    if (a === 'subcategory.rename') {
      const cur = sql.prepare('SELECT id,name,built_in FROM subcategories WHERE id=?').get(before.id);
      return Boolean(cur && cur.built_in === 0 && cur.name === after.name);
    }
    if (a === 'planning.create') {
      const ids = Array.isArray(persisted.result?.createdIds) ? persisted.result.createdIds : [];
      if (!ids.length) return false;
      for (const itemId of ids) {
        const row = sql.prepare('SELECT status,title FROM planned_items WHERE id=?').get(itemId);
        if (!row || row.status !== 'planned' || row.title !== after.title) return false;
        const linked = sql.prepare('SELECT COUNT(*) AS n FROM planned_bank_links WHERE item_id=?').get(itemId).n;
        if (linked > 0) return false;
      }
      return true;
    }
    if (a === 'planning.update') {
      const cur = sql
        .prepare('SELECT title,kind,amount_cents,due_date,category,notes,certainty FROM planned_items WHERE id=?')
        .get(before.id);
      return Boolean(
        cur &&
          cur.title === after.title &&
          cur.kind === after.kind &&
          cur.amount_cents === after.amount &&
          cur.due_date === after.dueDate &&
          cur.category === after.category &&
          cur.notes === (after.notes || '') &&
          cur.certainty === after.certainty
      );
    }
    if (a === 'planning.status') {
      const cur = sql.prepare('SELECT status FROM planned_items WHERE id=?').get(before.id);
      return Boolean(cur && cur.status === after.status);
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
      return;
    }
    if (a === 'rule.save') {
      const ruleId = persisted.result?.ruleId;
      if (Number.isInteger(ruleId)) {
        if (sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_rule_constraints'").get()) {
          sql.prepare('DELETE FROM category_rule_constraints WHERE rule_id=?').run(ruleId);
        }
        sql.prepare('DELETE FROM category_rules WHERE id=?').run(ruleId);
      }
      return;
    }
    if (a === 'rule.toggle') {
      sql.prepare('UPDATE category_rules SET enabled=? WHERE id=?').run(before.enabled ? 1 : 0, before.id);
      return;
    }
    if (a === 'category.create') {
      sql.prepare('DELETE FROM categories WHERE id=? AND built_in=0').run(persisted.result?.id);
      return;
    }
    if (a === 'category.rename') {
      const oldName = persisted.after?.newName;
      sql.prepare('UPDATE categories SET name=? WHERE id=? AND built_in=0').run(before.name, before.id);
      if (oldName) {
        sql.prepare('UPDATE transactions SET category=? WHERE category=?').run(before.name, oldName);
        sql.prepare('UPDATE budgets SET category=? WHERE category=?').run(before.name, oldName);
        if (sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monthly_budgets'").get()) {
          sql.prepare('UPDATE monthly_budgets SET category=? WHERE category=?').run(before.name, oldName);
        }
        if (sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='planned_items'").get()) {
          sql.prepare('UPDATE planned_items SET category=? WHERE category=?').run(before.name, oldName);
        }
      }
      return;
    }
    if (a === 'subcategory.create') {
      sql.prepare('DELETE FROM subcategories WHERE id=? AND built_in=0').run(persisted.result?.id);
      return;
    }
    if (a === 'subcategory.rename') {
      sql
        .prepare('UPDATE subcategories SET name=?,normalized_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND built_in=0')
        .run(before.name, before.normalizedName, before.id);
      return;
    }
    if (a === 'planning.create') {
      const ids = Array.isArray(persisted.result?.createdIds) ? persisted.result.createdIds : [];
      const delAudit = sql.prepare('DELETE FROM planned_audit WHERE item_id=?');
      const delRej = sql.prepare('DELETE FROM planned_rejected_matches WHERE item_id=?');
      const delItem = sql.prepare('DELETE FROM planned_items WHERE id=?');
      for (const itemId of ids) {
        delAudit.run(itemId);
        delRej.run(itemId);
        delItem.run(itemId);
      }
      return;
    }
    if (a === 'planning.update') {
      sql
        .prepare(
          'UPDATE planned_items SET title=?,kind=?,amount_cents=?,due_date=?,category=?,category_id=?,subcategory_id=?,account_id=?,notes=?,certainty=?,updated_at=? WHERE id=?'
        )
        .run(
          before.title,
          before.kind,
          before.amount_cents,
          before.due_date,
          before.category,
          before.category_id ?? null,
          before.subcategory_id ?? null,
          before.account_id ?? null,
          before.notes ?? '',
          before.certainty,
          new Date().toISOString(),
          before.id
        );
      return;
    }
    if (a === 'planning.status') {
      sql
        .prepare('UPDATE planned_items SET status=?,settled_at=?,updated_at=? WHERE id=?')
        .run(before.status, before.settled_at ?? null, new Date().toISOString(), before.id);
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
        return { status: 'already_undone', changesApplied: false, receipt: persisted };
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
      verifyBackupIntegrity(undoBackup);

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
