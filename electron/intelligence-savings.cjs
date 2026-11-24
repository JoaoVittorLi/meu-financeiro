'use strict';
// Marco 2 F2 — Consultor de Economia Anti-Dupla-Contagem.
// Read-only deterministic savings analysis; strictly non-overlapping overlapGroups.
const { createHash } = require('node:crypto');
const { aggregateFinancePeriod, budgetProgress } = require('../shared/finance-period-ledger.mjs');
const { period } = require('./financial-intelligence.cjs');
const { authorized, snapshot, classifyCategory } = require('./intelligence-investigation.cjs');
const {
 COPILOT_GUIDE_VERSION,
 GUARDRAIL_COPY,
 formatMoneyBRL,
 buildCopilotAnswer
} = require('../shared/copilot-language.cjs');

const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const safeCents = n => Number.isSafeInteger(n) && Math.abs(n) <= 100_000_000_000;
const ESSENTIAL_PARENT_IDS = new Set(['cat:moradia', 'cat:saude', 'cat:contas']);

function parseBrlCents(rawQuestion) {
 const q = String(rawQuestion || '');
 const match = q.match(
  /(?:r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?(?![\d.,])|\b(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*reais\b|\b(?:economizar|poupar|guardar|reduzir|comprar|compra|gastar|gasto|parcelar|pagar|custa|custando|de|por)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?(?![\d.,])(?!\s*(?:x\b|%|vezes|parcelas?|mes(?:es)?|dias?|anos?)\b))/i
 );
 if (!match) return null;
 const intStr = match[1] ?? match[3] ?? match[5];
 const fracStr = match[2] ?? match[4] ?? match[6] ?? '00';
 if (!intStr) return null;
 const whole = Number(String(intStr).replace(/\./g, ''));
 const centsPart = Number(String(fracStr).padEnd(2, '0').slice(0, 2));
 const total = whole * 100 + centsPart;
 return safeCents(total) && total > 0 ? total : null;
}

function parseSavingsIntent(question) {
 const q = fold(question);
 // Keep single-category percent simulations on legacy simulate tool (I2-A).
 if (/\b\d{1,3}\s*%/.test(q) && /(reduz|cort|econom|diminu|se eu)/.test(q)) return null;
 const wantsSavings = /(economiz|poupar|guardar|cortar gastos|reduzir gastos|reduzir despesas|onde.*(cortar|economiz)|plano de economia|meta de econom|como posso economiz)/.test(q);
 if (!wantsSavings) return null;
 return {
  targetCents: parseBrlCents(question),
  question: q
 };
}

function bandForGroup({ currentCents, limitCents, categoryId, kind }) {
 if (!safeCents(currentCents) || currentCents <= 0) return null;
 const essential = categoryId && ESSENTIAL_PARENT_IDS.has(categoryId);
 const overPositiveLimit = safeCents(limitCents) && limitCents > 0 && currentCents > limitCents;
 const explicitZero = limitCents === 0 && currentCents > 0;
 if (essential && !overPositiveLimit) return null;
 const minPct = explicitZero ? 25 : kind === 'merchant' ? 10 : 10;
 const basePct = explicitZero ? 50 : kind === 'merchant' ? 20 : 20;
 const maxPct = explicitZero ? 75 : kind === 'merchant' ? 30 : 30;
 let minSave = Math.round(currentCents * minPct / 100);
 let baseSave = Math.round(currentCents * basePct / 100);
 let maxSave = Math.round(currentCents * maxPct / 100);
 if (overPositiveLimit) {
  const excess = currentCents - limitCents;
  minSave = Math.max(minSave, Math.min(currentCents, excess));
  baseSave = Math.max(baseSave, Math.min(currentCents, excess));
  maxSave = Math.max(maxSave, Math.min(currentCents, excess));
 }
 minSave = Math.min(currentCents, Math.max(0, minSave));
 baseSave = Math.min(currentCents, Math.max(minSave, baseSave));
 maxSave = Math.min(currentCents, Math.max(baseSave, maxSave));
 if (![minSave, baseSave, maxSave].every(safeCents) || maxSave <= 0) return null;
 return { minSaveCents: minSave, baseSaveCents: baseSave, maxSaveCents: maxSave, explicitZero, overPositiveLimit };
}

function recommendSavings({ local, scope, intention = {}, clock = Date.now }) {
 const access = authorized(local, scope);
 const first = snapshot(local, scope);
 const p = period(scope.month);
 const manualData = local.db.load(scope.profile) || { transactions: [], budgets: {} };
 const rawBudgets = typeof local.db.effectiveBudgets === 'function'
  ? (local.db.effectiveBudgets(scope.profile, scope.month)?.effective || {})
  : { ...(manualData.budgets || {}), ...(manualData.monthlyBudgets?.[scope.month] || {}) };
 const budgetMap = new Map(Object.entries(rawBudgets).map(([k, v]) => [fold(k), safeCents(v) ? v : null]));
 const limits = Object.entries(rawBudgets)
  .filter(([, amountCents]) => safeCents(amountCents) && amountCents >= 0)
  .map(([category, amountCents]) => ({ category, amountCents }));

 const records = first.rows.map(x => x.row);
 const current = aggregateFinancePeriod(records, { ...p, source: scope.source });
 const progress = new Map(budgetProgress(limits, current.expenses).map(b => [fold(b.category), b]));

 const catEvidence = new Map();
 const merchantAgg = new Map();
 for (const entry of first.rows) {
  if (entry.row.date < p.start || entry.row.date > p.end) continue;
  const item = aggregateFinancePeriod([entry.row], { ...p, source: scope.source });
  if (item.expenseCents <= 0) continue;
  for (const exp of item.expenses) {
   const set = catEvidence.get(exp.name) || new Set();
   if (set.size < 25) set.add(entry.id);
   catEvidence.set(exp.name, set);
  }
  const primaryCat = item.expenses[0]?.name || 'Outros';
  const mKey = fold(entry.merchant) || 'nao identificado';
  const prevM = merchantAgg.get(mKey) || {
   merchant: entry.merchant,
   categoryName: primaryCat,
   currentCents: 0,
   evidenceIds: new Set()
  };
  prevM.currentCents += item.expenseCents;
  if (prevM.evidenceIds.size < 25) prevM.evidenceIds.add(entry.id);
  merchantAgg.set(mKey, prevM);
 }

 const candidates = [];
 for (const exp of current.expenses) {
  const tax = classifyCategory(exp.name);
  const fKey = fold(exp.name);
  const bInfo = progress.get(fKey);
  const explicitLimit = bInfo ? bInfo.limitCents : (budgetMap.has(fKey) ? budgetMap.get(fKey) : null);
  const band = bandForGroup({
   currentCents: exp.amountCents,
   limitCents: explicitLimit,
   categoryId: tax.categoryId,
   kind: 'category'
  });
  if (!band) continue;
  const overlapGroup = tax.categoryId || ('legacy:' + fKey);
  candidates.push({
   kind: tax.subcategoryId ? 'subcategory' : 'category',
   categoryLabel: tax.label,
   categoryId: tax.categoryId,
   subcategoryId: tax.subcategoryId,
   overlapGroup,
   currentCents: exp.amountCents,
   limitCents: explicitLimit,
   minSaveCents: band.minSaveCents,
   baseSaveCents: band.baseSaveCents,
   maxSaveCents: band.maxSaveCents,
   confidence: band.overPositiveLimit || band.explicitZero ? 'high' : 'medium',
   reason: band.explicitZero
    ? 'Limite explicitamente zero com gastos confirmados no período.'
    : band.overPositiveLimit
     ? 'Gasto acima do limite cadastrado para esta categoria.'
     : 'Despesa discricionária com margem gradual de redução.',
   evidenceIds: [...(catEvidence.get(exp.name) || [])]
  });
 }

 for (const m of merchantAgg.values()) {
  const tax = classifyCategory(m.categoryName);
  const overlapGroup = tax.categoryId || ('legacy:' + fold(m.categoryName));
  const band = bandForGroup({
   currentCents: m.currentCents,
   limitCents: null,
   categoryId: tax.categoryId,
   kind: 'merchant'
  });
  if (!band) continue;
  candidates.push({
   kind: 'merchant',
   categoryLabel: m.merchant + ' (' + m.categoryName + ')',
   categoryId: tax.categoryId,
   subcategoryId: tax.subcategoryId,
   overlapGroup,
   currentCents: m.currentCents,
   limitCents: null,
   minSaveCents: band.minSaveCents,
   baseSaveCents: band.baseSaveCents,
   maxSaveCents: band.maxSaveCents,
   confidence: 'low',
   reason: 'Estabelecimento concentrado dentro do grupo ' + overlapGroup + '.',
   evidenceIds: [...m.evidenceIds]
  });
 }

 // Anti-double-counting: choose at most ONE independent opportunity per overlapGroup.
 const chosenByGroup = new Map();
 const ranked = [...candidates].sort((a, b) => {
  const rankKind = x => (x.kind === 'merchant' ? 2 : x.limitCents !== null ? 0 : 1);
  return (b.confidence === 'high' ? 1 : 0) - (a.confidence === 'high' ? 1 : 0)
   || rankKind(a) - rankKind(b)
   || b.maxSaveCents - a.maxSaveCents
   || a.categoryLabel.localeCompare(b.categoryLabel, 'pt-BR');
 });

 for (const cand of ranked) {
  if (!chosenByGroup.has(cand.overlapGroup)) {
   chosenByGroup.set(cand.overlapGroup, cand);
  }
 }

 const opportunities = ranked.slice(0, 10).map((cand, idx) => {
  const isChosen = chosenByGroup.get(cand.overlapGroup) === cand;
  const insightId = 'sav:' + createHash('sha256')
   .update([scope.source, scope.profile, scope.month, cand.overlapGroup, cand.categoryLabel, String(idx)].join('|'))
   .digest('hex').slice(0, 14);
  return {
   insightId,
   categoryLabel: cand.categoryLabel,
   categoryId: cand.categoryId,
   subcategoryId: cand.subcategoryId,
   overlapGroup: cand.overlapGroup,
   kind: cand.kind,
   currentCents: cand.currentCents,
   limitCents: cand.limitCents,
   minSaveCents: cand.minSaveCents,
   baseSaveCents: cand.baseSaveCents,
   maxSaveCents: cand.maxSaveCents,
   confidence: cand.confidence,
   independentIncluded: isChosen,
   overlapReason: isChosen ? null : 'Excluída da soma para evitar dupla contagem no mesmo grupo.',
   reason: cand.reason,
   evidenceIds: cand.evidenceIds
  };
 });

 const independent = opportunities.filter(o => o.independentIncluded);
 const minIndependent = independent.reduce((s, o) => s + o.minSaveCents, 0);
 const baseIndependent = independent.reduce((s, o) => s + o.baseSaveCents, 0);
 const maxIndependentSavingsCents = independent.reduce((s, o) => s + o.maxSaveCents, 0);
 if (![minIndependent, baseIndependent, maxIndependentSavingsCents].every(safeCents)) {
  throw Error('STALE: cálculo de economia fora dos limites seguros.');
 }

 authorized(local, scope);
 const second = snapshot(local, scope);
 if (first.signature !== second.signature) {
  return { status: 'stale', message: 'Os dados mudaram durante a análise de economia. Refaça a consulta.' };
 }

 const warnings = [];
 if (first.truncated) warnings.push('Histórico bancário truncado ou incompleto; os limites de economia refletem apenas os registros carregados.');
 if (first.duplicates) warnings.push('Identificadores duplicados detectados e desconsiderados.');
 if (first.missingIds) warnings.push('Lançamentos sem identificador completo foram excluídos.');
 if (access.references?.partial && !first.truncated) warnings.push('Cobertura parcial indicada pela fonte local.');
 if (scope.source === 'bank' && first.lastSyncAt && first.lastSyncAt.slice(0, 10) < p.end) {
  warnings.push('Sincronização anterior ao fim do mês selecionado.');
 }
 if (current.transactionsIncluded === 0) {
  return { status: 'no_data', message: 'Não há despesas confirmadas no período para identificar oportunidades verificáveis de economia.' };
 }

 const status = warnings.length ? 'partial' : 'ready';
 const targetCents = safeCents(intention.targetCents) && intention.targetCents > 0 ? intention.targetCents : null;
 const targetVerified = targetCents === null ? null : (status === 'ready' && maxIndependentSavingsCents >= targetCents);
 const shortfallCents = targetCents !== null && maxIndependentSavingsCents < targetCents
  ? targetCents - maxIndependentSavingsCents
  : 0;

 const scenarios = [
  { id: 'conservative', label: 'Conservador', saveCents: minIndependent, goalReached: targetCents === null ? null : minIndependent >= targetCents },
  { id: 'base', label: 'Base', saveCents: baseIndependent, goalReached: targetCents === null ? null : baseIndependent >= targetCents },
  { id: 'optimistic', label: 'Otimista', saveCents: maxIndependentSavingsCents, goalReached: targetCents === null ? null : maxIndependentSavingsCents >= targetCents }
 ];

 return {
  status,
  guideVersion: COPILOT_GUIDE_VERSION,
  period: p,
  month: scope.month,
  source: scope.source,
  profile: scope.profile,
  asOf: new Date(clock()).toISOString(),
  dataVersion: first.signature,
  targetCents,
  maxIndependentSavingsCents,
  targetVerified,
  shortfallCents,
  opportunities,
  scenarios,
  warnings,
  coverage: {
   state: status === 'ready' ? 'complete' : 'partial',
   loaded: first.rows.length,
   totalTransactions: first.totalTransactions,
   truncated: first.truncated
  },
  method: 'shared/finance-period-ledger.mjs'
 };
}

function describeSavings(result) {
 if (!result || result.status === 'no_data') {
  return result?.message || 'Sem despesas confirmadas para sugerir cortes com segurança.';
 }
 if (result.status === 'stale') return result.message;

 const independent = (result.opportunities || []).filter(o => o.independentIncluded);
 const facts = [
  'Espaço máximo independente estimado sem dupla contagem: ' + formatMoneyBRL(result.maxIndependentSavingsCents) + ' em ' + result.month + '.',
  independent.length
   ? 'Grupos independentes considerados: ' + independent.slice(0, 4).map(o => o.categoryLabel + ' (' + formatMoneyBRL(o.minSaveCents) + ' a ' + formatMoneyBRL(o.maxSaveCents) + ')').join('; ') + '.'
   : 'Nenhuma categoria discricionária com margem verificada neste período.'
 ];

 if (result.targetCents !== null) {
  if (result.targetVerified) {
   facts.push('Meta informada de ' + formatMoneyBRL(result.targetCents) + ': coberta no cenário otimista considerando apenas grupos independentes.');
  } else if (result.shortfallCents > 0) {
   facts.push('Meta informada de ' + formatMoneyBRL(result.targetCents) + ' não é totalmente comprovada pelas evidências atuais: faltam ' + formatMoneyBRL(result.shortfallCents) + ' além do espaço independente (' + formatMoneyBRL(result.maxIndependentSavingsCents) + ').');
  } else {
   facts.push('Meta informada de ' + formatMoneyBRL(result.targetCents) + ' cabe no espaço independente estimado (' + formatMoneyBRL(result.maxIndependentSavingsCents) + '), porém com cobertura parcial dos registros; revise as limitações antes de agir.');
  }
 }

 const overlapCount = (result.opportunities || []).filter(o => !o.independentIncluded).length;
 const estimates = [
  'Cenários independentes: Conservador ' + formatMoneyBRL(result.scenarios[0].saveCents) +
   ', Base ' + formatMoneyBRL(result.scenarios[1].saveCents) +
   ', Otimista ' + formatMoneyBRL(result.scenarios[2].saveCents) + '.' +
   (overlapCount ? ' ' + overlapCount + ' item(ns) no mesmo grupo foram excluídos da soma para evitar dupla contagem.' : '')
 ];

 return buildCopilotAnswer({
  headline: result.targetCents !== null
   ? 'Plano de economia com proteção contra dupla contagem (meta: ' + formatMoneyBRL(result.targetCents) + ')'
   : 'Oportunidades de economia identificadas sem dupla contagem',
  facts,
  estimates,
  limitations: result.warnings,
  guideNote: GUARDRAIL_COPY.SAVINGS_HYPOTHETICAL + ' ' + GUARDRAIL_COPY.NOT_AVAILABLE_BALANCE
 });
}

module.exports = {
 parseSavingsIntent,
 parseBrlCents,
 recommendSavings,
 describeSavings
};
