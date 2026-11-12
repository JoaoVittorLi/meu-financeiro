/* Generated from shared/finance-period-ledger.mjs. */
var FinancePeriodLedger=(function(){var exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateFinancePeriod = aggregateFinancePeriod;
exports.cashflowBuckets = cashflowBuckets;
exports.budgetProgress = budgetProgress;
// Deterministic period ledger shared by the Windows / Cloudflare codebase.
// Preview read models use it without altering local bank records or balances.
// IMPORTANT: one source at a time. Never sum bank + manual histories by default.
const iso = /^\d{4}-\d{2}-\d{2}$/;
function validDate(d) {
    if (typeof d !== 'string' || !iso.test(d))
        throw new Error('Data do período inválida.');
    const t = Date.parse(d + 'T00:00:00.000Z');
    if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== d)
        throw new Error('Data impossível.');
    return t;
}
function cents(v) {
    if (!Number.isSafeInteger(v) || Math.abs(v) > 100000000000)
        throw new Error('Centavos inválidos.');
    return v;
}
function add(map, key, amount) { map.set(key, (map.get(key) || 0) + amount); }
function category(value) { return typeof value === 'string' && value.trim() ? value : 'A classificar'; }
function sortCategories(map) { return [...map].map(([name, amountCents]) => ({ name, amountCents })).sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name, 'pt-BR')); }
function aggregateFinancePeriod(rows, { start, end, source }) {
    if (!Array.isArray(rows) || rows.length > 100000 || !['bank', 'manual'].includes(source))
        throw new Error('Fonte financeira inválida.');
    const first = validDate(start), last = validDate(end);
    if (last < first || (last - first) / 86400000 > 730)
        throw new Error('Intervalo financeiro inválido.');
    let incomeCents = 0, expenseCents = 0, count = 0, excluded = 0, unclassifiedCents = 0;
    const daily = new Map(), outCategories = new Map(), inCategories = new Map();
    for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            throw new Error('Registro financeiro inválido.');
        const dt = validDate(row.date);
        if (dt < first || dt > last)
            continue;
        let nature, amount;
        if (source === 'bank') {
            if (row.status !== 'POSTED') {
                excluded++;
                continue;
            }
            amount = Math.abs(cents(row.amountCents));
            nature = row.nature === 'auto' || row.nature == null ?
                (row.amountCents >= 0 ? 'income' : 'expense') : row.nature;
            if (!['income', 'expense', 'transfer', 'ignore'].includes(nature))
                throw new Error('Natureza inválida.');
            if (nature === 'transfer' || nature === 'ignore') {
                excluded++;
                continue;
            }
        }
        else {
            if (!['income', 'expense'].includes(row.kind))
                throw new Error('Tipo manual inválido.');
            amount = cents(row.amountCents);
            if (amount <= 0)
                throw new Error('Lançamento manual inválido.');
            nature = row.kind;
        }
        if (!amount) {
            excluded++;
            continue;
        }
        let today = daily.get(row.date);
        if (!today) {
            today = { date: row.date, incomeCents: 0, expenseCents: 0 };
            daily.set(row.date, today);
        }
        count++;
        if (nature === 'income') {
            incomeCents += amount;
            today.incomeCents += amount;
            add(inCategories, category(row.category), amount);
            if (!row.category)
                unclassifiedCents += amount;
        }
        else {
            expenseCents += amount;
            today.expenseCents += amount;
            const chunks = source === 'bank' && Array.isArray(row.splits) && row.splits.length ?
                row.splits : null;
            const validSplit = chunks && chunks.every(p => typeof p.category === 'string' && p.category && Number.isSafeInteger(p.amountCents) && p.amountCents > 0) &&
                chunks.reduce((acc, p) => acc + p.amountCents, 0) === amount;
            if (validSplit) {
                for (const p of chunks)
                    add(outCategories, p.category, p.amountCents);
            }
            else {
                add(outCategories, category(row.category), amount);
                if (!row.category)
                    unclassifiedCents += amount;
            }
        }
    }
    return {
        source, start, end, transactionsIncluded: count, excluded,
        incomeCents, expenseCents, netCents: incomeCents - expenseCents,
        unclassifiedCents, categoryCoverageComplete: unclassifiedCents === 0,
        daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
        expenses: sortCategories(outCategories), incomes: sortCategories(inCategories)
    };
}
function cashflowBuckets(daily, start, end, bins = 7) {
    const first = validDate(start), last = validDate(end);
    const days = Math.round((last - first) / 86400000) + 1;
    if (days < 1 || days > 731 || !Number.isInteger(bins) || bins < 1 || bins > 31)
        throw new Error('Período de gráfico inválido.');
    const count = Math.min(bins, days);
    const map = new Map(daily.map(d => [d.date, d]));
    const stamp = i => new Date(first + i * 86400000).toISOString().slice(0, 10);
    return Array.from({ length: count }, (_, i) => {
        const a = Math.floor(i * days / count), b = Math.floor((i + 1) * days / count) - 1;
        let incomeCents = 0, expenseCents = 0;
        for (let j = a; j <= b; j++) {
            const d = map.get(stamp(j));
            incomeCents += (d === null || d === void 0 ? void 0 : d.incomeCents) || 0;
            expenseCents += (d === null || d === void 0 ? void 0 : d.expenseCents) || 0;
        }
        return { start: stamp(a), end: stamp(b), incomeCents, expenseCents };
    });
}
function budgetProgress(budgets, expenses) {
    if (!Array.isArray(budgets) || !Array.isArray(expenses))
        throw new Error('Orçamento inválido.');
    const spent = new Map(expenses.map(x => [x.name, x.amountCents]));
    return budgets.map(item => {
        const limitCents = cents(item.amountCents);
        if (limitCents < 0 || typeof item.category !== 'string' || !item.category)
            throw new Error('Limite inválido.');
        const spentCents = spent.get(item.category) || 0;
        return { category: item.category, limitCents, spentCents,
            pct: limitCents > 0 ? Math.round(100 * spentCents / limitCents) : null };
    });
}

return exports;})();
const h = React.createElement;
function simInputsEqual(a, b) {
    if (!a || !b)
        return false;
    return a.value === b.value && a.installments === b.installments &&
        a.interest === b.interest && (a.firstDueDate || '') === (b.firstDueDate || '');
}
const EMPTY_PLANNING = { items: [], suggestions: [], projection: { anchor: 0, source: 'manual', anchorDate: '', asOf: null, includeEstimatedIncome: false, rows: [], minimum: 0, negativeDays: [], uncertainIncomeExcluded: 0 }, bankTitles: [], generatedAt: '' };
function freshPlanForm(kind = 'expense', day = iso(new Date())) { return { id: '', title: '', kind, amount: '', dueDate: day, category: kind === 'income' ? 'Salário' : 'Outros', accountId: '', notes: '', certainty: 'confirmed', mode: 'once', count: '12' }; }
const EMPTY_BANK = { config: { configured: false, clientId: '', itemIds: [], secure: false }, data: { accounts: [], transactions: [], items: [], last: null } };
const desktop = window.financeDesktop || null;
const CATS = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Compras', 'Contas', 'Outros'];
const COLORS = ['#3e9a85', '#d6934b', '#4489ba', '#cb6d76', '#2aa898', '#4c7fb2', '#718096', '#b5874f', '#5d86a1', '#87929c'];
const BUILTIN_EMOJIS = ['🏠', '🍽️', '🚗', '💊', '🎮', '📚', '📺', '🛍️', '🧾', '✨', '💰'];
const EMOJI_OPTIONS = ['🏠', '🏡', '🔑', '🪴', '🍽️', '🍔', '🍕', '🥗', '🥑', '☕', '🍿', '🛒', '🛍️', '🚗', '🚕', '🚌', '🚲', '⛽', '✈️', '🧳', '💊', '🩺', '💅', '🧴', '🧘', '🎮', '🎬', '🎵', '🎧', '📚', '🎓', '💻', '📱', '📺', '📷', '🎨', '🎟️', '⚽', '🏋️', '🏆', '🐶', '🐱', '🐾', '💰', '💸', '💳', '🏦', '📈', '🪙', '🧾', '💡', '⚡', '💧', '📦', '🎁', '❤️', '🌸', '🌿', '⭐', '✨', '🎯', '🔧'];
const COLOR_OPTIONS = ['#3e9a85', '#d6934b', '#4489ba', '#cb6d76', '#2aa898', '#4c7fb2', '#718096', '#b5874f', '#5d86a1', '#87929c', '#279c72', '#538faf', '#40ac89', '#55a6b0', '#e0ae5b', '#bd786a'];
const DEFAULT_CATEGORY_INFOS = [...CATS, 'Salário', 'Transferências', 'Rendimentos', 'Reembolsos'].map((name, i) => ({ name, color: COLORS[i % COLORS.length], emoji: BUILTIN_EMOJIS[i] || '✨', builtIn: 1, kind: ['Salário', 'Rendimentos', 'Reembolsos'].includes(name) ? 'income' : ['Outros', 'Transferências'].includes(name) ? 'both' : 'expense' }));
const emptyRule = () => ({ id: null, pattern: '', matchMode: 'contains', category: 'Alimentação', scope: 'both', priority: '100' });
function fold(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ').trim(); }
function findCategoryRule(description, scope, rules) {
    const value = fold(description);
    for (const r of [...rules].filter(r => r.enabled && (r.scope === 'both' || r.scope === scope)).sort((a, b) => a.priority - b.priority || a.id - b.id)) {
        const pattern = fold(r.pattern);
        if (pattern && ((r.matchMode === 'exact' && value === pattern) || (r.matchMode === 'starts' && value.startsWith(pattern)) || (r.matchMode === 'contains' && value.includes(pattern))))
            return r.category;
    }
    return null;
}
function effectiveNature(t) {
    return t.nature && t.nature !== 'auto' ? t.nature : (t.amount >= 0 ? 'income' : 'expense');
}
function transactionViewRows(state) {
    const review = state.txReviewOnly;
    const span = dateSpan(state.overviewPeriod, state.customStart, state.customEnd);
    const banks = (state.mode === 'demo' ? [] : state.bank.data.transactions || []);
    const manual = state.data.transactions;
    const term = fold(state.query);
    const bankRows = banks.filter(t => !review || !t.reviewed).map(t => ({
        key: t.accountId + '|' + t.id, origin: 'bank', date: t.date, description: t.description,
        merchant: t.customTitle || t.merchant || '', category: t.category, amount: t.amount,
        account: t.accountName, status: t.status, raw: t
    }));
    const manualRows = review ? [] : manual.map(t => ({
        key: 'manual|' + t.id, origin: 'manual', date: t.date, description: t.description,
        merchant: '', category: t.category, amount: t.kind === 'income' ? t.amount : -t.amount,
        account: 'Adicionado por você', status: 'POSTED', raw: t
    }));
    const kindOf = (t) => t.origin === 'manual' ? t.raw.kind : effectiveNature(t.raw);
    const filtered = bankRows.concat(manualRows).filter(t => (review || (t.date >= span.start && t.date <= span.end)) &&
        (!term || [t.description, t.category, t.account, t.merchant].some(v => fold(v).includes(term))) &&
        (!state.bankFilter || (t.origin === 'bank' && t.raw.accountId === state.bankFilter)) &&
        (review || state.txSource === 'all' || !state.txSource || t.origin === state.txSource) &&
        (!state.txCategoryFilter || t.category === state.txCategoryFilter) &&
        (!state.txKindFilter || state.txKindFilter === 'all' || kindOf(t) === state.txKindFilter) &&
        (review || !state.txReviewFilter || state.txReviewFilter === 'all' ||
            (t.origin === 'bank' && ((state.txReviewFilter === 'reviewed') === !!t.raw.reviewed))));
    const tie = (a, b) => a.key.localeCompare(b.key);
    const mode = state.txSort || 'date_desc';
    filtered.sort((a, b) => {
        if (mode === 'date_asc')
            return a.date.localeCompare(b.date) || tie(a, b);
        if (mode === 'amount_desc')
            return Math.abs(b.amount) - Math.abs(a.amount) || b.date.localeCompare(a.date) || tie(a, b);
        if (mode === 'amount_asc')
            return Math.abs(a.amount) - Math.abs(b.amount) || b.date.localeCompare(a.date) || tie(a, b);
        return b.date.localeCompare(a.date) || tie(a, b);
    });
    return filtered;
}
function transactionViewSummary(rows, source) {
    const chosen = rows.filter(t => t.origin === source);
    let income = 0, expense = 0, pending = 0, review = 0, excluded = 0;
    for (const t of chosen) {
        if (source === 'bank') {
            const bank = t.raw;
            if (!bank.reviewed)
                review++;
            if (t.status !== 'POSTED') {
                pending++;
                continue;
            }
            const nature = effectiveNature(bank);
            if (nature === 'transfer' || nature === 'ignore') {
                excluded++;
                continue;
            }
            if (nature === 'income')
                income += Math.abs(t.amount);
            else
                expense += Math.abs(t.amount);
        }
        else if (t.raw.kind === 'income')
            income += Math.abs(t.amount);
        else
            expense += Math.abs(t.amount);
    }
    return { income, expense, net: income - expense, pending, review, excluded, count: chosen.length };
}
function bankBalanceCoverage(accounts) {
    const known = accounts.filter(a => Number.isFinite(a.balance));
    const knownCount = known.length, totalCount = accounts.length, missingCount = totalCount - knownCount;
    const amountKnown = known.reduce((total, a) => total + a.balance, 0);
    return { knownCount, totalCount, missingCount, amountKnown };
}
function bankBalanceLabel(coverage) {
    if (!coverage.knownCount)
        return 'Saldo indisponível';
    return (coverage.missingCount ? 'Parcial · ' : '') + fmt(coverage.amountKnown);
}
function bankReferenceLabel(value) {
    if (!value)
        return 'não informada';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date.toLocaleDateString('pt-BR') : 'não informada';
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'não informada';
}
function bankTotalsInRange(bank, start, end) {
    var _a;
    const totals = new Map(), incomeCats = new Map();
    let income = 0, expense = 0;
    const days = bank.data.dailyTotals;
    if (days) {
        for (const day of days) {
            if (day.date < start || day.date > end)
                continue;
            income += day.income;
            expense += day.expense;
            for (const part of day.categories)
                totals.set(part.name, (totals.get(part.name) || 0) + part.total);
            for (const part of day.incomeCategories || [])
                incomeCats.set(part.name, (incomeCats.get(part.name) || 0) + part.total);
        }
    }
    else {
        const tx = (bank.data.transactions || []).filter(t => t.status === 'POSTED' && t.date >= start && t.date <= end);
        for (const t of tx) {
            const nature = effectiveNature(t), amount = Math.abs(t.amount);
            if (nature === 'income') {
                income += amount;
                incomeCats.set(t.category, (incomeCats.get(t.category) || 0) + amount);
            }
            if (nature === 'expense') {
                expense += amount;
                const parts = ((_a = t.splits) === null || _a === void 0 ? void 0 : _a.length) && !t.splitOutdated ? t.splits : [{ category: t.category, amount }];
                for (const part of parts)
                    totals.set(part.category, (totals.get(part.category) || 0) + part.amount);
            }
        }
    }
    const balanceCoverage = bankBalanceCoverage(bank.data.accounts || []);
    const balance = balanceCoverage.amountKnown;
    return { income, expense, net: income - expense, balance, balanceCoverage, categories: [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total), incomeCategories: [...incomeCats].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
}
function bankSnapshot(bank, month) { return bankTotalsInRange(bank, firstOfMonth(month), endOfMonth(month)); }
const fmt = (n) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyString = (n) => (n / 100).toFixed(2).replace('.', ',');
function parseMoney(v) { let s = String(v || '').trim().replace(/R\$|\s/g, ''); if (!s)
    return 0; if (s.includes(','))
    s = s.replace(/\./g, '').replace(',', '.');
else if ((s.match(/\./g) || []).length > 1)
    s = s.replace(/\./g, ''); const x = Number(s); return Number.isFinite(x) ? Math.round(x * 100) : NaN; }
function parsePositiveBRLInput(value) {
    const input = String(value !== null && value !== void 0 ? value : '').trim().replace(/^R\$\s*/, '');
    if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input))
        return NaN;
    const [integer, fraction = ''] = input.split(',');
    const whole = Number(integer.replace(/\./g, ''));
    if (!Number.isSafeInteger(whole))
        return NaN;
    const cents = whole * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : NaN;
}
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function shiftMonth(ym, offset) { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + offset, 1); return iso(d).slice(0, 7); }
const nowYM = iso(new Date()).slice(0, 7);
function fromISO(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
function advanceDate(value, days) { const d = fromISO(value); d.setDate(d.getDate() + days); return iso(d); }
function firstOfMonth(ym) { return ym + '-01'; }
function endOfMonth(ym) { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); }
function dateSpan(mode, customStart, customEnd, reference = iso(new Date())) {
    const ym = reference.slice(0, 7), start = fromISO(reference);
    if (mode === 'week') {
        const weekday = (start.getDay() + 6) % 7;
        return { start: advanceDate(reference, -weekday), end: reference };
    }
    if (mode === '15d')
        return { start: advanceDate(reference, -14), end: reference };
    if (mode === 'month')
        return { start: firstOfMonth(ym), end: reference };
    if (mode === 'lastmonth') {
        const prev = shiftMonth(ym, -1);
        return { start: firstOfMonth(prev), end: endOfMonth(prev) };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) && customStart <= customEnd && iso(fromISO(customStart)) === customStart && iso(fromISO(customEnd)) === customEnd)
        return { start: customStart, end: customEnd };
    return { start: firstOfMonth(ym), end: reference };
}
function spanLabel(mode, span) {
    if (mode === 'week')
        return 'Esta semana';
    if (mode === '15d')
        return 'Últimos 15 dias';
    if (mode === 'month')
        return 'Mês atual';
    if (mode === 'lastmonth')
        return 'Mês passado';
    const date = (v) => v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4);
    return date(span.start) + ' – ' + date(span.end);
}
function daysInSpan(a, b) { return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86400000) + 1; }
function snapshotBetween(d, start, end) {
    const ts = d.transactions.filter(t => t.date >= start && t.date <= end);
    const income = sum(ts, 'income'), expense = sum(ts, 'expense');
    const totals = new Map(), incomeCats = new Map();
    for (const t of ts) {
        if (t.kind === 'expense')
            totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
        else
            incomeCats.set(t.category, (incomeCats.get(t.category) || 0) + t.amount);
    }
    return { income, expense, net: income - expense, balance: d.settings.opening + sum(d.transactions, 'income') - sum(d.transactions, 'expense'), categories: [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total), incomeCategories: [...incomeCats].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
}
function bankSnapshotBetween(bank, start, end) { return bankTotalsInRange(bank, start, end); }
function flowSegments(start, end, get) {
    const length = Math.max(1, daysInSpan(start, end)), count = Math.min(7, length);
    return Array.from({ length: count }, (_, i) => {
        const a = advanceDate(start, Math.floor(i * length / count));
        const b = advanceDate(start, Math.floor((i + 1) * length / count) - 1);
        const totals = get(a, b);
        return { month: a, label: b.slice(8, 10) + '/' + b.slice(5, 7), income: totals.income, expense: totals.expense };
    });
}
function overviewPriorRange(start, end, mode) {
    if (mode === 'month' || mode === 'lastmonth') {
        const ym = shiftMonth(start.slice(0, 7), -1), last = endOfMonth(ym);
        return { start: firstOfMonth(ym), end: mode === 'lastmonth' ? last : ym + '-' + String(Math.min(+end.slice(8), +last.slice(8))).padStart(2, '0') };
    }
    const length = daysInSpan(start, end);
    return { start: advanceDate(start, -length), end: advanceDate(start, -1) };
}
function overviewCoverage(expense, covered) { return expense > 0 ? Math.max(0, Math.min(100, Math.round(covered / expense * 100))) : null; }
function overviewComparison(current, previous, available) {
    if (!available)
        return { percent: null, label: 'Histórico insuficiente para comparar' };
    if (previous <= 0)
        return { percent: null, label: current > 0 ? 'Sem gasto no intervalo anterior' : 'Sem gastos nos dois intervalos' };
    const percent = Math.round((current - previous) / previous * 100);
    return { percent, label: percent === 0 ? (current === previous ? 'Mesmo gasto do intervalo anterior' : 'Variação menor que 1% no intervalo') : Math.abs(percent) + '% ' + (percent > 0 ? 'a mais' : 'a menos') + ' que no intervalo anterior' };
}
function overviewCumulative(start, end, get, prior) {
    const days = daysInSpan(start, end), count = Math.min(25, days);
    return Array.from({ length: count }, (_, i) => {
        const offset = Math.floor((i + 1) * days / count) - 1, date = advanceDate(start, offset), previousDate = prior ? advanceDate(prior.start, Math.min(offset, daysInSpan(prior.start, prior.end) - 1)) : null;
        return { date, current: get(start, date).expense, previous: prior && previousDate ? get(prior.start, previousDate).expense : null };
    });
}
function OverviewSpendingChart(props) {
    const rows = props.rows, left = 52, right = 720, top = 22, bottom = 182;
    const peak = Math.max(100, ...rows.flatMap(r => [r.current, r.previous || 0]));
    const point = (n, i) => [left + (rows.length === 1 ? 1 : i / Math.max(1, rows.length - 1)) * (right - left), bottom - n / peak * (bottom - top)];
    const path = (key) => rows.map((r, i) => { const [x, y] = point(r[key] || 0, i); return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2); }).join(' ');
    return h('div', { className: 'u1-spending-chart' }, h('svg', { viewBox: '0 0 748 218', role: 'img', 'aria-label': 'Gasto acumulado no período. Valores exatos na tabela.' }, [0, .5, 1].map((n, i) => h('g', { key: i }, h('line', { x1: left, x2: right, y1: bottom - n * (bottom - top), y2: bottom - n * (bottom - top), className: 'u1-chart-grid' }), h('text', { x: left - 10, y: bottom - n * (bottom - top) + 4, textAnchor: 'end', className: 'u1-chart-label' }, financialAxisLabel(peak * n, peak)))), props.compare ? h('path', { d: path('previous'), className: 'u1-chart-previous' }) : null, h('path', { d: path('current') + ' L ' + right + ' ' + bottom + ' L ' + left + ' ' + bottom + ' Z', className: 'u1-chart-area' }), h('path', { d: path('current'), className: 'u1-chart-current' }), rows.length ? h('circle', { cx: point(rows[rows.length - 1].current, rows.length - 1)[0], cy: point(rows[rows.length - 1].current, rows.length - 1)[1], r: 4, className: 'u1-chart-point' }) : null, [0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => { var _a, _b; return h('text', { key: i, x: point(0, i)[0], y: 208, textAnchor: 'middle', className: 'u1-chart-label' }, ((_a = rows[i]) === null || _a === void 0 ? void 0 : _a.date.slice(8)) + '/' + ((_b = rows[i]) === null || _b === void 0 ? void 0 : _b.date.slice(5, 7))); })), h('details', { className: 'u1-chart-data' }, h('summary', {}, 'Ver valores do gráfico'), h('div', { className: 'u1-table-scroll' }, h('table', {}, h('caption', {}, 'Gasto acumulado na fonte selecionada'), h('thead', {}, h('tr', {}, h('th', {}, 'Até'), h('th', {}, 'Período atual'), props.compare ? h('th', {}, 'Intervalo anterior') : null)), h('tbody', {}, rows.map(r => h('tr', { key: r.date }, h('td', {}, r.date.split('-').reverse().join('/')), h('td', {}, fmt(r.current)), props.compare ? h('td', {}, fmt(r.previous || 0)) : null)))))));
}
function starter() { return { version: 5, transactions: [], budgets: {}, settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 } }; }
function demoData() {
    const t = [];
    const add = (offset, day, description, kind, amount, category) => {
        const m = shiftMonth(nowYM, offset);
        t.push({ id: 'demo-' + t.length, date: m + '-' + String(day).padStart(2, '0'), description, kind, amount: Math.round(amount * 100), category, origin: 'demo' });
    };
    for (let i = -5; i <= 0; i++) {
        add(i, 4, 'Pagamento mensal', 'income', i % 2 === 0 ? 5300 : 5200, 'Salário');
        add(i, 5, 'Aluguel', 'expense', 1000, 'Moradia');
        add(i, 9, 'Supermercado', 'expense', 600 + (i + 6) * 29, 'Alimentação');
        add(i, 11, 'Transporte', 'expense', 180 + (i + 6) * 10, 'Transporte');
        add(i, 14, 'Internet e telefone', 'expense', 150, 'Contas');
        add(i, 16, 'Assinaturas', 'expense', 95, 'Assinaturas');
        add(i, 21, 'Esportes', 'expense', 135, 'Lazer');
        add(i, 25, 'Restaurante', 'expense', 160 + (i + 6) * 8, 'Alimentação');
    }
    return { version: 5, transactions: t, budgets: { Moradia: 120000, Alimentação: 100000, Transporte: 35000, Saúde: 20000, Lazer: 38000, Educação: 30000, Assinaturas: 20000, Compras: 60000, Contas: 40000, Outros: 20000 }, settings: { opening: 145000, income: 520000, fixed: 220000, existing: 35000, reserve: 100000 } };
}
function safeData(v) {
    var _a;
    if (!v || typeof v !== 'object' || !Array.isArray(v.transactions))
        throw new Error('Arquivo inválido.');
    const d = starter();
    d.transactions = v.transactions.slice(0, 30000).map((r) => {
        const amount = Number(r.amount);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !['income', 'expense'].includes(r.kind) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000000 || typeof r.description !== 'string')
            throw new Error('Transação inválida.');
        return { id: String(r.id || Math.random()), date: r.date, kind: r.kind, description: r.description.slice(0, 180), amount, category: String(r.category || 'Outros').slice(0, 70), origin: 'restored' };
    });
    for (const [c, raw] of Object.entries(v.budgets || {})) {
        const b = Number(raw);
        if (c.length <= 50 && Number.isSafeInteger(b) && b >= 0 && (b > 0 || Number(v.version) >= 5))
            d.budgets[c] = b;
    }
    for (const key of ['opening', 'income', 'fixed', 'existing', 'reserve']) {
        const n = Number(((_a = v.settings) === null || _a === void 0 ? void 0 : _a[key]) || 0);
        d.settings[key] = (Number.isSafeInteger(n) && Math.abs(n) < 100000000000) ? n : 0;
    }
    return d;
}
function load(mode) { try {
    const raw = localStorage.getItem('meu-financeiro-v03-' + mode);
    if (raw)
        return safeData(JSON.parse(raw));
}
catch (_) { } return mode === 'demo' ? demoData() : starter(); }
function save(mode, data) { localStorage.setItem('meu-financeiro-v03-' + mode, JSON.stringify(data)); }
function sum(t, kind) { return t.filter(x => x.kind === kind).reduce((a, x) => a + x.amount, 0); }
function snapshot(d, month) { const ts = d.transactions.filter(t => t.date.slice(0, 7) === month); const income = sum(ts, 'income'), expense = sum(ts, 'expense'); const bal = d.settings.opening + sum(d.transactions, 'income') - sum(d.transactions, 'expense'); const names = [...new Set([...CATS, ...Object.keys(d.budgets), ...ts.map(t => t.category)])]; const categories = names.map(cat => ({ name: cat, total: sum(ts.filter(t => t.category === cat), 'expense') })).filter(x => x.total > 0).sort((a, b) => b.total - a.total); const incomeCategories = names.map(cat => ({ name: cat, total: sum(ts.filter(t => t.category === cat), 'income') })).filter(x => x.total > 0).sort((a, b) => b.total - a.total); return { income, expense, balance: bal, net: income - expense, categories, incomeCategories }; }
function simulate(d, sim) {
    const principal = parseMoney(sim.value), count = Math.trunc(Number(sim.installments)), rate = Number(String(sim.interest).replace(',', '.')) / 100;
    if (!Number.isFinite(principal) || principal <= 0 || principal > 10000000000)
        return { error: 'Informe um valor válido maior que zero.' };
    if (!Number.isInteger(count) || count < 1 || count > 60 || !Number.isFinite(rate) || rate < 0 || rate > 1)
        return { error: 'Confira o número de parcelas e os juros.' };
    const r = rate;
    const monthly = count === 1 ? principal : Math.round(r === 0 ? principal / count : principal * r / (1 - Math.pow(1 + r, -count)));
    const total = monthly * count;
    const base = d.settings;
    const current = snapshot(d, nowYM).balance;
    const hasProfile = base.income > 0 && base.fixed > 0;
    let balance = current;
    const rows = [];
    for (let i = 1; i <= Math.min(count, 12); i++) {
        const previous = balance;
        balance += base.income - base.fixed - base.existing - monthly;
        rows.push({ month: shiftMonth(nowYM, i), before: previous, after: balance, available: balance - base.reserve });
    }
    let risk = 'unknown';
    if (hasProfile) {
        const minAvail = Math.min(...rows.map(x => x.available));
        const ratio = monthly / base.income;
        risk = (minAvail < 0 || ratio > 0.3 || base.income - base.fixed - base.existing - monthly < 0) ? 'risk' : (minAvail < base.income * 0.3 || ratio > 0.12) ? 'caution' : 'safe';
    }
    return { principal, count, monthly, total, rate, rows, risk, current, hasProfile };
}
function Icon(p) {
    const paths = { home: 'M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z', wallet: 'M3 7h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h15v3H3m11 7h8', trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6', down: 'M3 7l6 6 4-4 8 8 M15 17h6v-6', calendar: 'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18', refresh: 'M21 4v6h-6 M3 20v-6h6 M5 10a8 8 0 0 1 14-4l2 4 M3 14l2 4a8 8 0 0 0 14-4', layers: 'M12 3 2 9l10 6 10-6-10-6z M2 13l10 6 10-6', cart: 'M3 4h2l3 12h11l3-9H6 M9 21h1 M18 21h1', pie: 'M12 2v10h10 M12 2a10 10 0 1 0 10 10', settings: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.2 2.2 M16.2 16.2l2.2 2.2 M18.4 5.6l-2.2 2.2 M7.8 16.2l-2.2 2.2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', plus: 'M12 5v14 M5 12h14', search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M17 17l5 5', check: 'M4 12l5 5L20 6', shield: 'M12 2l9 4v6c0 6-4.2 9.2-9 11-4.8-1.8-9-5-9-11V6z M8 12l3 3 5-6', chart: 'M4 20V12 M10 20V4 M16 20v-8 M22 20V8', download: 'M12 3v13 M7 11l5 5 5-5 M3 18v3h18v-3', upload: 'M12 21V8 M7 13l5-5 5 5 M3 5V3h18v2', trash: 'M4 6h16 M9 6V3h6v3 M7 8l1 13h8l1-13', arrow: 'M5 12h14 M13 6l6 6-6 6', alert: 'M12 3 2 21h20L12 3z M12 10v4 M12 18v0', edit: 'M3 21l5-.8L21 7 17 3 4 16z', filter: 'M3 4h18l-7 8v7l-4 2v-9z', clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2', spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z', bank: 'M2 10l10-7 10 7z M4 11v9 M10 11v9 M16 11v9 M22 21H2', folder: 'M3 5h7l2 2h9v13H3z', 'chevron-down': 'M6 9l6 6 6-6', 'chevron-up': 'M6 15l6-6 6 6', 'chevron-left': 'M15 6l-6 6 6 6', 'chevron-right': 'M9 6l6 6-6 6', close: 'M6 6l12 12 M18 6 6 18', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'eye-off': 'M3 3l18 18 M10 5C5 6 2 12 2 12s4 7 10 7c2 0 4-.7 5-2 M14 5c5 1 8 7 8 7l-2 3' };
    return h('svg', { width: p.size || 19, height: p.size || 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, h('path', { d: paths[p.name] || paths.chart }));
}
function Logo() { return h('span', { className: 'logo-glyph' }, h('span', { className: 'bar b1' }), h('span', { className: 'bar b2' }), h('span', { className: 'bar b3' })); }
function Card(p) { return h('div', { className: 'card ' + (p.className || '') }, p.children); }
function Stat(p) { var _a; return h('div', { className: 'stat ' + (p.featured ? 'stat-featured' : '') }, h('div', { className: 'stat-head' }, h('span', { className: 'stat-icon ' + (p.color || '') }, h(Icon, { name: p.icon })), h('span', { className: 'stat-label' }, p.label)), h('div', { className: 'stat-value' }, (_a = p.displayValue) !== null && _a !== void 0 ? _a : fmt(p.amount)), h('div', { className: 'stat-foot' }, p.hint)); }
function prettyMonth(ym) { const [year, month] = ym.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
function monthShort(ym) { return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); }
function financialAxisLabel(cents, upper) {
    const reais = cents / 100;
    if (upper >= 100000000)
        return 'R$ ' + (reais / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (upper >= 100000)
        return 'R$ ' + (reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return 'R$ ' + reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function collectSettingsPanels(node, result = {}) {
    if (Array.isArray(node)) {
        node.forEach(child => collectSettingsPanels(child, result));
        return result;
    }
    if (!node || !node.props)
        return result;
    const group = node.props['data-settings-group'];
    if (group) {
        result[group] = node;
        return result;
    }
    collectSettingsPanels(node.props.children, result);
    return result;
}
function pendingDashboardItems(items) {
    return items.filter(x => x.status === 'planned' && x.kind === 'expense' && x.remaining > 0 && Number.isSafeInteger(x.remaining))
        .slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
function budgetPresentationOrder(a, b) {
    const band = (x) => !x.hasLimit ? 3 : x.total > x.limit ? 0 : x.limit > 0 && x.total / x.limit >= .9 ? 1 : 2;
    const ratio = (x) => x.hasLimit ? (x.limit > 0 ? x.total / x.limit : x.total > 0 ? Infinity : 0) : 0;
    return band(a) - band(b) || (ratio(b) - ratio(a)) || b.total - a.total || a.info.name.localeCompare(b.info.name, 'pt-BR');
}
const B3_COLOR_STOPS = [
    [0, 35, 184, 112], [10, 35, 184, 112], [25, 161, 203, 70], [50, 240, 204, 57],
    [70, 241, 149, 58], [90, 235, 105, 80], [99, 224, 72, 79], [100, 211, 55, 70]
];
function budgetB3Color(percentage) {
    const p = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 100));
    let upper = 1;
    while (upper < B3_COLOR_STOPS.length - 1 && p > B3_COLOR_STOPS[upper][0])
        upper++;
    const a = B3_COLOR_STOPS[upper - 1], b = B3_COLOR_STOPS[upper];
    const t = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
    const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
    return 'rgb(' + channel(1) + ', ' + channel(2) + ', ' + channel(3) + ')';
}
function budgetB3Visual(spentCents, limitCents) {
    if (!Number.isFinite(spentCents) || !Number.isFinite(limitCents) || limitCents <= 0)
        return null;
    const raw = Math.max(0, spentCents / limitCents * 100), fill = Math.min(100, raw);
    return { percent: Math.round(raw), fill, color: budgetB3Color(fill) };
}
function u3BudgetSignals(entries, total) {
    const limited = entries.filter(x => x.hasLimit), spent = limited.reduce((n, x) => n + x.total, 0);
    return { exceeded: limited.filter(x => x.total > x.limit).length, near: limited.filter(x => x.limit > 0 && x.total <= x.limit && x.total / x.limit >= .9).length, unlimited: entries.filter(x => !x.hasLimit && x.total > 0).length, covered: total > 0 ? Math.round(Math.min(1, spent / total) * 100) : null, spent, limit: limited.reduce((n, x) => n + x.limit, 0) };
}
function u3AccountType(value) { return { CHECKING_ACCOUNT: 'Conta corrente', SAVINGS_ACCOUNT: 'Poupança', PAYMENT_ACCOUNT: 'Conta de pagamento', CREDIT_CARD: 'Cartão de crédito' }[value] || (/^[A-Z_]+$/.test(value || '') ? 'Conta conectada' : value || 'Conta conectada'); }
function u3AccountReference(value, now) {
    if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value))
        return { status: 'unknown', label: 'Horário não informado' };
    const stamp = Date.parse(value), age = now - stamp;
    if (!Number.isFinite(stamp) || age < -300000)
        return { status: 'unknown', label: 'Referência não verificada' };
    return age > 86400000 ? { status: 'stale', label: 'Referência há mais de 24h' } : { status: 'recent', label: 'Referência de até 24h' };
}
function u3AccountSignals(account, transactions, now) {
    const reference = u3AccountReference(account.updatedAt, now), rows = transactions.filter(t => t.accountId === account.id);
    return { reference, attention: !Number.isFinite(account.balance) || reference.status !== 'recent', pending: rows.filter(t => t.status === 'PENDING').length, review: rows.filter(t => !t.reviewed).length, count: rows.length };
}
function u3SimulationCost(out) {
    if (!out || out.error || ![out.principal, out.monthly, out.total].every(Number.isSafeInteger))
        return null;
    return { principal: out.principal, monthly: out.monthly, total: out.total, interest: out.total - out.principal, daily: out.engine === 'planning', minimum: out.engine === 'planning' && Number.isFinite(out.minimumAfterPurchase) ? out.minimumAfterPurchase : null };
}
function U3ScenarioChart(p) {
    const rows = p.rows.slice(0, 12).filter(r => Number.isFinite(r.withPurchase) && Number.isFinite(r.withoutPurchase));
    if (!rows.length)
        return null;
    const values = rows.flatMap(r => [r.withPurchase, r.withoutPurchase]), min = Math.min(0, ...values), max = Math.max(4, ...values), span = Math.max(4, max - min), x = (i) => 70 + i * 640 / Math.max(1, rows.length - 1), y = (v) => 150 - (v - min) / span * 125;
    const line = (key) => rows.map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(r[key]).toFixed(1)).join(' ');
    return h('figure', { className: 'u3-scenario-chart' }, h('figcaption', {}, 'Fechamentos mensais · primeiros ' + rows.length + ' meses'), h('svg', { viewBox: '0 0 740 185', role: 'img', 'aria-label': 'Comparação dos fechamentos mensais; valores exatos na tabela abaixo' }, [0, .5, 1].map(t => h('g', { key: t }, h('line', { x1: 70, x2: 710, y1: y(min + span * t), y2: y(min + span * t), className: 'u3-chart-grid' }), h('text', { x: 3, y: y(min + span * t) + 4, className: 'u3-chart-label' }, financialAxisLabel(min + span * t, span)))), h('path', { d: line('withoutPurchase'), className: 'u3-chart-base' }), h('path', { d: line('withPurchase'), className: 'u3-chart-purchase' }), rows.map((r, i) => h('circle', { key: r.month, cx: x(i), cy: y(r.withPurchase), r: 3, className: 'u3-chart-dot' })), h('text', { x: 70, y: 176, className: 'u3-chart-label' }, monthShort(rows[0].month) + '/' + rows[0].month.slice(2, 4)), h('text', { x: 710, y: 176, textAnchor: 'end', className: 'u3-chart-label' }, monthShort(rows[rows.length - 1].month) + '/' + rows[rows.length - 1].month.slice(2, 4))), h('div', { className: 'u3-chart-legend' }, h('span', {}, h('i', { className: 'is-baseline' }), 'Sem compra'), h('span', {}, h('i'), 'Com compra'), h('small', {}, 'Fechamentos não representam o menor saldo diário.')));
}
function Chart(p) {
    const vals = p.data;
    const upper = Math.max(4, ...vals.flatMap(x => [Math.max(0, x.income), Math.max(0, x.expense)])) * 1.14;
    const W = 620, H = 214, l = 90, r = 16, t = 18, b = 32;
    const xx = (i) => l + i * (W - l - r) / Math.max(1, vals.length - 1);
    const yy = (v) => t + (H - b - t) * (1 - v / upper);
    const getPath = (k) => vals.map((x, i) => (i ? 'L' : 'M') + xx(i).toFixed(1) + ',' + yy(x[k]).toFixed(1)).join(' ');
    const getArea = (k) => vals.length ? getPath(k) + ` L${xx(vals.length - 1)},${H - b} L${xx(0)},${H - b} Z` : '';
    return h('div', { className: 'mf-chart-block' }, h('svg', { className: 'chart-svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Evolução de receitas e despesas; valores disponíveis em tabela abaixo' }, h('defs', {}, h('linearGradient', { id: 'incFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: 'var(--green)', stopOpacity: '.28' }), h('stop', { offset: '100%', stopColor: 'var(--green)', stopOpacity: '0' })), h('linearGradient', { id: 'expFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: 'var(--red)', stopOpacity: '.2' }), h('stop', { offset: '100%', stopColor: 'var(--red)', stopOpacity: '0' }))), [0, .25, .5, .75, 1].map((a, i) => h('g', { key: 'g' + i }, h('line', { x1: l, y1: yy(upper * a), x2: W - r, y2: yy(upper * a), stroke: 'var(--border)', strokeWidth: 1 }), h('text', { x: 3, y: yy(upper * a) + 4, fill: 'var(--muted)', fontSize: 11 }, financialAxisLabel(upper * a, upper)))), h('path', { d: getArea('income'), fill: 'url(#incFill)' }), h('path', { d: getArea('expense'), fill: 'url(#expFill)' }), h('path', { d: getPath('income'), fill: 'none', stroke: 'var(--green)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }), h('path', { d: getPath('expense'), fill: 'none', stroke: 'var(--red)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }), vals.map((x, i) => h('g', { key: x.month }, h('text', { x: xx(i), y: H - 8, fill: 'var(--muted)', fontSize: 12, textAnchor: 'middle' }, x.label || monthShort(x.month)), h('circle', { cx: xx(i), cy: yy(x.income), r: 3, fill: 'var(--green)' }))), h('details', { className: 'mf-chart-data' }, h('summary', {}, 'Consultar valores do gráfico'), h('div', { className: 'mf-chart-table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Período', 'Receitas', 'Despesas'].map(a => h('th', { key: a, scope: 'col' }, a)))), h('tbody', {}, vals.map((x, i) => h('tr', { key: x.month + '-' + i }, h('th', { scope: 'row' }, x.label || monthShort(x.month)), h('td', {}, fmt(x.income)), h('td', {}, fmt(x.expense))))))))));
}
function Donut(p) {
    const all = p.items.filter(x => x.total > 0).sort((a, b) => b.total - a.total);
    const total = all.reduce((a, x) => a + x.total, 0);
    const remaining = all.slice(5).reduce((a, x) => a + x.total, 0);
    const vals = remaining ? [...all.slice(0, 5), { name: 'Outras', total: remaining }] : all.slice(0, 5);
    const colorOf = (name) => { var _a; return name === 'Outras' ? '#9A90AA' : ((_a = p.colors) === null || _a === void 0 ? void 0 : _a[name]) || COLORS[Math.max(0, CATS.indexOf(name)) % COLORS.length]; };
    let deg = 0;
    const seg = vals.map(x => { const start = deg; deg += x.total / Math.max(total, 1) * 360; return `${colorOf(x.name)} ${start}deg ${deg}deg`; });
    return h('div', { className: 'donut-wrap' }, h('div', { className: 'donut', role: 'img', 'aria-label': 'Distribuição de ' + fmt(total) + ' em despesas', style: { background: total ? `conic-gradient(${seg.join(',')})` : 'conic-gradient(#2c2938 0 360deg)' } }, h('div', { className: 'donut-inner' }, h('b', {}, fmt(total)), h('small', {}, 'em despesas'))), h('div', { className: 'donut-legend' }, total ? vals.map(v => {
        var _a;
        return h('div', { className: 'legend-row', key: v.name }, h('span', { className: 'legend-text' }, h('i', { style: { background: colorOf(v.name) } }), ((_a = p.emojis) === null || _a === void 0 ? void 0 : _a[v.name]) ? h('span', { className: 'legend-emoji' }, p.emojis[v.name]) : null, v.name), h('strong', {}, fmt(v.total), ' · ' + (v.total / total * 100).toFixed(1).replace('.', ',') + '%'));
    }) : h('p', { className: 'muted-desc' }, 'Sem despesas no período')), total && all.length > 5 ? h('details', { className: 'donut-all-categories' }, h('summary', {}, 'Ver todas as categorias (' + all.length + ')'), h('div', { className: 'donut-all-list' }, all.map(v => h('div', { key: v.name }, h('span', {}, v.name), h('strong', {}, fmt(v.total), ' · ' + (v.total / total * 100).toFixed(1).replace('.', ',') + '%')))), h('small', {}, 'Percentuais arredondados; valores em reais preservam o total.')) : null);
}
function TransactionCategoryButton(p) {
    return h('button', { type: 'button', className: 'category-tag mf-category-edit', title: 'Alterar categoria sem abrir detalhes', 'aria-label': p.label, 'aria-haspopup': 'dialog', 'aria-expanded': !!p.expanded, disabled: p.disabled, onClick: p.onClick }, h('span', {}, (p.emoji || '✨') + ' ' + p.category), h('span', { className: 'mf-category-edit-mark', 'aria-hidden': 'true' }, '✎'));
}
class StyledSelect extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.menu = null;
        this.close = () => { if (this.state.open)
            this.setState({ open: false }); };
        this.onScroll = (e) => {
            var _a, _b, _c;
            if (!this.state.open || ((_a = this.menu) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
                return;
            if ((_c = (_b = e.target) === null || _b === void 0 ? void 0 : _b.contains) === null || _c === void 0 ? void 0 : _c.call(_b, this.trigger)) {
                this.setState({ placement: this.geometry() });
                return;
            }
            this.close();
        };
        this.onOutside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.menu) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.open = () => { if (this.props.disabled)
            return; const idx = (this.props.options || []).findIndex((x) => x.value === this.props.value); this.setState({ open: !this.state.open, focusIndex: Math.max(0, idx), placement: this.geometry() }); };
        this.pick = (v) => { var _a; this.setState({ open: false }); this.props.onChange(v); (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.focus(); };
        this.onKey = (e) => {
            var _a, _b;
            const options = this.props.options || [];
            if (e.key === 'Escape') {
                if (!this.state.open)
                    return;
                e.preventDefault();
                e.stopPropagation();
                this.close();
                (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.focus();
                return;
            }
            if (!options.length)
                return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const dir = e.key === 'ArrowDown' ? 1 : -1;
                this.setState((s) => ({ open: true, placement: this.geometry(), focusIndex: s.open ? (s.focusIndex + dir + options.length) % options.length : Math.max(0, options.findIndex((x) => x.value === this.props.value)) }));
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (this.state.open)
                    this.pick(((_b = options[this.state.focusIndex]) === null || _b === void 0 ? void 0 : _b.value) || options[0].value);
                else
                    this.open();
            }
        };
        this.state = { open: false, focusIndex: 0, placement: { left: 0, top: 0, width: 220, maxHeight: 250 } };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.onOutside, true); window.addEventListener('resize', this.close); window.addEventListener('scroll', this.onScroll, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.onOutside, true); window.removeEventListener('resize', this.close); window.removeEventListener('scroll', this.onScroll, true); }
    geometry() { var _a; const r = (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!r)
        return this.state.placement; const height = Math.min(300, window.innerHeight - 30), below = window.innerHeight - r.bottom - 14; const width = Math.max(r.width, Math.min(250, window.innerWidth - 24)); return { left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), top: below > 160 ? r.bottom + 6 : Math.max(10, r.top - height - 6), width, maxHeight: below > 160 ? Math.min(height, below) : height }; }
    render() {
        const options = this.props.options || [], current = options.find(x => x.value === this.props.value), p = this.state.placement;
        return h('div', { className: 'mf-select-wrap ' + (this.props.wrapperClass || '') }, h('button', { type: 'button', ref: (e) => this.trigger = e, disabled: this.props.disabled, role: 'combobox', 'aria-expanded': this.state.open, 'aria-haspopup': 'listbox', 'aria-label': this.props.ariaLabel || 'Selecionar opção', className: 'mf-select-trigger ' + (this.props.className || ''), onClick: this.open, onKeyDown: this.onKey }, h('span', {}, (current === null || current === void 0 ? void 0 : current.label) || this.props.value || 'Selecione'), h('span', { className: 'mf-caret', 'aria-hidden': 'true' }, h(Icon, { name: 'chevron-down', size: 16 }))), this.state.open ? ReactDOM.createPortal(h('div', { ref: (e) => this.menu = e, className: 'mf-select-popover', role: 'listbox', onKeyDown: this.onKey, style: { position: 'fixed', left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight } }, options.map((item, i) => h('button', { key: item.value, type: 'button', role: 'option', 'aria-selected': item.value === this.props.value, className: 'mf-option ' + (item.value === this.props.value ? 'is-selected ' : '') + (i === this.state.focusIndex ? 'is-focused' : ''), onMouseEnter: () => { if (this.state.focusIndex !== i)
                this.setState({ focusIndex: i }); }, onClick: () => this.pick(item.value) }, h('span', {}, item.label), item.value === this.props.value ? h('span', { className: 'mf-option-check', 'aria-hidden': 'true' }, h(Icon, { name: 'check', size: 15 })) : null))), document.body) : null);
    }
}
class SingleDatePicker extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.panel = null;
        this.close = () => this.setState({ open: false });
        this.closeAndFocus = () => { if (this.state.open)
            this.setState({ open: false }, () => { var _a; return (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.focus(); }); };
        this.onKeyDown = (e) => {
            var _a, _b;
            if (e.key === 'Escape' && this.state.open) {
                e.preventDefault();
                e.stopPropagation();
                this.closeAndFocus();
                return;
            }
            const day = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.getAttribute) === null || _b === void 0 ? void 0 : _b.call(_a, 'data-date');
            if (!day || !this.state.open)
                return;
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
            if (delta[e.key] === undefined && e.key !== 'Home' && e.key !== 'End')
                return;
            e.preventDefault();
            e.stopPropagation();
            const next = e.key === 'Home' ? advanceDate(day, -((fromISO(day).getDay() + 6) % 7)) :
                e.key === 'End' ? advanceDate(day, 6 - ((fromISO(day).getDay() + 6) % 7)) : advanceDate(day, delta[e.key]);
            const focusDay = () => { var _a, _b; return (_b = (_a = this.panel) === null || _a === void 0 ? void 0 : _a.querySelector('[data-date="' + next + '"]')) === null || _b === void 0 ? void 0 : _b.focus({ preventScroll: true }); };
            if (next.slice(0, 7) !== this.state.view)
                this.setState({ view: next.slice(0, 7) }, focusDay);
            else
                focusDay();
        };
        this.onScroll = (e) => {
            var _a, _b;
            if (!this.state.open || ((_a = this.panel) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
                return;
            if (e.target === document || e.target === document.documentElement || e.target === document.body) {
                const r = (_b = this.trigger) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect();
                if (!r)
                    return;
                const width = Math.min(326, window.innerWidth - 20);
                const left = Math.max(10, Math.min(r.left, window.innerWidth - width - 10));
                const height = Math.min(380, window.innerHeight - 20);
                this.setState({ left, top: r.bottom + height + 6 > window.innerHeight ? Math.max(10, r.top - height - 6) : r.bottom + 6 });
            }
            else
                this.close();
        };
        this.outside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.panel) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.toggle = () => { var _a; if (this.props.disabled)
            return; const r = (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!r)
            return; const width = Math.max(0, Math.min(326, window.innerWidth - 20)), left = Math.max(10, Math.min(r.left, window.innerWidth - width - 10)); this.setState({ open: !this.state.open, view: (this.props.value || iso(new Date())).slice(0, 7), left, top: r.bottom + Math.min(380, window.innerHeight - 20) + 6 > window.innerHeight ? Math.max(10, r.top - Math.min(380, window.innerHeight - 20) - 6) : r.bottom + 6 }, () => { var _a, _b; if (this.state.open)
            (_b = (_a = this.panel) === null || _a === void 0 ? void 0 : _a.querySelector('.mf-day.selected,.mf-day')) === null || _b === void 0 ? void 0 : _b.focus({ preventScroll: true }); }); };
        this.state = { open: false, view: (props.value || iso(new Date())).slice(0, 7), left: 0, top: 0 };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.outside, true); window.addEventListener('resize', this.close); window.addEventListener('scroll', this.onScroll, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.outside, true); window.removeEventListener('resize', this.close); window.removeEventListener('scroll', this.onScroll, true); }
    render() {
        var _a;
        const ym = this.state.view, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), offset = (first.getDay() + 6) % 7, count = new Date(y, m, 0).getDate();
        return h('div', { className: 'mf-single-date' }, h('button', { ref: (e) => this.trigger = e, type: 'button', className: 'mf-date-trigger', disabled: this.props.disabled, onClick: this.toggle, onKeyDown: this.onKeyDown, 'aria-haspopup': 'dialog', 'aria-expanded': this.state.open }, h(Icon, { name: 'calendar', size: 16 }), ((_a = this.props.value) === null || _a === void 0 ? void 0 : _a.split('-').reverse().join('/')) || 'Selecionar data', h('span', { className: 'mf-caret', 'aria-hidden': 'true' }, h(Icon, { name: 'chevron-down', size: 16 }))), this.state.open ? ReactDOM.createPortal(h('div', { ref: (e) => this.panel = e, className: 'mf-single-calendar', role: 'dialog', 'aria-label': 'Selecionar data', onKeyDown: this.onKeyDown, style: { position: 'fixed', left: this.state.left, top: this.state.top, width: Math.min(326, window.innerWidth - 20) } }, h('div', { className: 'mf-calendar-nav' }, h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, -1) }) }, '‹'), h('strong', {}, prettyMonth(ym)), h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, 1) }) }, '›')), h('div', { className: 'mf-calendar-grid' }, ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, i) => h('span', { key: 'h' + i, className: 'mf-weekday' }, label)), Array.from({ length: offset }, (_, i) => h('span', { key: 'e' + i })), Array.from({ length: count }, (_, i) => { const day = ym + '-' + String(i + 1).padStart(2, '0'); return h('button', { key: day, type: 'button', 'aria-label': day, 'data-date': day, 'aria-pressed': this.props.value === day, className: 'mf-day ' + (this.props.value === day ? 'selected' : ''), onClick: () => { this.props.onChange(day); this.closeAndFocus(); } }, i + 1); })), h('button', { type: 'button', className: 'mf-today-link', onClick: () => { this.props.onChange(iso(new Date())); this.closeAndFocus(); } }, 'Hoje')), document.body) : null);
    }
}
class PeriodPicker extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.panel = null;
        this.close = () => { if (this.state.open)
            this.setState({ open: false }); };
        this.closeAndFocus = () => { if (this.state.open)
            this.setState({ open: false }, () => { var _a; return (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.focus(); }); };
        this.onKeyDown = (e) => {
            var _a, _b;
            if (e.key === 'Escape' && this.state.open) {
                e.preventDefault();
                e.stopPropagation();
                this.closeAndFocus();
                return;
            }
            const day = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.getAttribute) === null || _b === void 0 ? void 0 : _b.call(_a, 'data-date');
            if (!day || !this.state.open)
                return;
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
            if (delta[e.key] === undefined && e.key !== 'Home' && e.key !== 'End')
                return;
            e.preventDefault();
            e.stopPropagation();
            const next = e.key === 'Home' ? advanceDate(day, -((fromISO(day).getDay() + 6) % 7)) :
                e.key === 'End' ? advanceDate(day, 6 - ((fromISO(day).getDay() + 6) % 7)) : advanceDate(day, delta[e.key]);
            const focusDay = () => { var _a, _b; return (_b = (_a = this.panel) === null || _a === void 0 ? void 0 : _a.querySelector('[data-date="' + next + '"]')) === null || _b === void 0 ? void 0 : _b.focus({ preventScroll: true }); };
            if (next.slice(0, 7) !== this.state.view)
                this.setState({ view: next.slice(0, 7) }, focusDay);
            else
                focusDay();
        };
        this.onScroll = (e) => {
            var _a, _b;
            if (!this.state.open || ((_a = this.panel) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
                return;
            if (e.target === document || e.target === document.documentElement || e.target === document.body) {
                const r = (_b = this.trigger) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect();
                if (!r)
                    return;
                const width = Math.min(366, window.innerWidth - 20);
                const left = Math.max(10, Math.min(r.right - width, window.innerWidth - width - 10));
                const top = r.bottom + 8;
                this.setState({ placement: { left, top: top + 440 > window.innerHeight ? Math.max(10, r.top - 446) : top } });
            }
            else
                this.close();
        };
        this.onOutside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.panel) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.toggle = () => { var _a; const r = (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!r)
            return; const width = Math.min(366, window.innerWidth - 20); const left = Math.max(10, Math.min(r.right - width, window.innerWidth - width - 10)); const top = r.bottom + 8; this.setState({ open: !this.state.open, custom: this.props.mode === 'custom', start: this.props.span.start, end: this.props.span.end, step: 'start', view: this.props.span.end.slice(0, 7), placement: { left, top: top + 440 > window.innerHeight ? Math.max(10, r.top - 446) : top } }, () => { var _a, _b; if (this.state.open)
            (_b = (_a = this.panel) === null || _a === void 0 ? void 0 : _a.querySelector('button')) === null || _b === void 0 ? void 0 : _b.focus(); }); };
        this.pickPreset = (mode) => { this.closeAndFocus(); this.props.onChange(mode); };
        this.pickDate = (day) => { if (this.state.step === 'start' || day < this.state.start) {
            this.setState({ start: day, end: '', step: 'end' });
        }
        else
            this.setState({ end: day, step: 'start' }); };
        this.state = { open: false, custom: false, start: props.span.start, end: props.span.end, step: 'start', view: props.span.end.slice(0, 7), placement: { left: 0, top: 0 } };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.onOutside, true); window.addEventListener('resize', this.close); window.addEventListener('scroll', this.onScroll, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.onOutside, true); window.removeEventListener('resize', this.close); window.removeEventListener('scroll', this.onScroll, true); }
    renderCalendar() {
        const ym = this.state.view, [year, mon] = ym.split('-').map(Number), first = new Date(year, mon - 1, 1), offset = (first.getDay() + 6) % 7, num = new Date(year, mon, 0).getDate(), dates = Array.from({ length: offset }, () => null).concat(Array.from({ length: num }, (_, i) => ym + '-' + String(i + 1).padStart(2, '0')));
        return h('div', { className: 'mf-calendar' }, h('div', { className: 'mf-calendar-nav' }, h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, -1) }) }, '‹'), h('strong', {}, prettyMonth(ym)), h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, 1) }) }, '›')), h('div', { className: 'mf-calendar-grid' }, ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => h('span', { key: 'weekday' + i, className: 'mf-weekday' }, d)), dates.map((day, i) => day ? h('button', { type: 'button', key: day, 'aria-label': day, 'data-date': day, 'aria-pressed': day === this.state.start || day === this.state.end, className: 'mf-day ' + (day === this.state.start || day === this.state.end ? 'selected ' : '') + (this.state.end && day > this.state.start && day < this.state.end ? 'in-range' : ''), onClick: () => this.pickDate(day) }, String(+day.slice(8))) : h('span', { key: 'empty' + i }))));
    }
    render() {
        var _a, _b;
        const presets = [{ value: 'week', label: 'Esta semana' }, { value: '15d', label: 'Últimos 15 dias' }, { value: 'month', label: 'Mês atual' }, { value: 'lastmonth', label: 'Mês passado' }], span = this.props.span, p = this.state.placement;
        return h('div', { className: 'mf-period-holder' }, h('button', { type: 'button', className: 'mf-period-trigger', ref: (e) => this.trigger = e, 'aria-expanded': this.state.open, 'aria-haspopup': 'dialog', onClick: this.toggle, onKeyDown: this.onKeyDown }, h(Icon, { name: 'calendar', size: 17 }), h('span', {}, spanLabel(this.props.mode, span)), h('span', { className: 'mf-caret', 'aria-hidden': 'true' }, h(Icon, { name: 'chevron-down', size: 16 }))), this.state.open ? ReactDOM.createPortal(h('div', { className: 'mf-period-popover', role: 'dialog', 'aria-label': 'Selecionar período', ref: (e) => this.panel = e, onKeyDown: this.onKeyDown, style: { position: 'fixed', left: p.left, top: p.top, width: Math.min(366, window.innerWidth - 20) } }, h('strong', { className: 'mf-popup-title' }, 'Período de análise'), h('div', { className: 'mf-period-presets' }, presets.map(a => h('button', { key: a.value, type: 'button', className: this.props.mode === a.value && !this.state.custom ? 'selected' : '', onClick: () => this.pickPreset(a.value) }, a.label))), h('button', { type: 'button', className: 'mf-custom-toggle ' + (this.state.custom ? 'selected' : ''), onClick: () => this.setState({ custom: !this.state.custom, step: 'start' }) }, 'Selecionar datas personalizadas', h(Icon, { name: this.state.custom ? 'chevron-up' : 'chevron-down', size: 16 })), this.state.custom ? h('div', { className: 'mf-custom-calendar' }, h('p', {}, this.state.step === 'start' ? 'Selecione a data inicial' : 'Agora selecione a data final'), h('div', { className: 'mf-range-values' }, h('span', {}, 'Início: ', h('b', {}, ((_a = this.state.start) === null || _a === void 0 ? void 0 : _a.split('-').reverse().join('/')) || '—')), h('span', {}, 'Fim: ', h('b', {}, ((_b = this.state.end) === null || _b === void 0 ? void 0 : _b.split('-').reverse().join('/')) || '—'))), this.renderCalendar(), h('div', { className: 'mf-range-actions' }, h('button', { type: 'button', onClick: this.close }, 'Cancelar'), h('button', { type: 'button', disabled: !this.state.start || !this.state.end || this.state.end < this.state.start, onClick: () => { this.props.onChange('custom', this.state.start, this.state.end); this.closeAndFocus(); } }, 'Aplicar período'))) : null), document.body) : null);
    }
}
class App extends React.Component {
    constructor(props) {
        super(props);
        this.writeInProgress = false;
        this.autoSyncTimer = null;
        this.unsubscribePersonalCloud = null;
        this.unsubscribeAI = null;
        this.lastSyncAttempt = 0;
        this.focusReturn = null;
        this.focusCategoryOnDetailOpen = false;
        this.quickCategoryAnchor = null;
        this.quickCategorySearchInput = null;
        this.quickCategoryWrite = false;
        this.reviewSavingKeys = new Set();
        this.categorySavingKeys = new Set();
        this.categorySaveQueue = Promise.resolve();
        this.simRequest = 0;
        this.onGlobalKeydown = (event) => {
            if (event.key === 'Escape' && this.state.quickCategory) {
                event.preventDefault();
                this.closeQuickCategory();
                return;
            }
            const dialog = document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer,.mf-ai-drawer');
            if (event.key === 'Tab' && dialog && !document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar')) {
                const controls = Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
                if (controls.length) {
                    const first = controls[0], last = controls[controls.length - 1];
                    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                        event.preventDefault();
                        last.focus();
                    }
                    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                        event.preventDefault();
                        first.focus();
                    }
                }
                return;
            }
            if (event.key !== 'Escape')
                return;
            if (document.querySelector('[role="listbox"],.mf-period-popover,.mf-single-calendar'))
                return;
            if (this.state.quickAddOpen) {
                this.setState({ quickAddOpen: false });
                return;
            }
            if (this.state.intelligencePanelOpen) {
                this.setState({ intelligencePanelOpen: false });
                return;
            }
            if (this.state.planSelected) {
                this.setState({ planSelected: null });
                return;
            }
            if (this.state.detail) {
                this.setState({ detail: null });
                return;
            }
            if (this.state.planOpen) {
                this.setState({ planOpen: false });
                return;
            }
            if (this.state.editModal) {
                this.setState({ editModal: null });
                return;
            }
            if (this.state.showEntry)
                this.setState({ showEntry: false });
        };
        this.onQuickCategoryOutside = (event) => {
            var _a, _b, _c;
            if (!this.state.quickCategory || this.quickCategoryWrite)
                return;
            if (((_b = (_a = event.target) === null || _a === void 0 ? void 0 : _a.closest) === null || _b === void 0 ? void 0 : _b.call(_a, '.u5-category-popover')) || ((_c = this.quickCategoryAnchor) === null || _c === void 0 ? void 0 : _c.contains(event.target)))
                return;
            this.closeQuickCategory(false);
        };
        this.onQuickCategoryViewportChange = (event) => {
            var _a, _b;
            if (!this.state.quickCategory || this.quickCategoryWrite)
                return;
            if ((event === null || event === void 0 ? void 0 : event.type) === 'scroll' && ((_b = (_a = event.target) === null || _a === void 0 ? void 0 : _a.closest) === null || _b === void 0 ? void 0 : _b.call(_a, '.u5-category-popover')))
                return;
            this.closeQuickCategory(false);
        };
        const mode = 'real';
        this.state = { mode, data: desktop ? starter() : load(mode), page: 'overview', month: nowYM, showEntry: false, entry: { date: iso(new Date()), description: '', kind: 'expense', category: 'Outros', value: '' }, sim: { value: '', installments: '6', interest: '0' }, outcome: null, simCalculatedInput: null, simResultStale: false, simError: '', query: '', toast: '', budgetEdit: '', busy: !!desktop, booting: !!desktop, editModal: null, bank: EMPTY_BANK, bankForm: { clientId: '', clientSecret: '', itemIds: '' }, bankBusy: false, bankMessage: '', bankFilter: '', txSource: 'all', txReviewOnly: false, txOrganize: false, txAdvancedOpen: false, txCategoryFilter: '', txKindFilter: 'all', txReviewFilter: 'all', txSort: 'date_desc', quickCategory: null, quickCategoryQuery: '', quickCategoryIndex: 0, quickCategoryBusy: false, quickCategoryError: '', categoryMoreEmojis: false, quickAddOpen: false, dashboardSource: 'bank', sourceDetailsOpen: false, budgetTab: 'expense', showAllBudgetCategories: false, categories: DEFAULT_CATEGORY_INFOS, rules: [], categoryEditor: { previousName: '', name: '', color: '#3e9a85', emoji: '✨', kind: 'expense' }, ruleEditor: emptyRule(), ruleTest: 'IFOOD', categoryMessage: '', entryCategoryTouched: false, bankConfigOpen: false, overviewPeriod: 'month', customStart: iso(new Date()), customEnd: iso(new Date()), backupInfo: { copies: 0, last: null }, detail: null, detailDraft: { merchant: '', note: '', nature: 'auto', reviewed: false, aliasPattern: '', splitParts: [] }, manualDraft: null, detailBusy: false, categorySaving: [], txSelected: [], txBatchCategory: 'Alimentação', planning: EMPTY_PLANNING, planMonth: nowYM, planDay: iso(new Date()), planSelected: null, planOpen: false, planForm: freshPlanForm(), planBusy: false, planView: 'all', planTerm: '', planIncludeEstimated: false, planBankTitle: '', planMatchQuery: '', planHistory: [], cloudStage: 'not_started', cloudBusy: false, cloudMessage: '', cloudIdentityConnected: false, cloudQuarantineVerified: false, cloudPersonalTransferred: false, cloudParityBusy: false, cloudParityMessage: '', cloudE1Report: null, intelligenceTab: 'today', intelligenceDraft: '', intelligencePreparedQuestion: '', intelligencePanelOpen: false, intelligenceContext: 'overview', intelligenceExpandedAction: null, aiStatus: { connected: false, secure: false }, aiBusy: false, aiError: '', aiDemoCase: 'budget', aiEffort: 'auto', aiCreditsConfirmed: false, aiResult: null, aiStreaming: '', aiCapabilities: null, aiMemories: [], aiMemoryDraft: '', aiMemoryKind: 'preference', aiMemoryBusy: false, aiMemoryError: '', aiUseMemories: false, aiPreview: null, aiUsageStats: null, aiFinancialDemoSource: 'bank', aiFinancialDemo: null, aiFinancialDemoBusy: false, aiFinancialDemoError: '' };
    }
    async componentDidMount() {
        var _a, _b, _c, _d, _e;
        window.addEventListener('keydown', this.onGlobalKeydown);
        window.addEventListener('resize', this.onQuickCategoryViewportChange);
        window.addEventListener('scroll', this.onQuickCategoryViewportChange, true);
        document.addEventListener('pointerdown', this.onQuickCategoryOutside, true);
        if (!desktop)
            return;
        this.unsubscribeAI = ((_a = desktop.onAIDelta) === null || _a === void 0 ? void 0 : _a.call(desktop, (delta) => this.setState((previous) => ({ aiStreaming: (previous.aiStreaming + delta).slice(0, 12000) })))) || null;
        void intelligenceRefresh(this);
        try {
            const persisted = await desktop.load('real');
            this.setState({ data: persisted ? safeData(persisted) : starter(), busy: false, booting: false });
            await this.refreshCategories();
            const currentBank = await this.refreshBank();
            await this.refreshPlanning();
            this.unsubscribePersonalCloud = ((_b = desktop.onCloudPersonalUpdated) === null || _b === void 0 ? void 0 : _b.call(desktop, (event) => {
                if ((event === null || event === void 0 ? void 0 : event.inbound) > 0 && this.state.mode === 'real')
                    void this.refreshCloudPersonalUI();
            })) || null;
            try {
                const backupInfo = await ((_c = desktop.backupStatus) === null || _c === void 0 ? void 0 : _c.call(desktop));
                if (backupInfo)
                    this.setState({ backupInfo });
            }
            catch (_) { }
            try {
                const cloud = await ((_d = desktop.cloudMigrationStatus) === null || _d === void 0 ? void 0 : _d.call(desktop));
                if (cloud)
                    this.setState({ cloudStage: cloud.stage });
            }
            catch (_) { }
            try {
                const identity = await ((_e = desktop.cloudAccessStatus) === null || _e === void 0 ? void 0 : _e.call(desktop));
                if (identity)
                    this.setState({ cloudIdentityConnected: !!identity.connected });
            }
            catch (_) { }
            this.autoSyncTimer = window.setInterval(() => this.maybeAutoSync(), 30 * 60 * 1000);
            if (currentBank)
                this.maybeAutoSync(currentBank);
        }
        catch (e) {
            this.setState({ fatal: 'Não foi possível abrir seus dados pessoais: ' + String((e === null || e === void 0 ? void 0 : e.message) || e), busy: false, booting: false });
        }
    }
    componentDidUpdate(_prevProps, previous) {
        var _a, _b, _c, _d;
        const before = !!(previous.showEntry || previous.editModal || previous.detail || previous.planOpen || previous.planSelected || previous.intelligencePanelOpen);
        const now = !!(this.state.showEntry || this.state.editModal || this.state.detail || this.state.planOpen || this.state.planSelected || this.state.intelligencePanelOpen);
        if (!before && now) {
            this.focusReturn = document.activeElement;
            const dialog = document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer,.mf-ai-drawer');
            const control = dialog === null || dialog === void 0 ? void 0 : dialog.querySelector('input:not([disabled]),button:not([disabled])');
            const categoryControl = this.focusCategoryOnDetailOpen && this.state.detail
                ? dialog === null || dialog === void 0 ? void 0 : dialog.querySelector('.mf-transaction-category-select') : null;
            (_a = (categoryControl || control)) === null || _a === void 0 ? void 0 : _a.focus();
            this.focusCategoryOnDetailOpen = false;
        }
        else if (before && !now) {
            if (previous.intelligencePanelOpen)
                (_b = document.querySelector('.mf-ai-fab')) === null || _b === void 0 ? void 0 : _b.focus();
            else if (this.focusReturn && document.contains(this.focusReturn))
                (_d = (_c = this.focusReturn).focus) === null || _d === void 0 ? void 0 : _d.call(_c);
            this.focusReturn = null;
        }
    }
    async refreshCloudPersonalUI() {
        if (!desktop || this.state.mode !== 'real')
            return;
        try {
            const latest = await desktop.load('real');
            if (latest)
                this.setState({ data: safeData(latest) });
            await this.refreshCategories();
            await this.refreshPlanning();
        }
        catch (_) {
        }
    }
    async refreshBank() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.bankStatus))
            return;
        try {
            const bank = await desktop.bankStatus();
            this.setState({ bank, bankForm: { clientId: bank.config.clientId || '', clientSecret: '', itemIds: (bank.config.itemIds || []).join(', ') } });
            return bank;
        }
        catch (e) {
            this.setState({ bankMessage: 'Não foi possível consultar a integração: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    componentWillUnmount() { var _a, _b; window.removeEventListener('keydown', this.onGlobalKeydown); window.removeEventListener('resize', this.onQuickCategoryViewportChange); window.removeEventListener('scroll', this.onQuickCategoryViewportChange, true); document.removeEventListener('pointerdown', this.onQuickCategoryOutside, true); (_a = this.unsubscribePersonalCloud) === null || _a === void 0 ? void 0 : _a.call(this); (_b = this.unsubscribeAI) === null || _b === void 0 ? void 0 : _b.call(this); if (this.autoSyncTimer)
        clearInterval(this.autoSyncTimer); if (this.timeout)
        clearTimeout(this.timeout); }
    maybeAutoSync(bank = this.state.bank) {
        var _a;
        const delay = 6 * 60 * 60 * 1000, now = Date.now();
        if (!desktop || this.state.mode !== 'real' || !bank.config.configured || this.state.bankBusy || this.state.busy)
            return;
        const last = ((_a = bank.data.last) === null || _a === void 0 ? void 0 : _a.completedAt) ? Date.parse(bank.data.last.completedAt) : 0;
        if (last && now - last < delay)
            return;
        if (this.lastSyncAttempt && now - this.lastSyncAttempt < delay)
            return;
        this.syncBank(true);
    }
    async importCategoryPack() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.importCategoryPack) || this.state.mode === 'demo')
            return;
        try {
            const result = await desktop.importCategoryPack();
            if (result === null || result === void 0 ? void 0 : result.cancelled)
                return;
            this.setState({ categories: result.categories.categories, rules: result.categories.rules, bank: { ...this.state.bank, data: result.data },
                categoryMessage: `Sugestões aplicadas: ${result.rulesAdded} regras, ${result.overridesAdded} classificações. Outras movimentações continuam disponíveis para revisão.` });
            await this.refreshPlanning();
        }
        catch (e) {
            this.setState({ categoryMessage: 'Não foi possível importar as sugestões: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async refreshCategories() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.categoriesStatus))
            return;
        try {
            const state = await desktop.categoriesStatus();
            this.setState({ categories: state.categories, rules: state.rules });
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    getCategories() { return this.state.categories.length ? this.state.categories : DEFAULT_CATEGORY_INFOS; }
    async saveCategory() {
        if (!desktop || this.state.mode === 'demo')
            return;
        const value = this.state.categoryEditor;
        try {
            const state = await desktop.categorySave(value);
            const persisted = await desktop.load(this.state.mode);
            this.setState({ categories: state.categories, rules: state.rules, categoryEditor: { previousName: '', name: '', color: '#3e9a85', emoji: '✨', kind: 'expense' }, categoryMessage: 'Categoria salva.', data: persisted ? safeData(persisted) : this.state.data });
            await this.refreshBank();
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async deleteCategory(name) {
        if (!desktop || this.state.mode === 'demo' || !confirm('Excluir a categoria ' + name + '? A exclusão será impedida se ela estiver em uso.'))
            return;
        try {
            const state = await desktop.categoryDelete(name);
            const persisted = await desktop.load(this.state.mode);
            this.setState({ categories: state.categories, rules: state.rules, data: persisted ? safeData(persisted) : this.state.data, categoryMessage: 'Categoria excluída.' });
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async saveRule() {
        if (!desktop || this.state.mode === 'demo')
            return;
        try {
            const rule = this.state.ruleEditor;
            const state = await desktop.ruleSave({ ...rule, priority: Number(rule.priority) });
            this.setState({ categories: state.categories, rules: state.rules, ruleEditor: emptyRule(), categoryMessage: 'Regra salva. Os extratos bancários já importados foram reclassificados na visualização.' });
            await this.refreshBank();
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async deleteRule(id) {
        if (!desktop || this.state.mode === 'demo' || !confirm('Excluir esta regra?'))
            return;
        try {
            const state = await desktop.ruleDelete(id);
            this.setState({ categories: state.categories, rules: state.rules, categoryMessage: 'Regra excluída.' });
            await this.refreshBank();
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async setBankCategory(tx, category) {
        if (!desktop || this.state.mode === 'demo')
            return false;
        const key = tx.accountId + '|' + tx.id;
        if (this.categorySavingKeys.has(key))
            return false;
        this.categorySavingKeys.add(key);
        this.setState((prev) => ({ categorySaving: [...prev.categorySaving, key], categoryMessage: 'Salvando categoria…' }));
        const job = this.categorySaveQueue.then(() => desktop.bankCategorize({ accountId: tx.accountId, externalId: tx.id, category: category || null }))
            .then(data => {
            if (!data || !Array.isArray(data.transactions))
                throw new Error('Resposta bancária inválida.');
            this.setState({ bank: { ...this.state.bank, data }, categoryMessage: 'Classificação bancária salva.' });
            return true;
        })
            .catch((e) => { this.flash('Falha ao classificar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e)); return false; })
            .finally(() => { this.categorySavingKeys.delete(key); this.setState((prev) => ({ categorySaving: prev.categorySaving.filter(k => k !== key) })); });
        this.categorySaveQueue = job;
        return await job;
    }
    async changeManualCategory(id, category) {
        const data = this.state.data, current = data.transactions.find(t => t.id === id);
        if (!current)
            return false;
        if (current.category === category)
            return true;
        if (!this.getCategories().some(c => c.name === category && (c.kind === 'both' || c.kind === current.kind))) {
            this.flash('Categoria incompatível com esta movimentação.');
            return false;
        }
        return await this.updateData({ ...data, transactions: data.transactions.map(t => t.id === id ? { ...t, category } : t) });
    }
    bankTxSelected(tx) { return this.state.txSelected.includes(tx.accountId + '|' + tx.id); }
    toggleSelected(tx) { const key = tx.accountId + '|' + tx.id; this.setState({ txSelected: this.bankTxSelected(tx) ? this.state.txSelected.filter(x => x !== key) : this.state.txSelected.length >= 100 ? this.state.txSelected : [...this.state.txSelected, key] }); }
    openBankDetail(tx) {
        var _a;
        this.setState({ detail: { origin: 'bank', id: tx.id, accountId: tx.accountId }, detailDraft: { merchant: tx.merchant || '', note: tx.note || '', nature: tx.nature || 'auto', reviewed: !!tx.reviewed, aliasPattern: tx.description.slice(0, 60), splitParts: (((_a = tx.splits) === null || _a === void 0 ? void 0 : _a.length) ? tx.splits : [{ category: tx.category, amount: Math.floor(Math.abs(tx.amount) / 2) }, { category: tx.category, amount: Math.abs(tx.amount) - Math.floor(Math.abs(tx.amount) / 2) }]).map(p => ({ category: p.category, value: moneyString(p.amount) })) } });
    }
    openManualDetail(tx) {
        this.setState({ detail: { origin: 'manual', id: tx.id },
            manualDraft: { description: tx.description, date: tx.date, value: moneyString(tx.amount), category: tx.category } });
    }
    isManualLinked(id) {
        return this.state.bank.data.transactions.some(tx => tx.linkedManualId === id);
    }
    async saveManualDetail(id) {
        const sel = this.state.detail;
        if (!sel || sel.origin !== 'manual' || sel.id !== id || this.state.busy || this.writeInProgress)
            return false;
        const original = this.state.data.transactions.find(t => t.id === id);
        const draft = this.state.manualDraft;
        if (!original || !draft)
            return false;
        const description = draft.description.trim(), amount = parsePositiveBRLInput(draft.value);
        if (!description || description.length > 150) {
            this.flash('Informe uma descrição de até 150 caracteres.');
            return false;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || iso(fromISO(draft.date)) !== draft.date) {
            this.flash('Informe uma data válida, inclusive dia e mês.');
            return false;
        }
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            this.flash('Valor inválido. Use reais e no máximo duas casas decimais (ex.: 1.234,56).');
            return false;
        }
        const allowed = this.getCategories().some(c => c.name === draft.category &&
            (original.kind === 'income' ? c.kind !== 'expense' : c.kind !== 'income'));
        if (!allowed && draft.category !== original.category) {
            this.flash('Selecione uma categoria compatível.');
            return false;
        }
        if (this.isManualLinked(id) && (draft.date !== original.date || amount !== original.amount)) {
            this.flash('Desvincule este lançamento da movimentação bancária antes de mudar data ou valor.');
            return false;
        }
        const result = await this.updateData({ ...this.state.data, transactions: this.state.data.transactions.map(t => t.id === id ? { ...t, description, date: draft.date, amount, category: draft.category } : t) }, 'Lançamento atualizado.');
        if (result)
            this.setState({ detail: null, manualDraft: null });
        return result;
    }
    openCategoryFromRow(origin, tx, event) {
        var _a, _b;
        if (this.quickCategoryWrite || this.state.busy || this.state.detailBusy)
            return;
        const trigger = event === null || event === void 0 ? void 0 : event.currentTarget;
        const r = (_a = trigger === null || trigger === void 0 ? void 0 : trigger.getBoundingClientRect) === null || _a === void 0 ? void 0 : _a.call(trigger);
        if (!r)
            return;
        if (((_b = this.state.quickCategory) === null || _b === void 0 ? void 0 : _b.origin) === origin && this.state.quickCategory.id === tx.id &&
            (origin === 'manual' || this.state.quickCategory.accountId === tx.accountId)) {
            this.closeQuickCategory();
            return;
        }
        const width = Math.max(220, Math.min(328, window.innerWidth - 24));
        const height = Math.min(342, window.innerHeight - 24);
        const below = window.innerHeight - r.bottom;
        this.quickCategoryAnchor = trigger;
        this.setState({ quickCategory: { origin, id: tx.id,
                accountId: origin === 'bank' ? tx.accountId : undefined,
                left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)),
                top: below > height + 8 ? r.bottom + 6 : Math.max(12, r.top - height - 6), width },
            quickCategoryQuery: '', quickCategoryIndex: 0, quickCategoryError: '' }, () => { var _a; return (_a = this.quickCategorySearchInput) === null || _a === void 0 ? void 0 : _a.focus(); });
    }
    closeQuickCategory(restoreFocus = true) {
        if (this.quickCategoryWrite)
            return;
        const anchor = this.quickCategoryAnchor;
        this.setState({ quickCategory: null, quickCategoryQuery: '', quickCategoryIndex: 0, quickCategoryError: '' }, () => { if (restoreFocus && (anchor === null || anchor === void 0 ? void 0 : anchor.isConnected))
            anchor.focus(); });
    }
    quickCategoryContext() {
        const target = this.state.quickCategory;
        if (!target)
            return null;
        if (target.origin === 'manual') {
            const tx = this.state.data.transactions.find(t => t.id === target.id);
            return tx ? { category: tx.category, kind: tx.kind, description: tx.description, raw: tx } : null;
        }
        const tx = this.state.bank.data.transactions.find(t => t.accountId === target.accountId && t.id === target.id);
        if (!tx)
            return null;
        const nature = effectiveNature(tx);
        return { category: tx.category, kind: (nature === 'income' || nature === 'expense' ? nature : null),
            nature, description: tx.customTitle || tx.merchant || tx.description, raw: tx };
    }
    quickCategoryChoices() {
        const context = this.quickCategoryContext(), term = fold(this.state.quickCategoryQuery);
        if (!context || !context.kind)
            return [];
        return this.getCategories().filter(c => (c.kind === 'both' || c.kind === context.kind) && (!term || fold(c.name).includes(term)));
    }
    async chooseQuickCategory(category) {
        if (this.quickCategoryWrite || !this.state.quickCategory)
            return false;
        const target = this.state.quickCategory, context = this.quickCategoryContext();
        if (!context) {
            this.setState({ quickCategoryError: 'Movimentação não encontrada. Atualize a lista.' });
            return false;
        }
        if (!context.kind) {
            this.setState({ quickCategoryError: 'Transferências e movimentações desconsideradas exigem revisar a natureza nos detalhes antes de categorizar.' });
            return false;
        }
        const valid = this.getCategories().some(c => c.name === category && (c.kind === 'both' || c.kind === context.kind));
        if (!valid) {
            this.setState({ quickCategoryError: 'Categoria incompatível com a movimentação.' });
            return false;
        }
        if (category === context.category) {
            this.closeQuickCategory();
            return true;
        }
        this.quickCategoryWrite = true;
        this.setState({ quickCategoryBusy: true, quickCategoryError: '' });
        let saved = false;
        try {
            saved = target.origin === 'bank' ?
                await this.setBankCategory(context.raw, category) :
                await this.changeManualCategory(target.id, category);
        }
        catch (e) {
            this.setState({ quickCategoryError: 'Não foi possível salvar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
        finally {
            this.quickCategoryWrite = false;
            this.setState({ quickCategoryBusy: false });
        }
        if (!saved) {
            this.setState((state) => ({ quickCategoryError: state.quickCategoryError || 'Não foi possível salvar. A categoria anterior foi mantida.' }));
            return false;
        }
        this.closeQuickCategory();
        this.flash('Categoria atualizada.');
        return true;
    }
    renderQuickCategoryPopover() {
        const target = this.state.quickCategory, context = this.quickCategoryContext();
        if (!target)
            return null;
        const choices = this.quickCategoryChoices();
        const index = Math.min(this.state.quickCategoryIndex, Math.max(0, choices.length - 1));
        const onKey = (e) => {
            var _a;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.closeQuickCategory();
                return;
            }
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && choices.length) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                this.setState((prev) => ({ quickCategoryIndex: (prev.quickCategoryIndex + delta + choices.length) % choices.length }));
                (_a = this.quickCategorySearchInput) === null || _a === void 0 ? void 0 : _a.focus();
                return;
            }
            const selected = choices[Math.min(this.state.quickCategoryIndex, choices.length - 1)];
            if (e.key === 'Enter' && e.target === this.quickCategorySearchInput && selected) {
                e.preventDefault();
                e.stopPropagation();
                void this.chooseQuickCategory(selected.name);
            }
        };
        return ReactDOM.createPortal(h('div', { className: 'u5-category-layer' }, h('section', { className: 'u5-category-popover', role: 'dialog',
            'aria-label': 'Alterar categoria da movimentação', onKeyDown: onKey,
            style: { position: 'fixed', left: target.left, top: target.top, width: target.width,
                maxHeight: 'min(360px, calc(100vh - 24px))' } }, h('div', { className: 'u5-category-top' }, h('span', { className: 'micro-label' }, target.origin === 'bank' ? 'CLASSIFICAÇÃO PESSOAL · BANCO' : 'LANÇAMENTO MANUAL'), h('button', { type: 'button', className: 'u5-category-close', 'aria-label': 'Fechar categorias',
            disabled: this.state.quickCategoryBusy, onClick: () => this.closeQuickCategory() }, h(Icon, { name: 'close', size: 16 }))), h('p', { className: 'u5-category-current' }, 'Categoria atual: ', h('strong', {}, (context === null || context === void 0 ? void 0 : context.category) || 'Indisponível')), h('label', { className: 'u5-category-search' }, h(Icon, { name: 'search', size: 16 }), h('input', { ref: (el) => this.quickCategorySearchInput = el, type: 'search',
            role: 'combobox', 'aria-label': 'Buscar categoria', 'aria-autocomplete': 'list',
            'aria-expanded': true, 'aria-controls': 'u5-category-options',
            'aria-activedescendant': choices.length ? 'u5-category-option-' + index : undefined,
            placeholder: 'Pesquisar categorias', value: this.state.quickCategoryQuery,
            disabled: this.state.quickCategoryBusy,
            onChange: (e) => this.setState({ quickCategoryQuery: e.target.value, quickCategoryIndex: 0 }) })), h('div', { id: 'u5-category-options', role: 'listbox', className: 'u5-category-options',
            'aria-label': 'Categorias compatíveis' }, choices.length ? choices.map((cat, i) => h('button', { type: 'button',
            id: 'u5-category-option-' + i, key: cat.name, role: 'option',
            'aria-selected': cat.name === (context === null || context === void 0 ? void 0 : context.category),
            className: 'u5-category-choice ' + (i === index ? 'active ' : '') +
                (cat.name === (context === null || context === void 0 ? void 0 : context.category) ? 'current' : ''),
            disabled: this.state.quickCategoryBusy,
            onMouseEnter: () => {
                if (!this.state.quickCategoryBusy && this.state.quickCategoryIndex !== i)
                    this.setState({ quickCategoryIndex: i });
            },
            onClick: () => void this.chooseQuickCategory(cat.name) }, h('span', {}, cat.name), cat.name === (context === null || context === void 0 ? void 0 : context.category) ?
            h(Icon, { name: 'check', size: 16 }) : null)) :
            h('p', { className: 'u5-category-empty' }, context && !context.kind ? 'Natureza de transferência ou desconsiderada: altere nos detalhes antes de categorizar.' : 'Nenhuma categoria compatível encontrada.')), this.state.quickCategoryError ?
            h('p', { className: 'u5-category-error', role: 'alert' }, this.state.quickCategoryError) : null, h('small', { className: 'u5-category-hint', role: 'status' }, this.state.quickCategoryBusy ? 'Salvando categoria…' :
            '↑ ↓ para navegar · Enter para salvar · Esc para fechar'))), document.body);
    }
    async updateBankInfo() {
        const sel = this.state.detail;
        if (!desktop || !sel || sel.origin !== 'bank' || this.state.detailBusy)
            return;
        const f = this.state.detailDraft;
        this.setState({ detailBusy: true });
        try {
            const data = await desktop.bankEditDetail({ accountId: sel.accountId, externalId: sel.id, merchant: f.merchant, note: f.note, nature: f.nature, reviewed: f.reviewed });
            this.setState({ bank: { ...this.state.bank, data }, detailBusy: false });
            this.flash('Detalhes salvos.');
        }
        catch (e) {
            this.setState({ detailBusy: false });
            this.flash('Não foi possível salvar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async runBankOperation(method, input, feedback, closeDetail = false) {
        if (!desktop || this.state.mode === 'demo' || this.state.detailBusy)
            return;
        this.setState({ detailBusy: true });
        try {
            const data = await desktop[method](input);
            this.setState({ bank: { ...this.state.bank, data }, detailBusy: false, txSelected: method === 'bankBatch' ? [] : this.state.txSelected, detail: closeDetail ? null : this.state.detail });
            this.flash(feedback);
        }
        catch (e) {
            this.setState({ detailBusy: false });
            this.flash('Não foi possível concluir: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async applyBankBatch(changes) {
        const items = this.state.txSelected.map(key => { const x = this.state.bank.data.transactions.find(t => t.accountId + '|' + t.id === key); return x ? { accountId: x.accountId, externalId: x.id } : null; }).filter(Boolean);
        if (!items.length)
            return this.flash('Selecione movimentações bancárias.');
        await this.runBankOperation('bankBatch', { items, ...changes }, 'Alterações aplicadas a ' + items.length + ' movimentações.');
    }
    async saveSplit() {
        const sel = this.state.detail;
        if (!sel || sel.origin !== 'bank')
            return;
        const parts = this.state.detailDraft.splitParts.map(x => ({ category: x.category, amount: parseMoney(x.value) }));
        if (parts.some(x => !Number.isSafeInteger(x.amount) || x.amount <= 0))
            return this.flash('Confira os valores da divisão.');
        await this.runBankOperation('bankSplit', { accountId: sel.accountId, externalId: sel.id, parts }, parts.length ? 'Divisão salva.' : 'Divisão removida.');
    }
    async createCategoryRuleFromDetail() {
        const sel = this.state.detail, tx = this.state.bank.data.transactions.find(x => x.accountId === (sel === null || sel === void 0 ? void 0 : sel.accountId) && x.id === (sel === null || sel === void 0 ? void 0 : sel.id));
        if (!desktop || !tx || !sel || sel.origin !== 'bank' || this.state.detailBusy)
            return;
        const pattern = this.state.detailDraft.aliasPattern.trim();
        if (pattern.length < 3)
            return this.flash('Use um trecho específico com pelo menos 3 caracteres.');
        const matches = this.state.bank.data.transactions.filter(x => fold(x.description).includes(fold(pattern))).length;
        if (!confirm('Usar a categoria ' + tx.category + ' para ' + matches + ' movimentação(ões) com o texto ' + pattern + '? Confira se não é um termo genérico.'))
            return;
        this.setState({ detailBusy: true });
        try {
            const result = await desktop.ruleSave({ pattern, category: tx.category, matchMode: 'contains', scope: 'bank', priority: 100 });
            const data = await desktop.bankStatus();
            this.setState({ rules: result.rules, categories: result.categories, bank: data, detailBusy: false });
            this.flash('Regra de categoria criada.');
        }
        catch (e) {
            this.setState({ detailBusy: false });
            this.flash('Não foi possível criar regra: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async createMerchantAlias() {
        const f = this.state.detailDraft;
        if (!f.merchant.trim() || f.aliasPattern.trim().length < 3)
            return this.flash('Informe o nome e um trecho da descrição.');
        await this.runBankOperation('bankMerchantAlias', { pattern: f.aliasPattern, displayName: f.merchant }, 'Nome do estabelecimento aplicado às movimentações semelhantes.');
    }
    async setManualLink(manualId) {
        const sel = this.state.detail;
        if (!sel || sel.origin !== 'bank')
            return;
        await this.runBankOperation('bankLinkManual', { accountId: sel.accountId, externalId: sel.id, manualId }, manualId ? 'Movimentações vinculadas.' : 'Vínculo removido.');
    }
    async configureBank() {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy)
            return;
        const f = this.state.bankForm, itemIds = [...new Set(f.itemIds.split(/[;,\n]+/).map(v => v.trim()).filter(Boolean))];
        if (!itemIds.length)
            return this.flash('Informe o código da sua conexão bancária.');
        this.setState({ bankBusy: true, bankMessage: '' });
        try {
            const bank = await desktop.bankConfigure({ clientId: f.clientId.trim(), clientSecret: f.clientSecret, itemIds });
            this.setState({ bank, bankBusy: false, bankForm: { ...f, clientSecret: '', clientId: bank.config.clientId, itemIds: bank.config.itemIds.join(', ') }, bankMessage: 'Conexão salva com segurança. Agora você pode atualizar suas contas.' });
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async dismissBankDuplicate(pairKey) {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.bankDismissDuplicate) || !confirm('Ocultar este aviso? Os lançamentos originais serão preservados.'))
            return;
        try {
            const data = await desktop.bankDismissDuplicate(pairKey);
            this.setState({ bank: { ...this.state.bank, data } });
            this.flash('Aviso ocultado. Nenhum lançamento foi excluído.');
        }
        catch (e) {
            this.flash('Não foi possível ocultar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async syncBank(automatic = false) {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy)
            return;
        this.lastSyncAttempt = Date.now();
        this.setState({ bankBusy: true, bankMessage: 'Atualizando suas contas. Isso pode levar alguns instantes.' });
        try {
            const result = await desktop.bankSync();
            this.setState({ bank: result, bankBusy: false, bankMessage: 'Contas atualizadas: ' + result.newCount + ' novas e ' + result.totalCount + ' consultadas. Os lançamentos manuais foram preservados.' });
            await this.refreshPlanning();
            if (!automatic)
                this.flash('Contas atualizadas: ' + result.newCount + ' novas movimentações.');
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: 'Sincronização não concluída: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) + '. O histórico anterior foi preservado.' });
            if (!automatic)
                this.flash('Não foi possível atualizar. Veja os detalhes em Minhas contas.');
        }
    }
    async forgetBank() {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy || !confirm('Desconectar esta conta? Suas movimentações já salvas continuarão disponíveis neste computador.'))
            return;
        this.setState({ bankBusy: true });
        try {
            const bank = await desktop.bankForget();
            this.setState({ bank, bankBusy: false, bankForm: { clientId: '', clientSecret: '', itemIds: '' }, bankMessage: 'Conta desconectada. Suas movimentações anteriores foram preservadas.' });
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    flash(msg) { this.setState({ toast: msg }); clearTimeout(this.timeout); this.timeout = setTimeout(() => this.setState({ toast: '' }), 4500); }
    async updateData(data, msg) {
        if (this.writeInProgress || this.state.busy) {
            this.flash('Aguarde a gravação anterior.');
            return false;
        }
        this.writeInProgress = true;
        const mode = this.state.mode;
        this.setState({ busy: true });
        try {
            if (desktop)
                await desktop.save(mode, data);
            else
                save(mode, data);
            this.setState({ data, busy: false });
            if (msg)
                this.flash(msg);
            return true;
        }
        catch (e) {
            this.setState({ busy: false });
            this.flash('Não foi possível salvar sua alteração: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            return false;
        }
        finally {
            this.writeInProgress = false;
        }
    }
    async toggleMode() {
        this.simRequest++;
        this.setState({ simSaved: undefined, simBusy: false });
        if (this.state.busy) {
            this.flash('Aguarde a operação atual.');
            return;
        }
        const mode = this.state.mode === 'real' ? 'demo' : 'real';
        if (!desktop) {
            this.setState({ mode, data: load(mode), outcome: null, page: 'overview', showEntry: false });
            return;
        }
        this.setState({ busy: true });
        try {
            let loaded = await desktop.load(mode);
            if (!loaded) {
                loaded = mode === 'demo' ? demoData() : starter();
                if (mode === 'demo')
                    await desktop.save('demo', loaded);
            }
            this.setState({ mode, data: safeData(loaded), busy: false, outcome: null, page: 'overview', showEntry: false });
        }
        catch (e) {
            this.setState({ busy: false });
            this.flash('Não foi possível acessar o perfil: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async backupDB() {
        if (!desktop)
            return;
        try {
            const r = await desktop.backupSQLite();
            if (!(r === null || r === void 0 ? void 0 : r.cancelled))
                this.flash('Sua cópia de segurança foi salva.');
        }
        catch (e) {
            this.flash('Não foi possível salvar a cópia de segurança: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async prepareCloudOnboarding() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.transferPersonalCloud) || !(desktop === null || desktop === void 0 ? void 0 : desktop.connectCloudAccess) || this.state.cloudBusy ||
            this.state.busy || this.state.bankBusy || this.state.mode !== 'real')
            return;
        this.setState({ cloudBusy: true,
            cloudMessage: 'Conectando ao login protegido. O envio precisará da sua confirmação explícita...' });
        try {
            const identity = await desktop.connectCloudAccess();
            if (!(identity === null || identity === void 0 ? void 0 : identity.connected)) {
                this.setState({ cloudBusy: false, cloudIdentityConnected: false,
                    cloudMessage: 'Login ainda não concluído. Nenhum dado enviado. Clique para tentar novamente.' });
                return;
            }
            this.setState({ cloudIdentityConnected: true,
                cloudMessage: 'Login confirmado. O Windows solicitará autorização antes de copiar suas personalizações.' });
            const result = await desktop.transferPersonalCloud();
            if (result === null || result === void 0 ? void 0 : result.cancelled) {
                this.setState({ cloudBusy: false, cloudMessage: 'Transferência cancelada por você. Nenhum registro novo enviado.' });
                return;
            }
            if ((result === null || result === void 0 ? void 0 : result.stage) !== 'quarantine_verified' || !result.backupVerified ||
                result.personalTablesReady !== 17 || result.recordsSent !== result.personalRecordsReady ||
                result.financialSyncEnabled !== false)
                throw new Error('A nuvem não confirmou o pacote completo.');
            this.setState({ cloudBusy: false, cloudPersonalTransferred: true,
                cloudStage: 'quarantine_verified',
                cloudMessage: 'Personalizações copiadas e conferidas na área protegida da Cloudflare: ' +
                    result.recordsSent + ' registros em 17 tabelas. Backup automático preservado. ' +
                    'Sincronização financeira ainda não ativada; falta conciliar o histórico bancário com o Pluggy.' });
        }
        catch (error) {
            this.setState({ cloudBusy: false,
                cloudMessage: 'Não foi possível concluir a conferência na nuvem: ' +
                    String((error === null || error === void 0 ? void 0 : error.message) || error) +
                    '. O SQLite original permanece disponível e a sincronização financeira continua desativada.' });
        }
    }
    async auditCloudE1() {
        var _a, _b;
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.cloudE1Audit) || this.state.cloudParityBusy ||
            this.state.busy || this.state.bankBusy || this.state.mode !== 'real')
            return;
        this.setState({ cloudParityBusy: true, cloudE1Report: null,
            cloudParityMessage: 'Conferindo histórico, contas, categorias e referências do Windows com a nuvem...' });
        try {
            const result = await desktop.cloudE1Audit();
            if ((result === null || result === void 0 ? void 0 : result.ok) !== true || result.stage !== 'e1_consolidated_comparison' ||
                result.e1Completed !== false || result.cloudCutoverAllowed !== false || !result.checks) {
                this.setState({ cloudParityBusy: false, cloudE1Report: null,
                    cloudParityMessage: (result === null || result === void 0 ? void 0 : result.reason) === 'cloud_login_required' ?
                        'Entre na sessão protegida da Cloudflare no Windows e tente novamente.' :
                        'Auditoria indisponível neste ambiente. Nenhuma informação financeira foi alterada.' });
                return;
            }
            this.setState({ cloudParityBusy: false, cloudE1Report: result,
                cloudParityMessage: 'E1: ' + result.verifiedCount + ' verificações confirmadas, ' +
                    result.mismatchCount + ' divergências e ' + result.pendingCount +
                    ' pendências. Windows ' + ((_a = result.counts) === null || _a === void 0 ? void 0 : _a.bankWindows) +
                    ' × Cloudflare ' + ((_b = result.counts) === null || _b === void 0 ? void 0 : _b.bankCloud) +
                    ' transações. A base única continua bloqueada até a conclusão da conferência.' });
        }
        catch {
            this.setState({ cloudParityBusy: false, cloudE1Report: null,
                cloudParityMessage: 'A auditoria não pôde ser finalizada. Seus registros locais permanecem intactos.' });
        }
    }
    async compareCloudBank() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.cloudBankParity) || this.state.cloudParityBusy ||
            this.state.busy || this.state.bankBusy || this.state.mode !== 'real')
            return;
        this.setState({ cloudParityBusy: true, cloudParityMessage: 'Comparando somente resumos criptográficos do histórico bancário...' });
        try {
            const comparison = await desktop.cloudBankParity();
            if ((comparison === null || comparison === void 0 ? void 0 : comparison.ok) !== true) {
                const message = (comparison === null || comparison === void 0 ? void 0 : comparison.reason) === 'cloud_login_required' ? 'Entre no Preview da Cloudflare antes da conferência.' :
                    (comparison === null || comparison === void 0 ? void 0 : comparison.reason) === 'network_unavailable' ? 'A Cloudflare não respondeu à consulta.' :
                        'A conferência não pôde ser concluída. Nenhum dado local foi modificado.';
                this.setState({ cloudParityBusy: false, cloudParityMessage: message });
                return;
            }
            const yes = (n) => n === true ? 'coincide' : 'diverge';
            this.setState({ cloudParityBusy: false, cloudParityMessage: 'Windows: ' + comparison.localCount + ' · Cloudflare: ' + comparison.cloudCount +
                    ' movimentações. Identificadores: ' + yes(comparison.exactIdentities) +
                    '. Datas e valores: ' + yes(comparison.exactDatesAndCents) +
                    '. Descrições e status: ' + yes(comparison.exactDescriptionsAndStatuses) +
                    '. ' + (comparison.matched ? 'Histórico comparado sem divergências nesses campos. ' :
                    'Diferenças identificadas; não ativar a base única. ') +
                    'Categorias, vínculos, saldos e atualização bancária ainda exigem conferência independente.' });
        }
        catch {
            this.setState({ cloudParityBusy: false,
                cloudParityMessage: 'Não foi possível comparar os históricos. O SQLite original permanece intacto.' });
        }
    }
    async restoreDB() {
        if (!(desktop === null || desktop === void 0 ? void 0 : desktop.restoreSQLite) || this.state.busy || this.state.bankBusy)
            return;
        try {
            const result = await desktop.restoreSQLite();
            if (result === null || result === void 0 ? void 0 : result.ok)
                this.flash('Seus dados foram restaurados. Confira seus saldos e categorias.');
        }
        catch (e) {
            this.flash('Não foi possível restaurar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async openBackupsFolder() { if (!(desktop === null || desktop === void 0 ? void 0 : desktop.openBackupsFolder))
        return; try {
        const err = await desktop.openBackupsFolder();
        if (err)
            this.flash('Não foi possível abrir as cópias: ' + err);
    }
    catch (e) {
        this.flash('Não foi possível abrir a pasta de cópias.');
    } }
    async openDataDir() { if (!desktop)
        return; try {
        const err = await desktop.openDataFolder();
        if (err)
            this.flash('Não foi possível abrir a pasta: ' + err);
    }
    catch (e) {
        this.flash('Não foi possível abrir a pasta de dados.');
    } }
    async refreshPlanning() { if (!(desktop === null || desktop === void 0 ? void 0 : desktop.planOverview))
        return; try {
        const planning = await desktop.planOverview({ month: this.state.planMonth, start: iso(new Date()), end: endOfMonth(this.state.planMonth), includeEstimatedIncome: this.state.planIncludeEstimated });
        this.setState({ planning });
    }
    catch (e) {
        this.flash('Não foi possível atualizar o planejamento: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
    } }
    async executePlan(action, message) { if (!desktop || this.state.mode === 'demo' || this.state.planBusy)
        return; this.setState({ planBusy: true }); try {
        await action();
        await this.refreshPlanning();
        this.setState({ planBusy: false, planOpen: false });
        if (message)
            this.flash(message);
    }
    catch (e) {
        this.setState({ planBusy: false });
        this.flash('Não foi possível concluir: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
    } }
    openPlan(item, kind = 'expense') { if (this.state.mode === 'demo')
        return this.flash('O planejamento fica disponível nos seus dados pessoais.'); const f = item ? { id: item.id, title: item.title, kind: item.kind, amount: moneyString(item.amount), dueDate: item.dueDate, category: item.category, accountId: item.accountId || '', notes: item.notes || '', certainty: item.certainty, mode: 'once', count: '1' } : freshPlanForm(kind, this.state.planDay); this.setState({ planForm: f, planOpen: true }); }
    async savePlan() { const f = this.state.planForm; const v = parseMoney(f.amount); if (!Number.isSafeInteger(v) || v <= 0)
        return this.flash('Informe um valor maior que zero.'); if (!f.title.trim())
        return this.flash('Dê um nome ao lançamento.'); const data = { ...f, amount: v, accountId: f.accountId || null, count: Number(f.count) }; await this.executePlan(() => f.id ? desktop.planEdit(data) : desktop.planCreate(data), f.id ? 'Planejamento atualizado.' : 'Compromisso adicionado.'); }
    canPlanSimulatedPurchase(out = this.state.outcome) {
        return !!desktop && this.state.mode === 'real' && out === this.state.outcome &&
            !!out && !out.error && out.engine === 'planning' &&
            !this.state.simBusy && !this.state.simError && !this.isSimulationStale() &&
            !!this.state.simCalculatedInput &&
            simInputsEqual(this.state.sim, this.state.simCalculatedInput);
    }
    planSimulatedPurchase() {
        const out = this.state.outcome;
        if (!out || out.error || out.engine !== 'planning' || this.state.mode !== 'real' || !desktop)
            return;
        if (!this.canPlanSimulatedPurchase(out)) {
            this.flash('O resultado anterior é apenas uma referência. Recalcule a simulação antes de planejar esta compra.');
            return;
        }
        const count = Number(out.installments);
        if (!Number.isInteger(count) || count < 1 || count > 36) {
            this.flash('O planejamento aceita até 36 parcelas. Ajuste a simulação antes de registrar.');
            return;
        }
        const first = out.firstDueDate;
        if (!first || first < iso(new Date())) {
            this.flash('O primeiro vencimento precisa ser hoje ou uma data futura.');
            return;
        }
        const total = out.total;
        if (!Number.isSafeInteger(total) || total <= 0)
            return;
        if (!confirm('Criar ' + (count === 1 ? 'uma compra prevista de ' : 'um compromisso com ' + count + ' parcelas totalizando ') + fmt(total) + '? Nenhum pagamento será realizado.'))
            return;
        const month = first.slice(0, 7);
        this.setState({ page: 'planning', txOrganize: false, txReviewOnly: false, outcome: null,
            planMonth: month >= nowYM && month <= shiftMonth(nowYM, 12) ? month : this.state.planMonth,
            planDay: first, planForm: { ...freshPlanForm('expense', first), title: 'Compra planejada', amount: moneyString(total),
                mode: count === 1 ? 'once' : 'installments', count: String(count), category: 'Compras',
                notes: 'Simulação: valor original ' + fmt(out.principal) + '; juros estimados ' + fmt(out.interest) + '. Confirme os valores antes de salvar.' }, planOpen: true }, () => void this.refreshPlanning());
    }
    async changePlanStatus(id, status) { const question = status === 'cancelled' ? 'Cancelar este compromisso?' : status === 'settled_manual' ? 'Marcar como pago/recebido sem vínculo? Confirme apenas se o valor já está refletido no saldo atual.' : status === 'planned' ? 'Voltar este compromisso para pendente?' : 'Confirmar alteração?'; if (!confirm(question))
        return; await this.executePlan(() => desktop.planStatus(id, status), 'Situação atualizada.'); }
    async linkPlan(itemId, bank) { if (!confirm('Vincular esta movimentação confirmada ao compromisso planejado? O pagamento não será contabilizado duas vezes.'))
        return; await this.executePlan(() => desktop.planLink({ itemId, accountId: bank.accountId, externalId: bank.id }), 'Pagamento vinculado.'); }
    async unlinkPlan(itemId, link) { if (!confirm('Desfazer este vínculo?'))
        return; await this.executePlan(() => desktop.planUnlink({ itemId, ...link }), 'Vínculo desfeito.'); }
    async rejectPlanSuggestion(s) { await this.executePlan(() => desktop.planReject(s), 'Sugestão ignorada.'); }
    async renameBankInPlanning(bank) { await this.executePlan(async () => { const result = await desktop.planRename({ accountId: bank.accountId, externalId: bank.id, title: this.state.planBankTitle }); this.setState({ bank: { ...this.state.bank, data: result.data } }); }, 'Nome personalizado salvo.'); }
    openPlanDetail(id) { const item = this.state.planning.items.find(i => i.id === id); if (!item)
        return; this.setState({ planSelected: 'plan:' + id, planHistory: [] }); if (desktop === null || desktop === void 0 ? void 0 : desktop.planHistory)
        desktop.planHistory(id).then(history => this.setState({ planHistory: history })).catch(() => { }); }
    openPlanBankDetail(bank) { this.setState({ planSelected: 'bank:' + bank.accountId + '|' + bank.id, planBankTitle: bank.customTitle || bank.merchant || '', planMatchQuery: '' }); }
    changePlanMonth(offset) { const candidate = shiftMonth(this.state.planMonth, offset); if (candidate < nowYM || candidate > shiftMonth(nowYM, 12))
        return; const date = candidate === nowYM ? iso(new Date()) : candidate + '-01'; this.setState({ planMonth: candidate, planDay: date }, () => void this.refreshPlanning()); }
    renderPlanning() { return renderPlanningView(this); }
    renderPlanModal() { return renderPlanEditor(this); }
    renderPlanDetail() { return renderPlanDrawer(this); }
    openIntelligenceContext(page = this.state.page) { this.setState({ intelligencePanelOpen: true, intelligenceContext: page, intelligenceContextSnapshot: intelligencePageScope(this, page), detail: null, planSelected: null }); }
    navigate(page) {
        this.simRequest++;
        const target = page === 'review' || page === 'categories' ? 'transactions' : page === 'simulator' ? 'assistant' : page;
        const span = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const newMonth = span.end.slice(0, 7), useMonth = newMonth >= nowYM && newMonth <= shiftMonth(nowYM, 12);
        const enteringPlan = target === 'planning' && this.state.page !== 'planning' && useMonth;
        this.setState({ page: target, txReviewOnly: page === 'review', txOrganize: page === 'categories', quickAddOpen: false, quickCategory: null,
            month: newMonth, ...(enteringPlan ? { planMonth: newMonth, planDay: newMonth === nowYM ? iso(new Date()) : newMonth + '-01' } : {}),
            showEntry: false, outcome: null, simBusy: false }, () => { if (enteringPlan)
            void this.refreshPlanning(); });
        if (target === 'intelligence' || target === 'settings')
            void intelligenceRefresh(this);
        if (page === 'settings' && (desktop === null || desktop === void 0 ? void 0 : desktop.backupStatus))
            void desktop.backupStatus().then(backupInfo => this.setState({ backupInfo })).catch(() => { });
    }
    setSharedPeriod(mode, start, end) {
        const customStart = start || this.state.customStart, customEnd = end || this.state.customEnd;
        const range = dateSpan(mode, customStart, customEnd);
        this.setState({ overviewPeriod: mode, customStart, customEnd, month: range.end.slice(0, 7) });
    }
    setSharedMonth(month) {
        this.setState({ overviewPeriod: 'custom', customStart: firstOfMonth(month), customEnd: endOfMonth(month), month });
    }
    openQuickEntry(kind) {
        this.setState({ showEntry: true, quickAddOpen: false, entryCategoryTouched: false,
            entry: { ...this.state.entry, kind, category: kind === 'income' ? 'Salário' : 'Outros', date: iso(new Date()) } });
    }
    async markBankReviewed(tx) {
        const key = tx.accountId + '|' + tx.id;
        if (tx.reviewed || this.state.detailBusy || this.reviewSavingKeys.has(key))
            return;
        this.reviewSavingKeys.add(key);
        try {
            await this.runBankOperation('bankBatch', { items: [{ accountId: tx.accountId, externalId: tx.id }], reviewed: true }, 'Movimentação revisada.');
        }
        finally {
            this.reviewSavingKeys.delete(key);
        }
    }
    clearMovementFilters() {
        this.setState({ query: '', bankFilter: '', txSource: 'all', txCategoryFilter: '',
            txKindFilter: 'all', txReviewFilter: 'all', txSort: 'date_desc', overviewPeriod: 'month',
            txSelected: [], quickCategory: null });
    }
    renderMovements() {
        const count = this.state.bank.data.transactions.filter(t => !t.reviewed).length;
        const review = this.state.txReviewOnly, organized = this.state.txOrganize;
        return h('div', { className: 'movement-shell' }, h('div', { className: 'mf-tx-tabs mf-unified-tabs', role: 'group', 'aria-label': 'Seções de movimentações' }, h('button', { type: 'button', className: !review && !organized ? 'active' : '', onClick: () => this.setState({ txReviewOnly: false, txOrganize: false, txSelected: [] }) }, 'Histórico'), h('button', { type: 'button', className: review ? 'active' : '', onClick: () => this.setState({ txReviewOnly: true, txOrganize: false, txSelected: [] }) }, 'A revisar (' + count + ')'), h('button', { type: 'button', className: organized ? 'active' : '', onClick: () => this.setState({ txOrganize: true, txReviewOnly: false, txSelected: [] }) }, 'Categorias e regras')), organized ? this.renderCategories() : this.renderTransactions());
    }
    monthData() { return snapshot(this.state.data, this.state.month); }
    async saveEntry() { const f = this.state.entry, v = parsePositiveBRLInput(f.value); if (!f.description.trim())
        return this.flash('Informe uma descrição.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || iso(fromISO(f.date)) !== f.date)
        return this.flash('Informe uma data válida.'); if (!Number.isSafeInteger(v) || v <= 0)
        return this.flash('Valor inválido. Use reais e no máximo duas casas decimais (ex.: 1.234,56).'); const t = { id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), date: f.date, description: f.description.trim().slice(0, 150), category: f.category, kind: f.kind, amount: v, origin: 'manual' }; if (await this.updateData({ ...this.state.data, transactions: [...this.state.data.transactions, t] }, 'Lançamento registrado.'))
        this.setState({ showEntry: false, entryCategoryTouched: false, entry: { ...f, description: '', value: '' } }); }
    async removeEntry(id) {
        const found = this.state.data.transactions.find(t => t.id === id);
        if (!found || this.state.busy || this.writeInProgress)
            return false;
        if (this.isManualLinked(id)) {
            this.flash('Este lançamento está vinculado a um extrato bancário. Desvincule antes de excluir.');
            return false;
        }
        if (!confirm('Excluir permanentemente este lançamento manual? A movimentação bancária não será modificada.'))
            return false;
        const result = await this.updateData({ ...this.state.data, transactions: this.state.data.transactions.filter(t => t.id !== id) }, 'Lançamento removido.');
        if (result)
            this.setState({ detail: null, manualDraft: null });
        return result;
    }
    async setBudget(cat, s) {
        const value = String(s || '').trim();
        const v = value === '' ? null : parseMoney(value);
        if (v !== null && (!Number.isSafeInteger(v) || v < 0)) {
            this.flash('Informe um limite válido.');
            return false;
        }
        const budgets = { ...this.state.data.budgets };
        if (v === null)
            delete budgets[cat];
        else
            budgets[cat] = v;
        const saved = await this.updateData({ ...this.state.data, budgets }, v === null ? 'Limite removido.' : 'Limite atualizado.');
        if (saved)
            this.setState({ budgetEdit: '' });
        return saved;
    }
    async setSetting(k, s) { const v = parseMoney(s); if (!Number.isFinite(v) || Math.abs(v) > 100000000000 || ((k !== 'opening') && v < 0)) {
        this.flash('Valor inválido.');
        return false;
    } return this.updateData({ ...this.state.data, settings: { ...this.state.data.settings, [k]: v } }, 'Configuração salva.'); }
    exportJSON() { const blob = new Blob([JSON.stringify({ ...this.state.data, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }); download(blob, 'meu-financeiro-backup-' + this.state.mode + '-' + iso(new Date()) + '.json'); this.flash('Backup exportado. Guarde o arquivo em local seguro.'); }
    exportCSV() { const s = ['data;descricao;tipo;valor;categoria', ...this.state.data.transactions.map(t => [t.date, '"' + t.description.replace(/"/g, '""') + '"', t.kind, moneyString(t.amount), t.category].join(';'))].join('\r\n'); download(new Blob(['\ufeff' + s], { type: 'text/csv;charset=utf-8' }), 'meu-financeiro-extrato.csv'); }
    async importJSON(file) { try {
        const d = safeData(JSON.parse(await file.text()));
        if (!confirm('Substituir todos os dados do modo ' + (this.state.mode === 'real' ? 'pessoal' : 'demonstração') + ' pelo backup selecionado?'))
            return;
        this.updateData(d, 'Backup restaurado.');
    }
    catch (e) {
        this.flash('Não foi possível importar o backup: ' + e.message);
    } }
    async importCSV(file) {
        try {
            const bytes = await file.text();
            let lines = bytes.replace(/^\ufeff/, '').trim().split(/\r?\n/);
            if (lines.length < 2)
                throw new Error('Arquivo vazio.');
            const separator = lines[0].includes(';') ? ';' : ',';
            const header = splitCSV(lines.shift() || '', separator).map(x => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
            const find = (...aliases) => header.findIndex(x => aliases.includes(x));
            const di = find('data', 'date'), de = find('descricao', 'historico', 'description'), va = find('valor', 'amount'), ca = find('categoria', 'category'), ki = find('tipo', 'kind');
            if (di < 0 || de < 0 || va < 0)
                throw new Error('Use colunas data, descricao e valor.');
            const found = new Set(this.state.data.transactions.map(x => [x.date, x.description, x.kind, x.amount].join('|')));
            const add = [];
            for (const [i, line] of lines.entries()) {
                if (!line.trim())
                    continue;
                const row = splitCSV(line, separator);
                let date = (row[di] || '').trim();
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
                    let [d, m, y] = date.split('/');
                    date = y + '-' + m + '-' + d;
                }
                let value = parseMoney(row[va] || '');
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || value === 0)
                    throw new Error('Linha ' + (i + 2) + ' com data ou valor inválido.');
                const description = (row[de] || '').trim();
                if (!description)
                    throw new Error('Linha ' + (i + 2) + ' sem descrição.');
                const csvKind = (row[ki] || '').trim().toLowerCase();
                const kind = ['expense', 'despesa', 'saida', 'saída'].includes(csvKind) ? 'expense' : (['income', 'receita', 'entrada'].includes(csvKind) ? 'income' : (value >= 0 ? 'income' : 'expense'));
                const tr = { id: 'csv-' + Date.now() + '-' + i, date, description, kind, amount: Math.abs(value), category: (this.getCategories().some(c => c.name === (row[ca] || '').trim()) ? (row[ca] || '').trim() : (findCategoryRule(description, 'manual', this.state.rules) || 'Outros')), origin: 'csv' };
                const key = [tr.date, tr.description, tr.kind, tr.amount].join('|');
                if (!found.has(key)) {
                    found.add(key);
                    add.push(tr);
                }
            }
            this.updateData({ ...this.state.data, transactions: [...this.state.data.transactions, ...add] }, add.length + ' novos lançamentos importados.');
        }
        catch (e) {
            this.flash('CSV: ' + e.message);
        }
    }
    setSimulation(patch) {
        const next = { ...this.state.sim, ...patch };
        if (simInputsEqual(this.state.sim, next))
            return;
        this.simRequest++;
        this.setState({ sim: next, simBusy: false, simError: '',
            simResultStale: !!this.state.outcome });
    }
    isSimulationStale() {
        return !!this.state.outcome &&
            (!!this.state.simResultStale || !simInputsEqual(this.state.sim, this.state.simCalculatedInput));
    }
    saveSimulation() {
        const out = this.state.outcome;
        if (!u3SimulationCost(out) || this.isSimulationStale() || this.state.simBusy || this.state.simError)
            return;
        const calculated = this.state.simCalculatedInput;
        if (!calculated)
            return;
        this.setState({ simSaved: { result: JSON.parse(JSON.stringify(out)), input: { ...calculated } } });
    }
    async runSim() {
        const token = ++this.simRequest, input = { ...this.state.sim };
        const amount = parseMoney(input.value), n = Number(input.installments), rate = Number(input.interest.trim().replace(',', '.'));
        const invalid = (message) => {
            if (token !== this.simRequest)
                return;
            this.setState({ simBusy: false, simError: message, simResultStale: !!this.state.outcome });
        };
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            invalid('Informe um valor válido para a compra.');
            return;
        }
        if (!Number.isInteger(n) || n < 1 || n > 60 || !Number.isFinite(rate) || rate < 0 || rate > 30) {
            invalid('Confira as parcelas e a taxa de juros (0 a 30% ao mês).');
            return;
        }
        this.setState({ simBusy: true, simError: '', simResultStale: !!this.state.outcome });
        try {
            const result = (!desktop || this.state.mode === 'demo') ?
                simulate(this.state.data, input) :
                await desktop.planSimulate({ amount, installments: n, monthlyRate: rate,
                    firstDueDate: input.firstDueDate || null, includeEstimatedIncome: false });
            if (token !== this.simRequest || !simInputsEqual(this.state.sim, input))
                return;
            if (result === null || result === void 0 ? void 0 : result.error) {
                invalid(String(result.error));
                return;
            }
            this.setState({ outcome: result, simCalculatedInput: input, simResultStale: false,
                simBusy: false, simError: '' });
        }
        catch (e) {
            invalid('Não foi possível simular: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    field(label, el, hint) { return h('label', { className: 'field' }, h('span', {}, label), el, hint ? h('small', {}, hint) : null); }
    navItem(page, icon, label) { return h('button', { key: page, type: 'button', 'aria-label': label, 'aria-current': this.state.page === page ? 'page' : undefined, title: label, className: 'nav-item ' + (this.state.page === page ? 'active' : ''), onClick: () => this.navigate(page) }, h(Icon, { name: icon, size: 19 }), h('span', {}, label)); }
    renderSide() {
        var _a;
        return h('aside', { className: 'sidebar' }, h('div', { className: 'brand' }, h(Logo), h('div', { className: 'brand-text' }, h('strong', {}, 'Meu Financeiro'), h('small', {}, 'CONTROLE DO SEU DINHEIRO'))), h('div', { className: 'side-label' }, 'CONTROLE'), h('nav', {}, this.navItem('overview', 'home', 'Visão geral'), this.navItem('transactions', 'wallet', 'Movimentações'), this.navItem('planning', 'calendar', 'Planejamento'), this.navItem('banks', 'bank', 'Minhas contas'), h('div', { className: 'side-label mf-ai-side-label' }, 'ORGANIZAÇÃO'), this.navItem('budgets', 'pie', 'Orçamentos'), h('div', { className: 'side-label mf-ai-side-label' }, 'FERRAMENTAS'), this.navItem('assistant', 'cart', 'Simular compra'), this.navItem('intelligence', 'spark', 'Inteligência')), h('div', { className: 'side-bottom' }, this.navItem('settings', 'settings', 'Configurações'), h('label', { className: 'mf-appearance' }, h('span', {}, 'Aparência'), h('select', { 'aria-label': 'Tema do aplicativo', 'data-appearance': 'select', defaultValue: ((_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.get()) || 'system', onChange: (e) => { var _a; return (_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.set(e.target.value); } }, h('option', { value: 'light' }, 'Claro'), h('option', { value: 'dark' }, 'Escuro'), h('option', { value: 'system' }, 'Sistema'))), h('div', { className: 'privacy-note' }, h(Icon, { name: 'shield', size: 19 }), h('div', {}, h('b', {}, 'Privado e local'), h('small', {}, 'Dados sob seu controle'))), h('button', { className: 'demo-btn', onClick: () => this.toggleMode() }, h(Icon, { name: this.state.mode === 'real' ? 'spark' : 'home', size: 18 }), this.state.mode === 'real' ? 'Explorar demonstração' : 'Voltar aos meus dados'), h('small', { className: 'app-version' }, 'Meu Financeiro · v0.9.5-beta.8')));
    }
    renderWorkspaceBar() {
        const labels = { overview: 'Visão geral', transactions: 'Movimentações', planning: 'Planejamento', budgets: 'Orçamentos', assistant: 'Simular compra', banks: 'Minhas contas', settings: 'Configurações', intelligence: 'Inteligência' };
        return h('div', { className: 'mf-workspace-bar' }, h('nav', { 'aria-label': 'Localização' }, h('span', {}, 'Meu Financeiro'), h('span', { 'aria-hidden': 'true' }, '/'), h('strong', {}, labels[this.state.page] || 'Visão geral')), h('span', { className: 'mode-tag ' + (this.state.mode === 'demo' ? 'mode-demo' : '') }, h('i', {}), this.state.mode === 'demo' ? 'DEMONSTRAÇÃO' : 'PRIVADO'));
    }
    renderTop() {
        var _a;
        const labels = { overview: 'Visão geral', planning: 'Planejamento', transactions: 'Movimentações',
            budgets: 'Orçamentos', assistant: 'Simular compra', settings: 'Configurações', banks: 'Minhas contas', intelligence: 'Inteligência' };
        const period = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const months = Array.from({ length: 45 }, (_, i) => shiftMonth(nowYM, 3 - i)).map(m => ({ value: m, label: prettyMonth(m) }));
        const configured = this.state.mode === 'real' && this.state.bank.config.configured;
        const last = (_a = this.state.bank.data.last) === null || _a === void 0 ? void 0 : _a.completedAt;
        const periodControl = (this.state.page === 'overview' || this.state.page === 'transactions' && !this.state.txReviewOnly && !this.state.txOrganize);
        return h('header', { className: 'topbar' }, h('div', { className: 'top-left' }, h('div', { className: 'page-kicker' }, 'FINANÇAS PESSOAIS / ' + (labels[this.state.page] || '').toUpperCase()), h('h1', {}, labels[this.state.page]), h('p', {}, this.state.page === 'overview' ? 'Saldo, receitas e despesas do período selecionado.' :
            this.state.page === 'assistant' ? 'Compare o custo e o impacto das parcelas.' : this.state.page === 'intelligence' ? 'Prévia de insights e ferramentas de análise.' : this.state.page === 'transactions' ? 'Visualize e organize suas movimentações.' : this.state.page === 'banks' ? 'Saldos e referências das suas contas.' : this.state.page === 'settings' ? 'Preferências e dados do aplicativo.' : 'Acompanhe seus registros.')), h('div', { className: 'header-actions' }, this.state.page === 'overview' ? h('div', { className: 'mf-quick-add' }, h('button', { className: 'primary-button mf-quick-trigger', 'aria-expanded': this.state.quickAddOpen,
            onClick: () => this.setState({ quickAddOpen: !this.state.quickAddOpen }) }, h(Icon, { name: 'plus', size: 16 }), 'Adicionar'), this.state.quickAddOpen ? h('div', { className: 'mf-quick-menu' }, h('button', { onClick: () => this.openQuickEntry('expense') }, 'Nova despesa'), h('button', { onClick: () => this.openQuickEntry('income') }, 'Nova receita'), h('button', { onClick: () => { this.setState({ quickAddOpen: false }); this.openPlan(undefined, 'expense'); } }, 'Compromisso futuro')) : null) : this.state.page === 'transactions' ? h('button', { type: 'button', className: 'primary-button', onClick: () => this.openQuickEntry('expense') }, h(Icon, { name: 'plus', size: 16 }), 'Novo lançamento') : null, periodControl ? h('div', { className: 'overview-period-controls' }, h(PeriodPicker, { mode: this.state.overviewPeriod, span: period, onChange: (m, a, b) => this.setSharedPeriod(m, a, b) }), this.state.page === 'overview' && configured ? h('button', { type: 'button', className: 'mf-refresh-button', disabled: this.state.bankBusy, onClick: () => this.syncBank(false),
            title: last ? 'Última consulta: ' + new Date(last).toLocaleString('pt-BR') : 'Ainda não sincronizado' }, h(Icon, { name: 'refresh', size: 16 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar') : null) :
            this.state.page === 'budgets' ? h(StyledSelect, { wrapperClass: 'month-dropdown', className: 'mf-month-trigger', value: this.state.month,
                options: months, ariaLabel: 'Mês do orçamento', onChange: (v) => this.setSharedMonth(v) }) :
                null, null));
    }
    renderSourcePicker() {
        var _a;
        const bankAvailable = this.state.mode === 'real' && this.state.bank.data.accounts.length > 0;
        const selected = bankAvailable && this.state.dashboardSource === 'bank' ? 'bank' : 'manual';
        const last = (_a = this.state.bank.data.last) === null || _a === void 0 ? void 0 : _a.completedAt;
        const age = last ? Date.now() - new Date(last).getTime() : null;
        const stale = bankAvailable && selected === 'bank' && (age === null || age > 48 * 3600000);
        const label = selected === 'bank' ? 'Contas conectadas' : 'Adicionado por você';
        return h('div', { className: 'mf-source-compact' }, h('button', { type: 'button', className: 'mf-source-trigger', 'aria-expanded': this.state.sourceDetailsOpen,
            onClick: () => this.setState({ sourceDetailsOpen: !this.state.sourceDetailsOpen }) }, h('span', { className: 'mf-source-dot ' + (stale ? 'stale' : '') }), h('span', {}, label + (selected === 'bank' && last ? ' · consultado ' + new Date(last).toLocaleDateString('pt-BR') : '')), h(Icon, { name: 'chevron-down', size: 15 })), this.state.sourceDetailsOpen ? h('div', { className: 'mf-source-panel' }, h('b', {}, 'Dados dos indicadores'), h('p', {}, 'Escolha qual histórico consultar. Os dois conjuntos não são somados para evitar lançamentos duplicados.'), h('div', { className: 'mf-source-choice' }, bankAvailable ? h('button', { className: selected === 'bank' ? 'active' : '', onClick: () => this.setState({ dashboardSource: 'bank', sourceDetailsOpen: false }) }, 'Contas conectadas') : null, h('button', { className: selected === 'manual' ? 'active' : '', onClick: () => this.setState({ dashboardSource: 'manual', sourceDetailsOpen: false }) }, 'Adicionado por você')), selected === 'bank' && last ? h('small', {}, 'Última consulta realizada em ' + new Date(last).toLocaleString('pt-BR') + '. O banco pode atualizar as movimentações com atraso.') : null, selected === 'bank' && stale ? h('small', { className: 'bad-text' }, 'Atenção: dados bancários antigos ou ainda não sincronizados.') : null) : null);
    }
    renderOverview() {
        var _a;
        const state = this.state, d = state.data, bank = state.bank, period = dateSpan(state.overviewPeriod, state.customStart, state.customEnd), { start, end } = period;
        const useBank = state.mode === 'real' && state.dashboardSource === 'bank' && bank.data.accounts.length > 0;
        const range = (start, end) => useBank ? bankSnapshotBetween(bank, start, end) : snapshotBetween(d, start, end), s = range(start, end), coverage = useBank ? bankBalanceCoverage(bank.data.accounts) : null;
        const hidden = !!state.overviewHideValues, money = (v) => hidden ? '••••' : fmt(v), date = (v) => v.slice(8) + '/' + v.slice(5, 7), today = iso(new Date());
        const previous = overviewPriorRange(start, end, state.overviewPeriod), prior = range(previous.start, previous.end);
        const dates = (useBank ? (((_a = bank.data.dailyTotals) === null || _a === void 0 ? void 0 : _a.length) ? bank.data.dailyTotals : bank.data.transactions) : d.transactions).map(x => x.date).filter(Boolean).sort();
        const compareAvailable = !!dates.length && dates[0] <= previous.start && (!useBank || !bank.data.truncated) && end <= today;
        const comparison = overviewComparison(s.expense, prior.expense, compareAvailable), points = overviewCumulative(start, end, range, compareAvailable ? previous : null);
        const due = pendingDashboardItems(state.planning.items), upcoming = due.filter(x => x.dueDate <= advanceDate(today, 6)), overdue = due.filter(x => x.dueDate < today);
        const generated = !!state.planning.generatedAt, month = end.slice(0, 7), budget = range(firstOfMonth(month), endOfMonth(month));
        const limits = this.getCategories().filter(c => c.kind !== 'income' && Object.prototype.hasOwnProperty.call(d.budgets, c.name)).map(info => { var _a; return ({ info, limit: d.budgets[info.name], hasLimit: true, total: ((_a = budget.categories.find(c => c.name === info.name)) === null || _a === void 0 ? void 0 : _a.total) || 0 }); }).sort(budgetPresentationOrder);
        const totalLimit = limits.reduce((n, c) => n + c.limit, 0), spentLimited = limits.reduce((n, c) => n + c.total, 0), budgetCoverage = overviewCoverage(budget.expense, spentLimited), used = totalLimit > 0 ? Math.round(spentLimited / totalLimit * 100) : spentLimited > 0 ? 100 : 0;
        const recent = useBank ? bank.data.transactions.filter(x => x.date >= start && x.date <= end && x.status === 'POSTED' && ['income', 'expense'].includes(effectiveNature(x))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(x => ({ key: x.accountId + '|' + x.id, title: x.customTitle || x.merchant || x.description, original: x.description, date: x.date, category: x.category, amount: Math.abs(x.amount), kind: effectiveNature(x), raw: x })) : d.transactions.filter(x => x.date >= start && x.date <= end).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(x => ({ key: x.id, title: x.description, original: '', date: x.date, category: x.category, amount: x.amount, kind: x.kind, raw: x }));
        const openBudget = () => { this.setState({ month }); this.navigate('budgets'); };
        const palette = ['#8066d5', '#329b89', '#d29844', '#5a8fc9', '#c7759c'];
        const categoryColor = (name, index) => { const info = this.getCategories().find(c => c.name === name); return info && (!info.builtIn || info.color.toLowerCase() !== '#3e9a85') ? info.color : palette[index]; };
        const metric = (label, value, icon, hint, tone) => h('section', { className: 'u1-metric mf-border-reveal mf-tone-' + (tone === 'net' ? 'net' : tone) + ' ' + tone + (tone === 'net' ? (value > 0 ? ' is-positive' : value < 0 ? ' is-negative' : ' is-neutral') : ''), role: 'group', tabIndex: 0, 'aria-label': label + ' · ' + money(value) }, h('div', { className: 'u1-metric-label' }, h(Icon, { name: icon, size: 16 }), label), h('strong', {}, money(value)), h('small', {}, hint));
        return h('div', { className: 'overview-content u1-overview ' + (hidden ? 'u1-values-hidden' : '') }, h('div', { className: 'u1-context' }, this.renderSourcePicker(), h('span', {}, date(start) + ' — ' + date(end) + ' · ' + (useBank ? 'Movimentos confirmados' + (bank.data.truncated ? ' · histórico parcial' : '') : 'Registros manuais'))), state.bankMessage && bank.config.configured ? h('div', { className: 'sync-feedback', role: 'status' }, state.bankMessage) : null, h('div', { className: 'stats-grid' }, h('section', { className: 'u1-balance mf-border-reveal mf-tone-balance', role: 'group', tabIndex: 0, 'aria-label': useBank ? 'Saldo nas contas' : 'Saldo manual' }, h('div', { className: 'u1-balance-label' }, h('span', {}, useBank ? 'Saldo nas contas' : 'Saldo manual'), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': hidden ? 'Mostrar valores' : 'Ocultar valores', 'aria-pressed': hidden, onClick: () => this.setState({ overviewHideValues: !hidden }) }, h(Icon, { name: hidden ? 'eye-off' : 'eye', size: 18 }))), h('strong', { className: 'u1-balance-value' }, hidden ? '••••' : coverage ? bankBalanceLabel(coverage) : money(s.balance)), h('details', { className: 'u1-balance-info' }, h('summary', {}, h('span', { className: 'u1-status-dot ' + ((coverage === null || coverage === void 0 ? void 0 : coverage.missingCount) ? 'is-partial' : '') }), (coverage === null || coverage === void 0 ? void 0 : coverage.missingCount) ? 'Saldo parcial · conferir' : useBank ? 'Referência das instituições' : 'Como é calculado'), h('p', {}, coverage ? 'Saldos disponíveis de ' + coverage.knownCount + ' de ' + coverage.totalCount + ' conta(s). Não representa dinheiro livre. A consulta pode ser mais recente que o saldo informado.' : 'Saldo inicial mais receitas menos despesas manuais. Não somado ao banco.'))), metric('Receitas', s.income, 'trend', 'No período selecionado', 'income'), metric('Despesas', s.expense, 'down', 'No período selecionado', 'expense'), metric('Resultado', s.net, 'chart', 'Receitas menos despesas', 'net')), h('div', { className: 'u1-main-grid' }, h('div', { className: 'u1-left-stack' }, h('section', { className: 'u1-panel u1-rhythm' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Seu ritmo de gastos'), h('p', {}, 'Entenda como suas despesas evoluíram.')), h('div', { className: 'u1-chart-tabs', role: 'group', 'aria-label': 'Visualização do período' }, ['spending', 'flow'].map(tab => h('button', { type: 'button', key: tab, 'aria-pressed': (state.overviewChart || 'spending') === tab, onClick: () => this.setState({ overviewChart: tab }) }, tab === 'spending' ? 'Acumulado' : 'Entradas e saídas')))), h('div', { className: 'u1-rhythm-summary' }, h('div', {}, h('strong', {}, money(s.expense)), h('span', {}, 'gastos no período')), h('div', { className: 'u1-comparison ' + (comparison.percent !== null && comparison.percent <= 0 ? 'is-lower' : '') }, hidden ? 'Valores ocultos' : comparison.label, h('small', {}, compareAvailable ? date(previous.start) + ' a ' + date(previous.end) + ' · mesma fonte' : 'Comparação exige histórico disponível nos dois intervalos'))), hidden ? h('div', { className: 'u1-chart-hidden' }, h(Icon, { name: 'eye-off', size: 26 }), h('p', {}, 'Mostre os valores para visualizar o gráfico.')) : (state.overviewChart || 'spending') === 'flow' ? h(Chart, { data: flowSegments(start, end, range) }) : h(OverviewSpendingChart, { rows: points, compare: compareAvailable }), h('div', { className: 'u1-chart-footer' }, h('span', {}, h('i', { className: 'u1-current-dot' }), 'Período selecionado'), compareAvailable ? h('span', {}, h('i', { className: 'u1-previous-dot' }), 'Intervalo anterior') : null, h('span', { className: 'u1-daily-average' }, 'Média diária ', h('b', {}, money(Math.round(s.expense / daysInSpan(start, end))))))), h('section', { className: 'u1-panel u1-categories' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Para onde foi seu dinheiro'), h('p', {}, 'Categorias do período selecionado')), h('span', { className: 'u1-count' }, s.categories.length + ' categorias')), s.categories.length ? h('div', { className: 'u1-category-list' }, s.categories.slice(0, 5).map((cat, i) => h('button', { type: 'button', className: 'u1-category-row', key: cat.name, onClick: () => { this.setState({ query: cat.name, txSource: useBank ? 'bank' : 'manual', txReviewOnly: false, txOrganize: false, bankFilter: '' }); this.navigate('transactions'); } }, h('span', { className: 'u1-category-dot', style: { background: categoryColor(cat.name, i) } }), h('span', { className: 'u1-category-name' }, cat.name), h('span', { className: 'u1-category-bar' }, h('i', { style: { width: hidden ? '0%' : Math.round(cat.total / Math.max(1, s.expense) * 100) + '%', background: categoryColor(cat.name, i) } })), h('strong', {}, money(cat.total)), h('small', {}, hidden ? '••••' : Math.round(cat.total / Math.max(1, s.expense) * 100) + '%')))) : h('p', { className: 'u1-empty' }, 'Nenhuma despesa nesta fonte e período.'), s.categories.length > 5 ? h('p', { className: 'u1-microcopy' }, 'Mostrando as 5 maiores categorias. Consulte todas em Movimentações.') : null)), h('aside', { className: 'u1-side-stack' }, h('section', { className: 'mf-plan-shortcut' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Na sua agenda'), h('p', {}, 'Hoje e próximos 7 dias · compromissos cadastrados')), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': 'Abrir Planejamento', onClick: () => this.navigate('planning') }, h(Icon, { name: 'arrow', size: 17 }))), generated ? h('div', { className: 'u1-agenda-stats' }, h('div', {}, h('strong', {}, overdue.length), h('span', {}, 'vencidos')), h('div', {}, h('strong', {}, money(upcoming.reduce((n, x) => n + x.remaining, 0))), h('span', {}, 'a pagar · inclui vencidos'))) : null, upcoming.length ? h('div', { className: 'mf-agenda-list' }, upcoming.slice(0, 3).map(item => h('button', { type: 'button', className: 'mf-agenda-row', key: item.id, onClick: () => this.openPlanDetail(item.id) }, h('span', { className: 'u1-agenda-date' }, date(item.dueDate)), h('span', { className: 'mf-agenda-copy' }, h('strong', {}, item.title), h('small', {}, item.dueDate < today ? 'Vencido' : item.dueDate === today ? 'Hoje' : item.certainty === 'estimated' ? 'Estimado' : 'A vencer')), h('strong', { className: 'mf-agenda-amount' }, money(item.remaining))))) : h('div', { className: 'u1-empty-agenda' }, h(Icon, { name: 'calendar', size: 22 }), h('div', {}, h('b', {}, generated ? 'Sem vencimentos cadastrados neste intervalo' : 'Agenda ainda não carregada'), h('p', {}, generated ? 'Isso não confirma a ausência de contas a pagar.' : 'Abra o Planejamento para conferir seus compromissos.'))), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => this.navigate('planning') }, 'Ver agenda', h(Icon, { name: 'arrow', size: 14 }))), h('section', { className: 'u1-panel u1-budget' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Orçamento em foco'), h('p', {}, prettyMonth(month))), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': 'Abrir Orçamentos', onClick: openBudget }, h(Icon, { name: 'arrow', size: 17 }))), h('div', { className: 'u1-budget-summary' }, h('strong', {}, money(spentLimited)), h('span', {}, 'de ' + money(totalLimit) + ' em limites')), limits.length ? h('div', { className: 'u1-budget-meter ' + (spentLimited > totalLimit ? 'is-over' : ''), role: 'img', 'aria-label': hidden ? 'Valores ocultos' : used + '% dos limites utilizados' }, h('i', { style: { width: hidden ? '0%' : Math.min(100, used) + '%' } })) : null, h('p', { className: 'u1-budget-caption' }, !limits.length ? 'Você ainda não definiu limites.' : hidden ? 'Valores ocultos' : (spentLimited > totalLimit ? money(spentLimited - totalLimit) + ' acima dos limites' : money(totalLimit - spentLimited) + ' de margem nos limites')), h('div', { className: 'u1-coverage' }, h('span', {}, 'Cobertura dos gastos'), h('b', {}, hidden ? '••••' : budgetCoverage === null ? 'Sem gastos' : budgetCoverage + '%')), h('p', { className: 'u1-microcopy' }, 'Considera apenas categorias com limite. Margem não é saldo disponível.'), h('button', { type: 'button', className: 'u1-subtle-link', onClick: openBudget }, 'Gerenciar orçamento', h(Icon, { name: 'arrow', size: 14 }))))), h('div', { className: 'u1-detail-grid' }, h('section', { className: 'u1-panel u1-recent' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Últimas movimentações'), h('p', {}, 'Confirmadas no período')), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => { this.setState({ query: '', bankFilter: '', txSource: useBank ? 'bank' : 'manual', txReviewOnly: false, txOrganize: false }); this.navigate('transactions'); } }, 'Ver tudo', h(Icon, { name: 'arrow', size: 14 }))), recent.length ? h('div', { className: 'u1-recent-list' }, recent.map(t => h('button', { type: 'button', className: 'u1-recent-row', key: t.key, onClick: () => useBank ? this.openBankDetail(t.raw) : this.openManualDetail(t.raw) }, h('span', { className: 'u1-transaction-icon ' + t.kind }, h(Icon, { name: t.kind === 'income' ? 'trend' : 'down', size: 17 })), h('span', { className: 'u1-recent-copy' }, h('strong', {}, t.title), h('small', {}, t.original && t.original !== t.title ? t.original : t.category + ' · ' + date(t.date))), h('strong', { className: t.kind === 'income' ? 'good-text' : 'bad-text' }, hidden ? '••••' : (t.kind === 'income' ? '+' : '−') + money(t.amount))))) : h('p', { className: 'u1-empty' }, 'Nenhuma movimentação confirmada neste período.')), h('section', { className: 'u1-panel u1-accounts' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, useBank ? 'Suas contas' : 'Fonte dos seus indicadores'), h('p', {}, useBank ? 'Saldo de referência por instituição · não depende do período acima' : 'Acompanhamento com registros adicionados por você')), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => this.navigate('banks') }, 'Ver contas', h(Icon, { name: 'arrow', size: 14 }))), useBank ? h('div', { className: 'u1-accounts-grid' }, bank.data.accounts.map(account => h('button', { type: 'button', className: 'u1-account', key: account.id, onClick: () => { this.setState({ bankFilter: account.id, query: '', txSource: 'bank', txReviewOnly: false, txOrganize: false }); this.navigate('transactions'); } }, h('span', { className: 'u1-account-icon' }, h(Icon, { name: 'bank', size: 19 })), h('span', { className: 'u1-account-copy' }, h('b', {}, account.name), h('small', {}, 'Referência: ' + bankReferenceLabel(account.updatedAt))), h('strong', {}, Number.isFinite(account.balance) ? money(account.balance) : 'Indisponível')))) : h('p', { className: 'u1-microcopy' }, 'Os registros manuais e o extrato bancário são consultados separadamente para evitar duplicidades.'))), null);
    }
    renderTransactions() {
        var _a;
        const review = this.state.txReviewOnly, rows = this.state.mode === 'demo' ? [] : this.state.bank.data.transactions;
        const filtered = transactionViewRows(this.state), shown = filtered.slice(0, 500), count = rows.filter(t => !t.reviewed).length;
        const hasBank = filtered.some(t => t.origin === 'bank'), hasManual = filtered.some(t => t.origin === 'manual');
        const source = hasBank && hasManual ? (this.state.txSummarySource || 'bank') : hasManual ? 'manual' : 'bank';
        const summary = transactionViewSummary(filtered, source), span = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const partialBank = this.state.mode !== 'demo' && !!this.state.bank.data.truncated;
        const cats = this.getCategories();
        const selected = this.state.txSelected;
        const active = [];
        const add = (key, label, patch) => active.push({ key, label, clear: () => this.setState({ ...patch, txSelected: [], quickCategory: null }) });
        if (this.state.query.trim())
            add('query', 'Busca: ' + this.state.query.trim().slice(0, 32), { query: '' });
        if (this.state.txSource !== 'all' && !review)
            add('origin', this.state.txSource === 'bank' ? 'Origem: banco' : 'Origem: manual', { txSource: 'all' });
        if (this.state.bankFilter) {
            const account = this.state.bank.data.accounts.find(a => a.id === this.state.bankFilter);
            add('account', 'Conta: ' + ((account === null || account === void 0 ? void 0 : account.name) || 'Selecionada'), { bankFilter: '' });
        }
        if (this.state.txCategoryFilter)
            add('category', 'Categoria: ' + this.state.txCategoryFilter, { txCategoryFilter: '' });
        if (this.state.txKindFilter && this.state.txKindFilter !== 'all')
            add('kind', this.state.txKindFilter === 'income' ? 'Receitas' : 'Despesas', { txKindFilter: 'all' });
        if (!review && this.state.txReviewFilter && this.state.txReviewFilter !== 'all')
            add('review', this.state.txReviewFilter === 'pending' ? 'A conferir' : 'Revisadas', { txReviewFilter: 'all' });
        if (this.state.txSort && this.state.txSort !== 'date_desc')
            add('sort', this.state.txSort === 'date_asc' ? 'Data mais antiga' :
                this.state.txSort === 'amount_desc' ? 'Maior valor' : 'Menor valor', { txSort: 'date_desc' });
        if (!review && this.state.overviewPeriod !== 'month')
            add('period', 'Período: ' + pDate(span.start) + ' a ' + pDate(span.end), { overviewPeriod: 'month' });
        return h('div', { className: 'section mf-tx-section u2-transactions' }, !review && ((_a = this.state.bank.data.suspectedDuplicates) === null || _a === void 0 ? void 0 : _a.length) ? h(Card, { className: 'mf-duplicate-banner' }, h('div', {}, h('b', {}, 'Possíveis movimentações repetidas (' + this.state.bank.data.suspectedDuplicates.length + ')'), h('p', {}, 'Encontramos registros semelhantes em conexões diferentes. Confira antes de revisar: os valores não foram removidos ou mesclados.')), this.state.bank.data.suspectedDuplicates.slice(0, 3).map(d => h('div', { className: 'mf-duplicate-row', key: d.pairKey }, h('span', {}, d.date.split('-').reverse().join('/') + ' · ' + d.description + ' · ' + fmt(Math.abs(d.amount))), h('button', { className: 'ghost-button', onClick: () => this.dismissBankDuplicate(d.pairKey) }, 'Ignorar aviso')))) : null, review ? h(Card, { className: 'mf-review-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'SUA CAIXA DE REVISÃO'), h('h2', {}, count ? count + ' movimentações carregadas para conferir' : partialBank ? 'Nenhuma revisão pendente entre os registros carregados' : 'Tudo organizado! 🎉'), h('p', {}, count ? 'Revisão calculada sobre os registros bancários carregados, independentemente do período.' : 'Outros registros podem existir fora da janela carregada quando o histórico é parcial.')), h('button', { className: 'outlined-action', onClick: () => this.navigate('transactions') }, 'Ver todas as movimentações')) : null, h('div', { className: 'u2-summary-heading' }, h('div', {}, h('h2', {}, 'Seu histórico, com contexto'), h('p', {}, review ? 'Caixa de revisão · registros bancários carregados' : pDate(span.start) + ' a ' + pDate(span.end) + ' · filtros aplicados ao resumo')), hasBank && hasManual ? h('div', { className: 'u2-view-tabs', 'aria-label': 'Origem dos valores do resumo' }, ['bank', 'manual'].map(v => h('button', { type: 'button', 'aria-pressed': source === v, onClick: () => this.setState({ txSummarySource: v }) }, v === 'bank' ? 'Banco' : 'Manual'))) : null), h('div', { className: 'u2-metrics' }, [
            { label: 'Entradas confirmadas', value: fmt(summary.income), detail: 'Receitas · ' + (source === 'bank' ? (partialBank ? 'banco · linhas carregadas' : 'banco') : 'manual'), kind: 'income' },
            { label: 'Saídas confirmadas', value: fmt(summary.expense), detail: 'Despesas · ' + (source === 'bank' ? (partialBank ? 'banco · linhas carregadas' : 'banco') : 'manual'), kind: 'expense' },
            { label: 'Resultado dos registros', value: fmt(summary.net), detail: 'Entradas menos saídas · não é saldo disponível' + (source === 'bank' && partialBank ? ' · histórico parcial' : ''), kind: '', tone: 'net', semantic: summary.net > 0 ? 'is-positive' : summary.net < 0 ? 'is-negative' : 'is-neutral' },
            { label: source === 'bank' ? 'Pendentes no banco' : 'Registros manuais', value: String(source === 'bank' ? summary.pending : summary.count), detail: source === 'bank' ? summary.review + ' a conferir · revisão independente do pagamento' : 'Valores separados das contas conectadas', kind: '', tone: source === 'bank' ? 'warning' : 'balance' }
        ].map(x => h('article', { className: 'u2-metric mf-border-reveal mf-tone-' + (x.tone || x.kind || 'neutral') + ' ' + x.kind + (x.semantic ? ' ' + x.semantic : ''), role: 'group', tabIndex: 0, key: x.label }, h('span', {}, x.label), h('strong', {}, x.value), h('small', {}, x.detail)))), partialBank ? h('p', { className: 'u5-history-limited', role: 'status' }, 'Histórico bancário parcial: ' + this.state.bank.data.transactions.length + ' de ' +
            this.state.bank.data.totalTransactions +
            ' movimentações carregadas. Os resumos bancários e a revisão nesta tela abrangem somente as linhas carregadas; não representam o histórico completo.') : null, h('div', { className: 'u2-scope' }, h('span', {}, 'Resumo: ' + (source === 'bank' ? 'contas conectadas' : 'lançamentos manuais') +
            ' · ' + summary.count + ' registros' + (summary.excluded ? ' · ' + summary.excluded + ' transferência(s)/desconsiderada(s) fora dos valores' : '')), active.length ? h('button', { type: 'button', className: 'mf-small-link',
            onClick: () => this.clearMovementFilters() }, 'Limpar todos os filtros') : null), h('div', { className: 'panel-toolbar u5-filter-toolbar' }, h('div', { className: 'search-box' }, h(Icon, { name: 'search', size: 18 }), h('input', { value: this.state.query, 'aria-label': 'Buscar movimentações',
            placeholder: 'Buscar descrição, estabelecimento ou categoria',
            onChange: (e) => this.setState({ query: e.target.value, txSelected: [], quickCategory: null }) })), h('div', { className: 'toolbar-actions' }, !review ? h(StyledSelect, { className: 'form-control bank-filter', value: this.state.txSource,
            ariaLabel: 'Filtrar origem', options: [{ value: 'all', label: 'Todas as origens' },
                { value: 'bank', label: 'Contas conectadas' }, { value: 'manual', label: 'Adicionadas por você' }],
            onChange: (v) => this.setState({ txSource: v, bankFilter: v === 'manual' ? '' : this.state.bankFilter,
                txSelected: [], quickCategory: null }) }) : null, this.state.bank.data.accounts.length > 1 || this.state.bankFilter ? h(StyledSelect, {
            className: 'form-control bank-filter', value: this.state.bankFilter, ariaLabel: 'Filtrar conta',
            options: [{ value: '', label: 'Todas as contas' }, ...this.state.bank.data.accounts.map(a => ({ value: a.id, label: a.name }))],
            onChange: (v) => this.setState({ bankFilter: v, txSource: v ? 'bank' : this.state.txSource,
                txSelected: [], quickCategory: null })
        }) : null, h('button', { type: 'button', className: 'ghost-button u5-more-filters',
            'aria-expanded': !!this.state.txAdvancedOpen, 'aria-controls': 'u5-advanced-filters',
            onClick: () => this.setState({ txAdvancedOpen: !this.state.txAdvancedOpen }) }, h(Icon, { name: 'filter', size: 16 }), 'Filtros' + (active.length ? ' · ' + active.length : '')), !review ? h('button', { type: 'button', className: 'ghost-button',
            onClick: () => { var _a; return (_a = this.csvInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Importar CSV') : null)), this.state.txAdvancedOpen ? h('div', { id: 'u5-advanced-filters', className: 'u5-advanced-filters',
            'aria-label': 'Filtros avançados' }, h(StyledSelect, { value: this.state.txCategoryFilter || '', ariaLabel: 'Filtrar categoria',
            options: [{ value: '', label: 'Todas as categorias' }, ...cats.map(c => ({ value: c.name, label: c.name }))],
            onChange: (v) => this.setState({ txCategoryFilter: v, txSelected: [], quickCategory: null }) }), h(StyledSelect, { value: this.state.txKindFilter || 'all', ariaLabel: 'Filtrar receitas e despesas',
            options: [{ value: 'all', label: 'Receitas e despesas' }, { value: 'income', label: 'Somente receitas' },
                { value: 'expense', label: 'Somente despesas' }],
            onChange: (v) => this.setState({ txKindFilter: v, txSelected: [], quickCategory: null }) }), !review ? h(StyledSelect, { value: this.state.txReviewFilter || 'all', ariaLabel: 'Filtrar situação de revisão',
            options: [{ value: 'all', label: 'Qualquer revisão' }, { value: 'pending', label: 'A conferir (banco)' },
                { value: 'reviewed', label: 'Revisadas (banco)' }],
            onChange: (v) => this.setState({ txReviewFilter: v, txSelected: [], quickCategory: null }) }) : null, h(StyledSelect, { value: this.state.txSort || 'date_desc', ariaLabel: 'Ordenar movimentações',
            options: [{ value: 'date_desc', label: 'Data mais recente' },
                { value: 'date_asc', label: 'Data mais antiga' },
                { value: 'amount_desc', label: 'Maior valor absoluto' },
                { value: 'amount_asc', label: 'Menor valor absoluto' }],
            onChange: (v) => this.setState({ txSort: v, txSelected: [], quickCategory: null }) })) : null, active.length ? h('div', { className: 'u5-filter-chips', role: 'group', 'aria-label': 'Filtros ativos' }, active.map(chip => h('button', { type: 'button', key: chip.key, className: 'u5-filter-chip',
            'aria-label': 'Remover filtro ' + chip.label, onClick: chip.clear }, chip.label, h(Icon, { name: 'close', size: 13 })))) : null, selected.length ? h(Card, { className: 'mf-bulk-toolbar' }, h('b', {}, selected.length + ' selecionada(s)'), h(StyledSelect, { value: this.state.txBatchCategory, options: cats.map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (value) => this.setState({ txBatchCategory: value }) }), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => this.applyBankBatch({ category: this.state.txBatchCategory }) }, 'Aplicar categoria'), h('button', { className: 'primary-button', disabled: this.state.detailBusy, onClick: () => this.applyBankBatch({ reviewed: true }) }, 'Marcar revisadas'), h('button', { className: 'mf-small-link', onClick: () => this.setState({ txSelected: [] }) }, 'Limpar seleção')) : null, h(Card, { className: 'table-card' }, h('div', { className: 'mf-table-summary' }, h('span', { role: 'status' }, filtered.length + ' resultados nos dados carregados' + (filtered.length > 500 ? ' · exibindo os primeiros 500; resumo inclui as demais linhas filtradas e carregadas' : '')), review ? h('span', {}, 'A revisar · todos os períodos carregados') : null, partialBank ? h('span', {}, 'Histórico bancário parcial') : null), !review ? h('details', { className: 'mf-table-help' }, h('summary', {}, 'Como editar'), h('p', {}, 'No nome: detalhes. Na categoria: edição. Divisões e vínculos ficam no detalhe.')) : null, h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Data', 'Movimentação', 'Categoria', 'Origem', 'Situação', 'Valor', 'Ação'].map((n, i) => h('th', { key: i }, n)))), h('tbody', {}, shown.length ? shown.map(t => {
            var _a;
            const bank = t.origin === 'bank', v = t.raw, category = cats.find(c => c.name === t.category);
            return h('tr', { key: t.key }, h('td', {}, bank ? h('input', { type: 'checkbox', className: 'mf-check', checked: this.bankTxSelected(v), title: 'Selecionar para ação em lote', onChange: () => this.toggleSelected(v) }) : null), h('td', { className: 'muted' }, t.date.split('-').reverse().join('/')), h('td', {}, h('button', { className: 'mf-row-detail', title: 'Abrir detalhes', onClick: () => bank ? this.openBankDetail(v) : this.openManualDetail(t.raw) }, h('span', { className: 'mf-row-emoji' }, (category === null || category === void 0 ? void 0 : category.emoji) || '✨'), h('span', {}, h('b', {}, t.merchant || t.description), t.merchant && t.merchant !== t.description ? h('small', {}, t.description) : null, bank && v.linkedManualId ? h('small', { className: 'mf-linked' }, '✓ Conferido com lançamento manual') : null))), h('td', {}, h(TransactionCategoryButton, { category: t.category, emoji: category === null || category === void 0 ? void 0 : category.emoji,
                label: 'Editar categoria de ' + (t.merchant || t.description) + ' · ' + t.date.split('-').reverse().join('/') + ' · ' + t.account + ' · ' + (t.amount >= 0 ? '+' : '−') + fmt(Math.abs(t.amount)),
                expanded: !!this.state.quickCategory && this.state.quickCategory.origin === t.origin && this.state.quickCategory.id === t.raw.id && (t.origin === 'manual' || this.state.quickCategory.accountId === t.raw.accountId),
                disabled: this.state.quickCategoryBusy || this.state.busy,
                onClick: (e) => this.openCategoryFromRow(t.origin, t.raw, e) }), bank && ((_a = v.splits) === null || _a === void 0 ? void 0 : _a.length) ? h('small', { className: 'mf-muted-block' }, 'Dividida em ' + v.splits.length + ' partes') : null), h('td', {}, t.account), h('td', {}, bank ? h('span', { className: 'mf-status-group' }, h('span', { className: 'kind-pill' }, t.status === 'POSTED' ? 'Confirmada' : t.status === 'PENDING' ? 'Pendente no banco' : t.status), h('small', { className: v.reviewed ? 'u2-reviewed' : 'u2-to-review' }, v.reviewed ? '✓ Revisada' : 'A conferir'), effectiveNature(v) === 'transfer' ? h('small', {}, 'Transferência') : effectiveNature(v) === 'ignore' ? h('small', {}, 'Desconsiderada') : null) : h('span', { className: 'kind-pill' }, 'Manual')), h('td', { className: t.amount >= 0 ? 'good-text amount-cell' : 'amount-cell' }, (t.amount >= 0 ? '+' : '−') + fmt(Math.abs(t.amount))), h('td', {}, bank && !v.reviewed ? h('button', { className: 'mf-quick-review', disabled: this.state.detailBusy || this.reviewSavingKeys.has(v.accountId + '|' + v.id), onClick: () => this.markBankReviewed(v), title: 'Conferir esta movimentação sem abrir detalhes' }, '✓ Revisar') : null));
        }) : h('tr', {}, h('td', { colSpan: 8, className: 'empty-table' }, review ? 'Não há movimentações para revisar.' : 'Não há movimentações neste período.')))))));
    }
    renderCategories() {
        var _a, _b;
        const categories = this.getCategories(), rules = this.state.rules, e = this.state.categoryEditor, r = this.state.ruleEditor;
        const preview = findCategoryRule(this.state.ruleTest, 'bank', rules);
        return h('div', { className: 'section categories-page' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'ORGANIZAÇÃO AUTOMÁTICA'), h('h2', {}, 'Seu dinheiro, suas categorias.'), h('p', {}, 'Personalize os nomes e cores, crie regras por descrição e ajuste lançamentos individualmente. Tudo funciona localmente, sem IA paga.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'filter', size: 46 }))), desktop && this.state.mode === 'real' ? h(Card, { className: 'mf-category-import' }, h('div', {}, h('b', {}, 'Classificação inteligente preparada para você'), h('p', {}, 'Aplique um arquivo de sugestões revisadas. O aplicativo preserva suas correções, cria uma cópia de segurança e mantém movimentações duvidosas para você analisar.')), h('button', { className: 'primary-button', onClick: () => this.importCategoryPack() }, h(Icon, { name: 'upload', size: 17 }), 'Importar sugestões')) : null, this.state.mode === 'demo' ? h(Card, { className: 'settings-card' }, h('h2', {}, 'Modo demonstração'), h('p', {}, 'A edição de regras e categorias está disponível somente nos seus dados pessoais.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')) :
            h('div', { className: 'categories-layout' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Categorias personalizadas'), h('p', {}, 'As categorias padrão podem mudar de cor. Categorias criadas por você podem ser renomeadas.'))), h('div', { className: 'category-list' }, categories.map(cat => h('div', { className: 'category-list-row', key: cat.name }, h('span', { className: 'category-emoji-icon', style: { background: cat.color + '20', borderColor: cat.color + '70' } }, cat.emoji || '✨'), h('b', {}, cat.name), h('small', { className: 'mf-category-kind-tag' }, cat.kind === 'income' ? 'Receita' : cat.kind === 'expense' ? 'Gasto' : 'Entrada ou saída'), cat.builtIn ? h('small', { className: 'muted' }, 'Padrão') : null, h('button', { className: 'small-link', onClick: () => this.setState({ categoryEditor: { previousName: cat.name, name: cat.name, color: cat.color, emoji: cat.emoji || '✨', kind: cat.kind } }) }, 'Editar'), !cat.builtIn ? h('button', { className: 'trash-button', title: 'Excluir categoria sem uso', onClick: () => this.deleteCategory(cat.name) }, h(Icon, { name: 'trash', size: 16 })) : null))), h('h3', {}, e.previousName ? 'Editar categoria' : 'Criar categoria'), this.field('Nome', h('input', { className: 'form-control', value: e.name, maxLength: 50, placeholder: 'Ex.: Pets, Delivery, Estudos', disabled: !!(e.previousName && ((_a = categories.find(c => c.name === e.previousName)) === null || _a === void 0 ? void 0 : _a.builtIn)), onChange: (v) => this.setState({ categoryEditor: { ...e, name: v.target.value } }) })), this.field('Tipo de categoria', h(StyledSelect, { value: e.kind, disabled: !!(e.previousName && ((_b = categories.find(c => c.name === e.previousName)) === null || _b === void 0 ? void 0 : _b.builtIn)), options: [{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Receita' }, { value: 'both', label: 'Entrada ou saída' }], onChange: (kind) => this.setState({ categoryEditor: { ...e, kind } }) })), h('div', { className: 'category-appearance' }, h('div', { className: 'category-preview', style: { borderColor: e.color + '75' } }, h('span', { className: 'category-preview-icon', style: { background: e.color + '26', boxShadow: '0 0 24px ' + e.color + '25' } }, e.emoji || '✨'), h('div', {}, h('small', {}, 'PRÉVIA DA CATEGORIA'), h('strong', {}, e.name.trim() || 'Minha categoria'), h('span', {}, 'Você escolhe como organizar cada movimentação.'))), h('div', { className: 'appearance-label' }, h('b', {}, 'Escolha um emoji'), h('span', {}, 'Um símbolo para reconhecer rapidamente seus gastos')), h('div', { className: 'emoji-grid', role: 'group', 'aria-label': 'Escolha um emoji' }, (this.state.categoryMoreEmojis ? EMOJI_OPTIONS : Array.from(new Set([...EMOJI_OPTIONS.slice(0, 18), e.emoji]))).map(emoji => h('button', { type: 'button', key: emoji,
                className: 'emoji-choice ' + (e.emoji === emoji ? 'selected' : ''), 'aria-label': 'Usar emoji ' + emoji, 'aria-pressed': e.emoji === emoji,
                onClick: () => this.setState({ categoryEditor: { ...e, emoji } }) }, emoji))), h('button', { className: 'mf-small-link', type: 'button', onClick: () => this.setState({ categoryMoreEmojis: !this.state.categoryMoreEmojis }) }, this.state.categoryMoreEmojis ? 'Mostrar menos emojis' : 'Explorar todos os emojis'), h('div', { className: 'appearance-label' }, h('b', {}, 'Sua paleta de cores'), h('span', {}, 'Cores que combinam com o tema escuro')), h('div', { className: 'color-grid', role: 'group', 'aria-label': 'Escolha uma cor' }, COLOR_OPTIONS.map(color => h('button', { key: color, type: 'button',
                className: 'color-choice ' + (e.color === color ? 'selected' : ''), style: { background: color }, 'aria-label': 'Cor ' + color, 'aria-pressed': e.color === color,
                onClick: () => this.setState({ categoryEditor: { ...e, color } }) }, e.color === color ? '✓' : null))), h('label', { className: 'custom-color-label' }, 'Cor personalizada (opcional)', h('input', { key: e.previousName + '-' + e.color, className: 'color-hex-input', defaultValue: e.color,
                maxLength: 7, spellCheck: false, placeholder: '#3e9a85', onBlur: (v) => { const color = String(v.target.value).trim(); if (/^#[0-9a-fA-F]{6}$/.test(color))
                    this.setState({ categoryEditor: { ...e, color: color.toLowerCase() } });
                else
                    v.target.value = e.color; }, onKeyDown: (v) => { if (v.key === 'Enter')
                    v.currentTarget.blur(); } }))), h('div', { className: 'toolbar-actions' }, h('button', { className: 'primary-button', onClick: () => this.saveCategory() }, e.previousName ? 'Salvar alterações' : 'Adicionar categoria'), e.previousName ? h('button', { className: 'ghost-button', onClick: () => this.setState({ categoryEditor: { previousName: '', name: '', color: '#3e9a85', emoji: '✨', kind: 'expense' } }) }, 'Cancelar edição') : null)), h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Regras automáticas'), h('p', {}, 'Ex.: descrição contém IFOOD → Alimentação. Menor prioridade vence; empate segue a regra mais antiga.'))), h('div', { className: 'rule-list' }, rules.length ? rules.map(rule => h('div', { className: 'rule-list-row', key: rule.id }, h('div', {}, h('strong', {}, rule.pattern), h('small', {}, (rule.matchMode === 'exact' ? 'Texto exato' : rule.matchMode === 'starts' ? 'Começa com' : 'Contém') + ' · ' + (rule.scope === 'both' ? 'Banco e manuais' : rule.scope === 'bank' ? 'Banco' : 'Manuais') + ' · Prioridade ' + rule.priority)), h('span', { className: 'category-tag' }, rule.category), h('button', { className: 'small-link', onClick: () => this.setState({ ruleEditor: { id: rule.id, pattern: rule.pattern, matchMode: rule.matchMode, category: rule.category, scope: rule.scope, priority: String(rule.priority) } }) }, 'Editar'), h('button', { className: 'trash-button', title: 'Excluir regra', onClick: () => this.deleteRule(rule.id) }, h(Icon, { name: 'trash', size: 16 })))) : h('p', { className: 'muted-desc' }, 'Nenhuma regra criada. Cadastre a primeira abaixo.')), h('div', { className: 'rule-suggestions' }, h('small', {}, 'Modelos rápidos:'), [
                { pattern: 'IFOOD', category: 'Alimentação' },
                { pattern: 'UBER', category: 'Transporte' },
                { pattern: 'NETFLIX', category: 'Assinaturas' },
                { pattern: 'SPOTIFY', category: 'Assinaturas' }
            ].map(x => h('button', { className: 'ghost-button', key: x.pattern, onClick: () => this.setState({ ruleEditor: { ...emptyRule(), pattern: x.pattern, category: x.category } }) }, x.pattern))), h('h3', {}, r.id ? 'Editar regra' : 'Nova regra'), this.field('Texto da movimentação', h('input', { className: 'form-control', placeholder: 'Ex.: IFOOD, UBER, NETFLIX', maxLength: 120, value: r.pattern, onChange: (v) => this.setState({ ruleEditor: { ...r, pattern: v.target.value } }) })), h('div', { className: 'two-inputs' }, this.field('Correspondência', h(StyledSelect, { className: 'form-control', value: r.matchMode, options: [{ value: 'contains', label: 'Contém' }, { value: 'starts', label: 'Começa com' }, { value: 'exact', label: 'Texto exato' }], onChange: (value) => this.setState({ ruleEditor: { ...r, matchMode: value } }) })), this.field('Aplicar em', h(StyledSelect, { className: 'form-control', value: r.scope, options: [{ value: 'both', label: 'Bancos e novos manuais' }, { value: 'bank', label: 'Só banco' }, { value: 'manual', label: 'Só novos manuais' }], onChange: (value) => this.setState({ ruleEditor: { ...r, scope: value } }) }))), h('div', { className: 'two-inputs' }, this.field('Categoria', h(StyledSelect, { className: 'form-control', value: r.category, options: categories.map(c => ({ value: c.name, label: (c.emoji || '✨') + '  ' + c.name })), onChange: (value) => this.setState({ ruleEditor: { ...r, category: value } }) })), this.field('Prioridade (1 = mais alta)', h('input', { className: 'form-control', type: 'number', min: 1, max: 999, value: r.priority, onChange: (v) => this.setState({ ruleEditor: { ...r, priority: v.target.value } }) }))), h('div', { className: 'toolbar-actions' }, h('button', { className: 'primary-button', onClick: () => this.saveRule() }, r.id ? 'Atualizar regra' : 'Salvar regra'), r.id ? h('button', { className: 'ghost-button', onClick: () => this.setState({ ruleEditor: emptyRule() }) }, 'Cancelar edição') : null), h('div', { className: 'rule-preview' }, h('b', {}, 'Testar classificação'), h('input', { className: 'form-control', value: this.state.ruleTest, placeholder: 'Digite uma descrição do extrato', onChange: (v) => this.setState({ ruleTest: v.target.value }) }), h('p', {}, 'Resultado: ', h('strong', {}, preview || 'Sem regra correspondente (Outros)'))))), this.state.categoryMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.categoryMessage) : null, h('p', { className: 'muted-desc' }, 'Regras reclassificam imediatamente o extrato bancário na visualização, inclusive dados já sincronizados. Correções individuais do banco sempre prevalecem. Lançamentos manuais antigos preservam sua categoria; regras automáticas ajudam em novos lançamentos e importações sem categoria.'));
    }
    renderBudgets() {
        const useBank = this.state.mode === 'real' && this.state.dashboardSource === 'bank' && this.state.bank.data.accounts.length > 0;
        const s = useBank ? bankSnapshot(this.state.bank, this.state.month) : this.monthData();
        const d = this.state.data, mode = this.state.budgetTab, focus = this.state.budgetFocus || 'all', search = this.state.budgetSearch || '';
        const all = this.getCategories();
        const allowed = all.filter(c => mode === 'income' ? c.kind !== 'expense' : c.kind !== 'income');
        const amounts = mode === 'income' ? s.incomeCategories : s.categories;
        const getAmount = (name) => { var _a; return ((_a = amounts.find(x => x.name === name)) === null || _a === void 0 ? void 0 : _a.total) || 0; };
        const assigned = allowed.reduce((sum, c) => sum + getAmount(c.name), 0);
        const total = mode === 'income' ? s.income : s.expense;
        const unclassified = Math.max(0, total - assigned);
        const entries = allowed.map(c => ({ info: c, total: getAmount(c.name), hasLimit: Object.prototype.hasOwnProperty.call(d.budgets, c.name), limit: d.budgets[c.name] }))
            .filter(x => x.total > 0 || (mode === 'expense' && x.hasLimit));
        const quiet = allowed.filter(c => !entries.some(x => x.info.name === c.name));
        const limited = entries.filter(x => mode === 'expense' && x.hasLimit);
        const spentLimited = limited.reduce((sum, x) => sum + x.total, 0);
        const limitTotal = limited.reduce((sum, x) => sum + (x.limit || 0), 0);
        const margin = limitTotal - spentLimited;
        const sortedEntries = entries.slice().sort(mode === 'expense' ? budgetPresentationOrder : (a, b) => b.total - a.total);
        const signals = u3BudgetSignals(entries, total);
        const visible = sortedEntries.filter(x => (mode === 'income' || focus === 'all' || focus === 'attention' && x.hasLimit && (x.total > x.limit || x.limit > 0 && x.total / x.limit >= .9) || focus === 'unlimited' && !x.hasLimit) && (!search || fold(x.info.name).includes(fold(search))));
        const suggestLimit = (name) => {
            const values = Array.from({ length: 3 }, (_, i) => {
                var _a;
                const ym = shiftMonth(this.state.month, -1 - i);
                const snap = useBank ? bankSnapshot(this.state.bank, ym) : snapshot(this.state.data, ym);
                return ((_a = snap.categories.find(x => x.name === name)) === null || _a === void 0 ? void 0 : _a.total) || 0;
            });
            if (values.filter(v => v > 0).length < 2)
                return null;
            const average = values.reduce((a, b) => a + b, 0) / 3;
            return Math.max(2000, Math.ceil(average * 1.1 / 1000) * 1000);
        };
        return h('div', { className: 'section mf-budget-section u3-budgets' }, h('div', { className: 'mf-budget-heading' }, h('div', {}, h('p', {}, mode === 'expense' ? 'Acompanhe seus limites por categoria.' : 'Veja a composição das receitas recebidas.')), h('div', { className: 'mf-budget-switch', role: 'group', 'aria-label': 'Visualização financeira' }, h('button', { type: 'button', className: mode === 'expense' ? 'active' : '', 'aria-pressed': mode === 'expense', onClick: () => this.setState({ budgetTab: 'expense', showAllBudgetCategories: false, budgetFocus: 'all', budgetSearch: '' }) }, 'Gastos'), h('button', { type: 'button', className: mode === 'income' ? 'active' : '', 'aria-pressed': mode === 'income', onClick: () => this.setState({ budgetTab: 'income', showAllBudgetCategories: false, budgetFocus: 'all', budgetSearch: '' }) }, 'Receitas'))), this.renderSourcePicker(), h('p', { className: 'mf-budget-context' }, prettyMonth(this.state.month) + ' · ' + (mode === 'expense' ? 'Gastos do mês e limites cadastrados por categoria' : 'Composição das receitas recebidas, sem incluir transferências próprias confirmadas')), mode === 'expense' ? h('div', { className: 'mf-budget-summary mf-budget-summary-four' }, h('div', { className: 'mf-border-reveal mf-tone-expense', role: 'group', tabIndex: 0 }, h('small', {}, 'Gasto nas categorias com limite'), h('strong', {}, fmt(spentLimited))), h('div', { className: 'mf-border-reveal mf-tone-balance', role: 'group', tabIndex: 0 }, h('small', {}, 'Limites cadastrados'), h('strong', {}, limited.length ? fmt(limitTotal) : 'Sem limites')), h('div', { className: 'mf-border-reveal mf-tone-net ' + (limited.length ? (margin < 0 ? 'is-negative' : 'is-positive') : 'is-neutral'), role: 'group', tabIndex: 0 }, h('small', {}, margin < 0 ? 'Excesso nos limites' : 'Margem nos limites'), h('strong', { className: margin < 0 ? 'bad-text' : '' }, limited.length ? fmt(Math.abs(margin)) : 'Sem limites'), h('small', {}, 'Não representa saldo disponível')), h('div', { className: 'mf-border-reveal mf-tone-warning', role: 'group', tabIndex: 0 }, h('small', {}, 'Gasto fora dos limites'), h('strong', {}, fmt(Math.max(0, total - spentLimited))))) :
            h('div', { className: 'mf-budget-summary' }, h('div', {}, h('small', {}, 'Total recebido no período'), h('strong', {}, fmt(total))), h('div', {}, h('small', {}, 'Origens com recebimentos'), h('strong', {}, String(entries.filter(x => x.total > 0).length))), h('div', {}, h('small', {}, 'Maior fonte de receita'), h('strong', {}, entries.length ? entries.slice().sort((a, b) => b.total - a.total)[0].info.name : 'Nenhuma ainda'))), mode === 'expense' ? h('section', { className: 'u3-budget-insight' }, h('div', { className: 'u3-coverage' }, h('div', { className: 'u3-coverage-ring', 'aria-hidden': 'true', style: { background: 'conic-gradient(var(--u3-accent) ' + (signals.covered || 0) + '%, var(--surface3) 0)' } }, h('strong', {}, signals.covered === null ? '—' : signals.covered + '%')), h('div', {}, h('h2', {}, 'Gastos com um limite definido'), h('p', {}, signals.covered === null ? 'Sem gastos nesta fonte e mês.' : signals.covered + '% dos gastos do mês estão em categorias com limite.'), h('small', {}, 'Cobertura do orçamento · não é dinheiro reservado'))), h('div', { className: 'u3-budget-actions' }, [
            { key: 'attention', count: signals.exceeded + signals.near, title: 'Pedem atenção', description: signals.exceeded + ' acima · ' + signals.near + ' perto do limite', icon: 'alert' },
            { key: 'unlimited', count: signals.unlimited, title: 'Sem limite', description: 'Categorias com gastos para organizar', icon: 'layers' }
        ].map(x => h('button', { type: 'button', className: 'u3-insight-action', 'aria-pressed': focus === x.key, onClick: () => this.setState({ budgetFocus: focus === x.key ? 'all' : x.key, budgetSearch: '' }) }, h(Icon, { name: x.icon, size: 18 }), h('span', {}, h('b', {}, x.title), h('small', {}, x.description)), h('strong', {}, x.count), h(Icon, { name: 'chevron-right', size: 15 }))))) : null, useBank && this.state.bank.data.truncated && !this.state.bank.data.dailyTotals ? h('p', { className: 'mf-budget-warning' }, 'Histórico carregado parcialmente. Valores e cobertura refletem somente os registros disponíveis.') : null, mode === 'expense' ? h('p', { className: 'mf-budget-contract' }, 'O mês filtra os gastos. Os limites cadastrados são recorrentes e valem para todos os meses.') : null, mode === 'income' && this.state.planning.items.some(x => x.kind === 'income' && x.dueDate.slice(0, 7) === this.state.month && x.remaining > 0 && x.status !== 'cancelled') ?
            h('p', { className: 'mf-budget-expected' }, 'Recebimentos ainda previstos no Planejamento: ' + fmt(this.state.planning.items.filter(x => x.kind === 'income' && x.dueDate.slice(0, 7) === this.state.month && x.remaining > 0 && x.status !== 'cancelled').reduce((sum, x) => sum + x.remaining, 0)) + '. Não somados às receitas já recebidas.') : null, unclassified > 0 ? h('div', { className: 'mf-budget-warning', role: 'status' }, 'Há ' + fmt(unclassified) + ' em ' + (mode === 'expense' ? 'despesas' : 'receitas') + ' com categorias incompatíveis ou ainda não identificadas. Confira em Movimentações.') : null, h('div', { className: 'u3-budget-toolbar' }, h('div', { className: 'u2-view-tabs', 'aria-label': 'Filtro de categorias' }, (mode === 'income' ? [{ value: 'all', label: 'Recebimentos' }] : [{ value: 'all', label: 'Todas' }, { value: 'attention', label: 'Atenção' }, { value: 'unlimited', label: 'Sem limite' }]).map(x => h('button', { type: 'button', 'aria-pressed': focus === x.value, onClick: () => this.setState({ budgetFocus: x.value }) }, x.label))), h('div', { className: 'search-box' }, h(Icon, { name: 'search', size: 16 }), h('input', { 'aria-label': 'Buscar categoria no orçamento', placeholder: 'Buscar categoria', value: search, onChange: (e) => this.setState({ budgetSearch: e.target.value }) }))), h('div', { className: 'u3-budget-list-heading' }, h('h2', {}, mode === 'expense' ? 'Limites por categoria' : 'Origens da sua renda'), h('span', { role: 'status' }, visible.length + ' categoria(s)')), visible.length ? h('div', { className: 'budget-grid' }, visible.map(({ info, total: spent, hasLimit, limit }, index) => {
            const pct = hasLimit && limit > 0 ? Math.round(spent / limit * 100) : hasLimit ? (spent > 0 ? 100 : 0) : 0;
            const share = total > 0 ? Math.round(spent / total * 100) : 0;
            const status = !hasLimit ? 'unlimited' : spent > limit ? 'exceeded' : limit > 0 && spent / limit >= .9 ? 'near' : 'within';
            const gauge = mode === 'expense' && hasLimit && limit > 0 ? budgetB3Visual(spent, limit) : null;
            const remaining = limit - spent;
            const row = h(Card, { className: 'budget-item mf-budget-card mf-budget-' + status + (gauge ? ' mf-budget-card-b3' : ''), key: info.name }, h('div', { className: 'budget-item-top' }, h('span', { className: 'cat-symbol', style: { background: info.color + '28', color: info.color } }, info.emoji || '✨'), h('div', {}, h('h3', {}, info.name), h('small', { className: 'u3-budget-state' }, mode === 'income' ? 'Recebimentos do mês' : status === 'exceeded' ? 'Acima do limite' : status === 'near' ? 'Próximo do limite' : status === 'unlimited' ? 'Sem limite' : 'Dentro do limite'))), gauge ? h('div', { className: 'mf-budget-b3', role: 'group', 'aria-label': 'Orçamento de ' + info.name + ': ' + gauge.percent + '% utilizado; gasto ' + fmt(spent) + ' de ' + fmt(limit) + (remaining < 0 ? '; excedido em ' + fmt(-remaining) : '; restante ' + fmt(remaining)) }, h('div', { className: 'mf-budget-b3-dial', style: { '--mf-budget-b3-color': gauge.color } }, h('svg', { className: 'mf-budget-b3-svg', viewBox: '0 0 200 110', 'aria-hidden': true, focusable: 'false' }, h('path', { className: 'mf-budget-b3-track', d: 'M 14 96 A 86 86 0 0 1 186 96', pathLength: 100 }), gauge.fill > 0 ? h('path', { className: 'mf-budget-b3-fill', d: 'M 14 96 A 86 86 0 0 1 186 96', pathLength: 100, strokeDasharray: gauge.fill + ' 100' }) : null), h('strong', { className: 'mf-budget-b3-percent' }, gauge.percent + '%'), h('span', { className: 'mf-budget-b3-caption' }, 'do limite utilizado')), h('div', { className: 'mf-budget-b3-values' }, h('div', {}, h('small', {}, 'Gasto atual'), h('strong', {}, fmt(spent))), h('div', {}, h('small', {}, 'Limite configurado'), h('strong', {}, fmt(limit)))), h('p', { className: 'mf-budget-b3-remaining' + (remaining < 0 ? ' is-exceeded' : '') }, remaining < 0 ? 'Limite ultrapassado · excesso de ' + fmt(-remaining) : 'Restam ' + fmt(remaining))) :
                h('div', { className: 'mf-budget-money' }, h('strong', {}, fmt(spent)), h('span', {}, mode === 'expense' ? 'gasto até agora' : 'recebido no período')), mode === 'income' ? h('div', { className: 'mf-income-share' }, h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { background: info.color, width: (spent > 0 ? Math.max(2, Math.min(share, 100)) : 0) + '%' } })), h('small', {}, share === 0 && spent > 0 ? 'Menos de 1% das receitas' : share + '% das receitas')) :
                gauge ? null : hasLimit ? h('div', { className: 'mf-budget-limit' }, h('div', { className: 'mf-budget-limit-head' }, h('span', {}, 'Limite ' + fmt(limit)), h('strong', { className: spent > limit ? 'bad-text' : '' }, limit === 0 ? (spent > 0 ? 'Acima do limite' : 'Limite zero definido') : pct + '% utilizado')), limit > 0 ? h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { width: Math.min(pct, 100) + '%' } })) : null, h('small', {}, spent > limit ? 'Ultrapassou em ' + fmt(spent - limit) : status === 'near' ? 'Próximo do limite · restam ' + fmt(limit - spent) : limit === 0 ? 'Limite zero definido' : 'Restam ' + fmt(limit - spent))) :
                    h('div', { className: 'mf-no-budget' }, h('span', {}, 'Sem limite definido'), h('div', { className: 'mf-budget-limit-actions' }, suggestLimit(info.name) ? h('button', { type: 'button', className: 'small-link', title: 'Sugestão: média dos últimos três meses com 10% de margem, arredondada para R$ 10. Você confirma antes de salvar.', onClick: () => this.setState({ editModal: { type: 'budget', key: info.name, title: 'Limite sugerido · ' + info.name, value: moneyString(suggestLimit(info.name)) } }) }, 'Sugerir ' + fmt(suggestLimit(info.name))) : null, h('button', { type: 'button', className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: info.name, title: 'Definir limite · ' + info.name, value: '' } }) }, 'Definir limite'))), mode === 'expense' && hasLimit ? h('div', { className: 'budget-item-bottom' }, h('button', { className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: info.name, title: 'Editar limite · ' + info.name, value: moneyString(limit) } }) }, 'Editar limite')) : null);
            const group = mode === 'expense' && (index === 0 || hasLimit !== visible[index - 1].hasLimit);
            return group ? [h('h3', { className: 'mf-budget-group-title', key: 'group-' + info.name }, hasLimit ? 'Categorias com limite' : 'Gastos sem limite'), row] : row;
        })) : h(Card, { className: 'mf-budget-empty' }, h('h3', {}, entries.length ? 'Nenhuma categoria para estes filtros' : mode === 'income' ? 'Nenhuma receita neste período' : 'Nenhum gasto neste período'), h('p', {}, entries.length ? 'Altere o filtro ou a busca para ver outras categorias.' : mode === 'income' ? 'As receitas aparecerão aqui depois de serem registradas ou sincronizadas.' : 'Suas despesas aparecerão aqui quando houver movimentações.')), quiet.length ? h('div', { className: 'mf-budget-quiet' }, h('button', { className: 'mf-budget-quiet-trigger', type: 'button', 'aria-expanded': this.state.showAllBudgetCategories,
            onClick: () => this.setState({ showAllBudgetCategories: !this.state.showAllBudgetCategories }) }, this.state.showAllBudgetCategories ? 'Ocultar outras categorias' : 'Ver outras categorias (' + quiet.length + ')', h(Icon, { name: this.state.showAllBudgetCategories ? 'chevron-up' : 'chevron-down', size: 16 })), this.state.showAllBudgetCategories ? h('div', { className: 'mf-budget-quiet-grid' }, quiet.map(c => h('div', { className: 'mf-budget-quiet-row', key: c.name }, h('span', {}, c.emoji || '✨', '  ', c.name), mode === 'expense' ? h('button', { className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: c.name, title: 'Definir limite · ' + c.name, value: '' } }) }, 'Definir limite') : h('span', { className: 'muted' }, 'Sem receitas neste mês')))) : null) : null, h('p', { className: 'mf-budget-disclaimer' }, 'Pix para terceiros continuam como entradas ou saídas até que sejam identificados como transferências próprias. Reembolsos sem vínculo são mostrados como entradas, não abatimentos automáticos de gastos.'));
    }
    renderAssistant(includeBanner = true) {
        const d = this.state.data, out = this.state.outcome, daily = !!desktop && this.state.mode === 'real', stale = this.isSimulationStale();
        const examples = [{ name: 'Notebook', price: '3200', icon: 'wallet' }, { name: 'Celular', price: '2400', icon: 'cart' }, { name: 'Compra pequena', price: '350', icon: 'spark' }];
        return h('div', { className: 'section assistant-page u3-simulator' }, includeBanner ? h('div', { className: 'intro-banner assistant-banner mf-compact-banner mf-sim-intro u3-sim-heading' }, h('div', {}, h('h2', {}, 'Decida com o cenário completo.'), h('p', {}, 'Compare parcelas, juros e o efeito da compra no seu planejamento.')), h('span', { className: 'u3-source-badge' }, daily ? 'Fluxo de caixa diário' : 'Perfil manual · cenário simplificado')) : null, h('div', { className: 'assistant-grid' }, h(Card, { className: 'sim-form-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('span', { className: 'micro-label' }, 'MONTE SEU CENÁRIO'), h('h2', {}, 'Sua próxima compra'), h('p', {}, 'Simular não cria uma dívida.'))), this.field('Valor do produto (R$)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.value, placeholder: 'Ex.: 1.499,90', onChange: (e) => this.setSimulation({ value: e.target.value }) })), h('div', { className: 'two-inputs' }, this.field('Número de parcelas', h(StyledSelect, { className: 'form-control', value: this.state.sim.installments, options: [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36].map(n => ({ value: String(n), label: n === 1 ? 'À vista' : n + 'x' })), onChange: (value) => this.setSimulation({ installments: value }) })), this.field('Juros ao mês (%)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.interest, onChange: (e) => this.setSimulation({ interest: e.target.value }) }))), daily ? this.field('Primeiro vencimento', h(SingleDatePicker, { value: this.state.sim.firstDueDate || (() => { const today = iso(new Date()), [y, m, d] = today.split('-').map(Number); return Number(this.state.sim.installments) === 1 ? today : iso(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))); })(), onChange: (value) => this.setSimulation({ firstDueDate: value }) }), 'A data é usada na projeção diária.') : h('p', { className: 'u3-sim-note' }, 'Este cenário simplificado começa no próximo mês e usa os valores recorrentes do perfil.'), h('div', { className: 'u3-reserve-note' }, h(Icon, { name: 'shield', size: 17 }), h('div', {}, h('small', {}, 'Reserva mínima cadastrada'), h('strong', {}, fmt(d.settings.reserve))), h('button', { type: 'button', className: 'mf-small-link', onClick: () => { this.setState({ settingsSection: 'profile' }); this.navigate('settings'); } }, 'Ajustar')), h('button', { type: 'button', className: 'primary-button full action-large', disabled: this.state.simBusy, onClick: () => this.runSim() }, h(Icon, { name: this.state.simBusy ? 'refresh' : 'spark', size: 18 }), this.state.simBusy ? 'Calculando cenário…' : stale ? 'Recalcular cenário' : 'Analisar compra'), h('details', { className: 'mf-sim-premises' }, h('summary', {}, 'O que entra nesta simulação?'), h('p', {}, daily ? 'Saldos de referência e compromissos cadastrados. Receitas incertas ficam fora do cenário.' : 'Renda, despesas fixas, parcelas e reserva informadas no perfil.'), h('p', {}, 'A fonte e os alertas dos dados aparecem no resultado. Nenhum valor é reservado automaticamente.')), h('div', { className: 'sim-example-title' }, 'Experimentar um valor'), h('div', { className: 'quick-examples' }, examples.map(x => h('button', { type: 'button', className: 'quick-choice', onClick: () => this.setSimulation({ value: x.price }), key: x.name }, h(Icon, { name: x.icon, size: 16 }), x.name)))), h('div', { className: 'result-column' }, this.state.simSaved ? this.renderSimulationComparison() : null, this.state.simError ? h('p', { className: 'u5-sim-error', role: 'alert' }, this.state.simError) : null, out ? h('div', { className: stale ? 'u5-sim-stale' : 'u5-sim-current' }, h('p', { className: 'u5-sim-state', role: 'status' }, stale ? 'Resultado anterior — desatualizado. Recalcule para atualizar os valores.' :
            'Resultado calculado com as premissas atuais.'), this.renderResult(out)) :
            h(Card, { className: 'empty-result' }, h('span', { className: 'empty-result-icon' }, h(Icon, { name: 'chart', size: 34 })), h('h2', {}, this.state.simBusy ? 'Calculando o impacto da compra…' : 'Compare antes de decidir.'), h('p', {}, 'Analise uma opção, guarde como referência e experimente outra quantidade de parcelas ou taxa.'), h('div', { className: 'u3-result-guide' }, h('span', {}, h('b', {}, '01'), 'Veja o custo total'), h('span', {}, h('b', {}, '02'), 'Confira a reserva'), h('span', {}, h('b', {}, '03'), 'Compare duas opções'))), u3SimulationCost(out) && !stale && !this.state.simBusy && !this.state.simError ?
            h('div', { className: 'u3-save-scenario' }, h('button', { type: 'button', className: 'outlined-action', onClick: () => this.saveSimulation() }, h(Icon, { name: 'layers', size: 16 }), this.state.simSaved ? 'Substituir referência A' : 'Guardar como referência A'), h('small', {}, 'Disponível nesta sessão · não cria compromisso')) : null, h('div', { className: 'info-box' }, h(Icon, { name: 'shield', size: 17 }), h('p', {}, 'Análise matemática. Dados incompletos ou antigos podem limitar a projeção; o resultado não garante capacidade de pagamento.')))));
    }
    renderSimulationComparison() {
        var _a;
        const saved = this.state.simSaved;
        if (!saved)
            return null;
        const a = u3SimulationCost(saved.result), b = this.isSimulationStale() ? null : u3SimulationCost(this.state.outcome);
        if (!a)
            return null;
        const delta = b ? b.total - a.total : null, sameEngine = b && a.daily === b.daily;
        const count = (out) => out.installments || out.count;
        const rows = [['Valor original', fmt(a.principal), b ? fmt(b.principal) : '—'], ['Parcelas', String(count(saved.result)) + 'x', b ? String(count(this.state.outcome)) + 'x' : '—'], ['Parcela de referência', fmt(a.monthly), b ? fmt(b.monthly) : '—'], ['Taxa ao mês', saved.input.interest + '%', b ? (((_a = this.state.simCalculatedInput) === null || _a === void 0 ? void 0 : _a.interest) || '') + '%' : '—'], ['Juros totais', fmt(a.interest), b ? fmt(b.interest) : '—'], ['Custo total', fmt(a.total), b ? fmt(b.total) : '—']];
        if (sameEngine && a.daily)
            rows.push(['Menor saldo projetado', a.minimum === null ? '—' : fmt(a.minimum), b.minimum === null ? '—' : fmt(b.minimum)]);
        return h('section', { className: 'u3-comparison' }, h('div', { className: 'u3-panel-heading' }, h('div', {}, h('h2', {}, 'Duas opções, lado a lado'), h('p', {}, b ? 'Comparação de dois cálculos atualizados' : this.isSimulationStale() ? 'A referência A permanece salva; recalcule as novas premissas para atualizar B.' : 'Referência guardada. Altere os dados e analise a opção B.')), h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ simSaved: undefined }) }, 'Limpar referência')), h('div', { className: 'u3-comparison-scroll' }, h('table', {}, h('caption', { className: 'sr-only' }, 'Comparação entre a referência A e o resultado atual B'), h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Cenário'), h('th', { scope: 'col' }, 'Referência A'), h('th', { scope: 'col' }, 'Atual B'))), h('tbody', {}, rows.map(row => h('tr', { key: row[0] }, h('th', { scope: 'row' }, row[0]), h('td', {}, row[1]), h('td', {}, row[2])))))), h('div', { className: 'u3-comparison-context' }, h('span', {}, 'A: ' + (a.daily ? 'projeção diária · início ' + bankReferenceLabel(saved.result.firstDueDate) : 'perfil manual')), b ? h('span', {}, 'B: ' + (b.daily ? 'projeção diária · início ' + bankReferenceLabel(this.state.outcome.firstDueDate) : 'perfil manual')) : null), delta === null ? null : h('p', { className: 'u3-comparison-delta' }, delta === 0 ? 'Mesmo custo total.' : 'O custo total da opção B é ' + fmt(Math.abs(delta)) + (delta > 0 ? ' maior.' : ' menor.')), b && a.principal !== b.principal ? h('p', { className: 'u3-sim-note' }, 'Os valores originais são diferentes. A diferença no total não representa economia de juros.') : null, b && !sameEngine ? h('p', { className: 'u3-sim-note' }, 'As opções usam motores diferentes. Compare apenas os custos; os saldos não são equivalentes.') : null, h('small', { className: 'u3-sim-note' }, 'Cada projeção usa os dados disponíveis no momento da análise. A parcela pode variar por centavos; confira o cronograma.'));
    }
    renderResult(out) {
        var _a;
        if (!out)
            return null;
        if (out.error)
            return h(Card, { className: 'result-error' }, h(Icon, { name: 'alert' }), out.error);
        if (out.engine === 'planning') {
            const info = { risk: ['Saldo negativo previsto', 'As parcelas podem levar o saldo abaixo de zero.', 'danger'], caution: ['Sua reserva fica comprometida', 'A projeção cai abaixo da reserva definida.', 'caution'], unknown: ['Dados insuficientes ou antigos', 'Confira suas contas e compromissos antes de decidir.', 'unknown'], estimate: ['Cenário projetado', 'Os compromissos cadastrados cabem na projeção, mas isso não garante a compra.', 'caution'] };
            const [title, subtitle, cls] = info[out.risk] || info.unknown;
            const quality = ((_a = out.reference) === null || _a === void 0 ? void 0 : _a.quality) || 'unknown';
            return h(Card, { className: 'result-card mf-scenario-result' }, h('div', { className: 'result-badge ' + cls }, h(Icon, { name: 'alert', size: 22 }), h('div', {}, h('h2', {}, title), h('p', {}, subtitle))), h('div', { className: 'result-metrics' }, h('div', {}, h('span', {}, 'Parcela'), h('strong', {}, fmt(out.monthly))), h('div', {}, h('span', {}, 'Total com juros'), h('strong', {}, fmt(out.total))), h('div', {}, h('span', {}, 'Menor saldo sem compra'), h('strong', {}, fmt(out.baselineMinimum))), h('div', {}, h('span', {}, 'Menor saldo com compra'), h('strong', { className: out.minimumAfterPurchase < 0 ? 'bad-text' : '' }, fmt(out.minimumAfterPurchase)))), h('p', { className: 'mf-scenario-alert' }, 'Dia mais apertado: ' + out.worstDay.split('-').reverse().join('/') + ' · Reserva considerada: ' + fmt(out.reserve)), h('div', { className: 'u3-cost-strip' }, h('span', {}, 'Valor original ', h('b', {}, fmt(out.principal))), h('span', {}, 'Juros totais ', h('b', {}, fmt(out.interest))), h('span', {}, 'Total ', h('b', {}, fmt(out.total)))), h(U3ScenarioChart, { rows: out.rows }), h('details', { className: 'u3-monthly-data' }, h('summary', {}, 'Ver valores por mês · ' + out.rows.length + ' meses'), h('div', { className: 'u3-comparison-scroll' }, h('table', {}, h('caption', {}, 'Fechamento mensal estimado · não representa o menor saldo diário'), h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Mês'), h('th', { scope: 'col' }, 'Sem compra'), h('th', { scope: 'col' }, 'Com compra'))), h('tbody', {}, out.rows.map((v) => h('tr', { key: v.month }, h('th', { scope: 'row' }, prettyMonth(v.month)), h('td', {}, fmt(v.withoutPurchase)), h('td', { className: v.withPurchase < 0 ? 'bad-text' : '' }, fmt(v.withPurchase)))))))), h('button', { type: 'button', className: 'primary-button mf-plan-from-sim',
                disabled: out.installments > 36 || !this.canPlanSimulatedPurchase(out),
                title: !this.canPlanSimulatedPurchase(out) ? 'Recalcule as premissas antes de planejar esta compra.' : undefined,
                onClick: () => this.planSimulatedPurchase() }, 'Planejar esta compra'), out.installments > 36 ? h('p', { className: 'muted-desc' }, 'Para registrar o compromisso, simule até 36 parcelas.') : null, h('p', { className: 'disclaimer' }, quality === 'stale' ? 'A última leitura do banco está antiga. Atualize as contas antes de tomar decisões. ' : quality === 'incomplete' ? 'Há contas sem saldo disponível. A projeção está incompleta. ' : quality === 'unverified' ? 'O saldo recebido pode não refletir as movimentações mais recentes. ' : '', out.warning));
        }
        const r = out.risk;
        const info = { safe: ['Cenário favorável, não garantia', 'Seu perfil informado indica margem para acomodar a parcela.', 'safe'], caution: ['Atenção ao orçamento', 'A compra reduz sua margem ou compromete uma parte relevante da renda.', 'caution'], risk: ['Compra arriscada', 'A projeção pode ultrapassar a margem informada ou comprometer sua reserva.', 'danger'], unknown: ['Dados insuficientes', 'Defina renda e despesas fixas em Configurações para avaliar o risco.', 'unknown'] };
        const [title, subtitle, cls] = info[r];
        const ratios = out.hasProfile ? Math.round(out.monthly / this.state.data.settings.income * 100) : null;
        return h(Card, { className: 'result-card' }, h('div', { className: 'result-badge ' + cls }, h(Icon, { name: r === 'safe' ? 'check' : 'alert', size: 22 }), h('div', {}, h('h2', {}, title), h('p', {}, subtitle))), h('div', { className: 'result-metrics' }, h('div', {}, h('span', {}, 'Parcela'), h('strong', {}, fmt(out.monthly))), h('div', {}, h('span', {}, 'Custo total'), h('strong', {}, fmt(out.total))), h('div', {}, h('span', {}, 'Juros totais'), h('strong', {}, fmt(out.total - out.principal))), h('div', {}, h('span', {}, 'Peso na renda'), h('strong', {}, ratios === null ? '—' : ratios + '%'))), h('div', { className: 'future-title' }, 'Projeção dos próximos meses'), h('div', { className: 'future-list' }, out.rows.slice(0, 6).map((v) => h('div', { key: v.month }, h('span', {}, prettyMonth(v.month)), h('b', { className: v.available < 0 ? 'bad-text' : '' }, fmt(v.available))))), h('p', { className: 'disclaimer' }, 'Projeção simplificada: começa no próximo mês e pressupõe os mesmos valores recorrentes informados. Não considera vencimentos diários, renda variável ou pagamentos já lançados. Não é garantia de capacidade de pagamento.'));
    }
    renderBankQuick() {
        if (this.state.mode === 'demo')
            return null;
        const b = this.state.bank, a = b.data.accounts || [], last = b.data.last;
        if (!a.length && !b.config.configured)
            return null;
        const coverage = bankBalanceCoverage(a);
        return h('div', { className: 'bank-quick' }, h('div', {}, h('small', {}, 'SALDOS INFORMADOS PELAS INSTITUIÇÕES'), h('strong', {}, a.length ? bankBalanceLabel(coverage) : 'Configuração bancária salva'), h('span', {}, a.length ? a.length + ' conta(s) · atualização: ' + ((last === null || last === void 0 ? void 0 : last.completedAt) ? new Date(last.completedAt).toLocaleString('pt-BR') : 'pendente') : 'Sincronize para obter suas contas')), h('button', { className: 'outlined-action', onClick: () => this.navigate('banks') }, 'Ver contas bancárias', h(Icon, { name: 'arrow', size: 16 })), h('p', {}, 'Saldos e extratos bancários não são somados aos lançamentos manuais para evitar duplicidades.'), b.data.truncated ? h('p', { className: 'bank-warning' }, 'Alguns registros antigos não estão incluídos nos totais exibidos. Uma atualização futura ampliará a consulta histórica.') : null);
    }
    renderBanks() {
        var _a, _b, _c, _d, _e;
        if (this.state.mode === 'demo')
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Suas contas estão disponíveis nos dados pessoais'), h('p', { className: 'muted-desc' }, 'O modo demonstração é isolado e nunca consulta suas contas bancárias.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')));
        if (!desktop)
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Abra o Meu Financeiro'), h('p', {}, 'Abra a versão instalada para consultar suas contas com segurança.')));
        const b = this.state.bank, c = b.config || EMPTY_BANK.config, accounts = b.data.accounts || [], tx = b.data.transactions || [], f = this.state.bankForm;
        const coverage = bankBalanceCoverage(accounts), now = Date.now(), signals = accounts.map(account => ({ account, ...u3AccountSignals(account, tx, now) })), attention = signals.filter(x => x.attention), shown = this.state.accountFocus === 'attention' ? signals.filter(x => x.attention) : signals;
        const issues = (b.data.items || []).filter(x => !['UPDATED', 'UPDATING'].includes(x.status));
        return h('div', { className: 'section bank-page u3-accounts' }, h('div', { className: 'u3-section-heading' }, h('div', {}, h('h2', {}, 'Seu dinheiro, conta por conta.'), h('p', {}, 'Saldos recebidos e qualidade da referência em um só lugar.')), h('button', { type: 'button', className: 'primary-button', disabled: !c.configured || this.state.bankBusy, onClick: () => this.syncBank() }, h(Icon, { name: 'refresh', size: 16 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar contas')), h('div', { className: 'mf-accounts-summary u3-account-summary' }, h(Card, { className: 'mf-account-total mf-border-reveal mf-tone-balance' }, h('small', {}, 'Saldo bancário de referência'), h('strong', {}, bankBalanceLabel(coverage)), h('p', {}, 'Não somado aos registros manuais')), h(Card, { className: 'mf-account-count mf-border-reveal mf-tone-neutral' }, h('small', {}, 'Contas com saldo informado'), h('strong', {}, coverage.knownCount + ' de ' + accounts.length), h('p', {}, coverage.missingCount ? coverage.missingCount + ' saldo(s) indisponível(is)' : 'Zero informado é diferente de saldo ausente')), h(Card, { className: 'u3-account-signal mf-border-reveal mf-tone-income' }, h('small', {}, 'Referência de até 24h'), h('strong', {}, signals.filter(x => x.reference.status === 'recent').length + ' conta(s)'), h('p', {}, 'O horário não garante saldo em tempo real')), h('button', { type: 'button', className: 'u3-account-signal u3-clickable-card mf-border-reveal mf-tone-warning', 'aria-pressed': this.state.accountFocus === 'attention', onClick: () => this.setState({ accountFocus: this.state.accountFocus === 'attention' ? 'all' : 'attention' }) }, h('small', {}, 'Conferir referência'), h('strong', {}, attention.length + ' conta(s)'), h('p', {}, 'Saldo ausente, antigo ou sem horário'))), issues.length ? h('div', { className: 'u3-connection-alert', role: 'status' }, h(Icon, { name: 'alert', size: 18 }), h('span', {}, issues.length + ' conexão(ões) precisam de conferência. Os valores abaixo podem estar desatualizados.'), h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ bankIntegrationsOpen: true }) }, 'Ver conexão')) : null, accounts.length ? h('section', { className: 'mf-accounts-first' }, h('div', { className: 'mf-bank-account-heading' }, h('h2', {}, 'Saldos por conta'), h('small', {}, 'Atualização: ' + (((_a = b.data.last) === null || _a === void 0 ? void 0 : _a.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'não informada'))), h('div', { className: 'u3-account-toolbar' }, h('div', { className: 'u2-view-tabs', 'aria-label': 'Filtro de contas' }, [{ value: 'all', label: 'Todas as contas' }, { value: 'attention', label: 'Conferir referência' }].map(x => h('button', { type: 'button', 'aria-pressed': (this.state.accountFocus || 'all') === x.value, onClick: () => this.setState({ accountFocus: x.value }) }, x.label))), h('span', {}, 'Contadores do histórico carregado · todos os períodos')), shown.length ? h('div', { className: 'bank-account-grid' }, shown.map(({ account: a, reference, pending, review, count }) => h(Card, { className: 'bank-account u3-account-card', key: a.id }, h('div', { className: 'u3-account-card-head' }, h('span', { className: 'bank-account-icon' }, h(Icon, { name: 'bank', size: 20 })), h('div', {}, h('h3', {}, a.name), h('small', {}, u3AccountType(a.subtype))), h('span', { className: 'u3-reference-badge is-' + reference.status }, reference.label)), h('small', { className: 'u3-balance-label' }, 'Saldo informado'), h('strong', {}, Number.isFinite(a.balance) ? fmt(a.balance) : 'Saldo não disponível'), h('span', { className: 'u3-reference-date' }, 'Referência recebida: ' + bankReferenceLabel(a.updatedAt)), h('div', { className: 'u3-account-counts' }, h('div', {}, h('b', {}, count), h('small', {}, 'registros')), h('div', {}, h('b', {}, pending), h('small', {}, 'pendentes no banco')), h('div', {}, h('b', {}, review), h('small', {}, 'a conferir'))), h('button', { type: 'button', className: 'u3-account-open', onClick: () => { this.setState({ bankFilter: a.id, txSource: 'bank', query: '', txSelected: [] }); this.navigate('transactions'); } }, 'Abrir movimentações', h(Icon, { name: 'arrow', size: 15 }))))) : h('p', { className: 'u3-empty' }, 'Nenhuma conta precisa de conferência de referência.')) :
            h(Card, { className: 'u3-empty-accounts' }, h(Icon, { name: 'bank', size: 28 }), h('h2', {}, c.configured ? 'Sua conexão está configurada' : 'Vamos conectar suas contas?'), h('p', {}, c.configured ? 'Atualize para receber as contas e seus saldos.' : 'Configure sua conexão abaixo. Nenhuma senha bancária é solicitada aqui.')), h('details', { className: 'mf-bank-integrations', open: this.state.bankIntegrationsOpen || !accounts.length, onToggle: (e) => { if (this.state.bankIntegrationsOpen !== e.currentTarget.open)
                this.setState({ bankIntegrationsOpen: e.currentTarget.open }); } }, h('summary', {}, h(Icon, { name: 'settings', size: 17 }), 'Conexão e sincronização'), h('div', { className: 'bank-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Sua conexão bancária'), h('p', {}, c.configured ? 'Acesso conectado e protegido' : 'Conecte suas contas para acompanhar tudo aqui')), h('span', { className: 'bank-status ' + (c.configured ? 'enabled' : '') }, c.configured ? 'Configurada' : 'Não configurada')), !c.secure ? h('p', { className: 'bank-warning' }, 'Não foi possível proteger sua chave neste computador. Evite configurar a conexão agora.') : null, c.configured ? h('button', { type: 'button', className: 'bank-details-toggle', 'aria-expanded': this.state.bankConfigOpen, onClick: () => this.setState({ bankConfigOpen: !this.state.bankConfigOpen }) }, h(Icon, { name: 'settings', size: 16 }), this.state.bankConfigOpen ? 'Ocultar detalhes da conexão' : 'Alterar dados da conexão') : null, (!c.configured || this.state.bankConfigOpen) ? h('div', { className: 'bank-settings-details' }, this.field('Código da aplicação', h('input', { className: 'form-control', value: f.clientId, placeholder: 'Cole o código de identificação', maxLength: 300, autoComplete: 'off', onChange: (e) => this.setState({ bankForm: { ...f, clientId: e.target.value } }) })), this.field('Chave privada', h('input', { className: 'form-control', type: 'password', value: f.clientSecret, placeholder: c.configured ? 'Já protegido — deixe vazio para manter' : 'Cole sua chave de acesso', maxLength: 1000, autoComplete: 'new-password', onChange: (e) => this.setState({ bankForm: { ...f, clientSecret: e.target.value } }) })), this.field('Código da conexão (separe por vírgula, se houver mais de uma)', h('textarea', { className: 'form-control bank-item-field', value: f.itemIds, rows: 2, placeholder: 'Cole o código da conta autorizada', onChange: (e) => this.setState({ bankForm: { ...f, itemIds: e.target.value } }) }), 'Use os códigos fornecidos ao autorizar a conexão. Nunca informe sua senha bancária.'), h('div', { className: 'bank-actions' }, h('button', { className: 'primary-button', disabled: !c.secure || this.state.bankBusy, onClick: () => this.configureBank() }, h(Icon, { name: 'shield', size: 17 }), 'Salvar conexão'))) : null, h('div', { className: 'bank-actions' }, h('button', { className: 'outlined-action full', disabled: !c.configured || this.state.bankBusy, onClick: () => this.syncBank() }, h(Icon, { name: 'refresh', size: 17 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar minhas contas')), h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Sua chave é protegida neste computador e não faz parte das cópias de segurança.'), c.configured ? h('button', { className: 'bank-forget', onClick: () => this.forgetBank(), disabled: this.state.bankBusy }, 'Desconectar conta deste computador') : null, this.state.bankMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.bankMessage) : null), h(Card, { className: 'settings-card' }, h('h2', {}, 'Resumo da sincronização'), h('div', { className: 'bank-metric-list' }, h('div', {}, h('span', {}, 'Contas bancárias'), h('strong', {}, String(accounts.length))), h('div', {}, h('span', {}, 'Movimentações no histórico local'), h('strong', {}, String((_b = b.data.totalTransactions) !== null && _b !== void 0 ? _b : tx.length))), h('div', {}, h('span', {}, 'Última sincronização'), h('strong', {}, ((_c = b.data.last) === null || _c === void 0 ? void 0 : _c.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'Nunca')), h('div', {}, h('span', {}, 'Novas na última consulta'), h('strong', {}, String((_e = (_d = b.data.last) === null || _d === void 0 ? void 0 : _d.newCount) !== null && _e !== void 0 ? _e : '—')))), h('p', { className: 'muted-desc' }, 'As instituições podem demorar para enviar novas movimentações. Atualizar busca as informações mais recentes disponíveis.'), h('div', { className: 'info-box' }, h(Icon, { name: 'alert', size: 19 }), h('p', {}, 'As movimentações do banco não são misturadas automaticamente aos lançamentos adicionados por você. Isso evita despesas em duplicidade.')), (b.data.items || []).map(x => h('div', { className: 'bank-item-info', key: x.itemId }, h('b', {}, (!x.institution || x.institution === 'Meu Pluggy' ? 'Conta conectada' : x.institution)), h('small', {}, 'Situação: ' + (x.status === 'UPDATED' ? 'Atualizada' : x.status === 'UPDATING' ? 'Atualizando' : x.status === 'LOGIN_ERROR' ? 'Precisa reconectar' : 'Verifique sua conexão')), h('small', {}, 'Consentimento: ' + (x.consentExpiresAt ? new Date(x.consentExpiresAt).toLocaleDateString('pt-BR') : 'conforme seu banco'))))))), h(Card, { className: 'mf-bank-route' }, h('div', {}, h('h2', {}, 'Histórico financeiro em um só lugar'), h('p', { className: 'muted-desc' }, 'Consulte as transações, revise categorias e veja detalhes em Movimentações. Aqui você gerencia apenas suas conexões e saldos.')), h('button', { className: 'primary-button', onClick: () => { this.setState({ bankFilter: '', txSource: 'bank' }); this.navigate('transactions'); } }, 'Ver movimentações', h(Icon, { name: 'arrow', size: 16 }))));
    }
    renderSettings() {
        var _a;
        const panels = collectSettingsPanels(this.renderSettingsContent());
        const options = [{ id: 'appearance', label: 'Aparência', icon: 'settings' }, { id: 'profile', label: 'Perfil financeiro', icon: 'wallet' },
            { id: 'data', label: 'Dados e recuperação', icon: 'folder' }, { id: 'integrations', label: 'Integrações', icon: 'bank' },
            { id: 'intelligence', label: 'Inteligência', icon: 'spark' }, { id: 'demo', label: 'Demonstração', icon: 'home' }];
        const selected = options.some(x => x.id === this.state.settingsSection) ? this.state.settingsSection : 'appearance';
        const appearance = h(Card, { className: 'settings-card mf-appearance-card' }, h('h2', {}, 'Aparência'), h('p', { className: 'muted-desc' }, 'Escolha como o Meu Financeiro aparece neste dispositivo.'), h('div', { className: 'mf-theme-previews', 'aria-hidden': 'true' }, h('div', { className: 'mf-theme-preview theme-light' }, h('i'), h('span'), h('b', {}, 'Claro')), h('div', { className: 'mf-theme-preview theme-dark' }, h('i'), h('span'), h('b', {}, 'Escuro'))), this.field('Tema em Configurações', h('select', { className: 'form-control', 'aria-label': 'Tema em Configurações', 'data-appearance': 'select', defaultValue: ((_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.get()) || 'system', onChange: (e) => { var _a; return (_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.set(e.target.value); } }, h('option', { value: 'light' }, 'Claro'), h('option', { value: 'dark' }, 'Escuro'), h('option', { value: 'system' }, 'Acompanhar o sistema'))), h('p', { className: 'muted-desc' }, 'A preferência é salva neste dispositivo. No modo automático, acompanha o tema do sistema.'));
        return h('section', { className: 'mf-settings-layout' }, h('nav', { className: 'mf-settings-nav', 'aria-label': 'Assuntos das configurações' }, options.map(option => h('button', { type: 'button', key: option.id, 'aria-current': selected === option.id ? 'page' : undefined, onClick: () => this.setState({ settingsSection: option.id }) }, h(Icon, { name: option.icon, size: 17 }), option.label))), h('div', { className: 'mf-settings-content', key: selected }, selected === 'appearance' ? appearance : panels[selected] || h(Card, { className: 'settings-card' }, h('h2', {}, 'Integrações'), h('p', { className: 'muted-desc' }, 'Abra a versão instalada para gerenciar as integrações disponíveis neste computador.'))));
    }
    renderSettingsContent() {
        var _a, _b, _c;
        const d = this.state.data;
        const entries = [['opening', 'Saldo inicial da conta', 'Saldo no início do acompanhamento.'], ['income', 'Renda mensal prevista', 'Use um valor conservador, sem depender de ganhos variáveis.'], ['fixed', 'Despesas fixas mensais', 'Contas recorrentes previstas, sem incluir parcelas abaixo.'], ['existing', 'Parcelas atuais por mês', 'Somatório de parcelas ainda em aberto.'], ['reserve', 'Reserva mínima protegida', 'Valor que deve permanecer disponível.']];
        return h('div', { className: 'section' }, h('div', { className: 'settings-grid' }, h(Card, { className: 'settings-card', 'data-settings-group': 'profile' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Seu perfil financeiro'), h('p', {}, 'Base utilizada nas projeções e recomendações'))), entries.map(([key, title, hint]) => h('div', { className: 'setting-row', key }, h('div', {}, h('b', {}, title), h('small', {}, hint)), h('button', { className: 'setting-edit', onClick: () => this.setState({ editModal: { type: 'setting', key, title, value: moneyString(d.settings[key]) } }) }, fmt(d.settings[key]), h(Icon, { name: 'edit', size: 16 }))))), h('div', { className: 'settings-right' }, desktop ? h(Card, { className: 'settings-card', 'data-settings-group': 'integrations' }, h('h2', {}, 'Sincronização na nuvem'), h('p', { className: 'muted-desc' }, this.state.cloudPersonalTransferred
            ? 'Suas personalizações estão na quarentena protegida da Cloudflare. A etapa bancária e a sincronização automática ainda não estão ativas.'
            : 'Clique para iniciar o backup automático e a transferência protegida de suas personalizações. Você confirmará o envio em uma janela do Windows.'), h('div', { className: 'backups-info' }, h(Icon, { name: 'shield', size: 18 }), h('div', {}, h('b', {}, this.state.cloudPersonalTransferred ? 'Personalizações verificadas na nuvem' : 'Dados protegidos no Windows'), h('small', {}, this.state.cloudIdentityConnected ? 'Login Cloudflare verificado · Sincronização financeira não ativada' : 'Nuvem financeira: ainda não ativada · Nenhum registro enviado'))), h('button', {
            className: 'outlined-action full', type: 'button',
            disabled: this.state.cloudBusy || this.state.busy || this.state.bankBusy || this.state.mode !== 'real' || this.state.cloudPersonalTransferred,
            onClick: () => void this.prepareCloudOnboarding()
        }, h(Icon, { name: 'cloud', size: 17 }), this.state.cloudBusy ? 'Conferindo dados...' : this.state.cloudPersonalTransferred ? 'Personalizações na quarentena' :
            'Iniciar migração protegida'), this.state.cloudMessage ? h('p', { className: 'muted-desc', role: 'status' }, this.state.cloudMessage) : null, h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'A comparação bancária envia somente requisições de leitura; o extrato local não é enviado.'), h('button', { className: 'outlined-action full', type: 'button',
            disabled: this.state.cloudParityBusy || this.state.busy || this.state.bankBusy || this.state.mode !== 'real',
            onClick: () => void this.auditCloudE1() }, h(Icon, { name: 'shield', size: 17 }), this.state.cloudParityBusy ? 'Executando E1...' : 'Executar auditoria E1 · Windows × Cloudflare'), this.state.cloudParityMessage ? h('p', { className: 'muted-desc', role: 'status' }, this.state.cloudParityMessage) : null, ((_a = this.state.cloudE1Report) === null || _a === void 0 ? void 0 : _a.checks) ? h('div', { className: 'mf-e1-results', role: 'status' }, ...Object.entries(this.state.cloudE1Report.checks).map(([code, check]) => {
            const status = check !== null && typeof check === 'object' && 'status' in check ? check.status : null;
            return h('div', { className: 'mf-e1-result', key: code }, h('b', {}, { 'bankIdentities': 'IDs bancários', 'bankDatesAndMoney': 'Datas e centavos',
                'bankDescriptionsAndStatuses': 'Descrições e status', 'accountIdentities': 'Contas',
                'categoryOriginals': 'Categorias originais', 'snapshotOriginal': 'Pacote pessoal original',
                'personalRowCounts': 'Contagens pessoais atuais', 'bankReferences': 'Vínculos bancários',
                'stagedAccountIntegrity': 'Referências de contas', 'nominalAccountBalances': 'Saldos numéricos',
                'duplicateDismissals': 'Duplicatas revisadas', 'providerHistoryCoverage': 'Cobertura histórica',
                'balanceTimestamp': 'Data do saldo', 'effectivePersonalEdits': 'Edições sincronizadas',
                'businessRules': 'Regras financeiras' }[code] || code), h('span', { className: 'muted-desc' }, status === 'verified' ? 'Verificado' :
                status === 'mismatch' ? 'Divergente' : 'Pendente'));
        })) : null, ((_c = (_b = this.state.cloudE1Report) === null || _b === void 0 ? void 0 : _b.monthDeltas) === null || _c === void 0 ? void 0 : _c.ok) === true ? h('div', { className: 'mf-e1-results', role: 'status' }, h('b', {}, 'Comparação por mês: ' + (this.state.cloudE1Report.monthDeltas.totalDifferenceMonths || 0) + ' mês(es) com diferenças'), ...this.state.cloudE1Report.monthDeltas.items.map(month => h('div', { className: 'mf-e1-result', key: month.month }, h('b', {}, month.month.slice(5, 7) + '/' + month.month.slice(0, 4)), h('span', { className: 'muted-desc' }, 'Windows: ' + month.windowsCount + ' · Cloudflare: ' + month.cloudCount + ' · ' +
            (month.status === 'count_difference' ? 'quantidades diferentes' :
                month.status === 'identity_difference' ? 'IDs diferentes' :
                    month.status === 'amount_or_date_difference' ? 'datas ou valores diferentes' :
                        'descrições ou status diferentes')))), this.state.cloudE1Report.monthDeltas.limitedResults ?
            h('p', { className: 'muted-desc' }, 'Análise mensal limitada; detalhes restantes precisam ser conferidos.') : null) : null) : null, h(Card, { className: 'settings-card', 'data-settings-group': 'data' }, h('h2', {}, 'Dados e cópias de segurança'), h('p', { className: 'muted-desc' }, desktop ? (this.state.cloudPersonalTransferred ? 'Existem personalizações em quarentena protegida na nuvem; a sincronização financeira ainda não foi ativada. A cópia local completa é independente da exportação manual.' : 'A cópia SQLite completa e a exportação de lançamentos manuais são diferentes. Credenciais bancárias são guardadas separadamente.') : 'A exportação de lançamentos manuais não é um backup completo do banco SQLite.'), h('button', { className: 'outlined-action full', onClick: () => this.exportJSON() }, h(Icon, { name: 'download', size: 17 }), 'Exportar lançamentos manuais'), h('button', { className: 'outlined-action full', onClick: () => { var _a; return (_a = this.fileInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Importar lançamentos manuais'), desktop ? h('button', { className: 'outlined-action full', onClick: () => this.backupDB() }, h(Icon, { name: 'download', size: 17 }), 'Salvar cópia completa') : null, desktop ? h('button', { className: 'outlined-action full', onClick: () => this.restoreDB() }, h(Icon, { name: 'upload', size: 17 }), 'Restaurar cópia completa') : null, desktop ? h('div', { className: 'backups-info' }, h(Icon, { name: 'shield', size: 18 }), h('div', {}, h('b', {}, 'Cópias automáticas locais'), h('small', {}, this.state.backupInfo.last ? 'Última cópia: ' + new Date(this.state.backupInfo.last).toLocaleString('pt-BR') + ' · Até 7 datas preservadas' : 'Uma cópia por dia em que o app estiver aberto.'))) : null, desktop ? h('button', { className: 'outlined-action full', onClick: () => this.openBackupsFolder() }, h(Icon, { name: 'folder', size: 17 }), 'Ver minhas cópias automáticas') : null, desktop ? h('button', { className: 'outlined-action full', onClick: () => this.openDataDir() }, h(Icon, { name: 'bank', size: 17 }), 'Abrir pasta dos meus dados') : null, h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Exportar lançamentos manuais não substitui uma cópia completa. Consulte a situação da nuvem acima.')), h('div', { 'data-settings-group': 'intelligence' }, renderIntelligenceSettings(this)), h(Card, { className: 'settings-card', 'data-settings-group': 'demo' }, h('h2', {}, 'Modo de demonstração'), h('p', { className: 'muted-desc' }, 'O modo de demonstração tem transações fictícias e armazenamento separado dos seus dados pessoais.'), h('button', { className: 'outlined-action full', onClick: () => this.toggleMode() }, this.state.mode === 'real' ? 'Entrar na demonstração' : 'Voltar aos dados pessoais', h(Icon, { name: 'arrow', size: 16 }))))));
    }
    renderDetailDrawer() {
        var _a;
        const selected = this.state.detail;
        if (!selected)
            return null;
        const bank = selected.origin === 'bank';
        const tx = bank ? this.state.bank.data.transactions.find(t => t.accountId === selected.accountId && t.id === selected.id) : null;
        const manual = !bank ? this.state.data.transactions.find(t => t.id === selected.id) : null;
        if (!tx && !manual)
            return null;
        const name = (tx === null || tx === void 0 ? void 0 : tx.merchant) || (tx === null || tx === void 0 ? void 0 : tx.description) || (manual === null || manual === void 0 ? void 0 : manual.description) || '';
        const amount = tx ? tx.amount : manual ? (manual.kind === 'income' ? manual.amount : -manual.amount) : 0;
        const category = (tx === null || tx === void 0 ? void 0 : tx.category) || (manual === null || manual === void 0 ? void 0 : manual.category) || 'Outros';
        const cats = this.getCategories();
        const cat = cats.find(c => c.name === category);
        const f = this.state.detailDraft;
        const matchSuggestions = tx && tx.status === 'POSTED' ? this.state.data.transactions.filter(m => m.kind === (tx.amount >= 0 ? 'income' : 'expense') && m.amount === Math.abs(tx.amount) && Math.abs((Date.parse(m.date + 'T00:00:00Z') - Date.parse(tx.date + 'T00:00:00Z')) / 86400000) <= 3 && !this.state.bank.data.transactions.some(other => other.linkedManualId === m.id && (other.id !== tx.id || other.accountId !== tx.accountId))).slice(0, 6) : [];
        const opposite = tx ? this.state.bank.data.transactions.filter(other => other.accountId !== tx.accountId && other.amount === -tx.amount && Math.abs((Date.parse(other.date + 'T00:00:00Z') - Date.parse(tx.date + 'T00:00:00Z')) / 86400000) <= 2 && other.status === 'POSTED').slice(0, 3) : [];
        const splitTotal = f.splitParts.reduce((a, p) => a + parseMoney(p.value), 0);
        return h('div', { className: 'mf-drawer-backdrop', role: 'presentation', onMouseDown: (e) => { if (e.currentTarget === e.target)
                this.setState({ detail: null }); } }, h('aside', { className: 'mf-detail-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Detalhes da movimentação' }, h('div', { className: 'mf-drawer-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'DETALHES'), h('h2', {}, 'Movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', title: 'Fechar', onClick: () => this.setState({ detail: null }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'mf-detail-scroll' }, h('div', { className: 'mf-detail-hero' }, h('span', { className: 'mf-hero-emoji' }, (cat === null || cat === void 0 ? void 0 : cat.emoji) || '✨'), h('h3', {}, name), h('strong', { className: amount >= 0 ? 'good-text' : 'bad-text' }, (amount >= 0 ? '+' : '−') + fmt(Math.abs(amount))), h('span', {}, ((tx === null || tx === void 0 ? void 0 : tx.date) || (manual === null || manual === void 0 ? void 0 : manual.date) || '').split('-').reverse().join('/') + ' · ' + ((tx === null || tx === void 0 ? void 0 : tx.accountName) || 'Adicionado por você'))), h('button', { type: 'button', className: 'mf-ai-detail-trigger', onClick: () => this.openIntelligenceContext('transactions') }, h(Icon, { name: 'spark', size: 17 }), 'Analisar com Inteligência', h('span', {}, 'Prévia')), tx ? h('div', { className: 'mf-detail-section' }, h('div', { className: 'mf-detail-section-title' }, h('b', {}, 'Organização'), h('span', { className: tx.reviewed ? 'mf-reviewed' : 'mf-to-review' }, tx.reviewed ? '✓ Revisada' : 'A conferir')), h('div', { className: 'mf-detail-grid' }, this.field('Categoria principal', h(StyledSelect, { className: 'mf-transaction-category-select', value: tx.category, disabled: this.state.categorySaving.includes(tx.accountId + '|' + tx.id), options: cats.map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (v) => this.setBankCategory(tx, v) })), this.field('Tipo de movimentação', h(StyledSelect, { value: f.nature, options: [{ value: 'auto', label: 'Padrão' }, { value: 'income', label: 'Receita' }, { value: 'expense', label: 'Despesa' }, { value: 'transfer', label: 'Transferência própria' }, { value: 'ignore', label: 'Não contar nas análises' }], onChange: (nature) => this.setState({ detailDraft: { ...f, nature } }) }))), this.field('Nome do estabelecimento', h('input', { className: 'form-control', value: f.merchant, maxLength: 100, placeholder: 'Ex.: iFood, Mercado, Academia', onChange: (e) => this.setState({ detailDraft: { ...f, merchant: e.target.value } }) })), this.field('Anotações pessoais', h('textarea', { className: 'form-control mf-note-input', rows: 3, value: f.note, maxLength: 600, placeholder: 'Opcional: detalhes para lembrar desta compra', onChange: (e) => this.setState({ detailDraft: { ...f, note: e.target.value } }) })), h('label', { className: 'mf-review-checkbox' }, h('input', { type: 'checkbox', checked: f.reviewed, onChange: (e) => this.setState({ detailDraft: { ...f, reviewed: e.target.checked } }) }), 'Conferi esta movimentação'), h('button', { className: 'primary-button mf-full-action', disabled: this.state.detailBusy, onClick: () => this.updateBankInfo() }, 'Salvar detalhes')) : null, tx ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Reconhecer estabelecimento'), h('p', { className: 'muted-desc' }, 'Aplique o nome escolhido às próximas movimentações com o mesmo trecho de descrição.'), this.field('Trecho que identifica esse estabelecimento', h('input', { className: 'form-control', value: f.aliasPattern, maxLength: 120, onChange: (e) => this.setState({ detailDraft: { ...f, aliasPattern: e.target.value } }) })), h('button', { className: 'outlined-action full', disabled: this.state.detailBusy, onClick: () => this.createMerchantAlias() }, 'Usar este nome nas movimentações semelhantes'), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => this.createCategoryRuleFromDetail() }, 'Usar categoria nas movimentações semelhantes'), (this.state.bank.data.aliases || []).filter(a => fold(tx.description).includes(fold(a.pattern))).map(a => h('div', { className: 'mf-suggestion', key: a.id }, h('small', {}, 'Regra: ' + a.pattern + ' → ' + a.displayName), h('button', { className: 'mf-small-link', disabled: this.state.detailBusy, onClick: async () => { if (!confirm('Remover esta regra de nome?'))
                return; try {
                const data = await desktop.bankDeleteAlias(a.id);
                this.setState({ bank: { ...this.state.bank, data } });
                this.flash('Regra removida.');
            }
            catch (e) {
                this.flash('Não foi possível remover: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            } } }, 'Excluir')))) : null, tx && tx.amount < 0 ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Dividir compra'), h('p', { className: 'muted-desc' }, 'Distribua o valor entre categorias sem alterar o total da compra original.'), tx.splitOutdated ? h('p', { className: 'mf-inline-warning' }, 'O banco atualizou o valor desta compra. Revise a divisão antes de aplicá-la novamente.') : null, f.splitParts.map((part, i) => h('div', { className: 'mf-split-row', key: i }, h(StyledSelect, { value: part.category, options: cats.map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (category) => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.map((v, j) => i === j ? { ...v, category } : v) } }) }), h('input', { className: 'form-control', value: part.value, inputMode: 'decimal', placeholder: '0,00', onChange: (e) => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.map((v, j) => i === j ? { ...v, value: e.target.value } : v) } }) }), h('button', { className: 'mf-small-link', title: 'Remover parte', disabled: f.splitParts.length <= 2, onClick: () => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.filter((_, j) => j !== i) } }) }, h(Icon, { name: 'close', size: 18 })))), h('div', { className: 'mf-detail-split-footer' }, h('button', { className: 'mf-small-link', disabled: f.splitParts.length >= 20, onClick: () => this.setState({ detailDraft: { ...f, splitParts: [...f.splitParts, { category: category, value: '0,00' }] } }) }, '+ Adicionar parte'), h('strong', { className: splitTotal === Math.abs(tx.amount) ? 'good-text' : 'bad-text' }, fmt(Number.isFinite(splitTotal) ? splitTotal : 0) + ' / ' + fmt(Math.abs(tx.amount)))), h('div', { className: 'mf-action-row' }, h('button', { className: 'primary-button', disabled: this.state.detailBusy || splitTotal !== Math.abs(tx.amount) || f.splitParts.some(p => parseMoney(p.value) <= 0), onClick: () => this.saveSplit() }, 'Salvar divisão'), h('button', { className: 'ghost-button', disabled: this.state.detailBusy || !((_a = tx.splits) === null || _a === void 0 ? void 0 : _a.length), onClick: () => this.runBankOperation('bankSplit', { accountId: tx.accountId, externalId: tx.id, parts: [] }, 'Divisão removida.') }, 'Remover divisão'))) : null, tx ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Conferir com um lançamento seu'), tx.linkedManualId ? h('div', { className: 'mf-suggestion' }, h('span', {}, '✓ Vinculado a um lançamento que você adicionou'), h('button', { className: 'mf-small-link', disabled: this.state.detailBusy, onClick: () => this.setManualLink(null) }, 'Desvincular')) :
            matchSuggestions.length ? matchSuggestions.map(m => h('div', { className: 'mf-suggestion', key: m.id }, h('div', {}, h('b', {}, m.description), h('small', {}, m.date.split('-').reverse().join('/') + ' · ' + fmt(m.amount))), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => this.setManualLink(m.id) }, 'Vincular'))) : h('p', { className: 'muted-desc' }, 'Nenhum lançamento manual com mesmo valor, tipo e data próxima.')) : null, tx && opposite.length ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Possível transferência entre suas contas'), h('p', { className: 'muted-desc' }, 'Encontramos um valor oposto em outra conta. Confira antes de classificar.'), opposite.map(other => h('div', { className: 'mf-suggestion', key: other.id }, h('span', {}, other.accountName + ' · ' + fmt(Math.abs(other.amount))), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => { if (confirm('Marcar ambas como transferência própria?'))
                this.runBankOperation('bankBatch', { items: [{ accountId: tx.accountId, externalId: tx.id }, { accountId: other.accountId, externalId: other.id }], nature: 'transfer', reviewed: true }, 'Movimentações marcadas como transferência interna.'); } }, 'Marcar ambas')))) : null, manual && this.state.manualDraft ? h('div', { className: 'mf-detail-section mf-manual-editor' }, h('b', {}, 'Editar lançamento manual'), h('p', { className: 'muted-desc' }, 'Altere os dados deste lançamento sem modificar os extratos das instituições conectadas.'), this.field('Descrição', h('input', { className: 'form-control', maxLength: 150, value: this.state.manualDraft.description,
            onChange: (e) => this.setState({ manualDraft: { ...this.state.manualDraft, description: e.target.value } }) })), h('div', { className: 'mf-detail-grid' }, this.field('Valor (R$)', h('input', { className: 'form-control', inputMode: 'decimal',
            value: this.state.manualDraft.value, disabled: this.isManualLinked(manual.id),
            onChange: (e) => this.setState({ manualDraft: { ...this.state.manualDraft, value: e.target.value } }) })), this.field('Data', h(SingleDatePicker, { value: this.state.manualDraft.date,
            disabled: this.isManualLinked(manual.id),
            onChange: (value) => this.setState({ manualDraft: { ...this.state.manualDraft, date: value } }) }))), this.field('Categoria do lançamento', h(StyledSelect, {
            className: 'mf-transaction-category-select', value: this.state.manualDraft.category,
            options: cats.filter(c => manual.kind === 'income' ? c.kind !== 'expense' : c.kind !== 'income')
                .map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })),
            onChange: (v) => this.setState({ manualDraft: { ...this.state.manualDraft, category: v } })
        })), this.isManualLinked(manual.id) ? h('p', { className: 'mf-manual-warning' }, 'Lançamento vinculado a uma movimentação bancária: desvincule antes de alterar data, valor ou excluir.') : null, h('div', { className: 'mf-manual-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: this.state.busy,
            onClick: () => this.saveManualDetail(manual.id) }, h(Icon, { name: 'check', size: 16 }), 'Salvar alterações'), h('button', { type: 'button', className: 'ghost-button', disabled: this.state.busy,
            onClick: () => this.setState({ manualDraft: { description: manual.description, date: manual.date,
                    value: moneyString(manual.amount), category: manual.category } }) }, 'Cancelar alterações'), h('button', { type: 'button', className: 'ghost-button mf-danger-action',
            disabled: this.state.busy || this.isManualLinked(manual.id),
            onClick: () => this.removeEntry(manual.id) }, 'Excluir lançamento'))) : null, tx ? h('div', { className: 'mf-detail-section mf-raw-details' }, h('b', {}, 'Detalhes originais'), h('p', {}, tx.description), h('small', {}, 'Identificador de referência disponível apenas neste computador.')) : null)));
    }
    renderEditModal() { const item = this.state.editModal; if (!item)
        return null; return h('div', { className: 'modal-backdrop ' + (item.type === 'budget' ? 'mf-budget-edit-backdrop' : ''), onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ editModal: null }); } }, h('div', { className: 'modal small-modal ' + (item.type === 'budget' ? 'mf-budget-editor' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': item.type === 'budget' ? 'Editar limite da categoria' : 'Editar valor' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'PERSONALIZAÇÃO'), h('h2', {}, item.title)), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', onClick: () => this.setState({ editModal: null }) }, h(Icon, { name: 'close', size: 18 }))), this.field(item.type === 'budget' ? 'Limite da categoria (R$)' : 'Valor (R$)', h('input', { className: 'form-control', value: item.value, inputMode: 'decimal', autoFocus: true, placeholder: item.type === 'budget' ? 'Ex.: 150,00' : '0,00', onChange: (e) => this.setState({ editModal: { ...item, value: e.target.value } }) }), item.type === 'budget' ? 'Limite vinculado à categoria, não exclusivo do mês exibido. Em branco remove o limite; R$ 0,00 mantém zero explícito.' : undefined), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ editModal: null }) }, 'Cancelar'), h('button', { className: 'primary-button', disabled: this.state.busy, onClick: async () => { const saved = item.type === 'budget' ? await this.setBudget(item.key, item.value) : await this.setSetting(item.key, item.value); if (saved)
            this.setState({ editModal: null }); } }, h(Icon, { name: 'check', size: 18 }), 'Salvar alteração')))); }
    renderEntryModal() { const f = this.state.entry; return h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ showEntry: false }); } }, h('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Registrar movimentação' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'NOVO LANÇAMENTO'), h('h2', {}, 'Registrar movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', onClick: () => this.setState({ showEntry: false }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'segmented' }, ['expense', 'income'].map(k => h('button', { key: k, className: f.kind === k ? 'selected' : '', onClick: () => this.setState({ entry: { ...f, kind: k, category: this.state.entryCategoryTouched && this.getCategories().some(c => c.name === f.category && (k === 'income' ? c.kind !== 'expense' : c.kind !== 'income')) ? f.category : k === 'income' ? 'Salário' : 'Outros' } }) }, k === 'expense' ? 'Despesa' : 'Receita'))), this.field('Descrição', h('input', { className: 'form-control', placeholder: 'Ex.: supermercado', value: f.description, maxLength: 150, onChange: (e) => { const description = e.target.value; const category = this.state.entryCategoryTouched ? f.category : (findCategoryRule(description, 'manual', this.state.rules) || 'Outros'); this.setState({ entry: { ...f, description, category } }); } })), h('div', { className: 'two-inputs' }, this.field('Valor (R$)', h('input', { className: 'form-control', placeholder: '0,00', inputMode: 'decimal', value: f.value, onChange: (e) => this.setState({ entry: { ...f, value: e.target.value } }) })), this.field('Data', h(SingleDatePicker, { value: f.date, onChange: (value) => this.setState({ entry: { ...f, date: value } }) }))), this.field('Categoria', h(StyledSelect, { className: 'form-control', value: f.category, options: this.getCategories().filter(c => f.kind === 'income' ? c.kind !== 'expense' : c.kind !== 'income').map(c => ({ value: c.name, label: (c.emoji || '✨') + '  ' + c.name })), onChange: (value) => this.setState({ entry: { ...f, category: value }, entryCategoryTouched: true }) })), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ showEntry: false }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => this.saveEntry() }, h(Icon, { name: 'check', size: 18 }), 'Salvar lançamento')))); }
    render() { if (this.state.fatal)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Não foi possível abrir seus dados'), h('p', {}, this.state.fatal), h('p', {}, 'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.')); if (this.state.booting && desktop)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Meu Financeiro'), h('p', {}, 'Preparando seus dados…')); return h('div', { className: 'shell' }, this.renderSide(), h('main', { className: 'main-area ' + (this.state.page === 'overview' ? 'u1-shell' : ['transactions', 'planning'].includes(this.state.page) ? 'u2-shell' : ['budgets', 'banks', 'assistant'].includes(this.state.page) ? 'u3-shell' : '') }, this.renderWorkspaceBar(), this.renderTop(), this.state.mode === 'demo' ? h('div', { className: 'demo-strip' }, h(Icon, { name: 'spark', size: 17 }), 'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.', h('button', { onClick: () => this.toggleMode() }, 'Sair da demonstração')) : null, ({ overview: this.renderOverview, planning: this.renderPlanning, transactions: this.renderMovements, budgets: this.renderBudgets, banks: this.renderBanks, categories: this.renderCategories, assistant: this.renderAssistant, settings: this.renderSettings, intelligence: () => renderIntelligenceView(this) }[this.state.page] || this.renderOverview).call(this), h('footer', { className: 'footer' }, h('span', {}, desktop ? 'Meu Financeiro v0.9.5-beta.8 · Interface U3 · Feito para você' : 'Meu Financeiro v0.9.5-beta.8 · Interface U3 · Feito para você'), h('span', {}, this.state.cloudPersonalTransferred ? 'Personalizações em revisão na nuvem' : 'Fonte local · integração sob autorização'))), this.state.toast ? h('div', { className: 'toast' }, h(Icon, { name: 'check', size: 17 }), this.state.toast) : null, this.state.showEntry ? this.renderEntryModal() : null, this.state.editModal ? this.renderEditModal() : null, this.state.detail ? this.renderDetailDrawer() : null, this.state.quickCategory ? this.renderQuickCategoryPopover() : null, this.state.planOpen ? this.renderPlanModal() : null, this.state.planSelected ? this.renderPlanDetail() : null, renderIntelligencePanel(this), !this.state.intelligencePanelOpen && !this.state.showEntry && !this.state.editModal && !this.state.detail && !this.state.planOpen && !this.state.planSelected ? h('button', { type: 'button', className: 'mf-ai-fab', 'aria-label': 'Perguntar à IA sobre esta página', title: 'Perguntar à IA sobre esta página', onClick: () => this.openIntelligenceContext() }, h(Icon, { name: 'spark', size: 24 })) : null, h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, ref: (e) => this.fileInput = e, onChange: (e) => { var _a; if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0])
            this.importJSON(e.target.files[0]); e.target.value = ''; } }), h('input', { type: 'file', accept: '.csv,text/csv', style: { display: 'none' }, ref: (e) => this.csvInput = e, onChange: (e) => { var _a; if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0])
            this.importCSV(e.target.files[0]); e.target.value = ''; } })); }
}
function splitCSV(line, separator) { const result = []; let current = '', quoted = false; for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
            current += '"';
            i++;
        }
        else
            quoted = !quoted;
    }
    else if (ch === separator && !quoted) {
        result.push(current);
        current = '';
    }
    else
        current += ch;
} result.push(current); return result; }
function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
ReactDOM.render(h(App, {}), document.getElementById('app'));
function pDate(v) { return v.split('-').reverse().join('/'); }
function pShort(v) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''); }
function pStatus(v) { return { paid: 'Pago', pending: 'Pendente', overdue: 'Vencido', cancelled: 'Cancelado' }[v] || v; }
function pChip(v) { return h('span', { className: 'p-chip p-chip-' + v }, pStatus(v)); }
function pFilterTransactions(app) {
    const s = app.state, month = s.planMonth, t = s.planTerm.trim().toLowerCase(), mode = s.planView;
    const planned = s.planning.items.filter((i) => i.dueDate.slice(0, 7) === month).map((i) => { var _a, _b; return ({ key: 'plan:' + i.id, type: 'planned', kind: i.kind, date: i.dueDate, title: i.title, original: ((_b = (_a = i.links) === null || _a === void 0 ? void 0 : _a.find(l => l.status === 'POSTED')) === null || _b === void 0 ? void 0 : _b.description) || '', category: i.category, amount: i.amount, status: i.effectiveStatus, item: i }); });
    const linked = new Set();
    for (const i of s.planning.items)
        for (const l of i.links || [])
            if (l.status === 'POSTED')
                linked.add(l.accountId + '|' + l.externalId);
    const allBank = s.mode === 'demo' ? [] : s.bank.data.transactions.filter((i) => i.date.slice(0, 7) === month);
    const bank = allBank.filter((i) => mode === 'bank' || !linked.has(i.accountId + '|' + i.id)).map((i) => ({ key: 'bank:' + i.accountId + '|' + i.id, type: 'bank', kind: effectiveNature(i), date: i.date, title: i.customTitle || i.merchant || i.description, original: i.description, category: i.category, amount: Math.abs(i.amount), status: i.status === 'POSTED' ? 'paid' : 'pending', item: i }));
    const manualLinked = new Set(allBank.filter((b) => b.status === 'POSTED').map((b) => b.linkedManualId).filter(Boolean));
    const manual = s.data.transactions.filter((i) => i.date.slice(0, 7) === month && !manualLinked.has(i.id)).map((i) => ({ key: 'manual:' + i.id, type: 'manual', kind: i.kind, date: i.date, title: i.description, original: '', category: i.category, amount: i.amount, status: 'paid', item: i }));
    return [...planned, ...bank, ...manual].filter(x => (mode === 'all' || (mode === 'planned' && x.type === 'planned') || (mode === 'bank' && x.type === 'bank') || (mode === 'pending' && x.type === 'planned' && (x.status === 'pending' || x.status === 'overdue')) || (mode === 'paid' && x.status === 'paid')) && (!t || [x.title, x.original, x.category].join(' ').toLowerCase().includes(t))).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
function pUpcoming(app) {
    const today = iso(new Date()), endDate = new Date();
    endDate.setDate(endDate.getDate() + 6);
    const until = iso(endDate);
    const due = app.state.planning.items.filter((x) => x.status === 'planned' && x.kind === 'expense' && x.remaining > 0 && x.dueDate >= today && x.dueDate <= until).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.id).localeCompare(String(b.id)));
    const total = due.reduce((sum, item) => sum + item.remaining, 0);
    if (app.state.planning.generatedAt === '' && !app.state.planning.items.length)
        return h('section', { className: 'p-upcoming' }, h('h2', {}, 'Próximos sete dias'), h('p', { className: 'p-upcoming-empty' }, 'Atualize para carregar os compromissos.'));
    return h('section', { className: 'p-upcoming', 'aria-label': 'Compromissos dos próximos sete dias' }, h('div', { className: 'p-section-heading' }, h('div', {}, h('h2', {}, 'Próximos sete dias'), h('p', {}, 'Valores pendentes cadastrados · ' + pDate(today) + ' a ' + pDate(until))), h('strong', {}, due.length ? fmt(total) : 'Nenhum vencimento')), due.length ? h('div', { className: 'p-upcoming-list' }, due.slice(0, 5).map((item) => h('button', { type: 'button', className: 'p-upcoming-row', key: item.id, onClick: () => app.openPlanDetail(item.id) }, h('span', {}, h('b', {}, item.title), h('small', {}, pDate(item.dueDate) + ' · ' + item.category)), h('strong', {}, fmt(item.remaining)))), due.length > 5 ? h('p', { className: 'muted-desc' }, 'Mais ' + (due.length - 5) + ' compromisso(s) neste intervalo. Consulte a agenda completa abaixo.') : null) :
        h('p', { className: 'p-upcoming-empty' }, 'Nenhuma despesa pendente com vencimento nos próximos sete dias. Consulte a agenda para outros períodos.'));
}
function pMonthSummary(items, month, today) {
    const until = advanceDate(today, 6), open = items.filter(x => x.status === 'planned' && x.remaining > 0 && x.dueDate.slice(0, 7) === month);
    const expenses = open.filter(x => x.kind === 'expense'), overdue = expenses.filter(x => x.dueDate < today), soon = expenses.filter(x => x.dueDate >= today && x.dueDate <= until);
    const total = (xs) => xs.reduce((sum, x) => sum + x.remaining, 0);
    return { expense: total(expenses), income: total(open.filter(x => x.kind === 'income' && x.certainty === 'confirmed')), overdue: total(overdue), overdueCount: overdue.length, soon: total(soon), soonCount: soon.length };
}
function pSummary(app) {
    const s = app.state, p = s.planning, summary = pMonthSummary(p.items, s.planMonth, iso(new Date())), loaded = !!p.generatedAt || p.items.length > 0;
    const data = [{ label: 'Despesas a pagar', value: summary.expense, desc: 'Restante pendente · ' + prettyMonth(s.planMonth) },
        { label: 'Receitas a receber', value: summary.income, desc: 'Somente previsões confirmadas no mês' },
        { label: 'Vencidos no mês', value: summary.overdue, desc: summary.overdueCount + ' compromisso(s) aguardando pagamento' },
        { label: 'Próximos sete dias no mês', value: summary.soon, desc: summary.soonCount + ' compromisso(s) no intervalo' }];
    return h('div', { className: 'p-summary u2-metrics' }, data.map(x => h('article', { className: 'u2-metric', key: x.label }, h('span', {}, x.label), h('strong', {}, loaded ? fmt(x.value) : '—'), h('small', {}, loaded ? x.desc : 'Agenda ainda não carregada'))));
}
function pLedgerRow(app, r) {
    const category = app.getCategories().find((c) => c.name === r.category);
    return h('button', { type: 'button', className: 'p-ledger-row', key: r.key, onClick: () => r.type === 'planned' ? app.openPlanDetail(r.item.id) : r.type === 'bank' ? app.openPlanBankDetail(r.item) : app.openManualDetail(r.item) }, h('span', { className: 'p-ledger-icon', style: { background: category ? category.color + '25' : undefined } }, (category === null || category === void 0 ? void 0 : category.emoji) || '🧾'), h('span', { className: 'p-ledger-name' }, h('strong', {}, r.title), h('small', {}, r.category + ' · ' + (r.type === 'planned' ? (r.item.certainty === 'estimated' ? 'Planejado · estimativa incerta' : 'Planejado · previsão confirmada') : r.type === 'bank' ? (r.kind === 'transfer' ? 'Transferência própria · não contabilizada' : r.kind === 'ignore' ? 'Desconsiderada · não contabilizada' : 'Banco') : 'Manual')), r.original && r.original !== r.title ? h('small', {}, r.original) : null), h('span', { className: 'p-ledger-date' }, pDate(r.date)), pChip(r.status), h('span', { className: 'u2-ledger-amount' }, h('strong', { className: r.kind === 'income' ? 'good-text' : r.kind === 'expense' ? 'bad-text' : 'muted' }, (r.kind === 'income' ? '+' : r.kind === 'expense' ? '−' : '') + fmt(r.amount)), r.type === 'planned' && r.item.remaining > 0 ? h('small', {}, fmt(r.item.remaining) + ' restante') : null), h('span', { className: 'p-row-arrow' }, h(Icon, { name: 'chevron-right', size: 16 })));
}
function pAgenda(app, rows) {
    const shown = rows.slice(0, 350), groups = [...new Set(shown.map(r => r.date))];
    return h('div', { className: 'u2-agenda' }, groups.map(date => h('section', { className: 'u2-day-group', key: date }, h('h3', {}, pShort(date) + ' · ' + pDate(date), h('span', {}, rows.filter(r => r.date === date).length + ' registro(s)')), shown.filter(r => r.date === date).map(r => pLedgerRow(app, r)))), rows.length > 350 ? h('p', { className: 'muted-desc' }, 'Exibindo os primeiros 350 de ' + rows.length + ' registros. Refine os filtros para consultar os demais.') : null);
}
function pCalendarDayInfo(rows, date) {
    const matches = rows.filter(r => r.date === date);
    let recorded = 0, expected = 0, estimated = 0, excluded = 0, incoming = 0, outgoing = 0;
    for (const r of matches) {
        if (r.kind === 'transfer' || r.kind === 'ignore') {
            excluded++;
            continue;
        }
        if (r.type === 'planned' && r.item.certainty === 'estimated' && r.status !== 'paid')
            estimated++;
        else if (r.status === 'paid')
            recorded++;
        else
            expected++;
        if (r.kind === 'income')
            incoming += r.amount;
        else if (r.kind === 'expense')
            outgoing += r.amount;
    }
    return { count: matches.length, recorded, expected, estimated, excluded, incoming, outgoing };
}
function pCalendar(app, rows) {
    const month = app.state.planMonth, first = new Date(month + '-01T12:00:00').getDay(), days = Number(endOfMonth(month).slice(-2));
    const selected = app.state.planDay, dayRows = rows.filter(r => r.date === selected);
    const keyDay = (e, day) => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        const destination = e.key in delta ? day + delta[e.key] : e.key === 'Home' ? 1 : e.key === 'End' ? days : null;
        if (destination === null)
            return;
        e.preventDefault();
        e.stopPropagation();
        const next = month + '-' + String(Math.max(1, Math.min(days, destination))).padStart(2, '0');
        const grid = e.currentTarget.parentElement;
        app.setState({ planDay: next }, () => { var _a, _b, _c; return (_c = (_b = (_a = grid === null || grid === void 0 ? void 0 : grid.querySelector) === null || _a === void 0 ? void 0 : _a.call(grid, '[data-plan-day="' + next + '"]')) === null || _b === void 0 ? void 0 : _b.focus) === null || _c === void 0 ? void 0 : _c.call(_b); });
    };
    return h('div', { className: 'u2-calendar u5-plan-calendar' }, h('p', { className: 'muted-desc' }, 'Valores dos registros filtrados, não do saldo projetado. Use as setas para selecionar o dia.'), h('div', { className: 'u2-calendar-week', 'aria-hidden': 'true' }, ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => h('span', {}, day))), h('div', { className: 'u2-calendar-grid', 'aria-label': 'Dias de ' + prettyMonth(month) }, Array.from({ length: first }, (_, i) => h('span', { key: 'blank' + i, 'aria-hidden': true })), Array.from({ length: days }, (_, i) => {
        const date = month + '-' + String(i + 1).padStart(2, '0'), info = pCalendarDayInfo(rows, date);
        const tooltip = pDate(date) + ' · ' + info.count + ' registros · ' + info.recorded + ' realizados, ' +
            info.expected + ' previstos, ' + info.estimated + ' incertos, ' + info.excluded + ' não contabilizados · Entradas ' + fmt(info.incoming) + ' / Saídas ' + fmt(info.outgoing);
        return h('button', { type: 'button', key: date, 'data-plan-day': date,
            className: 'u5-plan-calendar-day' + (selected === date ? ' is-selected' : ''),
            'aria-pressed': selected === date, 'aria-label': tooltip, title: tooltip,
            onClick: () => app.setState({ planDay: date }), onKeyDown: (e) => keyDay(e, i + 1) }, h('b', {}, i + 1), h('small', {}, info.count ? info.count + ' registro(s)' : '—'), info.count ? h('span', { className: 'u5-plan-calendar-status' }, info.recorded ? h('span', { className: 'recorded' }, info.recorded + ' realizado(s)') : null, info.expected ? h('span', { className: 'expected' }, info.expected + ' previsto(s)') : null, info.estimated ? h('span', { className: 'estimated' }, info.estimated + ' incerto(s)') : null, info.excluded ? h('span', { className: 'excluded' }, info.excluded + ' fora do fluxo') : null) : null, info.count ? h('span', { className: 'u5-plan-day-flow' }, info.incoming ? h('span', { className: 'good-text' }, '+' + fmt(info.incoming)) : null, info.outgoing ? h('span', { className: 'bad-text' }, '−' + fmt(info.outgoing)) : null) : null);
    })), h('h3', { className: 'u2-calendar-selected' }, pDate(selected) + ' · ' + dayRows.length + ' registro(s)'), dayRows.length ? pAgenda(app, dayRows) : h('p', { className: 'p-empty-list' }, 'Nenhum compromisso ou registro nesta data para os filtros aplicados.'));
}
function pTimeline(app) {
    const s = app.state, today = iso(new Date()), month = s.planMonth, start = month + '-01', last = endOfMonth(month), max = Number(last.slice(-2));
    const timeline = s.planning.timeline || { rows: [], historicalNotice: null };
    const rows = timeline.rows;
    const byDay = new Map(rows.map(r => [r.date, r]));
    const selected = byDay.get(s.planDay), previous = byDay.get(advanceDate(s.planDay, -1));
    const delta = selected && previous ? selected.closing - previous.closing : null;
    const positive = delta !== null && delta > 0, negative = delta !== null && delta < 0;
    const deltaLabel = delta === null ? 'Sem comparação' : delta === 0 ? 'Sem mudança no saldo' : (positive ? '▲ +' : '▼ −') + fmt(Math.abs(delta));
    const label = (selected === null || selected === void 0 ? void 0 : selected.phase) === 'estimated_history' ? 'Estimativa histórica' : 'Projeção ao fim do dia';
    const items = s.planning.items.filter((x) => x.dueDate === s.planDay || (s.planDay === today && x.status === 'planned' && x.dueDate < today));
    const bank = s.bank.data.transactions.filter((x) => x.date === s.planDay && x.status === 'POSTED');
    const left = 70, right = 980, top = 24, bottom = 237, width = right - left, height = bottom - top;
    const values = rows.map(r => r.closing);
    const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1;
    const pad = Math.max(5000, Math.round((high - low) * .18));
    const minY = low >= 0 ? Math.max(0, low - pad) : low - pad;
    const maxY = high <= 0 ? Math.min(0, high + pad) : high + pad;
    const span = Math.max(1, maxY - minY);
    const xFor = (date) => left + (Number(date.slice(-2)) - 1) * width / Math.max(1, max - 1);
    const yFor = (v) => bottom - (v - minY) / span * height;
    const pointPath = rows.map((r, i) => (i ? 'L' : 'M') + xFor(r.date).toFixed(2) + ' ' + yFor(r.closing).toFixed(2)).join(' ');
    const areaPath = rows.length ? pointPath + ' L ' + xFor(rows[rows.length - 1].date).toFixed(2) + ' ' + bottom + ' L ' + xFor(rows[0].date).toFixed(2) + ' ' + bottom + ' Z' : '';
    const pastRows = rows.filter(r => r.phase === 'estimated_history');
    const historicalPath = pastRows.map((r, i) => (i ? 'L' : 'M') + xFor(r.date).toFixed(2) + ' ' + yFor(r.closing).toFixed(2)).join(' ');
    const activeX = selected ? xFor(selected.date) : left, activeY = selected ? yFor(selected.closing) : bottom;
    const ticks = [0, 1, 2, 3, 4].map(n => ({ y: top + n * height / 4, value: maxY - n * span / 4 }));
    const xLabels = [1, 7, 14, 21, max].filter((v, i, a) => v <= max && a.indexOf(v) === i);
    const selectDay = (day) => {
        const date = month + '-' + String(Math.max(1, Math.min(max, day))).padStart(2, '0');
        if (date !== app.state.planDay)
            app.setState({ planDay: date });
    };
    const selectPointer = (e) => {
        const svg = e.currentTarget;
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const matrix = svg.getScreenCTM();
        if (!matrix)
            return;
        const x = point.matrixTransform(matrix.inverse()).x;
        selectDay(Math.round((Math.max(left, Math.min(right, x)) - left) / width * (max - 1)) + 1);
    };
    const keyDay = (e) => {
        const day = Number(app.state.planDay.slice(-2));
        const next = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? day - 1 :
            e.key === 'ArrowRight' || e.key === 'ArrowUp' ? day + 1 : e.key === 'PageDown' ? day - 7 :
                e.key === 'PageUp' ? day + 7 : e.key === 'Home' ? 1 : e.key === 'End' ? max : null;
        if (next !== null) {
            e.preventDefault();
            selectDay(next);
        }
    };
    return h('div', { className: 'p-timeline-panel' }, h('div', { className: 'p-timeline-head' }, h('div', {}, h('span', { className: 'micro-label' }, 'EVOLUÇÃO DO SALDO'), h('h2', {}, 'Seu dinheiro, dia após dia'), h('p', {}, 'Arraste o ponto no gráfico para acompanhar o saldo de cada dia.')), h('span', { className: 'p-chart-month-label' }, prettyMonth(month))), h('div', { className: 'p-chart-metrics' }, h('div', { className: 'p-chart-current' }, h('span', { className: 'micro-label' }, label + ' · ' + pDate(s.planDay)), h('strong', {}, selected ? fmt(selected.closing) : '—'), h('span', { className: 'p-chart-delta ' + (positive ? 'up' : negative ? 'down' : 'neutral') }, deltaLabel, h('small', {}, ' vs. dia anterior'))), h('div', { className: 'p-chart-guide' }, h('span', {}, 'Dia ' + Number(s.planDay.slice(-2)) + ' de ' + max), h('small', {}, (selected === null || selected === void 0 ? void 0 : selected.phase) === 'estimated_history' ? 'Valor histórico estimado, sujeito à disponibilidade dos dados' : 'Valores futuros são estimativas; não representam saldo garantido'))), h('div', { className: 'p-chart-canvas' }, rows.length ? h('svg', { viewBox: '0 0 1010 280', className: 'p-balance-svg p-draggable-chart',
        role: 'slider', tabIndex: 0, 'aria-label': 'Dia selecionado no gráfico de saldo · ' + prettyMonth(month),
        'aria-valuemin': 1, 'aria-valuemax': max, 'aria-valuenow': Number(s.planDay.slice(-2)),
        'aria-valuetext': pDate(s.planDay) + ' · ' + (selected ? fmt(selected.closing) : 'sem valor') + ' · ' + deltaLabel,
        onKeyDown: keyDay,
        onPointerDown: (e) => { if (e.button !== 0)
            return; e.currentTarget.setPointerCapture(e.pointerId); selectPointer(e); },
        onPointerMove: (e) => { if (e.buttons & 1)
            selectPointer(e); },
        onMouseMove: (e) => { if (e.buttons & 1)
            selectPointer(e); },
        onTouchStart: (e) => { var _a; const touch = (_a = e.touches) === null || _a === void 0 ? void 0 : _a[0]; if (touch)
            selectPointer({ currentTarget: e.currentTarget, clientX: touch.clientX, clientY: touch.clientY }); },
        onTouchMove: (e) => { var _a; const touch = (_a = e.touches) === null || _a === void 0 ? void 0 : _a[0]; if (touch)
            selectPointer({ currentTarget: e.currentTarget, clientX: touch.clientX, clientY: touch.clientY }); },
        onPointerUp: (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            selectPointer(e);
            e.currentTarget.releasePointerCapture(e.pointerId);
        } },
        onPointerCancel: (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId); } }, h('defs', {}, h('linearGradient', { id: 'pBalanceArea', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: 'var(--green)', stopOpacity: '.30' }), h('stop', { offset: '100%', stopColor: 'var(--green)', stopOpacity: '.01' })), h('linearGradient', { id: 'pBalanceStroke', x1: '0', y1: '0', x2: '1', y2: '0' }, h('stop', { offset: '0%', stopColor: 'var(--green)' }), h('stop', { offset: '100%', stopColor: 'var(--green)' }))), ...ticks.map((t, i) => h('g', { key: 'tick-' + i }, h('line', { x1: left, y1: t.y, x2: right, y2: t.y, className: 'p-chart-grid-line' }), h('text', { x: left - 15, y: t.y + 4, className: 'p-chart-axis-label', textAnchor: 'end' }, Math.abs(t.value) >= 100000 ? 'R$ ' + (t.value / 100000).toFixed(1).replace('.', ',') + ' mil' : 'R$ ' + Math.round(t.value / 100)))), ...xLabels.map(d => h('text', { key: 'day-' + d, x: left + (d - 1) * width / Math.max(1, max - 1), y: 264, textAnchor: 'middle', className: 'p-chart-axis-label' }, 'Dia ' + d)), h('path', { d: areaPath, fill: 'url(#pBalanceArea)' }), h('path', { d: pointPath, fill: 'none', stroke: 'url(#pBalanceStroke)', strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round' }), pastRows.length > 1 ? h('path', { d: historicalPath, fill: 'none', stroke: 'var(--muted)', strokeWidth: 3.5, strokeDasharray: '7 7', strokeLinecap: 'round' }) : null, selected ? h('g', {}, h('line', { x1: activeX, y1: top, x2: activeX, y2: bottom, className: 'p-chart-active-line' }), h('circle', { cx: activeX, cy: activeY, r: 10, fill: 'var(--green)', stroke: 'var(--surface)', strokeWidth: 3, className: 'p-chart-drag-handle' }), h('circle', { cx: activeX, cy: activeY, r: 17, fill: 'var(--green)', fillOpacity: .13 })) : null) : h('div', { className: 'p-chart-empty' }, 'Ainda não há dados para mostrar o gráfico.')), h('p', { className: 'p-chart-instruction' }, 'Arraste a bolinha no gráfico ou use as setas do teclado. ' + (pastRows.length ? 'Linha pontilhada: histórico estimado.' : '')), timeline.historicalNotice && month === today.slice(0, 7) ? h('p', { className: 'p-chart-disclaimer' }, timeline.historicalNotice) : null, h('div', { className: 'p-day-details' }, h('div', { className: 'p-day-balance-card' }, h('span', { className: 'micro-label' }, 'DIA ' + pDate(s.planDay)), h('strong', {}, selected ? fmt(selected.closing) : '—'), h('small', {}, (selected === null || selected === void 0 ? void 0 : selected.phase) === 'estimated_history' ? 'Saldo histórico reconstruído' : 'Saldo estimado ao final do dia'), selected ? h('div', { className: 'p-day-totals' }, h('span', {}, 'Início ' + fmt(selected.opening)), h('span', { className: 'good-text' }, '+' + fmt(selected.incoming)), h('span', { className: 'bad-text' }, '−' + fmt(selected.outgoing))) : null), h('div', { className: 'p-day-events' }, h('h3', {}, 'Movimentações de ' + pDate(s.planDay)), items.length || bank.length ? [
        ...items.map((i) => { var _a; return h('button', { className: 'p-event-row', key: i.id, onClick: () => app.openPlanDetail(i.id) }, h('span', { className: 'p-event-icon' }, ((_a = app.getCategories().find((c) => c.name === i.category)) === null || _a === void 0 ? void 0 : _a.emoji) || '🧾'), h('span', { className: 'p-event-name' }, h('b', {}, i.title), h('small', {}, pStatus(i.effectiveStatus) + (i.certainty === 'estimated' ? ' · estimado' : ''))), h('strong', { className: i.kind === 'income' ? 'good-text' : 'bad-text' }, (i.kind === 'income' ? '+' : '−') + fmt(i.remaining || i.amount))); }),
        ...bank.map((b) => h('button', { className: 'p-event-row', key: b.accountId + ':' + b.id, onClick: () => app.openPlanBankDetail(b) }, h('span', { className: 'p-event-icon' }, '🏦'), h('span', { className: 'p-event-name' }, h('b', {}, b.customTitle || b.merchant || b.description), h('small', {}, 'Realizada · ' + b.accountName)), h('strong', { className: b.amount >= 0 ? 'good-text' : 'bad-text' }, (b.amount >= 0 ? '+' : '−') + fmt(Math.abs(b.amount)))))
    ] : h('p', { className: 'muted-desc' }, 'Nenhuma movimentação registrada para esta data.'))));
}
function pSuggestions(app) {
    const s = app.state, suggestions = s.planning.suggestions.filter((x) => s.planning.items.some((i) => i.id === x.itemId));
    if (!suggestions.length)
        return null;
    return h('section', { className: 'p-suggestions' }, h('div', { className: 'p-section-heading' }, h('div', {}, h('span', { className: 'micro-label' }, 'SUGESTÕES PARA VOCÊ'), h('h2', {}, 'Possíveis pagamentos encontrados'), h('p', {}, 'Comparamos valores e datas. Você decide se é o mesmo pagamento.'))), h('div', { className: 'p-suggestion-grid' }, suggestions.slice(0, 4).map((match) => {
        const item = s.planning.items.find((i) => i.id === match.itemId), bank = s.bank.data.transactions.find((b) => b.accountId === match.accountId && b.id === match.externalId);
        return h('div', { className: 'p-suggestion-card', key: match.itemId + match.externalId }, h('div', { className: 'p-score' }, (match.score >= 80 ? 'Correspondência forte' : match.score >= 60 ? 'Possível correspondência' : 'Revisar correspondência')), h('strong', {}, (item === null || item === void 0 ? void 0 : item.title) || 'Pagamento'), h('span', {}, match.description), h('small', {}, pDate(match.date) + ' · ' + fmt(Math.abs(match.amount)) + ' · ' + match.accountName), h('div', { className: 'p-suggest-actions' }, h('button', { className: 'primary-button', disabled: s.planBusy || !bank, onClick: () => bank && app.linkPlan(match.itemId, bank) }, 'Vincular'), h('button', { className: 'ghost-button', disabled: s.planBusy, onClick: () => app.rejectPlanSuggestion(match) }, 'Ignorar')));
    })));
}
function pMonthNavigation(app) {
    const month = app.state.planMonth;
    return h('div', { className: 'p-month-arrows', 'aria-label': 'Mês da agenda' }, h('button', { type: 'button', disabled: month <= nowYM, onClick: () => app.changePlanMonth(-1), 'aria-label': 'Mês anterior' }, h(Icon, { name: 'chevron-left', size: 16 })), h('strong', {}, prettyMonth(month)), h('button', { type: 'button', disabled: month >= shiftMonth(nowYM, 12), onClick: () => app.changePlanMonth(1), 'aria-label': 'Próximo mês' }, h(Icon, { name: 'chevron-right', size: 16 })));
}
function renderPlanningView(app) {
    var _a, _b, _c;
    const s = app.state;
    if (s.mode === 'demo')
        return h('section', { className: 'p-empty' }, h('h2', {}, 'Planejamento para suas finanças reais'), h('p', {}, 'Saia da demonstração para cadastrar e acompanhar seus compromissos.'), h('button', { className: 'primary-button', onClick: () => app.toggleMode() }, 'Ver meus dados'));
    const p = s.planning, today = iso(new Date()), rows = pFilterTransactions(app), presentation = s.planPresentation || 'agenda';
    return h('div', { className: 'p-main u2-planning' }, h('section', { className: 'p-hero' }, h('div', {}, h('span', { className: 'micro-label' }, 'SUA AGENDA FINANCEIRA'), h('h2', {}, 'Organize o próximo passo.'), h('p', {}, 'Vencimentos, pagamentos e previsões no mesmo lugar.')), h('div', { className: 'p-hero-actions' }, h('button', { className: 'primary-button', onClick: () => app.openPlan(undefined, 'expense') }, '＋ Planejar despesa'), h('button', { className: 'ghost-button', onClick: () => app.openPlan(undefined, 'income') }, '＋ Prever receita'), h('button', { className: 'p-sync', disabled: s.bankBusy || s.planBusy, onClick: () => app.syncBank(false) }, h(Icon, { name: 'refresh', size: 15 }), s.bankBusy ? 'Atualizando…' : 'Atualizar'))), pUpcoming(app), pSummary(app), ((_a = p.projection.reference) === null || _a === void 0 ? void 0 : _a.quality) === 'stale' ? h('div', { className: 'p-warning' }, 'O último saldo recebido tem mais de 24 horas. Atualize suas contas antes de usar esta previsão.') : ((_b = p.projection.reference) === null || _b === void 0 ? void 0 : _b.quality) === 'incomplete' ? h('div', { className: 'p-warning' }, 'Algumas contas não informaram saldo. O total projetado pode estar incompleto.') : ((_c = p.projection.reference) === null || _c === void 0 ? void 0 : _c.quality) === 'unverified' ? h('div', { className: 'p-warning' }, 'O banco foi consultado recentemente, mas o saldo pode não incluir operações mais novas. Confira antes de assumir compromissos.') : null, p.projection.negativeDays.length ? h('div', { className: 'p-warning' }, h(Icon, { name: 'alert', size: 16 }), 'Há ' + p.projection.negativeDays.length + ' dia(s) com saldo projetado negativo. Primeiro: ' + pDate(p.projection.negativeDays[0])) : null, h('section', { className: 'p-ledger' }, h('div', { className: 'p-section-heading' }, h('div', {}, h('span', { className: 'micro-label' }, 'AGENDA COMPLETA'), h('h2', {}, 'Compromissos e movimentações'), h('p', {}, 'Priorize os vencimentos e consulte o histórico por período.')), h('div', { className: 'p-ledger-navigation' }, pMonthNavigation(app), h('span', { className: 'p-count' }, rows.length + ' registros filtrados'))), h('div', { className: 'p-ledger-tools' }, h('input', { className: 'form-control', 'aria-label': 'Buscar na agenda', placeholder: 'Buscar nome, descrição ou categoria...', value: s.planTerm, onChange: (e) => app.setState({ planTerm: e.target.value }) }), h(StyledSelect, { value: s.planView, options: [{ value: 'all', label: 'Tudo' }, { value: 'planned', label: 'Planejadas' }, { value: 'pending', label: 'Pendentes e vencidas' }, { value: 'bank', label: 'Movimentações do banco' }, { value: 'paid', label: 'Realizadas' }], onChange: (v) => app.setState({ planView: v }) })), h('div', { className: 'u2-view-tabs', 'aria-label': 'Visualização do planejamento' }, [{ value: 'agenda', label: 'Agenda' }, { value: 'calendar', label: 'Calendário' }, { value: 'projection', label: 'Projeção diária' }].map(v => h('button', { type: 'button', 'aria-pressed': presentation === v.value, onClick: () => app.setState({ planPresentation: v.value }) }, v.label))), presentation === 'projection' ? h('p', { className: 'u2-projection-hint' }, 'A projeção abaixo usa o cenário financeiro completo. A busca e o filtro de registros se aplicam somente à agenda e ao calendário.') :
        presentation === 'calendar' ? pCalendar(app, rows) : presentation === 'projection' ? null : h('div', { className: 'p-ledger-list' }, rows.length ? pAgenda(app, rows) : h('div', { className: 'p-empty-list' }, p.generatedAt ? 'Nenhum registro para estes filtros. Adicione uma previsão ou altere a pesquisa.' : 'Atualize para carregar sua agenda.')), s.bank.data.truncated ? h('p', { className: 'p-warning' }, 'O histórico de transações do banco é parcial nesta visualização. Consulte sua conta para dados mais antigos.') : null), pSuggestions(app), presentation === 'projection' ? h('section', { className: 'mf-planning-projection u5-single-projection',
        'aria-label': 'Projeção diária do mês' }, h('div', { className: 'u5-projection-heading' }, h('h2', {}, 'Projeção diária · ' + prettyMonth(s.planMonth)), h('p', { className: 'u2-projection-hint' }, 'Cenário completo do mês; independente dos filtros de registros.')), h('div', { className: 'p-scenario-toggle' }, h('span', {}, h('b', {}, 'Projeção conservadora'), h('small', {}, 'Receitas incertas ficam fora do saldo previsto por padrão.')), h('label', {}, h('input', { type: 'checkbox', checked: s.planIncludeEstimated,
        onChange: (e) => app.setState({ planIncludeEstimated: e.target.checked }, () => app.refreshPlanning()) }), 'Incluir receitas incertas')), pTimeline(app)) : null, h('p', { className: 'p-footnote' }, 'O saldo de referência vem da última informação disponível da instituição. Lançamentos já pagos e refletidos no banco não são descontados novamente. Previsões futuras são estimativas, não garantias.'));
}
function renderPlanEditor(app) {
    const s = app.state, f = s.planForm, categories = app.getCategories();
    return h('div', { className: 'modal-backdrop p-editor-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            app.setState({ planOpen: false }); } }, h('div', { className: 'modal p-plan-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Planejar compromisso' }, h('div', { className: 'modal-head' }, h('div', {}, h('span', { className: 'micro-label' }, f.id ? 'EDITAR OCORRÊNCIA' : 'NOVO PLANEJAMENTO'), h('h2', {}, f.id ? 'Editar compromisso' : 'Planejar movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', onClick: () => app.setState({ planOpen: false }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'segmented' }, ['expense', 'income'].map(k => h('button', { key: k, className: f.kind === k ? 'selected' : '', onClick: () => app.setState({ planForm: { ...f, kind: k, category: k === 'income' ? 'Salário' : 'Outros' } }) }, k === 'expense' ? 'Despesa' : 'Receita'))), app.field('Como deseja chamar esta transação?', h('input', { className: 'form-control', maxLength: 140, value: f.title, placeholder: 'Ex.: Aluguel, salário, notebook', onChange: (e) => app.setState({ planForm: { ...f, title: e.target.value } }) })), h('div', { className: 'two-inputs' }, app.field(f.mode === 'installments' ? 'Valor total da compra (R$)' : 'Valor previsto (R$)', h('input', { className: 'form-control', inputMode: 'decimal', value: f.amount, placeholder: '0,00', onChange: (e) => app.setState({ planForm: { ...f, amount: e.target.value } }) })), app.field('Data prevista', h(SingleDatePicker, { value: f.dueDate, onChange: (value) => app.setState({ planForm: { ...f, dueDate: value } }) }))), h('div', { className: 'two-inputs' }, app.field('Categoria', h(StyledSelect, { value: f.category, options: categories.map((c) => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (v) => app.setState({ planForm: { ...f, category: v } }) })), app.field('Conta associada (opcional)', h(StyledSelect, { value: f.accountId, options: [{ value: '', label: 'Qualquer conta' }, ...s.bank.data.accounts.map((a) => ({ value: a.id, label: a.name }))], onChange: (v) => app.setState({ planForm: { ...f, accountId: v } }) }))), !f.id ? h('div', { className: 'two-inputs' }, app.field('Repetição', h(StyledSelect, { value: f.mode, options: [{ value: 'once', label: 'Uma vez' }, { value: 'monthly', label: 'Todo mês' }, { value: 'weekly', label: 'Toda semana' }, { value: 'yearly', label: 'Todo ano' }, { value: 'installments', label: 'Parcelar compra' }], onChange: (v) => app.setState({ planForm: { ...f, mode: v } }) })), f.mode !== 'once' ? app.field('Quantidade (até 36)', h('input', { className: 'form-control', type: 'number', min: 1, max: 36, value: f.count, onChange: (e) => app.setState({ planForm: { ...f, count: e.target.value } }) })) : null) : h('p', { className: 'muted-desc' }, 'A alteração será aplicada somente a esta ocorrência. As demais parcelas e repetições permanecem intactas.'), app.field('Confiança na previsão', h(StyledSelect, { value: f.certainty, options: [{ value: 'confirmed', label: 'Confirmada / esperada' }, { value: 'estimated', label: 'Estimativa incerta' }], onChange: (v) => app.setState({ planForm: { ...f, certainty: v } }) }), 'Receitas incertas ficam fora da projeção conservadora.'), app.field('Observações (opcional)', h('textarea', { className: 'form-control', rows: 3, value: f.notes, maxLength: 600, placeholder: 'Detalhes úteis sobre esta movimentação', onChange: (e) => app.setState({ planForm: { ...f, notes: e.target.value } }) })), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', disabled: s.planBusy, onClick: () => app.setState({ planOpen: false }) }, 'Cancelar'), h('button', { className: 'primary-button', disabled: s.planBusy, onClick: () => app.savePlan() }, s.planBusy ? 'Salvando…' : f.id ? 'Salvar alterações' : 'Adicionar ao planejamento'))));
}
function renderPlanDrawer(app) {
    var _a;
    const s = app.state, sel = s.planSelected || '', planned = sel.startsWith('plan:'), item = planned ? s.planning.items.find((i) => i.id === sel.slice(5)) : undefined;
    const bank = !planned ? s.bank.data.transactions.find((b) => 'bank:' + b.accountId + '|' + b.id === sel) : undefined;
    if (!item && !bank)
        return null;
    const candidates = item ? s.bank.data.transactions.filter((b) => b.status === 'POSTED' && (b.amount > 0 ? 'income' : 'expense') === item.kind && Math.abs(b.amount) <= item.remaining && (item.accountId ? b.accountId === item.accountId : true) && !s.planning.items.some((i) => i.links.some(l => l.accountId === b.accountId && l.externalId === b.id)) && Math.abs((Date.parse(b.date + 'T00:00:00Z') - Date.parse(item.dueDate + 'T00:00:00Z')) / 86400000) <= 40 && [b.description, b.customTitle || ''].join(' ').toLowerCase().includes(s.planMatchQuery.toLowerCase())).slice(0, 20) : [];
    return h('div', { className: 'mf-drawer-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            app.setState({ planSelected: null }); } }, h('aside', { className: 'mf-detail-drawer p-plan-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': planned ? 'Detalhes do planejamento' : 'Detalhes da movimentação' }, h('div', { className: 'mf-drawer-head' }, h('div', {}, h('span', { className: 'micro-label' }, planned ? 'COMPROMISSO PLANEJADO' : 'MOVIMENTAÇÃO REAL'), h('h2', {}, planned ? 'Detalhes do planejamento' : 'Detalhes da movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', onClick: () => app.setState({ planSelected: null }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'mf-detail-scroll' }, h('div', { className: 'mf-detail-hero' }, h('span', { className: 'mf-hero-emoji' }, planned ? (((_a = app.getCategories().find((c) => c.name === item.category)) === null || _a === void 0 ? void 0 : _a.emoji) || '🧾') : '🏦'), h('h3', {}, planned ? item.title : bank.customTitle || bank.merchant || bank.description), h('strong', { className: (planned ? item.kind : bank.amount >= 0 ? 'income' : 'expense') === 'income' ? 'good-text' : 'bad-text' }, (planned ? item.kind === 'income' : bank.amount >= 0 ? true : false) ? '+' : '−', fmt(planned ? item.amount : Math.abs(bank.amount))), h('small', {}, planned ? 'Previsto para ' + pDate(item.dueDate) + ' · ' + pStatus(item.effectiveStatus) : pDate(bank.date) + ' · ' + bank.accountName)), planned ? [
        h('div', { className: 'mf-detail-section', key: 'about' }, h('b', {}, 'Sobre este compromisso'), h('p', {}, 'Categoria: ' + item.category), h('p', {}, 'Falta quitar: ' + fmt(item.remaining)), item.overpaid ? h('p', { className: 'p-warning' }, 'Pagamento importado superior ao planejado: revise a diferença de ' + fmt(item.overpaid)) : null, h('p', {}, 'Origem: ' + (item.groupType === 'installments' ? 'Parcela ' + item.occurrence + '/' + item.totalOccurrences : item.groupType === 'single' ? 'Lançamento único' : 'Recorrência ' + item.occurrence + '/' + item.totalOccurrences)), item.notes ? h('p', {}, item.notes) : null, h('div', { className: 'p-drawer-actions' }, h('button', { className: 'ghost-button', onClick: () => app.openPlan(item) }, 'Editar'), item.status === 'planned' ? h('button', { className: 'ghost-button', onClick: () => app.changePlanStatus(item.id, 'cancelled') }, 'Cancelar previsão') : h('button', { className: 'ghost-button', onClick: () => app.changePlanStatus(item.id, 'planned') }, 'Reativar')), item.status === 'planned' && !item.links.length ? h('button', { className: 'ghost-button', onClick: () => app.changePlanStatus(item.id, 'settled_manual') }, item.kind === 'expense' ? 'Marcar como pago (já refletido no saldo)' : 'Marcar como recebido (já refletido no saldo)') : null),
        h('div', { className: 'mf-detail-section', key: 'linked' }, h('b', {}, 'Pagamentos associados'), item.links.length ? item.links.map(l => h('div', { className: 'p-linked-row', key: l.externalId }, h('span', {}, pDate(l.date) + ' · ' + l.description + ' · ' + fmt(Math.abs(l.amount))), h('button', { className: 'mf-small-link', onClick: () => app.unlinkPlan(item.id, l) }, 'Desvincular'))) : h('p', { className: 'muted-desc' }, 'Nenhum pagamento bancário associado ainda.')),
        item.status === 'planned' && item.remaining > 0 ? h('div', { className: 'mf-detail-section', key: 'search' }, h('b', {}, 'Procurar pagamento no banco'), h('p', { className: 'muted-desc' }, 'Selecione uma movimentação confirmada. Valores maiores que o planejado exigem ajustar o compromisso primeiro.'), h('input', { className: 'form-control', value: s.planMatchQuery, placeholder: 'Filtrar por descrição', onChange: (e) => app.setState({ planMatchQuery: e.target.value }) }), candidates.length ? candidates.map(b => h('div', { className: 'p-suggestion-compact', key: b.id }, h('div', {}, h('b', {}, b.customTitle || b.description), h('small', {}, pDate(b.date) + ' · ' + fmt(Math.abs(b.amount)))), h('button', { className: 'ghost-button', onClick: () => app.linkPlan(item.id, b) }, 'Vincular'))) : h('p', { className: 'muted-desc' }, 'Nenhuma correspondência disponível nesta lista.')) : null,
        h('div', { className: 'mf-detail-section', key: 'audit' }, h('b', {}, 'Histórico do compromisso'), s.planHistory.length ? s.planHistory.map((h, i) => hFn(h, i)) : h('p', { className: 'muted-desc' }, 'Sem alterações adicionais.'))
    ] : [
        h('div', { className: 'mf-detail-section', key: 'title' }, h('b', {}, 'Nome personalizado'), h('p', { className: 'muted-desc' }, 'Esse nome aparece em destaque. A descrição original do banco é preservada.'), h('input', { className: 'form-control', value: s.planBankTitle, maxLength: 140, placeholder: 'Ex.: Aluguel, mercado, viagem', onChange: (e) => app.setState({ planBankTitle: e.target.value }) }), h('button', { className: 'primary-button', disabled: s.planBusy, onClick: () => app.renameBankInPlanning(bank) }, 'Salvar nome')),
        h('div', { className: 'mf-detail-section', key: 'original' }, h('b', {}, 'Descrição original'), h('p', {}, bank.description), h('small', { className: 'muted-desc' }, 'Situação: ' + (bank.status === 'POSTED' ? 'Confirmada' : 'Pendente') + ' · ' + bank.category)),
        h('div', { className: 'mf-detail-section', key: 'link' }, h('b', {}, 'Vincular a um planejamento'), bank.status === 'POSTED' ? s.planning.items.filter((i) => i.status === 'planned' && i.remaining >= Math.abs(bank.amount) && (bank.amount >= 0 ? 'income' : 'expense') === i.kind && (!i.accountId || i.accountId === bank.accountId) && !s.planning.items.some((x) => x.links.some(l => l.accountId === bank.accountId && l.externalId === bank.id))).slice(0, 8).map((i) => h('div', { className: 'p-suggestion-compact', key: i.id }, h('span', {}, i.title + ' · ' + fmt(i.remaining)), h('button', { className: 'ghost-button', onClick: () => app.linkPlan(i.id, bank) }, 'Vincular'))) : h('p', { className: 'muted-desc' }, 'Aguarde a confirmação do banco para conciliar.')),
        h('button', { className: 'ghost-button', onClick: () => { app.setState({ planSelected: null }); app.openBankDetail(bank); } }, 'Mais detalhes e categorias')
    ])));
}
function hFn(item, index) { return h('div', { key: index, className: 'p-audit-row' }, h('strong', {}, { created: 'Criado', edited: 'Editado', linked: 'Vinculado ao banco', unlinked: 'Vínculo desfeito', cancelled: 'Cancelado', settled_manual: 'Quitado manualmente', planned: 'Reativado', ignored: 'Sugestão ignorada' }[item.action] || item.action), h('small', {}, new Date(item.at).toLocaleString('pt-BR') + (item.details ? ' · ' + item.details : ''))); }
const INTELLIGENCE_CONTEXTS = {
    overview: { label: 'Visão geral', description: 'Indicadores e evolução do período escolhido.', questions: ['Explique as principais mudanças da minha visão geral.', 'Quais informações faltam para avaliar minha saúde financeira?'] },
    transactions: { label: 'Movimentações', description: 'Categorias, recorrências e revisão de lançamentos.', questions: ['Analise possíveis padrões nas minhas movimentações.', 'Categorize minha compra do mercado como Alimentação.'] },
    planning: { label: 'Planejamento', description: 'Contas futuras e projeção diária do fluxo de caixa.', questions: ['Quais compromissos podem comprometer meu saldo futuro?', 'Como planejar uma reserva sem depender de renda incerta?'] },
    budgets: { label: 'Orçamentos', description: 'Limites, histórico de categorias e oportunidades de ajuste.', questions: ['Como definir limites mais inteligentes por categoria?', 'Quais categorias devo analisar antes de reduzir gastos?'] },
    assistant: { label: 'Simular compra', description: 'Impacto de compras e parcelamentos no planejamento.', questions: ['Como avaliar se uma nova compra cabe no meu orçamento?', 'O que devo comparar antes de parcelar uma compra?'] },
    banks: { label: 'Minhas contas', description: 'Saldos bancários e qualidade das informações sincronizadas.', questions: ['Quais dados preciso conferir antes de tomar uma decisão?', 'Como identificar divergências entre saldo e movimentações?'] },
    settings: { label: 'Configurações', description: 'Aparência, preferências e recuperação de dados.', questions: ['O que muda ao escolher esta preferência?', 'Qual a diferença entre exportação manual e cópia completa?'] },
    intelligence: { label: 'Inteligência', description: 'Rascunhos locais e testes autorizados de IA.', questions: ['O que está disponível nesta etapa?', 'Que contexto deve ser revisado antes de uma análise?'] }
};
function intelligenceContextFor(page) { return INTELLIGENCE_CONTEXTS[page] || INTELLIGENCE_CONTEXTS.overview; }
function intelligencePageScope(app, page = app.state.page) {
    var _a, _b, _c;
    const s = app.state, info = intelligenceContextFor(page);
    let period = 'Sem filtro de período';
    const filters = [];
    if (page === 'overview' || page === 'transactions')
        period = page === 'transactions' && s.txReviewOnly ? 'Todos os períodos' : spanLabel(s.overviewPeriod, dateSpan(s.overviewPeriod, s.customStart, s.customEnd));
    if (page === 'planning')
        period = prettyMonth(s.planMonth);
    if (page === 'budgets')
        period = prettyMonth(s.month);
    if (page === 'assistant')
        period = 'Cenário atual';
    if (page === 'banks')
        period = 'Referências das instituições';
    if (page === 'transactions') {
        if ((_a = s.query) === null || _a === void 0 ? void 0 : _a.trim())
            filters.push('Busca: ' + s.query.trim().slice(0, 100));
        if (s.bankFilter)
            filters.push('Conta filtrada');
        if (s.txReviewOnly)
            filters.push('A revisar');
        if (s.txOrganize)
            filters.push('Categorias e regras');
        if ((_b = s.txSelected) === null || _b === void 0 ? void 0 : _b.length)
            filters.push(s.txSelected.length + ' selecionada(s)');
        if (s.detail)
            filters.push('Movimentação aberta');
    }
    if (page === 'planning' && ((_c = s.planTerm) === null || _c === void 0 ? void 0 : _c.trim()))
        filters.push('Busca: ' + s.planTerm.trim().slice(0, 100));
    return { page, label: info.label, period, filters, mode: s.mode === 'demo' ? 'Demonstração' : 'Pessoal' };
}
function intelligenceNextTab(current, key) {
    const ids = ['today', 'chat', 'actions'], index = Math.max(0, ids.indexOf(current));
    if (key === 'Home')
        return ids[0];
    if (key === 'End')
        return ids[2];
    if (key === 'ArrowRight')
        return ids[(index + 1) % ids.length];
    if (key === 'ArrowLeft')
        return ids[(index + ids.length - 1) % ids.length];
    return null;
}
function intelligenceHistoryList(app) {
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    return Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
}
function intelligenceOpenFullChat(app) {
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    const scope = app.state.intelligencePanelOpen && app.state.intelligenceContextSnapshot ? app.state.intelligenceContextSnapshot : intelligencePageScope(app);
    app.setState({ page: 'intelligence', intelligenceTab: 'chat', intelligenceDraftScope: scope, intelligencePanelOpen: false, detail: null, planSelected: null });
}
function intelligencePrepare(app, question) {
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    app.setState({ page: 'intelligence', intelligenceTab: 'chat', intelligenceDraft: question, intelligenceDraftScope: app.state.intelligencePanelOpen && app.state.intelligenceContextSnapshot ? app.state.intelligenceContextSnapshot : intelligencePageScope(app), intelligencePanelOpen: false, detail: null, planSelected: null });
}
function renderIntelligenceStructuredCard(card) {
    return h('div', { className: 'mf-ai-structured-card', role: 'region', 'aria-label': card.title }, h('div', { className: 'mf-ai-structured-head' }, h('strong', {}, card.title), card.subtitle ? h('small', {}, card.subtitle) : null), Array.isArray(card.metrics) && card.metrics.length ? h('div', { className: 'mf-ai-structured-metrics' }, ...card.metrics.map((m, idx) => h('div', { key: idx, className: 'mf-ai-structured-metric is-' + (m.tone || 'neutral') }, h('small', {}, m.label), h('strong', {}, m.value)))) : null, Array.isArray(card.rows) && card.rows.length ? h('div', { className: 'mf-ai-table-wrap' }, h('table', {}, card.headers ? h('thead', {}, h('tr', {}, h('th', {}, card.headers[0]), h('th', {}, card.headers[1]), card.headers[2] ? h('th', {}, card.headers[2]) : null)) : null, h('tbody', {}, ...card.rows.map((r, idx) => h('tr', { key: idx }, h('td', {}, r.col1), h('td', {}, r.col2), r.col3 !== undefined ? h('td', {}, r.col3) : null))))) : null, card.footnote ? h('small', { className: 'mf-ai-structured-foot' }, card.footnote) : null);
}
function renderIntelligenceActionProposalCard(app, proposal) {
    const moneyFmt = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
    const isAmbiguous = proposal.status === 'ambiguous';
    const isPending = proposal.status === 'pending';
    const allCandidates = Array.isArray(proposal.candidates) ? proposal.candidates : [];
    const totalCount = proposal.candidatesCount || allCandidates.length;
    const visibleLimit = typeof proposal.visibleLimit === 'number' && proposal.visibleLimit > 0 ? proposal.visibleLimit : 8;
    const visibleCandidates = allCandidates.slice(0, visibleLimit);
    const hiddenCount = Math.max(0, allCandidates.length - visibleCandidates.length);
    const statusLabel = proposal.status === 'ambiguous' ? 'Seleção explícita necessária (' + totalCount + ' opções)' :
        proposal.status === 'pending' ? 'Prévia sem gravação · I2-B pendente' :
            proposal.status === 'preview_confirmed' ? 'Prévia validada · sem gravação (I2-B)' :
                proposal.status === 'stale' ? 'Estado desatualizado · recusada' : 'Proposta negada';
    return h('div', { className: 'mf-ai-proposal-card status-' + proposal.status, role: 'region', 'aria-label': 'Prévia de categorização supervisionada' }, h('div', { className: 'mf-ai-proposal-head' }, h('span', { className: 'micro-label' }, isAmbiguous ? 'DESAMBIGUAÇÃO DE LANÇAMENTOS' : proposal.origin === 'bank' ? 'PRÉVIA · MOVIMENTAÇÃO BANCÁRIA' : 'PRÉVIA · LANÇAMENTO MANUAL'), h('span', { className: 'mf-ai-status' }, statusLabel)), isAmbiguous && allCandidates.length ? h('div', { className: 'mf-ai-candidate-list', role: 'group', 'aria-label': 'Escolha o lançamento exato' }, h('p', { className: 'mf-ai-proposal-notice' }, 'Múltiplos lançamentos correspondem ao pedido. Nunca escolhemos um registro arbitrariamente; selecione abaixo qual deseja preparar para “' + proposal.proposedCategory + '”:'), allCandidates.length > 8 ? h('p', { className: 'mf-ai-refine-hint' }, 'Para refinar a busca entre os ' + allCandidates.length + ' lançamentos, informe data (ex.: ontem ou DD/MM/AAAA), valor exato (ex.: R$ 50,00) ou origem (banco / manual).') : null, ...visibleCandidates.map((c) => h('div', { key: c.candidateKey, className: 'mf-ai-candidate-row' }, h('div', { className: 'mf-ai-candidate-copy' }, h('strong', {}, c.description), h('small', {}, (c.origin === 'bank' ? 'Banco (' + c.accountName + ')' : 'Manual') + ' · ' + c.date + ' · ' + moneyFmt(c.amountCents) + ' · Atual: ' + c.currentCategory)), h('button', { type: 'button', className: 'ghost-button', onClick: () => intelligenceSelectActionCandidate(app, proposal.id, c.candidateKey) }, 'Selecionar lançamento'))), hiddenCount > 0 ? h('button', { type: 'button', className: 'ghost-button mf-ai-expand-candidates', onClick: () => intelligenceExpandProposalCandidates(app, proposal.id) }, 'Mostrar mais ' + hiddenCount + ' lançamento(s) (ver todos os ' + allCandidates.length + ')') : null, h('div', { className: 'mf-ai-proposal-actions' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => intelligenceResolveActionProposal(app, proposal.id, 'deny') }, 'Cancelar proposta'))) : null, !isAmbiguous ? h('div', { className: 'mf-ai-proposal-tx' }, h('strong', {}, proposal.description), h('small', {}, (proposal.origin === 'bank' ? 'Banco (' + (proposal.accountName || proposal.accountId || 'Conta') + ')' : 'Manual') + ' · ' + proposal.date + ' · ' + moneyFmt(proposal.amountCents))) : null, !isAmbiguous ? h('div', { className: 'mf-ai-proposal-diff' }, h('div', { className: 'mf-ai-diff-col' }, h('small', {}, 'Categoria atual'), h('b', {}, proposal.currentCategory || 'Sem categoria')), h('span', { className: 'mf-ai-diff-arrow', 'aria-hidden': 'true' }, '→'), h('div', { className: 'mf-ai-diff-col is-proposed' }, h('small', {}, 'Categoria proposta'), h('b', {}, proposal.proposedCategory))) : null, isPending ? h('p', { className: 'mf-ai-proposal-notice' }, 'Prévia sem gravação: confirmar valida identidade, origem, data, valor e categoria, mas não persiste alterações no SQLite até a entrega I2-B.') : null, isPending ? h('div', { className: 'mf-ai-proposal-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => intelligenceResolveActionProposal(app, proposal.id, 'approve') }, 'Confirmar prévia (sem gravar)'), h('button', { type: 'button', className: 'ghost-button', onClick: () => intelligenceResolveActionProposal(app, proposal.id, 'deny') }, 'Negar alteração')) : null, proposal.resultMessage ? h('p', { className: 'mf-ai-proposal-result', role: 'status' }, proposal.resultMessage) : null);
}
function renderIntelligenceMessageItem(app, msg) {
    const isUser = msg.role === 'user';
    const badge = msg.status === 'unavailable' ? h('span', { className: 'mf-ai-msg-badge is-warn' }, 'Conta desconectada') :
        msg.status === 'unimplemented' ? h('span', { className: 'mf-ai-msg-badge is-info' }, 'Aguarda I2-A') :
            msg.status === 'error' ? h('span', { className: 'mf-ai-msg-badge is-error' }, 'Serviço indisponível') : null;
    return h('article', { key: msg.id, className: 'mf-ai-msg ' + (isUser ? 'is-user' : 'is-assistant') + ' is-' + msg.status }, h('header', { className: 'mf-ai-msg-meta' }, h('strong', {}, isUser ? 'Você' : 'Assistente MF'), h('span', {}, msg.scopeLabel + ' · ' + msg.createdAt), badge), h('div', { className: 'mf-ai-msg-body mf-ai-markdown' }, ...aiMarkdownNodes(msg.text)), msg.structuredCard ? renderIntelligenceStructuredCard(msg.structuredCard) : null, msg.proposal ? renderIntelligenceActionProposalCard(app, msg.proposal) : null, msg.id.startsWith('review-answer-') ? h('button', { type: 'button', className: 'primary-button', onClick: () => void categoryReviewOpen(app) }, 'Abrir Central de Revisão') : null, msg.details ? h('details', { className: 'mf-ai-msg-details' }, h('summary', {}, 'Ver contexto e diagnóstico'), h('p', {}, msg.details)) : null);
}
function intelligenceExampleCard(app, id, title, description, icon, question) {
    return h('div', { className: 'mf-ai-example-card', key: id }, h('span', { className: 'mf-ai-example-icon' }, h(Icon, { name: icon, size: 20 })), h('div', { className: 'mf-ai-example-copy' }, h('strong', {}, title), h('p', {}, description), h('button', { type: 'button', className: 'mf-ai-link', onClick: () => intelligencePrepare(app, question) }, 'Preparar análise', h(Icon, { name: 'arrow', size: 15 }))));
}
function renderIntelligenceHistorySidebar(app) {
    const s = app.state;
    const query = String(s.intelligenceHistoryQuery || '');
    const groups = typeof intelligenceGroupThreadsByDate === 'function' ? intelligenceGroupThreadsByDate(app, query) : [];
    const activeId = s.intelligenceActiveThreadId || null;
    const totalThreads = Array.isArray(s.intelligenceThreads) ? s.intelligenceThreads.length : 0;
    return h('aside', { className: 'mf-ai-history-sidebar', 'aria-label': 'Histórico de conversas' }, h('div', { className: 'mf-ai-history-top' }, h('div', { className: 'mf-ai-history-title-row' }, h('strong', {}, 'Conversas'), h('span', { className: 'mf-ai-thread-count' }, String(totalThreads))), h('button', { type: 'button', className: 'primary-button mf-ai-new-thread-btn', onClick: () => intelligenceCreateThread(app) }, h(Icon, { name: 'plus', size: 14 }), 'Nova conversa')), h('div', { className: 'mf-ai-history-search' }, h('input', { type: 'search', value: query, maxLength: 120, placeholder: 'Buscar no histórico…', 'aria-label': 'Buscar conversas no histórico', onChange: (e) => app.setState({ intelligenceHistoryQuery: e.target.value }) })), s.intelligenceStorageError ? h('p', { className: 'mf-ai-error mf-ai-storage-error', role: 'alert' }, s.intelligenceStorageError) : null, groups.length === 0 ? h('div', { className: 'mf-ai-history-empty' }, h('p', {}, query.trim() ? 'Nenhuma conversa encontrada para “' + query.trim() + '”.' : 'Nenhuma conversa salva neste perfil (' + (s.mode === 'demo' ? 'Demonstração' : 'Pessoal') + ').'), h('small', {}, s.categoryReviewGrant ? 'Conversa temporária. Mensagens e autorizações não são gravadas no histórico do perfil.' : 'O histórico deste perfil é local e não usa o cofre criptografado. Não inclua senhas nem tokens.')) :
        h('div', { className: 'mf-ai-history-groups', role: 'list' }, ...groups.map((grp) => h('div', { key: grp.label, className: 'mf-ai-history-group' }, h('span', { className: 'mf-ai-history-date-label' }, grp.label), ...grp.items.map((th) => h('div', { key: th.id, role: 'listitem', className: 'mf-ai-thread-item ' + (th.id === activeId ? 'is-active' : '') }, h('button', { type: 'button', className: 'mf-ai-thread-select', 'aria-current': th.id === activeId ? 'true' : 'false', onClick: () => intelligenceSelectThread(app, th.id) }, h('strong', {}, th.title), h('small', {}, th.scopeLabel + ' · ' + th.updatedTime + ' · ' + th.messages.length + ' msg')), h('button', { type: 'button', className: 'mf-ai-thread-delete', 'aria-label': 'Excluir conversa ' + th.title, title: 'Excluir conversa', onClick: () => intelligenceDeleteThread(app, th.id) }, '×')))))), totalThreads > 0 ? h('div', { className: 'mf-ai-history-foot' }, h('button', { type: 'button', className: 'ghost-button full', onClick: () => intelligenceClearHistory(app) }, s.categoryReviewGrant ? 'Limpar conversa temporária' : 'Limpar histórico do perfil')) : null);
}
function renderIntelligenceView(app) {
    var _a, _b, _c, _d;
    if (((_a = app.state.workIntelligenceDemo) === null || _a === void 0 ? void 0 : _a.enabled) && typeof renderWorkIntelligenceDemo === 'function')
        return renderWorkIntelligenceDemo(app);
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    const s = app.state, tab = s.intelligenceTab || 'today';
    if (s.categoryReviewOpen)
        return h('section', { className: 'section mf-intelligence-page' }, renderCategoryReview(app));
    const tabs = [{ id: 'today', label: 'Hoje' }, { id: 'chat', label: 'Conversar' }, { id: 'actions', label: 'Plano de ação' }];
    const messages = intelligenceHistoryList(app);
    const allProposals = typeof intelligenceAllProposals === 'function' ? intelligenceAllProposals(app) : messages.map(m => m.proposal).filter(Boolean);
    const convState = typeof intelligenceConversationState === 'function' ? intelligenceConversationState(app) : { kind: 'oauth_disconnected', pill: 'Conta desconectada · modo local', badge: 'Conta desconectada', css: 'is-offline' };
    const activeScope = s.intelligenceDraftScope || intelligencePageScope(app, s.intelligenceContext || s.page);
    let section = null;
    if (tab === 'today')
        section = h('div', { className: 'mf-ai-today' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => workDemoLoad(app) }, 'Explorar nova Inteligência · dados fictícios'), h('div', { className: 'mf-ai-welcome' }, h('span', { className: 'micro-label' }, 'PAINEL CONCEITUAL · DADOS FICTÍCIOS'), h('h2', {}, 'Três assuntos para explorar.'), h('p', {}, 'Exemplos fictícios. Eles não representam alertas reais das suas contas.')), h('div', { className: 'mf-ai-card-grid' }, intelligenceExampleCard(app, 'future', 'Compromissos à frente', 'Analise pagamentos futuros antes de separar dinheiro para investir.', 'calendar', 'Avalie meus compromissos futuros antes de eu reservar dinheiro para investimentos.'), intelligenceExampleCard(app, 'budgets', 'Limites mais inteligentes', 'Compare o comportamento das categorias antes de alterar seu orçamento.', 'pie', 'Ajude-me a elaborar limites inteligentes para o próximo mês.'), intelligenceExampleCard(app, 'reserve', 'Reserva e liquidez', 'Entenda a diferença entre saldo disponível e dinheiro realmente livre.', 'shield', 'Como calcular o dinheiro realmente livre para poupar ou investir?')), h('div', { className: 'mf-ai-explainer' }, h(Icon, { name: 'shield', size: 19 }), h('div', {}, h('strong', {}, 'Insights econômicos por padrão'), h('p', {}, 'Na integração definitiva, alertas matemáticos virão do motor financeiro; o GPT-6.1 Sol será acionado apenas quando você solicitar explicação ou análise.'))));
    if (tab === 'today' && ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) && typeof renderLocalFinancialRadar === 'function')
        section = renderLocalFinancialRadar(app);
    if (tab === 'chat')
        section = h('div', { className: 'mf-ai-workbench' }, renderIntelligenceHistorySidebar(app), h('div', { className: 'mf-ai-chat-main mf-ai-workbench-main' }, h('div', { className: 'mf-ai-workbench-header' }, h('div', { className: 'mf-ai-chat-hero' }, h('span', { className: 'mf-ai-orb' }, h(Icon, { name: 'spark', size: 25 })), h('h2', {}, 'Central de conversação financeira'), h('p', {}, s.categoryReviewGrant ? 'Conversa temporária compartilhada com o chat lateral. Prévia e confirmação continuam disponíveis na Central.' : 'Histórico compartilhado com o chat lateral, salvo localmente quando disponível. Não cole credenciais.')), h('div', { className: 'mf-ai-workbench-badges' }, h('span', { className: 'mf-ai-conn-pill ' + convState.css }, convState.pill), h('span', { className: 'mf-ai-scope-badge' }, 'Contexto: ' + activeScope.label + ' · ' + activeScope.period))), s.intelligenceDraftScope ? h('div', { className: 'mf-ai-context-meta' }, h('span', {}, 'Rascunho de ' + s.intelligenceDraftScope.label), h('span', {}, s.intelligenceDraftScope.period)) : null, s.intelligencePreparedQuestion ? h('div', { className: 'mf-ai-prepared', role: 'status' }, h('span', { className: 'micro-label' }, 'PERGUNTA PREPARADA · NÃO ENVIADA'), h('p', {}, s.intelligencePreparedQuestion), h('small', {}, 'Este rascunho não é enviado ao Sol. Use os casos fictícios autorizados abaixo; nenhuma chamada ocorreu aqui.')) : null, messages.length === 0 ? h('div', { className: 'mf-ai-empty-thread' }, h('h3', {}, 'Comece uma análise ou prepare uma categorização supervisionada'), h('p', {}, 'Suas conversas ficam organizadas por data na coluna à esquerda e continuam disponíveis ao alternar para o chat lateral em qualquer uma das oito áreas.'), h('div', { className: 'mf-ai-starter-grid' }, ['Categorize minha compra do mercado como Alimentação.', 'Mostre um resumo estruturado das minhas movimentações carregadas.', 'Como construir uma reserva de emergência?', 'Quando faz sentido antecipar uma dívida?'].map((q, i) => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: i, onClick: () => intelligenceSubmitQuestion(app, q) }, h('span', {}, q), h(Icon, { name: 'arrow', size: 14 }))))) :
            h('div', { className: 'mf-ai-thread', role: 'log', 'aria-live': 'polite' }, ...messages.map(m => renderIntelligenceMessageItem(app, m)), (s.aiBusy || s.localFinancialBusy) ? h('div', { className: 'mf-ai-msg is-assistant is-streaming', role: 'status' }, h('strong', {}, 'Assistente MF'), h('p', {}, 'Processando solicitação…')) : null), s.aiError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.aiError) : null, h('div', { className: 'mf-ai-composer' }, h('label', { className: 'mf-ai-composer-label', htmlFor: 'mf-ai-draft' }, 'Sua pergunta ou comando supervisionado'), h('textarea', { id: 'mf-ai-draft', value: s.intelligenceDraft || '', rows: 3, maxLength: 750, placeholder: 'Ex.: Categorize minha compra do mercado de ontem como Alimentação…', onChange: (e) => app.setState({ intelligenceDraft: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if ((s.intelligenceDraft || '').trim())
                    void intelligenceSubmitQuestion(app, s.intelligenceDraft);
            } } }), h('span', { className: 'mf-ai-compose-actions' }, h('small', {}, convState.pill + ((((_c = s.localFinancialAccess) === null || _c === void 0 ? void 0 : _c.token) || s.categoryReviewGrant) ? ' · respostas na memória da sessão' : ' · armazenamento local isolado (' + (s.mode === 'demo' ? 'Demonstração' : 'Pessoal') + ')')), h('div', { className: 'mf-ai-compose-btns' }, h('button', { type: 'button', className: 'ghost-button', disabled: !(s.intelligenceDraft || '').trim(), onClick: () => app.setState({ intelligencePreparedQuestion: (s.intelligenceDraft || '').trim(), intelligenceDraft: '' }) }, 'Guardar rascunho'), h('button', { type: 'button', className: 'primary-button', disabled: !(s.intelligenceDraft || '').trim() || Boolean(s.aiBusy || s.localFinancialBusy), onClick: () => intelligenceSubmitQuestion(app, s.intelligenceDraft) }, 'Enviar no chat', h(Icon, { name: 'arrow', size: 16 })))))));
    else if (tab === 'actions')
        section = h('div', { className: 'mf-ai-actions' }, h('div', { className: 'mf-ai-welcome' }, h('span', { className: 'micro-label' }, 'AÇÕES SUPERVISIONADAS E EXEMPLOS · SEM GRAVAÇÃO AUTOMÁTICA'), h('h2', {}, 'Sugestões e prévias para revisar, nunca automáticas.'), h('p', {}, 'As propostas preparadas nas suas conversas aparecem abaixo mantendo a prévia sem gravação até a entrega I2-B.')), allProposals.length ? h('div', { className: 'mf-ai-proposals-list', 'aria-label': 'Propostas supervisionadas da sessão' }, ...allProposals.map(p => renderIntelligenceActionProposalCard(app, p))) :
            h('div', { className: 'mf-ai-empty-actions' }, h('p', {}, 'Nenhuma proposta supervisionada pendente nesta conversa. Peça no chat, por exemplo: “Categorize minha compra do mercado como Alimentação”.')), [{ id: 'limits', title: 'Revisar limites de categorias', description: 'Compare médias, compromissos e uma margem de segurança.', question: 'Prepare uma proposta de limites por categoria para o próximo mês.' },
            { id: 'reserve', title: 'Planejar reserva de emergência', description: 'Estime um objetivo compatível com despesas essenciais e liquidez.', question: 'Como construir uma reserva de emergência considerando meus compromissos?' },
            { id: 'review', title: 'Revisar despesas recorrentes', description: 'Identifique cobranças repetidas antes de propor mudanças.', question: 'Como posso avaliar se meus gastos recorrentes precisam de revisão?' }].map((item) => h('div', { className: 'mf-ai-action-card', key: item.id }, h('div', { className: 'mf-ai-action-text' }, h('span', { className: 'mf-ai-status' }, 'Exemplo ilustrativo'), h('h3', {}, item.title), h('p', {}, item.description), s.intelligenceExpandedAction === item.id ? h('div', { className: 'mf-ai-action-detail' }, 'Na versão conectada, esta proposta mostrará dados utilizados, impacto esperado, validade da análise e ações de aceitar, editar ou rejeitar. Nada será aplicado automaticamente.') : null), h('div', { className: 'mf-ai-action-buttons' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => app.setState({ intelligenceExpandedAction: s.intelligenceExpandedAction === item.id ? null : item.id }) }, s.intelligenceExpandedAction === item.id ? 'Recolher' : 'Ver detalhes'), h('button', { type: 'button', className: 'mf-ai-link', onClick: () => intelligencePrepare(app, item.question) }, 'Preparar análise', h(Icon, { name: 'arrow', size: 15 }))))));
    return h('section', { className: 'section mf-intelligence-page', 'aria-label': 'Inteligência financeira' }, h('div', { className: 'mf-ai-intro' }, h('div', {}, h('span', { className: 'micro-label' }, 'INTELIGÊNCIA FINANCEIRA'), h('h2', {}, 'Seu espaço de análise e conversação'), h('p', {}, ((_d = s.localFinancialAccess) === null || _d === void 0 ? void 0 : _d.token) ? 'Hoje e chat consultam os registros autorizados; respostas somente nesta sessão.' : 'Hoje, conversa com histórico persistente e plano de ação supervisionado.')), h('span', { className: 'mf-ai-preview-label' }, h(Icon, { name: 'shield', size: 15 }), s.mode === 'demo' ? 'Prévia · dados fictícios' : 'Prévia · dados locais, sem inferência')), typeof renderLocalFinancialAccess === 'function' ? renderLocalFinancialAccess(app) : null, h('button', { type: 'button', className: 'outlined-action', onClick: () => void categoryReviewOpen(app) }, 'Central de revisão · categorização supervisionada'), h('div', { className: 'mf-ai-tabbar', role: 'tablist', 'aria-label': 'Seções da Inteligência' }, tabs.map((item) => h('button', { type: 'button', key: item.id, role: 'tab', 'aria-selected': tab === item.id,
        id: 'mf-ai-tab-' + item.id, 'aria-controls': 'mf-ai-section-' + item.id, tabIndex: tab === item.id ? 0 : -1, className: tab === item.id ? 'active' : '', onClick: () => app.setState({ intelligenceTab: item.id, categoryReviewOpen: false }), onKeyDown: (e) => { const next = intelligenceNextTab(item.id, e.key); if (next) {
            e.preventDefault();
            app.setState({ intelligenceTab: next, categoryReviewOpen: false }, () => { var _a; return (_a = document.getElementById('mf-ai-tab-' + next)) === null || _a === void 0 ? void 0 : _a.focus(); });
        } } }, item.label))), h('div', { id: 'mf-ai-section-' + tab, role: 'tabpanel', 'aria-labelledby': 'mf-ai-tab-' + tab, tabIndex: 0 }, section), h('details', { className: 'mf-ai-lab-disclosure' }, h('summary', {}, h(Icon, { name: 'settings', size: 17 }), h('span', {}, 'Laboratório de Inteligência'), h('small', {}, 'Configurações técnicas, conexão OAuth, memória e contexto sintético')), renderIntelligenceConnection(app), renderIntelligencePrivacy(app), renderIntelligenceFinancialContext(app)));
}
function renderIntelligencePanel(app) {
    var _a;
    if (!app.state.intelligencePanelOpen)
        return null;
    if (((_a = app.state.workIntelligenceDemo) === null || _a === void 0 ? void 0 : _a.enabled) && typeof renderWorkIntelligencePanel === 'function')
        return renderWorkIntelligencePanel(app);
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    const info = intelligenceContextFor(app.state.intelligenceContext);
    const scope = app.state.intelligenceContextSnapshot || intelligencePageScope(app, app.state.intelligenceContext);
    const messages = intelligenceHistoryList(app);
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const activeThreadId = app.state.intelligenceActiveThreadId || '';
    const convState = typeof intelligenceConversationState === 'function' ? intelligenceConversationState(app) : { kind: 'oauth_disconnected', pill: 'Conta desconectada · modo local', badge: 'Conta desconectada', css: 'is-offline' };
    const busy = Boolean(app.state.aiBusy || app.state.localFinancialBusy || app.state.intelligenceDrawerBusy);
    const draft = String(app.state.intelligenceDraft || '');
    return h('div', { className: 'mf-ai-backdrop', role: 'presentation', onMouseDown: (e) => { if (e.target === e.currentTarget)
            app.setState({ intelligencePanelOpen: false }); } }, h('aside', { className: 'mf-ai-drawer mf-ai-drawer-compact', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Assistente contextual de ' + info.label }, h('div', { className: 'mf-ai-drawer-head' }, h('div', { className: 'mf-ai-drawer-title-wrap' }, h('div', { className: 'mf-ai-drawer-kicker-row' }, h('span', { className: 'micro-label' }, 'COPILOTO CONTEXTUAL'), h('span', { className: 'mf-ai-conn-pill ' + convState.css }, convState.pill)), h('h2', {}, info.label)), h('div', { className: 'mf-ai-drawer-head-actions' }, h('button', { type: 'button', className: 'ghost-button mf-ai-expand-btn', 'aria-label': 'Nova conversa', title: 'Iniciar nova conversa', onClick: () => intelligenceCreateThread(app) }, 'Nova'), h('button', { type: 'button', className: 'ghost-button mf-ai-expand-btn', 'aria-label': 'Expandir na aba Inteligência', title: 'Abrir na aba Inteligência mantendo a conversa ativa', onClick: () => intelligenceOpenFullChat(app) }, 'Expandir'), h('button', { type: 'button', className: 'close-button', 'aria-label': 'Fechar assistente', onClick: () => app.setState({ intelligencePanelOpen: false }) }, '×'))), h('div', { className: 'mf-ai-context-meta mf-ai-drawer-scope' }, h('span', {}, scope.label), h('span', {}, scope.period), h('span', {}, scope.mode), ...scope.filters.map((filter) => h('span', { key: filter }, filter)), threads.length > 1 ? h('select', { className: 'mf-ai-drawer-thread-select', 'aria-label': 'Alternar conversa ativa', value: activeThreadId, onChange: (e) => intelligenceSelectThread(app, e.target.value) }, ...threads.map((t) => h('option', { key: t.id, value: t.id }, t.title + ' (' + t.messages.length + ')'))) : null), typeof renderLocalFinancialAccess === 'function' ? renderLocalFinancialAccess(app) : null, app.state.categoryReviewPreview ? h('div', { className: 'mf-review-drawer-pending' }, h('p', {}, 'Uma prévia de categorização aguarda sua decisão.'), h('button', { type: 'button', className: 'primary-button', onClick: () => void categoryReviewOpen(app) }, 'Revisar prévia na Central')) : null, h('div', { className: 'mf-ai-drawer-body' }, messages.length === 0 ? h('div', { className: 'mf-ai-drawer-empty' }, h('p', { className: 'muted-desc' }, info.description), h('div', { className: 'mf-ai-drawer-suggestions', 'aria-label': 'Sugestões rápidas para ' + info.label }, ...info.questions.map((q, i) => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: i, onClick: () => intelligenceSubmitQuestion(app, q) }, h('span', {}, q), h(Icon, { name: 'arrow', size: 15 }))))) :
        h('div', { className: 'mf-ai-drawer-messages', role: 'log', 'aria-live': 'polite' }, ...messages.map(m => renderIntelligenceMessageItem(app, m)), busy ? h('div', { className: 'mf-ai-msg is-assistant is-streaming', role: 'status' }, h('strong', {}, 'Assistente MF'), h('p', {}, 'Processando solicitação no contexto de ' + scope.label + '…')) : null), app.state.intelligenceStorageError ? h('p', { className: 'mf-ai-error', role: 'alert' }, app.state.intelligenceStorageError) : null, app.state.aiError ? h('p', { className: 'mf-ai-error', role: 'alert' }, app.state.aiError) : null), h('form', { className: 'mf-ai-drawer-composer', onSubmit: (e) => { e.preventDefault(); if (draft.trim() && !busy)
            void intelligenceSubmitQuestion(app, draft); } }, h('label', { className: 'mf-ai-context-composer', htmlFor: 'mf-ai-drawer-input' }, h('span', { className: 'sr-only' }, 'Pergunta para o assistente'), h('textarea', { id: 'mf-ai-drawer-input', value: draft, rows: 2, maxLength: 750, disabled: busy, placeholder: 'Pergunte sobre ' + scope.label.toLowerCase() + ' ou prepare prévia de categoria…', onChange: (e) => app.setState({ intelligenceDraft: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (draft.trim() && !busy)
                void intelligenceSubmitQuestion(app, draft);
        } } })), h('div', { className: 'mf-ai-drawer-footer' }, messages.length > 0 && activeThreadId ? h('button', { type: 'button', className: 'ghost-button', onClick: () => intelligenceDeleteThread(app, activeThreadId) }, 'Excluir conversa') : h('span', { className: 'mf-ai-drawer-hint' }, app.state.categoryReviewGrant ? 'Conversa temporária compartilhada com a aba Inteligência' : 'Histórico salvo e sincronizado com a aba Inteligência'), h('button', { type: 'submit', className: 'primary-button', disabled: !draft.trim() || busy }, busy ? 'Enviando…' : 'Enviar', h(Icon, { name: 'arrow', size: 15 }))))));
}
function renderIntelligenceSettings(app) {
    return h(Card, { className: 'settings-card mf-ai-settings' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Inteligência artificial'), h('p', {}, 'Autenticação local e testes fictícios · Entrega 2'))), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Estado'), h('strong', {}, app.state.aiStatus.connected ? 'Conectada' : 'Não conectada')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Modelo previsto'), h('strong', {}, 'GPT-6.1 Sol')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Raciocínio'), h('strong', {}, 'Low / Medium automático')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Economia de tokens'), h('strong', {}, 'Contexto mínimo + aprovação por teste')), h('p', { className: 'muted-desc' }, 'OAuth e memórias aprovadas são protegidos localmente no Windows. Nenhuma memória é enviada sem consentimento por teste. Dados bancários e sincronização de memórias no PWA continuam indisponíveis para a IA.'), h('button', { type: 'button', className: 'outlined-action full', onClick: () => app.navigate('intelligence') }, h(Icon, { name: 'spark', size: 17 }), 'Abrir prévia da Inteligência'));
}
function aiMarkdownInline(text) {
    const source = String(text || '');
    const nodes = [];
    const pattern = /\*\*(.+?)\*\*/g;
    let index = 0, m = null;
    while ((m = pattern.exec(source)) !== null) {
        if (m.index > index)
            nodes.push(source.slice(index, m.index));
        nodes.push(h('strong', { key: 'bold-' + m.index }, m[1]));
        index = m.index + m[0].length;
    }
    if (index < source.length)
        nodes.push(source.slice(index));
    return nodes.length ? nodes : [''];
}
function aiMarkdownTableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
}
function aiMarkdownNodes(input) {
    const lines = String(input || '').slice(0, 12000).split(/\r?\n/), out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) {
            i++;
            continue;
        }
        if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim()) && lines[i + 1].includes('---')) {
            const heads = aiMarkdownTableCells(lines[i]);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                const cols = aiMarkdownTableCells(lines[i++]);
                rows.push(h('tr', { key: 'row-' + i }, ...heads.map((_, j) => h('td', { key: j }, ...aiMarkdownInline(cols[j] || '')))));
            }
            out.push(h('div', { className: 'mf-ai-table-wrap', key: 'table-' + i }, h('table', {}, h('thead', {}, h('tr', {}, ...heads.map((c, j) => h('th', { key: j }, ...aiMarkdownInline(c))))), h('tbody', {}, ...rows))));
            continue;
        }
        if (/^#{1,3}\s+/.test(line)) {
            out.push(h('h3', { key: 'head-' + i }, ...aiMarkdownInline(line.replace(/^#{1,3}\s+/, ''))));
            i++;
            continue;
        }
        if (/^(?:[-*]\s+|\d+\.\s+)/.test(line)) {
            const ordered = /^\d+\.\s+/.test(line), items = [];
            while (i < lines.length && new RegExp(ordered ? '^\\d+\\.\\s+' : '^[-*]\\s+').test(lines[i].trim())) {
                items.push(h('li', { key: 'li-' + i }, ...aiMarkdownInline(lines[i].trim().replace(/^(?:[-*]\s+|\d+\.\s+)/, ''))));
                i++;
            }
            out.push(h(ordered ? 'ol' : 'ul', { key: 'list-' + i }, ...items));
            continue;
        }
        const para = [line];
        i++;
        while (i < lines.length && lines[i].trim() && !/^(?:#{1,3}\s+|[-*]\s+|\d+\.\s+|\|)/.test(lines[i].trim()))
            para.push(lines[i++].trim());
        out.push(h('p', { key: 'para-' + i }, ...aiMarkdownInline(para.join(' '))));
    }
    return out;
}
async function intelligenceRefresh(app) {
    var _a;
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiStatus))
        return;
    try {
        const [status, capabilities] = await Promise.all([desktop.aiStatus(), ((_a = desktop.aiCapabilities) === null || _a === void 0 ? void 0 : _a.call(desktop)) || Promise.resolve(null)]);
        app.setState({ aiStatus: status, aiCapabilities: capabilities, aiError: '' });
        if (status.connected)
            void intelligenceLoadPersonal(app);
        else
            app.setState({ aiMemories: [], aiUsageStats: null, aiUseMemories: false, aiPreview: null });
    }
    catch (e) {
        app.setState({ aiError: 'Não foi possível consultar o estado da conexão.' });
    }
}
async function intelligenceConnect(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiConnect) || app.state.aiBusy)
        return;
    app.setState({ aiBusy: true, aiError: '', aiResult: null, aiStreaming: '' });
    try {
        const status = await desktop.aiConnect();
        app.setState({ aiStatus: status, aiBusy: false });
        void intelligenceLoadPersonal(app);
    }
    catch (e) {
        app.setState({ aiBusy: false, aiError: String((e === null || e === void 0 ? void 0 : e.message) || 'Autorização não concluída.').slice(0, 250) });
    }
}
async function intelligenceDisconnect(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiDisconnect) || app.state.aiBusy)
        return;
    if (!confirm('Sair do ChatGPT neste computador? Para revogar o acesso remoto, use também as configurações de segurança do ChatGPT. Seus dados financeiros não serão afetados.'))
        return;
    app.setState({ aiBusy: true, aiError: '', aiResult: null, aiStreaming: '' });
    try {
        const status = await desktop.aiDisconnect();
        app.setState({ aiStatus: status, aiBusy: false, aiCreditsConfirmed: false, aiMemories: [], aiUsageStats: null, aiUseMemories: false, aiPreview: null });
    }
    catch (e) {
        app.setState({ aiBusy: false, aiError: 'Não foi possível desconectar.' });
    }
}
async function intelligenceTest(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiRunDemo) || !app.state.aiStatus.connected || app.state.aiBusy)
        return;
    if (!app.state.aiCreditsConfirmed) {
        app.setState({ aiError: 'Confirme que os créditos adicionais estão desativados no ChatGPT.' });
        return;
    }
    app.setState({ aiBusy: true, aiError: '', aiResult: null, aiStreaming: '' });
    try {
        const result = await desktop.aiRunDemo({ caseId: app.state.aiDemoCase, effort: app.state.aiEffort, creditsDisabledConfirmed: true, useSavedMemories: app.state.aiUseMemories === true });
        app.setState({ aiBusy: false, aiResult: result, aiPreview: result.context || null });
        void intelligenceLoadPersonal(app);
    }
    catch (e) {
        app.setState({ aiBusy: false, aiError: String((e === null || e === void 0 ? void 0 : e.message) || 'Teste não concluído.').slice(0, 300) });
    }
}
async function intelligenceLoadPersonal(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiMemoryList) || !(desktop === null || desktop === void 0 ? void 0 : desktop.aiUsageSummary) || !app.state.aiStatus.connected)
        return;
    try {
        const [memories, usage] = await Promise.all([desktop.aiMemoryList(), desktop.aiUsageSummary()]);
        app.setState({ aiMemories: memories, aiUsageStats: usage, aiMemoryError: '' });
    }
    catch (e) {
        app.setState({ aiMemoryError: String((e === null || e === void 0 ? void 0 : e.message) || 'Cofre local indisponível.').slice(0, 180), aiUseMemories: false });
    }
}
async function intelligenceAddMemory(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiMemoryAdd) || app.state.aiMemoryBusy)
        return;
    app.setState({ aiMemoryBusy: true, aiMemoryError: '' });
    try {
        const list = await desktop.aiMemoryAdd({ kind: app.state.aiMemoryKind, text: app.state.aiMemoryDraft });
        app.setState({ aiMemoryBusy: false, aiMemories: list, aiMemoryDraft: '', aiPreview: null });
        void intelligenceLoadPersonal(app);
    }
    catch (e) {
        app.setState({ aiMemoryBusy: false, aiMemoryError: String((e === null || e === void 0 ? void 0 : e.message) || 'Não foi possível salvar.').slice(0, 210) });
    }
}
async function intelligenceRemoveMemory(app, id) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiMemoryRemove) || app.state.aiMemoryBusy)
        return;
    if (!confirm('Excluir esta memória do cofre local?'))
        return;
    app.setState({ aiMemoryBusy: true, aiMemoryError: '' });
    try {
        const list = await desktop.aiMemoryRemove(id);
        app.setState({ aiMemoryBusy: false, aiMemories: list, aiPreview: null });
    }
    catch (e) {
        app.setState({ aiMemoryBusy: false, aiMemoryError: String((e === null || e === void 0 ? void 0 : e.message) || 'Falha ao excluir.').slice(0, 180) });
    }
}
async function intelligenceClearMemories(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiMemoryClear) || app.state.aiMemoryBusy)
        return;
    if (!confirm('Excluir permanentemente TODAS as memórias locais da IA? Isso não altera contas ou transações.'))
        return;
    app.setState({ aiMemoryBusy: true, aiMemoryError: '' });
    try {
        const list = await desktop.aiMemoryClear();
        app.setState({ aiMemoryBusy: false, aiMemories: list, aiUseMemories: false, aiPreview: null });
    }
    catch (e) {
        app.setState({ aiMemoryBusy: false, aiMemoryError: String((e === null || e === void 0 ? void 0 : e.message) || 'Falha ao limpar.').slice(0, 180) });
    }
}
async function intelligencePreviewContext(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiContextPreview) || app.state.aiMemoryBusy)
        return;
    try {
        const result = await desktop.aiContextPreview({ caseId: app.state.aiDemoCase, effort: app.state.aiEffort, useSavedMemories: app.state.aiUseMemories === true });
        app.setState({ aiPreview: result, aiMemoryError: '' });
    }
    catch (e) {
        app.setState({ aiPreview: null, aiMemoryError: String((e === null || e === void 0 ? void 0 : e.message) || 'Prévia indisponível.').slice(0, 200) });
    }
}
async function intelligenceBuildFinanceDemo(app) {
    if (!(desktop === null || desktop === void 0 ? void 0 : desktop.aiFinancialContextDemo) || app.state.aiFinancialDemoBusy)
        return;
    const source = app.state.aiFinancialDemoSource;
    if (source !== 'bank' && source !== 'manual')
        return;
    app.setState({ aiFinancialDemoBusy: true, aiFinancialDemo: null, aiFinancialDemoError: '' });
    try {
        const report = await desktop.aiFinancialContextDemo(source);
        if ((report === null || report === void 0 ? void 0 : report.stage) !== 'synthetic_financial_context_preview' || report.source !== source ||
            report.realFinancialDataIncluded !== false || report.inferenceCalled !== false ||
            report.changesApplied !== false || report.cloudCutoverAllowed !== false)
            throw new Error('Prévia financeira não autorizada.');
        app.setState({ aiFinancialDemoBusy: false, aiFinancialDemo: report });
    }
    catch (err) {
        app.setState({ aiFinancialDemoBusy: false, aiFinancialDemo: null,
            aiFinancialDemoError: String((err === null || err === void 0 ? void 0 : err.message) || 'Prévia indisponível.').slice(0, 180) });
    }
}
function renderIntelligenceFinancialContext(app) {
    const s = app.state, r = s.aiFinancialDemo;
    const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);
    const budgets = r ? r.budgets.map(b => h('p', { key: b.category }, b.category + ': ' +
        money(b.spentCents) + ' / ' + money(b.limitCents) + ' · ' + (b.pct === null ? 'sem limite' : b.pct + '%'))) : [];
    const warnings = r ? r.warnings.map((w, i) => h('li', { key: i }, w)) : [];
    return h('section', { className: 'mf-ai-financial-demo' }, h('span', { className: 'micro-label' }, 'ENTREGA 4.1 · MOTOR FINANCEIRO'), h('h2', {}, 'Prévia financeira estruturada'), h('p', {}, 'Demonstração fictícia de novembro/2026. Não consulta suas contas nem envia conteúdo ao GPT.'), h('div', { className: 'mf-ai-finance-controls' }, h('label', {}, 'Fonte fictícia', h('select', { value: s.aiFinancialDemoSource,
        onChange: e => app.setState({ aiFinancialDemoSource: e.target.value,
            aiFinancialDemo: null, aiFinancialDemoError: '' }) }, h('option', { value: 'bank' }, 'Banco fictício'), h('option', { value: 'manual' }, 'Lançamentos manuais fictícios'))), h('button', { type: 'button', className: 'primary-button',
        disabled: s.aiFinancialDemoBusy, onClick: () => intelligenceBuildFinanceDemo(app) }, s.aiFinancialDemoBusy ? 'Calculando...' : 'Gerar prévia sem tokens')), r ? h('div', { className: 'mf-ai-finance-results' }, h('p', { className: 'mf-ai-finance-privacy' }, 'Dados fictícios · Nenhuma chamada de IA · Nenhuma alteração'), h('div', { className: 'mf-ai-finance-metrics' }, h('div', {}, h('small', {}, 'Receitas lançadas'), h('strong', {}, money(r.realized.incomeCents))), h('div', {}, h('small', {}, 'Despesas lançadas'), h('strong', {}, money(r.realized.expenseCents))), h('div', {}, h('small', {}, 'Diferença — não é saldo'), h('strong', {}, money(r.realized.netCents)))), h('div', { className: 'mf-ai-finance-grid' }, h('div', {}, h('h3', {}, 'Orçamentos fictícios'), ...budgets), h('div', {}, h('h3', {}, 'Compromissos fictícios'), h('p', {}, 'Despesas futuras confirmadas: ' + money(r.future.pendingConfirmedExpensesCents)), h('p', {}, 'Receitas futuras incertas: ' + money(r.future.futureUncertainIncomeCents)))), h('h3', {}, 'Avisos sobre dados não verificados'), h('ul', {}, ...warnings), h('details', { className: 'mf-ai-finance-payload' }, h('summary', {}, 'Inspecionar contexto (não enviado)'), h('pre', {}, r.contextText), h('small', {}, 'Estimativa textual: ' + r.estimatedInputTokensApprox + ' tokens; não é consumo.'))) :
        h('p', { className: 'mf-ai-muted' }, 'Selecione uma fonte e gere o exemplo sem usar IA.'), s.aiFinancialDemoError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.aiFinancialDemoError) : null);
}
function renderIntelligencePrivacy(app) {
    var _a, _b;
    const s = app.state, connected = Boolean((_a = s.aiStatus) === null || _a === void 0 ? void 0 : _a.connected);
    const types = [{ id: 'preference', label: 'Preferência' }, { id: 'goal', label: 'Objetivo' }, { id: 'constraint', label: 'Restrição' }];
    return h('section', { className: 'mf-ai-personal-panel', 'aria-label': 'Memória aprovada e economia de tokens' }, h('div', { className: 'mf-ai-personal-head' }, h('div', {}, h('span', { className: 'micro-label' }, 'ENTREGA 3 · MEMÓRIA E CONTEXTO'), h('h2', {}, 'Personalização sob seu controle'), h('p', {}, 'Memórias criptografadas apenas neste computador. Nada é enviado ao modelo sem sua autorização por teste. O PWA usa a mesma política de contexto, mas ainda não sincroniza memórias.'))), connected ? h('div', { className: 'mf-ai-personal-form' }, h('label', {}, 'Tipo de memória', h('select', { value: s.aiMemoryKind, onChange: (e) => app.setState({ aiMemoryKind: e.target.value }) }, types.map(x => h('option', { key: x.id, value: x.id }, x.label)))), h('label', {}, 'O que você quer que o assistente considere?', h('input', { type: 'text', value: s.aiMemoryDraft, maxLength: 180,
        placeholder: 'Ex.: Prefiro explicações curtas e cálculos claros',
        onChange: (e) => app.setState({ aiMemoryDraft: e.target.value }) })), h('button', { type: 'button', className: 'ghost-button', disabled: s.aiMemoryBusy || !(s.aiMemoryDraft || '').trim(),
        onClick: () => intelligenceAddMemory(app) }, s.aiMemoryBusy ? 'Salvando...' : 'Aprovar e salvar memória')) : h('p', { className: 'mf-ai-notice' }, 'Conecte o ChatGPT no Windows para gerenciar memórias locais vinculadas à sua conta.'), connected ? h('div', { className: 'mf-ai-memory-list' }, h('div', { className: 'mf-ai-memory-row mf-ai-memory-title' }, h('strong', {}, 'Memórias aprovadas (' + (s.aiMemories || []).length + '/12)'), h('button', { type: 'button', className: 'mf-ai-link', disabled: !(s.aiMemories || []).length || s.aiMemoryBusy,
        onClick: () => intelligenceClearMemories(app) }, 'Limpar todas')), (s.aiMemories || []).length ?
        s.aiMemories.map((note) => {
            var _a;
            return h('div', { className: 'mf-ai-memory-row', key: note.id }, h('div', {}, h('span', { className: 'mf-ai-kind' }, ((_a = types.find(x => x.id === note.kind)) === null || _a === void 0 ? void 0 : _a.label) || note.kind), h('p', {}, note.text)), h('button', { type: 'button', className: 'ghost-button', disabled: s.aiMemoryBusy,
                onClick: () => intelligenceRemoveMemory(app, note.id) }, 'Excluir'));
        }) :
        h('p', { className: 'mf-ai-muted' }, 'Nenhuma memória salva. O modelo não conhece preferências pessoais por meio deste recurso.')) : null, connected ? h('div', { className: 'mf-ai-consent-panel' }, h('label', { className: 'mf-ai-check' }, h('input', { type: 'checkbox', checked: s.aiUseMemories === true && !!s.aiMemories.length,
        disabled: !(s.aiMemories || []).length || s.aiBusy,
        onChange: (e) => app.setState({ aiUseMemories: Boolean(e.target.checked), aiPreview: null }) }), h('span', {}, 'Incluir memórias aprovadas no próximo teste fictício. O texto selecionado será enviado ao Sol apenas se eu executar o teste.')), h('button', { type: 'button', className: 'ghost-button', disabled: s.aiMemoryBusy || s.aiBusy,
        onClick: () => intelligencePreviewContext(app) }, 'Ver contexto antes de enviar'), s.aiPreview ? h('div', { className: 'mf-ai-context-preview' }, h('strong', {}, 'Prévia local — nenhuma chamada de IA'), h('p', {}, 'Modelo: ' + s.aiPreview.model + ' · Memórias: ' + s.aiPreview.memoryCount + ' · Caracteres de entrada: ' + s.aiPreview.inputCharacters + ' · Estimativa aproximada: ' + s.aiPreview.estimatedInputTokensApprox + ' tokens.'), h('p', {}, 'Pergunta fictícia: ' + s.aiPreview.question), (_b = s.aiPreview.memoryNotes) === null || _b === void 0 ? void 0 : _b.map((note, i) => h('p', { key: i }, 'Memória ' + (i + 1) + ': ' + note.text)), h('small', {}, 'Esta estimativa não inclui instruções, saída ou raciocínio; não representa a franquia da conta.')) : null) : null, connected ? h('div', { className: 'mf-ai-usage-panel' }, h('strong', {}, 'Consumo registrado neste dispositivo'), s.aiUsageStats ? h('p', {}, 'Testes concluídos registrados: ' + s.aiUsageStats.completedSamples +
        ' · Entrada: ' + s.aiUsageStats.inputTokens +
        ' tokens · Saída: ' + s.aiUsageStats.outputTokens +
        ' tokens · Raciocínio: ' + s.aiUsageStats.reasoningTokens + ' tokens') : h('p', {}, 'Nenhum dado local de uso disponível.'), h('small', {}, 'Métricas observadas, não o limite do ChatGPT; apenas as últimas 60 respostas concluídas, sem conteúdo de mensagens.')) : null, s.aiMemoryError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.aiMemoryError) : null);
}
function renderIntelligenceConnection(app) {
    var _a, _b, _c, _d;
    const s = app.state, connected = Boolean((_a = s.aiStatus) === null || _a === void 0 ? void 0 : _a.connected), available = Boolean(desktop === null || desktop === void 0 ? void 0 : desktop.aiStatus);
    const cases = Array.isArray((_b = s.aiCapabilities) === null || _b === void 0 ? void 0 : _b.demoCases) ? s.aiCapabilities.demoCases : [];
    return h('div', { className: 'mf-ai-live-panel' }, h('div', { className: 'mf-ai-live-head' }, h('div', {}, h('span', { className: 'micro-label' }, 'ENTREGA 2 · TESTE DE AUTORIZAÇÃO'), h('h2', {}, 'Conectar ao ChatGPT'), h('p', {}, 'Os testes abaixo utilizam apenas perguntas fictícias predefinidas. Nenhuma movimentação real é compartilhada.')), h('span', { className: 'mf-ai-live-state ' + (connected ? 'ready' : '') }, connected ? 'Conectado' : 'Não conectado')), h('div', { className: 'mf-ai-live-actions' }, !connected ? h('button', { type: 'button', className: 'primary-button', disabled: !available || s.aiBusy || ((_c = s.aiStatus) === null || _c === void 0 ? void 0 : _c.secure) === false && ((_d = s.aiStatus) === null || _d === void 0 ? void 0 : _d.secure) !== undefined,
        onClick: () => intelligenceConnect(app) }, 'Continuar com ChatGPT') : h('button', { type: 'button', className: 'ghost-button', disabled: s.aiBusy, onClick: () => intelligenceDisconnect(app) }, 'Sair deste computador'), h('button', { type: 'button', className: 'ghost-button', disabled: !available || s.aiBusy, onClick: () => intelligenceRefresh(app) }, 'Atualizar estado')), !available ? h('p', { className: 'mf-ai-notice' }, 'A conexão exige a versão Electron atualizada. Esta prévia web não suporta autenticação de assinatura.') : null, connected ? h('div', { className: 'mf-ai-live-settings' }, h('p', {}, 'Conta autorizada: ' + (s.aiStatus.email || 'conta ChatGPT validada') + ' · Modelo exclusivo: GPT-6.1 Sol'), h('label', {}, 'Teste fictício', h('select', { value: s.aiDemoCase, onChange: (e) => app.setState({ aiDemoCase: e.target.value }) }, cases.map(c => h('option', { key: c.id, value: c.id }, c.label)))), h('label', {}, 'Raciocínio', h('select', { value: s.aiEffort, onChange: (e) => app.setState({ aiEffort: e.target.value }) }, ['auto', 'low', 'medium'].map(e => h('option', { key: e, value: e }, e === 'auto' ? 'Automático' : e === 'low' ? 'Baixo' : 'Médio')))), h('label', { className: 'mf-ai-check' }, h('input', { type: 'checkbox', checked: s.aiCreditsConfirmed,
        onChange: (e) => app.setState({ aiCreditsConfirmed: Boolean(e.target.checked) }) }), h('span', {}, 'Conferi em Configurações → Uso: créditos adicionais desativados e limite semanal do aplicativo abaixo de 100%.')), h('button', { type: 'button', className: 'primary-button', disabled: s.aiBusy || !s.aiCreditsConfirmed,
        onClick: () => intelligenceTest(app) }, s.aiBusy ? 'Executando teste...' : 'Testar GPT-6.1 Sol com dados fictícios'), h('p', { className: 'mf-ai-usage-warning' }, 'As configurações de créditos e o teto semanal são controlados pelo ChatGPT. Limite deste aplicativo abaixo de 100% impede uso de créditos adicionais nessa modalidade. O app não consegue verificar esses ajustes automaticamente. O teste conta com limite preventivo de três solicitações por sessão.')) : null, s.aiBusy ? h('p', { className: 'mf-ai-progress', role: 'status' }, 'Aguardando autenticação ou conclusão do teste...') : null, s.aiStreaming && !s.aiResult ? h('div', { className: 'mf-ai-stream', role: 'status' }, h('strong', {}, 'Resposta em andamento'), h('p', {}, s.aiStreaming.slice(0, 12000))) : null, s.aiResult ? h('div', { className: 'mf-ai-test-result' }, h('span', { className: 'micro-label' }, 'TESTE CONCLUÍDO · APENAS DADOS FICTÍCIOS'), h('div', { className: 'mf-ai-markdown' }, ...aiMarkdownNodes(s.aiResult.text || 'Nenhum texto retornado.')), s.aiResult.usageStored === false ? h('small', {}, 'As métricas desta resposta não puderam ser salvas no histórico local.') : null, h('small', {}, 'Modelo ' + s.aiResult.model + ' · esforço ' + s.aiResult.effort +
        (s.aiResult.usage ? ' · entrada ' + s.aiResult.usage.inputTokens + ' tokens · saída ' + s.aiResult.usage.outputTokens + ' tokens' : ''))) : null, s.aiError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.aiError) : null);
}
function intelligenceNowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function intelligenceFoldText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}
function intelligenceConversationState(app) {
    var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l, _m;
    if (app.state.categoryReviewGrant)
        return { kind: 'chat_available', pill: app.state.categoryReviewGrant.expiresAt > Date.now() ? 'Revisão sintética · sem IA externa' : 'Revisão sintética expirada', badge: 'Revisão sintética', css: 'is-local' };
    if ((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token)
        return { kind: 'chat_available', pill: app.state.localFinancialAccess.expiresAt > Date.now() ? 'Leitura local · sem IA externa' : 'Leitura local expirada', badge: 'Leitura local', css: 'is-local' };
    const s = (app === null || app === void 0 ? void 0 : app.state) || {};
    const activeError = String(s.aiError || ((_b = s.aiStatus) === null || _b === void 0 ? void 0 : _b.error) || '').trim();
    const explicitUnavailable = Boolean(activeError ||
        ((_c = s.aiStatus) === null || _c === void 0 ? void 0 : _c.unavailable) === true ||
        ((_d = s.aiStatus) === null || _d === void 0 ? void 0 : _d.serviceAvailable) === false ||
        ((_f = s.aiCapabilities) === null || _f === void 0 ? void 0 : _f.serviceAvailable) === false ||
        (((_g = s.aiStatus) === null || _g === void 0 ? void 0 : _g.connected) === true && ((_h = s.aiStatus) === null || _h === void 0 ? void 0 : _h.secure) === false));
    if (explicitUnavailable) {
        return { kind: 'service_unavailable', pill: 'Serviço temporariamente indisponível', badge: 'Indisponível', css: 'is-error' };
    }
    if (((_j = s.aiStatus) === null || _j === void 0 ? void 0 : _j.connected) === true) {
        const chatDeclared = Boolean(((_k = s.aiCapabilities) === null || _k === void 0 ? void 0 : _k.conversationalInferenceEnabled) === true ||
            ((_l = s.aiCapabilities) === null || _l === void 0 ? void 0 : _l.chatAvailable) === true ||
            ((_m = s.aiStatus) === null || _m === void 0 ? void 0 : _m.chatAvailable) === true);
        if (chatDeclared) {
            return { kind: 'chat_available', pill: 'Serviço de conversação disponível · motor I2-A pendente', badge: 'Chat disponível', css: 'is-ready' };
        }
        return { kind: 'oauth_connected_unimplemented', pill: 'Conta autenticada · chat aberto na I2-A', badge: 'Aguarda I2-A', css: 'is-auth-only' };
    }
    return { kind: 'oauth_disconnected', pill: 'Conta desconectada · modo local', badge: 'Sem OAuth', css: 'is-offline' };
}
function intelligenceReferenceToday(app) {
    var _a;
    const custom = (_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.today;
    if (typeof custom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(custom))
        return custom;
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function intelligenceShiftIsoDate(baseIso, deltaDays) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(baseIso))
        return null;
    const [y, m, d] = baseIso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    if (!Number.isFinite(dt.getTime()))
        return null;
    return dt.toISOString().slice(0, 10);
}
function intelligenceValidateIsoDate(y, m, d) {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31)
        return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d)
        return null;
    return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function intelligenceParseCategorizeIntent(question, categories, referenceToday) {
    const clean = String(question || '').trim();
    const m = /(?:categoriz(?:e|ar)|classifiqu(?:e|ar)|mud(?:e|ar)\s+a?\s*categoria(?:\s+d[aeo])?)\s+(.+?)\s+(?:como|para)\s+([A-Za-zÀ-ÿ0-9\s_-]+?)[.?!]*$/i.exec(clean);
    if (!m)
        return null;
    let body = m[1].trim();
    const rawCat = m[2].trim().replace(/^["'“”]|["'“”]$/g, '').trim();
    if (!body || !rawCat)
        return null;
    let originFilter = 'all';
    if (/\b(?:lan[çc]amento\s+manual|registro\s+manual|manualmente|manual)\b/i.test(body)) {
        originFilter = 'manual';
        body = body.replace(/\b(?:no\s+lan[çc]amento\s+manual|lan[çc]amento\s+manual|registro\s+manual|manualmente|manual)\b/gi, ' ');
    }
    else if (/\b(?:no\s+banco|do\s+banco|banc[áa]ri[ao]s?)\b/i.test(body)) {
        originFilter = 'bank';
        body = body.replace(/\b(?:no\s+banco|do\s+banco|na\s+conta\s+banc[áa]ria|banc[áa]ri[ao]s?)\b/gi, ' ');
    }
    let dateFilter = null;
    let invalidDate = null;
    const refIso = referenceToday && /^\d{4}-\d{2}-\d{2}$/.test(referenceToday) ? referenceToday : intelligenceReferenceToday(null);
    const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(body);
    const brFullMatch = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(body);
    const brShortMatch = !brFullMatch ? /\b(\d{1,2})\/(\d{1,2})\b/.exec(body) : null;
    if (isoMatch) {
        const valid = intelligenceValidateIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
        if (valid)
            dateFilter = valid;
        else
            invalidDate = isoMatch[0];
        body = body.replace(isoMatch[0], ' ');
    }
    else if (brFullMatch) {
        const valid = intelligenceValidateIsoDate(Number(brFullMatch[3]), Number(brFullMatch[2]), Number(brFullMatch[1]));
        if (valid)
            dateFilter = valid;
        else
            invalidDate = brFullMatch[0];
        body = body.replace(brFullMatch[0], ' ');
    }
    else if (brShortMatch && refIso) {
        const refYear = Number(refIso.slice(0, 4));
        const valid = intelligenceValidateIsoDate(refYear, Number(brShortMatch[2]), Number(brShortMatch[1]));
        if (valid)
            dateFilter = valid;
        else
            invalidDate = brShortMatch[0];
        body = body.replace(brShortMatch[0], ' ');
    }
    else if (/\banteontem\b/i.test(body)) {
        if (refIso)
            dateFilter = intelligenceShiftIsoDate(refIso, -2);
        else
            invalidDate = 'anteontem';
        body = body.replace(/\b(?:de\s+)?anteontem\b/gi, ' ');
    }
    else if (/\bontem\b/i.test(body)) {
        if (refIso)
            dateFilter = intelligenceShiftIsoDate(refIso, -1);
        else
            invalidDate = 'ontem';
        body = body.replace(/\b(?:de\s+)?ontem\b/gi, ' ');
    }
    else if (/\bhoje\b/i.test(body)) {
        if (refIso)
            dateFilter = refIso;
        else
            invalidDate = 'hoje';
        body = body.replace(/\b(?:de\s+)?hoje\b/gi, ' ');
    }
    let amountCentsFilter = null;
    const amtMatch = /(?:no\s+valor\s+de\s+|de\s+|por\s+)?R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?\b|(?:no\s+valor\s+de\s+|de\s+)(\d{1,6}),(\d{2})\b/i.exec(body);
    if (amtMatch) {
        const wholeRaw = (amtMatch[1] || amtMatch[3] || '').replace(/\./g, '');
        const decRaw = (amtMatch[2] || amtMatch[4] || '0').padEnd(2, '0');
        const cents = Number(wholeRaw) * 100 + Number(decRaw);
        if (Number.isSafeInteger(cents) && cents > 0)
            amountCentsFilter = cents;
        body = body.replace(amtMatch[0], ' ');
    }
    body = body
        .replace(/^(?:a\s+|o\s+|minha\s+|meu\s+)?(?:compra|despesa|gasto|lan[çc]amento|pagamento|transa[çc][ãa]o|recebimento|receita)?\s*(?:d[aeo]s?\s+|no\s+|na\s+|em\s+)?/i, '')
        .replace(/\b(?:feita|feito|realizada|realizado|no\s+dia|em|de|do|da)\s*$/i, '')
        .replace(/^["'“”]|["'“”]$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const catFold = intelligenceFoldText(rawCat);
    const catList = Array.isArray(categories) && categories.length ? categories : (typeof DEFAULT_CATEGORY_INFOS !== 'undefined' ? DEFAULT_CATEGORY_INFOS : []);
    const foundCat = catList.find((c) => intelligenceFoldText(c.name) === catFold) || null;
    return {
        term: body,
        targetCategory: foundCat ? String(foundCat.name) : rawCat,
        categoryInfo: foundCat ? { name: String(foundCat.name), kind: (foundCat.kind || 'expense') } : null,
        dateFilter,
        invalidDate,
        amountCentsFilter,
        originFilter
    };
}
function intelligenceMatchesEstablishment(labelFold, termFold) {
    if (!termFold || !labelFold)
        return false;
    if (labelFold.includes(termFold))
        return true;
    const tokens = termFold.split(' ').filter(t => t.length >= 3);
    if (tokens.length > 1 && tokens.every(t => labelFold.includes(t)))
        return true;
    return false;
}
function intelligenceBuildCategorizeProposal(app, intent) {
    var _a, _b, _c;
    const s = app.state || {};
    if (intent.invalidDate) {
        return {
            text: 'Não foi possível determinar a data **' + intent.invalidDate + '** informada no pedido. Informe uma data válida (ex.: `06/11/2026`, `hoje` ou `ontem`) antes de preparar a prévia.',
            proposal: null,
            details: 'Validação determinística de data rejeitou o parâmetro de data.'
        };
    }
    const catList = Array.isArray(s.categories) && s.categories.length ? s.categories : (typeof DEFAULT_CATEGORY_INFOS !== 'undefined' ? DEFAULT_CATEGORY_INFOS : []);
    if (!intent.categoryInfo) {
        const validNames = catList.map((c) => c.name).slice(0, 14).join(', ');
        return {
            text: 'A categoria **' + intent.targetCategory + '** não existe no seu cadastro atual. Escolha uma categoria válida (' + validNames + ') antes de preparar a prévia.',
            proposal: null,
            details: 'Categorias inexistentes são bloqueadas antes de construir propostas.'
        };
    }
    if (!intent.term) {
        return {
            text: 'Informe o nome do estabelecimento ou descrição do lançamento que deseja classificar como **' + intent.categoryInfo.name + '**.',
            proposal: null,
            details: 'Nenhum termo de estabelecimento foi identificado na solicitação.'
        };
    }
    const termFold = intelligenceFoldText(intent.term);
    const bankTxs = (s.mode === 'demo' || intent.originFilter === 'manual') ? [] : (Array.isArray((_b = (_a = s.bank) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.transactions) ? s.bank.data.transactions : []);
    const manualTxs = intent.originFilter === 'bank' ? [] : (Array.isArray((_c = s.data) === null || _c === void 0 ? void 0 : _c.transactions) ? s.data.transactions : []);
    const rawMatches = [];
    for (const b of bankTxs) {
        const displayTitle = String(b.customTitle || b.merchant || b.description || 'Movimentação bancária');
        const rawDesc = String(b.description || displayTitle);
        const searchable = intelligenceFoldText(displayTitle + ' ' + rawDesc + ' ' + (b.accountName || ''));
        if (!intelligenceMatchesEstablishment(searchable, termFold))
            continue;
        if (intent.dateFilter && String(b.date) !== intent.dateFilter)
            continue;
        const absAmount = Math.abs(Number(b.amount || 0));
        if (intent.amountCentsFilter !== null && absAmount !== intent.amountCentsFilter)
            continue;
        const nature = b.nature && b.nature !== 'auto' ? String(b.nature) : (Number(b.amount) >= 0 ? 'income' : 'expense');
        const txKind = nature === 'income' ? 'income' : 'expense';
        const accId = String(b.accountId || '');
        const accName = String(b.accountName || accId || 'Conta bancária');
        rawMatches.push({
            candidateKey: 'bank|' + accId + '|' + String(b.id),
            origin: 'bank',
            txId: String(b.id),
            accountId: accId,
            accountName: accName,
            description: displayTitle,
            rawDescription: rawDesc,
            date: String(b.date || ''),
            amountCents: absAmount,
            txKind,
            currentCategory: String(b.category || 'Outros'),
            natureRaw: nature
        });
    }
    for (const m of manualTxs) {
        const desc = String(m.description || 'Lançamento manual');
        const searchable = intelligenceFoldText(desc);
        if (!intelligenceMatchesEstablishment(searchable, termFold))
            continue;
        if (intent.dateFilter && String(m.date) !== intent.dateFilter)
            continue;
        const absAmount = Math.abs(Number(m.amount || 0));
        if (intent.amountCentsFilter !== null && absAmount !== intent.amountCentsFilter)
            continue;
        const txKind = m.kind === 'income' ? 'income' : 'expense';
        rawMatches.push({
            candidateKey: 'manual|manual|' + String(m.id),
            origin: 'manual',
            txId: String(m.id),
            accountId: 'manual',
            accountName: 'Manual',
            description: desc,
            rawDescription: desc,
            date: String(m.date || ''),
            amountCents: absAmount,
            txKind,
            currentCategory: String(m.category || 'Outros'),
            natureRaw: txKind
        });
    }
    if (rawMatches.length === 0) {
        const filterNotes = [
            intent.dateFilter ? 'data ' + intent.dateFilter : null,
            intent.amountCentsFilter !== null ? 'valor R$ ' + (intent.amountCentsFilter / 100).toFixed(2).replace('.', ',') : null,
            intent.originFilter !== 'all' ? 'origem ' + (intent.originFilter === 'bank' ? 'bancária' : 'manual') : null
        ].filter(Boolean).join(', ');
        return {
            text: 'Não encontrei nenhuma movimentação correspondente a **' + intent.term + '**' + (filterNotes ? ' (' + filterNotes + ')' : '') + ' para classificar como **' + intent.categoryInfo.name + '**.',
            proposal: null,
            details: 'Busca determinística verificou ' + bankTxs.length + ' registro(s) bancário(s) e ' + manualTxs.length + ' manual(is).'
        };
    }
    const nonTransfer = rawMatches.filter(r => r.natureRaw !== 'transfer' && r.natureRaw !== 'ignore');
    if (nonTransfer.length === 0) {
        return {
            text: 'O lançamento localizado para **' + intent.term + '** está marcado como transferência ou ignorado e não pode receber a categoria **' + intent.categoryInfo.name + '**.',
            proposal: null,
            details: 'Transferências próprias e lançamentos ignorados não aceitam reclassificação de receita/despesa.'
        };
    }
    const compatible = nonTransfer.filter(r => intent.categoryInfo.kind === 'both' || intent.categoryInfo.kind === r.txKind);
    if (compatible.length === 0) {
        const expectedKind = intent.categoryInfo.kind === 'income' ? 'receita (entrada)' : 'despesa (saída)';
        return {
            text: 'A categoria **' + intent.categoryInfo.name + '** é exclusiva para **' + expectedKind + '**, mas o lançamento localizado (**' + nonTransfer[0].description + '**) possui natureza incompatível.',
            proposal: null,
            details: 'Incompatibilidade entre a direção do movimento e o tipo da categoria cadastrada.'
        };
    }
    compatible.sort((a, b) => b.date.localeCompare(a.date) ||
        b.amountCents - a.amountCents ||
        a.description.localeCompare(b.description, 'pt-BR') ||
        a.candidateKey.localeCompare(b.candidateKey));
    const cleanCandidates = compatible.map(({ natureRaw: _n, ...rest }) => rest);
    if (cleanCandidates.length > 1) {
        const dates = new Set(cleanCandidates.map(c => c.date));
        const dateNote = dates.size > 1
            ? 'Ordenados por data verificada (de ' + cleanCandidates[0].date + ' a ' + cleanCandidates[cleanCandidates.length - 1].date + ').'
            : 'Todos registrados na mesma data (' + cleanCandidates[0].date + ').';
        const extraNote = cleanCandidates.length > 8
            ? ' Exibindo inicialmente 8 de ' + cleanCandidates.length + ' resultados; você pode refinar a busca (por data, valor exato ou origem) ou expandir a lista completa abaixo.'
            : '';
        return {
            text: 'Foram encontrados **' + cleanCandidates.length + ' lançamentos** compatíveis com **' + intent.term + '**. ' + dateNote + extraNote + ' Para evitar seleção arbitrária, escolha explicitamente abaixo qual lançamento deseja preparar na prévia para **' + intent.categoryInfo.name + '**:',
            proposal: {
                id: 'prop-' + Date.now(),
                kind: 'categorize',
                origin: cleanCandidates[0].origin,
                txId: '',
                accountId: '',
                accountName: '',
                description: 'Seleção pendente (' + cleanCandidates.length + ' opções)',
                date: cleanCandidates[0].date,
                amountCents: 0,
                txKind: cleanCandidates[0].txKind,
                currentCategory: '',
                proposedCategory: intent.categoryInfo.name,
                status: 'ambiguous',
                candidates: cleanCandidates,
                candidatesCount: cleanCandidates.length,
                visibleLimit: 8
            },
            details: 'Ambiguidade detectada entre ' + cleanCandidates.length + ' registros ordenados por data/valor/identidade. Todos os candidatos foram preservados sem truncamento.'
        };
    }
    const chosen = cleanCandidates[0];
    return {
        text: 'Localizei exatamente 1 movimentação compatível: **' + chosen.description + '** (' + (chosen.origin === 'bank' ? 'Banco · ' + chosen.accountName : 'Manual') + ' em ' + chosen.date + '). Confira abaixo a prévia sem gravação para **' + intent.categoryInfo.name + '**.',
        proposal: {
            id: 'prop-' + Date.now(),
            kind: 'categorize',
            origin: chosen.origin,
            txId: chosen.txId,
            accountId: chosen.accountId,
            accountName: chosen.accountName,
            description: chosen.description,
            rawDescription: chosen.rawDescription,
            date: chosen.date,
            amountCents: chosen.amountCents,
            txKind: chosen.txKind,
            currentCategory: chosen.currentCategory,
            proposedCategory: intent.categoryInfo.name,
            status: 'pending',
            candidatesCount: 1,
            visibleLimit: 1
        },
        details: 'Correspondência única verificada por estabelecimento, origem, data, valor e compatibilidade de categoria.'
    };
}
function intelligenceExpandProposalCandidates(app, proposalId, step) {
    const list = Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
    const updated = list.map((msg) => {
        if (!msg.proposal || msg.proposal.id !== proposalId || !Array.isArray(msg.proposal.candidates))
            return msg;
        const total = msg.proposal.candidates.length;
        const currentLimit = typeof msg.proposal.visibleLimit === 'number' && msg.proposal.visibleLimit > 0 ? msg.proposal.visibleLimit : 8;
        const nextLimit = typeof step === 'number' && step > 0 ? Math.min(total, currentLimit + step) : total;
        return {
            ...msg,
            proposal: {
                ...msg.proposal,
                visibleLimit: nextLimit
            }
        };
    });
    intelligenceSyncThreadMessages(app, updated);
}
function intelligenceVerifyProposalRecord(app, p) {
    var _a, _b, _c;
    const s = (app === null || app === void 0 ? void 0 : app.state) || {};
    const catList = Array.isArray(s.categories) && s.categories.length ? s.categories : (typeof DEFAULT_CATEGORY_INFOS !== 'undefined' ? DEFAULT_CATEGORY_INFOS : []);
    const catInfo = catList.find((c) => c.name === p.proposedCategory);
    if (!catInfo)
        return { ok: false, reason: 'A categoria proposta “' + p.proposedCategory + '” não existe mais no cadastro.' };
    if (catInfo.kind !== 'both' && catInfo.kind !== p.txKind)
        return { ok: false, reason: 'A categoria “' + p.proposedCategory + '” tornou-se incompatível com a natureza do lançamento.' };
    if (p.origin === 'bank') {
        if (s.mode === 'demo')
            return { ok: false, reason: 'O aplicativo entrou em modo demonstração; registros bancários reais não estão ativos.' };
        const txs = Array.isArray((_b = (_a = s.bank) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.transactions) ? s.bank.data.transactions : [];
        const rec = txs.find((t) => String(t.id) === p.txId && String(t.accountId || '') === String(p.accountId || ''));
        if (!rec)
            return { ok: false, reason: 'A movimentação bancária (conta ' + (p.accountName || p.accountId) + ') não foi localizada no estado atual.' };
        const nature = rec.nature && rec.nature !== 'auto' ? String(rec.nature) : (Number(rec.amount) >= 0 ? 'income' : 'expense');
        if (nature === 'transfer' || nature === 'ignore')
            return { ok: false, reason: 'A natureza da movimentação mudou para transferência/ignorado.' };
        const recKind = nature === 'income' ? 'income' : 'expense';
        if (recKind !== p.txKind)
            return { ok: false, reason: 'A direção contábil da movimentação foi alterada.' };
        if (String(rec.date || '') !== p.date)
            return { ok: false, reason: 'A data da movimentação mudou de ' + p.date + ' para ' + String(rec.date || '') + '.' };
        if (Math.abs(Number(rec.amount || 0)) !== p.amountCents)
            return { ok: false, reason: 'O valor da movimentação foi alterado desde a criação da proposta.' };
        if (String(rec.category || 'Outros') !== p.currentCategory)
            return { ok: false, reason: 'A categoria atual mudou de “' + p.currentCategory + '” para “' + String(rec.category || 'Outros') + '”.' };
        return { ok: true };
    }
    const manualTxs = Array.isArray((_c = s.data) === null || _c === void 0 ? void 0 : _c.transactions) ? s.data.transactions : [];
    const rec = manualTxs.find((t) => String(t.id) === p.txId);
    if (!rec)
        return { ok: false, reason: 'O lançamento manual não foi localizado no estado atual.' };
    const recKind = rec.kind === 'income' ? 'income' : 'expense';
    if (recKind !== p.txKind)
        return { ok: false, reason: 'O tipo do lançamento manual foi alterado.' };
    if (String(rec.date || '') !== p.date)
        return { ok: false, reason: 'A data do lançamento manual mudou de ' + p.date + ' para ' + String(rec.date || '') + '.' };
    if (Math.abs(Number(rec.amount || 0)) !== p.amountCents)
        return { ok: false, reason: 'O valor do lançamento manual foi alterado.' };
    if (String(rec.category || 'Outros') !== p.currentCategory)
        return { ok: false, reason: 'A categoria atual mudou de “' + p.currentCategory + '” para “' + String(rec.category || 'Outros') + '”.' };
    return { ok: true };
}
function intelligenceSelectActionCandidate(app, proposalId, candidateKey) {
    const list = Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
    const updated = list.map((msg) => {
        if (!msg.proposal || msg.proposal.id !== proposalId || msg.proposal.status !== 'ambiguous')
            return msg;
        const cand = (msg.proposal.candidates || []).find(c => c.candidateKey === candidateKey);
        if (!cand)
            return msg;
        const nextProposal = {
            ...msg.proposal,
            origin: cand.origin,
            txId: cand.txId,
            accountId: cand.accountId,
            accountName: cand.accountName,
            description: cand.description,
            rawDescription: cand.rawDescription,
            date: cand.date,
            amountCents: cand.amountCents,
            txKind: cand.txKind,
            currentCategory: cand.currentCategory,
            status: 'pending',
            resultMessage: 'Lançamento selecionado. Confira os dados abaixo para validar a prévia sem gravação.'
        };
        const check = intelligenceVerifyProposalRecord(app, nextProposal);
        if (!check.ok) {
            return {
                ...msg,
                proposal: {
                    ...nextProposal,
                    status: 'stale',
                    resultMessage: 'Estado desatualizado ao selecionar: ' + check.reason
                }
            };
        }
        return { ...msg, proposal: nextProposal };
    });
    intelligenceSyncThreadMessages(app, updated);
}
function intelligenceResolveActionProposal(app, proposalId, decision) {
    const list = Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
    const updated = list.map((msg) => {
        if (!msg.proposal || msg.proposal.id !== proposalId)
            return msg;
        if (decision === 'deny') {
            return {
                ...msg,
                proposal: {
                    ...msg.proposal,
                    status: 'denied',
                    resultMessage: 'Proposta negada pelo usuário. Nenhuma alteração foi realizada.'
                }
            };
        }
        if (msg.proposal.status === 'ambiguous' || !msg.proposal.txId) {
            return {
                ...msg,
                proposal: {
                    ...msg.proposal,
                    resultMessage: 'Selecione explicitamente um dos lançamentos listados antes de confirmar a prévia.'
                }
            };
        }
        const p = msg.proposal;
        const check = intelligenceVerifyProposalRecord(app, p);
        if (!check.ok) {
            return {
                ...msg,
                proposal: {
                    ...p,
                    status: 'stale',
                    resultMessage: 'Estado desatualizado: ' + check.reason + ' Nenhuma alteração foi validada.'
                }
            };
        }
        return {
            ...msg,
            proposal: {
                ...p,
                status: 'preview_confirmed',
                resultMessage: 'Prévia validada sem gravação: identidade (' + (p.origin === 'bank' ? 'Banco · ' + (p.accountName || p.accountId) : 'Manual') + '), data (' + p.date + '), valor e categoria (' + p.currentCategory + ' → ' + p.proposedCategory + ') conferidos. Nenhuma escrita foi executada no banco de dados (persistência real prevista para a I2-B).'
            }
        };
    });
    intelligenceSyncThreadMessages(app, updated);
}
async function intelligenceSubmitQuestion(app, rawQuestion) {
    var _a, _b, _c, _d;
    if (typeof categoryReviewHandleQuestion === 'function' && categoryReviewHandleQuestion(app, rawQuestion))
        return;
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) && typeof localFinancialSubmit === 'function')
        return localFinancialSubmit(app, rawQuestion);
    const q = String(rawQuestion || '').trim().slice(0, 750);
    if (!q || app.state.aiBusy || app.state.intelligenceDrawerBusy)
        return;
    const priorError = String(app.state.aiError || ((_b = app.state.aiStatus) === null || _b === void 0 ? void 0 : _b.error) || '').trim();
    const convState = intelligenceConversationState(app);
    const scope = app.state.intelligencePanelOpen && app.state.intelligenceContextSnapshot
        ? app.state.intelligenceContextSnapshot
        : intelligencePageScope(app, app.state.page);
    const now = intelligenceNowTime();
    const userMsg = {
        id: 'usr-' + Date.now(),
        role: 'user',
        text: q,
        createdAt: now,
        scopeLabel: scope.label,
        periodLabel: scope.period,
        status: 'sent'
    };
    intelligenceEnsureHydrated(app);
    const todayIso = intelligenceReferenceToday(app) || '2026-11-11';
    userMsg.createdAtIso = todayIso;
    const currentMessages = Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
    app.setState({
        intelligenceMessages: [...currentMessages, userMsg],
        intelligenceDraft: '',
        intelligencePreparedQuestion: q,
        intelligenceDraftScope: scope
    });
    const catIntent = intelligenceParseCategorizeIntent(q, app.state.categories, todayIso);
    if (catIntent) {
        const built = intelligenceBuildCategorizeProposal(app, catIntent);
        const reply = {
            id: 'ast-' + (Date.now() + 1),
            role: 'assistant',
            text: built.text,
            createdAt: intelligenceNowTime(),
            createdAtIso: todayIso,
            scopeLabel: scope.label,
            periodLabel: scope.period,
            status: 'done',
            details: built.details,
            proposal: built.proposal
        };
        intelligenceSyncThreadMessages(app, [...currentMessages, userMsg, reply], scope);
        return;
    }
    const wantsLocalSummary = /\b(?:resumo\s+estruturado|tabela\s+de\s+categorias|resumo\s+das\s+minhas\s+movimenta[çc][õo]es)\b/i.test(q);
    const structuredCard = wantsLocalSummary ? intelligenceBuildStructuredSummaryCard(app) : null;
    let replyText = '';
    let replyStatus = 'unavailable';
    if (convState.kind === 'service_unavailable') {
        replyStatus = 'error';
        const errReason = priorError || (((_c = app.state.aiStatus) === null || _c === void 0 ? void 0 : _c.connected) && ((_d = app.state.aiStatus) === null || _d === void 0 ? void 0 : _d.secure) === false ? 'cofre de criptografia local indisponível' : 'falha temporária de comunicação com o serviço de IA');
        replyText = '**Serviço temporariamente indisponível:** Não foi possível acessar o serviço de IA neste momento (' + errReason + '). Nenhuma resposta foi simulada.';
    }
    else if (convState.kind === 'chat_available') {
        replyStatus = 'unimplemented';
        replyText = '**Conta autenticada e serviço de conversação disponível, mas motor de conversação aberta ainda não implementado (aguarda I2-A):** Sua conexão OAuth com o ChatGPT está ativa e a capacidade de conversação está habilitada, porém o envio de perguntas abertas sobre dados financeiros reais ainda não foi implementado nesta etapa por segurança. Nenhuma resposta de IA foi simulada e nenhum provedor externo foi acionado.';
    }
    else if (convState.kind === 'oauth_connected_unimplemented') {
        replyStatus = 'unimplemented';
        replyText = '**Funcionalidade ainda não implementada (aguarda I2-A):** Sua conta ChatGPT está autenticada via OAuth, mas o serviço de conversação aberta sobre dados financeiros reais ainda não foi habilitado nesta etapa. Você já pode preparar prévias locais de categorização (ex.: *"Categorize minha compra do mercado de ontem como Alimentação"*) ou executar os casos homologados no Laboratório.';
    }
    else {
        replyStatus = 'unavailable';
        replyText = '**Conta desconectada (não autenticada) e conversação aberta pendente (I2-A):** O ChatGPT não está conectado neste computador e a conversação financeira livre será entregue na etapa I2-A. Nenhuma resposta de IA foi simulada. Prévias determinísticas de categorização continuam disponíveis localmente.';
    }
    const reply = {
        id: 'ast-' + (Date.now() + 1),
        role: 'assistant',
        text: replyText,
        createdAt: intelligenceNowTime(),
        createdAtIso: todayIso,
        scopeLabel: scope.label,
        periodLabel: scope.period,
        status: replyStatus,
        details: 'Estado: ' + convState.pill + ' · Escopo: ' + scope.label + ' (' + scope.period + ') · Conversa salva com segurança no histórico local do perfil.',
        structuredCard
    };
    intelligenceSyncThreadMessages(app, [...currentMessages, userMsg, reply], scope);
}
const INTELLIGENCE_STORAGE_PREFIX = 'mf_ai_threads_v1_';
const INTELLIGENCE_MAX_THREADS = 24;
const INTELLIGENCE_MAX_MESSAGES_PER_THREAD = 50;
function intelligenceStorageKey(mode) {
    return INTELLIGENCE_STORAGE_PREFIX + (mode === 'demo' ? 'demo' : 'real');
}
function intelligenceGetStorage(app) {
    if (app === null || app === void 0 ? void 0 : app.chatStorage)
        return app.chatStorage;
    try {
        if (typeof window !== 'undefined' && window.localStorage)
            return window.localStorage;
    }
    catch (_e) { }
    return null;
}
function intelligenceSanitizeStoredText(input) {
    let text = String(input || '').slice(0, 4000);
    text = text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[TOKEN_REMOVIDO]');
    text = text.replace(/\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi, 'Bearer [TOKEN_REMOVIDO]');
    text = text.replace(/\b(?:access_token|refresh_token|client_secret|id_token)\s*[:=]\s*[^\s,"']+/gi, '[SEGREDO_REMOVIDO]');
    return text;
}
function intelligenceSanitizeStoredMetadata(input, depth = 0) {
    if (depth > 6)
        return null;
    if (typeof input === 'string')
        return intelligenceSanitizeStoredText(input);
    if (typeof input === 'number')
        return Number.isFinite(input) ? input : null;
    if (typeof input === 'boolean')
        return input;
    if (Array.isArray(input))
        return input.slice(0, 100).map(value => intelligenceSanitizeStoredMetadata(value, depth + 1));
    if (input && typeof input === 'object') {
        const safe = {};
        for (const [key, value] of Object.entries(input).slice(0, 60)) {
            if (/^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|private[_-]?key|password|authorization|cookie|session[_-]?secret)$/i.test(key))
                continue;
            if (!/^[A-Za-z][A-Za-z0-9_-]{0,64}$/.test(key))
                continue;
            safe[key] = intelligenceSanitizeStoredMetadata(value, depth + 1);
        }
        return safe;
    }
    return null;
}
function intelligenceSanitizeThreadList(rawList, mode) {
    if (!Array.isArray(rawList))
        return [];
    const out = [];
    for (const item of rawList.slice(0, INTELLIGENCE_MAX_THREADS)) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string')
            continue;
        const itemMode = item.mode === 'demo' ? 'demo' : 'real';
        if (itemMode !== mode)
            continue;
        const rawMsgs = Array.isArray(item.messages) ? item.messages.slice(-INTELLIGENCE_MAX_MESSAGES_PER_THREAD) : [];
        const msgs = rawMsgs.filter((m) => m && typeof m.id === 'string' && typeof m.text === 'string').map((m) => ({
            id: String(m.id).slice(0, 80),
            role: (m.role === 'user' || m.role === 'system' ? m.role : 'assistant'),
            text: intelligenceSanitizeStoredText(m.text),
            createdAt: String(m.createdAt || '00:00').slice(0, 16),
            createdAtIso: typeof m.createdAtIso === 'string' ? m.createdAtIso.slice(0, 10) : undefined,
            scopeLabel: intelligenceSanitizeStoredText(String(m.scopeLabel || 'Geral')).slice(0, 60),
            periodLabel: intelligenceSanitizeStoredText(String(m.periodLabel || '')).slice(0, 80),
            status: (['sent', 'streaming', 'done', 'unavailable', 'unimplemented', 'error'].includes(m.status) ? m.status : 'done'),
            details: m.details ? intelligenceSanitizeStoredText(m.details) : undefined,
            proposal: m.proposal && typeof m.proposal === 'object' ? intelligenceSanitizeStoredMetadata(m.proposal) : null,
            structuredCard: m.structuredCard && typeof m.structuredCard === 'object' ? intelligenceSanitizeStoredMetadata(m.structuredCard) : null
        }));
        out.push({
            id: String(item.id).slice(0, 80),
            title: intelligenceSanitizeStoredText(String(item.title || 'Conversa financeira')).slice(0, 90) || 'Conversa financeira',
            createdAtIso: typeof item.createdAtIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.createdAtIso) ? item.createdAtIso : '2026-11-11',
            updatedAtIso: typeof item.updatedAtIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.updatedAtIso) ? item.updatedAtIso : '2026-11-11',
            updatedTime: String(item.updatedTime || '00:00').slice(0, 16),
            scopeLabel: intelligenceSanitizeStoredText(String(item.scopeLabel || 'Visão geral')).slice(0, 60),
            periodLabel: intelligenceSanitizeStoredText(String(item.periodLabel || '')).slice(0, 80),
            mode,
            messages: msgs
        });
    }
    return out;
}
function intelligenceLoadStoredThreads(app, mode) {
    var _a;
    if (mode === void 0) { mode = (((_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.mode) === 'demo' ? 'demo' : 'real'); }
    const store = intelligenceGetStorage(app);
    if (!store)
        return { threads: [], error: '' };
    try {
        const raw = store.getItem(intelligenceStorageKey(mode));
        if (!raw)
            return { threads: [], error: '' };
        const parsed = JSON.parse(raw);
        const list = intelligenceSanitizeThreadList((parsed === null || parsed === void 0 ? void 0 : parsed.threads) || parsed, mode);
        return { threads: list, error: '' };
    }
    catch (_e) {
        return { threads: [], error: 'Não foi possível ler o histórico salvo localmente (dados corrompidos ou armazenamento bloqueado).' };
    }
}
function intelligencePersistThreads(app, threads, mode) {
    var _a, _b, _c;
    if (mode === void 0) { mode = (((_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.mode) === 'demo' ? 'demo' : 'real'); }
    if (((_b = app.state.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) || ((_c = app.state.categoryReviewGrant) === null || _c === void 0 ? void 0 : _c.token))
        return '';
    const store = intelligenceGetStorage(app);
    if (!store)
        return 'Armazenamento local indisponível. Esta conversa não foi salva.';
    try {
        const sanitized = intelligenceSanitizeThreadList(threads, mode);
        const payload = JSON.stringify({ version: 1, mode, threads: sanitized });
        store.setItem(intelligenceStorageKey(mode), payload);
        return '';
    }
    catch (_e) {
        return 'Não foi possível salvar o histórico de conversas no armazenamento local (limite atingido ou acesso negado).';
    }
}
function intelligenceEnsureHydrated(app) {
    var _a, _b, _c, _d, _f, _g, _h;
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) || ((_b = app.state.categoryReviewGrant) === null || _b === void 0 ? void 0 : _b.token))
        return;
    if (!app || !app.state)
        return;
    const mode = app.state.mode === 'demo' ? 'demo' : 'real';
    if (app.state.intelligenceHydratedMode === mode && Array.isArray(app.state.intelligenceThreads))
        return;
    const loaded = intelligenceLoadStoredThreads(app, mode);
    const existingMsgs = Array.isArray(app.state.intelligenceMessages) && app.state.intelligenceHydratedMode === undefined ? app.state.intelligenceMessages : [];
    let threads = loaded.threads;
    let activeId = ((_c = threads[0]) === null || _c === void 0 ? void 0 : _c.id) || null;
    let activeMsgs = ((_d = threads[0]) === null || _d === void 0 ? void 0 : _d.messages) || [];
    if (existingMsgs.length > 0 && threads.length === 0) {
        const todayIso = intelligenceReferenceToday(app) || '2026-11-11';
        const firstUser = existingMsgs.find(m => m.role === 'user');
        const initialThread = {
            id: 'th-init-' + Date.now(),
            title: firstUser ? firstUser.text.slice(0, 60) : 'Conversa da sessão',
            createdAtIso: todayIso,
            updatedAtIso: todayIso,
            updatedTime: ((_f = existingMsgs[existingMsgs.length - 1]) === null || _f === void 0 ? void 0 : _f.createdAt) || intelligenceNowTime(),
            scopeLabel: ((_g = existingMsgs[0]) === null || _g === void 0 ? void 0 : _g.scopeLabel) || 'Visão geral',
            periodLabel: ((_h = existingMsgs[0]) === null || _h === void 0 ? void 0 : _h.periodLabel) || '',
            mode,
            messages: existingMsgs
        };
        threads = [initialThread];
        activeId = initialThread.id;
        activeMsgs = existingMsgs;
    }
    app.state.intelligenceHydratedMode = mode;
    app.state.intelligenceThreads = threads;
    app.state.intelligenceActiveThreadId = activeId;
    app.state.intelligenceMessages = activeMsgs;
    if (loaded.error)
        app.state.intelligenceStorageError = loaded.error;
}
function intelligenceSyncThreadMessages(app, messages, scopeOverride) {
    var _a, _b;
    intelligenceEnsureHydrated(app);
    const mode = app.state.mode === 'demo' ? 'demo' : 'real';
    const todayIso = intelligenceReferenceToday(app) || '2026-11-11';
    const nowTime = intelligenceNowTime();
    let threads = Array.isArray(app.state.intelligenceThreads) ? [...app.state.intelligenceThreads] : [];
    let activeId = app.state.intelligenceActiveThreadId || null;
    const trimmedMsgs = messages.slice(-INTELLIGENCE_MAX_MESSAGES_PER_THREAD);
    const firstUser = trimmedMsgs.find(m => m.role === 'user');
    const computedTitle = firstUser ? intelligenceSanitizeStoredText(firstUser.text).slice(0, 58) : 'Nova conversa';
    const scopeLabel = (scopeOverride === null || scopeOverride === void 0 ? void 0 : scopeOverride.label) || ((_a = trimmedMsgs[trimmedMsgs.length - 1]) === null || _a === void 0 ? void 0 : _a.scopeLabel) || intelligencePageScope(app).label;
    const periodLabel = (scopeOverride === null || scopeOverride === void 0 ? void 0 : scopeOverride.period) || ((_b = trimmedMsgs[trimmedMsgs.length - 1]) === null || _b === void 0 ? void 0 : _b.periodLabel) || intelligencePageScope(app).period;
    const idx = threads.findIndex(t => t.id === activeId);
    if (idx >= 0) {
        const current = threads[idx];
        const updatedThread = {
            ...current,
            title: current.title === 'Nova conversa' && firstUser ? computedTitle : current.title,
            updatedAtIso: todayIso,
            updatedTime: nowTime,
            scopeLabel,
            periodLabel,
            messages: trimmedMsgs
        };
        threads.splice(idx, 1);
        threads = [updatedThread, ...threads];
    }
    else if (trimmedMsgs.length > 0) {
        const newThread = {
            id: 'th-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            title: computedTitle,
            createdAtIso: todayIso,
            updatedAtIso: todayIso,
            updatedTime: nowTime,
            scopeLabel,
            periodLabel,
            mode,
            messages: trimmedMsgs
        };
        activeId = newThread.id;
        threads = [newThread, ...threads].slice(0, INTELLIGENCE_MAX_THREADS);
    }
    const storageErr = intelligencePersistThreads(app, threads, mode);
    app.setState({
        intelligenceHydratedMode: mode,
        intelligenceThreads: threads,
        intelligenceActiveThreadId: activeId,
        intelligenceMessages: trimmedMsgs,
        intelligenceStorageError: storageErr
    });
}
function intelligenceCreateThread(app, initialTitle = 'Nova conversa') {
    intelligenceEnsureHydrated(app);
    const mode = app.state.mode === 'demo' ? 'demo' : 'real';
    const todayIso = intelligenceReferenceToday(app) || '2026-11-11';
    const scope = app.state.intelligencePanelOpen && app.state.intelligenceContextSnapshot
        ? app.state.intelligenceContextSnapshot
        : intelligencePageScope(app, app.state.page);
    const newThread = {
        id: 'th-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: initialTitle.slice(0, 60) || 'Nova conversa',
        createdAtIso: todayIso,
        updatedAtIso: todayIso,
        updatedTime: intelligenceNowTime(),
        scopeLabel: scope.label,
        periodLabel: scope.period,
        mode,
        messages: []
    };
    const currentThreads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const nextThreads = [newThread, ...currentThreads].slice(0, INTELLIGENCE_MAX_THREADS);
    const storageErr = intelligencePersistThreads(app, nextThreads, mode);
    app.setState({
        intelligenceHydratedMode: mode,
        intelligenceThreads: nextThreads,
        intelligenceActiveThreadId: newThread.id,
        intelligenceMessages: [],
        intelligenceDraft: '',
        intelligenceStorageError: storageErr
    });
    return newThread.id;
}
function intelligenceSelectThread(app, threadId) {
    intelligenceEnsureHydrated(app);
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const found = threads.find(t => t.id === threadId);
    if (!found)
        return;
    app.setState({
        intelligenceActiveThreadId: found.id,
        intelligenceMessages: found.messages,
        intelligenceDraftScope: { label: found.scopeLabel, period: found.periodLabel, mode: found.mode === 'demo' ? 'Demonstração' : 'Pessoal' }
    });
}
function intelligenceDeleteThread(app, threadId, confirmFn) {
    intelligenceEnsureHydrated(app);
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const target = threads.find(t => t.id === threadId);
    if (!target)
        return false;
    const ask = confirmFn || (typeof confirm === 'function' ? confirm : () => false);
    if (!ask('Excluir permanentemente a conversa “' + target.title + '” deste perfil?'))
        return false;
    const mode = app.state.mode === 'demo' ? 'demo' : 'real';
    const remaining = threads.filter(t => t.id !== threadId);
    const nextActive = app.state.intelligenceActiveThreadId === threadId ? (remaining[0] || null) : (remaining.find(t => t.id === app.state.intelligenceActiveThreadId) || remaining[0] || null);
    const storageErr = intelligencePersistThreads(app, remaining, mode);
    if (storageErr) {
        app.setState({ intelligenceStorageError: storageErr });
        return false;
    }
    app.setState({
        intelligenceThreads: remaining,
        intelligenceActiveThreadId: nextActive ? nextActive.id : null,
        intelligenceMessages: nextActive ? nextActive.messages : [],
        intelligenceStorageError: storageErr
    });
    return true;
}
function intelligenceClearHistory(app, confirmFn) {
    var _a, _b;
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) || ((_b = app.state.categoryReviewGrant) === null || _b === void 0 ? void 0 : _b.token)) {
        app.setState({ intelligenceThreads: [], intelligenceMessages: [], intelligenceActiveThreadId: null });
        return;
    }
    intelligenceEnsureHydrated(app);
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    if (!threads.length)
        return false;
    const ask = confirmFn || (typeof confirm === 'function' ? confirm : () => false);
    if (!ask('Excluir todas as ' + threads.length + ' conversa(s) salvas neste perfil?'))
        return false;
    const mode = app.state.mode === 'demo' ? 'demo' : 'real';
    const storageErr = intelligencePersistThreads(app, [], mode);
    if (storageErr) {
        app.setState({ intelligenceStorageError: storageErr });
        return false;
    }
    app.setState({
        intelligenceThreads: [],
        intelligenceActiveThreadId: null,
        intelligenceMessages: [],
        intelligenceStorageError: storageErr
    });
    return true;
}
function intelligenceSwitchProfileMode(app, newMode) {
    var _a;
    if (app.state.categoryReviewGrant && typeof categoryReviewDisable === 'function')
        categoryReviewDisable(app);
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) && typeof localFinancialDisable === 'function')
        localFinancialDisable(app);
    const loaded = intelligenceLoadStoredThreads(app, newMode);
    const first = loaded.threads[0] || null;
    app.setState({
        mode: newMode,
        intelligenceHydratedMode: newMode,
        intelligenceThreads: loaded.threads,
        intelligenceActiveThreadId: first ? first.id : null,
        intelligenceMessages: first ? first.messages : [],
        intelligenceStorageError: loaded.error
    });
}
function intelligenceSearchThreads(app, query = app.state.intelligenceHistoryQuery || '') {
    intelligenceEnsureHydrated(app);
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const qFold = intelligenceFoldText(query);
    const sorted = [...threads].sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso) || b.updatedTime.localeCompare(a.updatedTime));
    if (!qFold)
        return sorted;
    return sorted.filter(t => {
        const hay = intelligenceFoldText([t.title, t.scopeLabel, t.periodLabel, ...t.messages.map(m => m.text)].join(' '));
        return hay.includes(qFold);
    });
}
function intelligenceGroupThreadsByDate(app, query = app.state.intelligenceHistoryQuery || '') {
    const filtered = intelligenceSearchThreads(app, query);
    if (!filtered.length)
        return [];
    const todayIso = intelligenceReferenceToday(app) || '2026-11-11';
    const yesterdayIso = intelligenceShiftIsoDate(todayIso, -1) || '';
    const groupsMap = { 'Hoje': [], 'Ontem': [], 'Anteriores': [] };
    for (const th of filtered) {
        if (th.updatedAtIso === todayIso)
            groupsMap['Hoje'].push(th);
        else if (yesterdayIso && th.updatedAtIso === yesterdayIso)
            groupsMap['Ontem'].push(th);
        else
            groupsMap['Anteriores'].push(th);
    }
    return ['Hoje', 'Ontem', 'Anteriores'].filter(k => groupsMap[k].length > 0).map(k => ({ label: k, items: groupsMap[k] }));
}
function intelligenceAllProposals(app) {
    intelligenceEnsureHydrated(app);
    const activeMsgs = Array.isArray(app.state.intelligenceMessages) ? app.state.intelligenceMessages : [];
    const fromActive = activeMsgs.map(m => m.proposal).filter(Boolean);
    if (fromActive.length > 0)
        return fromActive;
    const threads = Array.isArray(app.state.intelligenceThreads) ? app.state.intelligenceThreads : [];
    const all = [];
    for (const t of threads) {
        for (const m of t.messages) {
            if (m.proposal)
                all.push(m.proposal);
        }
    }
    return all;
}
function intelligenceBuildStructuredSummaryCard(app) {
    var _a, _b, _c, _d, _f;
    const s = (app === null || app === void 0 ? void 0 : app.state) || {};
    const moneyFmt = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
    const bankTxs = s.mode === 'demo' ? [] : (Array.isArray((_b = (_a = s.bank) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.transactions) ? s.bank.data.transactions : []);
    const manualTxs = Array.isArray((_c = s.data) === null || _c === void 0 ? void 0 : _c.transactions) ? s.data.transactions : [];
    if (!bankTxs.length && !manualTxs.length)
        return null;
    const useBank = s.mode !== 'demo' && bankTxs.length > 0 &&
        (s.dashboardSource !== 'manual' || manualTxs.length === 0);
    const records = useBank ? bankTxs : manualTxs;
    const sourceLabel = useBank ? 'contas conectadas' : 'lançamentos manuais';
    let totalExpense = 0, totalIncome = 0, postedCount = 0, excluded = 0;
    const byCat = new Map();
    if (typeof FinancePeriodLedger === 'undefined')
        return { title: 'Resumo indisponível', footnote: 'Motor financeiro indisponível. Nenhum total foi calculado.' };
    for (const rec of records) {
        if (!rec || typeof rec !== 'object') {
            excluded++;
            continue;
        }
        const row = useBank ? {
            date: rec.date, status: rec.status, amountCents: rec.amount, nature: rec.nature,
            category: rec.category || 'Outros',
            splits: !rec.splitOutdated && Array.isArray(rec.splits) ? rec.splits.map((p) => ({ category: p === null || p === void 0 ? void 0 : p.category, amountCents: p === null || p === void 0 ? void 0 : p.amount })) : undefined
        } : { date: rec.date, kind: rec.kind, amountCents: rec.amount, category: rec.category || 'Outros' };
        try {
            const result = FinancePeriodLedger.aggregateFinancePeriod([row], {
                start: rec.date, end: rec.date, source: useBank ? 'bank' : 'manual'
            });
            excluded += result.excluded;
            postedCount += result.transactionsIncluded;
            totalIncome += result.incomeCents;
            totalExpense += result.expenseCents;
            for (const part of result.expenses) {
                const prior = byCat.get(part.name) || { expense: 0, count: 0 };
                byCat.set(part.name, { expense: prior.expense + part.amountCents, count: prior.count + 1 });
            }
        }
        catch {
            excluded++;
        }
    }
    const rows = [...byCat.entries()].sort((a, b) => b[1].expense - a[1].expense).slice(0, 5).map(([cat, info]) => ({
        col1: cat, col2: String(info.count) + ' reg.', col3: moneyFmt(info.expense)
    }));
    const partial = useBank && !!((_f = (_d = s.bank) === null || _d === void 0 ? void 0 : _d.data) === null || _f === void 0 ? void 0 : _f.truncated);
    return {
        title: 'Resumo determinístico local (sem uso de IA)',
        subtitle: (s.mode === 'demo' ? 'Perfil Demonstração' : 'Perfil Pessoal') + ' · origem: ' + sourceLabel + ' · ' + records.length + ' linhas carregadas',
        metrics: [
            { label: 'Entradas confirmadas carregadas', value: moneyFmt(totalIncome), tone: 'positive' },
            { label: 'Saídas confirmadas carregadas', value: moneyFmt(totalExpense), tone: 'warning' },
            { label: 'Registros válidos', value: String(postedCount), tone: 'neutral' }
        ],
        headers: ['Categoria', 'Qtd.', 'Despesas carregadas'], rows,
        footnote: (partial ? 'Histórico bancário parcial: estes valores não representam todos os registros. ' : '') +
            'Soma de uma única origem (' + sourceLabel + '), nunca banco + manual; ' + excluded +
            ' registros pendentes/desconsiderados fora dos totais. Valores apenas dos registros carregados, não saldo auditado.'
    };
}
let workDemoSequence = 0;
function workDemoId() { return 'work-demo-' + (++workDemoSequence); }
function workDemoInitial() {
    const id = workDemoId();
    return { enabled: true, tab: 'today', source: 'bank', status: 'loading', error: '', revision: 0, snapshot: null,
        draft: '', threads: [{ id, title: 'Nova conversa', messages: [] }], activeId: id, proposal: null, audit: [] };
}
function workDemoMoney(n) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100); }
function workDemoSnapshot(raw, source) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!raw || raw.source !== source || raw.stage !== 'synthetic_financial_context_preview' ||
        raw.onlyFictitiousFinancialData !== true || raw.realFinancialDataIncluded !== false ||
        raw.inferenceCalled !== false || raw.changesApplied !== false || raw.cloudCutoverAllowed !== false ||
        raw.engine !== 'shared/finance-period-ledger.mjs')
        throw Error('O adaptador não confirmou a origem fictícia.');
    const money = (v) => { if (!Number.isSafeInteger(v))
        throw Error('Valor fictício inválido.'); return v; };
    const text = (v) => { if (typeof v !== 'string' || v.length > 300)
        throw Error('Texto fictício inválido.'); return v; };
    if (!Array.isArray(raw.budgets) || !Array.isArray(raw.warnings))
        throw Error('Contexto fictício incompleto.');
    return { source, engine: raw.engine, period: { start: text((_a = raw.period) === null || _a === void 0 ? void 0 : _a.start), end: text((_b = raw.period) === null || _b === void 0 ? void 0 : _b.end) },
        realized: { incomeCents: money((_c = raw.realized) === null || _c === void 0 ? void 0 : _c.incomeCents), expenseCents: money((_d = raw.realized) === null || _d === void 0 ? void 0 : _d.expenseCents), netCents: money((_e = raw.realized) === null || _e === void 0 ? void 0 : _e.netCents) },
        budgets: raw.budgets.map((b) => ({ category: text(b.category), limitCents: money(b.limitCents), spentCents: money(b.spentCents), pct: b.pct === null ? null : money(b.pct) })),
        future: { pendingConfirmedExpensesCents: money((_f = raw.future) === null || _f === void 0 ? void 0 : _f.pendingConfirmedExpensesCents), futureUncertainIncomeCents: money((_g = raw.future) === null || _g === void 0 ? void 0 : _g.futureUncertainIncomeCents) },
        warnings: raw.warnings.map(text) };
}
async function workDemoLoad(app, source = 'bank', adapter) {
    var _a;
    const previous = app.state.workIntelligenceDemo || workDemoInitial();
    const revision = previous.revision + 1;
    app.setState({ workIntelligenceDemo: { ...previous, enabled: true, source, revision, status: 'loading', error: '', snapshot: null,
            proposal: ((_a = previous.proposal) === null || _a === void 0 ? void 0 : _a.status) === 'pending' ? { ...previous.proposal, status: 'stale' } : previous.proposal } });
    try {
        const read = adapter || (typeof desktop !== 'undefined' && (desktop === null || desktop === void 0 ? void 0 : desktop.aiFinancialContextDemo) ?
            (s) => desktop.aiFinancialContextDemo(s) : null);
        if (!read)
            throw Error('O adaptador de demonstração está indisponível neste ambiente.');
        const snapshot = workDemoSnapshot(await read(source), source);
        app.setState((state) => {
            const current = state.workIntelligenceDemo;
            return (current === null || current === void 0 ? void 0 : current.enabled) && current.revision === revision ? { workIntelligenceDemo: { ...current, snapshot, status: 'ready' } } : {};
        });
    }
    catch (error) {
        app.setState((state) => {
            const current = state.workIntelligenceDemo;
            return (current === null || current === void 0 ? void 0 : current.enabled) && current.revision === revision ? { workIntelligenceDemo: { ...current, status: 'error', snapshot: null, error: String((error === null || error === void 0 ? void 0 : error.message) || 'Falha ao carregar demonstração.').slice(0, 180) } } : {};
        });
    }
}
function workDemoUpdate(app, patch) {
    app.setState((state) => ({ workIntelligenceDemo: { ...state.workIntelligenceDemo, ...patch } }));
}
function workDemoExit(app) {
    app.setState((state) => ({ workIntelligenceDemo: { ...state.workIntelligenceDemo, enabled: false, revision: state.workIntelligenceDemo.revision + 1 }, intelligencePanelOpen: false }));
}
function workDemoNewThread(app) {
    const d = app.state.workIntelligenceDemo, id = workDemoId();
    workDemoUpdate(app, { threads: [{ id, title: 'Nova conversa', messages: [] }, ...d.threads].slice(0, 12), activeId: id, draft: '', tab: 'chat' });
}
function workDemoPrepare(app) {
    const d = app.state.workIntelligenceDemo;
    if ((d === null || d === void 0 ? void 0 : d.status) !== 'ready' || !d.snapshot)
        return;
    const b = d.snapshot.budgets.find(b => b.spentCents > b.limitCents);
    if (!b)
        return;
    workDemoUpdate(app, { tab: 'actions', proposal: { id: workDemoId(), revision: d.revision, source: d.source, category: b.category,
            beforeCents: b.limitCents, afterCents: b.spentCents, status: 'pending' } });
}
function workDemoResolve(app, id, decision) {
    var _a;
    const d = app.state.workIntelligenceDemo, p = d === null || d === void 0 ? void 0 : d.proposal;
    if (!(d === null || d === void 0 ? void 0 : d.enabled) || !p || p.id !== id || p.status !== 'pending')
        return;
    const current = (_a = d.snapshot) === null || _a === void 0 ? void 0 : _a.budgets.find(b => b.category === p.category);
    const valid = d.status === 'ready' && p.revision === d.revision && p.source === d.source &&
        (current === null || current === void 0 ? void 0 : current.limitCents) === p.beforeCents && (current === null || current === void 0 ? void 0 : current.spentCents) === p.afterCents;
    const status = decision === 'deny' ? 'denied' : valid ? 'approved' : 'stale';
    workDemoUpdate(app, { proposal: { ...p, status }, audit: [...d.audit, { id: p.id, decision, result: status }].slice(-30) });
}
const WORK_DEMO_QUESTIONS = ['Quanto gastei com alimentação?', 'Quais orçamentos estão em risco?', 'Quanto tenho comprometido?', 'Posso comprar um celular parcelado?'];
function workDemoAnswer(snapshot, question) {
    const q = intelligenceFoldText(question);
    if (q.includes('alimentacao')) {
        const b = snapshot.budgets.find(b => b.category === 'Alimentação');
        return b ? 'Alimentação: ' + workDemoMoney(b.spentCents) + '. Valor confirmado no exemplo para ' + snapshot.period.start + ' a ' + snapshot.period.end + '.' : 'Não há dados suficientes de alimentação neste exemplo.';
    }
    if (q.includes('orcamento') || q.includes('limite')) {
        const risk = snapshot.budgets.filter(b => b.spentCents > b.limitCents);
        return risk.length ? risk.map(b => b.category + ': ' + workDemoMoney(b.spentCents) + ' gastos, limite ' + workDemoMoney(b.limitCents) + '.').join(' ') : 'Nenhum orçamento do exemplo está excedido. Isso não prevê o restante do mês.';
    }
    if (q.includes('comprometido') || q.includes('compromisso'))
        return 'Compromissos futuros confirmados do exemplo: ' + workDemoMoney(snapshot.future.pendingConfirmedExpensesCents) + '. Receitas incertas: ' + workDemoMoney(snapshot.future.futureUncertainIncomeCents) + ', fora do realizado.';
    if (q.includes('celular') || q.includes('comprar') || q.includes('parcel'))
        return 'Dados insuficientes: não há saldo bancário verificado nem projeção certificada. Use Simular compra para informar as premissas; este exemplo não conclui se a compra cabe no seu caixa.';
    if (q.includes('categoria') || q.includes('categorize') || q.includes('planej'))
        return 'Esta demonstração prepara somente ajustes de limite fictício. Categorização e compromissos supervisionados permanecem como próximas fatias; nenhum registro será alterado.';
    return 'Receitas do exemplo: ' + workDemoMoney(snapshot.realized.incomeCents) + '; despesas: ' + workDemoMoney(snapshot.realized.expenseCents) + '. Diferença: ' + workDemoMoney(snapshot.realized.netCents) + ', que não representa saldo disponível. Resposta determinística, sem modelo de IA.';
}
function workDemoSend(app, question) {
    const d = app.state.workIntelligenceDemo, q = String(question || '').trim().slice(0, 750);
    if (!q || (d === null || d === void 0 ? void 0 : d.status) !== 'ready' || !d.snapshot)
        return;
    const thread = d.threads.find(t => t.id === d.activeId);
    if (!thread)
        return;
    const messages = [...thread.messages,
        { id: workDemoId(), role: 'user', text: q, source: d.source },
        { id: workDemoId(), role: 'assistant', text: workDemoAnswer(d.snapshot, q), question: q, source: d.source }];
    workDemoUpdate(app, { draft: '', threads: d.threads.map(t => t.id === thread.id ? { ...t, title: t.messages.length ? t.title : q.slice(0, 42), messages: messages.slice(-50) } : t) });
}
function renderWorkDemoProposal(app, d) {
    const p = d.proposal;
    if (!p)
        return h('div', { className: 'mf-work-empty' }, h('h3', {}, 'Nenhuma alteração preparada'), h('p', {}, 'Escolha um alerta no radar para preparar uma prévia fictícia.'));
    const labels = { pending: 'Aguardando sua decisão', approved: 'Simulação concluída · nada gravado', denied: 'Proposta negada · nada gravado', stale: 'Prévia desatualizada · prepare novamente' };
    return h('section', { className: 'mf-work-proposal', 'aria-label': 'Prévia fictícia de ajuste de limite' }, h('span', { className: 'mf-work-badge' }, 'Recomendação · demonstração'), h('h3', {}, 'Revisar limite de ' + p.category), h('p', {}, 'Exemplo de ajuste ao gasto já lançado. Não é uma recomendação para o seu orçamento pessoal.'), h('div', { className: 'mf-work-diff' }, h('div', {}, h('small', {}, 'Limite atual fictício'), h('strong', {}, workDemoMoney(p.beforeCents))), h('span', { 'aria-hidden': 'true' }, '→'), h('div', {}, h('small', {}, 'Prévia fictícia'), h('strong', {}, workDemoMoney(p.afterCents)))), h('p', {}, 'Validação: fonte, revisão, categoria e valores devem continuar iguais.'), h('p', { role: 'status', 'data-work-proposal-status': p.status }, labels[p.status]), p.status === 'pending' ? h('div', { className: 'mf-work-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => workDemoResolve(app, p.id, 'allow') }, 'Permitir simulação'), h('button', { type: 'button', className: 'ghost-button', onClick: () => workDemoResolve(app, p.id, 'deny') }, 'Negar')) : null, h('small', {}, 'Sem escrita no SQLite. Decisão registrada apenas nesta sessão demonstrativa.'));
}
function renderWorkDemoChat(app, d, compact = false) {
    const thread = d.threads.find(t => t.id === d.activeId);
    return h('div', { className: 'mf-work-conversation' }, h('div', { className: 'mf-work-actions' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => workDemoNewThread(app) }, 'Nova conversa fictícia'), h('select', { 'aria-label': 'Conversas fictícias', value: d.activeId, onChange: (e) => workDemoUpdate(app, { activeId: e.target.value }) }, ...d.threads.map(t => h('option', { key: t.id, value: t.id }, t.title)))), h('div', { className: 'mf-work-messages', role: 'log', 'aria-live': 'polite', 'aria-label': 'Mensagens da demonstração' }, !(thread === null || thread === void 0 ? void 0 : thread.messages.length) ? h('div', { className: 'mf-work-empty' }, h('h3', {}, 'Converse com os números do exemplo'), h('p', {}, 'Respostas locais explicáveis. Sem envio para IA.')) : null, ...((thread === null || thread === void 0 ? void 0 : thread.messages) || []).map(m => h('article', { key: m.id, className: 'mf-work-message is-' + m.role }, h('small', {}, m.role === 'user' ? 'Você · demonstração' : 'Assistente · resposta determinística'), h('p', {}, m.text), m.role === 'assistant' ? h('details', {}, h('summary', {}, 'Dados e cálculo consultados'), h('p', {}, 'Fonte fictícia: ' + m.source + '. Motor: shared/finance-period-ledger.mjs. Novembro/2026. Banco e manual separados; pendências e transferências fora do realizado. Sem saldo verificado.')) : null))), h('div', { className: 'mf-work-prompts' }, ...WORK_DEMO_QUESTIONS.slice(0, compact ? 2 : 4).map(q => h('button', { type: 'button', key: q, className: 'ghost-button', disabled: d.status !== 'ready', onClick: () => workDemoSend(app, q) }, q))), h('form', { className: 'mf-work-composer', onSubmit: (e) => { e.preventDefault(); workDemoSend(app, d.draft); } }, h('label', {}, 'Pergunta sobre os dados fictícios', h('textarea', { rows: 2, maxLength: 750, value: d.draft, disabled: d.status !== 'ready', onChange: (e) => workDemoUpdate(app, { draft: e.target.value }) })), h('button', { className: 'primary-button', type: 'submit', disabled: d.status !== 'ready' || !d.draft.trim() }, 'Enviar demonstração')));
}
function renderWorkIntelligenceDemo(app) {
    const d = app.state.workIntelligenceDemo, r = d.snapshot;
    return h('section', { className: 'section mf-work-demo', 'aria-label': 'Demonstração da nova Inteligência' }, h('header', { className: 'mf-work-hero' }, h('div', {}, h('span', { className: 'micro-label' }, 'INTELIGÊNCIA · DEMONSTRAÇÃO ISOLADA'), h('h2', {}, 'Suas próximas decisões, com contexto.'), h('p', {}, 'Dados fictícios de novembro de 2026 · sem IA externa · sem gravação financeira.')), h('button', { type: 'button', className: 'ghost-button', onClick: () => workDemoExit(app) }, 'Sair da demonstração')), h('div', { className: 'mf-work-toolbar' }, h('label', {}, 'Fonte do exemplo', h('select', { value: d.source, onChange: (e) => void workDemoLoad(app, e.target.value) }, h('option', { value: 'bank' }, 'Banco fictício'), h('option', { value: 'manual' }, 'Manual fictício'))), h('span', { className: 'mf-work-badge' }, 'Histórico temporário · somente nesta sessão')), h('div', { role: 'tablist', 'aria-label': 'Áreas da demonstração', className: 'mf-ai-tabbar' }, ...['today', 'chat', 'actions'].map((tab, i) => h('button', { key: tab, id: 'mf-work-tab-' + tab, role: 'tab', type: 'button', 'aria-selected': d.tab === tab, 'aria-controls': 'mf-work-panel', tabIndex: d.tab === tab ? 0 : -1, className: d.tab === tab ? 'active' : '', onClick: () => workDemoUpdate(app, { tab }), onKeyDown: (e) => { const next = intelligenceNextTab(tab, e.key); if (next) {
            e.preventDefault();
            workDemoUpdate(app, { tab: next });
            setTimeout(() => { var _a; return (_a = document.getElementById('mf-work-tab-' + next)) === null || _a === void 0 ? void 0 : _a.focus(); }, 0);
        } } }, ['Hoje', 'Conversar', 'Ações'][i]))), h('div', { id: 'mf-work-panel', role: 'tabpanel', 'aria-labelledby': 'mf-work-tab-' + d.tab }, d.status === 'loading' ? h('p', { role: 'status' }, 'Preparando contexto fictício…') : d.status === 'error' ? h('div', { role: 'alert' }, h('p', {}, d.error), h('button', { type: 'button', className: 'ghost-button', onClick: () => void workDemoLoad(app, d.source) }, 'Tentar novamente')) :
        d.tab === 'chat' ? renderWorkDemoChat(app, d) : d.tab === 'actions' ? h('div', {}, renderWorkDemoProposal(app, d), h('details', {}, h('summary', {}, 'Decisões desta sessão (' + d.audit.length + ')'), ...d.audit.map((a, i) => h('p', { key: i }, a.id + ' · ' + a.decision + ' · ' + a.result + ' · sem gravação')))) :
            r ? h('div', { className: 'mf-work-radar' }, h('div', { className: 'mf-work-primary' }, h('span', { className: 'mf-work-badge' }, 'Alerta · confirmado no exemplo'), h('h3', {}, 'Comece pelos limites que já foram ultrapassados'), ...r.budgets.filter(b => b.spentCents > b.limitCents).map(b => h('div', { key: b.category, className: 'mf-work-budget' }, h('strong', {}, b.category), h('span', {}, workDemoMoney(b.spentCents) + ' / ' + workDemoMoney(b.limitCents)), h('small', {}, b.pct === null ? 'Limite zero · percentual indefinido' : b.pct + '% do limite fictício'), h('progress', { max: 100, value: Math.min(b.pct || 0, 100), 'aria-label': 'Uso fictício de ' + b.category }))), h('button', { type: 'button', className: 'primary-button', disabled: !r.budgets.some(b => b.spentCents > b.limitCents), onClick: () => workDemoPrepare(app) }, 'Preparar ajuste fictício')), h('div', { className: 'mf-work-secondary' }, h('span', { className: 'mf-work-badge' }, 'Confirmado no exemplo'), h('h3', {}, 'Compromissos à frente'), h('strong', { className: 'mf-work-number' }, workDemoMoney(r.future.pendingConfirmedExpensesCents)), h('p', {}, 'Pagamentos futuros confirmados do exemplo. Receitas incertas de ' + workDemoMoney(r.future.futureUncertainIncomeCents) + ' ficam fora do realizado.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => { workDemoUpdate(app, { tab: 'chat' }); workDemoSend(app, 'Quanto tenho comprometido?'); } }, 'Entender os compromissos')), h('aside', { className: 'mf-work-quality' }, h('span', { className: 'mf-work-badge' }, 'Dados insuficientes'), h('h3', {}, 'Quanto posso gastar? Ainda não sabemos.'), h('p', {}, 'Saldo e cobertura histórica não foram verificados. A diferença entre receitas e despesas não é dinheiro livre.'), h('details', {}, h('summary', {}, 'Ver origem e limitações'), h('p', {}, r.engine + ' · ' + r.period.start + ' a ' + r.period.end), h('ul', {}, ...r.warnings.map((w, i) => h('li', { key: i }, w)))))) : null));
}
function workDemoPanelKey(app, e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        app.setState({ intelligencePanelOpen: false });
        return;
    }
    if (e.key !== 'Tab')
        return;
    const controls = Array.from(e.currentTarget.querySelectorAll('button:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first)
        return;
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}
const workDemoPanelRefs = new WeakMap();
function workDemoPanelRef(app) {
    if (!workDemoPanelRefs.has(app)) {
        let origin = null;
        workDemoPanelRefs.set(app, (element) => {
            var _a;
            if (element) {
                origin = document.activeElement;
                (_a = element.querySelector('button')) === null || _a === void 0 ? void 0 : _a.focus();
            }
            else if (origin === null || origin === void 0 ? void 0 : origin.isConnected)
                origin.focus();
        });
    }
    return workDemoPanelRefs.get(app);
}
function renderWorkIntelligencePanel(app) {
    const d = app.state.workIntelligenceDemo, context = intelligenceContextFor(app.state.intelligenceContext).label;
    return h('div', { className: 'mf-ai-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            app.setState({ intelligencePanelOpen: false }); } }, h('aside', { className: 'mf-ai-drawer mf-work-demo mf-work-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Demonstração contextual de ' + context, ref: workDemoPanelRef(app), onKeyDown: (e) => workDemoPanelKey(app, e) }, h('header', { className: 'mf-work-hero' }, h('div', {}, h('span', { className: 'micro-label' }, 'DEMONSTRAÇÃO · CONTEXTO AUTORIZADO'), h('h2', {}, context), h('p', {}, 'Apenas o nome da seção; os números são fictícios.')), h('div', { className: 'mf-work-actions' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => app.setState({ page: 'intelligence', intelligencePanelOpen: false, workIntelligenceDemo: { ...d, tab: 'chat' } }) }, 'Expandir demonstração'), h('button', { type: 'button', className: 'close-button', 'aria-label': 'Fechar demonstração contextual', onClick: () => app.setState({ intelligencePanelOpen: false }) }, '×'))), renderWorkDemoChat(app, d, true)));
}
function localFinancialAPI() { return desktop; }
function localFinancialParse(question, categories = []) {
    const q = intelligenceFoldText(question);
    if (/\b(categorize|altere|ajuste|crie|exclua|apague|registre|planeje)\b/.test(q))
        return null;
    if (/\bcompra|\bcomprar|celular|parcel|disponiv|dados falt/.test(q))
        return { intent: 'purchase' };
    if (/proximo mes|compromet|compromiss/.test(q))
        return { intent: 'commitments' };
    if (/aument|compar|mes anterior/.test(q))
        return { intent: 'compare' };
    if (/revis|conferir/.test(q))
        return { intent: 'review' };
    if (/maiores|mais caras/.test(q))
        return { intent: 'largest' };
    if (/orcament|limites|ultrapass|exced/.test(q))
        return { intent: 'budgets' };
    for (const c of categories)
        if (q.includes(intelligenceFoldText(c.name)))
            return { intent: 'category', category: c.name };
    if (/alimentacao/.test(q))
        return { intent: 'category', category: 'Alimentação' };
    if (/assinatura/.test(q))
        return { intent: 'category', category: 'Assinaturas' };
    return null;
}
async function localFinancialEnable(app) {
    var _a, _b;
    if (app.state.categoryReviewGrant && typeof categoryReviewDisable === 'function')
        categoryReviewDisable(app);
    const api = localFinancialAPI(), s = app.state;
    if (s.localFinancialBusy)
        return;
    if (!(api === null || api === void 0 ? void 0 : api.localFinancialAuthorize)) {
        app.setState({ localFinancialError: 'Consulta local requer a versão desktop desta candidata.' });
        return;
    }
    const source = s.mode === 'demo' ? 'manual' : s.localFinancialSource || 'bank', profile = s.mode === 'demo' ? 'demo' : 'real';
    const scope = { source, profile, planning: profile === 'real' && s.localFinancialPlanning === true, consent: 'LOCAL_FINANCIAL_READ_V1' };
    const generation = (app.__localReadGeneration || 0) + 1;
    app.__localReadGeneration = generation;
    app.setState({ localFinancialBusy: true, localFinancialError: '' });
    try {
        const grant = await api.localFinancialAuthorize(scope);
        if (app.__localReadGeneration !== generation || app.state.mode !== s.mode) {
            void ((_a = api.localFinancialRevoke) === null || _a === void 0 ? void 0 : _a.call(api, grant.token));
            return;
        }
        const backup = ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.backup) || { intelligenceThreads: s.intelligenceThreads, intelligenceMessages: s.intelligenceMessages, intelligenceActiveThreadId: s.intelligenceActiveThreadId, intelligenceHydratedMode: s.intelligenceHydratedMode };
        app.setState({ localFinancialAccess: { ...grant, backup }, localFinancialBusy: false, localFinancialRadar: null, intelligenceThreads: [], intelligenceMessages: [], intelligenceActiveThreadId: null, intelligenceDraft: '', intelligencePreparedQuestion: '', workIntelligenceDemo: s.workIntelligenceDemo ? { ...s.workIntelligenceDemo, enabled: false } : undefined }, () => void localFinancialRadar(app));
    }
    catch {
        app.setState({ localFinancialBusy: false, localFinancialError: 'Não foi possível autorizar a leitura local. Nenhum dado foi consultado por esta solicitação.' });
    }
}
function localFinancialDisable(app) {
    var _a, _b;
    const access = app.state.localFinancialAccess;
    app.__localReadGeneration = (app.__localReadGeneration || 0) + 1;
    app.setState({ ...access === null || access === void 0 ? void 0 : access.backup, localFinancialAccess: null, localFinancialRadar: null, localFinancialBusy: false, localFinancialError: '', intelligenceDraft: '' });
    if (access === null || access === void 0 ? void 0 : access.token)
        void ((_b = (_a = localFinancialAPI()) === null || _a === void 0 ? void 0 : _a.localFinancialRevoke) === null || _b === void 0 ? void 0 : _b.call(_a, access.token).catch(() => app.setState({ localFinancialError: 'A interface encerrou a leitura. A autorização do processo expira em até 15 minutos.' })));
}
async function localFinancialQuery(app, intent) {
    var _a;
    const access = app.state.localFinancialAccess;
    if (!(access === null || access === void 0 ? void 0 : access.token) || access.profile !== (app.state.mode === 'demo' ? 'demo' : 'real'))
        throw Error('Autorize a fonte e o perfil atuais.');
    const month = app.state.localFinancialMonth || app.state.month;
    const response = await localFinancialAPI().localFinancialQuery({ token: access.token, ...intent, month });
    if ((app.state.localFinancialMonth || app.state.month) !== month)
        throw Error('O período mudou durante a consulta. Tente novamente.');
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) !== access.token)
        throw Error('A autorização mudou durante a consulta.');
    if (response.version !== 1 || response.readOnly !== true || response.inferenceCalled !== false || response.changesApplied !== false)
        throw Error('Resposta de leitura inválida.');
    return response;
}
async function localFinancialRadar(app) {
    try {
        const result = await localFinancialQuery(app, { intent: 'radar' });
        app.setState({ localFinancialRadar: result, localFinancialError: '' });
    }
    catch (e) {
        app.setState({ localFinancialError: String(e.message || 'Consulta indisponível.').slice(0, 180) });
    }
}
async function localFinancialSubmit(app, question) {
    var _a;
    if (app.state.localFinancialBusy || !String(question || '').trim())
        return;
    const access = app.state.localFinancialAccess, q = String(question).trim().slice(0, 750), scope = intelligencePageScope(app), messages = [...intelligenceHistoryList(app)];
    const user = { id: 'local-u-' + Date.now(), role: 'user', text: q, status: 'sent', createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: app.state.localFinancialMonth || app.state.month };
    app.setState({ localFinancialBusy: true, intelligenceDraft: '' });
    const parsed = localFinancialParse(q, app.state.categories);
    let reply = null, error = '';
    try {
        if (parsed)
            reply = await localFinancialQuery(app, parsed);
        else
            error = 'Consulta ainda não reconhecida. Pergunte sobre alimentação, assinaturas, maiores despesas, orçamentos, compromissos, comparação ou revisão. Pedidos de alteração não são executados.';
    }
    catch (e) {
        error = String(e.message || 'Consulta local indisponível.').slice(0, 220);
    }
    if (((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) !== (access === null || access === void 0 ? void 0 : access.token))
        return;
    const answer = { id: 'local-a-' + Date.now(), role: 'assistant', text: (reply === null || reply === void 0 ? void 0 : reply.text) || error, status: reply ? 'done' : 'error', createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: user.periodLabel, structuredCard: (reply === null || reply === void 0 ? void 0 : reply.card) || null, details: reply ? JSON.stringify(reply.references) : 'Sem alteração financeira nem envio externo.' };
    intelligenceSyncThreadMessages(app, [...messages, user, answer], scope);
    app.setState({ localFinancialBusy: false });
}
function renderLocalFinancialAccess(app) {
    const s = app.state, access = s.localFinancialAccess, active = (access === null || access === void 0 ? void 0 : access.token) && access.expiresAt > Date.now();
    if (s.categoryReviewGrant)
        return h('section', { className: 'mf-ai-explainer' }, h('div', {}, h('strong', {}, 'Revisão sintética autorizada · conversa temporária'), h('p', {}, 'Mensagens e prévias ficam apenas nesta sessão. Regras e decisões confirmadas são auditadas no SQLite de teste.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => categoryReviewDisable(app) }, 'Encerrar revisão e limpar respostas da sessão')));
    return h('section', { className: 'mf-ai-explainer', 'aria-label': 'Permissão de leitura financeira local' }, h('div', {}, h('strong', {}, active ? 'Leitura local autorizada · sem IA externa' : 'Consultar seus registros locais'), h('p', {}, 'Ao autorizar, movimentos e limites da fonte escolhida serão lidos neste computador. Respostas ficam apenas na memória desta sessão. Consultas usam o mês e a fonte abaixo, sem herdar filtros da tabela.'), !access ? h('div', { className: 'mf-ai-finance-controls' }, h('label', {}, 'Fonte', h('select', { value: s.mode === 'demo' ? 'manual' : s.localFinancialSource || 'bank', disabled: s.mode === 'demo', onChange: (e) => app.setState({ localFinancialSource: e.target.value }) }, h('option', { value: 'bank' }, 'Contas conectadas'), h('option', { value: 'manual' }, 'Lançamentos manuais'))), s.mode !== 'demo' ? h('label', {}, h('input', { type: 'checkbox', checked: s.localFinancialPlanning === true, onChange: (e) => app.setState({ localFinancialPlanning: e.target.checked }) }), 'Permitir também leitura do Planejamento') : null) : h('p', {}, 'Fonte: ' + access.source + ' · perfil ' + access.profile + ' · autorização por até 15 minutos.'), h('label', {}, 'Mês da consulta', h('input', { type: 'month', value: s.localFinancialMonth || s.month, onChange: (e) => app.setState({ localFinancialMonth: e.target.value, localFinancialRadar: null }) })), h('div', { className: 'mf-ai-proposal-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: s.localFinancialBusy, onClick: () => active ? void localFinancialRadar(app) : void localFinancialEnable(app) }, active ? 'Atualizar radar' : 'Autorizar leitura local'), access ? h('button', { type: 'button', className: 'ghost-button', onClick: () => localFinancialDisable(app) }, 'Encerrar leitura e limpar respostas da sessão') : null), s.localFinancialError ? h('p', { role: 'alert' }, s.localFinancialError) : null));
}
function renderLocalFinancialRadar(app) {
    const report = app.state.localFinancialRadar;
    return h('div', { className: 'mf-ai-today' }, h('h2', {}, 'O que seus registros mostram hoje'), report ? renderIntelligenceStructuredCard(report.card) : h('p', { role: 'status' }, 'Atualize o radar para consultar o mês escolhido.'), h('div', { className: 'mf-ai-starter-grid' }, ...['Quanto gastei com alimentação neste mês?', 'Quais foram minhas maiores despesas?', 'Quais categorias ultrapassaram o orçamento?', 'Quanto tenho comprometido para o próximo mês?', 'Quais despesas aumentaram?', 'Que movimentações preciso revisar?', 'Quanto gastei em assinaturas?', 'Quais dados faltam para avaliar uma compra?'].map(q => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: q, onClick: () => { app.setState({ intelligenceTab: 'chat' }); void localFinancialSubmit(app, q); } }, q))));
}
function categoryReviewAPI() { return desktop; }
const categoryReviewKey = (r) => JSON.stringify([r.accountId, r.externalId]);
const categoryReviewConfidence = (v) => ({ high: 'Alta', medium: 'Média', low: 'Baixa', none: 'Sem evidência' }[v] || v);
async function categoryReviewRun(app, fn) {
    if (app.state.categoryReviewBusy)
        return;
    app.setState({ categoryReviewBusy: true, categoryReviewError: '' });
    try {
        await fn();
    }
    catch (e) {
        app.setState({ categoryReviewError: String(e.message || 'Operação indisponível.').slice(0, 240), categoryReviewPreview: null });
    }
    finally {
        app.setState({ categoryReviewBusy: false });
    }
}
async function categoryReviewRefresh(app, after = 0) {
    var _a;
    const grant = app.state.categoryReviewGrant;
    if (!grant)
        return;
    const api = categoryReviewAPI();
    const [report, queue] = await Promise.all([api.categoryReviewList({ token: grant.token }), api.categoryReviewQueue({ token: grant.token, after, limit: 50, filters: app.state.categoryReviewFilters || {} })]);
    if (((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) !== grant.token)
        return;
    app.setState({ categoryReviewReport: report, categoryReviewQueue: queue, categoryReviewCursor: after });
}
async function categoryReviewOpen(app) {
    app.setState({ page: 'intelligence', intelligencePanelOpen: false, intelligenceTab: 'actions', categoryReviewOpen: true }, () => { var _a; return (_a = document.querySelector('.main-area')) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, behavior: 'instant' }); });
    await categoryReviewRun(app, async () => {
        var _a, _b;
        const status = await ((_b = (_a = categoryReviewAPI()) === null || _a === void 0 ? void 0 : _a.categoryReviewStatus) === null || _b === void 0 ? void 0 : _b.call(_a));
        app.setState({ categoryReviewAvailable: (status === null || status === void 0 ? void 0 : status.available) === true });
        if (app.state.categoryReviewGrant)
            await categoryReviewRefresh(app);
    });
}
async function categoryReviewEnable(app) {
    await categoryReviewRun(app, async () => {
        var _a;
        if ((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token)
            localFinancialDisable(app);
        const mode = app.state.mode, grant = await categoryReviewAPI().categoryReviewAuthorize({ consent: 'SYNTHETIC_CATEGORY_REVIEW_V1' });
        if (app.state.mode !== mode) {
            await categoryReviewAPI().categoryReviewRevoke({ token: grant.token });
            return;
        }
        const backup = { intelligenceThreads: app.state.intelligenceThreads, intelligenceMessages: app.state.intelligenceMessages, intelligenceActiveThreadId: app.state.intelligenceActiveThreadId, intelligenceHydratedMode: app.state.intelligenceHydratedMode };
        app.setState({ categoryReviewGrant: grant, categoryReviewBackup: backup, intelligenceThreads: [], intelligenceMessages: [], intelligenceActiveThreadId: null });
        await categoryReviewRefresh(app);
    });
}
function categoryReviewDisable(app) {
    var _a;
    const grant = app.state.categoryReviewGrant;
    app.setState({ ...app.state.categoryReviewBackup, categoryReviewGrant: null, categoryReviewBackup: null, categoryReviewReport: null, categoryReviewQueue: null, categoryReviewPreview: null, categoryReviewSelected: [], categoryReviewReceipt: null, categoryReviewOpen: false, categoryReviewError: '', categoryReviewBusy: false });
    if (grant)
        void ((_a = categoryReviewAPI()) === null || _a === void 0 ? void 0 : _a.categoryReviewRevoke({ token: grant.token }).catch(() => { }));
}
async function categoryReviewPrepare(app, action, payload) {
    await categoryReviewRun(app, async () => {
        var _a;
        const grant = app.state.categoryReviewGrant;
        const preview = await categoryReviewAPI().categoryReviewPrepare({ token: grant.token, action, payload });
        if (((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) === grant.token)
            app.setState({ categoryReviewPreview: preview, categoryReviewConfirmed: false, categoryReviewReceipt: null }, () => { var _a; return (_a = document.querySelector('.mf-review-preview')) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ block: 'start' }); });
    });
}
async function categoryReviewConfirm(app) {
    const p = app.state.categoryReviewPreview, g = app.state.categoryReviewGrant;
    if (!p || !g || !app.state.categoryReviewConfirmed)
        return;
    await categoryReviewRun(app, async () => {
        var _a;
        const receipt = await categoryReviewAPI().categoryReviewConfirm({ token: g.token, id: p.id, digest: p.digest, consent: 'CONFIRM_CATEGORY_PREVIEW_V1' });
        if (((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) !== g.token)
            return;
        app.setState({ categoryReviewPreview: null, categoryReviewConfirmed: false, categoryReviewReceipt: { ...receipt, rule: p.rule }, categoryReviewSelected: [] });
        await categoryReviewRefresh(app);
        if (typeof app.refreshBank === 'function')
            await app.refreshBank();
    });
}
function categoryReviewHandleQuestion(app, raw) {
    var _a, _b;
    const q = intelligenceFoldText(raw);
    if (!app.state.categoryReviewGrant || !(/revis.*(pend|tudo|moviment)|sug.*regr|regr.*recom|desfac/.test(q)))
        return false;
    if (/desfac/.test(q)) {
        const last = (_b = (_a = app.state.categoryReviewReport) === null || _a === void 0 ? void 0 : _a.audit) === null || _b === void 0 ? void 0 : _b.find((a) => a.undoState === 'available');
        if (last)
            void categoryReviewPrepare(app, 'undo', { commandId: last.id });
    }
    const scope = intelligencePageScope(app), messages = intelligenceHistoryList(app);
    intelligenceSyncThreadMessages(app, [...messages, { id: 'review-user-' + Date.now(), role: 'user', text: raw, status: 'sent', createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: scope.period },
        { id: 'review-answer-' + Date.now(), role: 'assistant', text: 'A Central de Revisão usa o histórico local, com regras sugeridas, registros paginados e confirmação específica de cada ação. Abra a seleção para revisar. Nenhuma mudança foi executada por esta mensagem.', status: 'done', createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: scope.period }], scope);
    app.setState({ intelligenceDraft: '' });
    return true;
}
function renderCategoryReviewPreview(app) {
    var _a;
    const p = app.state.categoryReviewPreview;
    if (!p)
        return null;
    return h('section', { className: 'mf-review-preview', 'aria-label': 'Prévia da ação supervisionada' }, h('span', { className: 'micro-label' }, 'PRÉVIA · NENHUMA ALTERAÇÃO EXECUTADA'), h('h3', {}, p.title), h('p', {}, p.summary), p.rule ? h('dl', { className: 'mf-review-rule-details' }, ...Object.entries({ Padrão: p.rule.pattern, Correspondência: 'Descrição exata', Categoria: p.rule.category, Conta: p.rule.accountName, Natureza: p.rule.nature === 'expense' ? 'Saída' : 'Entrada', Prioridade: p.rule.priority }).map(([k, v]) => h('div', { key: k }, h('dt', {}, k), h('dd', {}, String(v))))) : null, p.historicalEligible != null ? h('p', {}, p.historicalEligible + (p.historicalPartial ? '+' : '') + ' registro(s) anteriores elegíveis. Aplicar ao histórico exige outra seleção e outra confirmação.') : null, ((_a = p.affected) === null || _a === void 0 ? void 0 : _a.length) ? h('div', { className: 'mf-review-table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Movimentação', 'Valor', 'Antes', 'Depois'].map(t => h('th', { key: t }, t)))), h('tbody', {}, ...p.affected.map((r) => h('tr', { key: categoryReviewKey(r) }, h('td', {}, r.description || r.externalId, h('small', {}, r.accountName || r.accountId)), h('td', {}, r.amount != null ? fmt(Math.abs(r.amount)) : '—'), h('td', {}, r.category || '—'), h('td', {}, r.newCategory || '—')))))) : null, p.totalCents != null ? h('p', {}, 'Total absoluto da seleção: ' + fmt(p.totalCents)) : null, p.partial ? h('p', {}, 'Prévia limitada aos primeiros 100 registros de ' + p.affectedTotal + '.') : null, h('label', { className: 'mf-review-confirm' }, h('input', { type: 'checkbox', checked: !!app.state.categoryReviewConfirmed, disabled: app.state.categoryReviewBusy, onChange: (e) => app.setState({ categoryReviewConfirmed: e.target.checked }) }), 'Conferi esta prévia e autorizo somente esta ação nos dados sintéticos.'), h('div', { className: 'mf-review-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: !app.state.categoryReviewConfirmed || app.state.categoryReviewBusy || p.expiresAt <= Date.now(), onClick: () => void categoryReviewConfirm(app) }, 'Confirmar esta ação'), h('button', { type: 'button', className: 'ghost-button', disabled: app.state.categoryReviewBusy, onClick: () => app.setState({ categoryReviewPreview: null, categoryReviewConfirmed: false }) }, 'Cancelar sem aplicar')));
}
function renderCategoryReviewRow(app, r, selected, button) {
    const reasons = { generic_category: 'Categoria genérica', not_reviewed: 'Ainda não revisada', inconsistent_pattern: 'Classificações divergentes', split_individual_review: 'Possui divisão', outdated_classification: 'Classificação desatualizada após importação' };
    return h('tr', { key: categoryReviewKey(r) }, h('td', {}, h('input', { type: 'checkbox', 'aria-label': 'Selecionar ' + r.description + ' ' + r.externalId,
        disabled: app.state.categoryReviewBusy || !r.batchEligible, checked: selected.some(x => categoryReviewKey(x) === categoryReviewKey(r)),
        onChange: (e) => app.setState({ categoryReviewSelected: e.target.checked ? [...selected, r].slice(0, 100) : selected.filter(x => categoryReviewKey(x) !== categoryReviewKey(r)) }) })), h('td', {}, r.description, h('small', {}, r.date + ' · ' + r.accountName + ' · ' + r.status)), h('td', {}, r.category, h('small', {}, r.reasons.map(v => reasons[v]).join(' · '))), h('td', {}, fmt(Math.abs(r.amount))), h('td', {}, button('Revisar individualmente', () => void categoryReviewPrepare(app, 'classify', { items: [r], category: app.state.categoryReviewCategory || r.suggestedCategory || 'Alimentação' }), r.manual || r.hasSplits || r.status !== 'POSTED'), button('Marcar como revisada', () => void categoryReviewPrepare(app, 'reviewed', { items: [r] }))));
}
function renderCategoryReview(app) {
    var _a;
    const s = app.state, g = s.categoryReviewGrant, report = s.categoryReviewReport, queue = s.categoryReviewQueue, busy = !!s.categoryReviewBusy, selected = s.categoryReviewSelected || [], filters = s.categoryReviewFilters || {};
    const button = (label, action, disabled = false) => h('button', { type: 'button', className: 'ghost-button', disabled: busy || disabled, onClick: action }, label);
    const categorySelect = (value, onChange, label = 'Categoria') => h('select', { 'aria-label': label, value, disabled: busy, onChange: (e) => onChange(e.target.value) }, ...((report === null || report === void 0 ? void 0 : report.categories) || []).map((c) => h('option', { key: c.name, value: c.name }, c.name)));
    const setFilter = (name, value) => app.setState({ categoryReviewFilters: { ...filters, [name]: value }, categoryReviewSelected: [], categoryReviewPreview: null });
    return h('section', { className: 'mf-review', 'aria-label': 'Central de revisão inteligente' }, h('header', { className: 'mf-review-header' }, h('div', {}, h('span', { className: 'micro-label' }, 'INTELIGÊNCIA · DECISÕES LOCAIS'), h('h2', {}, 'Central de revisão'), h('p', {}, 'Entenda o padrão. Confira a seleção. Decida o que pode mudar.')), g ? h('div', { className: 'mf-review-actions' }, button('Conversar', () => app.setState({ categoryReviewOpen: false, intelligenceTab: 'chat' })), button('Encerrar revisão', () => categoryReviewDisable(app))) : button('Voltar', () => app.setState({ categoryReviewOpen: false }))), h('p', { className: 'mf-review-safety' }, 'Homologação com dados sintéticos. Escrita da Inteligência permanece desativada no perfil pessoal.'), !g ? h('div', { className: 'mf-review-empty' }, h('h3', {}, s.categoryReviewAvailable === false ? 'Aguardando homologação' : 'Começar uma revisão supervisionada'), h('p', {}, s.categoryReviewAvailable === false ? 'Este perfil não permite escrita pela Inteligência. O fluxo pode ser testado na candidata Electron com perfil sintético validado.' : 'Autorize a leitura do perfil de teste para encontrar padrões e preparar ações. Cada gravação terá uma prévia e confirmação separadas.'), s.categoryReviewAvailable ? h('button', { type: 'button', className: 'primary-button', disabled: busy, onClick: () => void categoryReviewEnable(app) }, 'Autorizar revisão dos dados sintéticos') : null) : null, s.categoryReviewError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.categoryReviewError) : null, busy ? h('p', { role: 'status' }, 'Conferindo os registros e as permissões…') : null, g && report ? h('div', { className: 'mf-review-content' }, h('div', { className: 'mf-review-summary' }, h('div', {}, h('strong', {}, String(report.suggestionsTotal)), h('span', {}, 'regras sugeridas')), h('div', {}, h('strong', {}, String(report.scanned)), h('span', {}, 'registros locais analisados')), h('div', {}, h('strong', {}, String(report.rules.filter((r) => r.enabled).length)), h('span', {}, 'regras ativas')), button('Atualizar análise', () => void categoryReviewRun(app, () => categoryReviewRefresh(app)))), report.suggestionsPartial ? h('p', {}, 'Exibindo 100 de ' + report.suggestionsTotal + ' sugestões.') : null, renderCategoryReviewPreview(app), s.categoryReviewReceipt ? h('div', { className: 'mf-review-receipt', role: 'status' }, h('strong', {}, 'Ação persistida e auditada.'), h('p', {}, 'Comprovante: ' + s.categoryReviewReceipt.id), s.categoryReviewReceipt.action === 'rule' ? h('div', {}, h('p', {}, 'Regra criada para as próximas importações. Deseja aplicar também aos lançamentos anteriores compatíveis?'), button('Revisar histórico compatível', () => app.setState({ categoryReviewFilters: { accountId: s.categoryReviewReceipt.rule.accountId, pattern: s.categoryReviewReceipt.rule.pattern }, categoryReviewSelected: [] }, () => void categoryReviewRun(app, () => categoryReviewRefresh(app)))), button('Agora não', () => app.setState({ categoryReviewReceipt: null }))) : null) : null, h('section', { 'aria-label': 'Sugestões de regras' }, h('h3', {}, 'Padrões que podem reduzir seu trabalho'), !report.suggestions.length ? h('p', { className: 'mf-review-empty' }, 'Nenhum padrão novo com evidência manual nesta análise.') : null, ...report.suggestions.map((r) => {
        var _a;
        return h('article', { key: r.id, className: 'mf-review-suggestion' }, h('div', { className: 'mf-review-suggestion-head' }, h('h4', {}, r.name), h('span', { className: 'mf-review-confidence is-' + r.confidence }, 'Confiança ' + categoryReviewConfidence(r.confidence) + (r.state === 'deferred' ? ' · adiada' : ''))), h('p', {}, r.reason), h('p', {}, r.accountName + ' · ' + (r.nature === 'expense' ? 'Saídas' : 'Entradas') + ' · descrição exata · ' + r.compatible + ' compatíveis'), r.conflicts.length ? h('p', { className: 'mf-ai-error' }, 'Divergências: ' + r.conflicts.join(' · ')) : null, h('ul', {}, ...r.examples.map((e) => h('li', { key: categoryReviewKey(e) }, e.date + ' · ' + e.description + ' · ' + fmt(Math.abs(e.amount)) + ' · ' + e.category))), h('div', { className: 'mf-review-actions' }, categorySelect(((_a = s.categoryReviewEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category, v => app.setState({ categoryReviewEdits: { ...s.categoryReviewEdits, [r.id]: v } }), 'Editar categoria da sugestão ' + r.pattern), button('Aceitar / simular regra', () => { var _a; return void categoryReviewPrepare(app, 'rule', { suggestionId: r.id, category: ((_a = s.categoryReviewEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category }); }), button('Negar', () => void categoryReviewPrepare(app, 'decision', { suggestionId: r.id, state: 'denied' })), button('Adiar', () => void categoryReviewPrepare(app, 'decision', { suggestionId: r.id, state: 'deferred' }))));
    })), h('section', { 'aria-label': 'Movimentações para revisar' }, h('h3', {}, 'Revise os registros que precisam de atenção'), h('p', {}, 'PENDING indica confirmação bancária; não é, por si só, uma pendência de categoria. Baixa confiança exige revisão individual.'), h('div', { className: 'mf-review-filters' }, h('label', {}, 'Conta', h('select', { value: filters.accountId || '', onChange: (e) => setFilter('accountId', e.target.value) }, h('option', { value: '' }, 'Todas as contas'), ...report.accounts.map((a) => h('option', { key: a.id, value: a.id }, a.name)))), h('label', {}, 'De', h('input', { type: 'date', value: filters.start || '', onChange: (e) => setFilter('start', e.target.value) })), h('label', {}, 'Até', h('input', { type: 'date', value: filters.end || '', onChange: (e) => setFilter('end', e.target.value) })), h('label', {}, 'Confiança', h('select', { value: filters.confidence || '', onChange: (e) => setFilter('confidence', e.target.value) }, ...['', 'high', 'medium', 'low', 'none'].map(v => h('option', { key: v, value: v }, v ? categoryReviewConfidence(v) : 'Todas')))), button('Aplicar filtros', () => void categoryReviewRun(app, () => categoryReviewRefresh(app))), filters.pattern ? button('Limpar padrão', () => app.setState({ categoryReviewFilters: { ...filters, pattern: '' } }, () => void categoryReviewRun(app, () => categoryReviewRefresh(app)))) : null), h('div', { className: 'mf-review-actions' }, h('span', {}, selected.length + ' selecionado(s)'), categorySelect(s.categoryReviewCategory || 'Alimentação', v => app.setState({ categoryReviewCategory: v }), 'Categoria da seleção'), button('Preparar classificação da seleção', () => void categoryReviewPrepare(app, 'classify', { items: selected, category: s.categoryReviewCategory || 'Alimentação' }), !selected.length), button('Limpar seleção', () => app.setState({ categoryReviewSelected: [] }))), queue ? h('div', { className: 'mf-review-table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Selecionar', 'Movimentação', 'Categoria / motivo', 'Valor', 'Revisão'].map(t => h('th', { key: t }, t)))), h('tbody', {}, ...queue.rows.map((r) => renderCategoryReviewRow(app, r, selected, button))))) : null, !((_a = queue === null || queue === void 0 ? void 0 : queue.rows) === null || _a === void 0 ? void 0 : _a.length) ? h('p', { className: 'mf-review-empty' }, 'Nenhum registro para estes filtros.') : null, h('div', { className: 'mf-review-actions' }, button('Primeira página', () => void categoryReviewRun(app, () => categoryReviewRefresh(app)), !s.categoryReviewCursor), button('Próxima página', () => void categoryReviewRun(app, () => categoryReviewRefresh(app, queue.nextCursor)), (queue === null || queue === void 0 ? void 0 : queue.nextCursor) == null), h('small', {}, (queue === null || queue === void 0 ? void 0 : queue.coverage) || 'Registros paginados; até 50 por página.'))), h('section', { 'aria-label': 'Gestão de regras' }, h('h3', {}, 'Regras ativas e pausadas'), ...report.rules.map((r) => { var _a; return h('div', { className: 'mf-review-managed', key: r.id }, h('strong', {}, r.pattern + ' → ' + r.category), h('small', {}, (r.enabled ? 'Ativa' : 'Pausada') + ' · prioridade ' + r.priority + (r.constraint ? ' · conta específica · importações futuras' : ' · regra existente')), r.constraint ? h('div', { className: 'mf-review-actions' }, categorySelect(((_a = s.categoryReviewRuleEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category, v => app.setState({ categoryReviewRuleEdits: { ...s.categoryReviewRuleEdits, [r.id]: v } }), 'Categoria da regra ' + r.id), button('Simular edição', () => { var _a; return void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: 'edit', category: ((_a = s.categoryReviewRuleEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category }); }), button(r.enabled ? 'Pausar' : 'Reativar', () => void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: r.enabled ? 'pause' : 'resume' })), button('Excluir com prévia', () => void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: 'delete' }))) : h('small', {}, 'Editar em Configurações de categorias.')); })), h('details', {}, h('summary', {}, 'Decisões e auditoria local'), ...report.audit.map((a) => h('div', { className: 'mf-review-audit', key: a.id }, h('span', {}, ({ rule: 'Regra criada', classify: 'Classificação', reviewed: 'Revisão', decision: 'Decisão', undo: 'Reversão', forget: 'Preferências apagadas', 'manage-rule': 'Regra atualizada' }[a.action] || 'Ação') + ' · ' + new Date(a.appliedAt).toLocaleString('pt-BR') + ' · ' + ({ available: 'Pode desfazer', undone: 'Desfeita', not_applicable: 'Registrada' }[a.undoState] || 'Registrada')), a.undoState === 'available' ? button('Preparar desfazer', () => void categoryReviewPrepare(app, 'undo', { commandId: a.id })) : null)), h('p', {}, report.decisions.length + ' decisão(ões) recente(s): ' + report.decisions.map((d) => ({ denied: 'negada', deferred: 'adiada', accepted: 'aceita', edited: 'editada' }[d.state])).join(', ')), button('Apagar preferências de sugestões', () => void categoryReviewPrepare(app, 'forget', {})))) : null);
}
