'use strict';
// Guia Permanente do Copiloto (Marco 2 · M2-GUIDE-V1).
// Pure deterministic PT-BR language rules, epistemic labels and formatting guardrails.
// Zero I/O, zero network, zero SQL, zero fabricated money.

const COPILOT_GUIDE_VERSION = 'M2-GUIDE-V1';
const MAX_ANSWER_CHARS = 4000;

const EPISTEMIC_KIND = Object.freeze({
 FACT: 'fact',
 HYPOTHESIS: 'hypothesis',
 ESTIMATE: 'estimate',
 SIMULATION: 'simulation',
 LIMITATION: 'limitation'
});

const EPISTEMIC_LABELS = Object.freeze({
 fact: 'Fato observado',
 hypothesis: 'Hipótese a confirmar',
 estimate: 'Estimativa condicional',
 simulation: 'Simulação hipotética',
 limitation: 'Limitação dos dados'
});

const GUARDRAIL_COPY = Object.freeze({
 NOT_AVAILABLE_BALANCE: 'Resultado mensal observado não equivale a saldo bancário disponível.',
 ARITHMETIC_CONTRIBUTION: 'Os valores mostram contribuições aritméticas, não a causa pessoal das compras.',
 RECURRING_CANDIDATE: 'Repetição observada indica candidato recorrente — confirme se é uma assinatura ativa.',
 SAVINGS_HYPOTHETICAL: 'Cenários de economia estimam espaço de redução sem dupla contagem; nenhum limite foi alterado.',
 PURCHASE_NO_GUARANTEE: 'Simulação somente de leitura: saldos e compromissos não garantem aprovação futura; nenhuma compra foi criada.',
 EXTERNAL_CANCEL_UNSUPPORTED: 'Não realizo cancelamentos externos nem alterações automáticas de assinaturas. Revise e decida diretamente com o fornecedor.',
 PARTIAL_HISTORY: 'Análise restrita aos registros locais carregados no período informado.',
 ZERO_BUDGET: 'Limite explicitamente definido em R$ 0,00; percentual omitido por base zero.'
});

function formatMoneyBRL(cents) {
 if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100_000_000_000) {
  return 'valor não verificável';
 }
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatPercentOrNull(pct) {
 if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'base zero';
 const rounded = Math.round(pct * 10) / 10;
 return String(rounded).replace('.', ',') + '%';
}

function stripInternalJargon(text) {
 return String(text || '')
  .replace(/\b(?:IC-READ|IC2-READ-QUERY|IC2|I2-[A-E]|I3-\d{2}|D0[1-5]|B05|UI-0[1-8]|MF2-[A-Z0-9-]+)\b/g, 'consulta local')
  .replace(/\s{2,}/g, ' ')
  .trim();
}

function cleanLines(items, limit = 6) {
 if (!Array.isArray(items)) return [];
 return items
  .map(item => String(item || '').trim())
  .filter(Boolean)
  .slice(0, limit);
}

function buildCopilotAnswer({
 headline = '',
 facts = [],
 hypotheses = [],
 estimates = [],
 simulations = [],
 limitations = [],
 guideNote = ''
} = {}) {
 const sections = [];
 const head = String(headline || '').trim();
 if (head) sections.push(head);

 const f = cleanLines(facts, 6);
 if (f.length) sections.push(f.join('\n'));

 const h = cleanLines(hypotheses, 4);
 if (h.length) sections.push('Hipóteses a confirmar: ' + h.join(' '));

 const e = cleanLines(estimates, 4);
 if (e.length) sections.push('Estimativas condicionais: ' + e.join(' '));

 const s = cleanLines(simulations, 4);
 if (s.length) sections.push('Simulação hipotética: ' + s.join(' '));

 const l = cleanLines(limitations, 6);
 if (l.length) sections.push('Limitações: ' + l.join(' '));

 const note = String(guideNote || '').trim();
 if (note) sections.push(note);

 let output = sections.join('\n\n').trim();
 if (output.length > MAX_ANSWER_CHARS) {
  output = output.slice(0, MAX_ANSWER_CHARS - 3).trimEnd() + '...';
 }
 return output;
}

module.exports = {
 COPILOT_GUIDE_VERSION,
 MAX_ANSWER_CHARS,
 EPISTEMIC_KIND,
 EPISTEMIC_LABELS,
 GUARDRAIL_COPY,
 formatMoneyBRL,
 formatPercentOrNull,
 stripInternalJargon,
 buildCopilotAnswer
};
