'use strict';
// M3-S2 (M3-SALARY): Deterministic integer-cents salary budget reorganization engine.
// Uses shared/finance-period-ledger.mjs as single canonical source; never writes to SQLite.
const { aggregateFinancePeriod } = require('../shared/finance-period-ledger.mjs');

const MAX_CENTS = 100_000_000_000;
const MONTH_RX = /^20\d\d-(0[1-9]|1[0-2])$/;

const ESSENTIAL_NAMES = new Set(['moradia', 'saude', 'contas', 'educacao']);
const CORE_NAMES = new Set(['alimentacao', 'transporte']);

const STARTER_WEIGHTS = {
  moradia: 30,
  alimentacao: 18,
  transporte: 10,
  contas: 10,
  saude: 8,
  educacao: 5,
  assinaturas: 4,
  compras: 5,
  lazer: 5,
  outros: 5
};

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const moneyFmt = (c) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100);

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function parseMoneyToCents(raw) {
  if (typeof raw === 'number') {
    if (Number.isSafeInteger(raw) && raw > 0 && raw <= MAX_CENTS) return raw;
    return null;
  }
  const str = String(raw || '').trim();
  if (!str) return null;

  // Suffix "mil" (e.g. "7,5 mil", "7 mil")
  const milMatch = /^r\$\s*|^(\d+(?:[.,]\d+)?)\s*mil\b/i.exec(str.replace(/^r\$\s*/i, ''));
  if (/^\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*mil\b/i.test(str)) {
    const m = /^\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*mil\b/i.exec(str);
    const val = Number(m[1].replace(',', '.'));
    if (Number.isFinite(val) && val > 0) {
      const cents = Math.round(val * 1000 * 100);
      return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_CENTS ? cents : null;
    }
  }
  void milMatch;

  const clean = str.replace(/^r\$\s*/i, '').replace(/\s+/g, '');
  let intPart = '0';
  let fracPart = '00';
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(clean)) {
    const [i, f = ''] = clean.split(',');
    intPart = i.replace(/\./g, '');
    fracPart = f.padEnd(2, '0').slice(0, 2);
  } else if (/^\d+(?:,\d{1,2})?$/.test(clean)) {
    const [i, f = ''] = clean.split(',');
    intPart = i;
    fracPart = f.padEnd(2, '0').slice(0, 2);
  } else if (/^\d+\.\d{1,2}$/.test(clean)) {
    const [i, f = ''] = clean.split('.');
    intPart = i;
    fracPart = f.padEnd(2, '0').slice(0, 2);
  } else {
    return null;
  }
  const cents = Number(intPart) * 100 + Number(fracPart);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_CENTS ? cents : null;
}

function parseSalaryBudgetCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;
  const f = fold(raw);

  const hasBudgetWord = /\b(?:orcamentos?|limites?|gastos?|reorganiz\w*|organiz\w*|redistribu\w*|distribu\w*|ajust\w*|planej\w*|atualiz\w*|defin\w*|salv\w*)\b/.test(f);
  const hasSalaryWord = /\b(?:salario|salarios|renda|remuneracao|holerite|recebi|ganho)\b/.test(f);
  const hasDirectBudgetVerb = /\b(?:reorganiz\w*|redistribu\w*|recalcul\w*|equilibr\w*)\b.*\b(?:orcamentos?|limites?)\b/.test(f);

  if (!((hasSalaryWord && hasBudgetWord) || hasDirectBudgetVerb)) {
    return null;
  }

  let profileMode = 'balanced';
  if (/\bconservador\w*\b/.test(f)) profileMode = 'conservative';
  else if (/\bflex[ií]vel|\bflexivel|\barrojad\w*|\bfolga\b/.test(f)) profileMode = 'flexible';

  const updateIncomeSetting =
    /\b(?:atualiz\w*|salv\w*|registr\w*|defin\w*|grav\w*|mud\w*)\b.*\b(?:renda|salario)\b|\brenda mensal de referencia\b/.test(f);

  // Extract optional reserve clause first so we don't confuse reserve R$ with salary R$
  let workingText = raw;
  let reserveGoalCents = null;
  let reserveGoalPercent = null;
  const reserveClauseRx =
    /(?:quero\s+|preciso\s+|meta\s+(?:de\s+)?)?(?:guard(?:e|ar)|poup(?:e|ar)|economiz(?:e|ar)|reserv(?:e|ar)|deix(?:e|ar)(?:\s+em|\s+de)?\s+reserva)\s*(?:de\s+|ao\s+menos\s+|pelo\s+menos\s+)?(?:(\d{1,2}(?:[.,]\d+)?)\s*%|(r\$\s*(?:\d+(?:[.,]\d+)?\s*mil|\d+(?:[.,]\d+)*)|(?:\d+(?:[.,]\d+)?\s*mil|\d+(?:[.,]\d+)*)(?:\s*reais)?))/i;
  const rm = reserveClauseRx.exec(workingText);
  if (rm) {
    if (rm[1]) {
      const pct = Number(rm[1].replace(',', '.'));
      if (Number.isFinite(pct) && pct >= 0 && pct <= 90) reserveGoalPercent = pct;
    } else if (rm[2]) {
      const parsedReserve = parseMoneyToCents(rm[2]);
      if (parsedReserve !== null) reserveGoalCents = parsedReserve;
    }
    workingText = workingText.slice(0, rm.index) + ' ' + workingText.slice(rm.index + rm[0].length);
  }

  // Extract salary amount from remaining text
  let salaryCents = null;
  const moneyPattern = '(r\\$\\s*(?:\\d+(?:[.,]\\d+)?\\s*mil|\\d+(?:[.,]\\d+)*)|\\d+(?:[.,]\\d+)?\\s*mil|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)';
  const contextRx = new RegExp(
    '(?:sal[áa]rio(?:\\s+(?:mensal|l[íi]quido))?|renda(?:\\s+(?:mensal|l[íi]quida))?|remunera[çc][ãa]o|ganho(?:\\s+mensal)?|recebi(?:\\s+l[íi]quido)?|para)\\s*(?:este\\s+m[êe]s\\s*)?(?:[ée]|foi|em|de|para|:|=)?\\s*' +
      moneyPattern,
    'i'
  );
  const cm = contextRx.exec(workingText);
  if (cm && cm[1]) {
    salaryCents = parseMoneyToCents(cm[1]);
  }
  if (!salaryCents) {
    const fallbackMatches = [...workingText.matchAll(new RegExp(moneyPattern, 'gi'))];
    const parsedAll = fallbackMatches
      .map((x) => parseMoneyToCents(x[1]))
      .filter((v) => v !== null);
    if (parsedAll.length > 0) {
      salaryCents = Math.max(...parsedAll);
    }
  }

  // Extract explicitly protected categories after "preservando / mantendo / protegendo / sem cortar"
  const protectedHints = [];
  const protRx = /\b(?:preservando|mantendo|protegendo|priorizando|sem\s+cortar)\s+([^.;!\n]+)/i;
  const pm = protRx.exec(raw);
  if (pm && pm[1]) {
    const cleanedProt = pm[1].replace(/\b(?:e\s+distribu\w*|o\s+resto).*$/i, '');
    for (const part of cleanedProt.split(/\s*(?:,|\/|\be\b)\s*/i)) {
      const folded = fold(part);
      if (folded.length >= 3) protectedHints.push(folded);
    }
  }

  if (!salaryCents) {
    return {
      matched: true,
      missingSalary: true,
      profileMode,
      updateIncomeSetting,
      protectedHints
    };
  }

  if (reserveGoalCents === null && reserveGoalPercent !== null) {
    reserveGoalCents = Math.round((salaryCents * reserveGoalPercent) / 100);
  }
  if (reserveGoalCents !== null && reserveGoalCents > salaryCents) {
    reserveGoalCents = salaryCents;
  }

  return {
    matched: true,
    missingSalary: false,
    salaryCents,
    reserveGoalCents,
    profileMode,
    updateIncomeSetting,
    protectedHints
  };
}

/**
 * Distributes `pool` integer cents proportionally across `indices` weighted by `weights`,
 * never exceeding `caps[i]`, using largest-remainder allocation (exact sum, zero float drift).
 */
function distributeProportional(indices, weights, caps, allocations, pool) {
  let remaining = pool;
  if (remaining <= 0 || indices.length === 0) return 0;

  let active = indices.filter((i) => caps[i] - allocations[i] > 0 && weights[i] > 0);
  while (remaining > 0 && active.length > 0) {
    const totalWeight = active.reduce((s, i) => s + weights[i], 0);
    if (totalWeight <= 0) break;
    const totalHeadroom = active.reduce((s, i) => s + (caps[i] - allocations[i]), 0);
    if (totalHeadroom <= 0) break;

    if (remaining >= totalHeadroom) {
      for (const i of active) {
        allocations[i] = caps[i];
      }
      remaining -= totalHeadroom;
      break;
    }

    // Standard Hamilton / largest-remainder on current step
    let distributed = 0;
    const remainders = [];
    for (const i of active) {
      const headroom = caps[i] - allocations[i];
      const num = BigInt(remaining) * BigInt(weights[i]);
      const den = BigInt(totalWeight);
      const base = Number(num / den);
      const frac = Number(num % den);
      const grant = Math.min(headroom, base);
      allocations[i] += grant;
      distributed += grant;
      if (allocations[i] < caps[i]) {
        remainders.push({ i, frac, headroom: caps[i] - allocations[i] });
      }
    }
    remaining -= distributed;

    if (remaining > 0 && remainders.length > 0) {
      remainders.sort((a, b) => b.frac - a.frac || b.headroom - a.headroom || a.i - b.i);
      let progress = false;
      for (const r of remainders) {
        if (remaining <= 0) break;
        const left = caps[r.i] - allocations[r.i];
        if (left > 0) {
          allocations[r.i] += 1;
          remaining -= 1;
          progress = true;
        }
      }
      if (!progress && distributed === 0) break;
    } else if (distributed === 0) {
      break;
    }

    active = active.filter((i) => caps[i] - allocations[i] > 0);
  }
  return remaining;
}

function medianCents(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function loadCanonicalRows(db, profile, source) {
  const manual = db.load(profile) || { transactions: [], budgets: {}, monthlyBudgets: {}, settings: {} };
  if (source === 'bank') {
    const bank = db.bankOverview();
    const records = bank?.transactions || [];
    const rows = records.map((r) => ({
      date: r.date,
      status: r.status,
      nature: r.nature,
      amountCents: r.amount,
      description: r.description,
      category: r.splitOutdated ? null : r.category,
      splits: !r.splitOutdated && Array.isArray(r.splits)
        ? r.splits.map((p) => ({ category: p.category, amountCents: p.amount }))
        : undefined
    }));
    return { rows, manual, truncated: !!bank?.truncated };
  }
  const rows = (manual.transactions || []).map((r) => ({
    date: r.date,
    kind: r.kind,
    amountCents: r.amount,
    description: r.description,
    category: r.category
  }));
  return { rows, manual, truncated: false };
}

function buildSalaryBudgetProposal({
  db,
  planner = null,
  profile = 'real',
  source = 'bank',
  month,
  salaryCents,
  reserveGoalCents = null,
  profileMode = 'balanced',
  protectedCategories = [],
  protectedHints = [],
  lockedCategories = {},
  updateIncomeSetting = false,
  applyRecurring = false
} = {}) {
  if (!db) throw Error('M3-SALARY: FinanceDB obrigatório.');
  if (!['real', 'demo'].includes(profile)) throw Error('M3-SALARY: perfil inválido.');
  if (profile === 'demo' && source !== 'manual') {
    throw Error('M3-SALARY: perfil demonstração suporta apenas fonte manual.');
  }
  if (!['bank', 'manual'].includes(source)) throw Error('M3-SALARY: origem inválida.');
  if (typeof month !== 'string' || !MONTH_RX.test(month)) throw Error('M3-SALARY: mês inválido.');
  if (!Number.isSafeInteger(salaryCents) || salaryCents <= 0 || salaryCents > MAX_CENTS) {
    throw Error('M3-SALARY: valor de salário inválido em centavos.');
  }
  if (
    reserveGoalCents !== null &&
    (!Number.isSafeInteger(reserveGoalCents) || reserveGoalCents < 0 || reserveGoalCents > salaryCents)
  ) {
    throw Error('M3-SALARY: meta de reserva inválida.');
  }
  const mode = ['conservative', 'balanced', 'flexible'].includes(profileMode) ? profileMode : 'balanced';

  const { rows, manual, truncated } = loadCanonicalRows(db, profile, source);
  const effectiveMap =
    typeof db.effectiveBudgets === 'function'
      ? db.effectiveBudgets(profile, month).effective
      : { ...(manual.budgets || {}), ...(manual.monthlyBudgets?.[month] || {}) };
  const currentIncomeSettingCents = Number.isSafeInteger(manual.settings?.income) ? manual.settings.income : 0;

  // Analyze up to 6 COMPLETE calendar months strictly prior to `month` (never include partial current month).
  const priorMonths = [];
  for (let i = 1; i <= 6; i++) {
    const pm = shiftMonth(month, -i);
    const pr = monthRange(pm);
    const agg = aggregateFinancePeriod(rows, { start: pr.start, end: pr.end, source });
    if (agg.transactionsIncluded > 0 || agg.expenseCents > 0) {
      priorMonths.push({ month: pm, idxFromRecent: i, agg });
    }
  }
  const completeMonthsAnalyzed = priorMonths.length;
  const confidence = completeMonthsAnalyzed >= 3 ? 'high' : completeMonthsAnalyzed === 2 ? 'medium' : 'low';

  const monthlyByCat = new Map();
  for (const pm of priorMonths) {
    for (const item of pm.agg.expenses) {
      if (!monthlyByCat.has(item.name)) monthlyByCat.set(item.name, []);
      monthlyByCat.get(item.name).push({ month: pm.month, idxFromRecent: pm.idxFromRecent, amountCents: item.amountCents });
    }
  }

  // Current month spent and income from canonical ledger
  const curRange = monthRange(month);
  const currentAgg = aggregateFinancePeriod(rows, { start: curRange.start, end: curRange.end, source });
  const currentSpentByCat = new Map(currentAgg.expenses.map((x) => [x.name, x.amountCents]));
  const observedIncomeCents = currentAgg.incomeCents || 0;
  const observedSalaryCents = currentAgg.incomes
    .filter((x) => fold(x.name) === 'salario')
    .reduce((s, x) => s + x.amountCents, 0);

  // Remaining planned obligations and planned income for `month` ONLY (unpaid remaining cents; avoids double counting!)
  const plannedRemainingByCat = new Map();
  let plannedIncomeCents = 0;
  if (planner && typeof planner.list === 'function' && profile === 'real') {
    const items = planner.list({ start: curRange.start, end: curRange.end });
    for (const item of items) {
      if (item.status === 'planned' && Number.isSafeInteger(item.remaining) && item.remaining > 0) {
        if (item.kind === 'expense') {
          plannedRemainingByCat.set(item.category, (plannedRemainingByCat.get(item.category) || 0) + item.remaining);
        } else if (item.kind === 'income') {
          plannedIncomeCents += item.remaining;
        }
      }
    }
  }

  const salaryStatus =
    observedSalaryCents > 0 || observedIncomeCents >= Math.round(salaryCents * 0.5)
      ? 'received_in_statement'
      : 'planned_reference';
  const incomeVsBalanceNote =
    'Renda mensal informada não equivale ao saldo bancário disponível; previsões futuras incertas não contam como dinheiro em conta.';

  // Gather eligible expense categories from SQLite catalog
  const allCategories = db.listCategories().categories.filter((c) => c.kind !== 'income');
  const protectedSet = new Set([
    ...(Array.isArray(protectedCategories) ? protectedCategories.map(fold) : []),
    ...(Array.isArray(protectedHints) ? protectedHints.map(fold) : [])
  ]);

  // Resolve valid explicit category locks (fixed integer cents)
  const lockedFolded = new Map();
  if (lockedCategories && typeof lockedCategories === 'object' && !Array.isArray(lockedCategories)) {
    for (const [k, v] of Object.entries(lockedCategories)) {
      if (Number.isSafeInteger(v) && v >= 0 && v <= MAX_CENTS) {
        lockedFolded.set(fold(k), v);
      }
    }
  }

  const recent3Count = priorMonths.filter((p) => p.idxFromRecent <= 3).length;
  const atypicalMonths = [];
  const candidates = [];

  for (const cat of allCategories) {
    const nameFold = fold(cat.name);
    const currentLimitCents = Number.isSafeInteger(effectiveMap[cat.name]) ? effectiveMap[cat.name] : null;
    const rawEntries = monthlyByCat.get(cat.name) || [];
    const byMonthAmount = new Map(rawEntries.map((e) => [e.month, e.amountCents]));

    const sumAll6 = priorMonths.reduce((s, pm) => s + (byMonthAmount.get(pm.month) || 0), 0);
    const avg6mCents = completeMonthsAnalyzed > 0 ? Math.round(sumAll6 / completeMonthsAnalyzed) : 0;

    const recent3Months = priorMonths.filter((p) => p.idxFromRecent <= 3);
    const sumRecent3 = recent3Months.reduce((s, pm) => s + (byMonthAmount.get(pm.month) || 0), 0);
    const avg3mCents = recent3Months.length > 0 ? Math.round(sumRecent3 / recent3Months.length) : avg6mCents;

    // Outlier / atypical month detection across prior complete months (>= 3 months analyzed)
    let cleanHistAvgCents = recent3Months.length >= 2 ? avg3mCents : avg6mCents;
    let atypicalDetected = false;
    let atypicalNote = null;
    if (completeMonthsAnalyzed >= 3) {
      const series = priorMonths.map((pm) => ({ month: pm.month, val: byMonthAmount.get(pm.month) || 0 }));
      const trimmedVals = [];
      for (let i = 0; i < series.length; i++) {
        const others = series.filter((_, j) => j !== i).map((x) => x.val);
        const med = medianCents(others);
        const cur = series[i].val;
        if (med > 0 && cur > Math.round(med * 1.8) && cur - med >= 10000) {
          atypicalDetected = true;
          atypicalNote = `Mês atípico em ${series[i].month} (${moneyFmt(cur)} vs mediana ${moneyFmt(med)}) suavizado na base.`;
          atypicalMonths.push({
            month: series[i].month,
            category: cat.name,
            amountCents: cur,
            medianOthersCents: med
          });
          trimmedVals.push(Math.max(med, Math.round(med * 1.35)));
        } else {
          trimmedVals.push(cur);
        }
      }
      if (atypicalDetected) {
        cleanHistAvgCents = Math.round(trimmedVals.reduce((a, b) => a + b, 0) / trimmedVals.length);
      }
    }

    const histAvgCents = cleanHistAvgCents;
    const currentSpentCents = currentSpentByCat.get(cat.name) || 0;
    const plannedRemainingCents = plannedRemainingByCat.get(cat.name) || 0;
    const committedFloorCents = currentSpentCents + plannedRemainingCents;
    const isLocked = lockedFolded.has(nameFold);
    const lockedValueCents = isLocked ? lockedFolded.get(nameFold) : null;
    const isProtected =
      protectedSet.has(nameFold) ||
      Array.from(protectedSet).some((hint) => hint.length >= 4 && nameFold.includes(hint));

    const hasSignal =
      committedFloorCents > 0 ||
      avg6mCents > 0 ||
      avg3mCents > 0 ||
      (currentLimitCents !== null && currentLimitCents > 0) ||
      isProtected ||
      isLocked ||
      Boolean(cat.builtIn);
    if (!hasSignal) continue;

    let tier = 'discretionary';
    if (ESSENTIAL_NAMES.has(nameFold) || isProtected) tier = 'essential';
    else if (CORE_NAMES.has(nameFold)) tier = 'core';

    candidates.push({
      category: cat.name,
      tier,
      isProtected,
      isLocked,
      lockedValueCents,
      currentLimitCents,
      histAvgCents,
      avg3mCents,
      avg6mCents,
      atypicalDetected,
      atypicalNote,
      currentSpentCents,
      plannedRemainingCents,
      committedFloorCents
    });
  }

  // If sparse non-builtin scenario left zero candidates, fallback safely to whatever expense categories exist
  if (candidates.length === 0) {
    for (const cat of allCategories.slice(0, 12)) {
      candidates.push({
        category: cat.name,
        tier: ESSENTIAL_NAMES.has(fold(cat.name)) ? 'essential' : CORE_NAMES.has(fold(cat.name)) ? 'core' : 'discretionary',
        isProtected: false,
        isLocked: false,
        lockedValueCents: null,
        currentLimitCents: null,
        histAvgCents: 0,
        avg3mCents: 0,
        avg6mCents: 0,
        atypicalDetected: false,
        atypicalNote: null,
        currentSpentCents: 0,
        plannedRemainingCents: 0,
        committedFloorCents: 0
      });
    }
  }

  const modeReserveRatio = mode === 'conservative' ? 0.2 : mode === 'flexible' ? 0.1 : 0.15;
  const targetReserveCents =
    reserveGoalCents !== null ? reserveGoalCents : Math.round(salaryCents * modeReserveRatio);
  const spendableAfterReserve = Math.max(0, salaryCents - targetReserveCents);

  const hasHistoricalOrCommittedSignal = candidates.some(
    (c) => c.histAvgCents > 0 || c.committedFloorCents > 0 || (c.currentLimitCents ?? 0) > 0 || c.isLocked
  );

  // Determine desired target per category (never flat % division when real history/commitments exist)
  const totalStarterWeight = candidates.reduce((s, c) => s + (STARTER_WEIGHTS[fold(c.category)] || 3), 0);
  const modeFactors = {
    conservative: { essential: 1.0, core: 0.9, discretionary: 0.78 },
    balanced: { essential: 1.0, core: 1.0, discretionary: 0.92 },
    flexible: { essential: 1.0, core: 1.08, discretionary: 1.05 }
  }[mode];

  for (const c of candidates) {
    if (c.isLocked) {
      c.desiredCents = c.lockedValueCents;
      c.usedStarterWeight = false;
    } else if (!hasHistoricalOrCommittedSignal) {
      const w = STARTER_WEIGHTS[fold(c.category)] || 3;
      c.desiredCents = Math.max(0, Math.round((spendableAfterReserve * w) / Math.max(1, totalStarterWeight)));
      c.usedStarterWeight = true;
    } else {
      const baseSignal =
        c.histAvgCents > 0
          ? c.histAvgCents
          : c.currentLimitCents !== null
            ? c.currentLimitCents
            : c.committedFloorCents;
      const factor = c.isProtected ? 1.0 : modeFactors[c.tier];
      const scaled = Math.round(baseSignal * factor);
      c.desiredCents = Math.max(c.committedFloorCents, scaled);
      c.usedStarterWeight = false;
    }
  }

  const totalCommittedCents = candidates.reduce((s, c) => s + c.committedFloorCents, 0);
  const allocations = candidates.map((c) => (c.isLocked ? c.lockedValueCents : c.committedFloorCents));
  const initialLockedPlusCommitted = allocations.reduce((s, v) => s + v, 0);
  const desiredCaps = candidates.map((c) => c.desiredCents);
  const weights = candidates.map((c) => (c.isLocked ? 0 : Math.max(1, c.desiredCents - c.committedFloorCents)));

  let deficit = false;
  let deficitCents = 0;
  let proposedReserveCents = 0;
  let unallocatedCents = 0;
  const warnings = [];

  if (truncated) {
    warnings.push('Histórico bancário carregado com limite de 2.500 transações; médias consideram os registros carregados.');
  }
  if (observedSalaryCents > 0) {
    warnings.push(
      `Salário de ${moneyFmt(observedSalaryCents)} já registrado nas entradas de ${month}; nenhum lançamento duplicado será adicionado.`
    );
  }
  if (atypicalMonths.length > 0) {
    const cats = [...new Set(atypicalMonths.map((a) => `${a.category} (${a.month})`))].slice(0, 4).join(', ');
    warnings.push(`Mês(es) atípico(s) detectado(s) e suavizado(s) na média: ${cats}.`);
  }
  if (completeMonthsAnalyzed === 0) {
    warnings.push(
      hasHistoricalOrCommittedSignal
        ? 'Nenhum mês completo anterior registrado no histórico: distribuição apoiada em compromissos do mês, limites atuais e pesos iniciais (confiança baixa).'
        : 'Sem meses completos anteriores nem compromissos registrados: distribuição gerada por pesos iniciais (confiança baixa); ajuste os limites conforme sua realidade.'
    );
  } else if (completeMonthsAnalyzed === 1) {
    warnings.push('Apenas 1 mês completo anterior disponível; recomendações têm confiança inicial.');
  }

  if (salaryCents < initialLockedPlusCommitted) {
    deficit = true;
    deficitCents = initialLockedPlusCommitted - salaryCents;
    proposedReserveCents = 0;
    // Allocations stay strictly at locked/committedFloorCents so no paid spending or open commitment is hidden.
    const totalProposed = allocations.reduce((s, v) => s + v, 0);
    unallocatedCents = salaryCents - totalProposed; // === -deficitCents
    warnings.push(
      `Déficit de ${moneyFmt(deficitCents)}: o gasto já realizado, os compromissos em aberto e categorias travadas (${moneyFmt(initialLockedPlusCommitted)}) superam o salário informado (${moneyFmt(salaryCents)}). Reserva zerada e nenhum corte irreal aplicado ao que já está comprometido.`
    );
  } else {
    let pool = salaryCents - initialLockedPlusCommitted;
    const essentialIdx = candidates.map((c, i) => (!c.isLocked && c.tier === 'essential' ? i : -1)).filter((i) => i >= 0);
    const coreIdx = candidates.map((c, i) => (!c.isLocked && c.tier === 'core' ? i : -1)).filter((i) => i >= 0);
    const discIdx = candidates.map((c, i) => (!c.isLocked && c.tier === 'discretionary' ? i : -1)).filter((i) => i >= 0);

    // 1) Fund essentials up to desiredCents
    pool = distributeProportional(essentialIdx, weights, desiredCaps, allocations, pool);
    // 2) Fund core variables up to desiredCents
    pool = distributeProportional(coreIdx, weights, desiredCaps, allocations, pool);
    // 3) Carve out reserve goal (transparently trimmed if essentials + core used the headroom)
    proposedReserveCents = Math.min(targetReserveCents, pool);
    pool -= proposedReserveCents;
    if (proposedReserveCents < targetReserveCents) {
      warnings.push(
        `Após cobrir compromissos e categorias essenciais (${moneyFmt(allocations.reduce((s, v) => s + v, 0))}), a reserva possível é ${moneyFmt(proposedReserveCents)} (abaixo da meta de ${moneyFmt(targetReserveCents)}).`
      );
    }
    // 4) Fund discretionary categories up to desiredCents
    pool = distributeProportional(discIdx, weights, desiredCaps, allocations, pool);
    // Any positive excess capacity beyond historical desired targets + reserve remains transparently in unallocatedCents.
    unallocatedCents = pool;
  }

  const totalProposedLimitsCents = allocations.reduce((s, v) => s + v, 0);
  const totalCurrentLimitsCents = candidates.reduce((s, c) => s + (c.currentLimitCents || 0), 0);
  const totalHistoricalAvgCents = candidates.reduce((s, c) => s + c.histAvgCents, 0);

  // Pair surplus reductions against underfunded increases into clear redistributions
  const reductions = [];
  const increases = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.currentLimitCents === null) continue;
    const proposed = allocations[i];
    const diff = proposed - c.currentLimitCents;
    if (diff < 0) reductions.push({ category: c.category, remaining: -diff, histAvgCents: c.histAvgCents });
    else if (diff > 0) {
      increases.push({
        category: c.category,
        need: diff,
        committedFloorCents: c.committedFloorCents,
        histAvgCents: c.histAvgCents
      });
    }
  }
  const redistributions = [];
  let rIdx = 0;
  let iIdx = 0;
  while (rIdx < reductions.length && iIdx < increases.length) {
    const donor = reductions[rIdx];
    const recv = increases[iIdx];
    const transfer = Math.min(donor.remaining, recv.need);
    if (transfer > 0) {
      redistributions.push({
        fromCategory: donor.category,
        toCategory: recv.category,
        amountCents: transfer,
        reason:
          `${donor.category} com folga frente à média (${moneyFmt(donor.histAvgCents)}) cobre ` +
          `${recv.category} (média ${moneyFmt(recv.histAvgCents)}, realizado+previsto ${moneyFmt(recv.committedFloorCents)}).`
      });
      donor.remaining -= transfer;
      recv.need -= transfer;
    }
    if (donor.remaining <= 0) rIdx++;
    if (recv.need <= 0) iIdx++;
  }

  const items = candidates
    .map((c, idx) => {
      const proposedCents = allocations[idx];
      const deltaVsCurrentCents = c.currentLimitCents !== null ? proposedCents - c.currentLimitCents : null;
      const tierLabel = c.tier === 'essential' ? 'Essencial' : c.tier === 'core' ? 'Variável' : 'Flexível';
      let rationale = '';
      if (c.isLocked) {
        rationale = `Fixada manualmente por você em ${moneyFmt(proposedCents)} durante esta simulação.`;
      } else if (c.committedFloorCents > 0 && proposedCents === c.committedFloorCents && deficit) {
        rationale = `Preserva integralmente gasto (${moneyFmt(c.currentSpentCents)}) + previsto (${moneyFmt(c.plannedRemainingCents)}).`;
      } else if (deltaVsCurrentCents !== null && deltaVsCurrentCents < 0) {
        rationale = `Reduzido em ${moneyFmt(-deltaVsCurrentCents)} frente ao limite atual pela média real (${moneyFmt(c.histAvgCents)}), liberando margem.`;
      } else if (deltaVsCurrentCents !== null && deltaVsCurrentCents > 0) {
        rationale = `Elevado em ${moneyFmt(deltaVsCurrentCents)} para alinhar com histórico (${moneyFmt(c.histAvgCents)}) e previsto (${moneyFmt(c.plannedRemainingCents)}).`;
      } else if (c.plannedRemainingCents > 0) {
        rationale = `Inclui ${moneyFmt(c.currentSpentCents)} gastos + ${moneyFmt(c.plannedRemainingCents)} previstos em aberto.`;
      } else if (c.histAvgCents > 0) {
        rationale = `Baseado na média de ${completeMonthsAnalyzed} mês(es) completo(s) (${moneyFmt(c.histAvgCents)}).`;
      } else if (c.currentLimitCents !== null && c.currentLimitCents > 0) {
        rationale = `Mantém referência do limite atual (${moneyFmt(c.currentLimitCents)}).`;
      } else {
        rationale = c.usedStarterWeight ? 'Estimativa inicial por ausência de histórico completo.' : 'Sem movimentação recente.';
      }
      if (c.atypicalDetected && c.atypicalNote) {
        rationale += ' ' + c.atypicalNote;
      }
      return {
        category: c.category,
        tier: c.tier,
        tierLabel,
        isProtected: c.isProtected,
        isLocked: c.isLocked,
        currentLimitCents: c.currentLimitCents,
        proposedLimitCents: proposedCents,
        deltaVsCurrentCents,
        historicalAvgCents: c.histAvgCents,
        avg3mCents: c.avg3mCents,
        avg6mCents: c.avg6mCents,
        atypicalDetected: c.atypicalDetected,
        currentSpentCents: c.currentSpentCents,
        plannedRemainingCents: c.plannedRemainingCents,
        committedFloorCents: c.committedFloorCents,
        rationale,
        included: c.isLocked || proposedCents > 0 || (c.currentLimitCents !== null && c.currentLimitCents > 0)
      };
    })
    .filter((x) => x.included || x.proposedLimitCents > 0)
    .sort((a, b) => Number(b.isLocked) - Number(a.isLocked) || b.proposedLimitCents - a.proposedLimitCents || a.category.localeCompare(b.category, 'pt-BR'));

  const summaryAnswer = deficit
    ? `Analisei ${completeMonthsAnalyzed} mês(es) completo(s) e os compromissos de ${month}. Há **déficit de ${moneyFmt(deficitCents)}** entre o já gasto/previsto/travado (${moneyFmt(initialLockedPlusCommitted)}) e o salário informado (${moneyFmt(salaryCents)}). Ajuste ou desbloqueie categorias abaixo antes de confirmar.`
    : `Preparei a proposta mensal de **${month}** para salário de **${moneyFmt(salaryCents)}** usando **${completeMonthsAnalyzed} mês(es) completo(s)** (${recent3Count} nos últimos 3m; sem misturar mês parcial): **${moneyFmt(totalProposedLimitsCents)}** em limites, **${moneyFmt(proposedReserveCents)}** em reserva` +
      (unallocatedCents > 0 ? ` e **${moneyFmt(unallocatedCents)}** de margem livre.` : '.') +
      (redistributions.length ? ` Identifiquei **${redistributions.length} redistribuição(ões)** recomendada(s).` : '') +
      ' Validade padrão somente para este mês até confirmação.';

  return {
    matched: true,
    contract: 'MF3/SALARY-BUDGET-PROPOSAL-V1',
    intent: 'salary_budget_reorg',
    status: 'ready',
    effort: 'high',
    readOnly: true,
    changesApplied: false,
    source,
    profile,
    month,
    action: 'budgets.reorganize',
    salaryCents,
    salaryStatus,
    observedIncomeCents,
    observedSalaryCents,
    plannedIncomeCents,
    incomeVsBalanceNote,
    applyRecurring: !!applyRecurring,
    scopeLabel: applyRecurring ? `Mês ${month} + recorrente` : `Somente mês ${month}`,
    profileMode: mode,
    requestedReserveCents: reserveGoalCents,
    proposedReserveCents,
    totalCurrentLimitsCents,
    totalProposedLimitsCents,
    totalHistoricalAvgCents,
    totalCommittedCents,
    unallocatedCents,
    deficit,
    deficitCents,
    completeMonthsAnalyzed,
    monthsAnalyzed: priorMonths.map((p) => p.month),
    confidence,
    atypicalMonths,
    lockedCategories: [...lockedFolded.keys()],
    redistributions,
    updateIncomeSetting: !!updateIncomeSetting,
    currentIncomeSettingCents,
    items,
    warnings,
    answer: summaryAnswer
  };
}

module.exports = {
  parseMoneyToCents,
  parseSalaryBudgetCommand,
  buildSalaryBudgetProposal,
  distributeProportional,
  medianCents
};
