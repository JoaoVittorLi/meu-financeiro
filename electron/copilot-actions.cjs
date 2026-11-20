'use strict';
// M3 — Supervised Action Interpreter (read-only proposal builder for S1..S4).
// Never mutates SQLite, never executes dynamic SQL, never infers unverified data.
const { D05CategoryService } = require('./d05-category-service.cjs');

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const safeText = (s, max = 140) =>
  String(s || '')
    .replace(/[\x00-\x1f\x7f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const FUTURE_RULE_RX =
  /(?:\s*(?:,|;|e)\s*(?:crie|criar|fa[çc]a|gere|salve|adicione)\s+(?:uma?\s+)?regra\s+(?:para|nas|nos|as|os)\s+pr[óo]xim[ao]s?(?:\s+movimenta[çc][õo]es|\s+compras|\s+lan[çc]amentos)?|\s*(?:,|;|e)\s*(?:crie|criar|salve)\s+(?:uma?\s+)?regra.*)$/i;

function resolveD05Target(rawTarget, catalogParents) {
  const cleaned = String(rawTarget || '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();
  if (!cleaned) return { ok: false, reason: 'missing_target' };
  const parts = cleaned
    .split(/\s*(?:>|›|\/|->)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const rawParent = parts[0] || '';
  const rawChild = parts[1] || '';
  const foldedParent = fold(rawParent);

  const parentMatches = (catalogParents || []).filter(
    (p) => fold(p.name) === foldedParent || (foldedParent.length >= 4 && fold(p.name).includes(foldedParent))
  );
  if (parentMatches.length === 0) {
    // Allow matching directly by unambiguous subcategory name when user omitted parent.
    if (!rawChild) {
      const childHits = [];
      for (const p of catalogParents || []) {
        for (const c of p.subcategories || []) {
          if (fold(c.name) === foldedParent) childHits.push({ parent: p, child: c });
        }
      }
      if (childHits.length === 1) {
        return {
          ok: true,
          parent: childHits[0].parent,
          child: childHits[0].child,
          target: { categoryId: childHits[0].parent.id, subcategoryId: childHits[0].child.id },
          targetLabel: `${childHits[0].parent.name} › ${childHits[0].child.name}`
        };
      }
    }
    return { ok: false, reason: 'unknown_parent', rawParent };
  }
  if (parentMatches.length > 1) {
    const exact = parentMatches.find((p) => fold(p.name) === foldedParent);
    if (!exact) return { ok: false, reason: 'ambiguous_parent', candidates: parentMatches.map((p) => p.name) };
    parentMatches.splice(0, parentMatches.length, exact);
  }
  const parent = parentMatches[0];
  if (!rawChild) {
    return {
      ok: true,
      parent,
      child: null,
      target: { categoryId: parent.id, subcategoryId: null },
      targetLabel: parent.name
    };
  }
  const foldedChild = fold(rawChild);
  const childMatches = (parent.subcategories || []).filter(
    (c) => fold(c.name) === foldedChild || (foldedChild.length >= 3 && fold(c.name).includes(foldedChild))
  );
  if (childMatches.length === 0) {
    return {
      ok: false,
      reason: 'unknown_subcategory',
      parentName: parent.name,
      rawChild,
      availableChildren: (parent.subcategories || []).map((c) => c.name)
    };
  }
  const exactChild = childMatches.find((c) => fold(c.name) === foldedChild);
  if (childMatches.length > 1 && !exactChild) {
    return {
      ok: false,
      reason: 'ambiguous_subcategory',
      parentName: parent.name,
      candidates: childMatches.map((c) => c.name)
    };
  }
  const child = exactChild || childMatches[0];
  return {
    ok: true,
    parent,
    child,
    target: { categoryId: parent.id, subcategoryId: child.id },
    targetLabel: `${parent.name} › ${child.name}`
  };
}

function parseCategorizeCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;

  const hasFutureRule = FUTURE_RULE_RX.test(raw);
  const withoutRule = raw.replace(FUTURE_RULE_RX, '').trim();

  // Match S1 phrasings:
  // "Coloque minhas compras do Supermercado BH em Alimentação > Supermercados"
  // "Categorize a compra da Drogasil como Saúde > Farmácia"
  // "Classifique os lançamentos do Uber para Transporte"
  // "Mude a categoria de iFood para Alimentação > Delivery"
  const m =
    /^(?:por favor,?\s*)?(?:coloque|coloquem|categoriz(?:e|ar)|recategoriz(?:e|ar)|classifiqu(?:e|ar)|reclassifiqu(?:e|ar)|mova|mover|alter(?:e|ar)\s+(?:a\s+)?categoria|mud(?:e|ar)\s+(?:a\s+)?categoria)\s+(.+?)\s+(?:em|como|para)\s+(.+?)[.?!]*$/i.exec(
      withoutRule
    );
  if (!m) return null;

  let subject = m[1].trim();
  const targetRaw = m[2].trim();

  let originFilter = 'all';
  if (/\b(?:lan[çc]amento(?:s)?\s+manua(?:l|is)|manualmente|no\s+manual)\b/i.test(subject)) {
    originFilter = 'manual';
    subject = subject.replace(/\b(?:no(?:s)?\s+lan[çc]amento(?:s)?\s+manua(?:l|is)|lan[çc]amento(?:s)?\s+manua(?:l|is)|manualmente|no\s+manual)\b/gi, ' ');
  } else if (/\b(?:do\s+banco|no\s+banco|banc[áa]ri[ao]s?|conta\s+banc[áa]ria)\b/i.test(subject)) {
    originFilter = 'bank';
    subject = subject.replace(/\b(?:do\s+banco|no\s+banco|banc[áa]ri[ao]s?|na\s+conta\s+banc[áa]ria)\b/gi, ' ');
  }

  // Strip common leading quantifiers, nouns, and optional date phrases while preserving merchant tokens.
  subject = subject
    .replace(
      /^(?:(?:(?:todas?\s+as|todos?\s+os|a|o|as|os|minha|meu|minhas|meus|esses?|essas?)\s+)?(?:(?:compras?|despesas?|gastos?|lan[çc]amentos?|movimenta[çc][õo]es|transa[çc][õo]es|pagamentos?|registros?)\s+)?(?:(?:d[aeo]s?|no|na|nos|nas|em|com|sobre|para)\s+)?)?/i,
      ''
    )
    .replace(/^(?:d[aeo]\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:d[aeo]s?\s+)?/i, '')
    .replace(/\b(?:feita|feito|realizada|realizado)?\s*(?:de\s+)?(?:hoje|ontem|anteontem)\s*$/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!subject || subject.length < 2) return null;
  const normalizedTarget = targetRaw.replace(/\s*(?:->|>|›)\s*/g, ' › ');
  return {
    merchantQuery: safeText(subject, 120),
    targetRaw: safeText(normalizedTarget, 120),
    originFilter,
    futureRuleRequested: hasFutureRule
  };
}

function interpretCopilotAction({ local, scope, owner, question } = {}) {
  if (!local || typeof local.query !== 'function') {
    throw Error('CopilotActions: serviço local obrigatório.');
  }
  const cmd = parseCategorizeCommand(question);
  if (!cmd) return { matched: false };

  // Re-verify active read grant BEFORE accessing SQLite catalog or rows.
  const grant = local.query({ token: scope.token, month: scope.month, intent: 'radar' }, owner);
  if (
    grant?.version !== 1 ||
    grant.readOnly !== true ||
    grant.references?.source !== scope.source ||
    grant.references?.profile !== scope.profile
  ) {
    throw Error('CopilotActions: concessão de leitura inválida ou expirada.');
  }

  const db = local.db;
  const svc = new D05CategoryService(db);
  const catalog = svc.listCatalog();
  const targetRes = resolveD05Target(cmd.targetRaw, catalog.parents);

  if (!targetRes.ok) {
    let message = 'Não consegui identificar a categoria D05 de destino com segurança. Nenhuma alteração foi preparada.';
    if (targetRes.reason === 'unknown_subcategory') {
      message = `A subcategoria “${safeText(targetRes.rawChild, 60)}” não foi encontrada em ${targetRes.parentName}. Opções disponíveis: ${targetRes.availableChildren.join(', ') || 'nenhuma'}.`;
    } else if (targetRes.reason === 'ambiguous_subcategory' || targetRes.reason === 'ambiguous_parent') {
      message = `O destino informado pode corresponder a mais de uma categoria (${targetRes.candidates.join(', ')}). Informe o nome exato para preparar a prévia.`;
    } else if (targetRes.reason === 'unknown_parent') {
      message = `Não encontrei a categoria “${safeText(targetRes.rawParent, 60)}” no catálogo atual D05. Informe uma das 14 categorias oficiais ou "Categoria > Subcategoria".`;
    }
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'needs_clarification',
      effort: 'high',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      merchantQuery: cmd.merchantQuery,
      futureRuleRequested: cmd.futureRuleRequested,
      items: [],
      eligibleCount: 0,
      excludedBySafetyCount: 0,
      totalAmountCents: 0,
      answer: message,
      warnings: []
    };
  }

  if (cmd.originFilter !== 'all' && cmd.originFilter !== scope.source) {
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'needs_clarification',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      merchantQuery: cmd.merchantQuery,
      futureRuleRequested: cmd.futureRuleRequested,
      items: [],
      eligibleCount: 0,
      excludedBySafetyCount: 0,
      totalAmountCents: 0,
      answer:
        cmd.originFilter === 'bank'
          ? 'A sessão autorizada está lendo lançamentos manuais, mas você pediu movimentações bancárias. Autorize a fonte "Contas conectadas" para preparar esta ação.'
          : 'A sessão autorizada está lendo contas conectadas, mas você pediu lançamentos manuais. Autorize a fonte "Lançamentos manuais" para preparar esta ação.',
      warnings: []
    };
  }

  const queryFold = fold(cmd.merchantQuery);
  const queryTokens = queryFold.split(' ').filter((w) => w.length >= 2);
  const matchesTerm = (text) => {
    const hay = fold(text);
    if (!hay) return false;
    if (hay.includes(queryFold)) return true;
    return queryTokens.length > 0 && queryTokens.every((t) => hay.includes(t));
  };

  const candidates = [];
  if (scope.source === 'bank') {
    const view = svc.bankView({ limit: 2500 });
    const overview = db.bankOverview();
    const metaByKey = new Map(
      (overview.transactions || []).map((t) => [JSON.stringify([t.accountId, t.id]), t])
    );
    const accountNames = new Map((overview.accounts || []).map((a) => [a.id, safeText(a.name, 80)]));

    for (const row of view.items || []) {
      const meta = metaByKey.get(JSON.stringify([row.accountId, row.id])) || row;
      const customTitle = safeText(meta.customTitle || row.merchant || '', 120);
      const rawDesc = safeText(row.description || '', 120);
      if (!matchesTerm(customTitle) && !matchesTerm(rawDesc)) continue;

      let eligible = true;
      let ineligibleReason = null;
      const nature = row.nature && row.nature !== 'auto' ? row.nature : row.amount < 0 ? 'expense' : 'income';
      const txKind = nature === 'income' ? 'income' : 'expense';
      if (row.status !== 'POSTED') {
        eligible = false;
        ineligibleReason = 'Movimentação pendente no banco';
      } else if (nature === 'transfer' || nature === 'ignore') {
        eligible = false;
        ineligibleReason = 'Transferência própria ou ignorada';
      } else if (Array.isArray(row.splits) && row.splits.length > 0) {
        eligible = false;
        ineligibleReason = 'Movimentação já dividida em partes (split)';
      } else if (targetRes.parent.kind !== 'both' && targetRes.parent.kind !== txKind) {
        eligible = false;
        ineligibleReason = `Categoria "${targetRes.parent.name}" incompatível com ${txKind === 'income' ? 'entrada' : 'saída'}`;
      }

      candidates.push({
        key: `${row.accountId}|${row.id}`,
        origin: 'bank',
        accountId: row.accountId,
        accountName: accountNames.get(row.accountId) || row.accountId,
        id: row.id,
        externalId: row.id,
        date: row.date,
        description: customTitle || rawDesc || 'Movimentação bancária',
        rawDescription: rawDesc,
        amountCents: Math.abs(row.amount || 0),
        txKind,
        status: row.status,
        currentCategory: row.category || 'Outros',
        currentCategoryId: row.categoryId || null,
        currentSubcategoryId: row.subcategoryId || null,
        eligible,
        ineligibleReason
      });
    }
  } else {
    const manual = svc.listManual({ profile: scope.profile, limit: 2500 });
    for (const row of manual.items || []) {
      const desc = safeText(row.description || '', 120);
      if (!matchesTerm(desc)) continue;
      let eligible = true;
      let ineligibleReason = null;
      if (targetRes.parent.kind !== 'both' && targetRes.parent.kind !== row.kind) {
        eligible = false;
        ineligibleReason = `Categoria "${targetRes.parent.name}" incompatível com ${row.kind === 'income' ? 'receita' : 'despesa'}`;
      }
      candidates.push({
        key: `manual|${row.id}`,
        origin: 'manual',
        accountId: null,
        accountName: 'Manual',
        id: row.id,
        externalId: null,
        date: row.date,
        description: desc || 'Lançamento manual',
        rawDescription: desc,
        amountCents: Math.abs(row.amount || 0),
        txKind: row.kind,
        status: 'MANUAL',
        currentCategory: row.category || 'Outros',
        currentCategoryId: row.categoryId || null,
        currentSubcategoryId: row.subcategoryId || null,
        eligible,
        ineligibleReason
      });
    }
  }

  candidates.sort((a, b) => b.date.localeCompare(a.date) || b.amountCents - a.amountCents || a.key.localeCompare(b.key));
  const limited = candidates.slice(0, 100);
  const eligibleItems = limited.filter((x) => x.eligible);
  const excludedItems = limited.filter((x) => !x.eligible);

  if (eligibleItems.length === 0) {
    const extraReason = excludedItems.length
      ? ` Encontrei ${excludedItems.length} registro(s), porém bloqueados por segurança (${excludedItems[0].ineligibleReason}).`
      : '';
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'unavailable',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      merchantQuery: cmd.merchantQuery,
      futureRuleRequested: cmd.futureRuleRequested,
      items: limited,
      eligibleCount: 0,
      excludedBySafetyCount: excludedItems.length,
      totalAmountCents: 0,
      answer: `Não encontrei movimentações elegíveis correspondentes a “${cmd.merchantQuery}” para classificar em **${targetRes.targetLabel}**.${extraReason}`,
      warnings: []
    };
  }

  const distinctAccounts = [...new Set(eligibleItems.map((i) => i.accountId).filter(Boolean))];
  const distinctDescriptions = new Set(eligibleItems.map((i) => fold(i.description)));
  const totalAmountCents = eligibleItems.reduce((n, it) => n + it.amountCents, 0);
  const warnings = [];
  if (candidates.length > 100) {
    warnings.push(`Mostrando os 100 registros mais recentes de ${candidates.length} encontrados (limite por lote).`);
  }
  if (excludedItems.length > 0) {
    warnings.push(`${excludedItems.length} lançamento(s) não elegível(is) (pendente, dividido ou transferência) foram isolados fora do lote.`);
  }
  if (distinctAccounts.length > 1) {
    warnings.push('Há lançamentos em mais de uma conta bancária; selecione uma única conta por confirmação nativa.');
  }
  if (distinctDescriptions.size > 1) {
    warnings.push(`Foram encontrados ${distinctDescriptions.size} nomes parecidos de estabelecimento; desmarque qualquer item indesejado antes de confirmar.`);
  }

  const futureRuleNotice = cmd.futureRuleRequested
    ? `Pedido separado para regra futura de “${cmd.merchantQuery}”: a reclassificação histórica e a criação de regra futura são tratadas em etapas distintas; aqui você confirma apenas os lançamentos históricos selecionados (regras pessoais com escopo por conta serão entregues em S3).`
    : null;

  const action =
    scope.source === 'bank'
      ? eligibleItems.length === 1
        ? 'bank.categorize'
        : 'bank.batch-categorize'
      : eligibleItems.length === 1
        ? 'manual.categorize'
        : 'manual.batch-categorize';

  const effort =
    distinctAccounts.length > 1 || distinctDescriptions.size > 1 || cmd.futureRuleRequested ? 'high' : 'low';

  return {
    matched: true,
    contract: 'MF3/ACTION-DRAFT-V1',
    intent: 'categorize',
    status: 'ready',
    effort,
    readOnly: true,
    changesApplied: false,
    source: scope.source,
    profile: scope.profile,
    month: scope.month,
    action,
    target: targetRes.target,
    targetLabel: targetRes.targetLabel,
    merchantQuery: cmd.merchantQuery,
    items: limited,
    eligibleCount: eligibleItems.length,
    excludedBySafetyCount: excludedItems.length,
    totalAmountCents,
    accountIds: distinctAccounts,
    ambiguousAccounts: distinctAccounts.length > 1,
    ambiguousMerchants: distinctDescriptions.size > 1,
    futureRuleRequested: cmd.futureRuleRequested,
    futureRulePattern: cmd.futureRuleRequested ? cmd.merchantQuery : null,
    futureRuleNotice,
    warnings,
    answer:
      `Localizei **${eligibleItems.length} lançamento(s)** elegível(is) para **${cmd.merchantQuery}**. ` +
      `Revise a prévia para **${targetRes.targetLabel}** abaixo, desmarque se desejar excluir algum item e confirme na janela nativa antes de aplicar.`
  };
}

module.exports = {
  parseCategorizeCommand,
  resolveD05Target,
  interpretCopilotAction
};
