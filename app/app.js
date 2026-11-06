const h = React.createElement;
const EMPTY_BANK = { config: { configured: false, clientId: '', itemIds: [], secure: false }, data: { accounts: [], transactions: [], items: [], last: null } };
const desktop = window.financeDesktop || null;
const CATS = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Compras', 'Contas', 'Outros'];
const COLORS = ['#884bff', '#bc80ff', '#db6ff5', '#7549d8', '#a58cf4', '#5b4da5', '#4a386f', '#7555bd', '#c090e5', '#3f375a'];
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
    var _a, _b;
    if (!v || typeof v !== 'object' || !Array.isArray(v.transactions))
        throw new Error('Arquivo inválido.');
    const d = starter();
    d.transactions = v.transactions.slice(0, 30000).map((r) => {
        const amount = Number(r.amount);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !['income', 'expense'].includes(r.kind) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000000 || typeof r.description !== 'string')
            throw new Error('Transação inválida.');
        return { id: String(r.id || Math.random()), date: r.date, kind: r.kind, description: r.description.slice(0, 180), amount, category: String(r.category || 'Outros').slice(0, 70), origin: 'restored' };
    });
    for (const c of CATS) {
        let b = Number(((_a = v.budgets) === null || _a === void 0 ? void 0 : _a[c]) || 0);
        d.budgets[c] = Number.isSafeInteger(b) && b >= 0 ? b : 0;
    }
    for (const key of ['opening', 'income', 'fixed', 'existing', 'reserve']) {
        const n = Number(((_b = v.settings) === null || _b === void 0 ? void 0 : _b[key]) || 0);
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
function snapshot(d, month) { const ts = d.transactions.filter(t => t.date.slice(0, 7) === month); const income = sum(ts, 'income'), expense = sum(ts, 'expense'); const bal = d.settings.opening + sum(d.transactions, 'income') - sum(d.transactions, 'expense'); const categories = CATS.map(cat => ({ name: cat, total: sum(ts.filter(t => t.category === cat), 'expense') })).filter(x => x.total > 0).sort((a, b) => b.total - a.total); return { income, expense, balance: bal, net: income - expense, categories }; }
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
    const paths = { home: 'M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z', wallet: 'M3 7h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h15v3H3m11 7h8', trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6', down: 'M3 7l6 6 4-4 8 8 M15 17h6v-6', calendar: 'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18', layers: 'M12 3 2 9l10 6 10-6-10-6z M2 13l10 6 10-6', cart: 'M3 4h2l3 12h11l3-9H6 M9 21h1 M18 21h1', pie: 'M12 2v10h10 M12 2a10 10 0 1 0 10 10', settings: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.2 2.2 M16.2 16.2l2.2 2.2 M18.4 5.6l-2.2 2.2 M7.8 16.2l-2.2 2.2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', plus: 'M12 5v14 M5 12h14', search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M17 17l5 5', check: 'M4 12l5 5L20 6', shield: 'M12 2l9 4v6c0 6-4.2 9.2-9 11-4.8-1.8-9-5-9-11V6z M8 12l3 3 5-6', chart: 'M4 20V12 M10 20V4 M16 20v-8 M22 20V8', download: 'M12 3v13 M7 11l5 5 5-5 M3 18v3h18v-3', upload: 'M12 21V8 M7 13l5-5 5 5 M3 5V3h18v2', trash: 'M4 6h16 M9 6V3h6v3 M7 8l1 13h8l1-13', arrow: 'M5 12h14 M13 6l6 6-6 6', alert: 'M12 3 2 21h20L12 3z M12 10v4 M12 18v0', edit: 'M3 21l5-.8L21 7 17 3 4 16z', filter: 'M3 4h18l-7 8v7l-4 2v-9z', clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2', spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z', bank: 'M2 10l10-7 10 7z M4 11v9 M10 11v9 M16 11v9 M22 21H2' };
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
    return h('svg', { className: 'chart-svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-label': 'Evolução mensal de receitas e despesas' }, h('defs', {}, h('linearGradient', { id: 'incFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: '#8349ff', stopOpacity: '.28' }), h('stop', { offset: '100%', stopColor: '#8349ff', stopOpacity: '0' })), h('linearGradient', { id: 'expFill', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '0%', stopColor: '#dc70ee', stopOpacity: '.2' }), h('stop', { offset: '100%', stopColor: '#dc70ee', stopOpacity: '0' }))), [0, .25, .5, .75, 1].map((a, i) => h('g', { key: 'g' + i }, h('line', { x1: l, y1: yy(max * a), x2: W - r, y2: yy(max * a), stroke: '#2c2c3c', strokeWidth: 1 }), h('text', { x: 0, y: yy(max * a) + 4, fill: '#76758d', fontSize: 11 }, (max * a / 100000).toFixed(0) + 'k'))), h('path', { d: getArea('income'), fill: 'url(#incFill)' }), h('path', { d: getArea('expense'), fill: 'url(#expFill)' }), h('path', { d: getPath('income'), fill: 'none', stroke: '#864aff', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }), h('path', { d: getPath('expense'), fill: 'none', stroke: '#d968ef', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }), vals.map((x, i) => h('g', { key: x.month }, h('text', { x: xx(i), y: H - 9, fill: '#9492ad', fontSize: 13, textAnchor: 'middle' }, monthShort(x.month)), h('circle', { cx: xx(i), cy: yy(x.income), r: 3, fill: '#a778ff' }))));
}
function Donut(p) {
    const vals = p.items;
    const total = vals.reduce((a, x) => a + x.total, 0);
    let deg = 0;
    const seg = vals.map((x, i) => { const start = deg; deg += x.total / Math.max(total, 1) * 360; return `${COLORS[CATS.indexOf(x.name) % COLORS.length] || COLORS[0]} ${start}deg ${deg}deg`; });
    return h('div', { className: 'donut-wrap' }, h('div', { className: 'donut', style: { background: total ? `conic-gradient(${seg.join(',')})` : 'conic-gradient(#2c2938 0 360deg)' } }, h('div', { className: 'donut-inner' }, h('b', {}, fmt(total)), h('small', {}, 'em despesas'))), h('div', { className: 'donut-legend' }, (total ? vals.slice(0, 5) : CATS.slice(0, 5).map(name => ({ name, total: 0 }))).map((v, i) => h('div', { className: 'legend-row', key: v.name }, h('span', { className: 'legend-text' }, h('i', { style: { background: COLORS[CATS.indexOf(v.name) % COLORS.length] } }), v.name), h('strong', {}, total ? Math.round(v.total * 100 / total) + '%' : '0%')))));
}
class App extends React.Component {
    constructor(props) { super(props); const mode = 'real'; this.state = { mode, data: desktop ? starter() : load(mode), page: 'overview', month: nowYM, showEntry: false, entry: { date: iso(new Date()), description: '', kind: 'expense', category: 'Alimentação', value: '' }, sim: { value: '', installments: '6', interest: '0' }, outcome: null, query: '', toast: '', budgetEdit: '', busy: !!desktop, booting: !!desktop, editModal: null, bank: EMPTY_BANK, bankForm: { clientId: '', clientSecret: '', itemIds: '' }, bankBusy: false, bankMessage: '', bankFilter: '' }; }
    async componentDidMount() {
        if (!desktop)
            return;
        try {
            const persisted = await desktop.load('real');
            this.setState({ data: persisted ? safeData(persisted) : starter(), busy: false, booting: false });
            await this.refreshBank();
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
        }
        catch (e) {
            this.setState({ bankMessage: 'Não foi possível consultar a integração: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
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
    async syncBank() {
        if (!desktop || this.state.mode === 'demo' || this.state.bankBusy)
            return;
        this.setState({ bankBusy: true, bankMessage: 'Consultando a Pluggy. Pode levar alguns instantes.' });
        try {
            const result = await desktop.bankSync();
            this.setState({ bank: result, bankBusy: false, bankMessage: 'Sincronização concluída: ' + result.newCount + ' novas e ' + result.totalCount + ' consultadas. Os lançamentos manuais foram preservados.' });
        }
        catch (e) {
            this.setState({ bankBusy: false, bankMessage: 'Sincronização não concluída: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) + '. O histórico anterior foi preservado.' });
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
        return this.flash('Informe um valor maior que zero.'); const t = { id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), date: f.date, description: f.description.trim().slice(0, 150), category: f.category, kind: f.kind, amount: v, origin: 'manual' }; this.updateData({ ...this.state.data, transactions: [...this.state.data.transactions, t] }, 'Lançamento registrado.'); this.setState({ showEntry: false, entry: { ...f, description: '', value: '' } }); }
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
                const tr = { id: 'csv-' + Date.now() + '-' + i, date, description, kind, amount: Math.abs(value), category: row[ca] || 'Outros', origin: 'csv' };
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
        return h('aside', { className: 'sidebar' }, h('div', { className: 'brand' }, h(Logo), h('div', { className: 'brand-text' }, h('strong', {}, 'Meu Financeiro'), h('small', {}, 'SEU DINHEIRO. MAIS INTELIGENTE.'))), h('div', { className: 'side-label' }, 'SEU ESPAÇO'), h('nav', {}, this.navItem('overview', 'home', 'Visão geral'), this.navItem('transactions', 'wallet', 'Transações'), this.navItem('budgets', 'pie', 'Orçamentos'), this.navItem('banks', 'bank', 'Open Finance'), this.navItem('assistant', 'cart', 'Assistente de compras'), this.navItem('simulator', 'calendar', 'Simulador de parcelas'), this.navItem('settings', 'settings', 'Configurações')), h('div', { className: 'side-bottom' }, h('div', { className: 'privacy-note' }, h(Icon, { name: 'shield', size: 19 }), h('div', {}, h('b', {}, 'Privado e local'), h('small', {}, desktop ? 'Base SQLite no computador' : 'Sem conexão bancária ou IA'))), h('button', { className: 'demo-btn', onClick: () => this.toggleMode() }, h(Icon, { name: this.state.mode === 'real' ? 'spark' : 'home', size: 18 }), this.state.mode === 'real' ? 'Explorar demonstração' : 'Voltar aos meus dados'), h('small', { className: 'app-version' }, desktop ? 'Meu Financeiro · v0.5 Electron' : 'Meu Financeiro · v0.5 Prévia')));
    }
    renderTop() { const labels = { overview: 'Visão geral', transactions: 'Transações', budgets: 'Orçamentos', assistant: 'Assistente de compras', simulator: 'Simulador de parcelas', settings: 'Configurações', banks: 'Open Finance' }; return h('header', { className: 'topbar' }, h('div', { className: 'top-left' }, h('div', { className: 'page-kicker' }, 'FINANÇAS PESSOAIS  /  ' + (labels[this.state.page] || '').toUpperCase()), h('h1', {}, labels[this.state.page]), h('p', {}, this.state.page === 'overview' ? 'Entenda seu mês e tome decisões com mais clareza.' : this.state.page === 'assistant' ? 'Antes de comprar, saiba o impacto real no seu futuro.' : 'Organize suas finanças com tranquilidade e autonomia.')), h('div', { className: 'header-actions' }, h('span', { className: 'mode-tag ' + (this.state.mode === 'demo' ? 'mode-demo' : '') }, h('i', {}), this.state.mode === 'demo' ? 'DEMONSTRAÇÃO' : (desktop ? 'SQLITE LOCAL' : 'DADOS LOCAIS')), h('label', { className: 'month-picker' }, h(Icon, { name: 'calendar', size: 17 }), h('input', { type: 'month', value: this.state.month, onChange: (e) => this.setState({ month: e.target.value }) })))); }
    renderOverview() {
        const d = this.state.data, month = this.state.month, s = snapshot(d, month), mdata = Array.from({ length: 6 }, (_, i) => { const ym = shiftMonth(month, i - 5); const snap = snapshot(d, ym); return { month: ym, income: snap.income, expense: snap.expense }; });
        const recent = d.transactions.filter(x => x.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        const spent = s.expense, totalBudget = CATS.reduce((a, k) => a + Number(d.budgets[k] || 0), 0), percent = totalBudget ? Math.round(spent / totalBudget * 100) : 0;
        return h('div', { className: 'overview-content' }, this.renderBankQuick(), h('div', { className: 'stats-grid' }, h(Stat, { label: 'Saldo manual', amount: s.balance, icon: 'wallet', hint: 'Saldo inicial + movimentações', featured: true }), h(Stat, { label: 'Receitas do mês', amount: s.income, icon: 'trend', hint: 'Entradas registradas', color: 'green' }), h(Stat, { label: 'Despesas do mês', amount: s.expense, icon: 'down', hint: 'Saídas registradas', color: 'pink' }), h(Stat, { label: 'Resultado mensal', amount: s.net, icon: 'chart', hint: 'Receitas menos despesas', color: 'purple' })), h('div', { className: 'mid-grid' }, h(Card, { className: 'flow-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Fluxo de caixa'), h('p', {}, 'Últimos seis meses')), h('div', { className: 'chart-legend' }, h('span', {}, h('i', { className: 'dot-purple' }), 'Receitas'), h('span', {}, h('i', { className: 'dot-pink' }), 'Despesas'))), h(Chart, { data: mdata })), h(Card, { className: 'donut-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Gastos por categoria'), h('p', {}, 'Onde seu dinheiro foi utilizado'))), h(Donut, { items: s.categories }))), h('div', { className: 'bottom-grid' }, h(Card, { className: 'recent-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Últimas movimentações'), h('p', {}, 'Histórico recente deste mês')), h('button', { className: 'text-button', onClick: () => this.navigate('transactions') }, 'Ver tudo ', h(Icon, { name: 'arrow', size: 16 }))), recent.length ? h('div', { className: 'mini-table' }, recent.map(t => h('div', { className: 'mini-row', key: t.id }, h('div', { className: 'mini-icon ' + (t.kind === 'income' ? 'good' : '') }, h(Icon, { name: t.kind === 'income' ? 'trend' : 'cart' })), h('div', { className: 'mini-copy' }, h('b', {}, t.description), h('small', {}, t.category + ' · ' + t.date.split('-').reverse().join('/'))), h('strong', { className: t.kind === 'income' ? 'good-text' : 'bad-text' }, (t.kind === 'income' ? '+' : '−') + fmt(t.amount))))) : h('div', { className: 'empty-mini' }, h(Icon, { name: 'wallet', size: 29 }), h('b', {}, 'Ainda sem movimentações'), h('span', {}, 'Cadastre sua primeira transação ou explore a demonstração.'), h('button', { className: 'mini-primary', onClick: () => this.setState({ showEntry: true }) }, 'Adicionar lançamento'))), h(Card, { className: 'budget-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Seu orçamento'), h('p', {}, 'Acompanhamento mensal')), h('span', { className: 'muted-label' }, totalBudget ? 'Limite definido' : 'Sem limites')), h('div', { className: 'budget-headline' }, h('div', {}, h('small', {}, 'Utilizado neste mês'), h('strong', {}, fmt(spent))), h('div', { className: 'budget-percent' }, totalBudget ? percent + '%' : '—')), h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { width: Math.min(100, percent) + '%' } })), h('div', { className: 'progress-foot' }, h('span', {}, totalBudget ? fmt(Math.max(0, totalBudget - spent)) + ' restantes' : 'Defina limites nas categorias'), h('span', {}, totalBudget ? fmt(totalBudget) + ' total' : '')), h('button', { className: 'outlined-action', onClick: () => this.navigate('budgets') }, 'Gerenciar orçamento', h(Icon, { name: 'arrow', size: 16 })))));
    }
    renderTransactions() {
        const d = this.state.data;
        const entries = d.transactions.filter(t => (!this.state.month || t.date.slice(0, 7) === this.state.month) && [t.description, t.category].some(x => x.toLowerCase().includes(this.state.query.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 500);
        return h('div', { className: 'section' }, h('div', { className: 'panel-toolbar' }, h('div', { className: 'search-box' }, h(Icon, { name: 'search', size: 18 }), h('input', { value: this.state.query, placeholder: 'Buscar estabelecimento ou categoria...', onChange: (e) => this.setState({ query: e.target.value }) })), h('div', { className: 'toolbar-actions' }, h('button', { className: 'ghost-button', onClick: () => { var _a; return (_a = this.csvInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Importar CSV'), h('button', { className: 'ghost-button', onClick: () => this.exportCSV() }, h(Icon, { name: 'download', size: 17 }), 'Exportar'), h('button', { className: 'primary-button', onClick: () => this.setState({ showEntry: true }) }, h(Icon, { name: 'plus', size: 18 }), 'Novo lançamento'))), h(Card, { className: 'table-card' }, h('div', { className: 'list-intro' }, h('div', {}, h('h2', {}, 'Histórico de transações'), h('p', {}, entries.length + ' lançamento(s) no período selecionado')), h('span', { className: 'caption-pill' }, prettyMonth(this.state.month))), h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'TIPO', 'VALOR', ''].map(n => h('th', { key: n }, n)))), h('tbody', {}, entries.length ? entries.map(t => h('tr', { key: t.id }, h('td', { className: 'muted' }, t.date.split('-').reverse().join('/')), h('td', { className: 'desc-cell' }, h('span', { className: 'tx-tiny-icon ' + (t.kind === 'income' ? 'income' : '') }, h(Icon, { name: t.kind === 'income' ? 'trend' : 'cart', size: 15 })), t.description), h('td', {}, h('span', { className: 'category-tag' }, t.category)), h('td', {}, h('span', { className: 'kind-pill ' + t.kind }, t.kind === 'income' ? 'Receita' : 'Despesa')), h('td', { className: t.kind === 'income' ? 'good-text amount-cell' : 'amount-cell' }, (t.kind === 'income' ? '+' : '−') + fmt(t.amount)), h('td', {}, h('button', { className: 'trash-button', title: 'Excluir', onClick: () => this.removeEntry(t.id) }, h(Icon, { name: 'trash', size: 16 }))))) : h('tr', {}, h('td', { colSpan: 6, className: 'empty-table' }, 'Nenhuma transação neste período.')))))));
    }
    renderBudgets() {
        const s = this.monthData(), d = this.state.data;
        return h('div', { className: 'section' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'PLANEJAMENTO'), h('h2', {}, 'Cada categoria no seu controle.'), h('p', {}, 'Defina um limite por categoria. Esses valores não movimentam seu saldo; servem apenas para acompanhar gastos.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'pie', size: 46 }))), h('div', { className: 'budget-grid' }, CATS.map((cat, i) => { var _a; const spent = ((_a = s.categories.find(x => x.name === cat)) === null || _a === void 0 ? void 0 : _a.total) || 0, limit = d.budgets[cat] || 0, pct = limit ? Math.round(spent / limit * 100) : 0; return h(Card, { className: 'budget-item', key: cat }, h('div', { className: 'budget-item-top' }, h('span', { className: 'cat-symbol', style: { background: COLORS[i] + '28', color: COLORS[i] } }, h(Icon, { name: ['home', 'cart', 'trend', 'shield', 'spark', 'layers', 'calendar', 'wallet', 'bank', 'pie'][i], size: 20 })), h('div', {}, h('h3', {}, cat), h('small', {}, 'Gasto atual: ' + fmt(spent)))), h('div', { className: 'budget-item-value' }, h('strong', {}, fmt(limit)), h('span', {}, 'limite mensal')), h('div', { className: 'progress-track' }, h('div', { className: 'progress-bar', style: { background: COLORS[i], width: Math.min(pct, 100) + '%' } })), h('div', { className: 'budget-item-bottom' }, h('span', { className: pct > 100 ? 'bad-text' : '' }, limit ? pct + '% utilizado' : 'Sem limite definido'), h('button', { className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: cat, title: 'Limite mensal · ' + cat, value: moneyString(limit) } }) }, 'Editar'))); })));
    }
    renderAssistant(includeBanner = true) {
        const d = this.state.data;
        const out = this.state.outcome;
        const examples = [{ name: 'Notebook', price: '3200', icon: 'wallet' }, { name: 'Celular', price: '2400', icon: 'cart' }, { name: 'Compra pequena', price: '350', icon: 'spark' }];
        return h('div', { className: 'section assistant-page' }, includeBanner ? h('div', { className: 'intro-banner assistant-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'DECISÕES MAIS CONSCIENTES'), h('h2', {}, 'Posso comprar isso agora?'), h('p', {}, 'Simule sem afetar seus lançamentos. O resultado considera renda, despesas, compromissos e reserva configurados.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'cart', size: 46 }))) : null, h('div', { className: 'assistant-grid' }, h(Card, { className: 'sim-form-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Sua próxima compra'), h('p', {}, 'Preencha os dados para analisar')), h('span', { className: 'round-purple' }, h(Icon, { name: 'spark', size: 19 }))), this.field('Valor do produto (R$)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.value, placeholder: 'Ex.: 1.499,90', onChange: (e) => this.setState({ sim: { ...this.state.sim, value: e.target.value } }) })), h('div', { className: 'two-inputs' }, this.field('Número de parcelas', h('select', { className: 'form-control', value: this.state.sim.installments, onChange: (e) => this.setState({ sim: { ...this.state.sim, installments: e.target.value } }) }, [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36].map(n => h('option', { value: String(n), key: n }, n === 1 ? 'À vista' : n + 'x')))), this.field('Juros ao mês (%)', h('input', { className: 'form-control', type: 'text', inputMode: 'decimal', value: this.state.sim.interest, onChange: (e) => this.setState({ sim: { ...this.state.sim, interest: e.target.value } }) }))), h('button', { className: 'primary-button full action-large', onClick: () => this.runSim() }, h(Icon, { name: 'spark', size: 18 }), 'Analisar compra'), h('div', { className: 'sim-example-title' }, 'Experimentar com um exemplo'), h('div', { className: 'quick-examples' }, examples.map(x => h('button', { className: 'quick-choice', onClick: () => this.setState({ sim: { ...this.state.sim, value: x.price }, outcome: null }), key: x.name }, h(Icon, { name: x.icon, size: 17 }), x.name)))), h('div', { className: 'result-column' }, out ? this.renderResult(out) : h(Card, { className: 'empty-result' }, h('span', { className: 'empty-result-icon' }, h(Icon, { name: 'shield', size: 40 })), h('h2', {}, 'Uma análise antes da decisão.'), h('p', {}, 'Descubra o peso da parcela, o custo total e como a compra pode afetar sua reserva financeira nos próximos meses.'), h('div', { className: 'result-steps' }, h('span', {}, '01  Simule'), h('span', {}, '02  Compare'), h('span', {}, '03  Decida'))), h('div', { className: 'info-box' }, h(Icon, { name: 'shield', size: 18 }), h('p', {}, 'A análise funciona por regras matemáticas, sem IA. Quando faltam dados, o aplicativo não afirma que uma compra é segura.')))));
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
        return h('div', { className: 'section bank-page' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'BANCO CONECTADO · LEITURA SOMENTE'), h('h2', {}, 'Seu extrato direto no Meu Financeiro.'), h('p', {}, 'Conecte via Meu Pluggy, sincronize e consulte os dados offline. Nunca informe senha bancária neste aplicativo.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'bank', size: 46 }))), h('div', { className: 'bank-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Conexão Meu Pluggy'), h('p', {}, c.configured ? 'Credenciais salvas e protegidas' : 'Configure sua conexão pessoal gratuita')), h('span', { className: 'bank-status ' + (c.configured ? 'enabled' : '') }, c.configured ? 'Configurada' : 'Não configurada')), !c.secure ? h('p', { className: 'bank-warning' }, 'A criptografia segura está indisponível neste sistema. Não salve credenciais.') : null, this.field('Client ID', h('input', { className: 'form-control', value: f.clientId, placeholder: 'Cole o Client ID do Dashboard', maxLength: 300, autoComplete: 'off', onChange: (e) => this.setState({ bankForm: { ...f, clientId: e.target.value } }) })), this.field('Client Secret', h('input', { className: 'form-control', type: 'password', value: f.clientSecret, placeholder: c.configured ? 'Já protegido — deixe vazio para manter' : 'Cole o Client Secret', maxLength: 1000, autoComplete: 'new-password', onChange: (e) => this.setState({ bankForm: { ...f, clientSecret: e.target.value } }) })), this.field('itemId (um ou mais, separados por vírgula)', h('textarea', { className: 'form-control bank-item-field', value: f.itemIds, rows: 2, placeholder: 'ID em Itens conectados no Pluggy Dashboard', onChange: (e) => this.setState({ bankForm: { ...f, itemIds: e.target.value } }) }), 'Não use a senha ou CPF do Itaú. Copie os IDs exibidos no Pluggy Dashboard.'), h('div', { className: 'bank-actions' }, h('button', { className: 'primary-button', disabled: !c.secure || this.state.bankBusy, onClick: () => this.configureBank() }, h(Icon, { name: 'shield', size: 17 }), 'Salvar proteção'), h('button', { className: 'outlined-action', disabled: !c.configured || this.state.bankBusy, onClick: () => this.syncBank() }, h(Icon, { name: 'download', size: 17 }), this.state.bankBusy ? 'Sincronizando…' : 'Sincronizar agora')), h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Segredo criptografado pelo Windows. Nunca incluído no SQLite, exportações ou GitHub.'), c.configured ? h('button', { className: 'bank-forget', onClick: () => this.forgetBank(), disabled: this.state.bankBusy }, 'Remover credenciais deste PC') : null, this.state.bankMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.bankMessage) : null), h(Card, { className: 'settings-card' }, h('h2', {}, 'Resumo da sincronização'), h('div', { className: 'bank-metric-list' }, h('div', {}, h('span', {}, 'Contas bancárias'), h('strong', {}, String(accounts.length))), h('div', {}, h('span', {}, 'Transações em cache'), h('strong', {}, String(tx.length))), h('div', {}, h('span', {}, 'Última sincronização'), h('strong', {}, ((_a = b.data.last) === null || _a === void 0 ? void 0 : _a.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'Nunca')), h('div', {}, h('span', {}, 'Novas na última consulta'), h('strong', {}, String((_c = (_b = b.data.last) === null || _b === void 0 ? void 0 : _b.newCount) !== null && _c !== void 0 ? _c : '—')))), h('p', { className: 'muted-desc' }, 'O Meu Pluggy normalmente atualiza as informações em aproximadamente 24 horas. O botão consulta o último retrato disponível — não força uma atualização do banco.'), h('div', { className: 'info-box' }, h(Icon, { name: 'alert', size: 19 }), h('p', {}, 'Histórico bancário é independente dos lançamentos manuais e não entra automaticamente no saldo manual, nas categorias ou no simulador. Isso evita contar um mesmo gasto duas vezes.')), (b.data.items || []).map(x => h('div', { className: 'bank-item-info', key: x.itemId }, h('b', {}, x.institution || 'Conexão'), h('small', {}, 'Estado: ' + x.status), h('small', {}, 'Consentimento: ' + (x.consentExpiresAt ? new Date(x.consentExpiresAt).toLocaleDateString('pt-BR') : 'conforme seu banco')))))), accounts.length ? h('div', { className: 'bank-account-grid' }, accounts.map(a => h(Card, { className: 'bank-account', key: a.id }, h('div', { className: 'bank-account-icon' }, h(Icon, { name: 'bank', size: 22 })), h('small', {}, a.name + ' · ' + (a.subtype || 'Conta')), h('strong', {}, a.balance === null ? 'Saldo não disponível' : fmt(a.balance)), h('span', {}, 'Saldo informado pela instituição · não somado ao saldo manual')))) : null, h(Card, { className: 'table-card' }, h('div', { className: 'list-intro' }, h('div', {}, h('h2', {}, 'Movimentações bancárias'), h('p', {}, 'Histórico da Pluggy salvo localmente e independente dos registros manuais')), h('select', { className: 'form-control bank-filter', value: this.state.bankFilter, onChange: (e) => this.setState({ bankFilter: e.target.value }) }, h('option', { value: '' }, 'Todas as contas'), accounts.map(a => h('option', { value: a.id, key: a.id }, a.name)))), h('div', { className: 'bank-month-stats' }, h('span', {}, 'Entradas confirmadas: ', h('strong', { className: 'good-text' }, fmt(income))), h('span', {}, 'Saídas confirmadas: ', h('strong', { className: 'bad-text' }, fmt(expense))), h('span', {}, 'Pendentes: ', h('strong', {}, String(filtered.length - posted.length)))), h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['DATA', 'DESCRIÇÃO', 'CONTA', 'STATUS', 'VALOR'].map(x => h('th', { key: x }, x)))), h('tbody', {}, filtered.length ? filtered.slice(0, 250).map(x => h('tr', { key: x.accountId + '|' + x.id }, h('td', {}, x.date.split('-').reverse().join('/')), h('td', {}, x.description), h('td', {}, x.accountName), h('td', {}, h('span', { className: 'category-tag' }, x.status === 'POSTED' ? 'Confirmada' : 'Pendente')), h('td', { className: x.amount >= 0 ? 'good-text amount-cell' : 'bad-text amount-cell' }, (x.amount >= 0 ? '+' : '−') + fmt(Math.abs(x.amount))))) : h('tr', {}, h('td', { colSpan: 5, className: 'empty-table' }, c.configured ? 'Clique em Sincronizar agora para importar o extrato.' : 'Configure o Meu Pluggy para visualizar suas contas.')))))));
    }
    renderSettings() {
        const d = this.state.data;
        const entries = [['opening', 'Saldo inicial da conta', 'Saldo no início do acompanhamento.'], ['income', 'Renda mensal prevista', 'Use um valor conservador, sem depender de ganhos variáveis.'], ['fixed', 'Despesas fixas mensais', 'Contas recorrentes previstas, sem incluir parcelas abaixo.'], ['existing', 'Parcelas atuais por mês', 'Somatório de parcelas ainda em aberto.'], ['reserve', 'Reserva mínima protegida', 'Valor que deve permanecer disponível.']];
        return h('div', { className: 'section' }, h('div', { className: 'settings-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Seu perfil financeiro'), h('p', {}, 'Base utilizada nas projeções e recomendações'))), entries.map(([key, title, hint]) => h('div', { className: 'setting-row', key }, h('div', {}, h('b', {}, title), h('small', {}, hint)), h('button', { className: 'setting-edit', onClick: () => this.setState({ editModal: { type: 'setting', key, title, value: moneyString(d.settings[key]) } }) }, fmt(d.settings[key]), h(Icon, { name: 'edit', size: 16 }))))), h('div', { className: 'settings-right' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Privacidade e backups'), h('p', { className: 'muted-desc' }, desktop ? 'Dados em SQLite no Windows. A conexão Pluggy consulta dados externos somente quando solicitada. Faça backups regularmente.' : 'Dados guardados no navegador localmente. Faça backups regularmente.'), h('button', { className: 'outlined-action full', onClick: () => this.exportJSON() }, h(Icon, { name: 'download', size: 17 }), 'Exportar backup JSON'), h('button', { className: 'outlined-action full', onClick: () => { var _a; return (_a = this.fileInput) === null || _a === void 0 ? void 0 : _a.click(); } }, h(Icon, { name: 'upload', size: 17 }), 'Restaurar backup JSON'), desktop ? h('button', { className: 'outlined-action full', onClick: () => this.backupDB() }, h(Icon, { name: 'download', size: 17 }), 'Salvar cópia do SQLite') : null, desktop ? h('button', { className: 'outlined-action full', onClick: () => this.openDataDir() }, h(Icon, { name: 'bank', size: 17 }), 'Abrir pasta do banco') : null, h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Somente ao sincronizar, a Pluggy recebe suas credenciais de API. Seus lançamentos manuais não são enviados.')), h(Card, { className: 'settings-card' }, h('h2', {}, 'Modo de demonstração'), h('p', { className: 'muted-desc' }, 'O modo de demonstração tem transações fictícias e armazenamento separado dos seus dados pessoais.'), h('button', { className: 'outlined-action full', onClick: () => this.toggleMode() }, this.state.mode === 'real' ? 'Entrar na demonstração' : 'Voltar aos dados pessoais', h(Icon, { name: 'arrow', size: 16 }))))));
    }
    renderEditModal() { const item = this.state.editModal; if (!item)
        return null; return h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ editModal: null }); } }, h('div', { className: 'modal small-modal' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'PERSONALIZAÇÃO'), h('h2', {}, item.title)), h('button', { className: 'close-button', onClick: () => this.setState({ editModal: null }) }, '×')), this.field('Valor (R$)', h('input', { className: 'form-control', value: item.value, inputMode: 'decimal', autoFocus: true, onChange: (e) => this.setState({ editModal: { ...item, value: e.target.value } }) })), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ editModal: null }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => { if (item.type === 'budget')
            this.setBudget(item.key, item.value);
        else
            this.setSetting(item.key, item.value); this.setState({ editModal: null }); } }, h(Icon, { name: 'check', size: 18 }), 'Salvar alteração')))); }
    renderEntryModal() { const f = this.state.entry; return h('div', { className: 'modal-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.setState({ showEntry: false }); } }, h('div', { className: 'modal' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'NOVO LANÇAMENTO'), h('h2', {}, 'Registrar movimentação')), h('button', { className: 'close-button', onClick: () => this.setState({ showEntry: false }) }, '×')), h('div', { className: 'segmented' }, ['expense', 'income'].map(k => h('button', { key: k, className: f.kind === k ? 'selected' : '', onClick: () => this.setState({ entry: { ...f, kind: k } }) }, k === 'expense' ? 'Despesa' : 'Receita'))), this.field('Descrição', h('input', { className: 'form-control', placeholder: 'Ex.: supermercado', value: f.description, maxLength: 150, onChange: (e) => this.setState({ entry: { ...f, description: e.target.value } }) })), h('div', { className: 'two-inputs' }, this.field('Valor (R$)', h('input', { className: 'form-control', placeholder: '0,00', inputMode: 'decimal', value: f.value, onChange: (e) => this.setState({ entry: { ...f, value: e.target.value } }) })), this.field('Data', h('input', { className: 'form-control', type: 'date', value: f.date, onChange: (e) => this.setState({ entry: { ...f, date: e.target.value } }) }))), this.field('Categoria', h('select', { className: 'form-control', value: f.category, onChange: (e) => this.setState({ entry: { ...f, category: e.target.value } }) }, ['Salário', ...CATS].map(c => h('option', { key: c, value: c }, c)))), h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ showEntry: false }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => this.saveEntry() }, h(Icon, { name: 'check', size: 18 }), 'Salvar lançamento')))); }
    render() { if (this.state.fatal)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Erro ao abrir o banco de dados'), h('p', {}, this.state.fatal), h('p', {}, 'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.')); if (this.state.booting && desktop)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Meu Financeiro'), h('p', {}, 'Preparando a base SQLite local…')); return h('div', { className: 'shell' }, this.renderSide(), h('main', { className: 'main-area' }, this.renderTop(), this.state.mode === 'demo' ? h('div', { className: 'demo-strip' }, h(Icon, { name: 'spark', size: 17 }), 'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.', h('button', { onClick: () => this.toggleMode() }, 'Sair da demonstração')) : null, ({ overview: this.renderOverview, transactions: this.renderTransactions, budgets: this.renderBudgets, banks: this.renderBanks, assistant: this.renderAssistant, simulator: this.renderSimulator, settings: this.renderSettings }[this.state.page] || this.renderOverview).call(this), h('footer', { className: 'footer' }, h('span', {}, desktop ? 'Meu Financeiro v0.5 · Electron · SQLite' : 'Meu Financeiro v0.5 · Prévia visual'), h('span', {}, 'Seus dados permanecem neste computador'))), this.state.toast ? h('div', { className: 'toast' }, h(Icon, { name: 'check', size: 17 }), this.state.toast) : null, this.state.showEntry ? this.renderEntryModal() : null, this.state.editModal ? this.renderEditModal() : null, h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, ref: (e) => this.fileInput = e, onChange: (e) => { var _a; if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0])
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
