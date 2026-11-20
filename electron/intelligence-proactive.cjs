'use strict';
// Marco 2 F5 — Scanner Proativo e EvidenceEnvelope v1 (MF2-PROACTIVE-V1).
// Read-only MAIN scanner: deduplicates by overlapGroup and limits Hoje to <= 3 insights.
const { createHash } = require('node:crypto');
const { aggregateFinancePeriod, budgetProgress } = require('../shared/finance-period-ledger.mjs');
const { period } = require('./financial-intelligence.cjs');
const { authorized, snapshot, classifyCategory, compareSpendingBreakdown } = require('./intelligence-investigation.cjs');
const { recommendSavings } = require('./intelligence-savings.cjs');
const { detectRecurringCandidates } = require('./intelligence-recurring.cjs');
const { formatMoneyBRL, GUARDRAIL_COPY } = require('../shared/copilot-language.cjs');

const safeCents = n => Number.isSafeInteger(n) && Math.abs(n) <= 100_000_000_000;

function makeInsightId(scope, type, overlapGroup, version) {
 return 'ins:' + createHash('sha256')
  .update([scope.source, scope.profile, scope.month, type, overlapGroup, version || ''].join('|'))
  .digest('hex').slice(0, 16);
}

function scanProactiveInsights({ local, scope, clock = Date.now }) {
 const access = authorized(local, scope);
 const first = snapshot(local, scope);
 const p = period(scope.month);
 const prev = period(scope.month, -1);
 const manual = local.db.load(scope.profile) || { transactions: [], budgets: {} };
 const limits = Object.entries(manual.budgets || {})
  .filter(([, v]) => safeCents(v) && v >= 0)
  .map(([category, amountCents]) => ({ category, amountCents }));

 const records = first.rows.map(r => r.row);
 const current = aggregateFinancePeriod(records, { ...p, source: scope.source });
 const budgets = budgetProgress(limits, current.expenses);

 const rawCandidates = [];

 // 1. Budget breaches or explicit zero-budget spend
 const overBudgets = budgets
  .filter(b => b.spentCents > b.limitCents || (b.limitCents > 0 && b.pct >= 80))
  .sort((a, b) => (b.spentCents - b.limitCents) - (a.spentCents - a.limitCents));
 for (const b of overBudgets.slice(0, 2)) {
  const tax = classifyCategory(b.category);
  const excess = Math.max(0, b.spentCents - b.limitCents);
  const overlapGroup = 'budget:' + (tax.categoryId || b.category.toLowerCase());
  rawCandidates.push({
   priority: b.spentCents > b.limitCents ? 95 : 70,
   type: 'budget_risk',
   overlapGroup,
   categoryId: tax.categoryId,
   subcategoryId: tax.subcategoryId,
   categoryLabel: tax.label,
   title: b.limitCents === 0 ? tax.label + ' com limite R$ 0,00' : b.spentCents > b.limitCents ? tax.label + ' acima do limite' : tax.label + ' perto do limite',
   summary: b.limitCents === 0
    ? 'Gasto de ' + formatMoneyBRL(b.spentCents) + ' com limite explicitamente zerado.'
    : formatMoneyBRL(b.spentCents) + ' de ' + formatMoneyBRL(b.limitCents) + ' (' + b.pct + '%).',
   impactCentsMin: excess,
   impactCentsMax: b.spentCents,
   epistemicKind: 'fact',
   uncertainty: b.limitCents === 0 ? GUARDRAIL_COPY.ZERO_BUDGET : 'Calculado sobre despesas confirmadas carregadas.',
   evidenceIds: [],
   recommendedQuestion: 'Quais categorias ultrapassaram o orçamento?',
   actionTarget: 'budgets'
  });
 }

 // 2. F1 top spending increase vs previous month
 try {
  const f1 = compareSpendingBreakdown({
   local, scope,
   intention: { previous: prev, current: p, question: 'por que gastos aumentaram', followup: false },
   clock
  });
  if (f1 && ['ready', 'partial'].includes(f1.status)) {
   const topJump = (f1.contributions || []).find(c => c.deltaCents > 0);
   if (topJump) {
    const grp = topJump.categoryId || ('legacy:' + topJump.label.toLowerCase());
    rawCandidates.push({
     priority: 85,
     type: 'category_delta',
     overlapGroup: grp,
     categoryId: topJump.categoryId,
     subcategoryId: topJump.subcategoryId,
     categoryLabel: topJump.label,
     title: topJump.label + ' puxou alta mensal',
     summary: 'Variação aritmética de +' + formatMoneyBRL(topJump.deltaCents) + ' frente ao período anterior.',
     impactCentsMin: topJump.deltaCents,
     impactCentsMax: topJump.deltaCents,
     epistemicKind: 'fact',
     uncertainty: GUARDRAIL_COPY.ARITHMETIC_CONTRIBUTION,
     evidenceIds: (topJump.evidenceIds || []).slice(0, 10),
     recommendedQuestion: 'Por que gastei mais em ' + topJump.label + ' neste mês?',
     actionTarget: 'transactions'
    });
   }
  }
 } catch { /* Optional proactive signal fails closed */ }

 // 3. F3 recurring price hikes / strong recurring candidates
 try {
  const f3 = detectRecurringCandidates({ local, scope, intention: {}, clock });
  if (f3 && ['ready', 'partial'].includes(f3.status)) {
   const hike = (f3.priceHikes || [])[0];
   const cand = hike || (f3.candidates || [])[0];
   if (cand) {
    const grp = 'rec:' + cand.merchant.toLowerCase();
    rawCandidates.push({
     priority: hike ? 90 : 65,
     type: 'recurring_candidate',
     overlapGroup: grp,
     categoryId: cand.categoryId,
     subcategoryId: cand.subcategoryId,
     categoryLabel: cand.categoryLabel,
     title: hike ? 'Reajuste observado em ' + cand.merchant : 'Recorrência observada: ' + cand.merchant,
     summary: hike
      ? 'Aumento recente de ' + formatMoneyBRL(cand.priceDeltaCents) + ' na última cobrança frente à média anterior.'
      : 'Presente em ' + cand.observedMonths.length + ' meses distintos no histórico recente.',
     impactCentsMin: hike ? cand.priceDeltaCents : cand.amountMinCents,
     impactCentsMax: hike ? cand.latestCents : cand.amountMaxCents,
     epistemicKind: 'hypothesis',
     uncertainty: GUARDRAIL_COPY.RECURRING_CANDIDATE,
     evidenceIds: (cand.evidenceIds || []).slice(0, 10),
     recommendedQuestion: 'Quais assinaturas recorrentes e reajustes existem no meu histórico?',
     actionTarget: 'intelligence'
    });
   }
  }
 } catch { /* Optional proactive signal fails closed */ }

 // 4. F2 top independent savings opportunity
 try {
  const f2 = recommendSavings({ local, scope, intention: {}, clock });
  if (f2 && ['ready', 'partial'].includes(f2.status)) {
   const opp = (f2.opportunities || []).find(o => o.independentIncluded);
   if (opp) {
    rawCandidates.push({
     priority: 75,
     type: 'discretionary_savings',
     overlapGroup: 'sav:' + opp.overlapGroup,
     categoryId: opp.categoryId,
     subcategoryId: opp.subcategoryId,
     categoryLabel: opp.categoryLabel,
     title: 'Margem de economia em ' + opp.categoryLabel,
     summary: 'Espaço independente estimado entre ' + formatMoneyBRL(opp.minSaveCents) + ' e ' + formatMoneyBRL(opp.maxSaveCents) + '.',
     impactCentsMin: opp.minSaveCents,
     impactCentsMax: opp.maxSaveCents,
     epistemicKind: 'estimate',
     uncertainty: GUARDRAIL_COPY.SAVINGS_HYPOTHETICAL,
     evidenceIds: (opp.evidenceIds || []).slice(0, 10),
     recommendedQuestion: 'Onde posso economizar neste mês sem dupla contagem?',
     actionTarget: 'intelligence'
    });
   }
  }
 } catch { /* Optional proactive signal fails closed */ }

 // 5. Upcoming planning commitments (ONLY if planning read consent exists)
 try {
  const cReply = local.query({ token: scope.token, month: scope.month, intent: 'commitments' }, scope.owner);
  const c = cReply?.facts?.commitments;
  if (c && safeCents(c.totalCents) && c.count > 0) {
   rawCandidates.push({
    priority: 80,
    type: 'upcoming_commitment',
    overlapGroup: 'planning:next-month',
    categoryId: 'cat:contas',
    subcategoryId: null,
    categoryLabel: 'Contas',
    title: c.count === 1 ? '1 compromisso no próximo mês' : c.count + ' compromissos no próximo mês',
    summary: 'Valor confirmado previsto no planejamento para o período.',
    impactCentsMin: c.totalCents,
    impactCentsMax: c.totalCents,
    epistemicKind: 'fact',
    uncertainty: GUARDRAIL_COPY.NOT_AVAILABLE_BALANCE,
    evidenceIds: [],
    recommendedQuestion: 'Quanto tenho comprometido para os próximos 3 meses?',
    actionTarget: 'planning'
   });
  }
 } catch { /* No planning consent: omit planning insight cleanly */ }

 authorized(local, scope);
 const second = snapshot(local, scope);
 if (first.signature !== second.signature) {
  throw Error('STALE: os dados financeiros mudaram durante o scan proativo.');
 }

 // Deduplicate strictly by overlapGroup and cap at 3 insights for Hoje.
 const seenGroups = new Set();
 const selected = [];
 for (const item of rawCandidates.sort((a, b) => b.priority - a.priority || b.impactCentsMax - a.impactCentsMax)) {
  if (seenGroups.has(item.overlapGroup)) continue;
  seenGroups.add(item.overlapGroup);
  const insightId = makeInsightId(scope, item.type, item.overlapGroup, first.signature);
  selected.push({
   insightId,
   evidenceFingerprint: first.signature.slice(0, 16),
   type: item.type,
   title: item.title,
   summary: item.summary,
   importance: item.priority >= 85 ? 'high' : 'medium',
   categoryId: item.categoryId,
   subcategoryId: item.subcategoryId,
   categoryLabel: item.categoryLabel,
   impactCentsMin: item.impactCentsMin,
   impactCentsMax: item.impactCentsMax,
   overlapGroup: item.overlapGroup,
   epistemicKind: item.epistemicKind,
   uncertainty: item.uncertainty,
   evidenceIds: item.evidenceIds,
   recommendedQuestion: item.recommendedQuestion,
   actionTarget: item.actionTarget
  });
  if (selected.length >= 3) break;
 }

 const warnings = [];
 if (first.truncated) warnings.push('Leitura bancária limitada ao cache carregado.');
 if (access.references?.partial && !first.truncated) warnings.push('Cobertura parcial indicada pela fonte local.');

 const envelope = {
  version: 1,
  contract: 'MF2-PROACTIVE-V1',
  readOnly: true,
  changesApplied: false,
  modelCalled: false,
  personalAIWritingEnabled: false,
  status: warnings.length ? 'partial' : 'ready',
  source: scope.source,
  profile: scope.profile,
  period: p,
  month: scope.month,
  dataVersion: first.signature,
  asOf: new Date(clock()).toISOString(),
  coverage: {
   state: warnings.length ? 'partial' : 'complete',
   loaded: first.rows.length,
   totalTransactions: first.totalTransactions,
   truncated: first.truncated
  },
  warnings,
  insights: selected
 };
 if (JSON.stringify(envelope).includes(scope.token)) {
  throw Error('Vazamento de credencial bloqueado no envelope proativo.');
 }
 return envelope;
}

module.exports = {
 scanProactiveInsights
};
