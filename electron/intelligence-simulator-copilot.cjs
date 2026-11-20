'use strict';
// Marco 2 F4 — Simulador Conversacional e Horizonte de Compromissos.
// Read-only: delegates verified projections to PlanningStore.simulatePurchase
// when planning consent is active, or falls back honestly to shared/finance-installment-quote.mjs.
const { period } = require('./financial-intelligence.cjs');
const { authorized, snapshot } = require('./intelligence-investigation.cjs');
const { parseBrlCents } = require('./intelligence-savings.cjs');
const {
 COPILOT_GUIDE_VERSION,
 GUARDRAIL_COPY,
 formatMoneyBRL,
 buildCopilotAnswer
} = require('../shared/copilot-language.cjs');

const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const safeCents = n => Number.isSafeInteger(n) && Math.abs(n) <= 100_000_000_000;

function isoLocalDate(clock) {
 const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
 }).formatToParts(new Date(clock()));
 const get = t => parts.find(p => p.type === t)?.value;
 return get('year') + '-' + get('month') + '-' + get('day');
}

function parseSimulatorIntent(question) {
 const q = fold(question);
 // Generic "quais dados faltam para avaliar uma compra?" stays on legacy missing-data table.
 if (/dados faltam/.test(q)) return null;

 const horizonMatch = q.match(/(?:compromissos|contas futuras|parcelas futuras).*?(\d{1,2})\s*meses/);
 if (horizonMatch) {
  const horizonMonths = Number(horizonMatch[1]);
  if (Number.isInteger(horizonMonths) && horizonMonths >= 2 && horizonMonths <= 12) {
   return { kind: 'commitments_horizon', horizonMonths, question: q };
  }
 }

 const wantsPurchase = /\b(compra|comprar|parcelar|financiar|a vista|simular gasto|se eu gastar|posso pagar)\b/.test(q);
 const amountCents = wantsPurchase ? parseBrlCents(question) : null;
 if (!wantsPurchase || !amountCents) return null;

 const instMatch = q.match(/\b(\d{1,3})\s*(?:x\b|vezes|parcelas?)/);
 let installments = instMatch ? Number(instMatch[1]) : 1;
 if (instMatch && (!Number.isInteger(installments) || installments < 1 || installments > 60)) {
  return {
   kind: 'purchase',
   invalidReason: 'O simulador aceita parcelamentos entre 1x e 60x. Informe uma quantidade válida.'
  };
 }

 const explicitZeroRate = /sem juros/.test(q);
 const rateMatch = q.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
 let monthlyRate = 0;
 let hasExplicitRate = explicitZeroRate;
 if (!explicitZeroRate && rateMatch) {
  const parsed = Number(rateMatch[1].replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
   return {
    kind: 'purchase',
    invalidReason: 'A taxa mensal informada está fora da faixa suportada (0% a 30% ao mês).'
   };
  }
  monthlyRate = parsed;
  hasExplicitRate = true;
 }

 return {
  kind: 'purchase',
  amountCents,
  installments,
  monthlyRate,
  hasExplicitRate,
  compareCashVsInstallments: installments > 1 || /a vista/.test(q),
  horizonMonths: null,
  question: q
 };
}

function checkPlanningConsent(local, scope) {
 try {
  const r = local.query({ token: scope.token, month: scope.month, intent: 'commitments' }, scope.owner);
  return r?.version === 1 && r?.readOnly === true && r?.references?.planningRead === true;
 } catch {
  return false;
 }
}

async function simulateDecisionForCopilot({ local, scope, intention = {}, clock = Date.now }) {
 if (intention.invalidReason) {
  return { status: 'unsupported', code: 'OUT_OF_RANGE', message: intention.invalidReason };
 }
 const access = authorized(local, scope);
 const first = snapshot(local, scope);
 const today = isoLocalDate(clock);
 const p = period(scope.month);
 const planningAuthorized = checkPlanningConsent(local, scope);
 const warnings = [];

 if (first.truncated) warnings.push('Histórico bancário truncado; considere que registros antigos podem faltar.');
 if (access.references?.partial && !first.truncated) warnings.push('Cobertura parcial na leitura local.');

 if (intention.kind === 'commitments_horizon') {
  if (!planningAuthorized || !local.planner || typeof local.planner.list !== 'function') {
   return {
    status: 'no_data',
    code: 'PLANNING_CONSENT_REQUIRED',
    message: 'Autorize também a leitura do Planejamento no perfil pessoal para consultar compromissos nos próximos ' + intention.horizonMonths + ' meses.'
   };
  }
  const endPeriod = period(scope.month, intention.horizonMonths - 1);
  const items = local.planner.list({ today, start: p.start, end: endPeriod.end }) || [];
  const confirmed = items
   .filter(x => x.kind === 'expense' && x.status === 'planned' && x.certainty === 'confirmed' && safeCents(x.remaining) && x.remaining > 0);
  const totalCents = confirmed.reduce((s, x) => s + x.remaining, 0);
  if (!safeCents(totalCents)) throw Error('STALE: soma de compromissos inválida.');

  authorized(local, scope);
  const second = snapshot(local, scope);
  if (first.signature !== second.signature) return { status: 'stale', message: 'Os dados mudaram durante a consulta.' };

  return {
   status: warnings.length || items.length >= 5000 ? 'partial' : 'ready',
   guideVersion: COPILOT_GUIDE_VERSION,
   mode: 'commitments_horizon',
   horizonMonths: intention.horizonMonths,
   horizonRange: { start: p.start, end: endPeriod.end },
   principalCents: totalCents,
   totalCents,
   installments: confirmed.length,
   schedule: confirmed.slice(0, 25).map(x => ({ id: x.id, title: x.title, date: x.dueDate, amountCents: x.remaining })),
   cashflowVerified: true,
   risk: 'estimate',
   asOf: new Date(clock()).toISOString(),
   dataVersion: first.signature,
   warnings,
   coverage: { state: warnings.length ? 'partial' : 'complete', loaded: confirmed.length, totalTransactions: items.length, truncated: items.length >= 5000 },
   method: 'electron/planning.cjs#list'
  };
 }

 // Purchase / financing decision
 const installments = intention.installments || 1;
 const monthlyRate = intention.monthlyRate || 0;
 const canUsePlanner = planningAuthorized && scope.profile === 'real' && local.planner && typeof local.planner.simulatePurchase === 'function';

 let payload = null;
 if (canUsePlanner) {
  const sim = local.planner.simulatePurchase({
   today,
   amount: intention.amountCents,
   installments,
   monthlyRate,
   includeEstimatedIncome: false
  });
  const cashSim = installments > 1
   ? local.planner.simulatePurchase({ today, amount: intention.amountCents, installments: 1, monthlyRate: 0, includeEstimatedIncome: false })
   : sim;

  const qualityOk=['unverified','manual','recent'].includes(sim.reference?.quality);
  const cashflowVerified=qualityOk&&!sim.reference?.missingBalances&&sim.risk!=='unknown';
  if (!cashflowVerified) {
   warnings.push('Qualidade do saldo ou cobertura de contas insuficiente para confirmar viabilidade integral (' + String(sim.reference?.quality || 'unknown') + ').');
  }
  payload = {
   mode: 'purchase',
   principalCents: sim.principal,
   monthlyCents: sim.monthly,
   totalCents: sim.total,
   interestCents: sim.interest,
   installments: sim.installments,
   monthlyRate,
   schedule: sim.schedule.slice(0, 24).map(s => ({ date: s.date, amountCents: s.amount })),
   cashComparison: {
    totalCents: cashSim.total,
    minimumAfterPurchaseCents: cashSim.minimumAfterPurchase,
    risk: cashSim.risk
   },
   anchorCents: sim.anchor,
   reserveCents: sim.reserve,
   minimumAfterPurchaseCents: sim.minimumAfterPurchase,
   worstDay: sim.worstDay,
   negativeDays: sim.negativeDays,
   belowReserveDays: sim.belowReserveDays,
   risk: sim.risk,
   referenceQuality: sim.reference?.quality || 'unknown',
   cashflowVerified,
   method: 'electron/planning.cjs#simulatePurchase'
  };
 } else {
  const { installmentQuote } = await import('../shared/finance-installment-quote.mjs');
  const quote = installmentQuote({
   today,
   amount: intention.amountCents,
   installments,
   monthlyRate
  });
  warnings.push('Leitura do Planejamento e saldo âncora não autorizados nesta sessão: exibindo somente cálculo exato das parcelas, sem confirmar viabilidade de caixa.');
  payload = {
   mode: 'purchase',
   principalCents: quote.principal,
   monthlyCents: quote.monthly,
   totalCents: quote.total,
   interestCents: quote.interest,
   installments: quote.installments,
   monthlyRate,
   schedule: quote.schedule.slice(0, 24).map(s => ({ date: s.date, amountCents: s.amount })),
   cashComparison: { totalCents: quote.principal, minimumAfterPurchaseCents: null, risk: 'unknown' },
   anchorCents: null,
   reserveCents: null,
   minimumAfterPurchaseCents: null,
   worstDay: null,
   negativeDays: null,
   belowReserveDays: null,
   risk: 'unknown',
   referenceQuality: 'unverified',
   cashflowVerified: false,
   method: 'shared/finance-installment-quote.mjs'
  };
 }

 authorized(local, scope);
 const second = snapshot(local, scope);
 if (first.signature !== second.signature) return { status: 'stale', message: 'Os dados mudaram durante a simulação.' };

 const status = warnings.length ? 'partial' : 'ready';
 return {
  status,
  guideVersion: COPILOT_GUIDE_VERSION,
  ...payload,
  asOf: new Date(clock()).toISOString(),
  dataVersion: first.signature,
  warnings,
  coverage: {
   state: status === 'ready' ? 'complete' : 'partial',
   loaded: first.rows.length,
   totalTransactions: first.totalTransactions,
   truncated: first.truncated
  }
 };
}

function describeDecisionSimulation(result) {
 if (!result || result.status === 'no_data') return result?.message || 'Não há base autorizada para simular.';
 if (result.status === 'stale') return result.message;

 if (result.mode === 'commitments_horizon') {
  return buildCopilotAnswer({
   headline: 'Compromissos confirmados nos próximos ' + result.horizonMonths + ' meses',
   facts: [
    'Total restante planejado entre ' + result.horizonRange.start + ' e ' + result.horizonRange.end + ': ' + formatMoneyBRL(result.totalCents) + ' em ' + result.installments + ' item(ns).',
    'Apenas despesas confirmadas com saldo restante positivo foram somadas; estimativas incertas ficaram de fora.'
   ],
   limitations: result.warnings,
   guideNote: GUARDRAIL_COPY.NOT_AVAILABLE_BALANCE
  });
 }

 const simulations = [
  'Compra de ' + formatMoneyBRL(result.principalCents) + ' em ' + result.installments + 'x' +
   (result.monthlyRate > 0 ? ' (' + String(result.monthlyRate).replace('.', ',') + '% a.m.)' : ' sem juros') +
   ': parcelas base de ' + formatMoneyBRL(result.monthlyCents) + ', total de ' + formatMoneyBRL(result.totalCents) +
   ' (juros: ' + formatMoneyBRL(result.interestCents) + ').'
 ];
 if (result.installments > 1 && result.cashComparison) {
  simulations.push('Comparação à vista: ' + formatMoneyBRL(result.cashComparison.totalCents) + ' (diferença total de ' + formatMoneyBRL(result.interestCents) + ').');
 }
 if (result.cashflowVerified) {
  simulations.push('No fluxo projetado do Planejamento, o menor saldo após a compra é ' + formatMoneyBRL(result.minimumAfterPurchaseCents) + ' em ' + result.worstDay + ' (risco: ' + result.risk + ').');
 }

 return buildCopilotAnswer({
  headline: 'Simulação de decisão financeira (sem gravação no banco local)',
  facts: result.cashflowVerified
   ? ['Saldo âncora utilizado: ' + formatMoneyBRL(result.anchorCents) + '; reserva configurada: ' + formatMoneyBRL(result.reserveCents) + '.']
   : ['Simulação matemática das parcelas realizada em centavos exatos.'],
  simulations,
  limitations: result.warnings,
  guideNote: GUARDRAIL_COPY.PURCHASE_NO_GUARANTEE
 });
}

module.exports = {
 parseSimulatorIntent,
 simulateDecisionForCopilot,
 describeDecisionSimulation
};
