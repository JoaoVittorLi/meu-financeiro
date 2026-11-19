'use strict';
// Marco 2 F3 — Detector Local de Recorrências, Reajustes Silenciosos e Hábitos.
// Read-only deterministic scan up to 12 months; zero external cancel/write actions.
const { createHash } = require('node:crypto');
const { aggregateFinancePeriod } = require('../shared/finance-period-ledger.mjs');
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

function parseRecurringIntent(question) {
 const q = fold(question);
 // Generic "Quanto gastei em assinaturas?" stays with legacy categories lookup.
 if (!/recorren|repetid|fix|reajust|subiu|habit|frequen|detect|identifi|quais assinatur|cancel/.test(q) &&
  /quanto\s+(?:gast|paguei).*\bassinatur/.test(q)) {
  return null;
 }
 const wantsRecurring = /(recorrenc|assinatur|cobrancas? repetid|gastos? fixos?|reajuste|subiu o preco|aumentou a mensalidade|habitos? de gasto|frequencia de gasto|habitos?)/.test(q);
 if (!wantsRecurring) return null;
 return {
  cancelAttempt: /\b(cancelar|cancele|encerrar|encerre|desativar|desative)\b/.test(q),
  seekHabits: /habit|frequen/.test(q),
  seekPriceHikes: /reajust|subiu|aumentou/.test(q),
  question: q
 };
}

function detectRecurringCandidates({ local, scope, intention = {}, clock = Date.now }) {
 if (intention.cancelAttempt) {
  return {
   status: 'unsupported',
   code: 'EXTERNAL_CANCEL_UNSUPPORTED',
   message: GUARDRAIL_COPY.EXTERNAL_CANCEL_UNSUPPORTED
  };
 }

 const access = authorized(local, scope);
 const first = snapshot(local, scope);
 const winStart = period(scope.month, -11).start;
 const winEnd = period(scope.month).end;
 const byMonth = new Map();
 const merchantGroups = new Map();
 const distinctMonths = new Set();

 for (const entry of first.rows) {
  const date = String(entry.row.date || '');
  if (date < winStart || date > winEnd) continue;
  const ym = date.slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(ym)) continue;
  const range = period(ym);
  const piece = aggregateFinancePeriod([entry.row], { ...range, source: scope.source });
  if (piece.expenseCents <= 0) continue;
  distinctMonths.add(ym);
  const mKey = fold(entry.merchant) || 'nao identificado';
  const group = merchantGroups.get(mKey) || {
   merchant: entry.merchant,
   categoryName: piece.expenses[0]?.name || 'Outros',
   months: new Map(),
   days: [],
   amounts: [],
   evidenceIds: new Set()
  };
  const mPrev = group.months.get(ym) || { totalCents: 0, count: 0 };
  mPrev.totalCents += piece.expenseCents;
  mPrev.count += 1;
  group.months.set(ym, mPrev);
  const day = Number(date.slice(8, 10));
  if (Number.isInteger(day)) group.days.push(day);
  group.amounts.push({ date, amountCents: piece.expenseCents });
  if (group.evidenceIds.size < 25) group.evidenceIds.add(entry.id);
  merchantGroups.set(mKey, group);
  byMonth.set(ym, (byMonth.get(ym) || 0) + piece.expenseCents);
 }

 if (distinctMonths.size < 2) {
  return {
   status: 'no_data',
   code: 'INSUFFICIENT_MONTHS',
   message: 'São necessários pelo menos dois meses carregados com despesas confirmadas para identificar padrões recorrentes ou hábitos.'
  };
 }

 const candidates = [];
 const habits = [];
 for (const g of merchantGroups.values()) {
  const observedMonths = [...g.months.keys()].sort();
  if (observedMonths.length < 2) continue;

  const monthlyTotals = observedMonths.map(ym => g.months.get(ym).totalCents);
  const totalOccurrences = g.amounts.length;
  const avgMonthlyCount = Math.round((totalOccurrences / observedMonths.length) * 10) / 10;
  const minCents = Math.min(...monthlyTotals);
  const maxCents = Math.max(...monthlyTotals);
  const latestCents = monthlyTotals[monthlyTotals.length - 1];
  const previousCents = monthlyTotals[monthlyTotals.length - 2];
  const priceDeltaCents = latestCents - previousCents;
  const priceDeltaPct = previousCents > 0 ? Math.round(priceDeltaCents * 100 / previousCents) : null;
  const avgMonthlyCents = Math.round(monthlyTotals.reduce((s, n) => s + n, 0) / monthlyTotals.length);
  const dayMin = g.days.length ? Math.min(...g.days) : 1;
  const dayMax = g.days.length ? Math.max(...g.days) : 31;
  const daySpread = dayMax - dayMin;
  const spreadPct = minCents > 0 ? Math.round((maxCents - minCents) * 100 / minCents) : 100;

  const tax = classifyCategory(g.categoryName);
  const isStrong = observedMonths.length >= 3 && avgMonthlyCount <= 1.3 && spreadPct <= 15 && daySpread <= 5;
  const cadence = avgMonthlyCount >= 2.5 ? 'frequent_habit' : avgMonthlyCount <= 1.5 ? 'monthly' : 'periodic';
  const estimatedAnnualMinCents = minCents * 12;
  const estimatedAnnualMaxCents = maxCents * 12;
  if (![minCents, maxCents, latestCents, previousCents, priceDeltaCents, avgMonthlyCents, estimatedAnnualMinCents, estimatedAnnualMaxCents].every(safeCents)) {
   throw Error('STALE: valores recorrentes inválidos.');
  }

  const insightId = 'rec:' + createHash('sha256')
   .update([scope.source, scope.profile, scope.month, g.merchant].join('|')).digest('hex').slice(0, 14);
  candidates.push({
   insightId,
   merchant: g.merchant,
   categoryLabel: tax.label,
   categoryId: tax.categoryId,
   subcategoryId: tax.subcategoryId,
   observedMonths,
   occurrences: totalOccurrences,
   avgMonthlyCount,
   amountMinCents: minCents,
   amountMaxCents: maxCents,
   previousCents,
   latestCents,
   estimatedMonthlyCents: avgMonthlyCents,
   estimatedAnnualMinCents,
   estimatedAnnualMaxCents,
   cadence,
   certainty: isStrong ? 'strong_candidate' : 'candidate',
   priceDeltaCents,
   priceDeltaPct,
   priceIncreased: priceDeltaCents > 0,
   evidenceIds: [...g.evidenceIds]
  });

  if (avgMonthlyCount >= 2 && observedMonths.length >= 2) {
   const sumTx = g.amounts.reduce((s, a) => s + a.amountCents, 0);
   const avgTicketCents = Math.round(sumTx / g.amounts.length);
   habits.push({
    merchant: g.merchant,
    categoryLabel: tax.label,
    observedMonths: observedMonths.length,
    totalOccurrences,
    monthlyCountAvg: avgMonthlyCount,
    avgTicketCents,
    latestMonthCents: latestCents
   });
  }
 }

 candidates.sort((a, b) =>
  (b.certainty === 'strong_candidate' ? 1 : 0) - (a.certainty === 'strong_candidate' ? 1 : 0)
  || b.estimatedMonthlyCents - a.estimatedMonthlyCents
  || a.merchant.localeCompare(b.merchant, 'pt-BR')
 );
 habits.sort((a, b) => b.totalOccurrences - a.totalOccurrences || b.latestMonthCents - a.latestMonthCents);

 authorized(local, scope);
 const second = snapshot(local, scope);
 if (first.signature !== second.signature) {
  return { status: 'stale', message: 'Os registros mudaram durante a detecção de recorrências. Refaça a consulta.' };
 }

 const warnings = [];
 if (first.truncated) warnings.push('Histórico bancário truncado ou incompleto; cobranças fora da janela carregada podem faltar.');
 if (first.duplicates) warnings.push('Identificadores duplicados detectados e desconsiderados.');
 if (access.references?.partial && !first.truncated) warnings.push('Cobertura parcial indicada pela fonte local.');

 const topCandidates = candidates.slice(0, 25);
 const priceHikes = topCandidates.filter(c => c.priceIncreased && c.priceDeltaCents > 0);
 const estimatedMonthlyTotalCents = topCandidates.reduce((s, c) => s + c.estimatedMonthlyCents, 0);
 if (!safeCents(estimatedMonthlyTotalCents)) throw Error('STALE: soma mensal recorrente inválida.');

 return {
  status: warnings.length ? 'partial' : 'ready',
  guideVersion: COPILOT_GUIDE_VERSION,
  period: period(scope.month),
  window: { start: winStart, end: winEnd, observedMonthCount: distinctMonths.size },
  source: scope.source,
  profile: scope.profile,
  asOf: new Date(clock()).toISOString(),
  dataVersion: first.signature,
  candidates: topCandidates,
  priceHikes,
  priceHikeCount: priceHikes.length,
  habits: habits.slice(0, 10),
  estimatedMonthlyTotalCents,
  warnings,
  coverage: {
   state: warnings.length ? 'partial' : 'complete',
   loaded: first.rows.length,
   totalTransactions: first.totalTransactions,
   truncated: first.truncated
  },
  method: 'shared/finance-period-ledger.mjs'
 };
}

function describeRecurring(result) {
 if (!result || result.status === 'no_data') {
  return result?.message || 'Sem ocorrências suficientes para detectar recorrências.';
 }
 if (result.status === 'stale' || result.status === 'unsupported') return result.message;

 const cands = result.candidates || [];
 const hikes = result.priceHikes || [];
 const hypotheses = [];
 const facts = [
  'Analisados ' + result.window.observedMonthCount + ' mês(es) carregados (' + result.window.start + ' a ' + result.window.end + ').',
  cands.length
   ? cands.length + ' candidato(s) recorrente(s) com soma mensal média observada de ' + formatMoneyBRL(result.estimatedMonthlyTotalCents) + '.'
   : 'Nenhuma descrição repetida em dois meses distintos foi encontrada.'
 ];
 if (hikes.length) {
  facts.push('Reajuste observado em ' + hikes.slice(0, 3).map(h => h.merchant + ' (+' + formatMoneyBRL(h.priceDeltaCents) + ')').join('; ') + '.');
 }
 if (result.habits?.length) {
  hypotheses.push('Hábitos frequentes: ' + result.habits.slice(0, 3).map(x => x.merchant + ' (' + x.monthlyCountAvg + 'x/mês, ticket médio ' + formatMoneyBRL(x.avgTicketCents) + ')').join('; ') + '.');
 }
 hypotheses.push(GUARDRAIL_COPY.RECURRING_CANDIDATE);

 return buildCopilotAnswer({
  headline: 'Candidatos recorrentes e hábitos observados no histórico local',
  facts,
  hypotheses,
  limitations: result.warnings,
  guideNote: GUARDRAIL_COPY.NOT_AVAILABLE_BALANCE
 });
}

module.exports = {
 parseRecurringIntent,
 detectRecurringCandidates,
 describeRecurring
};
