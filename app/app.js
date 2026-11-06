const h = React.createElement;
const EMPTY_BANK = { config: { configured: false, clientId: '', itemIds: [], secure: false }, data: { accounts: [], transactions: [], items: [], last: null } };
const desktop = window.financeDesktop || null;
const CATS = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Compras', 'Contas', 'Outros'];
const COLORS = ['#884bff', '#bc80ff', '#db6ff5', '#7549d8', '#a58cf4', '#5b4da5', '#4a386f', '#7555bd', '#c090e5', '#3f375a'];
const DEFAULT_CATEGORY_INFOS = [...CATS, 'Salário'].map((name, i) => ({ name, color: COLORS[i % COLORS.length], builtIn: 1 }));
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
function bankSnapshot(bank, month) {
    const transactions = (bank.data.transactions || []).filter(t => t.status === 'POSTED' && t.date.slice(0, 7) === month);
    const income = transactions.filter(t => t.amount > 0).reduce((v, t) => v + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((v, t) => v - t.amount, 0);
    const totals = new Map();
    transactions.filter(t => t.amount < 0).forEach(t => totals.set(t.category, (totals.get(t.category) || 0) - t.amount));
    const balance = (bank.data.accounts || []).reduce((v, a) => v + (a.balance || 0), 0);
    return { income, expense, net: income - expense, balance, categories: [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
}
const fmt = (n) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyString = (n) => (n / 100).toFixed(2).replace('.', ',');
function parseMoney(v) { let s = String(v || '').trim().replace(/R\$|\s/g, ''); if (!s)
    return 0; if (s.includes(','))
    s = s.replace(/\./g, '').replace(',', '.');
else if ((s.match(/\./g) || []).length > 1)
    s = s.replace(/\./g, ''); const x = Number(s); return Number.isFinite(x) ? Math.round(x * 100) : NaN; }
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
    const totals = new Map();
    for (const t of ts)
        if (t.kind === 'expense')
            totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
    return { income, expense, net: income - expense, balance: d.settings.opening + sum(d.transactions, 'income') - sum(d.transactions, 'expense'), categories: [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
}
function bankSnapshotBetween(bank, start, end) {
    const ts = bank.data.transactions.filter(t => t.status === 'POSTED' && t.date >= start && t.date <= end);
    const income = ts.filter(t => t.amount > 0).reduce((v, t) => v + t.amount, 0), expense = ts.filter(t => t.amount < 0).reduce((v, t) => v - t.amount, 0);
    const totals = new Map();
    for (const t of ts)
        if (t.amount < 0)
            totals.set(t.category, (totals.get(t.category) || 0) - t.amount);
    return { income, expense, net: income - expense, balance: bank.data.accounts.reduce((v, a) => v + (a.balance || 0), 0), categories: [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
}
function flowSegments(start, end, get) {
    const length = Math.max(1, daysInSpan(start, end)), count = Math.min(7, length);
    return Array.from({ length: count }, (_, i) => {
        const a = advanceDate(start, Math.floor(i * length / count));
        const b = advanceDate(start, Math.floor((i + 1) * length / count) - 1);
        const totals = get(a, b);
        return { month: a, label: b.slice(8, 10) + '/' + b.slice(5, 7), income: totals.income, expense: totals.expense };
    });
}
function starter() { return { version: 3, transactions: [], budgets: Object.fromEntries(CATS.map(c => [c, 0])), settings: { opening: 0, income: 0, fixed: 0, existing: 0, reserve: 0 } }; }
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
    return { version: 3, transactions: t, budgets: { Moradia: 120000, Alimentação: 100000, Transporte: 35000, Saúde: 20000, Lazer: 38000, Educação: 30000, Assinaturas: 20000, Compras: 60000, Contas: 40000, Outros: 20000 }, settings: { opening: 145000, income: 520000, fixed: 220000, existing: 35000, reserve: 100000 } };
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
        let b = Number(raw);
        if (c.length <= 50)
            d.budgets[c] = Number.isSafeInteger(b) && b >= 0 ? b : 0;
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
function snapshot(d, month) { const ts = d.transactions.filter(t => t.date.slice(0, 7) === month); const income = sum(ts, 'income'), expense = sum(ts, 'expense'); const bal = d.settings.opening + sum(d.transactions, 'income') - sum(d.transactions, 'expense'); const names = [...new Set([...CATS, ...Object.keys(d.budgets), ...ts.map(t => t.category)])]; const categories = names.map(cat => ({ name: cat, total: sum(ts.filter(t => t.category === cat), 'expense') })).filter(x => x.total > 0).sort((a, b) => b.total - a.total); return { income, expense, balance: bal, net: income - expense, categories }; }
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
    const paths = { home: 'M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z', wallet: 'M3 7h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h15v3H3m11 7h8', trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6', down: 'M3 7l6 6 4-4 8 8 M15 17h6v-6', calendar: 'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18', refresh: 'M21 4v6h-6 M3 20v-6h6 M5 10a8 8 0 0 1 14-4l2 4 M3 14l2 4a8 8 0 0 0 14-4', layers: 'M12 3 2 9l10 6 10-6-10-6z M2 13l10 6 10-6', cart: 'M3 4h2l3 12h11l3-9H6 M9 21h1 M18 21h1', pie: 'M12 2v10h10 M12 2a10 10 0 1 0 10 10', settings: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.2 2.2 M16.2 16.2l2.2 2.2 M18.4 5.6l-2.2 2.2 M7.8 16.2l-2.2 2.2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', plus: 'M12 5v14 M5 12h14', search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M17 17l5 5', check: 'M4 12l5 5L20 6', shield: 'M12 2l9 4v6c0 6-4.2 9.2-9 11-4.8-1.8-9-5-9-11V6z M8 12l3 3 5-6', chart: 'M4 20V12 M10 20V4 M16 20v-8 M22 20V8', download: 'M12 3v13 M7 11l5 5 5-5 M3 18v3h18v-3', upload: 'M12 21V8 M7 13l5-5 5 5 M3 5V3h18v2', trash: 'M4 6h16 M9 6V3h6v3 M7 8l1 13h8l1-13', arrow: 'M5 12h14 M13 6l6 6-6 6', alert: 'M12 3 2 21h20L12 3z M12 10v4 M12 18v0', edit: 'M3 21l5-.8L21 7 17 3 4 16z', filter: 'M3 4h18l-7 8v7l-4 2v-9z', clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2', spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z', bank: 'M2 10l10-7 10 7z M4 11v9 M10 11v9 M16 11v9 M22 21H2' };
    return h('svg', { width: p.size || 19, height: p.size || 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, h('path', { d: paths[p.name] || paths.chart }));
}
function Logo() { return h('span', { className: 'logo-glyph' }, h('span', { className: 'bar b1' }), h('span', { className: 'bar b2' }), h('span', { className: 'bar b3' })); }
function Card(p) { return h('div', { className: 'card ' + (p.className || '') }, p.children); }
function Stat(p) { return h('div', { className: 'stat ' + (p.featured ? 'stat-featured' : '') }, h('div', { className: 'stat-head' }, h('span', { className: 'stat-icon ' + (p.color || '') }, h(Icon, { name: p.icon })), h('span', { className: 'stat-label' }, p.label)), h('div', { className: 'stat-value' }, fmt(p.amount)), h('div', { className: 'stat-foot' }, p.hint)); }
function prettyMonth(ym) { const [year, month] = ym.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
function monthShort(ym) { return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); }
function Chart(p) {
    const vals = p.data;
    const max = Math.max(1, ...vals.flatMap(x => [x.income, x.expense])) * 1.14;
    const W = 580, H = 200, l = 30, r = 12, t = 16, b = 30;
    const xx = (i) => l + i * (W - l - r) / Math.max(1, vals.length - 1);
    const yy = (v) => t + (H - b - t) * (1 - v / max);
    const getPath = (k) => vals.map((x, i) => (i ? 'L' : 'M') + xx(i).toFixed(1) + ',' + yy(x[k]).toFixed(1)).join(' ');
    const getArea = (k) => getPath(k) + ` L${xx(vals.length - 1)},${H - b} L${xx(0)},${H - b} Z`;
    return h('svg', { className: 'chart-svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-label': 'Evolução mensal de receitas e despesas' }, h('defs', {}, h('linearGradient', { id: 'incFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: '#8349ff', stopOpacity: '.28' }), h('stop', { offset: '100%', stopColor: '#8349ff', stopOpacity: '0' })), h('linearGradient', { id: 'expFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: '#dc70ee', stopOpacity: '.2' }), h('stop', { offset: '100%', stopColor: '#dc70ee', stopOpacity: '0' }))), [0, .25, .5, .75, 1].map((a, i) => h('g', { key: 'g' + i }, h('line', { x1: l, y1: yy(max * a), x2: W - r, y2: yy(max * a), stroke: '#2c2c3c', strokeWidth: 1 }), h('text', { x: 0, y: yy(max * a) + 4, fill: '#76758d', fontSize: 11 }, (max * a / 100000).toFixed(0) + 'k'))), h('path', { d: getArea('income'), fill: 'url(#incFill)' }), h('path', { d: getArea('expense'), fill: 'url(#expFill)' }), h('path', { d: getPath('income'), fill: 'none', stroke: '#864aff', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }), h('path', { d: getPath('expense'), fill: 'none', stroke: '#d968ef', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }), vals.map((x, i) => h('g', { key: x.month }, h('text', { x: xx(i), y: H - 9, fill: '#9492ad', fontSize: 13, textAnchor: 'middle' }, (x.label || monthShort(x.month))), h('circle', { cx: xx(i), cy: yy(x.income), r: 3, fill: '#a778ff' }))));
}
function Donut(p) {
    const vals = p.items;
    const total = vals.reduce((a, x) => a + x.total, 0);
    let deg = 0;
    const colorOf = (name) => { var _a; return ((_a = p.colors) === null || _a === void 0 ? void 0 : _a[name]) || COLORS[Math.max(0, CATS.indexOf(name)) % COLORS.length]; };
    const seg = vals.map((x, i) => { const start = deg; deg += x.total / Math.max(total, 1) * 360; return `${colorOf(x.name)} ${start}deg ${deg}deg`; });
    return h('div', { className: 'donut-wrap' }, h('div', { className: 'donut', style: { background: total ? `conic-gradient(${seg.join(',')})` : 'conic-gradient(#2c2938 0 360deg)' } }, h('div', { className: 'donut-inner' }, h('b', {}, fmt(total)), h('small', {}, 'em despesas'))), h('div', { className: 'donut-legend' }, (total ? vals.slice(0, 5) : CATS.slice(0, 5).map(name => ({ name, total: 0 }))).map((v, i) => h('div', { className: 'legend-row', key: v.name }, h('span', { className: 'legend-text' }, h('i', { style: { background: colorOf(v.name) } }), v.name), h('strong', {}, total ? Math.round(v.total * 100 / total) + '%' : '0%')))));
}
class StyledSelect extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.menu = null;
        this.close = () => { if (this.state.open)
            this.setState({ open: false }); };
        this.onScroll = (e) => { var _a; if (!((_a = this.menu) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
            this.close(); };
        this.onOutside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.menu) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.open = () => { if (this.props.disabled)
            return; const idx = (this.props.options || []).findIndex((x) => x.value === this.props.value); this.setState({ open: !this.state.open, focusIndex: Math.max(0, idx), placement: this.geometry() }); };
        this.pick = (v) => { var _a; this.setState({ open: false }); this.props.onChange(v); (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.focus(); };
        this.onKey = (e) => {
            var _a;
            const options = this.props.options || [];
            if (!options.length)
                return;
            if (e.key === 'Escape') {
                this.close();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const dir = e.key === 'ArrowDown' ? 1 : -1;
                this.setState((s) => ({ open: true, placement: this.geometry(), focusIndex: s.open ? (s.focusIndex + dir + options.length) % options.length : Math.max(0, options.findIndex((x) => x.value === this.props.value)) }));
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (this.state.open)
                    this.pick(((_a = options[this.state.focusIndex]) === null || _a === void 0 ? void 0 : _a.value) || options[0].value);
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
        return h('div', { className: 'mf-select-wrap ' + (this.props.wrapperClass || '') }, h('button', { type: 'button', ref: (e) => this.trigger = e, disabled: this.props.disabled, role: 'combobox', 'aria-expanded': this.state.open, 'aria-haspopup': 'listbox', 'aria-label': this.props.ariaLabel || 'Selecionar opção', className: 'mf-select-trigger ' + (this.props.className || ''), onClick: this.open, onKeyDown: this.onKey }, h('span', {}, (current === null || current === void 0 ? void 0 : current.label) || this.props.value || 'Selecione'), h('span', { className: 'mf-caret', 'aria-hidden': 'true' }, '⌄')), this.state.open ? ReactDOM.createPortal(h('div', { ref: (e) => this.menu = e, className: 'mf-select-popover', role: 'listbox', style: { position: 'fixed', left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight } }, options.map((item, i) => h('button', { key: item.value, type: 'button', role: 'option', 'aria-selected': item.value === this.props.value, className: 'mf-option ' + (item.value === this.props.value ? 'is-selected ' : '') + (i === this.state.focusIndex ? 'is-focused' : ''), onMouseEnter: () => this.setState({ focusIndex: i }), onClick: () => this.pick(item.value) }, h('span', {}, item.label), item.value === this.props.value ? h('b', {}, '✓') : null))), document.body) : null);
    }
}
class SingleDatePicker extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.panel = null;
        this.close = () => this.setState({ open: false });
        this.onScroll = (e) => { var _a; if (!((_a = this.panel) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
            this.close(); };
        this.outside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.panel) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.toggle = () => { var _a; const r = (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!r)
            return; const width = 326, left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12)); this.setState({ open: !this.state.open, view: (this.props.value || iso(new Date())).slice(0, 7), left, top: r.bottom + 310 > window.innerHeight ? Math.max(10, r.top - 313) : r.bottom + 6 }); };
        this.state = { open: false, view: (props.value || iso(new Date())).slice(0, 7), left: 0, top: 0 };
    }
    componentDidMount() { document.addEventListener('pointerdown', this.outside, true); window.addEventListener('resize', this.close); window.addEventListener('scroll', this.onScroll, true); }
    componentWillUnmount() { document.removeEventListener('pointerdown', this.outside, true); window.removeEventListener('resize', this.close); window.removeEventListener('scroll', this.onScroll, true); }
    render() {
        var _a;
        const ym = this.state.view, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), offset = (first.getDay() + 6) % 7, count = new Date(y, m, 0).getDate();
        return h('div', { className: 'mf-single-date' }, h('button', { ref: (e) => this.trigger = e, type: 'button', className: 'mf-date-trigger', onClick: this.toggle, 'aria-haspopup': 'dialog', 'aria-expanded': this.state.open }, h(Icon, { name: 'calendar', size: 16 }), ((_a = this.props.value) === null || _a === void 0 ? void 0 : _a.split('-').reverse().join('/')) || 'Selecionar data', h('span', { className: 'mf-caret' }, '⌄')), this.state.open ? ReactDOM.createPortal(h('div', { ref: (e) => this.panel = e, className: 'mf-single-calendar', role: 'dialog', 'aria-label': 'Selecionar data', style: { position: 'fixed', left: this.state.left, top: this.state.top } }, h('div', { className: 'mf-calendar-nav' }, h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, -1) }) }, '‹'), h('strong', {}, prettyMonth(ym)), h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, 1) }) }, '›')), h('div', { className: 'mf-calendar-grid' }, ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, i) => h('span', { key: 'h' + i, className: 'mf-weekday' }, label)), Array.from({ length: offset }, (_, i) => h('span', { key: 'e' + i })), Array.from({ length: count }, (_, i) => { const day = ym + '-' + String(i + 1).padStart(2, '0'); return h('button', { key: day, type: 'button', 'aria-label': day, 'aria-pressed': this.props.value === day, className: 'mf-day ' + (this.props.value === day ? 'selected' : ''), onClick: () => { this.props.onChange(day); this.close(); } }, i + 1); })), h('button', { type: 'button', className: 'mf-today-link', onClick: () => { this.props.onChange(iso(new Date())); this.close(); } }, 'Hoje')), document.body) : null);
    }
}
class PeriodPicker extends React.Component {
    constructor(props) {
        super(props);
        this.trigger = null;
        this.panel = null;
        this.close = () => { if (this.state.open)
            this.setState({ open: false }); };
        this.onScroll = (e) => { var _a; if (!((_a = this.panel) === null || _a === void 0 ? void 0 : _a.contains(e.target)))
            this.close(); };
        this.onOutside = (e) => { var _a, _b; if (this.state.open && !((_a = this.trigger) === null || _a === void 0 ? void 0 : _a.contains(e.target)) && !((_b = this.panel) === null || _b === void 0 ? void 0 : _b.contains(e.target)))
            this.close(); };
        this.toggle = () => { var _a; const r = (_a = this.trigger) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect(); if (!r)
            return; const width = Math.min(366, window.innerWidth - 20); const left = Math.max(10, Math.min(r.right - width, window.innerWidth - width - 10)); const top = r.bottom + 8; this.setState({ open: !this.state.open, custom: this.props.mode === 'custom', start: this.props.span.start, end: this.props.span.end, step: 'start', view: this.props.span.end.slice(0, 7), placement: { left, top: top + 440 > window.innerHeight ? Math.max(10, r.top - 446) : top } }); };
        this.pickPreset = (mode) => { this.close(); this.props.onChange(mode); };
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
        return h('div', { className: 'mf-calendar' }, h('div', { className: 'mf-calendar-nav' }, h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, -1) }) }, '‹'), h('strong', {}, prettyMonth(ym)), h('button', { type: 'button', onClick: () => this.setState({ view: shiftMonth(ym, 1) }) }, '›')), h('div', { className: 'mf-calendar-grid' }, ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => h('span', { key: 'weekday' + i, className: 'mf-weekday' }, d)), dates.map((day, i) => day ? h('button', { type: 'button', key: day, 'aria-label': day, 'aria-pressed': day === this.state.start || day === this.state.end, className: 'mf-day ' + (day === this.state.start || day === this.state.end ? 'selected ' : '') + (this.state.end && day > this.state.start && day < this.state.end ? 'in-range' : ''), onClick: () => this.pickDate(day) }, String(+day.slice(8))) : h('span', { key: 'empty' + i }))));
    }
    render() {
        var _a, _b;
        const presets = [{ value: 'week', label: 'Esta semana' }, { value: '15d', label: 'Últimos 15 dias' }, { value: 'month', label: 'Mês atual' }, { value: 'lastmonth', label: 'Mês passado' }], span = this.props.span, p = this.state.placement;
        return h('div', { className: 'mf-period-holder' }, h('button', { type: 'button', className: 'mf-period-trigger', ref: (e) => this.trigger = e, 'aria-expanded': this.state.open, 'aria-haspopup': 'dialog', onClick: this.toggle }, h(Icon, { name: 'calendar', size: 17 }), h('span', {}, spanLabel(this.props.mode, span)), h('span', { className: 'mf-caret' }, '⌄')), this.state.open ? ReactDOM.createPortal(h('div', { className: 'mf-period-popover', role: 'dialog', 'aria-label': 'Selecionar período', ref: (e) => this.panel = e, style: { position: 'fixed', left: p.left, top: p.top, width: Math.min(366, window.innerWidth - 20) } }, h('strong', { className: 'mf-popup-title' }, 'Período de análise'), h('div', { className: 'mf-period-presets' }, presets.map(a => h('button', { key: a.value, type: 'button', className: this.props.mode === a.value && !this.state.custom ? 'selected' : '', onClick: () => this.pickPreset(a.value) }, a.label))), h('button', { type: 'button', className: 'mf-custom-toggle ' + (this.state.custom ? 'selected' : ''), onClick: () => this.setState({ custom: !this.state.custom, step: 'start' }) }, 'Selecionar datas personalizadas', h('span', {}, '⌄')), this.state.custom ? h('div', { className: 'mf-custom-calendar' }, h('p', {}, this.state.step === 'start' ? 'Selecione a data inicial' : 'Agora selecione a data final'), h('div', { className: 'mf-range-values' }, h('span', {}, 'Início: ', h('b', {}, ((_a = this.state.start) === null || _a === void 0 ? void 0 : _a.split('-').reverse().join('/')) || '—')), h('span', {}, 'Fim: ', h('b', {}, ((_b = this.state.end) === null || _b === void 0 ? void 0 : _b.split('-').reverse().join('/')) || '—'))), this.renderCalendar(), h('div', { className: 'mf-range-actions' }, h('button', { type: 'button', onClick: this.close }, 'Cancelar'), h('button', { type: 'button', disabled: !this.state.start || !this.state.end || this.state.end < this.state.start, onClick: () => { this.props.onChange('custom', this.state.start, this.state.end); this.close(); } }, 'Aplicar período'))) : null), document.body) : null);
    }
}
class App extends React.Component {
    constructor(props) {
        super(props);
        this.autoSyncTimer = null;
        this.lastSyncAttempt = 0;
        const mode = 'real';
        this.state = { mode, data: desktop ? starter() : load(mode), page: 'overview', month: nowYM, showEntry: false, entry: { date: iso(new Date()), description: '', kind: 'expense', category: 'Outros', value: '' }, sim: { value: '', installments: '6', interest: '0' }, outcome: null, query: '', toast: '', budgetEdit: '', busy: !!desktop, booting: !!desktop, editModal: null, bank: EMPTY_BANK, bankForm: { clientId: '', clientSecret: '', itemIds: '' }, bankBusy: false, bankMessage: '', bankFilter: '', txSource: 'all', dashboardSource: 'bank', categories: DEFAULT_CATEGORY_INFOS, rules: [], categoryEditor: { previousName: '', name: '', color: '#884bff' }, ruleEditor: emptyRule(), ruleTest: 'IFOOD', categoryMessage: '', entryCategoryTouched: false, overviewPeriod: 'month', customStart: iso(new Date()), customEnd: iso(new Date()) };
    }
    async componentDidMount() {
        if (!desktop)
            return;
        try {
            const persisted = await desktop.load('real');
            this.setState({ data: persisted ? safeData(persisted) : starter(), busy: false, booting: false });
            await this.refreshCategories();
            const currentBank = await this.refreshBank();
            this.autoSyncTimer = window.setInterval(() => this.maybeAutoSync(), 30 * 60 * 1000);
            if (currentBank)
                this.maybeAutoSync(currentBank);
        }
        catch (e) {
            this.setState({ fatal: 'Não foi possível acessar o banco SQLite: ' + String((e === null || e === void 0 ? void 0 : e.message) || e), busy: false, booting: false });
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
    componentWillUnmount() { if (this.autoSyncTimer)
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
            this.setState({ categories: state.categories, rules: state.rules, categoryEditor: { previousName: '', name: '', color: '#884bff' }, categoryMessage: 'Categoria salva.', data: persisted ? safeData(persisted) : this.state.data });
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
            return;
        try {
            const data = await desktop.bankCategorize({ accountId: tx.accountId, externalId: tx.id, category: category || null });
            this.setState({ bank: { ...this.state.bank, data }, categoryMessage: 'Classificação bancária salva.' });
        }
        catch (e) {
            this.flash('Falha ao classificar: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    changeManualCategory(id, category) {
        const data = this.state.data;
        this.updateData({ ...data, transactions: data.transactions.map(t => t.id === id ? { ...t, category } : t) }, 'Categoria atualizada.');
    }
    async configureBank() {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy)
            return;
        const f = this.state.bankForm, itemIds = [...new Set(f.itemIds.split(/[;,\n]+/).map(v => v.trim()).filter(Boolean))];
        if (!itemIds.length)
            return this.flash('Informe pelo menos um itemId.');
        this.setState({ bankBusy: true, bankMessage: '' });
        try {
            const bank = await desktop.bankConfigure({ clientId: f.clientId.trim(), clientSecret: f.clientSecret, itemIds });
            this.setState({ bank, bankBusy: false, bankForm: { ...f, clientSecret: '', clientId: bank.config.clientId, itemIds: bank.config.itemIds.join(', ') }, bankMessage: 'Credenciais protegidas no Windows. Agora clique em Sincronizar.' });
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async syncBank(automatic = false) {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy)
            return;
        this.lastSyncAttempt = Date.now();
        this.setState({ bankBusy: true, bankMessage: 'Consultando a Pluggy. Pode levar alguns instantes.' });
        try {
            const result = await desktop.bankSync();
            this.setState({ bank: result, bankBusy: false, bankMessage: 'Sincronização concluída: ' + result.newCount + ' novas e ' + result.totalCount + ' consultadas. Os lançamentos manuais foram preservados.' });
            if (!automatic)
                this.flash('Dados atualizados: ' + result.newCount + ' novas movimentações.');
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: 'Sincronização não concluída: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) + '. O histórico anterior foi preservado.' });
            if (!automatic)
                this.flash('Não foi possível atualizar. Consulte Open Finance para detalhes.');
        }
    }
    async forgetBank() {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy || !confirm('Remover as credenciais salvas deste PC? O histórico já importado continuará no SQLite.'))
            return;
        this.setState({ bankBusy: true });
        try {
            const bank = await desktop.bankForget();
            this.setState({ bank, bankBusy: false, bankForm: { clientId: '', clientSecret: '', itemIds: '' }, bankMessage: 'Credenciais removidas. O histórico importado permanece disponível.' });
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    flash(msg) { this.setState({ toast: msg }); clearTimeout(this.timeout); this.timeout = setTimeout(() => this.setState({ toast: '' }), 4500); }
    async updateData(data, msg) {
        if (this.state.busy) {
            this.flash('Aguarde a gravação anterior.');
            return;
        }
        const mode = this.state.mode;
        if (!desktop) {
            try {
                save(mode, data);
                this.setState({ data });
                if (msg)
                    this.flash(msg);
            }
            catch (e) {
                this.flash('Não foi possível gravar os dados. Faça um backup.');
            }
            return;
        }
        this.setState({ busy: true });
        try {
            await desktop.save(mode, data);
            this.setState({ data, busy: false });
            if (msg)
                this.flash(msg);
        }
        catch (e) {
            this.setState({ busy: false });
            this.flash('Falha ao salvar no SQLite: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async toggleMode() {
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
                this.flash('Cópia do banco SQLite salva com sucesso.');
        }
        catch (e) {
            this.flash('Falha no backup SQLite: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    }
    async openDataDir() { if (!desktop)
        return; try {
        const err = await desktop.openDataFolder();
        if (err)
            this.flash('Não foi possível abrir a pasta: ' + err);
    }
    catch (e) {
        this.flash('Não foi possível abrir a pasta de dados.');
    } }
    navigate(page) { this.setState({ page, showEntry: false, outcome: null }); }
    monthData() { return snapshot(this.state.data, this.state.month); }
    saveEntry() { const f = this.state.entry, v = parseMoney(f.value); if (!f.description.trim())
        return this.flash('Informe uma descrição.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date))
        return this.flash('Informe uma data válida.'); if (!Number.isFinite(v) || v <= 0)
        return this.flash('Informe um valor maior que zero.'); const t = { id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), date: f.date, description: f.description.trim().slice(0, 150), category: f.category, kind: f.kind, amount: v, origin: 'manual' }; this.updateData({ ...this.state.data, transactions: [...this.state.data.transactions, t] }, 'Lançamento registrado.'); this.setState({ showEntry: false, entryCategoryTouched: false, entry: { ...f, description: '', value: '' } }); }
    removeEntry(id) { if (!confirm('Excluir este lançamento?'))
        return; this.updateData({ ...this.state.data, transactions: this.state.data.transactions.filter(t => t.id !== id) }, 'Lançamento removido.'); }
    setBudget(cat, s) { const v = parseMoney(s); if (!Number.isFinite(v) || v < 0)
        return this.flash('Orçamento inválido.'); this.updateData({ ...this.state.data, budgets: { ...this.state.data.budgets, [cat]: v } }, 'Orçamento atualizado.'); this.setState({ budgetEdit: '' }); }
    setSetting(k, s) { const v = parseMoney(s); if (!Number.isFinite(v) || Math.abs(v) > 100000000000 || ((k !== 'opening') && v < 0))
        return this.flash('Valor inválido.'); this.updateData({ ...this.state.data, settings: { ...this.state.data.settings, [k]: v } }, 'Configuração salva.'); }
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
    runSim() { const result = simulate(this.state.data, this.state.sim); this.setState({ outcome: result }); }
    field(label, el, hint) { return h('label', { className: 'field' }, h('span', {}, label), el, hint ? h('small', {}, hint) : null); }
    navItem(page, icon, label) { return h('button', { key: page, className: 'nav-item ' + (this.state.page === page ? 'active' : ''), onClick: () => this.navigate(page) }, h(Icon, { name: icon, size: 19 }), h('span', {}, label)); }
    renderSide() {
        return h('aside', { className: 'sidebar' }, h('div', { className: 'brand' }, h(Logo), h('div', { className: 'brand-text' }, h('strong', {}, 'Meu Financeiro'), h('small', {}, 'SEU DINHEIRO. MAIS INTELIGENTE.'))), h('div', { className: 'side-label' }, 'SEU ESPAÇO'), h('nav', {}, this.navItem('overview', 'home', 'Visão geral'), this.navItem('transactions', 'wallet', 'Transações'), this.navItem('budgets', 'pie', 'Orçamentos'), this.navItem('categories', 'filter', 'Categorias e regras'), this.navItem('banks', 'bank', 'Open Finance'), this.navItem('assistant', 'cart', 'Assistente de compras'), this.navItem('simulator', 'calendar', 'Simulador de parcelas'), this.navItem('settings', 'settings', 'Configurações')), h('div', { className: 'side-bottom' }, h('div', { className: 'privacy-note' }, h(Icon, { name: 'shield', size: 19 }), h('div', {}, h('b', {}, 'Privado e local'), h('small', {}, desktop ? 'Base SQLite no computador' : 'Sem conexão bancária ou IA'))), h('button', { className: 'demo-btn', onClick: () => this.toggleMode() }, h(Icon, { name: this.state.mode === 'real' ? 'spark' : 'home', size: 18 }), this.state.mode === 'real' ? 'Explorar demonstração' : 'Voltar aos meus dados'), h('small', { className: 'app-version' }, desktop ? 'Meu Financeiro · v0.6.1 Electron' : 'Meu Financeiro · v0.6.1 Prévia')));
    }
    renderTop() {
        var _a;
        const labels = { overview: 'Visão geral', transactions: 'Transações', budgets: 'Orçamentos', assistant: 'Assistente de compras', simulator: 'Simulador de parcelas', settings: 'Configurações', banks: 'Open Finance', categories: 'Categorias e regras' };
        const period = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const months = Array.from({ length: 45 }, (_, i) => shiftMonth(nowYM, 3 - i)).map(m => ({ value: m, label: prettyMonth(m) }));
        const configured = this.state.mode === 'real' && this.state.bank.config.configured;
        const last = (_a = this.state.bank.data.last) === null || _a === void 0 ? void 0 : _a.completedAt;
        return h('header', { className: 'topbar' }, h('div', { className: 'top-left' }, h('div', { className: 'page-kicker' }, 'FINANÇAS PESSOAIS / ' + (labels[this.state.page] || '').toUpperCase()), h('h1', {}, labels[this.state.page]), h('p', {}, this.state.page === 'overview' ? 'Entenda seus períodos e tome decisões com mais clareza.' : this.state.page === 'assistant' ? 'Antes de comprar, saiba o impacto real no seu futuro.' : 'Organize suas finanças com tranquilidade e autonomia.')), h('div', { className: 'header-actions' }, h('span', { className: 'mode-tag ' + (this.state.mode === 'demo' ? 'mode-demo' : '') }, h('i', {}), this.state.mode === 'demo' ? 'DEMONSTRAÇÃO' : (desktop ? 'SQLITE LOCAL' : 'DADOS LOCAIS')), this.state.page === 'overview' ? h('div', { className: 'overview-period-controls' }, h(PeriodPicker, { mode: this.state.overviewPeriod, span: period, onChange: (mode, start, end) => this.setState({ overviewPeriod: mode, customStart: start || this.state.customStart, customEnd: end || this.state.customEnd }) }), configured ? h('button', { type: 'button', className: 'mf-refresh-button', disabled: this.state.bankBusy, onClick: () => this.syncBank(false), title: last ? 'Última consulta: ' + new Date(last).toLocaleString('pt-BR') : 'Ainda não sincronizado' }, h(Icon, { name: 'refresh', size: 16 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar') : null) : h(StyledSelect, { className: 'mf-month-trigger', wrapperClass: 'month-dropdown', value: this.state.month, options: months, ariaLabel: 'Selecionar mês', onChange: (value) => this.setState({ month: value }) })));
    }
    renderOverview() {
        var _a;
        const d = this.state.data, period = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const { start, end } = period, bank = this.state.bank;
        const useBank = this.state.mode === 'real' && this.state.dashboardSource === 'bank' && bank.data.accounts.length > 0;
        const s = useBank ? bankSnapshotBetween(bank, start, end) : snapshotBetween(d, start, end);
        const snapshotRange = (a, b) => useBank ? bankSnapshotBetween(bank, a, b) : snapshotBetween(d, a, b);
        const mdata = flowSegments(start, end, snapshotRange);
        const recent = useBank ? bank.data.transactions.filter(x => x.date >= start && x.date <= end && x.status === 'POSTED').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(x => ({ id: 'bank-' + x.accountId + '-' + x.id, date: x.date, description: x.description, kind: (x.amount >= 0 ? 'income' : 'expense'), amount: Math.abs(x.amount), category: x.category })) : d.transactions.filter(x => x.date >= start && x.date <= end).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        const budgetMonth = end.slice(0, 7), budgetRangeStart = firstOfMonth(budgetMonth), budgetRangeEnd = endOfMonth(budgetMonth);
        const budgetSnap = snapshotRange(budgetRangeStart, budgetRangeEnd);
        const spent = budgetSnap.expense, totalBudget = this.getCategories().reduce((a, k) => a + Number(d.budgets[k.name] || 0), 0), percent = totalBudget ? Math.round(spent / totalBudget * 100) : 0;
        const last = (_a = bank.data.last) === null || _a === void 0 ? void 0 : _a.completedAt;
        return h('div', { className: 'overview-content' }, this.renderBankQuick(), this.state.mode === 'real' && bank.data.accounts.length ? h('div', { className: 'source-picker' }, h('strong', {}, 'Dados dos indicadores:'), h('button', { className: useBank ? 'selected' : '', onClick: () => this.setState({ dashboardSource: 'bank' }) }, 'Open Finance (confirmados)'), h('button', { className: !useBank ? 'selected' : '', onClick: () => this.setState({ dashboardSource: 'manual' }) }, 'Lançamentos manuais'), h('span', {}, 'Fontes nunca são somadas automaticamente.')) : null, h('div', { className: 'period-context' }, h(Icon, { name: 'calendar', size: 15 }), h('span', {}, 'Período: ' + period.start.split('-').reverse().join('/') + ' a ' + period.end.split('-').reverse().join('/')), bank.config.configured ? h('span', {}, this.state.bankBusy ? 'Consultando Pluggy…' : 'Última consulta: ' + (last ? new Date(last).toLocaleString('pt-BR') : 'não realizada') + ' · verificação automática a cada 6h com o app aberto') : null), this.state.bankMessage && bank.config.configured ? h('div', { className: 'sync-feedback', role: 'status' }, this.state.bankMessage) : null, h('div', { className: 'stats-grid' }, h(Stat, { label: useBank ? 'Saldo bancário atual' : 'Saldo manual atual', amount: s.balance, icon: 'wallet', hint: useBank ? 'Saldo informado pela instituição (hoje)' : 'Saldo inicial + todas as movimentações', featured: true }), h(Stat, { label: 'Receitas no período', amount: s.income, icon: 'trend', hint: 'Entradas confirmadas no intervalo', color: 'green' }), h(Stat, { label: 'Despesas no período', amount: s.expense, icon: 'down', hint: 'Saídas confirmadas no intervalo', color: 'pink' }), h(Stat, { label: 'Resultado no período', amount: s.net, icon: 'chart', hint: 'Receitas menos despesas no intervalo', color: 'purple' })), h('div', { className: 'mid-grid' }, h(Card, { className: 'flow-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Fluxo de caixa'), h('p', {}, 'Evolução dentro do período · ' + (useBank ? 'Banco confirmado' : 'Lançamentos manuais'))), h('div', { className: 'chart-legend' }, h('span', {}, h('i', { className: 'dot-purple' }), 'Receitas'), h('span', {}, h('i', { className: 'dot-pink' }), 'Despesas'))), h(Chart, { data: mdata })), h(Card, { className: 'donut-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Gastos por categoria'), h('p', {}, 'Despesas do período selecionado'))), h(Donut, { items: s.categories, colors: Object.fromEntries(this.getCategories().map(c => [c.name, c.color])) }))), h('div', { className: 'bottom-grid' }, h(Card, { className: 'recent-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Últimas movimentações'), h('p', {}, 'Histórico recente deste período')), h('button', { className: 'text-button', onClick: () => this.setState({ month: end.slice(0, 7) }, () => this.navigate('transactions')) }, 'Ver tudo ', h(Icon, { name: 'arrow', size: 16 }))), recent.length ? h('div', { className: 'mini-table' }, recent.map(t => h('div', { className: 'mini-row', key: t.id }, h('div', { className: 'mini-icon ' + (t.kind === 'income' ? 'good' : '') }, h(Icon, { name: t.kind === 'income' ? 'trend' : 'cart' })), h('div', { className: 'mini-copy' }, h('b', {}, t.description), h('small', {}, t.category + ' · ' + t.date.split('-').reverse().join('/'))), h('strong', { className: t.kind === 'income' ? 'good-text' : 'bad-text' }, (t.kind === 'income' ? '+' : '−') + fmt(t.amount))))) : h('div', { className: 'empty-mini' }, h(Icon, { name: 'wallet', size: 29 }), h('b', {}, 'Ainda sem movimentações'), h('span', {}, 'Nenhuma movimentação no período selecionado.'))), h(Card, { className: 'budget-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Seu orçamento'), h('p', {}, 'Acompanhamento mensal · ' + prettyMonth(budgetMonth))), h('span', { className: 'muted-label' }, totalBudget ? 'Limite mensal definido' : 'Sem limites')), h('div', { className: 'budget-headline' }, h('div', {}, h('small', {}, 'Utilizado no mês de ' + prettyMonth(budgetMonth)), h('strong', {}, fmt(spent))), h('div', { className: 'budget-percent' }, totalBudget ? percent + '%' : '—')), h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { width: Math.min(100, percent) + '%' } })), h('div', { className: 'progress-foot' }, h('span', {}, totalBudget ? fmt(Math.max(0, totalBudget - spent)) + ' restantes' : 'Defina limites nas categorias'), h('span', {}, totalBudget ? fmt(totalBudget) + ' total' : '')), h('button', { className: 'outlined-action', onClick: () => { this.setState({ month: budgetMonth }); this.navigate('budgets'); } }, 'Gerenciar orçamento', h(Icon, { name: 'arrow', size: 16 })))));
    }
    renderTransactions() {
        const manual = this.state.data.transactions.map(t => ({ id: t.id, key: 'manual:' + t.id, date: t.date, description: t.description, category: t.category, kind: t.kind, amount: t.amount, origin: 'manual', account: 'Manual', status: 'POSTED', categorySource: 'manual' }));
        const bank = (this.state.mode === 'demo' ? [] : this.state.bank.data.transactions || []).map(t => ({ id: t.id, key: 'bank:' + t.accountId + ':' + t.id, date: t.date, description: t.description, category: t.category, kind: t.amount >= 0 ? 'income' : 'expense', amount: Math.abs(t.amount), origin: 'bank', account: t.accountName || 'Banco', status: t.status, categorySource: t.categorySource || 'bank', raw: t }));
        const term = fold(this.state.query);
        const all = manual.concat(bank).filter(t => (this.state.txSource === 'all' || t.origin === this.state.txSource) && (!this.state.month || t.date.slice(0, 7) === this.state.month) && (!term || [t.description, t.account, t.category].some(x => fold(x).includes(term)))).sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
        const entries = all.slice(0, 500), bankCount = all.filter(t => t.origin === 'bank').length;
        const cats = this.getCategories().map(c => c.name);
        return h('div', { className: 'section' }, h('div', { className: 'panel-toolbar' }, h('div', { className: 'search-box' }, h(Icon, { name: 'search', size: 18 }), h('input', { value: this.state.query, placeholder: 'Buscar descrição, categoria ou instituição...', onChange: (e) => this.setState({ query: e.target.value }) })), h('div', { className: 'toolbar-actions' }, h(StyledSelect, { className: 'form-control bank-filter', value: this.state.txSource, options: [{ value: 'all', label: 'Todas as origens' }, { value: 'bank', label: 'Open Finance' }, { value: 'manual', label: 'Manuais' }], onChange: (v) => this.setState({ txSource: v }) }), h('button', { className: 'ghost-button', onClick: () => this.navigate('categories') }, h(Icon, { name: 'filter', size: 17 }), 'Regras'), h('button', { className: 'ghost-button', onClick: () => { var _a; return (_a = this.csvInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Importar CSV'), h('button', { className: 'ghost-button', onClick: () => this.exportCSV() }, h(Icon, { name: 'download', size: 17 }), 'Exportar manuais'), h('button', { className: 'primary-button', onClick: () => this.setState({ showEntry: true, entryCategoryTouched: false }) }, h(Icon, { name: 'plus', size: 18 }), 'Novo lançamento'))), h(Card, { className: 'table-card' }, h('div', { className: 'list-intro' }, h('div', {}, h('h2', {}, 'Todas as movimentações'), h('p', {}, all.length + ' lançamentos no período · ' + bankCount + ' bancários · ' + (all.length - bankCount) + ' manuais')), h('span', { className: 'caption-pill' }, prettyMonth(this.state.month))), h('p', { className: 'muted-desc', style: { padding: '0 20px 14px' } }, 'Classifique diretamente abaixo. Movimentações da Pluggy são somente leitura: suas correções ficam salvas separadamente e nunca são substituídas pela sincronização. Bancárias e manuais não são somadas entre si.'), h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'ORIGEM', 'STATUS', 'VALOR', ''].map(n => h('th', { key: n }, n)))), h('tbody', {}, entries.length ? entries.map(t => h('tr', { key: t.key }, h('td', { className: 'muted' }, t.date.split('-').reverse().join('/')), h('td', { className: 'desc-cell' }, h('span', { className: 'tx-tiny-icon ' + (t.kind === 'income' ? 'income' : '') }, h(Icon, { name: t.kind === 'income' ? 'trend' : 'cart', size: 15 })), t.description), h('td', {}, h(StyledSelect, { className: 'form-control inline-category', value: t.category, options: [...(!cats.includes(t.category) ? [{ value: t.category, label: t.category }] : []), ...cats.map(name => ({ value: name, label: name }))], onChange: (value) => t.origin === 'bank' ? this.setBankCategory(t.raw, value) : this.changeManualCategory(t.id, value) }), t.origin === 'bank' ? h('small', { className: 'muted', style: { display: 'block', marginTop: 5 } }, t.categorySource === 'manual' ? 'Corrigida por você' : t.categorySource === 'rule' ? 'Regra automática' : 'Categoria original') : null), h('td', {}, h('span', { className: 'category-tag' }, t.account)), h('td', {}, h('span', { className: 'kind-pill ' + t.kind }, t.status === 'PENDING' ? 'Pendente' : t.status === 'POSTED' ? 'Confirmada' : t.status)), h('td', { className: t.kind === 'income' ? 'good-text amount-cell' : 'amount-cell' }, (t.kind === 'income' ? '+' : '−') + fmt(t.amount)), h('td', {}, t.origin === 'manual' ? h('button', { className: 'trash-button', title: 'Excluir manual', onClick: () => this.removeEntry(t.id) }, h(Icon, { name: 'trash', size: 16 })) : t.categorySource === 'manual' ? h('button', { className: 'small-link', title: 'Voltar à categoria automática', onClick: () => this.setBankCategory(t.raw, '') }, 'Auto') : h('span', { className: 'muted' }, '—')))) :
            h('tr', {}, h('td', { colSpan: 7, className: 'empty-table' }, 'Nenhuma movimentação corresponde ao mês ou aos filtros.')))))));
    }
    renderCategories() {
        var _a;
        const categories = this.getCategories(), rules = this.state.rules, e = this.state.categoryEditor, r = this.state.ruleEditor;
        const preview = findCategoryRule(this.state.ruleTest, 'bank', rules);
        return h('div', { className: 'section categories-page' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'ORGANIZAÇÃO AUTOMÁTICA'), h('h2', {}, 'Seu dinheiro, suas categorias.'), h('p', {}, 'Personalize os nomes e cores, crie regras por descrição e ajuste lançamentos individualmente. Tudo funciona localmente, sem IA paga.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'filter', size: 46 }))), this.state.mode === 'demo' ? h(Card, { className: 'settings-card' }, h('h2', {}, 'Modo demonstração'), h('p', {}, 'A edição de regras e categorias está disponível somente nos seus dados pessoais.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')) :
            h('div', { className: 'categories-layout' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Categorias personalizadas'), h('p', {}, 'As categorias padrão podem mudar de cor. Categorias criadas por você podem ser renomeadas.'))), h('div', { className: 'category-list' }, categories.map(cat => h('div', { className: 'category-list-row', key: cat.name }, h('span', { className: 'category-swatch', style: { background: cat.color } }), h('b', {}, cat.name), cat.builtIn ? h('small', { className: 'muted' }, 'Padrão') : null, h('button', { className: 'small-link', onClick: () => this.setState({ categoryEditor: { previousName: cat.name, name: cat.name, color: cat.color } }) }, 'Editar'), !cat.builtIn ? h('button', { className: 'trash-button', title: 'Excluir categoria sem uso', onClick: () => this.deleteCategory(cat.name) }, h(Icon, { name: 'trash', size: 16 })) : null))), h('h3', {}, e.previousName ? 'Editar categoria' : 'Criar categoria'), this.field('Nome', h('input', { className: 'form-control', value: e.name, maxLength: 50, placeholder: 'Ex.: Pets, Delivery, Estudos', disabled: !!(e.previousName && ((_a = categories.find(c => c.name === e.previousName)) === null || _a === void 0 ? void 0 : _a.builtIn)), onChange: (v) => this.setState({ categoryEditor: { ...e, name: v.target.value } }) })), this.field('Cor', h('div', { className: 'color-picker-line' }, h('input', { type: 'color', value: e.color, onChange: (v) => this.setState({ categoryEditor: { ...e, color: v.target.value } }) }), h('code', {}, e.color))), h('div', { className: 'toolbar-actions' }, h('button', { className: 'primary-button', onClick: () => this.saveCategory() }, e.previousName ? 'Salvar alterações' : 'Adicionar categoria'), e.previousName ? h('button', { className: 'ghost-button', onClick: () => this.setState({ categoryEditor: { previousName: '', name: '', color: '#884bff' } }) }, 'Cancelar edição') : null)), h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Regras automáticas'), h('p', {}, 'Ex.: descrição contém IFOOD → Alimentação. Menor prioridade vence; empate segue a regra mais antiga.'))), h('div', { className: 'rule-list' }, rules.length ? rules.map(rule => h('div', { className: 'rule-list-row', key: rule.id }, h('div', {}, h('strong', {}, rule.pattern), h('small', {}, (rule.matchMode === 'exact' ? 'Texto exato' : rule.matchMode === 'starts' ? 'Começa com' : 'Contém') + ' · ' + (rule.scope === 'both' ? 'Banco e manuais' : rule.scope === 'bank' ? 'Banco' : 'Manuais') + ' · Prioridade ' + rule.priority)), h('span', { className: 'category-tag' }, rule.category), h('button', { className: 'small-link', onClick: () => this.setState({ ruleEditor: { id: rule.id, pattern: rule.pattern, matchMode: rule.matchMode, category: rule.category, scope: rule.scope, priority: String(rule.priority) } }) }, 'Editar'), h('button', { className: 'trash-button', title: 'Excluir regra', onClick: () => this.deleteRule(rule.id) }, h(Icon, { name: 'trash', size: 16 })))) : h('p', { className: 'muted-desc' }, 'Nenhuma regra criada. Cadastre a primeira abaixo.')), h('div', { className: 'rule-suggestions' }, h('small', {}, 'Modelos rápidos:'), [
                { pattern: 'IFOOD', category: 'Alimentação' },
                { pattern: 'UBER', category: 'Transporte' },
                { pattern: 'NETFLIX', category: 'Assinaturas' },
                { pattern: 'SPOTIFY', category: 'Assinaturas' }
            ].map(x => h('button', { className: 'ghost-button', key: x.pattern, onClick: () => this.setState({ ruleEditor: { ...emptyRule(), pattern: x.pattern, category: x.category } }) }, x.pattern))), h('h3', {}, r.id ? 'Editar regra' : 'Nova regra'), this.field('Texto da movimentação', h('input', { className: 'form-control', placeholder: 'Ex.: IFOOD, UBER, NETFLIX', maxLength: 120, value: r.pattern, onChange: (v) => this.setState({ ruleEditor: { ...r, pattern: v.target.value } }) })), h('div', { className: 'two-inputs' }, this.field('Correspondência', h(StyledSelect, { className: 'form-control', value: r.matchMode, options: [{ value: 'contains', label: 'Contém' }, { value: 'starts', label: 'Começa com' }, { value: 'exact', label: 'Texto exato' }], onChange: (value) => this.setState({ ruleEditor: { ...r, matchMode: value } }) })), this.field('Aplicar em', h(StyledSelect, { className: 'form-control', value: r.scope, options: [{ value: 'both', label: 'Bancos e novos manuais' }, { value: 'bank', label: 'Só banco' }, { value: 'manual', label: 'Só novos manuais' }], onChange: (value) => this.setState({ ruleEditor: { ...r, scope: value } }) }))), h('div', { className: 'two-inputs' }, this.field('Categoria', h(StyledSelect, { className: 'form-control', value: r.category, options: categories.map(c => ({ value: c.name, label: c.name })), onChange: (value) => this.setState({ ruleEditor: { ...r, category: value } }) })), this.field('Prioridade (1 = mais alta)', h('input', { className: 'form-control', type: 'number', min: 1, max: 999, value: r.priority, onChange: (v) => this.setState({ ruleEditor: { ...r, priority: v.target.value } }) }))), h('div', { className: 'toolbar-actions' }, h('button', { className: 'primary-button', onClick: () => this.saveRule() }, r.id ? 'Atualizar regra' : 'Salvar regra'), r.id ? h('button', { className: 'ghost-button', onClick: () => this.setState({ ruleEditor: emptyRule() }) }, 'Cancelar edição') : null), h('div', { className: 'rule-preview' }, h('b', {}, 'Testar classificação'), h('input', { className: 'form-control', value: this.state.ruleTest, placeholder: 'Digite uma descrição do extrato', onChange: (v) => this.setState({ ruleTest: v.target.value }) }), h('p', {}, 'Resultado: ', h('strong', {}, preview || 'Sem regra correspondente (Outros)'))))), this.state.categoryMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.categoryMessage) : null, h('p', { className: 'muted-desc' }, 'Regras reclassificam imediatamente o extrato bancário na visualização, inclusive dados já sincronizados. Correções individuais do banco sempre prevalecem. Lançamentos manuais antigos preservam sua categoria; regras automáticas ajudam em novos lançamentos e importações sem categoria.'));
    }
    renderBudgets() {
        const s = this.state.mode === 'real' && this.state.dashboardSource === 'bank' && this.state.bank.data.accounts.length ? bankSnapshot(this.state.bank, this.state.month) : this.monthData(), d = this.state.data;
        return h('div', { className: 'section' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'PLANEJAMENTO'), h('h2', {}, 'Cada categoria no seu controle.'), h('p', {}, 'Defina um limite por categoria. Esses valores não movimentam seu saldo; servem apenas para acompanhar gastos.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'pie', size: 46 }))), h('div', { className: 'budget-grid' }, this.getCategories().map((info, i) => { var _a; const cat = info.name; const spent = ((_a = s.categories.find(x => x.name === cat)) === null || _a === void 0 ? void 0 : _a.total) || 0, limit = d.budgets[cat] || 0, pct = limit ? Math.round(spent / limit * 100) : 0; return h(Card, { className: 'budget-item', key: cat }, h('div', { className: 'budget-item-top' }, h('span', { className: 'cat-symbol', style: { background: info.color + '28', color: info.color } }, h(Icon, { name: ['home', 'cart', 'trend', 'shield', 'spark', 'layers', 'calendar', 'wallet', 'bank', 'pie'][i], size: 20 })), h('div', {}, h('h3', {}, cat), h('small', {}, 'Gasto atual: ' + fmt(spent)))), h('div', { className: 'budget-item-value' }, h('strong', {}, fmt(limit)), h('span', {}, 'limite mensal')), h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { background: info.color, width: Math.min(pct, 100) + '%' } })), h('div', { className: 'budget-item-bottom' }, h('span', { className: pct > 100 ? 'bad-text' : '' }, limit ? pct + '% utilizado' : 'Sem limite definido'), h('button', { className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: cat, title: 'Limite mensal · ' + cat, value: moneyString(limit) } }) }, 'Editar'))); })));
    }
    renderAssistant(includeBanner = true) {
        const d = this.state.data;
        const out = this.state.outcome;
        const examples = [{ name: 'Notebook', price: '3200', icon: 'wallet' }, { name: 'Celular', price: '2400', icon: 'cart' }, { name: 'Compra pequena', price: '350', icon: 'spark' }];
        return h('div', { className: 'section assistant-page' }, includeBanner ? h('div', { className: 'intro-banner assistant-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'DECISÕES MAIS CONSCIENTES'), h('h2', {}, 'Posso comprar isso agora?'), h('p', {}, 'Simule sem afetar seus lançamentos. O resultado considera renda, despesas, compromissos e reserva configurados.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'cart', size: 46 }))) : null, h('div', { className: 'assistant-grid' }, h(Card, { className: 'sim-form-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Sua próxima compra'), h('p', {}, 'Preencha os dados para analisar')), h('span', { className: 'round-purple' }, h(Icon, { name: 'spark', size: 19 }))), this.field('Valor do produto (R$)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.value, placeholder: 'Ex.: 1.499,90', onChange: (e) => this.setState({ sim: { ...this.state.sim, value: e.target.value } }) })), h('div', { className: 'two-inputs' }, this.field('Número de parcelas', h(StyledSelect, { className: 'form-control', value: this.state.sim.installments, options: [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36].map(n => ({ value: String(n), label: n === 1 ? 'À vista' : n + 'x' })), onChange: (value) => this.setState({ sim: { ...this.state.sim, installments: value } }) })), this.field('Juros ao mês (%)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.interest, onChange: (e) => this.setState({ sim: { ...this.state.sim, interest: e.target.value } }) }))), h('button', { className: 'primary-button full action-large', onClick: () => this.runSim() }, h(Icon, { name: 'spark', size: 18 }), 'Analisar compra'), h('div', { className: 'sim-example-title' }, 'Experimentar com um exemplo'), h('div', { className: 'quick-examples' }, examples.map(x => h('button', { className: 'quick-choice', onClick: () => this.setState({ sim: { ...this.state.sim, value: x.price }, outcome: null }), key: x.name }, h(Icon, { name: x.icon, size: 17 }), x.name)))), h('div', { className: 'result-column' }, out ? this.renderResult(out) : h(Card, { className: 'empty-result' }, h('span', { className: 'empty-result-icon' }, h(Icon, { name: 'shield', size: 40 })), h('h2', {}, 'Uma análise antes da decisão.'), h('p', {}, 'Descubra o peso da parcela, o custo total e como a compra pode afetar sua reserva financeira nos próximos meses.'), h('div', { className: 'result-steps' }, h('span', {}, '01  Simule'), h('span', {}, '02  Compare'), h('span', {}, '03  Decida'))), h('div', { className: 'info-box' }, h(Icon, { name: 'shield', size: 18 }), h('p', {}, 'A análise funciona por regras matemáticas, sem IA. Quando faltam dados, o aplicativo não afirma que uma compra é segura.')))));
    }
    renderResult(out) {
        if (out.error)
            return h(Card, { className: 'result-error' }, h(Icon, { name: 'alert' }), out.error);
        const r = out.risk;
        const info = { safe: ['Compra confortável', 'Seu perfil informado indica margem para acomodar a parcela.', 'safe'], caution: ['Atenção ao orçamento', 'A compra reduz sua margem ou compromete uma parte relevante da renda.', 'caution'], risk: ['Compra arriscada', 'A projeção pode ultrapassar a margem informada ou comprometer sua reserva.', 'danger'], unknown: ['Dados insuficientes', 'Defina renda e despesas fixas em Configurações para avaliar o risco.', 'unknown'] };
        const [title, subtitle, cls] = info[r];
        const ratios = out.hasProfile ? Math.round(out.monthly / this.state.data.settings.income * 100) : null;
        return h(Card, { className: 'result-card' }, h('div', { className: 'result-badge ' + cls }, h(Icon, { name: r === 'safe' ? 'check' : 'alert', size: 22 }), h('div', {}, h('h2', {}, title), h('p', {}, subtitle))), h('div', { className: 'result-metrics' }, h('div', {}, h('span', {}, 'Parcela'), h('strong', {}, fmt(out.monthly))), h('div', {}, h('span', {}, 'Custo total'), h('strong', {}, fmt(out.total))), h('div', {}, h('span', {}, 'Juros totais'), h('strong', {}, fmt(out.total - out.principal))), h('div', {}, h('span', {}, 'Peso na renda'), h('strong', {}, ratios === null ? '—' : ratios + '%'))), h('div', { className: 'future-title' }, 'Projeção dos próximos meses'), h('div', { className: 'future-list' }, out.rows.slice(0, 6).map((v) => h('div', { key: v.month }, h('span', {}, prettyMonth(v.month)), h('b', { className: v.available < 0 ? 'bad-text' : '' }, fmt(v.available))))), h('p', { className: 'disclaimer' }, 'Projeção simplificada: começa no próximo mês e pressupõe os mesmos valores recorrentes informados. Não considera vencimentos diários, renda variável ou pagamentos já lançados. Não é garantia de capacidade de pagamento.'));
    }
    renderSimulator() { return h('div', { className: 'section' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'PARCELAMENTO'), h('h2', {}, 'O futuro também entra na conta.'), h('p', {}, 'Compare cenários sem registrar dívida. O simulador usa parcelas fixas e juros mensais informados.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'calendar', size: 44 }))), this.renderAssistant(false)); }
    renderBankQuick() {
        if (this.state.mode === 'demo')
            return null;
        const b = this.state.bank, a = b.data.accounts || [], last = b.data.last;
        if (!a.length && !b.config.configured)
            return null;
        const balance = a.filter(x => x.balance !== null).reduce((sum, x) => sum + (x.balance || 0), 0);
        return h('div', { className: 'bank-quick' }, h('div', {}, h('small', {}, 'OPEN FINANCE · EXTRATO SEPARADO'), h('strong', {}, a.length ? fmt(balance) : 'Conexão configurada'), h('span', {}, a.length ? a.length + ' conta(s) · atualização: ' + ((last === null || last === void 0 ? void 0 : last.completedAt) ? new Date(last.completedAt).toLocaleString('pt-BR') : 'pendente') : 'Sincronize para obter suas contas')), h('button', { className: 'outlined-action', onClick: () => this.navigate('banks') }, 'Ver contas bancárias', h(Icon, { name: 'arrow', size: 16 })), h('p', {}, 'Saldos e extratos bancários não são somados aos lançamentos manuais para evitar duplicidades.'));
    }
    renderBanks() {
        var _a, _b, _c;
        if (this.state.mode === 'demo')
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Open Finance disponível apenas nos dados pessoais'), h('p', { className: 'muted-desc' }, 'O modo demonstração é isolado e nunca consulta suas contas bancárias.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')));
        if (!desktop)
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Abra o aplicativo Electron'), h('p', {}, 'A sincronização bancária exige o aplicativo desktop para proteger as credenciais.')));
        const b = this.state.bank, c = b.config || EMPTY_BANK.config, accounts = b.data.accounts || [], tx = b.data.transactions || [], f = this.state.bankForm;
        const filtered = tx.filter(x => (!this.state.bankFilter || x.accountId === this.state.bankFilter));
        const posted = filtered.filter(x => x.status === 'POSTED');
        const income = posted.filter(x => x.amount > 0).reduce((v, x) => v + x.amount, 0);
        const expense = posted.filter(x => x.amount < 0).reduce((v, x) => v - x.amount, 0);
        return h('div', { className: 'section bank-page' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'BANCO CONECTADO · LEITURA SOMENTE'), h('h2', {}, 'Seu extrato direto no Meu Financeiro.'), h('p', {}, 'Conecte via Meu Pluggy, sincronize e consulte os dados offline. Nunca informe senha bancária neste aplicativo.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'bank', size: 46 }))), h('div', { className: 'bank-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Conexão Meu Pluggy'), h('p', {}, c.configured ? 'Credenciais salvas e protegidas' : 'Configure sua conexão pessoal gratuita')), h('span', { className: 'bank-status ' + (c.configured ? 'enabled' : '') }, c.configured ? 'Configurada' : 'Não configurada')), !c.secure ? h('p', { className: 'bank-warning' }, 'A criptografia segura está indisponível neste sistema. Não salve credenciais.') : null, this.field('Client ID', h('input', { className: 'form-control', value: f.clientId, placeholder: 'Cole o Client ID do Dashboard', maxLength: 300, autoComplete: 'off', onChange: (e) => this.setState({ bankForm: { ...f, clientId: e.target.value } }) })), this.field('Client Secret', h('input', { className: 'form-control', type: 'password', value: f.clientSecret, placeholder: c.configured ? 'Já protegido — deixe vazio para manter' : 'Cole o Client Secret', maxLength: 1000, autoComplete: 'new-password', onChange: (e) => this.setState({ bankForm: { ...f, clientSecret: e.target.value } }) })), this.field('itemId (um ou mais, separados por vírgula)', h('textarea', { className: 'form-control bank-item-field', value: f.itemIds, rows: 2, placeholder: 'ID em Itens conectados no Pluggy Dashboard', onChange: (e) => this.setState({ bankForm: { ...f, itemIds: e.target.value } }) }), 'Não use a senha ou CPF do Itaú. Copie os IDs exibidos no Pluggy Dashboard.'), h('div', { className: 'bank-actions' }, h('button', { className: 'primary-button', disabled: !c.secure || this.state.bankBusy, onClick: () => this.configureBank() }, h(Icon, { name: 'shield', size: 17 }), 'Salvar proteção'), h('button', { className: 'outlined-action', disabled: !c.configured || this.state.bankBusy, onClick: () => this.syncBank() }, h(Icon, { name: 'download', size: 17 }), this.state.bankBusy ? 'Sincronizando…' : 'Sincronizar agora')), h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Segredo criptografado pelo Windows. Nunca incluído no SQLite, exportações ou GitHub.'), c.configured ? h('button', { className: 'bank-forget', onClick: () => this.forgetBank(), disabled: this.state.bankBusy }, 'Remover credenciais deste PC') : null, this.state.bankMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.bankMessage) : null), h(Card, { className: 'settings-card' }, h('h2', {}, 'Resumo da sincronização'), h('div', { className: 'bank-metric-list' }, h('div', {}, h('span', {}, 'Contas bancárias'), h('strong', {}, String(accounts.length))), h('div', {}, h('span', {}, 'Transações em cache'), h('strong', {}, String(tx.length))), h('div', {}, h('span', {}, 'Última sincronização'), h('strong', {}, ((_a = b.data.last) === null || _a === void 0 ? void 0 : _a.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'Nunca')), h('div', {}, h('span', {}, 'Novas na última consulta'), h('strong', {}, String((_c = (_b = b.data.last) === null || _b === void 0 ? void 0 : _b.newCount) !== null && _c !== void 0 ? _c : '—')))), h('p', { className: 'muted-desc' }, 'O Meu Pluggy normalmente atualiza as informações em aproximadamente 24 horas. O botão consulta o último retrato disponível — não força uma atualização do banco.'), h('div', { className: 'info-box' }, h(Icon, { name: 'alert', size: 19 }), h('p', {}, 'Histórico bancário é independente dos lançamentos manuais e não entra automaticamente no saldo manual, nas categorias ou no simulador. Isso evita contar um mesmo gasto duas vezes.')), (b.data.items || []).map(x => h('div', { className: 'bank-item-info', key: x.itemId }, h('b', {}, x.institution || 'Conexão'), h('small', {}, 'Estado: ' + x.status), h('small', {}, 'Consentimento: ' + (x.consentExpiresAt ? new Date(x.consentExpiresAt).toLocaleDateString('pt-BR') : 'conforme seu banco')))))), accounts.length ? h('div', { className: 'bank-account-grid' }, accounts.map(a => h(Card, { className: 'bank-account', key: a.id }, h('div', { className: 'bank-account-icon' }, h(Icon, { name: 'bank', size: 22 })), h('small', {}, a.name + ' · ' + (a.subtype || 'Conta')), h('strong', {}, a.balance === null ? 'Saldo não disponível' : fmt(a.balance)), h('span', {}, 'Saldo informado pela instituição · não somado ao saldo manual')))) : null, h(Card, { className: 'table-card' }, h('div', { className: 'list-intro' }, h('div', {}, h('h2', {}, 'Movimentações bancárias'), h('p', {}, 'Histórico da Pluggy salvo localmente e independente dos registros manuais')), h(StyledSelect, { className: 'form-control bank-filter', value: this.state.bankFilter, options: [{ value: '', label: 'Todas as contas' }, ...accounts.map(a => ({ value: a.id, label: a.name }))], onChange: (value) => this.setState({ bankFilter: value }) })), h('div', { className: 'bank-month-stats' }, h('span', {}, 'Entradas confirmadas: ', h('strong', { className: 'good-text' }, fmt(income))), h('span', {}, 'Saídas confirmadas: ', h('strong', { className: 'bad-text' }, fmt(expense))), h('span', {}, 'Pendentes: ', h('strong', {}, String(filtered.length - posted.length)))), h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['DATA', 'DESCRIÇÃO', 'CONTA', 'CATEGORIA', 'STATUS', 'VALOR'].map(x => h('th', { key: x }, x)))), h('tbody', {}, filtered.length ? filtered.slice(0, 250).map(x => h('tr', { key: x.accountId + '|' + x.id }, h('td', {}, x.date.split('-').reverse().join('/')), h('td', {}, x.description), h('td', {}, x.accountName), h('td', {}, h(StyledSelect, { className: 'form-control inline-category', value: x.category, options: this.getCategories().map(c => ({ value: c.name, label: c.name })), onChange: (value) => this.setBankCategory(x, value) }), h('small', { className: 'muted' }, x.categorySource === 'manual' ? 'Manual' : x.categorySource === 'rule' ? 'Automática' : 'Original')), h('td', {}, h('span', { className: 'category-tag' }, x.status === 'POSTED' ? 'Confirmada' : 'Pendente')), h('td', { className: x.amount >= 0 ? 'good-text amount-cell' : 'bad-text amount-cell' }, (x.amount >= 0 ? '+' : '−') + fmt(Math.abs(x.amount))))) : h('tr', {}, h('td', { colSpan: 6, className: 'empty-table' }, c.configured ? 'Clique em Sincronizar agora para importar o extrato.' : 'Configure o Meu Pluggy para visualizar suas contas.')))))));
    }
    renderSettings() {
        const d = this.state.data;
        const entries = [['opening', 'Saldo inicial da conta', 'Saldo no início do acompanhamento.'], ['income', 'Renda mensal prevista', 'Use um valor conservador, sem depender de ganhos variáveis.'], ['fixed', 'Despesas fixas mensais', 'Contas recorrentes previstas, sem incluir parcelas abaixo.'], ['existing', 'Parcelas atuais por mês', 'Somatório de parcelas ainda em aberto.'], ['reserve', 'Reserva mínima protegida', 'Valor que deve permanecer disponível.']];
        return h('div', { className: 'section' }, h('div', { className: 'settings-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Seu perfil financeiro'), h('p', {}, 'Base utilizada nas projeções e recomendações'))), entries.map(([key, title, hint]) => h('div', { className: 'setting-row', key }, h('div', {}, h('b', {}, title), h('small', {}, hint)), h('button', { className: 'setting-edit', onClick: () => this.setState({ editModal: { type: 'setting', key, title, value: moneyString(d.settings[key]) } }) }, fmt(d.settings[key]), h(Icon, { name: 'edit', size: 16 }))))), h('div', { className: 'settings-right' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Privacidade e backups'), h('p', { className: 'muted-desc' }, desktop ? 'Dados em SQLite no Windows. O backup SQLite inclui categorias e regras. O JSON contém somente lançamentos, orçamentos e configurações manuais. As credenciais bancárias ficam fora de ambos.' : 'Dados guardados no navegador localmente. Faça backups regularmente.'), h('button', { className: 'outlined-action full', onClick: () => this.exportJSON() }, h(Icon, { name: 'download', size: 17 }), 'Exportar lançamentos JSON'), h('button', { className: 'outlined-action full', onClick: () => { var _a; return (_a = this.fileInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Restaurar lançamentos JSON'), desktop ? h('button', { className: 'outlined-action full', onClick: () => this.backupDB() }, h(Icon, { name: 'download', size: 17 }), 'Backup completo SQLite (inclui regras)') : null, desktop ? h('button', { className: 'outlined-action full', onClick: () => this.openDataDir() }, h(Icon, { name: 'bank', size: 17 }), 'Abrir pasta do banco') : null, h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Somente ao sincronizar, a Pluggy recebe suas credenciais de API. Seus lançamentos manuais não são enviados.')), h(Card, { className: 'settings-card' }, h('h2', {}, 'Modo de demonstração'), h('p', { className: 'muted-desc' }, 'O modo de demonstração tem transações fictícias e armazenamento separado dos seus dados pessoais.'), h('button', { className: 'outlined-action full', onClick: () => this.toggleMode() }, this.state.mode === 'real' ? 'Entrar na demonstração' : 'Voltar aos dados pessoais', h(Icon, { name: 'arrow', size: 16 }))))));
    }
    renderEditModal() { const item = this.state.editModal; if (!item)
        return null; return h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ editModal: null }); } }, h('div', { className: 'modal small-modal' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'PERSONALIZAÇÃO'), h('h2', {}, item.title)), h('button', { className: 'close-button', onClick: () => this.setState({ editModal: null }) }, '×')), this.field('Valor (R$)', h('input', { className: 'form-control', value: item.value, inputMode: 'decimal', autoFocus: true, onChange: (e) => this.setState({ editModal: { ...item, value: e.target.value } }) })), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ editModal: null }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => { if (item.type === 'budget')
            this.setBudget(item.key, item.value);
        else
            this.setSetting(item.key, item.value); this.setState({ editModal: null }); } }, h(Icon, { name: 'check', size: 18 }), 'Salvar alteração')))); }
    renderEntryModal() { const f = this.state.entry; return h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ showEntry: false }); } }, h('div', { className: 'modal' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'NOVO LANÇAMENTO'), h('h2', {}, 'Registrar movimentação')), h('button', { className: 'close-button', onClick: () => this.setState({ showEntry: false }) }, '×')), h('div', { className: 'segmented' }, ['expense', 'income'].map(k => h('button', { key: k, className: f.kind === k ? 'selected' : '', onClick: () => this.setState({ entry: { ...f, kind: k, category: this.state.entryCategoryTouched ? f.category : k === 'income' ? 'Salário' : 'Outros' } }) }, k === 'expense' ? 'Despesa' : 'Receita'))), this.field('Descrição', h('input', { className: 'form-control', placeholder: 'Ex.: supermercado', value: f.description, maxLength: 150, onChange: (e) => { const description = e.target.value; const category = this.state.entryCategoryTouched ? f.category : (findCategoryRule(description, 'manual', this.state.rules) || 'Outros'); this.setState({ entry: { ...f, description, category } }); } })), h('div', { className: 'two-inputs' }, this.field('Valor (R$)', h('input', { className: 'form-control', placeholder: '0,00', inputMode: 'decimal', value: f.value, onChange: (e) => this.setState({ entry: { ...f, value: e.target.value } }) })), this.field('Data', h(SingleDatePicker, { value: f.date, onChange: (value) => this.setState({ entry: { ...f, date: value } }) }))), this.field('Categoria', h(StyledSelect, { className: 'form-control', value: f.category, options: this.getCategories().map(c => ({ value: c.name, label: c.name })), onChange: (value) => this.setState({ entry: { ...f, category: value }, entryCategoryTouched: true }) })), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ showEntry: false }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => this.saveEntry() }, h(Icon, { name: 'check', size: 18 }), 'Salvar lançamento')))); }
    render() { if (this.state.fatal)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Erro ao abrir o banco de dados'), h('p', {}, this.state.fatal), h('p', {}, 'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.')); if (this.state.booting && desktop)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Meu Financeiro'), h('p', {}, 'Preparando a base SQLite local…')); return h('div', { className: 'shell' }, this.renderSide(), h('main', { className: 'main-area' }, this.renderTop(), this.state.mode === 'demo' ? h('div', { className: 'demo-strip' }, h(Icon, { name: 'spark', size: 17 }), 'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.', h('button', { onClick: () => this.toggleMode() }, 'Sair da demonstração')) : null, ({ overview: this.renderOverview, transactions: this.renderTransactions, budgets: this.renderBudgets, banks: this.renderBanks, categories: this.renderCategories, assistant: this.renderAssistant, simulator: this.renderSimulator, settings: this.renderSettings }[this.state.page] || this.renderOverview).call(this), h('footer', { className: 'footer' }, h('span', {}, desktop ? 'Meu Financeiro v0.6.1 · Electron · SQLite' : 'Meu Financeiro v0.6.1 · Prévia visual'), h('span', {}, 'Seus dados permanecem neste computador'))), this.state.toast ? h('div', { className: 'toast' }, h(Icon, { name: 'check', size: 17 }), this.state.toast) : null, this.state.showEntry ? this.renderEntryModal() : null, this.state.editModal ? this.renderEditModal() : null, h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, ref: (e) => this.fileInput = e, onChange: (e) => { var _a; if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0])
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
