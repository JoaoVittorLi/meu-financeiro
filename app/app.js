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
const D05_APPROVED_PARENTS = [{ "id": "cat:moradia", "name": "Moradia", "iconKey": "house", "hue": 264, "kind": "expense", "subcategories": [{ "id": "sub:moradia/aluguel", "parentId": "cat:moradia", "name": "Aluguel", "iconKey": "key", "hue": 252, "default": false }, { "id": "sub:moradia/condominio", "parentId": "cat:moradia", "name": "Condomínio", "iconKey": "building", "hue": 259, "default": false }, { "id": "sub:moradia/energia", "parentId": "cat:moradia", "name": "Energia elétrica", "iconKey": "zap", "hue": 268, "default": false }, { "id": "sub:moradia/agua", "parentId": "cat:moradia", "name": "Água e saneamento", "iconKey": "droplet", "hue": 275, "default": false }, { "id": "sub:moradia/internet", "parentId": "cat:moradia", "name": "Internet residencial", "iconKey": "wifi", "hue": 281, "default": false }, { "id": "sub:moradia/manutencao", "parentId": "cat:moradia", "name": "Manutenção da casa", "iconKey": "wrench", "hue": 287, "default": false }] }, { "id": "cat:alimentacao", "name": "Alimentação", "iconKey": "utensils", "hue": 26, "kind": "expense", "subcategories": [{ "id": "sub:alimentacao/supermercados", "parentId": "cat:alimentacao", "name": "Supermercados", "iconKey": "shopping-basket", "hue": 14, "default": false }, { "id": "sub:alimentacao/delivery", "parentId": "cat:alimentacao", "name": "Delivery", "iconKey": "bike", "hue": 21, "default": false }, { "id": "sub:alimentacao/restaurantes", "parentId": "cat:alimentacao", "name": "Restaurantes", "iconKey": "utensils", "hue": 30, "default": false }, { "id": "sub:alimentacao/cafeterias", "parentId": "cat:alimentacao", "name": "Cafeterias", "iconKey": "coffee", "hue": 37, "default": false }, { "id": "sub:alimentacao/feiras", "parentId": "cat:alimentacao", "name": "Feiras e hortifruti", "iconKey": "apple", "hue": 43, "default": false }] }, { "id": "cat:transporte", "name": "Transporte", "iconKey": "car-front", "hue": 205, "kind": "expense", "subcategories": [{ "id": "sub:transporte/combustivel", "parentId": "cat:transporte", "name": "Combustível", "iconKey": "fuel", "hue": 193, "default": false }, { "id": "sub:transporte/aplicativos", "parentId": "cat:transporte", "name": "Aplicativos de transporte", "iconKey": "car-taxi-front", "hue": 200, "default": false }, { "id": "sub:transporte/publico", "parentId": "cat:transporte", "name": "Transporte público", "iconKey": "bus-front", "hue": 209, "default": false }, { "id": "sub:transporte/estacionamento", "parentId": "cat:transporte", "name": "Estacionamento", "iconKey": "parking-square", "hue": 216, "default": false }, { "id": "sub:transporte/manutencao-veiculo", "parentId": "cat:transporte", "name": "Manutenção do veículo", "iconKey": "wrench", "hue": 222, "default": false }] }, { "id": "cat:saude", "name": "Saúde", "iconKey": "heart-pulse", "hue": 166, "kind": "expense", "subcategories": [{ "id": "sub:saude/farmacia", "parentId": "cat:saude", "name": "Farmácia", "iconKey": "pill", "hue": 154, "default": false }, { "id": "sub:saude/consultas", "parentId": "cat:saude", "name": "Consultas", "iconKey": "stethoscope", "hue": 161, "default": false }, { "id": "sub:saude/exames", "parentId": "cat:saude", "name": "Exames", "iconKey": "microscope", "hue": 170, "default": false }, { "id": "sub:saude/academia", "parentId": "cat:saude", "name": "Academia e atividade física", "iconKey": "dumbbell", "hue": 177, "default": false }] }, { "id": "cat:lazer", "name": "Lazer", "iconKey": "ticket", "hue": 332, "kind": "expense", "subcategories": [{ "id": "sub:lazer/cinema", "parentId": "cat:lazer", "name": "Cinema", "iconKey": "clapperboard", "hue": 320, "default": false }, { "id": "sub:lazer/jogos", "parentId": "cat:lazer", "name": "Jogos", "iconKey": "gamepad-2", "hue": 327, "default": false }, { "id": "sub:lazer/viagens", "parentId": "cat:lazer", "name": "Viagens", "iconKey": "plane", "hue": 336, "default": false }, { "id": "sub:lazer/eventos", "parentId": "cat:lazer", "name": "Eventos e passeios", "iconKey": "tickets", "hue": 343, "default": false }] }, { "id": "cat:educacao", "name": "Educação", "iconKey": "graduation-cap", "hue": 231, "kind": "expense", "subcategories": [{ "id": "sub:educacao/faculdade", "parentId": "cat:educacao", "name": "Faculdade", "iconKey": "graduation-cap", "hue": 219, "default": false }, { "id": "sub:educacao/cursos", "parentId": "cat:educacao", "name": "Cursos", "iconKey": "monitor-play", "hue": 226, "default": false }, { "id": "sub:educacao/livros", "parentId": "cat:educacao", "name": "Livros", "iconKey": "book-open", "hue": 235, "default": false }, { "id": "sub:educacao/material", "parentId": "cat:educacao", "name": "Material de estudo", "iconKey": "pencil-ruler", "hue": 242, "default": false }] }, { "id": "cat:assinaturas", "name": "Assinaturas", "iconKey": "repeat-2", "hue": 282, "kind": "expense", "subcategories": [{ "id": "sub:assinaturas/streaming", "parentId": "cat:assinaturas", "name": "Streaming de vídeo", "iconKey": "tv", "hue": 270, "default": false }, { "id": "sub:assinaturas/musica", "parentId": "cat:assinaturas", "name": "Música e áudio", "iconKey": "headphones", "hue": 277, "default": false }, { "id": "sub:assinaturas/software", "parentId": "cat:assinaturas", "name": "Software e aplicativos", "iconKey": "app-window", "hue": 286, "default": false }, { "id": "sub:assinaturas/nuvem", "parentId": "cat:assinaturas", "name": "Armazenamento em nuvem", "iconKey": "cloud", "hue": 293, "default": false }] }, { "id": "cat:compras", "name": "Compras", "iconKey": "shopping-bag", "hue": 37, "kind": "expense", "subcategories": [{ "id": "sub:compras/roupas", "parentId": "cat:compras", "name": "Roupas e acessórios", "iconKey": "shirt", "hue": 25, "default": false }, { "id": "sub:compras/eletronicos", "parentId": "cat:compras", "name": "Eletrônicos", "iconKey": "smartphone", "hue": 32, "default": false }, { "id": "sub:compras/presentes", "parentId": "cat:compras", "name": "Presentes", "iconKey": "gift", "hue": 41, "default": false }, { "id": "sub:compras/casa", "parentId": "cat:compras", "name": "Itens para casa", "iconKey": "lamp-desk", "hue": 48, "default": false }, { "id": "sub:compras/pets", "parentId": "cat:compras", "name": "Pets e animais", "iconKey": "paw-print", "hue": 54, "default": false }] }, { "id": "cat:contas", "name": "Contas", "iconKey": "receipt-text", "hue": 193, "kind": "expense", "subcategories": [{ "id": "sub:contas/telefonia", "parentId": "cat:contas", "name": "Telefonia", "iconKey": "phone", "hue": 181, "default": false }, { "id": "sub:contas/impostos", "parentId": "cat:contas", "name": "Impostos e tributos", "iconKey": "landmark", "hue": 188, "default": false }, { "id": "sub:contas/tarifas", "parentId": "cat:contas", "name": "Tarifas bancárias", "iconKey": "credit-card", "hue": 197, "default": false }, { "id": "sub:contas/seguros", "parentId": "cat:contas", "name": "Seguros", "iconKey": "shield-check", "hue": 204, "default": false }] }, { "id": "cat:outros", "name": "Outros", "iconKey": "shapes", "hue": 215, "kind": "both", "subcategories": [{ "id": "sub:outros/pequenas-despesas", "parentId": "cat:outros", "name": "Pequenas despesas", "iconKey": "coins", "hue": 203, "default": false }, { "id": "sub:outros/doacoes", "parentId": "cat:outros", "name": "Doações", "iconKey": "hand-heart", "hue": 210, "default": false }, { "id": "sub:outros/ajustes", "parentId": "cat:outros", "name": "Ajustes diversos", "iconKey": "sliders-horizontal", "hue": 219, "default": false }, { "id": "sub:outros/servicos", "parentId": "cat:outros", "name": "Serviços diversos", "iconKey": "package", "hue": 226, "default": false }] }, { "id": "cat:salario", "name": "Salário", "iconKey": "wallet", "hue": 151, "kind": "income", "subcategories": [{ "id": "sub:salario/fixo", "parentId": "cat:salario", "name": "Salário fixo", "iconKey": "wallet", "hue": 139, "default": false }, { "id": "sub:salario/horas-extras", "parentId": "cat:salario", "name": "Horas extras", "iconKey": "clock-3", "hue": 146, "default": false }, { "id": "sub:salario/comissoes", "parentId": "cat:salario", "name": "Comissões", "iconKey": "badge-percent", "hue": 155, "default": false }, { "id": "sub:salario/bonus", "parentId": "cat:salario", "name": "Bônus e gratificações", "iconKey": "award", "hue": 162, "default": false }] }, { "id": "cat:transferencias", "name": "Transferências", "iconKey": "arrow-left-right", "hue": 203, "kind": "both", "subcategories": [{ "id": "sub:transferencias/entre-contas", "parentId": "cat:transferencias", "name": "Entre contas próprias", "iconKey": "arrow-left-right", "hue": 191, "default": false }, { "id": "sub:transferencias/reserva", "parentId": "cat:transferencias", "name": "Para reserva própria", "iconKey": "piggy-bank", "hue": 198, "default": false }, { "id": "sub:transferencias/aportes", "parentId": "cat:transferencias", "name": "Aporte em investimentos", "iconKey": "chart-no-axes-combined", "hue": 207, "default": false }, { "id": "sub:transferencias/ajuste-interno", "parentId": "cat:transferencias", "name": "Ajuste entre contas", "iconKey": "refresh-cw", "hue": 214, "default": false }] }, { "id": "cat:rendimentos", "name": "Rendimentos", "iconKey": "trending-up", "hue": 135, "kind": "income", "subcategories": [{ "id": "sub:rendimentos/juros", "parentId": "cat:rendimentos", "name": "Juros", "iconKey": "percent", "hue": 123, "default": false }, { "id": "sub:rendimentos/dividendos", "parentId": "cat:rendimentos", "name": "Dividendos", "iconKey": "coins", "hue": 130, "default": false }, { "id": "sub:rendimentos/renda-fixa", "parentId": "cat:rendimentos", "name": "Renda fixa", "iconKey": "landmark", "hue": 139, "default": false }, { "id": "sub:rendimentos/aluguel-recebido", "parentId": "cat:rendimentos", "name": "Aluguel recebido", "iconKey": "house-plus", "hue": 146, "default": false }] }, { "id": "cat:reembolsos", "name": "Reembolsos", "iconKey": "rotate-ccw", "hue": 174, "kind": "income", "subcategories": [{ "id": "sub:reembolsos/estornos", "parentId": "cat:reembolsos", "name": "Estornos", "iconKey": "rotate-ccw", "hue": 162, "default": false }, { "id": "sub:reembolsos/devolucoes", "parentId": "cat:reembolsos", "name": "Devoluções de compras", "iconKey": "package-check", "hue": 169, "default": false }, { "id": "sub:reembolsos/reembolso-saude", "parentId": "cat:reembolsos", "name": "Reembolso de saúde", "iconKey": "heart-handshake", "hue": 178, "default": false }, { "id": "sub:reembolsos/reembolso-trabalho", "parentId": "cat:reembolsos", "name": "Reembolso de trabalho", "iconKey": "briefcase-business", "hue": 185, "default": false }] }];
const D05_APPROVED_GLYPHS = { "house": "<path d=\"m3 10 9-7 9 7v11H3V10Zm7 11v-7h4v7\"/>", "key": "<circle cx=\"7.5\" cy=\"15.5\" r=\"3.8\"/><path d=\"m10.3 12.7 9.3-9.3L22 6l-2.5 2.5 1.5 1.5-3 3-1.5-1.5-3.2 3.2\"/>", "building": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"1\"/><path d=\"M9 7h2m3 0h2M9 11h2m3 0h2M10 21v-5h4v5\"/>", "zap": "<path d=\"m13 2-9 12h7l-1 8 10-12h-7V2Z\"/>", "droplet": "<path d=\"M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z\"/>", "wifi": "<path d=\"M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01\"/>", "wrench": "<path d=\"M21 7a6 6 0 0 1-8 6L6 20a3 3 0 0 1-4-4l7-7a6 6 0 0 1 8-8l-4 4 5 5 3-3Z\"/>", "utensils": "<path d=\"M4 3v7M2 3v5c0 2 4 2 4 0V3M4 10v11M19 3c-3 3-4 7-4 10h4V3Zm0 10v8\"/>", "shopping-basket": "<path d=\"M3 10h18l-3 10H6L3 10ZM8 10l4-7 4 7M10 13l1 4m3-4-1 4\"/>", "bike": "<circle cx=\"5\" cy=\"17\" r=\"3.5\"/><circle cx=\"19\" cy=\"17\" r=\"3.5\"/><path d=\"m5 17 5-9 4 9H5m9 0 5-9M8 8h4m5 0h4\"/>", "coffee": "<path d=\"M5 7h12v7a6 6 0 0 1-12 0V7ZM17 9h2a2 2 0 0 1 0 4h-2M3 21h17\"/>", "apple": "<path d=\"M12 7c-2-3-8-3-9 3-1 5 2 11 6 11 1 0 2-1 3-1s2 1 3 1c4 0 7-6 6-11-1-6-7-6-9-3Zm0-1c0-3 2-4 5-4\"/>", "car-front": "<path d=\"m5 11 2-5h10l2 5M4 11h16v7H4v-7ZM6 18v2m12-2v2M7 14h2m6 0h2\"/>", "fuel": "<rect x=\"4\" y=\"4\" width=\"11\" height=\"17\" rx=\"2\"/><path d=\"M7 7h5v5H7V7ZM15 10h3l2 3v5a2 2 0 0 1-4 0\"/>", "car-taxi-front": "<path d=\"M7 6h10l2 5H5l2-5ZM4 11h16v7H4v-7ZM6 18v2m12-2v2M10 3h4M8 14h2m4 0h2\"/>", "bus-front": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"16\" rx=\"3\"/><path d=\"M5 11h14M8 15h2m4 0h2M8 19v2m8-2v2\"/>", "parking-square": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"M9 17V7h4a3 3 0 0 1 0 6H9\"/>", "heart-pulse": "<path d=\"M20.8 5.8a5 5 0 0 0-7.3 0L12 7.2l-1.5-1.4a5 5 0 0 0-7.3 7.3L12 22l8.8-8.9a5 5 0 0 0 0-7.3ZM4 13h4l2-4 3 7 2-3h5\"/>", "pill": "<path d=\"m4 13 9-9a5 5 0 0 1 7 7l-9 9a5 5 0 0 1-7-7Zm3-3 7 7\"/>", "stethoscope": "<path d=\"M6 3v7a5 5 0 0 0 10 0V3M4 3h4m6 0h4M11 15v2a4 4 0 0 0 8 0v-1\"/><circle cx=\"19\" cy=\"13\" r=\"2\"/>", "microscope": "<path d=\"m8 3 5 5m-2-7 5 5-4 4-5-5 4-4ZM9 10v4a4 4 0 0 0 8 0M4 21h16M12 18v3\"/>", "dumbbell": "<path d=\"m5 8 11 11M2 8l5-5M1 11l8-8m7 18 5-5m-8 6 9-9\"/>", "ticket": "<path d=\"M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5ZM12 5v14\" stroke-dasharray=\"3 2\"/>", "clapperboard": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M3 8V4l17-2 1 6M8 3l3 5m3-6 3 6\"/>", "gamepad-2": "<path d=\"M7 8h10c3 0 4 2 5 8 .5 3-2 4-4 2l-3-3H9l-3 3c-2 2-4.5 1-4-2 1-6 2-8 5-8ZM7 11v5m-2.5-2.5h5M16 12h.01M19 14h.01\"/>", "plane": "<path d=\"m2 16 20-11-7 17-4-8-9 2Zm9-2 5-5\"/>", "tickets": "<path d=\"M6 3h14v5a2 2 0 0 0 0 4v5H6v-5a2 2 0 0 0 0-4V3ZM3 7v14h13\"/>", "graduation-cap": "<path d=\"m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3 3 9 3 12 0v-5M22 9v7\"/>", "monitor-play": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m10 7 5 3-5 3V7ZM8 21h8m-4-4v4\"/>", "book-open": "<path d=\"M12 6c-4-3-7-3-10-2v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15\"/>", "pencil-ruler": "<path d=\"m3 18 12-12 3 3L6 21H3v-3ZM14 4l2-2 5 5-2 2M11 13l3 3m-1-7 3 3\"/>", "repeat-2": "<path d=\"M4 9V7a4 4 0 0 1 4-4h11l3 3-3 3M20 15v2a4 4 0 0 1-4 4H5l-3-3 3-3\"/>", "tv": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"m10 9 5 3-5 3V9ZM8 22h8\"/>", "headphones": "<path d=\"M3 14v-3a9 9 0 0 1 18 0v3M3 14h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5Z\"/>", "app-window": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"M3 8h18M7 6h.01M11 6h.01m-5 8h12m-12 4h8\"/>", "cloud": "<path d=\"M7 18h12a4 4 0 0 0 0-8 7 7 0 0 0-13-2A5 5 0 0 0 7 18Z\"/>", "shopping-bag": "<path d=\"M5 8h14l1 13H4L5 8ZM9 9V6a3 3 0 0 1 6 0v3\"/>", "shirt": "<path d=\"M8 3h8l5 4-3 5-3-2v11H9V10l-3 2-3-5 5-4Z\"/>", "smartphone": "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"3\"/><path d=\"M10 18h4M9 5h6\"/>", "gift": "<rect x=\"3\" y=\"10\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M12 10v11M3 14h18M3 6h18v4H3V6Zm9 0C8 1 5 2 6 5c1 2 5 1 6 1Zm0 0c4-5 7-4 6-1-1 2-5 1-6 1Z\"/>", "lamp-desk": "<path d=\"M3 21h18M8 21l4-8M12 13l-4-5 5-5 6 6-5 5-2-1ZM8 8l-3 3\"/>", "paw-print": "<path d=\"M8 12c2-2 6-2 8 0l3 4a4 4 0 0 1-5 5c-2-1-3-1-4 0a4 4 0 0 1-5-5l3-4Z\"/><circle cx=\"5\" cy=\"9\" r=\"1.5\"/><circle cx=\"10\" cy=\"5\" r=\"1.5\"/><circle cx=\"15\" cy=\"5\" r=\"1.5\"/><circle cx=\"20\" cy=\"9\" r=\"1.5\"/>", "receipt-text": "<path d=\"M5 2h14v20l-3-2-4 2-4-2-3 2V2ZM8 7h8M8 11h8M8 15h5\"/>", "phone": "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"3\"/><path d=\"M11 19h2M9 5h6\"/>", "landmark": "<path d=\"m2 9 10-6 10 6H2Zm2 3h16M6 12v7m4-7v7m4-7v7m4-7v7M2 21h20\"/>", "credit-card": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"3\"/><path d=\"M2 10h20M6 15h5\"/>", "shield-check": "<path d=\"m12 2 9 4v5c0 5-3 9-9 11-6-2-9-6-9-11V6l9-4Zm-4 10 3 3 5-5\"/>", "shapes": "<rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"2\"/><circle cx=\"17\" cy=\"7\" r=\"4\"/><path d=\"m3 21 5-8 5 8H3Zm13-8 5 8h-10l5-8Z\"/>", "coins": "<circle cx=\"9\" cy=\"10\" r=\"6\"/><path d=\"M11 7c-3-2-5 2-2 3 4 1 2 5-1 3m1-8v10M16 13a6 6 0 1 1-5 8\"/>", "hand-heart": "<path d=\"M12 11c-3-3-7 1-4 4l4 4 4-4c3-3-1-7-4-4ZM2 15h5l3 5h9l3-4M2 19h5\"/>", "sliders-horizontal": "<path d=\"M3 6h18M3 12h18M3 18h18\"/><circle cx=\"8\" cy=\"6\" r=\"2\" fill=\"currentColor\" stroke=\"var(--bg)\"/><circle cx=\"16\" cy=\"12\" r=\"2\" fill=\"currentColor\" stroke=\"var(--bg)\"/><circle cx=\"10\" cy=\"18\" r=\"2\" fill=\"currentColor\" stroke=\"var(--bg)\"/>", "package": "<path d=\"m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10\"/>", "wallet": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"15\" rx=\"3\"/><path d=\"M3 10h18M16 15h5M5 6V4h13\"/>", "clock-3": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/>", "badge-percent": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8 16 8-8M8 8h.01M16 16h.01\"/>", "award": "<circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"m8 13-2 9 6-3 6 3-2-9\"/>", "arrow-left-right": "<path d=\"M3 7h18m-5-4 5 4-5 4M21 17H3m5-4-5 4 5 4\"/>", "piggy-bank": "<path d=\"M5 10a8 8 0 0 1 15 2l2 1v4l-3 1-2 3h-3l-1-2h-4l-1 2H5l-1-4-2-2v-3l3-1ZM9 8V6h5\"/><circle cx=\"17\" cy=\"12\" r=\".6\"/>", "chart-no-axes-combined": "<path d=\"M3 21V4m0 17h18M5 17l6-7 4 4 6-8M16 6h5v5\"/>", "refresh-cw": "<path d=\"M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6M4 13a8 8 0 0 0 14 5l3-3m0 6v-6h-6\"/>", "trending-up": "<path d=\"M3 18l6-6 4 3 8-9M15 6h6v6\"/>", "percent": "<path d=\"M4 20 20 4\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/>", "house-plus": "<path d=\"m3 10 9-7 9 7v11H3V10Zm7 11v-7h4v7M8 9h8m-4-4v8\"/>", "rotate-ccw": "<path d=\"M3 11a9 9 0 1 1 2 7M3 4v7h7\"/>", "package-check": "<path d=\"m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10m2 3 2 2 4-4\"/>", "heart-handshake": "<path d=\"M12 20 4 12a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8Zm-5-9 4 3 2-2 4 3\"/>", "briefcase-business": "<rect x=\"3\" y=\"7\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M8 7V4h8v3M3 13h18m-11 0v3h4v-3\"/>" };
function D05VectorIcon(props) {
    const key = props.iconKey && Object.prototype.hasOwnProperty.call(D05_APPROVED_GLYPHS, props.iconKey) ? props.iconKey : 'circle-dot';
    const markup = D05_APPROVED_GLYPHS[key] || '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>';
    return React.createElement('span', { className: 'd05-icon-wrapper',
        style: { '--d05-hue': String(Number.isInteger(props.hue) ? props.hue : 155) },
        'aria-label': props.label || undefined, 'aria-hidden': props.label ? undefined : 'true' }, React.createElement('svg', { viewBox: '0 0 24 24', width: props.size || 22, height: props.size || 22,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round',
        focusable: 'false', role: 'img', 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: markup } }));
}
function D05ApprovedParent(name) {
    return D05_APPROVED_PARENTS.find(p => p.name === name) || null;
}
function qa84LegacyName(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLocaleLowerCase('pt-BR');
}
function qa84SafeHue(value, fallback = 215) {
    return Number.isInteger(value) && value >= 0 && value <= 360 ? value : fallback;
}
function qa84SafeIcon(value, fallback = 'shapes') {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(D05_APPROVED_GLYPHS, value) ? value : fallback;
}
function resolveCategoryVisualIdentity(input = {}) {
    var _a;
    const approved = D05_APPROVED_PARENTS;
    const customized = (Array.isArray(input.catalog) ? input.catalog : []).filter((p) => (p === null || p === void 0 ? void 0 : p.id) &&
        !approved.some((native) => native.id === p.id));
    const all = approved.concat(customized);
    const requestedId = typeof input.categoryId === 'string' && input.categoryId ? input.categoryId : null;
    const requestedChild = typeof input.subcategoryId === 'string' && input.subcategoryId ? input.subcategoryId : null;
    const rawLabel = String(input.categoryName || '').trim();
    let p = requestedId ? all.find((x) => x.id === requestedId) : null;
    const resolvedByLegacy = !requestedId && !!rawLabel;
    if (!requestedId && rawLabel)
        p = all.find((x) => qa84LegacyName(x.name) === qa84LegacyName(rawLabel));
    if (!p && requestedId && ((_a = input.custom) === null || _a === void 0 ? void 0 : _a.id) === requestedId)
        p = input.custom;
    const defaultParent = approved.find((x) => x.id === 'cat:outros');
    if (!p) {
        return Object.freeze({ categoryId: (defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent.id) || 'cat:outros', subcategoryId: null, source: 'fallback',
            label: rawLabel || 'Categoria não identificada', parentLabel: rawLabel || 'Categoria não identificada',
            iconKey: qa84SafeIcon(defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent.iconKey), hue: qa84SafeHue(defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent.hue),
            kind: 'unknown' });
    }
    const builtin = approved.some((x) => x.id === p.id);
    const custom = !builtin;
    const selectedChild = !input.aggregate && requestedChild && Array.isArray(p.subcategories) ?
        p.subcategories.find((c) => c.id === requestedChild &&
            (c.parentId === p.id || c.parentCategoryId === p.id) && c.active !== 0) : null;
    const visual = selectedChild || p;
    const label = String(visual.name || p.name || rawLabel || 'Categoria');
    const kind = ['income', 'expense', 'both'].includes(String(p.kind)) ? p.kind : 'unknown';
    return Object.freeze({ categoryId: String(p.id), subcategoryId: selectedChild ? String(selectedChild.id) : null,
        source: selectedChild ? 'sub' : custom ? 'custom' : resolvedByLegacy ? 'legacy' : 'parent',
        label, parentLabel: String(p.name || label),
        iconKey: qa84SafeIcon(visual.iconKey), hue: qa84SafeHue(visual.hue),
        kind: kind });
}
function CategoryVisualGlyph(props) {
    const d = props.identity;
    const icon = h('span', { className: 'qa84-category-glyph',
        style: { '--qa-cat-hue': String(d.hue) } }, h(D05VectorIcon, { iconKey: d.iconKey, hue: d.hue, size: props.size || 20 }));
    if (props.variant === 'iconLabel')
        return h('span', { className: 'qa84-category-combo' }, icon, h('span', {}, d.label));
    return icon;
}
function qa84B03Visual(input, parents = D05_APPROVED_PARENTS) {
    return resolveCategoryVisualIdentity({ ...input, catalog: parents });
}
function qa84B04Fold(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}
function qa84B04Search(parents, term) {
    const q = qa84B04Fold(term);
    return parents.map((parent) => {
        const matchesParent = !q || qa84B04Fold(parent.name).includes(q);
        const children = matchesParent ? [] : (parent.subcategories || []).filter((x) => qa84B04Fold(x.name).includes(q));
        return { parent, children };
    }).filter((entry) => !q || qa84B04Fold(entry.parent.name).includes(q) || entry.children.length > 0);
}
function qa84B04Geometry(rect, viewport) {
    const width = Math.max(240, Math.min(730, viewport.width - 24));
    const below = viewport.height - ((rect === null || rect === void 0 ? void 0 : rect.bottom) || 0), above = (rect === null || rect === void 0 ? void 0 : rect.top) || 0;
    const top = below >= 290 ? Math.max(12, rect.bottom + 7) : above >= 290 ?
        Math.max(12, Math.min(viewport.height - 290, above - 290)) : 12;
    const left = rect && rect.left + width <= viewport.width - 12 ?
        Math.max(12, rect.left) : Math.max(12, Math.floor((viewport.width - width) / 2));
    return { left, top, width };
}
function qa84B04Fingerprint(row) {
    if (!row)
        return '';
    return JSON.stringify([row.source, row.accountId || '', row.id, row.date, row.amount,
        row.status || '', row.kind || '', row.categoryId || null, row.subcategoryId || null,
        row.category || '']);
}
function qa84B03RequestDrawerPicker(event, source, id, accountId) {
    var _a;
    if (!(event === null || event === void 0 ? void 0 : event.currentTarget) || !id)
        return;
    (_a = event.stopPropagation) === null || _a === void 0 ? void 0 : _a.call(event);
    window.dispatchEvent(new CustomEvent('mf2:d05:open-picker', { detail: {
            source, id, accountId: accountId || '', trigger: event.currentTarget
        } }));
}
function qa84ExpenseDistribution(categories, expenseCents) {
    const total = Number.isSafeInteger(expenseCents) && expenseCents >= 0 ? expenseCents : 0;
    const rows = (categories || []).filter(x => x && typeof x.name === 'string' &&
        Number.isSafeInteger(x.total) && x.total > 0).map(x => ({ name: x.name, total: x.total, isRemainder: false }));
    const sum = rows.reduce((n, x) => n + x.total, 0);
    if (!total)
        return { status: sum ? 'inconsistent' : 'empty', total, rows: [], classified: sum };
    if (sum > total)
        return { status: 'inconsistent', total, rows: [], classified: sum };
    if (sum < total)
        rows.push({ name: 'Sem categoria identificada', total: total - sum, isRemainder: true });
    const fractional = rows.map((row, i) => ({ ...row, i, raw: 1000 * row.total / total, units: Math.floor(1000 * row.total / total) }));
    let remaining = 1000 - fractional.reduce((n, r) => n + r.units, 0);
    const ranked = fractional.slice().sort((a, b) => (b.raw - b.units) - (a.raw - a.units) || a.i - b.i);
    for (let i = 0; i < remaining; i++)
        ranked[i % ranked.length].units++;
    const out = fractional.map(({ name, total: amount, isRemainder, units }) => ({ name, total: amount, isRemainder, units, percent: units / 10 }));
    return { status: 'ok', total, rows: out, classified: sum };
}
function renderQA84OverviewCategories(host, categories, totalCents, bankSource, hidden) {
    const state = host.state, model = qa84ExpenseDistribution(categories, totalCents);
    if (model.status === 'empty')
        return h('p', { className: 'u1-empty' }, 'Nenhuma despesa nesta fonte e período.');
    if (model.status === 'inconsistent')
        return h('p', { className: 'qa84-data-warning', role: 'alert' }, 'Os totais de categorias não coincidem com o total de despesas. Distribuição suspensa até atualização dos dados.');
    const ranked = model.rows.slice().sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
    const all = !!state.qa84OverviewExpanded, shown = all ? ranked : ranked.slice(0, 5);
    const max = Math.max(1, ...ranked.map(x => x.total));
    const catalog = state.qa84VisualCatalog || [];
    const visual = (row) => row.isRemainder ?
        resolveCategoryVisualIdentity({ categoryName: row.name }) :
        resolveCategoryVisualIdentity({ categoryName: row.name, catalog, aggregate: true });
    const selected = state.qa84OverviewSelected || null;
    const pick = (row) => host.setState({ qa84OverviewSelected: selected === row.name ? null : row.name });
    const toTransactions = (name) => {
        if (name === 'Sem categoria identificada')
            return;
        const span = dateSpan(state.overviewPeriod, state.customStart, state.customEnd);
        host.setState({ query: '', bankFilter: '', txSource: bankSource ? 'bank' : 'manual', txReviewOnly: false,
            txOrganize: false, txCategoryFilter: name, qa84TransactionsSpan: span, qa84TransactionsCategory: name });
        host.navigate('transactions');
    };
    return h('div', { className: 'qa84-overview-breakdown', role: 'region', 'aria-label': 'Distribuição real dos gastos' }, hidden ? h('div', { className: 'qa84-dist-masked', role: 'status' }, 'Distribuição oculta para proteger seus valores') :
        h('div', { className: 'qa84-distribution', 'aria-label': 'Faixa de distribuição por categoria' }, ranked.map(row => {
            const identity = visual(row);
            return h('button', { key: row.name, type: 'button', className: 'qa84-distribution-segment' + (selected === row.name ? ' is-selected' : ''),
                style: { width: row.percent + '%', '--qa-cat-hue': identity.hue },
                'aria-label': row.name + ' · ' + row.percent.toFixed(1) + '% · ' + fmt(row.total),
                'aria-pressed': selected === row.name, title: row.name + ' · ' + row.percent.toFixed(1) + '%',
                onClick: () => pick(row) }, h('span', { className: 'qa84-sr-only' }, row.name));
        })), h('div', { className: 'qa84-distribution-list' }, shown.map(row => {
        const identity = visual(row), active = selected === row.name;
        return h('button', { type: 'button', key: row.name,
            className: 'qa84-category-row' + (active ? ' is-selected' : ''),
            style: { '--qa-cat-hue': identity.hue },
            'aria-pressed': active, 'aria-label': row.name + (hidden ? ' · valores ocultos' : ' · ' + fmt(row.total) + ' · ' + row.percent.toFixed(1) + '%'),
            onClick: () => pick(row) }, h('span', { className: 'qa84-category-name-cell' }, h(CategoryVisualGlyph, { identity, size: 19 }), h('span', { className: 'qa84-category-name' }, row.name)), h('span', { className: 'qa84-category-track', 'aria-hidden': 'true' }, h('i', { style: { width: hidden ? '0%' : (row.total / max * 100) + '%' } })), h('strong', { className: 'qa84-category-money' }, hidden ? '••••' : fmt(row.total)), h('small', { className: 'qa84-category-percent' }, hidden ? '••••' : row.percent.toFixed(1) + '%'));
    })), selected ? h('div', { className: 'qa84-breakdown-selection', role: 'status' }, h('span', {}, 'Selecionada: ' + selected), selected !== 'Sem categoria identificada' ? h('button', { type: 'button',
        onClick: () => toTransactions(selected) }, 'Ver movimentações', h(Icon, { name: 'arrow', size: 13 })) : null) : null, ranked.length > 5 ? h('button', { type: 'button', className: 'qa84-breakdown-toggle',
        'aria-expanded': all, onClick: () => host.setState({ qa84OverviewExpanded: !all }) }, all ? 'Mostrar menos categorias' : 'Mostrar todas as ' + ranked.length + ' categorias', h(Icon, { name: all ? 'chevron-up' : 'chevron-down', size: 14 })) : null, model.classified < totalCents ? h('p', { className: 'qa84-breakdown-note', role: 'status' }, 'Existe valor sem categoria identificada. Ele está incluído na distribuição, sem criar classificação nova.') : null);
}
function qa84BudgetStatus(spent, limit, hasLimit) {
    const valid = Number.isSafeInteger(spent) && spent >= 0 ? spent : 0;
    if (!hasLimit)
        return { status: 'unlimited', hasLimit: false, spent: valid, limit: null, remaining: null, usedPercent: null, arcPercent: 0 };
    if (!Number.isSafeInteger(limit) || limit === null || limit < 0)
        throw Error('Limite inválido');
    if (limit === 0)
        return { status: 'zero', hasLimit: true, spent: valid, limit: 0, remaining: -valid, usedPercent: null, arcPercent: 0 };
    const ratio = valid / limit, percent = 100 * ratio;
    return { status: ratio > 1 ? 'exceeded' : ratio >= .9 ? 'near' : 'within', hasLimit: true,
        spent: valid, limit, remaining: limit - valid, usedPercent: percent, arcPercent: Math.min(100, percent) };
}
function qa84BudgetLegs(raw, source, start, end) {
    const legs = [];
    for (const t of raw || []) {
        if (!t || typeof t.date !== 'string' || t.date < start || t.date > end)
            continue;
        if (source === 'bank') {
            if (t.status !== 'POSTED')
                continue;
            const nature = t.nature && t.nature !== 'auto' ? t.nature : t.amount < 0 ? 'expense' : 'income';
            if (nature !== 'expense')
                continue;
            const amount = Math.abs(t.amount);
            if (!Number.isSafeInteger(amount) || amount <= 0)
                continue;
            const splits = Array.isArray(t.splits) && t.splits.length && !t.splitOutdated ? t.splits : null;
            const parts = splits || [{ category: t.category, categoryId: t.categoryId || null, subcategoryId: t.subcategoryId || null, amount }];
            for (const [index, part] of parts.entries()) {
                if (!Number.isSafeInteger(part.amount) || part.amount <= 0)
                    continue;
                legs.push({ key: JSON.stringify([t.accountId, t.id, index]), id: String(t.id),
                    accountId: String(t.accountId), date: t.date,
                    description: String(t.customTitle || t.merchant || t.description || 'Movimentação bancária'), amount: part.amount,
                    category: String(part.category || t.category || ''), categoryId: part.categoryId || null,
                    subcategoryId: part.subcategoryId || null });
            }
        }
        else {
            if (t.kind !== 'expense' || !Number.isSafeInteger(t.amount) || t.amount <= 0)
                continue;
            legs.push({ key: 'manual|' + t.id, id: String(t.id), accountId: null, date: t.date,
                description: String(t.description || 'Lançamento manual'), amount: t.amount,
                category: String(t.category || ''), categoryId: t.categoryId || null,
                subcategoryId: t.subcategoryId || null });
        }
    }
    return legs;
}
function qa84BudgetDetails(legs, parentName, authoritativeCents, catalog = [], truncated = false) {
    const parent = resolveCategoryVisualIdentity({ categoryName: parentName, catalog, aggregate: true });
    const grouped = new Map();
    let invalid = 0;
    for (const leg of legs) {
        const identity = resolveCategoryVisualIdentity({ categoryId: leg.categoryId,
            subcategoryId: leg.subcategoryId, categoryName: leg.category, catalog, aggregate: true });
        if (identity.categoryId !== parent.categoryId || identity.parentLabel !== parent.parentLabel)
            continue;
        const validChild = leg.subcategoryId === null ? null :
            resolveCategoryVisualIdentity({ categoryId: leg.categoryId || parent.categoryId,
                subcategoryId: leg.subcategoryId, catalog });
        if (leg.subcategoryId && !(validChild === null || validChild === void 0 ? void 0 : validChild.subcategoryId)) {
            invalid++;
            continue;
        }
        const id = leg.subcategoryId || null, key = id || '__null__';
        const group = grouped.get(key) || { subcategoryId: id, total: 0, count: 0, rows: [] };
        group.total += leg.amount;
        group.count++;
        group.rows.push(leg);
        grouped.set(key, group);
    }
    const groups = [...grouped.values()].sort((a, b) => b.total - a.total || String(a.subcategoryId).localeCompare(String(b.subcategoryId)));
    const displayed = groups.reduce((n, g) => n + g.total, 0);
    const complete = !truncated && !invalid && Number.isSafeInteger(authoritativeCents) && displayed === authoritativeCents;
    const reason = invalid ? 'Algumas classificações de subcategoria não correspondem à categoria principal.' :
        truncated ? 'O histórico detalhado está incompleto.' :
            displayed !== authoritativeCents ? 'O histórico detalhado não coincide com o total consolidado.' : '';
    return { groups, total: displayed, complete, gap: authoritativeCents - displayed, reason };
}
function qa84Ring(value, tone, center, caption, size = 'large') {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    return h('div', { className: 'qa84-orbit qa84-orbit-' + size + ' tone-' + tone, role: 'img',
        'aria-label': caption, style: { '--qa84-arc': String(clamped) } }, h('svg', { viewBox: '0 0 120 120', className: 'qa84-orbit-svg', 'aria-hidden': 'true', focusable: 'false' }, h('circle', { cx: 60, cy: 60, r: 49, className: 'qa84-orbit-track' }), h('circle', { cx: 60, cy: 60, r: 49, className: 'qa84-orbit-fill', pathLength: 100,
        strokeDasharray: clamped + ' 100', transform: 'rotate(-90 60 60)' })), h('div', { className: 'qa84-orbit-center' }, h('strong', {}, center), h('small', {}, caption)));
}
function qa84BudgetOpen(host, categoryName, mode, useBank) {
    var _a;
    const scroll = window.scrollY || 0, month = host.state.month;
    host.setState({ qa84BudgetDrill: { categoryName, mode, bank: useBank, month, subcategoryId: null, showChild: false,
            returnScroll: scroll }, qa84BudgetLoading: true, qa84BudgetReadError: '', qa84BudgetPage: 0,
        qa84BudgetShowAll: false, qa84BudgetRows: [], qa84BudgetPartial: true }, () => void qa84BudgetRefresh(host));
    (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
async function qa84BudgetRefresh(host) {
    var _a, _b, _c, _d, _e, _f;
    const drill = host.state.qa84BudgetDrill;
    if (!drill)
        return;
    const bridge = window.financeDesktop || null;
    const currentKey = JSON.stringify([drill.categoryName, drill.month, drill.bank, host.state.mode]);
    const source = drill.bank ? 'bank' : 'manual';
    try {
        let result;
        if (drill.bank) {
            if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05BankList))
                throw Error('Consulta bancária hierárquica indisponível no processo principal.');
            result = await bridge.d05BankList({ limit: 2500 });
        }
        else if (bridge === null || bridge === void 0 ? void 0 : bridge.d05ManualList) {
            result = await bridge.d05ManualList({ profile: host.state.mode, limit: 2500 });
        }
        else if (host.state.mode === 'demo') {
            result = { items: host.state.data.transactions, truncated: false };
        }
        else {
            throw Error('Consulta manual hierárquica indisponível no processo principal.');
        }
        if (!result || !Array.isArray(result.items))
            throw Error('Resposta de histórico inválida.');
        if (JSON.stringify([(_a = host.state.qa84BudgetDrill) === null || _a === void 0 ? void 0 : _a.categoryName, (_b = host.state.qa84BudgetDrill) === null || _b === void 0 ? void 0 : _b.month, (_c = host.state.qa84BudgetDrill) === null || _c === void 0 ? void 0 : _c.bank, host.state.mode]) !== currentKey)
            return;
        const legs = qa84BudgetLegs(result.items, source, firstOfMonth(drill.month), endOfMonth(drill.month));
        host.setState({ qa84BudgetRows: legs, qa84BudgetPartial: !!result.truncated || result.status === 'partial',
            qa84BudgetReadError: '', qa84BudgetLoading: false });
    }
    catch (e) {
        if (JSON.stringify([(_d = host.state.qa84BudgetDrill) === null || _d === void 0 ? void 0 : _d.categoryName, (_e = host.state.qa84BudgetDrill) === null || _e === void 0 ? void 0 : _e.month, (_f = host.state.qa84BudgetDrill) === null || _f === void 0 ? void 0 : _f.bank, host.state.mode]) !== currentKey)
            return;
        host.setState({ qa84BudgetRows: [], qa84BudgetPartial: true,
            qa84BudgetReadError: String((e === null || e === void 0 ? void 0 : e.message) || e), qa84BudgetLoading: false });
    }
}
function qa84BudgetReturn(host, toCategory) {
    var _a;
    const drill = host.state.qa84BudgetDrill;
    if (!drill)
        return;
    if (toCategory) {
        host.setState({ qa84BudgetDrill: { ...drill, showChild: false, subcategoryId: null }, qa84BudgetPage: 0 });
        (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    else {
        host.setState({ qa84BudgetDrill: null, qa84BudgetRows: [], qa84BudgetPage: 0 }, () => {
            var _a;
            (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: drill.returnScroll || 0, left: 0, behavior: 'instant' });
            const button = document.getElementById('qa84-card-' + encodeURIComponent(drill.categoryName));
            button === null || button === void 0 ? void 0 : button.focus({ preventScroll: true });
        });
    }
}
function renderQA84BudgetCards(host, visible, mode, total, bank, suggest) {
    return h('div', { className: 'qa84-budgets-grid', role: 'list', 'aria-label': 'Orçamentos por categoria' }, visible.map(({ info, total: spent, hasLimit, limit }) => {
        const identity = resolveCategoryVisualIdentity({ categoryName: info.name, catalog: host.state.qa84VisualCatalog || [], aggregate: true });
        const model = qa84BudgetStatus(spent, limit !== null && limit !== void 0 ? limit : null, mode === 'expense' && hasLimit);
        const tone = model.status === 'exceeded' ? 'exceeded' : model.status === 'near' ? 'near' :
            model.status === 'within' ? 'within' : 'neutral';
        const center = mode === 'income' ? 'Receita' : model.status === 'unlimited' ? 'Sem limite' :
            model.status === 'zero' ? fmt(spent) :
                model.remaining < 0 ? fmt(-model.remaining) : fmt(model.remaining);
        const caption = mode === 'income' ? 'Recebido' : model.status === 'exceeded' || model.status === 'zero' && spent > 0 ? 'Excedido' :
            model.status === 'unlimited' ? 'Não definido' : model.status === 'zero' ? 'Definido' : 'Restante';
        const pctLabel = model.usedPercent === null ? model.status === 'zero' ? 'Limite R$ 0' : model.status === 'unlimited' ? 'Sem limite' :
            'Sem orçamento' : model.usedPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% utilizado';
        return h('button', { type: 'button', role: 'listitem', key: info.name, id: 'qa84-card-' + encodeURIComponent(info.name),
            className: 'qa84-budget-card tone-' + tone, 'aria-label': info.name + ' · ' + pctLabel +
                ' · gasto ' + fmt(spent) + (hasLimit ? ' · limite ' + fmt(limit) : ' · sem limite'),
            onClick: () => mode === 'income' ? (host.setState({ txSource: bank ? 'bank' : 'manual', txKindFilter: 'income', txCategoryFilter: info.name }), host.navigate('transactions')) :
                qa84BudgetOpen(host, info.name, mode, bank) }, h('div', { className: 'qa84-budget-card-head' }, h(CategoryVisualGlyph, { identity, size: 22 }), h('div', {}, h('h3', {}, info.name), h('small', {}, pctLabel)), h('span', { className: 'qa84-budget-chevron', 'aria-hidden': 'true' }, h(Icon, { name: 'chevron-right', size: 18 }))), qa84Ring(model.arcPercent, tone, center, caption), h('div', { className: 'qa84-budget-card-values' }, h('div', {}, h('small', {}, mode === 'income' ? 'Recebido' : 'Gasto'), h('strong', {}, fmt(spent))), h('div', {}, h('small', {}, 'Limite'), h('strong', {}, hasLimit ? fmt(limit) : 'Sem limite'))), hasLimit && limit === 0 ? h('p', { className: 'qa84-budget-zero' }, 'Limite de R$ 0 definido') : null);
    }));
}
function renderQA84BudgetDetail(host, context) {
    var _a, _b, _c, _d, _e, _f;
    const drill = host.state.qa84BudgetDrill;
    if (!drill)
        return null;
    const rows = host.state.qa84BudgetRows || [], catalog = host.state.qa84VisualCatalog || [];
    const info = host.getCategories().find((c) => c.name === drill.categoryName);
    const identity = resolveCategoryVisualIdentity({ categoryName: drill.categoryName, catalog, aggregate: true });
    const authoritative = drill.bank ? bankSnapshot(host.state.bank, drill.month) : snapshot(host.state.data, drill.month);
    const total = drill.mode === 'income' ? ((_a = authoritative.incomeCategories.find((c) => c.name === drill.categoryName)) === null || _a === void 0 ? void 0 : _a.total) || 0 :
        ((_b = authoritative.categories.find((c) => c.name === drill.categoryName)) === null || _b === void 0 ? void 0 : _b.total) || 0;
    const hasLimit = Object.prototype.hasOwnProperty.call(host.state.data.budgets, drill.categoryName);
    const limit = host.state.data.budgets[drill.categoryName];
    const model = qa84BudgetStatus(total, limit !== null && limit !== void 0 ? limit : null, drill.mode === 'expense' && hasLimit);
    const tone = model.status === 'exceeded' ? 'exceeded' : model.status === 'near' ? 'near' :
        model.status === 'within' ? 'within' : 'neutral';
    const details = qa84BudgetDetails(rows, drill.categoryName, total, catalog, !!host.state.qa84BudgetPartial);
    const page = Math.max(0, host.state.qa84BudgetPage || 0);
    const selected = drill.subcategoryId === null ? details.groups.find(g => g.subcategoryId === null) :
        details.groups.find(g => g.subcategoryId === drill.subcategoryId);
    const childIdentity = drill.showChild && drill.subcategoryId ?
        resolveCategoryVisualIdentity({ categoryId: identity.categoryId, subcategoryId: drill.subcategoryId, catalog }) : null;
    const parent = drill.categoryName, hasChild = !!drill.showChild;
    const groupLabel = drill.subcategoryId === null ? 'Sem subcategoria' : (childIdentity === null || childIdentity === void 0 ? void 0 : childIdentity.label) || 'Subcategoria';
    const center = model.status === 'unlimited' ? 'Sem limite' : model.status === 'zero' ? fmt(total) :
        model.remaining < 0 ? fmt(-model.remaining) : fmt(model.remaining);
    const contentTotal = hasChild ? ((selected === null || selected === void 0 ? void 0 : selected.total) || 0) : total;
    const share = total > 0 ? 100 * contentTotal / total : 0;
    const openChild = (id) => {
        var _a;
        host.setState({ qa84BudgetDrill: { ...drill, subcategoryId: id, showChild: true }, qa84BudgetPage: 0 });
        (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    const pastSpending = Array.from({ length: 3 }, (_, i) => {
        var _a;
        const priorMonth = shiftMonth(drill.month, -i - 1);
        const prior = drill.bank ? bankSnapshot(host.state.bank, priorMonth) : snapshot(host.state.data, priorMonth);
        return ((_a = prior.categories.find((c) => c.name === parent)) === null || _a === void 0 ? void 0 : _a.total) || 0;
    });
    const suggestedLimit = pastSpending.filter(v => v > 0).length >= 2 ?
        Math.max(2000, Math.ceil(pastSpending.reduce((a, b) => a + b, 0) / 3 * 1.1 / 1000) * 1000) : null;
    const openEdit = (suggested = false) => {
        if (suggested && suggestedLimit === null)
            return;
        host.setState({ editModal: { type: 'budget', key: parent, title: suggested ? 'Limite sugerido · ' + parent : hasLimit ? 'Editar limite · ' + parent : 'Definir limite · ' + parent,
                value: suggested ? moneyString(suggestedLimit) : hasLimit ? moneyString(limit) : '' } });
    };
    const partial = host.state.qa84BudgetLoading || host.state.qa84BudgetReadError || !details.complete;
    return h('div', { className: 'qa84-budget-detail section' }, h('nav', { className: 'qa84-crumbs', 'aria-label': 'Caminho de orçamento' }, h('button', { type: 'button', onClick: () => qa84BudgetReturn(host, false) }, 'Orçamentos'), h(Icon, { name: 'chevron-right', size: 13 }), hasChild ? h('button', { type: 'button', onClick: () => qa84BudgetReturn(host, true) }, parent) : h('strong', {}, parent), hasChild ? h(Icon, { name: 'chevron-right', size: 13 }) : null, hasChild ? h('strong', {}, groupLabel) : null), h('section', { className: 'qa84-budget-hero' }, h('div', { className: 'qa84-budget-hero-head' }, h(CategoryVisualGlyph, { identity: hasChild && childIdentity ? childIdentity : identity, size: 23, variant: 'iconLabel' }), h('span', {}, prettyMonth(drill.month) + ' · ' + (drill.bank ? 'Contas conectadas' : 'Adicionado por você'))), h('div', { className: 'qa84-budget-hero-body' }, hasChild ? qa84Ring(share, 'participation', share.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', 'do gasto da categoria') :
        qa84Ring(model.arcPercent, tone, center, model.status === 'exceeded' || model.status === 'zero' && total > 0 ? 'Excedido' : model.status === 'unlimited' ? 'Não definido' : 'Restante'), h('div', { className: 'qa84-budget-hero-copy' }, h('h1', {}, hasChild ? groupLabel : parent), h('strong', {}, fmt(contentTotal)), h('p', {}, hasChild ? 'Participação no gasto da categoria principal. Não é um orçamento separado.' :
        model.status === 'unlimited' ? 'Esta categoria ainda não possui limite.' :
            model.status === 'zero' ? 'Limite zero definido explicitamente.' :
                model.usedPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% do limite utilizado.'), !hasChild ? h('div', { className: 'qa84-budget-hero-financial' }, h('div', {}, h('small', {}, 'Gasto'), h('b', {}, fmt(total))), h('div', {}, h('small', {}, 'Limite'), h('b', {}, hasLimit ? fmt(limit) : 'Sem limite')), h('div', {}, h('small', {}, model.remaining !== null && model.remaining < 0 ? 'Excedido' : 'Restante'), h('b', {}, model.remaining === null ? '—' : fmt(Math.abs(model.remaining))))) : null, !hasChild ? h('div', { className: 'qa84-budget-edit-actions' }, h('button', { type: 'button', onClick: () => openEdit(false) }, hasLimit ? 'Editar limite' : 'Definir limite'), h('button', { type: 'button', disabled: suggestedLimit === null,
        title: suggestedLimit === null ? 'Sugestão exige gastos em pelo menos dois dos três meses anteriores' : 'Sugestão não é aplicada sem sua confirmação',
        onClick: () => openEdit(true) }, 'Sugerir limite')) : null))), host.state.qa84BudgetLoading ? h('div', { className: 'qa84-budget-loading', role: 'status' }, 'Carregando detalhamento autorizado…', h('div', { className: 'qa84-skeleton', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}))) : null, host.state.qa84BudgetReadError ? h('div', { className: 'qa84-budget-error', role: 'alert' }, h('p', {}, host.state.qa84BudgetReadError), h('button', { type: 'button', onClick: () => void qa84BudgetRefresh(host) }, 'Tentar novamente')) : null, !host.state.qa84BudgetLoading && !host.state.qa84BudgetReadError && !details.complete ? h('p', { className: 'qa84-budget-partial', role: 'status' }, details.reason + ' Total do orçamento: ' + fmt(total) + '. Movimentações detalhadas disponíveis: ' + fmt(details.total) +
        '. Não apresentamos percentuais como completos até a conciliação.') : null, !hasChild ? h('section', { className: 'qa84-subcategories' }, h('div', { className: 'qa84-budget-section-heading' }, h('div', {}, h('h2', {}, 'Onde você gastou'), h('p', {}, 'Participação por subcategoria. Os mini-anéis não representam limites próprios.')), h('button', { type: 'button', onClick: () => host.setState({ qa84BudgetShowAll: !host.state.qa84BudgetShowAll }) }, host.state.qa84BudgetShowAll ? 'Mostrar só com gasto' : 'Mostrar todas')), details.complete ? h('div', { className: 'qa84-category-share-strip', 'aria-label': 'Distribuição real por subcategoria' }, details.groups.filter(g => g.total > 0).map(g => {
        const id = g.subcategoryId;
        const visual = id ? resolveCategoryVisualIdentity({ categoryId: identity.categoryId, subcategoryId: id, catalog }) :
            resolveCategoryVisualIdentity({ categoryId: identity.categoryId, catalog });
        return h('button', { type: 'button', key: id || '__none__',
            style: { width: (total > 0 ? g.total / total * 100 : 0) + '%', '--qa-cat-hue': visual.hue },
            'aria-label': (id ? visual.label : 'Sem subcategoria') + ' · ' + fmt(g.total),
            onClick: () => openChild(id) });
    })) : null, h('div', { className: 'qa84-subcategory-grid' }, (() => {
        var _a;
        const approved = D05_APPROVED_PARENTS.find((p) => p.id === identity.categoryId);
        const candidates = ((_a = (catalog.find((p) => p.id === identity.categoryId) || approved)) === null || _a === void 0 ? void 0 : _a.subcategories) || [];
        const listed = details.groups.slice();
        if (host.state.qa84BudgetShowAll && details.complete) {
            for (const child of candidates)
                if (!listed.some(g => g.subcategoryId === child.id))
                    listed.push({ subcategoryId: child.id, total: 0, count: 0, rows: [] });
        }
        if (details.complete && total === 0 && !listed.length && host.state.qa84BudgetShowAll) {
            for (const child of candidates)
                listed.push({ subcategoryId: child.id, total: 0, count: 0, rows: [] });
        }
        return listed.filter(g => host.state.qa84BudgetShowAll || g.total > 0).map(g => {
            const visual = g.subcategoryId ? resolveCategoryVisualIdentity({ categoryId: identity.categoryId,
                subcategoryId: g.subcategoryId, catalog }) : resolveCategoryVisualIdentity({ categoryId: identity.categoryId, catalog });
            const name = g.subcategoryId ? visual.label : 'Sem subcategoria', percent = total > 0 ? 100 * g.total / total : 0;
            return h('button', { type: 'button', key: g.subcategoryId || '__none__', className: 'qa84-subcategory-card',
                onClick: () => openChild(g.subcategoryId) }, h(CategoryVisualGlyph, { identity: visual, size: 20 }), h('div', { className: 'qa84-subcategory-card-copy' }, h('strong', {}, name), h('small', {}, g.count + ' movimentação(ões)'), h('b', {}, fmt(g.total))), details.complete ? qa84Ring(percent, 'participation', percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', 'dos gastos', 'mini') :
                qa84Ring(0, 'neutral', '—', 'dados parciais', 'mini'));
        });
    })()), details.complete && details.groups.length === 0 ? h('p', {}, 'Nenhuma despesa nesta categoria e período.') : null) : h('section', { className: 'qa84-subcategory-history' }, h('h2', {}, 'Histórico da subcategoria'), !details.complete ? h('p', { className: 'qa84-budget-partial' }, 'Histórico parcial: a conciliação com a categoria principal ainda não foi concluída.') : null, h('div', { className: 'qa84-history-list' }, ((selected === null || selected === void 0 ? void 0 : selected.rows) || []).slice(page * 25, (page + 1) * 25).map(t => h('div', { className: 'qa84-history-row', key: t.key }, h('div', {}, h('strong', {}, t.description), h('small', {}, t.date.split('-').reverse().join('/') +
        ' · ID ' + t.id + (t.accountId ? ' · Conta ' + t.accountId : ''))), h('strong', {}, fmt(t.amount))))), !((_c = selected === null || selected === void 0 ? void 0 : selected.rows) === null || _c === void 0 ? void 0 : _c.length) ? h('p', { className: 'qa84-budget-empty' }, 'Nenhuma movimentação registrada nesta subcategoria no período.') : null, (((_d = selected === null || selected === void 0 ? void 0 : selected.rows) === null || _d === void 0 ? void 0 : _d.length) || 0) > 25 ? h('div', { className: 'qa84-history-pagination' }, h('button', { type: 'button', disabled: page === 0, onClick: () => host.setState({ qa84BudgetPage: page - 1 }) }, 'Anterior'), h('span', {}, 'Página ' + (page + 1) + ' de ' + Math.ceil(((selected === null || selected === void 0 ? void 0 : selected.rows.length) || 0) / 25)), h('button', { type: 'button', disabled: (page + 1) * 25 >= selected.rows.length,
        onClick: () => host.setState({ qa84BudgetPage: page + 1 }) }, 'Próxima')) : null), drill.bank && (!((_e = host.state.bank.data.last) === null || _e === void 0 ? void 0 : _e.completedAt) || Date.now() - Date.parse(host.state.bank.data.last.completedAt) > 48 * 3600000) ?
        h('p', { className: 'qa84-budget-partial', role: 'status' }, 'A última atualização bancária pode estar desatualizada. Data informada: ' +
            (((_f = host.state.bank.data.last) === null || _f === void 0 ? void 0 : _f.completedAt) ? new Date(host.state.bank.data.last.completedAt).toLocaleString('pt-BR') : 'não disponível')) : null, host.state.qa84BudgetPartial ? h('p', { className: 'qa84-budget-partial' }, 'Alguns registros bancários antigos podem não constar da janela carregada.') : null);
}
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
        const categoryId = typeof r.categoryId === 'string' && r.categoryId.length <= 128 ? r.categoryId : null;
        const subcategoryId = categoryId && typeof r.subcategoryId === 'string' && r.subcategoryId.length <= 128 ?
            r.subcategoryId : null;
        return { id: String(r.id || Math.random()), date: r.date, kind: r.kind,
            description: r.description.slice(0, 180), amount, category: String(r.category || 'Outros').slice(0, 70),
            categoryId, subcategoryId, origin: 'restored' };
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
        this.qa84D05DrawerIds = null;
        this.qa84BankCategoryGateAuthorized = false;
        this.onGlobalKeydown = (event) => {
            if (document.querySelector('.d05-overlay'))
                return;
            if (event.key === 'Escape' && this.state.contextCategory) {
                event.preventDefault();
                this.closeContextCategory();
                return;
            }
            if (event.key === 'Escape' && this.state.quickCategory) {
                event.preventDefault();
                this.closeQuickCategory();
                return;
            }
            const dialog = document.querySelector('.p-editor-backdrop [role="dialog"]') || document.querySelector('.modal-backdrop [role="dialog"]') || document.querySelector('.mf-detail-drawer,.mf-ai-drawer');
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
            if (event.key === 'Escape' && this.state.contextCategory) {
                event.preventDefault();
                this.closeContextCategory();
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
            if (this.state.planOpen) {
                this.setState({ planOpen: false });
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
            if (this.state.editModal) {
                this.setState({ editModal: null });
                return;
            }
            if (this.state.page === 'budgets' && this.state.qa84BudgetDrill) {
                event.preventDefault();
                qa84BudgetReturn(this, !!this.state.qa84BudgetDrill.showChild);
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
            void this.loadQA84VisualCatalog();
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
        var _a, _b, _c, _d, _e, _f;
        if (!previous.contextCategory && this.state.contextCategory)
            (_a = document.querySelector('.mf-context-category input')) === null || _a === void 0 ? void 0 : _a.focus();
        if (previous.contextCategory && !this.state.contextCategory)
            (_b = document.querySelector(this.state.showEntry ? '.modal input' : '.u5-category-search input')) === null || _b === void 0 ? void 0 : _b.focus();
        const before = !!(previous.contextCategory || previous.showEntry || previous.editModal || previous.detail || previous.planOpen || previous.planSelected || previous.intelligencePanelOpen);
        const now = !!(this.state.contextCategory || this.state.showEntry || this.state.editModal || this.state.detail || this.state.planOpen || this.state.planSelected || this.state.intelligencePanelOpen);
        if (!before && now) {
            this.focusReturn = document.activeElement;
            const dialog = document.querySelector('.modal-backdrop [role="dialog"],.mf-detail-drawer,.mf-ai-drawer');
            const control = dialog === null || dialog === void 0 ? void 0 : dialog.querySelector('input:not([disabled]),button:not([disabled])');
            const categoryControl = this.focusCategoryOnDetailOpen && this.state.detail
                ? dialog === null || dialog === void 0 ? void 0 : dialog.querySelector('.mf-transaction-category-select') : null;
            (_c = (categoryControl || control)) === null || _c === void 0 ? void 0 : _c.focus();
            this.focusCategoryOnDetailOpen = false;
        }
        else if (before && !now) {
            if (previous.intelligencePanelOpen)
                (_d = document.querySelector('.mf-ai-fab')) === null || _d === void 0 ? void 0 : _d.focus();
            else if (this.focusReturn && document.contains(this.focusReturn))
                (_f = (_e = this.focusReturn).focus) === null || _f === void 0 ? void 0 : _f.call(_e);
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
            const autoCategoryStatus = this.state.mode === 'real' && desktop.bankAutoStatus ?
                await desktop.bankAutoStatus().catch(() => null) : null;
            this.setState({ bank, autoCategoryStatus, bankForm: { clientId: bank.config.clientId || '', clientSecret: '', itemIds: (bank.config.itemIds || []).join(', ') } });
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
            void this.loadQA84VisualCatalog();
            await this.refreshPlanning();
        }
        catch (e) {
            this.setState({ categoryMessage: 'Não foi possível importar as sugestões: ' + String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
    }
    async loadQA84VisualCatalog() {
        const api = desktop;
        if (!(api === null || api === void 0 ? void 0 : api.d05Catalog))
            return;
        try {
            const result = await api.d05Catalog();
            if (result && Array.isArray(result.parents))
                this.setState({ qa84VisualCatalog: result.parents });
        }
        catch (_) { }
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
        const value = { ...this.state.categoryEditor }, context = this.state.contextCategory;
        if (this.state.categoryContextBusy)
            return;
        this.setState({ categoryContextBusy: true });
        try {
            const state = await desktop.categorySave(value);
            const persisted = await desktop.load(this.state.mode);
            this.setState({ categories: state.categories, rules: state.rules, categoryEditor: { previousName: '', name: '', color: '#3e9a85', emoji: '✨', kind: 'expense' }, categoryMessage: 'Categoria salva.', data: persisted ? safeData(persisted) : this.state.data });
            await this.refreshBank();
            void this.loadQA84VisualCatalog();
            if (context && this.state.contextCategory === context) {
                const same = this.state.mode === context.mode && this.state.bankFilter === context.account && this.state.query === context.query;
                this.setState({ contextCategory: undefined, categoryEditor: context.editor, ...(same ? (context.target === 'entry' ? { entry: { ...this.state.entry, category: value.name.trim() }, entryCategoryTouched: true } : context.target === 'quick' ? { quickCategoryQuery: value.name.trim(), quickCategoryIndex: 0 } : { txBatchCategory: value.name.trim() }) : {}) });
                this.flash('Categoria criada. Confira e aplique na classificação.');
            }
        }
        catch (e) {
            this.setState({ categoryMessage: String((e === null || e === void 0 ? void 0 : e.message) || e) });
        }
        finally {
            this.setState({ categoryContextBusy: false });
        }
    }
    async deleteCategory(name) {
        if (!desktop || this.state.mode === 'demo' || !confirm('Excluir a categoria ' + name + '? A exclusão será impedida se ela estiver em uso.'))
            return;
        try {
            const state = await desktop.categoryDelete(name);
            const persisted = await desktop.load(this.state.mode);
            this.setState({ categories: state.categories, rules: state.rules, data: persisted ? safeData(persisted) : this.state.data, categoryMessage: 'Categoria excluída.' });
            void this.loadQA84VisualCatalog();
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
    openBankDetail(tx, visual) {
        var _a, _b;
        this.qa84D05DrawerIds = { origin: 'bank', id: tx.id, accountId: tx.accountId,
            categoryId: (visual === null || visual === void 0 ? void 0 : visual.categoryId) || null, subcategoryId: (_a = visual === null || visual === void 0 ? void 0 : visual.subcategoryId) !== null && _a !== void 0 ? _a : null };
        this.setState({ detail: { origin: 'bank', id: tx.id, accountId: tx.accountId }, detailDraft: { merchant: tx.merchant || '', note: tx.note || '', nature: tx.nature || 'auto', reviewed: !!tx.reviewed, aliasPattern: tx.description.slice(0, 60), splitParts: (((_b = tx.splits) === null || _b === void 0 ? void 0 : _b.length) ? tx.splits : [{ category: tx.category, amount: Math.floor(Math.abs(tx.amount) / 2) }, { category: tx.category, amount: Math.abs(tx.amount) - Math.floor(Math.abs(tx.amount) / 2) }]).map(p => ({ category: p.category, value: moneyString(p.amount) })) } });
    }
    openManualDetail(tx, visual) {
        var _a;
        this.qa84D05DrawerIds = { origin: 'manual', id: tx.id, categoryId: (visual === null || visual === void 0 ? void 0 : visual.categoryId) || null,
            subcategoryId: (_a = visual === null || visual === void 0 ? void 0 : visual.subcategoryId) !== null && _a !== void 0 ? _a : null };
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
        if (draft.category !== original.category) {
            this.flash('Classificação exige a prévia supervisionada D05.');
            return false;
        }
        if (!allowed && draft.category !== original.category) {
            this.flash('Selecione uma categoria compatível.');
            return false;
        }
        if (this.isManualLinked(id) && (draft.date !== original.date || amount !== original.amount)) {
            this.flash('Desvincule este lançamento da movimentação bancária antes de mudar data ou valor.');
            return false;
        }
        const result = await this.updateData({ ...this.state.data, transactions: this.state.data.transactions.map(t => t.id === id ? { ...t, description, date: draft.date, amount, category: original.category } : t) }, 'Lançamento atualizado.');
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
            h('p', { className: 'u5-category-empty' }, context && !context.kind ? 'Natureza de transferência ou desconsiderada: altere nos detalhes antes de categorizar.' : 'Nenhuma categoria compatível encontrada.')), this.state.mode === 'real' ? h('button', { type: 'button', className: 'mf-new-category', disabled: this.state.quickCategoryBusy, onClick: () => this.openContextCategory('quick') }, h(Icon, { name: 'plus', size: 15 }), 'Nova categoria') : null, this.state.quickCategoryError ?
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
        if (!this.qa84BankCategoryGateAuthorized) {
            this.flash('Divisão por categoria requer prévia D05 homologada; nenhuma alteração efetuada.');
            return;
        }
        const sel = this.state.detail;
        if (!sel || sel.origin !== 'bank')
            return;
        const parts = this.state.detailDraft.splitParts.map(x => ({ category: x.category, amount: parseMoney(x.value) }));
        if (parts.some(x => !Number.isSafeInteger(x.amount) || x.amount <= 0))
            return this.flash('Confira os valores da divisão.');
        await this.runBankOperation('bankSplit', { accountId: sel.accountId, externalId: sel.id, parts }, parts.length ? 'Divisão salva.' : 'Divisão removida.');
    }
    async createCategoryRuleFromDetail() {
        if (!this.qa84BankCategoryGateAuthorized) {
            this.flash('Regra de categoria requer prévia D05 homologada; nenhuma alteração efetuada.');
            return;
        }
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
        const resetScope = { query: '', bankFilter: '', txSource: 'all', txCategoryFilter: '', txKindFilter: 'all', txReviewFilter: 'all', txReviewOnly: false, txOrganize: false, txSelected: [], qa84TransactionsSpan: null, qa84TransactionsCategory: '', qa84BudgetDrill: null, budgetFocus: null, budgetSearch: '', detail: null, manualDraft: null, quickCategory: null };
        if (!desktop) {
            this.setState({ ...resetScope, mode, data: load(mode), outcome: null, page: 'overview', showEntry: false });
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
            this.setState({ ...resetScope, mode, data: safeData(loaded), busy: false, outcome: null, page: 'overview', showEntry: false });
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
        const pageChanged = target !== this.state.page;
        const span = dateSpan(this.state.overviewPeriod, this.state.customStart, this.state.customEnd);
        const newMonth = span.end.slice(0, 7), useMonth = newMonth >= nowYM && newMonth <= shiftMonth(nowYM, 12);
        const enteringPlan = target === 'planning' && this.state.page !== 'planning' && useMonth;
        this.setState({ page: target, ...(target === 'budgets' && pageChanged ? { qa84BudgetDrill: null } : {}), txReviewOnly: page === 'review', txOrganize: page === 'categories', quickAddOpen: false, quickCategory: null,
            month: newMonth, ...(enteringPlan ? { planMonth: newMonth, planDay: newMonth === nowYM ? iso(new Date()) : newMonth + '-01' } : {}),
            showEntry: false, outcome: null, simBusy: false }, () => {
            var _a;
            if (pageChanged)
                (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            if (enteringPlan)
                void this.refreshPlanning();
            if (target === 'intelligence' && typeof intelligencePremiumLoad === 'function')
                void intelligencePremiumLoad(this);
        });
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
        if (this.state.txOrganize)
            return h('div', { className: 'movement-shell' }, h('button', { type: 'button', className: 'd05-back', onClick: () => this.setState({ txOrganize: false }) }, '← Voltar ao histórico'), this.renderCategories());
        return h(D05Movements, { host: this, key: this.state.txReviewOnly ? 'review' : 'history' });
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
    exportCSV() {
        const cell = (v) => '"' + d05CsvFormulaSafe(v).replace(/"/g, '""') + '"';
        const s = ['data;descricao;tipo;valor;categoria', ...this.state.data.transactions.map(t => [cell(t.date), cell(t.description), cell(t.kind), cell(moneyString(t.amount)), cell(t.category)].join(';'))].join('\r\n');
        download(new Blob(['\ufeff' + s], { type: 'text/csv;charset=utf-8' }), 'meu-financeiro-extrato.csv');
    }
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
            if (this.state.csvPreview)
                throw Error('Conclua ou cancele a prévia atual.');
            if (file.size > 4000000)
                throw Error('CSV acima de 4 MB.');
            const raw = await file.text(), digest = await d05CsvDigest(raw), parsed = d05CsvTable(raw);
            const { rows, find } = parsed, di = find('data', 'date'), de = find('descricao', 'historico', 'description'), va = find('valor', 'amount'), ca = find('categoria', 'category'), ki = find('tipo', 'kind');
            const categories = new Set(this.getCategories().map(c => c.name));
            const known = new Set(this.state.data.transactions.map(x => [x.date, x.description.trim(), x.kind, x.amount].join('|')));
            const add = [], previewRows = [];
            let skipped = 0;
            for (const [i, row] of rows.entries()) {
                const idx = i + 2, date = d05CsvDate(row[di] || '');
                const description = d05CsvSafeText(row[de] || '', 150, 'descrição da linha ' + idx);
                const value = parseMoney(String(row[va] || ''));
                if (!Number.isSafeInteger(value) || value === 0 || Math.abs(value) > 100000000000)
                    throw Error('CSV: centavos inválidos na linha ' + idx);
                const csvKind = String(row[ki] || '').trim().toLowerCase();
                if (csvKind && !['expense', 'despesa', 'saida', 'saída', 'income', 'receita', 'entrada'].includes(csvKind))
                    throw Error('CSV: tipo desconhecido na linha ' + idx);
                const kind = ['expense', 'despesa', 'saida', 'saída'].includes(csvKind) ?
                    'expense' : (['income', 'receita', 'entrada'].includes(csvKind) ? 'income' : value >= 0 ? 'income' : 'expense');
                const label = String(row[ca] || '').trim();
                if (label)
                    d05CsvSafeText(label, 70, 'categoria da linha ' + idx);
                const inferred = findCategoryRule(description, 'manual', this.state.rules);
                const category = categories.has(label) ? label :
                    (inferred && categories.has(inferred) ? inferred : 'Outros');
                const amount = Math.abs(value), key = [date, description, kind, amount].join('|');
                const duplicate = known.has(key);
                previewRows.push({ line: idx, date, description, kind, amount, category, duplicate });
                if (duplicate) {
                    skipped++;
                    continue;
                }
                known.add(key);
                add.push({ id: 'csv-' + digest.slice(0, 16) + '-' + idx, date, description, kind, amount, category, origin: 'csv' });
            }
            if (!add.length) {
                this.flash('CSV: todos os registros já existem no histórico.');
                return;
            }
            this.setState({ csvPreview: { raw, digest, rows: previewRows, add, skipped,
                    mode: this.state.mode, dataRef: this.state.data, categoriesRef: this.state.categories,
                    fileName: file.name } });
        }
        catch (e) {
            this.flash('CSV não importado: ' + String((e === null || e === void 0 ? void 0 : e.message) || e).slice(0, 220));
        }
    }
    async commitCSVPreview() {
        const preview = this.state.csvPreview;
        if (!preview || this.state.busy || this.__csvCommitBusy)
            return;
        this.__csvCommitBusy = true;
        try {
            if (preview.dataRef !== this.state.data || preview.mode !== this.state.mode ||
                preview.categoriesRef !== this.state.categories)
                throw Error('Histórico ou perfil mudou; importe o arquivo novamente.');
            if (await d05CsvDigest(preview.raw) !== preview.digest)
                throw Error('Fingerprint CSV alterado; nenhum dado foi importado.');
            const keys = new Set(this.state.data.transactions.map(x => [x.date, x.description.trim(), x.kind, x.amount].join('|')));
            if (preview.add.some((x) => keys.has([x.date, x.description.trim(), x.kind, x.amount].join('|'))))
                throw Error('Foram encontradas duplicatas após a prévia; refaça a importação.');
            if (desktop) {
                const backup = await desktop.backupSQLite();
                if ((backup === null || backup === void 0 ? void 0 : backup.ok) !== true)
                    throw Error('Backup completo não confirmado; importação cancelada.');
            }
            if (preview.dataRef !== this.state.data || preview.mode !== this.state.mode)
                throw Error('Histórico mudou enquanto o backup era criado; refaça a importação.');
            const ok = await this.updateData({ ...this.state.data, transactions: [
                    ...this.state.data.transactions, ...preview.add
                ] }, preview.add.length + ' lançamentos CSV registrados.');
            if (!ok)
                throw Error('Persistência não confirmada pelo SQLite.');
            this.setState({ csvPreview: null });
        }
        catch (e) {
            this.flash('Importação cancelada: ' + String((e === null || e === void 0 ? void 0 : e.message) || e).slice(0, 220));
        }
        finally {
            this.__csvCommitBusy = false;
        }
    }
    renderCSVPreview() {
        const p = this.state.csvPreview;
        if (!p)
            return null;
        const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);
        return h('div', { className: 'mf-d04-modal-overlay', role: 'presentation' }, h('section', { className: 'mf-d04-modal mf-d05-csv-preview', role: 'dialog', 'aria-modal': true,
            'aria-label': 'Prévia completa de importação CSV' }, h('h2', {}, 'Confira todas as linhas antes de importar'), h('p', {}, String(p.fileName || 'CSV') + ' · ' + p.add.length + ' novas · ' + p.skipped + ' já existentes · ' +
            p.rows.length + ' linhas analisadas. Um backup completo será obrigatório antes de gravar.'), h('p', {}, 'SHA-256 do arquivo: ' + String(p.digest)), h('div', { className: 'mf-d05-csv-scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Linha', 'Data', 'Descrição', 'Natureza', 'Categoria', 'Valor', 'Situação'].map(x => h('th', {}, x)))), h('tbody', {}, ...p.rows.map((x) => h('tr', { key: x.line }, h('td', {}, String(x.line)), h('td', {}, x.date), h('td', {}, x.description), h('td', {}, x.kind === 'expense' ? 'Despesa' : 'Receita'), h('td', {}, x.category), h('td', {}, fmt(x.amount)), h('td', {}, x.duplicate ? 'Duplicada: ignorar' : 'Nova')))))), h('div', { className: 'mf-d04-actions' }, h('button', { type: 'button', className: 'ghost-button', disabled: this.state.busy,
            onClick: () => this.setState({ csvPreview: null }) }, 'Cancelar, sem alterações'), h('button', { type: 'button', className: 'primary-button', disabled: this.state.busy,
            onClick: () => void this.commitCSVPreview() }, 'Confirmar e fazer backup antes de importar'))));
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
        return h('aside', { className: 'sidebar' }, h('div', { className: 'brand' }, h(Logo), h('div', { className: 'brand-text' }, h('strong', {}, 'Meu Financeiro'), h('small', {}, 'CONTROLE DO SEU DINHEIRO'))), h('div', { className: 'side-label' }, 'CONTROLE'), h('nav', {}, this.navItem('overview', 'home', 'Visão geral'), this.navItem('transactions', 'wallet', 'Movimentações'), this.navItem('planning', 'calendar', 'Planejamento'), this.navItem('banks', 'bank', 'Minhas contas'), h('div', { className: 'side-label mf-ai-side-label' }, 'ORGANIZAÇÃO'), this.navItem('budgets', 'pie', 'Orçamentos'), h('div', { className: 'side-label mf-ai-side-label' }, 'FERRAMENTAS'), this.navItem('assistant', 'cart', 'Simular compra'), this.navItem('intelligence', 'spark', 'Inteligência')), h('div', { className: 'side-bottom' }, this.navItem('settings', 'settings', 'Configurações'), h('label', { className: 'mf-appearance' }, h('span', {}, 'Aparência'), h('select', { 'aria-label': 'Tema do aplicativo', 'data-appearance': 'select', defaultValue: ((_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.get()) || 'system', onChange: (e) => { var _a; return (_a = window.MFAppearance) === null || _a === void 0 ? void 0 : _a.set(e.target.value); } }, h('option', { value: 'light' }, 'Claro'), h('option', { value: 'dark' }, 'Escuro'), h('option', { value: 'system' }, 'Sistema'))), h('div', { className: 'privacy-note' }, h(Icon, { name: 'shield', size: 19 }), h('div', {}, h('b', {}, 'Privado e local'), h('small', {}, 'Dados sob seu controle'))), h('button', { className: 'demo-btn', onClick: () => this.toggleMode() }, h(Icon, { name: this.state.mode === 'real' ? 'spark' : 'home', size: 18 }), this.state.mode === 'real' ? 'Explorar demonstração' : 'Voltar aos meus dados'), h('small', { className: 'app-version' }, 'Meu Financeiro · v0.9.5-beta.9')));
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
    openOverviewTransactions(kind = 'all', pending = false) {
        const useBank = this.state.mode === 'real' && this.state.dashboardSource === 'bank' && this.state.bank.data.accounts.length > 0;
        this.setState({ query: '', bankFilter: '', txSource: useBank ? 'bank' : 'manual', txCategoryFilter: '', txKindFilter: kind, txReviewFilter: pending ? 'pending' : 'all', txSelected: [], quickCategory: null });
        this.navigate('transactions');
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
        const recent = useBank ? bank.data.transactions.filter(x => x.date >= start && x.date <= end && x.status === 'POSTED' && ['income', 'expense'].includes(effectiveNature(x))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(x => ({ key: x.accountId + '|' + x.id, title: x.customTitle || x.merchant || x.description, original: x.description, date: x.date, category: x.category, categoryId: x.categoryId || null, subcategoryId: x.subcategoryId || null, amount: Math.abs(x.amount), kind: effectiveNature(x), raw: x })) : d.transactions.filter(x => x.date >= start && x.date <= end).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(x => ({ key: x.id, title: x.description, original: '', date: x.date, category: x.category, categoryId: x.categoryId || null, subcategoryId: x.subcategoryId || null, amount: x.amount, kind: x.kind, raw: x }));
        const manualInPeriod = d.transactions.filter(x => x.date >= start && x.date <= end).length;
        const openBudget = () => { this.setState({ month }); this.navigate('budgets'); };
        const metric = (label, value, icon, hint, tone) => h('button', { type: 'button', className: 'u1-metric mf-border-reveal mf-tone-' + (tone === 'net' ? 'net' : tone) + ' ' + tone + ' mf-overview-metric' + (tone === 'net' ? (value > 0 ? ' is-positive' : value < 0 ? ' is-negative' : ' is-neutral') : ''), 'aria-label': label + ' · ' + money(value) + ' · ver movimentações', onClick: () => this.openOverviewTransactions(tone === 'income' ? 'income' : tone === 'expense' ? 'expense' : 'all') }, h('div', { className: 'u1-metric-label' }, h(Icon, { name: icon, size: 16 }), label, h(Icon, { name: 'arrow', size: 13 })), h('strong', {}, money(value)), h('small', {}, hint));
        const reviewCount = useBank ? bank.data.transactions.filter(t => !t.reviewed).length : null;
        return h('div', { className: 'overview-content u1-overview mf-premium-overview ' + (hidden ? 'u1-values-hidden' : '') }, h('div', { className: 'u1-context' }, this.renderSourcePicker(), h('span', {}, date(start) + ' — ' + date(end) + ' · ' + (useBank ? 'Movimentos confirmados' + (bank.data.truncated ? ' · histórico parcial' : '') : 'Registros manuais'))), h('section', { className: 'mf-overview-brief', 'aria-label': 'Prioridades financeiras' }, h('div', { className: 'mf-overview-brief-title' }, h('span', { className: 'micro-label' }, 'SEU DIA FINANCEIRO'), h('h2', {}, 'Clareza para a próxima decisão'), h('p', {}, 'Fonte ' + (useBank ? 'bancária' : 'manual') + ' · ' + date(start) + ' a ' + date(end))), h('div', { className: 'mf-overview-priorities' }, h('button', { type: 'button', onClick: () => useBank ? this.openOverviewTransactions('all', true) : this.openOverviewTransactions() }, h(Icon, { name: 'check', size: 18 }), h('span', {}, h('strong', {}, reviewCount === null ? 'Conferir registros manuais' : reviewCount + ' a conferir'), h('small', {}, useBank ? 'Somente histórico bancário carregado' : 'Abra os lançamentos desta fonte')), h(Icon, { name: 'arrow', size: 14 })), h('button', { type: 'button', onClick: () => this.navigate('planning') }, h(Icon, { name: 'calendar', size: 18 }), h('span', {}, h('strong', {}, generated ? upcoming.length + ' compromissos' : 'Conferir agenda'), h('small', {}, generated ? 'Próximos 7 dias · inclui vencidos' : 'Abra para carregar seus compromissos')), h(Icon, { name: 'arrow', size: 14 })), h('button', { type: 'button', onClick: () => this.openIntelligenceContext('overview') }, h(Icon, { name: 'spark', size: 18 }), h('span', {}, h('strong', {}, 'Entender meus números'), h('small', {}, 'Consulta local sob autorização')), h(Icon, { name: 'arrow', size: 14 })))), state.bankMessage && bank.config.configured ? h('div', { className: 'sync-feedback', role: 'status' }, state.bankMessage) : null, h('div', { className: 'stats-grid' }, h('section', { className: 'u1-balance mf-border-reveal mf-tone-balance', role: 'group', tabIndex: 0, 'aria-label': useBank ? 'Saldo nas contas' : 'Saldo manual' }, h('div', { className: 'u1-balance-label' }, h('span', {}, useBank ? 'Saldo nas contas' : 'Saldo manual'), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': hidden ? 'Mostrar valores' : 'Ocultar valores', 'aria-pressed': hidden, onClick: () => this.setState({ overviewHideValues: !hidden }) }, h(Icon, { name: hidden ? 'eye-off' : 'eye', size: 18 }))), h('strong', { className: 'u1-balance-value' }, hidden ? '••••' : coverage ? bankBalanceLabel(coverage) : money(s.balance)), h('details', { className: 'u1-balance-info' }, h('summary', {}, h('span', { className: 'u1-status-dot ' + ((coverage === null || coverage === void 0 ? void 0 : coverage.missingCount) ? 'is-partial' : '') }), (coverage === null || coverage === void 0 ? void 0 : coverage.missingCount) ? 'Saldo parcial · conferir' : useBank ? 'Referência das instituições' : 'Como é calculado'), h('p', {}, coverage ? 'Saldos disponíveis de ' + coverage.knownCount + ' de ' + coverage.totalCount + ' conta(s). Não representa dinheiro livre. A consulta pode ser mais recente que o saldo informado.' : 'Saldo inicial mais receitas menos despesas manuais. Não somado ao banco.'))), metric('Receitas', s.income, 'trend', 'No período selecionado', 'income'), metric('Despesas', s.expense, 'down', 'No período selecionado', 'expense'), metric('Resultado', s.net, 'chart', 'Receitas menos despesas', 'net')), h('div', { className: 'u1-main-grid' }, h('div', { className: 'u1-left-stack' }, h('section', { className: 'u1-panel u1-rhythm' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Seu ritmo de gastos'), h('p', {}, 'Entenda como suas despesas evoluíram.')), h('div', { className: 'u1-chart-tabs', role: 'group', 'aria-label': 'Visualização do período' }, ['spending', 'flow'].map(tab => h('button', { type: 'button', key: tab, 'aria-pressed': (state.overviewChart || 'spending') === tab, onClick: () => this.setState({ overviewChart: tab }) }, tab === 'spending' ? 'Acumulado' : 'Entradas e saídas')))), h('div', { className: 'u1-rhythm-summary' }, h('div', {}, h('strong', {}, money(s.expense)), h('span', {}, 'gastos no período')), h('div', { className: 'u1-comparison ' + (comparison.percent !== null && comparison.percent <= 0 ? 'is-lower' : '') }, hidden ? 'Valores ocultos' : comparison.label, h('small', {}, compareAvailable ? date(previous.start) + ' a ' + date(previous.end) + ' · mesma fonte' : 'Comparação exige histórico disponível nos dois intervalos'))), hidden ? h('div', { className: 'u1-chart-hidden' }, h(Icon, { name: 'eye-off', size: 26 }), h('p', {}, 'Mostre os valores para visualizar o gráfico.')) : (state.overviewChart || 'spending') === 'flow' ? h(Chart, { data: flowSegments(start, end, range) }) : h(OverviewSpendingChart, { rows: points, compare: compareAvailable }), h('div', { className: 'u1-chart-footer' }, h('span', {}, h('i', { className: 'u1-current-dot' }), 'Período selecionado'), compareAvailable ? h('span', {}, h('i', { className: 'u1-previous-dot' }), 'Intervalo anterior') : null, h('span', { className: 'u1-daily-average' }, 'Média diária ', h('b', {}, money(Math.round(s.expense / daysInSpan(start, end)))))))), h('aside', { className: 'u1-side-stack' }, h('section', { className: 'mf-plan-shortcut' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Na sua agenda'), h('p', {}, 'Hoje e próximos 7 dias · compromissos cadastrados')), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': 'Abrir Planejamento', onClick: () => this.navigate('planning') }, h(Icon, { name: 'arrow', size: 17 }))), generated ? h('div', { className: 'u1-agenda-stats' }, h('div', {}, h('strong', {}, overdue.length), h('span', {}, 'vencidos')), h('div', {}, h('strong', {}, money(upcoming.reduce((n, x) => n + x.remaining, 0))), h('span', {}, 'a pagar · inclui vencidos'))) : null, upcoming.length ? h('div', { className: 'mf-agenda-list' }, upcoming.slice(0, 3).map(item => h('button', { type: 'button', className: 'mf-agenda-row', key: item.id, onClick: () => this.openPlanDetail(item.id) }, h('span', { className: 'u1-agenda-date' }, date(item.dueDate)), h('span', { className: 'mf-agenda-copy' }, h('strong', {}, item.title), h('small', {}, item.dueDate < today ? 'Vencido' : item.dueDate === today ? 'Hoje' : item.certainty === 'estimated' ? 'Estimado' : 'A vencer')), h('strong', { className: 'mf-agenda-amount' }, money(item.remaining))))) : h('div', { className: 'u1-empty-agenda' }, h(Icon, { name: 'calendar', size: 22 }), h('div', {}, h('b', {}, generated ? 'Sem vencimentos cadastrados neste intervalo' : 'Agenda ainda não carregada'), h('p', {}, generated ? 'Isso não confirma a ausência de contas a pagar.' : 'Abra o Planejamento para conferir seus compromissos.'))), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => this.navigate('planning') }, 'Ver agenda', h(Icon, { name: 'arrow', size: 14 }))), h('section', { className: 'u1-panel u1-budget' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Orçamento em foco'), h('p', {}, prettyMonth(month))), h('button', { type: 'button', className: 'u1-icon-button', 'aria-label': 'Abrir Orçamentos', onClick: openBudget }, h(Icon, { name: 'arrow', size: 17 }))), h('div', { className: 'u1-budget-summary' }, h('strong', {}, money(spentLimited)), h('span', {}, 'de ' + money(totalLimit) + ' em limites')), limits.length ? h('div', { className: 'u1-budget-meter ' + (spentLimited > totalLimit ? 'is-over' : ''), role: 'img', 'aria-label': hidden ? 'Valores ocultos' : used + '% dos limites utilizados' }, h('i', { style: { width: hidden ? '0%' : Math.min(100, used) + '%' } })) : null, h('p', { className: 'u1-budget-caption' }, !limits.length ? 'Você ainda não definiu limites.' : hidden ? 'Valores ocultos' : (spentLimited > totalLimit ? money(spentLimited - totalLimit) + ' acima dos limites' : money(totalLimit - spentLimited) + ' de margem nos limites')), h('div', { className: 'u1-coverage' }, h('span', {}, 'Cobertura dos gastos'), h('b', {}, hidden ? '••••' : budgetCoverage === null ? 'Sem gastos' : budgetCoverage + '%')), h('p', { className: 'u1-microcopy' }, 'Considera apenas categorias com limite. Margem não é saldo disponível.'), h('button', { type: 'button', className: 'u1-subtle-link', onClick: openBudget }, 'Gerenciar orçamento', h(Icon, { name: 'arrow', size: 14 })))), h('section', { className: 'u1-panel u1-categories' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Para onde foi seu dinheiro'), h('p', {}, 'Categorias do período selecionado')), h('span', { className: 'u1-count' }, s.categories.length + ' categorias')), renderQA84OverviewCategories(this, s.categories, s.expense, useBank, hidden))), h('div', { className: 'u1-detail-grid' }, h('section', { className: 'u1-panel u1-recent' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, 'Últimas movimentações'), h('p', {}, 'Confirmadas no período')), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => { this.setState({ query: '', bankFilter: '', txSource: useBank ? 'bank' : 'manual', txReviewOnly: false, txOrganize: false }); this.navigate('transactions'); } }, 'Ver tudo', h(Icon, { name: 'arrow', size: 14 }))), recent.length ? h('div', { className: 'u1-recent-list' }, recent.map(t => { const txIdentity = resolveCategoryVisualIdentity({ categoryId: t.categoryId, subcategoryId: t.subcategoryId, categoryName: t.category, catalog: state.qa84VisualCatalog || [] }); return h('button', { type: 'button', className: 'u1-recent-row', key: t.key, onClick: () => useBank ? this.openBankDetail(t.raw) : this.openManualDetail(t.raw) }, h(CategoryVisualGlyph, { identity: txIdentity, size: 18 }), h('span', { className: 'u1-recent-copy' }, h('strong', {}, t.title), h('small', {}, t.original && t.original !== t.title ? t.original : t.category + ' · ' + date(t.date))), h('strong', { className: t.kind === 'income' ? 'good-text' : 'bad-text' }, hidden ? '••••' : (t.kind === 'income' ? '+' : '−') + money(t.amount))); })) : h('p', { className: 'u1-empty' }, 'Nenhuma movimentação confirmada neste período.')), h('section', { className: 'u1-panel u1-accounts' }, h('div', { className: 'u1-panel-head' }, h('div', {}, h('h2', {}, useBank ? 'Suas contas' : 'Fonte dos seus indicadores'), h('p', {}, useBank ? 'Saldo de referência por instituição · não depende do período acima' : 'Acompanhamento com registros adicionados por você')), h('button', { type: 'button', className: 'u1-subtle-link', onClick: () => this.navigate('banks') }, 'Ver contas', h(Icon, { name: 'arrow', size: 14 }))), useBank ? h('div', { className: 'u1-accounts-grid' }, bank.data.accounts.map(account => h('button', { type: 'button', className: 'u1-account', key: account.id, onClick: () => { this.setState({ bankFilter: account.id, query: '', txSource: 'bank', txReviewOnly: false, txOrganize: false }); this.navigate('transactions'); } }, h('span', { className: 'u1-account-icon' }, h(Icon, { name: 'bank', size: 19 })), h('span', { className: 'u1-account-copy' }, h('b', {}, account.name), h('small', {}, 'Referência: ' + bankReferenceLabel(account.updatedAt))), h('strong', {}, Number.isFinite(account.balance) ? money(account.balance) : 'Indisponível')))) : h('div', { className: 'u1-source-panel' }, h('div', { className: 'u1-source-stats' }, h('div', {}, h('strong', {}, state.mode === 'demo' ? 'Demonstração' : manualInPeriod + ' no período'), h('span', {}, state.mode === 'demo' ? 'Dados fictícios ativos' : 'Registros manuais confirmados')), h('div', {}, h('strong', {}, d.transactions.length + ' no histórico'), h('span', {}, bank.data.accounts.length ? bank.data.accounts.length + ' conta(s) bancária(s) separada(s)' : 'Sem mistura com extrato bancário'))), h('div', { className: 'u1-source-note' }, h(Icon, { name: 'shield', size: 17 }), h('p', { className: 'u1-microcopy' }, 'Os registros manuais e o extrato bancário são consultados separadamente para evitar duplicidades.'))))), null);
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
        return h('div', { className: 'section mf-tx-section u2-transactions mf-premium-transactions' }, h('div', { className: 'mf-tx-views', 'aria-label': 'Visões rápidas' }, ...[{ label: 'Todas', value: 'all' }, { label: 'A conferir', value: 'pending' }, { label: 'Revisadas', value: 'reviewed' }].map(v => h('button', { type: 'button', 'aria-pressed': (this.state.txReviewFilter || 'all') === v.value, disabled: review, onClick: () => this.setState({ txReviewFilter: v.value, txSelected: [], quickCategory: null }) }, v.label)), h('label', {}, h('input', { type: 'checkbox', checked: !!this.state.txGroupByDate, onChange: (e) => this.setState({ txGroupByDate: e.target.checked }) }), 'Agrupar por data'), h('button', { type: 'button', className: 'mf-tx-review-link', onClick: () => void categoryReviewOpen(this) }, h(Icon, { name: 'spark', size: 15 }), 'Central de revisão')), !review && ((_a = this.state.bank.data.suspectedDuplicates) === null || _a === void 0 ? void 0 : _a.length) ? h(Card, { className: 'mf-duplicate-banner' }, h('div', {}, h('b', {}, 'Possíveis movimentações repetidas (' + this.state.bank.data.suspectedDuplicates.length + ')'), h('p', {}, 'Encontramos registros semelhantes em conexões diferentes. Confira antes de revisar: os valores não foram removidos ou mesclados.')), this.state.bank.data.suspectedDuplicates.slice(0, 3).map(d => h('div', { className: 'mf-duplicate-row', key: d.pairKey }, h('span', {}, d.date.split('-').reverse().join('/') + ' · ' + d.description + ' · ' + fmt(Math.abs(d.amount))), h('button', { className: 'ghost-button', onClick: () => this.dismissBankDuplicate(d.pairKey) }, 'Ignorar aviso')))) : null, review ? h(Card, { className: 'mf-review-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'SUA CAIXA DE REVISÃO'), h('h2', {}, count ? count + ' movimentações carregadas para conferir' : partialBank ? 'Nenhuma revisão pendente entre os registros carregados' : 'Tudo organizado! 🎉'), h('p', {}, count ? 'Revisão calculada sobre os registros bancários carregados, independentemente do período.' : 'Outros registros podem existir fora da janela carregada quando o histórico é parcial.')), h('button', { className: 'outlined-action', onClick: () => this.navigate('transactions') }, 'Ver todas as movimentações')) : null, h('div', { className: 'u2-summary-heading' }, h('div', {}, h('h2', {}, 'Seu histórico, com contexto'), h('p', {}, review ? 'Caixa de revisão · registros bancários carregados' : pDate(span.start) + ' a ' + pDate(span.end) + ' · filtros aplicados ao resumo')), hasBank && hasManual ? h('div', { className: 'u2-view-tabs', 'aria-label': 'Origem dos valores do resumo' }, ['bank', 'manual'].map(v => h('button', { type: 'button', 'aria-pressed': source === v, onClick: () => this.setState({ txSummarySource: v }) }, v === 'bank' ? 'Banco' : 'Manual'))) : null), h('div', { className: 'u2-metrics' }, [
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
            'aria-label': 'Remover filtro ' + chip.label, onClick: chip.clear }, chip.label, h(Icon, { name: 'close', size: 13 })))) : null, selected.length ? h(Card, { className: 'mf-bulk-toolbar' }, h('b', {}, selected.length + ' selecionada(s)'), h('button', { type: 'button', className: 'mf-new-category', onClick: () => this.openContextCategory('batch') }, '+ Nova categoria'), h(StyledSelect, { value: this.state.txBatchCategory, options: cats.map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (value) => this.setState({ txBatchCategory: value }) }), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => this.applyBankBatch({ category: this.state.txBatchCategory }) }, 'Aplicar categoria'), h('button', { className: 'primary-button', disabled: this.state.detailBusy, onClick: () => this.applyBankBatch({ reviewed: true }) }, 'Marcar revisadas'), h('button', { className: 'mf-small-link', onClick: () => this.setState({ txSelected: [] }) }, 'Limpar seleção')) : null, h(Card, { className: 'table-card' }, h('div', { className: 'mf-table-summary' }, h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ txSelected: shown.filter(t => t.origin === 'bank').map(t => t.raw.accountId + '|' + t.raw.id) }) }, 'Selecionar banco visível'), h('span', { role: 'status' }, filtered.length + ' resultados nos dados carregados' + (filtered.length > 500 ? ' · exibindo os primeiros 500; resumo inclui as demais linhas filtradas e carregadas' : '')), review ? h('span', {}, 'A revisar · todos os períodos carregados') : null, partialBank ? h('span', {}, 'Histórico bancário parcial') : null), !review ? h('details', { className: 'mf-table-help' }, h('summary', {}, 'Como editar'), h('p', {}, 'No nome: detalhes. Na categoria: edição. Divisões e vínculos ficam no detalhe.')) : null, h('div', { className: 'table-scroller' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Data', 'Movimentação', 'Categoria', 'Origem', 'Situação', 'Valor', 'Ação'].map((n, i) => h('th', { key: i }, n)))), h('tbody', {}, shown.length ? shown.map((t, index) => {
            var _a;
            const bank = t.origin === 'bank', v = t.raw, category = cats.find(c => c.name === t.category);
            return [this.state.txGroupByDate && (!index || shown[index - 1].date !== t.date) ? h('tr', { className: 'mf-tx-day', key: 'day-' + t.key }, h('th', { colSpan: 8, scope: 'rowgroup' }, pDate(t.date))) : null, h('tr', { key: t.key, className: selected.includes(t.raw.accountId + '|' + t.raw.id) ? 'is-selected' : '' }, h('td', {}, bank ? h('input', { type: 'checkbox', className: 'mf-check', checked: this.bankTxSelected(v), title: 'Selecionar para ação em lote', onChange: () => this.toggleSelected(v) }) : null), h('td', { className: 'muted' }, t.date.split('-').reverse().join('/')), h('td', {}, h('button', { className: 'mf-row-detail', title: 'Abrir detalhes', onClick: () => bank ? this.openBankDetail(v) : this.openManualDetail(t.raw) }, h('span', { className: 'mf-row-emoji' }, (category === null || category === void 0 ? void 0 : category.emoji) || '✨'), h('span', {}, h('b', {}, t.merchant || t.description), t.merchant && t.merchant !== t.description ? h('small', {}, t.description) : null, bank && v.linkedManualId ? h('small', { className: 'mf-linked' }, '✓ Conferido com lançamento manual') : null))), h('td', {}, h(TransactionCategoryButton, { category: t.category, emoji: category === null || category === void 0 ? void 0 : category.emoji,
                    label: 'Editar categoria de ' + (t.merchant || t.description) + ' · ' + t.date.split('-').reverse().join('/') + ' · ' + t.account + ' · ' + (t.amount >= 0 ? '+' : '−') + fmt(Math.abs(t.amount)),
                    expanded: !!this.state.quickCategory && this.state.quickCategory.origin === t.origin && this.state.quickCategory.id === t.raw.id && (t.origin === 'manual' || this.state.quickCategory.accountId === t.raw.accountId),
                    disabled: this.state.quickCategoryBusy || this.state.busy,
                    onClick: (e) => this.openCategoryFromRow(t.origin, t.raw, e) }), bank && ((_a = v.splits) === null || _a === void 0 ? void 0 : _a.length) ? h('small', { className: 'mf-muted-block' }, 'Dividida em ' + v.splits.length + ' partes') : null), h('td', {}, t.account), h('td', {}, bank ? h('span', { className: 'mf-status-group' }, h('span', { className: 'kind-pill' }, t.status === 'POSTED' ? 'Confirmada' : t.status === 'PENDING' ? 'Pendente no banco' : t.status), h('small', { className: v.reviewed ? 'u2-reviewed' : 'u2-to-review' }, v.reviewed ? '✓ Revisada' : 'A conferir'), effectiveNature(v) === 'transfer' ? h('small', {}, 'Transferência') : effectiveNature(v) === 'ignore' ? h('small', {}, 'Desconsiderada') : null) : h('span', { className: 'kind-pill' }, 'Manual')), h('td', { className: t.amount >= 0 ? 'good-text amount-cell' : 'amount-cell' }, (t.amount >= 0 ? '+' : '−') + fmt(Math.abs(t.amount))), h('td', {}, bank && !v.reviewed ? h('button', { className: 'mf-quick-review', disabled: this.state.detailBusy || this.reviewSavingKeys.has(v.accountId + '|' + v.id), onClick: () => this.markBankReviewed(v), title: 'Conferir esta movimentação sem abrir detalhes' }, '✓ Revisar') : null))];
        }) : h('tr', {}, h('td', { colSpan: 8, className: 'empty-table' }, review ? 'Não há movimentações para revisar.' : 'Não há movimentações neste período.')))))));
    }
    renderCategoryEditor() {
        var _a, _b;
        const e = this.state.categoryEditor, categories = this.getCategories();
        return h('div', { className: 'mf-category-editor' }, h('h3', { id: 'mf-category-editor-heading', tabIndex: -1 }, e.previousName ? 'Editar categoria' : 'Criar categoria'), this.field('Nome', h('input', { className: 'form-control', value: e.name, maxLength: 50, placeholder: 'Ex.: Pets, Delivery, Estudos', disabled: !!(e.previousName && ((_a = categories.find(c => c.name === e.previousName)) === null || _a === void 0 ? void 0 : _a.builtIn)), onChange: (v) => this.setState({ categoryEditor: { ...e, name: v.target.value } }) })), this.field('Tipo de categoria', h(StyledSelect, { value: e.kind, disabled: !!(e.previousName && ((_b = categories.find(c => c.name === e.previousName)) === null || _b === void 0 ? void 0 : _b.builtIn)), options: [{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Receita' }, { value: 'both', label: 'Entrada ou saída' }], onChange: (kind) => this.setState({ categoryEditor: { ...e, kind } }) })), h('div', { className: 'category-appearance' }, h('div', { className: 'category-preview', style: { borderColor: e.color + '75' } }, h('span', { className: 'category-preview-icon', style: { background: e.color + '26', boxShadow: '0 0 24px ' + e.color + '25' } }, e.emoji || '✨'), h('div', {}, h('small', {}, 'PRÉVIA DA CATEGORIA'), h('strong', {}, e.name.trim() || 'Minha categoria'), h('span', {}, 'Você escolhe como organizar cada movimentação.'))), h('div', { className: 'appearance-label' }, h('b', {}, 'Escolha um emoji'), h('span', {}, 'Um símbolo para reconhecer rapidamente seus gastos')), h('div', { className: 'emoji-grid', role: 'group', 'aria-label': 'Escolha um emoji' }, (this.state.categoryMoreEmojis ? EMOJI_OPTIONS : Array.from(new Set([...EMOJI_OPTIONS.slice(0, 18), e.emoji]))).map(emoji => h('button', { type: 'button', key: emoji,
            className: 'emoji-choice ' + (e.emoji === emoji ? 'selected' : ''), 'aria-label': 'Usar emoji ' + emoji, 'aria-pressed': e.emoji === emoji,
            onClick: () => this.setState({ categoryEditor: { ...e, emoji } }) }, emoji))), h('button', { className: 'mf-small-link', type: 'button', onClick: () => this.setState({ categoryMoreEmojis: !this.state.categoryMoreEmojis }) }, this.state.categoryMoreEmojis ? 'Mostrar menos emojis' : 'Explorar todos os emojis'), h('div', { className: 'appearance-label' }, h('b', {}, 'Sua paleta de cores'), h('span', {}, 'Cores que combinam com o tema escuro')), h('div', { className: 'color-grid', role: 'group', 'aria-label': 'Escolha uma cor' }, COLOR_OPTIONS.map(color => h('button', { key: color, type: 'button',
            className: 'color-choice ' + (e.color === color ? 'selected' : ''), style: { background: color }, 'aria-label': 'Cor ' + color, 'aria-pressed': e.color === color,
            onClick: () => this.setState({ categoryEditor: { ...e, color } }) }, e.color === color ? '✓' : null))), h('label', { className: 'custom-color-label' }, 'Cor personalizada (opcional)', h('input', { key: e.previousName + '-' + e.color, className: 'color-hex-input', defaultValue: e.color,
            maxLength: 7, spellCheck: false, placeholder: '#3e9a85', onBlur: (v) => { const color = String(v.target.value).trim(); if (/^#[0-9a-fA-F]{6}$/.test(color))
                this.setState({ categoryEditor: { ...e, color: color.toLowerCase() } });
            else
                v.target.value = e.color; }, onKeyDown: (v) => { if (v.key === 'Enter')
                v.currentTarget.blur(); } }))), h('div', { className: 'toolbar-actions' }, h('button', { className: 'primary-button', disabled: this.state.categoryContextBusy, onClick: () => this.saveCategory() }, this.state.categoryContextBusy ? 'Salvando…' : e.previousName ? 'Salvar alterações' : 'Adicionar categoria'), e.previousName ? h('button', { className: 'ghost-button', onClick: () => this.setState({ categoryEditor: { previousName: '', name: '', color: '#3e9a85', emoji: '✨', kind: 'expense' } }) }, 'Cancelar edição') : null));
    }
    openContextCategory(target) {
        var _a;
        if (this.state.mode === 'demo' || !desktop || this.state.quickCategoryBusy)
            return;
        this.setState({ contextCategory: { target, editor: { ...this.state.categoryEditor }, mode: this.state.mode, account: this.state.bankFilter, query: this.state.query }, categoryEditor: { previousName: '', name: target === 'quick' ? this.state.quickCategoryQuery : '', color: '#3e9a85', emoji: '✨', kind: target === 'entry' ? this.state.entry.kind : ((_a = this.quickCategoryContext()) === null || _a === void 0 ? void 0 : _a.kind) || 'expense' }, categoryMessage: '' });
    }
    closeContextCategory() { if (this.state.categoryContextBusy)
        return; const c = this.state.contextCategory; this.setState({ contextCategory: undefined, categoryEditor: (c === null || c === void 0 ? void 0 : c.editor) || this.state.categoryEditor }); }
    renderContextCategory() { return h('div', { className: 'modal-backdrop mf-context-category', onMouseDown: (e) => { if (e.target === e.currentTarget)
            this.closeContextCategory(); } }, h('section', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nova categoria sem sair da classificação' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'ORGANIZAR SEM INTERROMPER'), h('h2', {}, 'Nova categoria')), h('button', { className: 'close-button', disabled: this.state.categoryContextBusy, 'aria-label': 'Voltar à classificação', onClick: () => this.closeContextCategory() }, '×')), h('p', { className: 'muted-desc' }, 'Seu lançamento, filtros e seleção continuam aqui. Salvar cria a categoria; a classificação ainda exige sua ação.'), this.state.categoryMessage ? h('p', { role: 'status' }, this.state.categoryMessage) : null, this.renderCategoryEditor())); }
    renderCategories() {
        const categories = this.getCategories(), rules = this.state.rules, e = this.state.categoryEditor, r = this.state.ruleEditor;
        const preview = findCategoryRule(this.state.ruleTest, 'bank', rules);
        return h('div', { className: 'section categories-page' }, h('div', { className: 'intro-banner' }, h('div', {}, h('span', { className: 'micro-label' }, 'ORGANIZAÇÃO AUTOMÁTICA'), h('h2', {}, 'Seu dinheiro, suas categorias.'), h('p', {}, 'Personalize os nomes e cores, crie regras por descrição e ajuste lançamentos individualmente. Tudo funciona localmente, sem IA paga.')), h('div', { className: 'banner-orb' }, h(Icon, { name: 'filter', size: 46 }))), desktop && this.state.mode === 'real' ? h(Card, { className: 'mf-category-import' }, h('div', {}, h('b', {}, 'Classificação inteligente preparada para você'), h('p', {}, 'Aplique um arquivo de sugestões revisadas. O aplicativo preserva suas correções, cria uma cópia de segurança e mantém movimentações duvidosas para você analisar.')), h('button', { className: 'primary-button', onClick: () => this.importCategoryPack() }, h(Icon, { name: 'upload', size: 17 }), 'Importar sugestões')) : null, this.state.mode === 'demo' ? h(Card, { className: 'settings-card' }, h('h2', {}, 'Modo demonstração'), h('p', {}, 'A edição de regras e categorias está disponível somente nos seus dados pessoais.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')) :
            h('div', { className: 'categories-layout' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Categorias personalizadas'), h('p', {}, 'As categorias padrão podem mudar de cor. Categorias criadas por você podem ser renomeadas.'))), h('div', { className: 'category-list' }, categories.map(cat => h('div', { className: 'category-list-row', key: cat.name }, h('span', { className: 'category-emoji-icon', style: { background: cat.color + '20', borderColor: cat.color + '70' } }, cat.emoji || '✨'), h('b', {}, cat.name), h('small', { className: 'mf-category-kind-tag' }, cat.kind === 'income' ? 'Receita' : cat.kind === 'expense' ? 'Gasto' : 'Entrada ou saída'), cat.builtIn ? h('small', { className: 'muted' }, 'Padrão') : null, h('button', { className: 'small-link', onClick: () => this.setState({ categoryEditor: { previousName: cat.name, name: cat.name, color: cat.color, emoji: cat.emoji || '✨', kind: cat.kind } }) }, 'Editar'), !cat.builtIn ? h('button', { className: 'trash-button', title: 'Excluir categoria sem uso', onClick: () => this.deleteCategory(cat.name) }, h(Icon, { name: 'trash', size: 16 })) : null))), this.renderCategoryEditor()), h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Regras automáticas'), h('p', {}, 'Ex.: descrição contém IFOOD → Alimentação. Menor prioridade vence; empate segue a regra mais antiga.'))), h('div', { className: 'rule-list' }, rules.length ? rules.map(rule => h('div', { className: 'rule-list-row', key: rule.id }, h('div', {}, h('strong', {}, rule.pattern), h('small', {}, (rule.matchMode === 'exact' ? 'Texto exato' : rule.matchMode === 'starts' ? 'Começa com' : 'Contém') + ' · ' + (rule.scope === 'both' ? 'Banco e manuais' : rule.scope === 'bank' ? 'Banco' : 'Manuais') + ' · Prioridade ' + rule.priority)), h('span', { className: 'category-tag' }, rule.category), h('button', { className: 'small-link', onClick: () => this.setState({ ruleEditor: { id: rule.id, pattern: rule.pattern, matchMode: rule.matchMode, category: rule.category, scope: rule.scope, priority: String(rule.priority) } }) }, 'Editar'), h('button', { className: 'trash-button', title: 'Excluir regra', onClick: () => this.deleteRule(rule.id) }, h(Icon, { name: 'trash', size: 16 })))) : h('p', { className: 'muted-desc' }, 'Nenhuma regra criada. Cadastre a primeira abaixo.')), h('div', { className: 'rule-suggestions' }, h('small', {}, 'Modelos rápidos:'), [
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
        if (this.state.qa84BudgetDrill)
            return renderQA84BudgetDetail(this, {});
        return h('div', { className: 'section mf-budget-section u3-budgets' }, h('div', { className: 'mf-budget-heading' }, h('div', {}, h('p', {}, mode === 'expense' ? 'Acompanhe seus limites por categoria.' : 'Veja a composição das receitas recebidas.')), h('div', { className: 'mf-budget-switch', role: 'group', 'aria-label': 'Visualização financeira' }, h('button', { type: 'button', className: mode === 'expense' ? 'active' : '', 'aria-pressed': mode === 'expense', onClick: () => this.setState({ budgetTab: 'expense', showAllBudgetCategories: false, budgetFocus: 'all', budgetSearch: '' }) }, 'Gastos'), h('button', { type: 'button', className: mode === 'income' ? 'active' : '', 'aria-pressed': mode === 'income', onClick: () => this.setState({ budgetTab: 'income', showAllBudgetCategories: false, budgetFocus: 'all', budgetSearch: '' }) }, 'Receitas'))), this.renderSourcePicker(), h('p', { className: 'mf-budget-context' }, prettyMonth(this.state.month) + ' · ' + (mode === 'expense' ? 'Gastos do mês e limites cadastrados por categoria' : 'Composição das receitas recebidas, sem incluir transferências próprias confirmadas')), mode === 'expense' ? h('div', { className: 'mf-budget-summary mf-budget-summary-four' }, h('div', { className: 'mf-border-reveal mf-tone-expense', role: 'group', tabIndex: 0 }, h('small', {}, 'Gasto nas categorias com limite'), h('strong', {}, fmt(spentLimited))), h('div', { className: 'mf-border-reveal mf-tone-balance', role: 'group', tabIndex: 0 }, h('small', {}, 'Limites cadastrados'), h('strong', {}, limited.length ? fmt(limitTotal) : 'Sem limites')), h('div', { className: 'mf-border-reveal mf-tone-net ' + (limited.length ? (margin < 0 ? 'is-negative' : 'is-positive') : 'is-neutral'), role: 'group', tabIndex: 0 }, h('small', {}, margin < 0 ? 'Excesso nos limites' : 'Margem nos limites'), h('strong', { className: margin < 0 ? 'bad-text' : '' }, limited.length ? fmt(Math.abs(margin)) : 'Sem limites'), h('small', {}, 'Não representa saldo disponível')), h('div', { className: 'mf-border-reveal mf-tone-warning', role: 'group', tabIndex: 0 }, h('small', {}, 'Gasto fora dos limites'), h('strong', {}, fmt(Math.max(0, total - spentLimited))))) :
            h('div', { className: 'mf-budget-summary' }, h('div', {}, h('small', {}, 'Total recebido no período'), h('strong', {}, fmt(total))), h('div', {}, h('small', {}, 'Origens com recebimentos'), h('strong', {}, String(entries.filter(x => x.total > 0).length))), h('div', {}, h('small', {}, 'Maior fonte de receita'), h('strong', {}, entries.length ? entries.slice().sort((a, b) => b.total - a.total)[0].info.name : 'Nenhuma ainda'))), mode === 'expense' ? h('section', { className: 'u3-budget-insight' }, h('div', { className: 'u3-coverage' }, h('div', { className: 'u3-coverage-ring', 'aria-hidden': 'true', style: { background: 'conic-gradient(var(--u3-accent) ' + (signals.covered || 0) + '%, var(--surface3) 0)' } }, h('strong', {}, signals.covered === null ? '—' : signals.covered + '%')), h('div', {}, h('h2', {}, 'Gastos com um limite definido'), h('p', {}, signals.covered === null ? 'Sem gastos nesta fonte e mês.' : signals.covered + '% dos gastos do mês estão em categorias com limite.'), h('small', {}, 'Cobertura do orçamento · não é dinheiro reservado'))), h('div', { className: 'u3-budget-actions' }, [
            { key: 'attention', count: signals.exceeded + signals.near, title: 'Pedem atenção', description: signals.exceeded + ' acima · ' + signals.near + ' perto do limite', icon: 'alert' },
            { key: 'unlimited', count: signals.unlimited, title: 'Sem limite', description: 'Categorias com gastos para organizar', icon: 'layers' }
        ].map(x => h('button', { type: 'button', className: 'u3-insight-action', 'aria-pressed': focus === x.key, onClick: () => this.setState({ budgetFocus: focus === x.key ? 'all' : x.key, budgetSearch: '' }) }, h(Icon, { name: x.icon, size: 18 }), h('span', {}, h('b', {}, x.title), h('small', {}, x.description)), h('strong', {}, x.count), h(Icon, { name: 'chevron-right', size: 15 }))))) : null, useBank && this.state.bank.data.truncated && !this.state.bank.data.dailyTotals ? h('p', { className: 'mf-budget-warning' }, 'Histórico carregado parcialmente. Valores e cobertura refletem somente os registros disponíveis.') : null, mode === 'expense' ? h('p', { className: 'mf-budget-contract' }, 'O mês filtra os gastos. Os limites cadastrados são recorrentes e valem para todos os meses.') : null, mode === 'income' && this.state.planning.items.some(x => x.kind === 'income' && x.dueDate.slice(0, 7) === this.state.month && x.remaining > 0 && x.status !== 'cancelled') ?
            h('p', { className: 'mf-budget-expected' }, 'Recebimentos ainda previstos no Planejamento: ' + fmt(this.state.planning.items.filter(x => x.kind === 'income' && x.dueDate.slice(0, 7) === this.state.month && x.remaining > 0 && x.status !== 'cancelled').reduce((sum, x) => sum + x.remaining, 0)) + '. Não somados às receitas já recebidas.') : null, unclassified > 0 ? h('div', { className: 'mf-budget-warning', role: 'status' }, 'Há ' + fmt(unclassified) + ' em ' + (mode === 'expense' ? 'despesas' : 'receitas') + ' com categorias incompatíveis ou ainda não identificadas. Confira em Movimentações.') : null, h('div', { className: 'u3-budget-toolbar' }, h('div', { className: 'u2-view-tabs', 'aria-label': 'Filtro de categorias' }, (mode === 'income' ? [{ value: 'all', label: 'Recebimentos' }] : [{ value: 'all', label: 'Todas' }, { value: 'attention', label: 'Atenção' }, { value: 'unlimited', label: 'Sem limite' }]).map(x => h('button', { type: 'button', 'aria-pressed': focus === x.value, onClick: () => this.setState({ budgetFocus: x.value }) }, x.label))), h('div', { className: 'search-box' }, h(Icon, { name: 'search', size: 16 }), h('input', { 'aria-label': 'Buscar categoria no orçamento', placeholder: 'Buscar categoria', value: search, onChange: (e) => this.setState({ budgetSearch: e.target.value }) }))), h('div', { className: 'u3-budget-list-heading' }, h('h2', {}, mode === 'expense' ? 'Limites por categoria' : 'Origens da sua renda'), h('span', { role: 'status' }, visible.length + ' categoria(s)')), visible.length ? renderQA84BudgetCards(this, visible, mode, total, useBank, suggestLimit) : h(Card, { className: 'mf-budget-empty' }, h('h3', {}, entries.length ? 'Nenhuma categoria para estes filtros' : mode === 'income' ? 'Nenhuma receita neste período' : 'Nenhum gasto neste período'), h('p', {}, entries.length ? 'Altere o filtro ou a busca para ver outras categorias.' : mode === 'income' ? 'As receitas aparecerão aqui depois de serem registradas ou sincronizadas.' : 'Suas despesas aparecerão aqui quando houver movimentações.')), quiet.length ? h('div', { className: 'mf-budget-quiet' }, h('button', { className: 'mf-budget-quiet-trigger', type: 'button', 'aria-expanded': this.state.showAllBudgetCategories,
            onClick: () => this.setState({ showAllBudgetCategories: !this.state.showAllBudgetCategories }) }, this.state.showAllBudgetCategories ? 'Ocultar outras categorias' : 'Ver outras categorias (' + quiet.length + ')', h(Icon, { name: this.state.showAllBudgetCategories ? 'chevron-up' : 'chevron-down', size: 16 })), this.state.showAllBudgetCategories ? h('div', { className: 'mf-budget-quiet-grid' }, quiet.map(c => h('div', { className: 'mf-budget-quiet-row', key: c.name }, h('span', { className: 'qa84-category-combo' }, h(CategoryVisualGlyph, { identity: resolveCategoryVisualIdentity({ categoryName: c.name, catalog: this.state.qa84VisualCatalog || [], aggregate: true }), size: 17 }), c.name), mode === 'expense' ? h('button', { className: 'small-link', onClick: () => this.setState({ editModal: { type: 'budget', key: c.name, title: 'Definir limite · ' + c.name, value: '' } }) }, 'Definir limite') : h('span', { className: 'muted' }, 'Sem receitas neste mês')))) : null) : null, h('p', { className: 'mf-budget-disclaimer' }, 'Pix para terceiros continuam como entradas ou saídas até que sejam identificados como transferências próprias. Reembolsos sem vínculo são mostrados como entradas, não abatimentos automáticos de gastos.'));
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        if (this.state.mode === 'demo')
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Suas contas estão disponíveis nos dados pessoais'), h('p', { className: 'muted-desc' }, 'O modo demonstração é isolado e nunca consulta suas contas bancárias.'), h('button', { className: 'primary-button', onClick: () => this.toggleMode() }, 'Voltar aos meus dados')));
        if (!desktop)
            return h('div', { className: 'section' }, h(Card, { className: 'settings-card' }, h('h2', {}, 'Abra o Meu Financeiro'), h('p', {}, 'Abra a versão instalada para consultar suas contas com segurança.')));
        const b = this.state.bank, c = b.config || EMPTY_BANK.config, accounts = b.data.accounts || [], tx = b.data.transactions || [], f = this.state.bankForm;
        const coverage = bankBalanceCoverage(accounts), now = Date.now(), signals = accounts.map(account => ({ account, ...u3AccountSignals(account, tx, now) })), attention = signals.filter(x => x.attention), shown = this.state.accountFocus === 'attention' ? signals.filter(x => x.attention) : signals;
        const issues = (b.data.items || []).filter(x => !['UPDATED', 'UPDATING'].includes(x.status));
        return h('div', { className: 'section bank-page u3-accounts' }, h('div', { className: 'u3-section-heading' }, h('div', {}, h('h2', {}, 'Seu dinheiro, conta por conta.'), h('p', {}, 'Saldos recebidos e qualidade da referência em um só lugar.')), h('button', { type: 'button', className: 'primary-button', disabled: !c.configured || this.state.bankBusy || ((_a = b.connection) === null || _a === void 0 ? void 0 : _a.isolated), onClick: () => this.syncBank() }, h(Icon, { name: 'refresh', size: 16 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar contas')), h('div', { className: 'mf-accounts-summary u3-account-summary' }, h(Card, { className: 'mf-account-total mf-border-reveal mf-tone-balance' }, h('small', {}, 'Saldo bancário de referência'), h('strong', {}, bankBalanceLabel(coverage)), h('p', {}, 'Não somado aos registros manuais')), h(Card, { className: 'mf-account-count mf-border-reveal mf-tone-neutral' }, h('small', {}, 'Contas com saldo informado'), h('strong', {}, coverage.knownCount + ' de ' + accounts.length), h('p', {}, coverage.missingCount ? coverage.missingCount + ' saldo(s) indisponível(is)' : 'Zero informado é diferente de saldo ausente')), h(Card, { className: 'u3-account-signal mf-border-reveal mf-tone-income' }, h('small', {}, 'Referência de até 24h'), h('strong', {}, signals.filter(x => x.reference.status === 'recent').length + ' conta(s)'), h('p', {}, 'O horário não garante saldo em tempo real')), h('button', { type: 'button', className: 'u3-account-signal u3-clickable-card mf-border-reveal mf-tone-warning', 'aria-pressed': this.state.accountFocus === 'attention', onClick: () => this.setState({ accountFocus: this.state.accountFocus === 'attention' ? 'all' : 'attention' }) }, h('small', {}, 'Conferir referência'), h('strong', {}, attention.length + ' conta(s)'), h('p', {}, 'Saldo ausente, antigo ou sem horário'))), ((_b = b.connection) === null || _b === void 0 ? void 0 : _b.isolated) ? h('div', { className: 'u3-connection-alert', role: 'status' }, h(Icon, { name: 'shield', size: 18 }), h('span', {}, 'Esta versão de testes utiliza dados separados da instalação principal. Pluggy e sincronização estão desativadas neste canal.'), h('button', { type: 'button', className: 'mf-small-link',
            onClick: () => this.setState({ bankIntegrationsOpen: true }) }, 'Ver conexão')) : null, ((_c = b.connection) === null || _c === void 0 ? void 0 : _c.error) ? h('div', { className: 'u3-connection-alert', role: 'alert' }, h(Icon, { name: 'alert', size: 18 }), h('span', {}, b.connection.error), h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ bankIntegrationsOpen: true }) }, 'Ver conexão')) : null, !c.configured && !((_d = b.connection) === null || _d === void 0 ? void 0 : _d.isolated) ? h('div', { className: 'u3-connection-alert', role: 'status' }, h(Icon, { name: 'bank', size: 18 }), h('span', {}, ((_e = b.connection) === null || _e === void 0 ? void 0 : _e.profileState) === 'new' ?
            'Instalação estável nova: nenhum banco anterior foi encontrado nos perfis reconhecidos. Não importe dados nem configure antes de conferir seu perfil anterior.' :
            'Não há conexão Pluggy configurada neste perfil. O histórico salvo, se existir, continua disponível offline.'), h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ bankIntegrationsOpen: true }) }, 'Configurar conexão')) : null, issues.length ? h('div', { className: 'u3-connection-alert', role: 'status' }, h(Icon, { name: 'alert', size: 18 }), h('span', {}, issues.length + ' conexão(ões) precisam de conferência. Os valores abaixo podem estar desatualizados.'), h('button', { type: 'button', className: 'mf-small-link', onClick: () => this.setState({ bankIntegrationsOpen: true }) }, 'Ver conexão')) : null, accounts.length ? h('section', { className: 'mf-accounts-first' }, h('div', { className: 'mf-bank-account-heading' }, h('h2', {}, 'Saldos por conta'), h('small', {}, 'Atualização: ' + (((_f = b.data.last) === null || _f === void 0 ? void 0 : _f.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'não informada'))), h('div', { className: 'u3-account-toolbar' }, h('div', { className: 'u2-view-tabs', 'aria-label': 'Filtro de contas' }, [{ value: 'all', label: 'Todas as contas' }, { value: 'attention', label: 'Conferir referência' }].map(x => h('button', { type: 'button', 'aria-pressed': (this.state.accountFocus || 'all') === x.value, onClick: () => this.setState({ accountFocus: x.value }) }, x.label))), h('span', {}, 'Contadores do histórico carregado · todos os períodos')), shown.length ? h('div', { className: 'bank-account-grid' }, shown.map(({ account: a, reference, pending, review, count }) => h(Card, { className: 'bank-account u3-account-card', key: a.id }, h('div', { className: 'u3-account-card-head' }, h('span', { className: 'bank-account-icon' }, h(Icon, { name: 'bank', size: 20 })), h('div', {}, h('h3', {}, a.name), h('small', {}, u3AccountType(a.subtype))), h('span', { className: 'u3-reference-badge is-' + reference.status }, reference.label)), h('small', { className: 'u3-balance-label' }, 'Saldo informado'), h('strong', {}, Number.isFinite(a.balance) ? fmt(a.balance) : 'Saldo não disponível'), h('span', { className: 'u3-reference-date' }, 'Referência recebida: ' + bankReferenceLabel(a.updatedAt)), h('div', { className: 'u3-account-counts' }, h('div', {}, h('b', {}, count), h('small', {}, 'registros')), h('div', {}, h('b', {}, pending), h('small', {}, 'pendentes no banco')), h('div', {}, h('b', {}, review), h('small', {}, 'a conferir'))), h('button', { type: 'button', className: 'u3-account-open', onClick: () => { this.setState({ bankFilter: a.id, txSource: 'bank', query: '', txSelected: [] }); this.navigate('transactions'); } }, 'Abrir movimentações', h(Icon, { name: 'arrow', size: 15 }))))) : h('p', { className: 'u3-empty' }, 'Nenhuma conta precisa de conferência de referência.')) :
            h(Card, { className: 'u3-empty-accounts' }, h(Icon, { name: 'bank', size: 28 }), h('h2', {}, c.configured ? 'Sua conexão está configurada' : 'Vamos conectar suas contas?'), h('p', {}, c.configured ? 'Atualize para receber as contas e seus saldos.' : 'Configure sua conexão abaixo. Nenhuma senha bancária é solicitada aqui.')), h('details', { className: 'mf-bank-integrations', open: this.state.bankIntegrationsOpen || !accounts.length, onToggle: (e) => { if (this.state.bankIntegrationsOpen !== e.currentTarget.open)
                this.setState({ bankIntegrationsOpen: e.currentTarget.open }); } }, h('summary', {}, h(Icon, { name: 'settings', size: 17 }), 'Conexão e sincronização'), h('div', { className: 'bank-grid' }, h(Card, { className: 'settings-card' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Sua conexão bancária'), h('p', {}, c.configured ? 'Acesso conectado e protegido' : ((_g = b.connection) === null || _g === void 0 ? void 0 : _g.isolated) ? 'Nesta RC, os dados são separados e a conexão é desativada.' : 'Conecte suas contas para acompanhar tudo aqui')), h('span', { className: 'bank-status ' + (c.configured ? 'enabled' : '') }, c.configured ? 'Configurada' : 'Não configurada')), ((_h = b.connection) === null || _h === void 0 ? void 0 : _h.isolated) ? h('p', { className: 'bank-warning' }, 'Canal experimental isolado: não configure credenciais pessoais nesta versão.') : null, !c.secure && !((_j = b.connection) === null || _j === void 0 ? void 0 : _j.isolated) ? h('p', { className: 'bank-warning' }, 'Não foi possível proteger sua chave neste computador. Evite configurar a conexão agora.') : null, c.configured ? h('button', { type: 'button', className: 'bank-details-toggle', 'aria-expanded': this.state.bankConfigOpen, onClick: () => this.setState({ bankConfigOpen: !this.state.bankConfigOpen }) }, h(Icon, { name: 'settings', size: 16 }), this.state.bankConfigOpen ? 'Ocultar detalhes da conexão' : 'Alterar dados da conexão') : null, (!c.configured || this.state.bankConfigOpen) ? h('div', { className: 'bank-settings-details' }, this.field('Código da aplicação', h('input', { className: 'form-control', value: f.clientId, placeholder: 'Cole o código de identificação', maxLength: 300, autoComplete: 'off', onChange: (e) => this.setState({ bankForm: { ...f, clientId: e.target.value } }) })), this.field('Chave privada', h('input', { className: 'form-control', type: 'password', value: f.clientSecret, placeholder: c.configured ? 'Já protegido — deixe vazio para manter' : 'Cole sua chave de acesso', maxLength: 1000, autoComplete: 'new-password', onChange: (e) => this.setState({ bankForm: { ...f, clientSecret: e.target.value } }) })), this.field('Código da conexão (separe por vírgula, se houver mais de uma)', h('textarea', { className: 'form-control bank-item-field', value: f.itemIds, rows: 2, placeholder: 'Cole o código da conta autorizada', onChange: (e) => this.setState({ bankForm: { ...f, itemIds: e.target.value } }) }), 'Use os códigos fornecidos ao autorizar a conexão. Nunca informe sua senha bancária.'), h('div', { className: 'bank-actions' }, h('button', { className: 'primary-button', disabled: !c.secure || this.state.bankBusy || ((_k = b.connection) === null || _k === void 0 ? void 0 : _k.isolated), onClick: () => this.configureBank() }, h(Icon, { name: 'shield', size: 17 }), 'Salvar conexão'))) : null, h('div', { className: 'bank-actions' }, h('button', { className: 'outlined-action full', disabled: !c.configured || this.state.bankBusy || ((_l = b.connection) === null || _l === void 0 ? void 0 : _l.isolated), onClick: () => this.syncBank() }, h(Icon, { name: 'refresh', size: 17 }), this.state.bankBusy ? 'Atualizando…' : 'Atualizar minhas contas')), h('div', { className: 'privacy-small' }, h(Icon, { name: 'shield', size: 17 }), 'Sua chave é protegida neste computador e não faz parte das cópias de segurança.'), c.configured ? h('button', { className: 'bank-forget', onClick: () => this.forgetBank(), disabled: this.state.bankBusy }, 'Desconectar conta deste computador') : null, this.state.bankMessage ? h('p', { className: 'bank-feedback', role: 'status' }, this.state.bankMessage) : null), h(Card, { className: 'settings-card' }, h('h2', {}, 'Resumo da sincronização'), h('div', { className: 'bank-metric-list' }, h('div', {}, h('span', {}, 'Contas bancárias'), h('strong', {}, String(accounts.length))), h('div', {}, h('span', {}, 'Movimentações no histórico local'), h('strong', {}, String((_m = b.data.totalTransactions) !== null && _m !== void 0 ? _m : tx.length))), h('div', {}, h('span', {}, 'Última sincronização'), h('strong', {}, ((_o = b.data.last) === null || _o === void 0 ? void 0 : _o.completedAt) ? new Date(b.data.last.completedAt).toLocaleString('pt-BR') : 'Nunca')), h('div', {}, h('span', {}, 'Novas na última consulta'), h('strong', {}, String((_q = (_p = b.data.last) === null || _p === void 0 ? void 0 : _p.newCount) !== null && _q !== void 0 ? _q : '—')))), h('p', { className: 'muted-desc' }, 'As instituições podem demorar para enviar novas movimentações. Atualizar busca as informações mais recentes disponíveis.'), h('div', { className: 'info-box' }, h(Icon, { name: 'alert', size: 19 }), h('p', {}, 'As movimentações do banco não são misturadas automaticamente aos lançamentos adicionados por você. Isso evita despesas em duplicidade.')), (b.data.items || []).map(x => h('div', { className: 'bank-item-info', key: x.itemId }, h('b', {}, (!x.institution || x.institution === 'Meu Pluggy' ? 'Conta conectada' : x.institution)), h('small', {}, 'Situação: ' + (x.status === 'UPDATED' ? 'Atualizada' : x.status === 'UPDATING' ? 'Atualizando' : x.status === 'LOGIN_ERROR' ? 'Precisa reconectar' : 'Verifique sua conexão')), h('small', {}, 'Consentimento: ' + (x.consentExpiresAt ? new Date(x.consentExpiresAt).toLocaleDateString('pt-BR') : 'conforme seu banco'))))))), h(Card, { className: 'mf-bank-route' }, h('div', {}, h('h2', {}, 'Histórico financeiro em um só lugar'), h('p', { className: 'muted-desc' }, 'Consulte as transações, revise categorias e veja detalhes em Movimentações. Aqui você gerencia apenas suas conexões e saldos.')), h('button', { className: 'primary-button', onClick: () => { this.setState({ bankFilter: '', txSource: 'bank' }); this.navigate('transactions'); } }, 'Ver movimentações', h(Icon, { name: 'arrow', size: 16 }))));
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
        var _a, _b, _c, _d;
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
        const sourceId = bank ? 'bank' : 'manual';
        const context = this.qa84D05DrawerIds;
        const matching = (context === null || context === void 0 ? void 0 : context.origin) === sourceId && context.id === selected.id &&
            (!bank || context.accountId === selected.accountId) ? context : null;
        const identity = qa84B03Visual({
            categoryId: (manual === null || manual === void 0 ? void 0 : manual.categoryId) || (tx === null || tx === void 0 ? void 0 : tx.categoryId) || (matching === null || matching === void 0 ? void 0 : matching.categoryId) || null,
            subcategoryId: (_c = (_b = (_a = manual === null || manual === void 0 ? void 0 : manual.subcategoryId) !== null && _a !== void 0 ? _a : tx === null || tx === void 0 ? void 0 : tx.subcategoryId) !== null && _b !== void 0 ? _b : matching === null || matching === void 0 ? void 0 : matching.subcategoryId) !== null && _c !== void 0 ? _c : null,
            categoryName: category
        }, this.state.qa84VisualCatalog || D05_APPROVED_PARENTS);
        const categoryAction = (label) => h('button', { type: 'button',
            className: 'mf-drawer-d05-category', title: 'Abrir classificação D05',
            'aria-label': label, onClick: (event) => qa84B03RequestDrawerPicker(event, sourceId, selected.id, bank ? selected.accountId : undefined) }, h(D05VectorIcon, { iconKey: identity.iconKey, hue: identity.hue, size: 24 }), h('span', {}, identity.source === 'sub' ? identity.parentLabel + ' › ' + identity.label :
            identity.source === 'fallback' ? category : identity.label));
        const f = this.state.detailDraft;
        const matchSuggestions = tx && tx.status === 'POSTED' ? this.state.data.transactions.filter(m => m.kind === (tx.amount >= 0 ? 'income' : 'expense') && m.amount === Math.abs(tx.amount) && Math.abs((Date.parse(m.date + 'T00:00:00Z') - Date.parse(tx.date + 'T00:00:00Z')) / 86400000) <= 3 && !this.state.bank.data.transactions.some(other => other.linkedManualId === m.id && (other.id !== tx.id || other.accountId !== tx.accountId))).slice(0, 6) : [];
        const opposite = tx ? this.state.bank.data.transactions.filter(other => other.accountId !== tx.accountId && other.amount === -tx.amount && Math.abs((Date.parse(other.date + 'T00:00:00Z') - Date.parse(tx.date + 'T00:00:00Z')) / 86400000) <= 2 && other.status === 'POSTED').slice(0, 3) : [];
        const splitTotal = f.splitParts.reduce((a, p) => a + parseMoney(p.value), 0);
        return h('div', { className: 'mf-drawer-backdrop', role: 'presentation', onMouseDown: (e) => { if (e.currentTarget === e.target)
                this.setState({ detail: null }); } }, h('aside', { className: 'mf-detail-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Detalhes da movimentação' }, h('div', { className: 'mf-drawer-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'DETALHES'), h('h2', {}, 'Movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', title: 'Fechar', onClick: () => this.setState({ detail: null }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'mf-detail-scroll' }, h('div', { className: 'mf-detail-hero' }, categoryAction('Alterar categoria de ' + name), h('h3', {}, name), h('strong', { className: amount >= 0 ? 'good-text' : 'bad-text' }, (amount >= 0 ? '+' : '−') + fmt(Math.abs(amount))), h('span', {}, ((tx === null || tx === void 0 ? void 0 : tx.date) || (manual === null || manual === void 0 ? void 0 : manual.date) || '').split('-').reverse().join('/') + ' · ' + ((tx === null || tx === void 0 ? void 0 : tx.accountName) || 'Adicionado por você'))), h('button', { type: 'button', className: 'mf-ai-detail-trigger', onClick: () => this.openIntelligenceContext('transactions') }, h(Icon, { name: 'spark', size: 17 }), 'Analisar com Inteligência', h('span', {}, 'Prévia')), tx ? h('div', { className: 'mf-detail-section' }, h('div', { className: 'mf-detail-section-title' }, h('b', {}, 'Organização'), h('span', { className: tx.reviewed ? 'mf-reviewed' : 'mf-to-review' }, tx.reviewed ? '✓ Revisada' : 'A conferir')), h('div', { className: 'mf-detail-grid' }, this.field('Categoria principal', categoryAction('Alterar classificação bancária de ' + name)), this.field('Tipo de movimentação', h(StyledSelect, { value: f.nature, options: [{ value: 'auto', label: 'Padrão' }, { value: 'income', label: 'Receita' }, { value: 'expense', label: 'Despesa' }, { value: 'transfer', label: 'Transferência própria' }, { value: 'ignore', label: 'Não contar nas análises' }], onChange: (nature) => this.setState({ detailDraft: { ...f, nature } }) }))), this.field('Nome do estabelecimento', h('input', { className: 'form-control', value: f.merchant, maxLength: 100, placeholder: 'Ex.: iFood, Mercado, Academia', onChange: (e) => this.setState({ detailDraft: { ...f, merchant: e.target.value } }) })), this.field('Anotações pessoais', h('textarea', { className: 'form-control mf-note-input', rows: 3, value: f.note, maxLength: 600, placeholder: 'Opcional: detalhes para lembrar desta compra', onChange: (e) => this.setState({ detailDraft: { ...f, note: e.target.value } }) })), h('label', { className: 'mf-review-checkbox' }, h('input', { type: 'checkbox', checked: f.reviewed, onChange: (e) => this.setState({ detailDraft: { ...f, reviewed: e.target.checked } }) }), 'Conferi esta movimentação'), h('button', { className: 'primary-button mf-full-action', disabled: this.state.detailBusy, onClick: () => this.updateBankInfo() }, 'Salvar detalhes')) : null, tx ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Reconhecer estabelecimento'), h('p', { className: 'muted-desc' }, 'Aplique o nome escolhido às próximas movimentações com o mesmo trecho de descrição.'), this.field('Trecho que identifica esse estabelecimento', h('input', { className: 'form-control', value: f.aliasPattern, maxLength: 120, onChange: (e) => this.setState({ detailDraft: { ...f, aliasPattern: e.target.value } }) })), h('button', { className: 'outlined-action full', disabled: this.state.detailBusy, onClick: () => this.createMerchantAlias() }, 'Usar este nome nas movimentações semelhantes'), h('button', { className: 'ghost-button', disabled: !this.qa84BankCategoryGateAuthorized || this.state.detailBusy,
            title: 'Regra bancária exige prévia supervisionada D05', onClick: () => this.createCategoryRuleFromDetail() }, 'Usar categoria nas movimentações semelhantes'), (this.state.bank.data.aliases || []).filter(a => fold(tx.description).includes(fold(a.pattern))).map(a => h('div', { className: 'mf-suggestion', key: a.id }, h('small', {}, 'Regra: ' + a.pattern + ' → ' + a.displayName), h('button', { className: 'mf-small-link', disabled: this.state.detailBusy, onClick: async () => { if (!confirm('Remover esta regra de nome?'))
                return; try {
                const data = await desktop.bankDeleteAlias(a.id);
                this.setState({ bank: { ...this.state.bank, data } });
                this.flash('Regra removida.');
            }
            catch (e) {
                this.flash('Não foi possível remover: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            } } }, 'Excluir')))) : null, tx && tx.amount < 0 ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Dividir compra'), h('p', { className: 'muted-desc' }, 'Distribua o valor entre categorias sem alterar o total da compra original.'), tx.splitOutdated ? h('p', { className: 'mf-inline-warning' }, 'O banco atualizou o valor desta compra. Revise a divisão antes de aplicá-la novamente.') : null, f.splitParts.map((part, i) => h('div', { className: 'mf-split-row', key: i }, h(StyledSelect, { value: part.category, options: cats.map(c => ({ value: c.name, label: c.emoji + ' ' + c.name })), onChange: (category) => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.map((v, j) => i === j ? { ...v, category } : v) } }) }), h('input', { className: 'form-control', value: part.value, inputMode: 'decimal', placeholder: '0,00', onChange: (e) => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.map((v, j) => i === j ? { ...v, value: e.target.value } : v) } }) }), h('button', { className: 'mf-small-link', title: 'Remover parte', disabled: f.splitParts.length <= 2, onClick: () => this.setState({ detailDraft: { ...f, splitParts: f.splitParts.filter((_, j) => j !== i) } }) }, h(Icon, { name: 'close', size: 18 })))), h('div', { className: 'mf-detail-split-footer' }, h('button', { className: 'mf-small-link', disabled: f.splitParts.length >= 20, onClick: () => this.setState({ detailDraft: { ...f, splitParts: [...f.splitParts, { category: category, value: '0,00' }] } }) }, '+ Adicionar parte'), h('strong', { className: splitTotal === Math.abs(tx.amount) ? 'good-text' : 'bad-text' }, fmt(Number.isFinite(splitTotal) ? splitTotal : 0) + ' / ' + fmt(Math.abs(tx.amount)))), h('div', { className: 'mf-action-row' }, h('button', { className: 'primary-button', disabled: !this.qa84BankCategoryGateAuthorized || this.state.detailBusy || splitTotal !== Math.abs(tx.amount) || f.splitParts.some(p => parseMoney(p.value) <= 0), title: 'Divisão bancária exige prévia D05', onClick: () => this.saveSplit() }, 'Salvar divisão'), h('button', { className: 'ghost-button', disabled: !this.qa84BankCategoryGateAuthorized || this.state.detailBusy || !((_d = tx.splits) === null || _d === void 0 ? void 0 : _d.length), title: 'Divisão bancária exige prévia D05', onClick: () => this.runBankOperation('bankSplit', { accountId: tx.accountId, externalId: tx.id, parts: [] }, 'Divisão removida.') }, 'Remover divisão'))) : null, tx ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Conferir com um lançamento seu'), tx.linkedManualId ? h('div', { className: 'mf-suggestion' }, h('span', {}, '✓ Vinculado a um lançamento que você adicionou'), h('button', { className: 'mf-small-link', disabled: this.state.detailBusy, onClick: () => this.setManualLink(null) }, 'Desvincular')) :
            matchSuggestions.length ? matchSuggestions.map(m => h('div', { className: 'mf-suggestion', key: m.id }, h('div', {}, h('b', {}, m.description), h('small', {}, m.date.split('-').reverse().join('/') + ' · ' + fmt(m.amount))), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => this.setManualLink(m.id) }, 'Vincular'))) : h('p', { className: 'muted-desc' }, 'Nenhum lançamento manual com mesmo valor, tipo e data próxima.')) : null, tx && opposite.length ? h('div', { className: 'mf-detail-section' }, h('b', {}, 'Possível transferência entre suas contas'), h('p', { className: 'muted-desc' }, 'Encontramos um valor oposto em outra conta. Confira antes de classificar.'), opposite.map(other => h('div', { className: 'mf-suggestion', key: other.id }, h('span', {}, other.accountName + ' · ' + fmt(Math.abs(other.amount))), h('button', { className: 'ghost-button', disabled: this.state.detailBusy, onClick: () => { if (confirm('Marcar ambas como transferência própria?'))
                this.runBankOperation('bankBatch', { items: [{ accountId: tx.accountId, externalId: tx.id }, { accountId: other.accountId, externalId: other.id }], nature: 'transfer', reviewed: true }, 'Movimentações marcadas como transferência interna.'); } }, 'Marcar ambas')))) : null, manual && this.state.manualDraft ? h('div', { className: 'mf-detail-section mf-manual-editor' }, h('b', {}, 'Editar lançamento manual'), h('p', { className: 'muted-desc' }, 'Altere os dados deste lançamento sem modificar os extratos das instituições conectadas.'), this.field('Descrição', h('input', { className: 'form-control', maxLength: 150, value: this.state.manualDraft.description,
            onChange: (e) => this.setState({ manualDraft: { ...this.state.manualDraft, description: e.target.value } }) })), h('div', { className: 'mf-detail-grid' }, this.field('Valor (R$)', h('input', { className: 'form-control', inputMode: 'decimal',
            value: this.state.manualDraft.value, disabled: this.isManualLinked(manual.id),
            onChange: (e) => this.setState({ manualDraft: { ...this.state.manualDraft, value: e.target.value } }) })), this.field('Data', h(SingleDatePicker, { value: this.state.manualDraft.date,
            disabled: this.isManualLinked(manual.id),
            onChange: (value) => this.setState({ manualDraft: { ...this.state.manualDraft, date: value } }) }))), this.field('Categoria do lançamento', categoryAction('Alterar categoria manual de ' + name)), this.isManualLinked(manual.id) ? h('p', { className: 'mf-manual-warning' }, 'Lançamento vinculado a uma movimentação bancária: desvincule antes de alterar data, valor ou excluir.') : null, h('div', { className: 'mf-manual-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: this.state.busy,
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
            this.setState({ showEntry: false }); } }, h('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Registrar movimentação' }, h('div', { className: 'modal-head' }, h('div', {}, h('small', { className: 'micro-label' }, 'NOVO LANÇAMENTO'), h('h2', {}, 'Registrar movimentação')), h('button', { className: 'close-button', type: 'button', 'aria-label': 'Fechar painel', onClick: () => this.setState({ showEntry: false }) }, h(Icon, { name: 'close', size: 18 }))), h('div', { className: 'segmented' }, ['expense', 'income'].map(k => h('button', { key: k, className: f.kind === k ? 'selected' : '', onClick: () => this.setState({ entry: { ...f, kind: k, category: this.state.entryCategoryTouched && this.getCategories().some(c => c.name === f.category && (k === 'income' ? c.kind !== 'expense' : c.kind !== 'income')) ? f.category : k === 'income' ? 'Salário' : 'Outros' } }) }, k === 'expense' ? 'Despesa' : 'Receita'))), this.field('Descrição', h('input', { className: 'form-control', placeholder: 'Ex.: supermercado', value: f.description, maxLength: 150, onChange: (e) => { const description = e.target.value; const category = this.state.entryCategoryTouched ? f.category : (findCategoryRule(description, 'manual', this.state.rules) || 'Outros'); this.setState({ entry: { ...f, description, category } }); } })), h('div', { className: 'two-inputs' }, this.field('Valor (R$)', h('input', { className: 'form-control', placeholder: '0,00', inputMode: 'decimal', value: f.value, onChange: (e) => this.setState({ entry: { ...f, value: e.target.value } }) })), this.field('Data', h(SingleDatePicker, { value: f.date, onChange: (value) => this.setState({ entry: { ...f, date: value } }) }))), this.field('Categoria', h(StyledSelect, { className: 'form-control', value: f.category, options: this.getCategories().filter(c => f.kind === 'income' ? c.kind !== 'expense' : c.kind !== 'income').map(c => ({ value: c.name, label: (c.emoji || '✨') + '  ' + c.name })), onChange: (value) => this.setState({ entry: { ...f, category: value }, entryCategoryTouched: true }) })), this.state.mode === 'real' ? h('button', { type: 'button', className: 'mf-new-category', onClick: () => this.openContextCategory('entry') }, '+ Nova categoria') : null, h('div', { className: 'modal-actions' }, h('button', { className: 'ghost-button', onClick: () => this.setState({ showEntry: false }) }, 'Cancelar'), h('button', { className: 'primary-button', onClick: () => this.saveEntry() }, h(Icon, { name: 'check', size: 18 }), 'Salvar lançamento')))); }
    render() { if (this.state.fatal)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Não foi possível abrir seus dados'), h('p', {}, this.state.fatal), h('p', {}, 'Se houver arquivos importantes, não desinstale a versão anterior nem apague a pasta de dados.')); if (this.state.booting && desktop)
        return h('main', { className: 'startup-error' }, h('h1', {}, 'Meu Financeiro'), h('p', {}, 'Preparando seus dados…')); return h('div', { className: 'shell' }, this.renderSide(), h('main', { className: 'main-area ' + (this.state.page === 'overview' ? 'u1-shell' : ['transactions', 'planning'].includes(this.state.page) ? 'u2-shell' : ['budgets', 'banks', 'assistant'].includes(this.state.page) ? 'u3-shell' : '') }, this.renderWorkspaceBar(), this.renderTop(), this.state.mode === 'demo' ? h('div', { className: 'demo-strip' }, h(Icon, { name: 'spark', size: 17 }), 'Você está explorando dados fictícios. Nada aqui altera suas finanças pessoais.', h('button', { onClick: () => this.toggleMode() }, 'Sair da demonstração')) : null, ({ overview: this.renderOverview, planning: this.renderPlanning, transactions: this.renderMovements, budgets: this.renderBudgets, banks: this.renderBanks, categories: this.renderCategories, assistant: this.renderAssistant, settings: this.renderSettings, intelligence: () => renderIntelligenceView(this) }[this.state.page] || this.renderOverview).call(this), h('footer', { className: 'footer' }, h('span', {}, desktop ? 'Meu Financeiro v0.9.5-beta.9 · Interface U3 · Feito para você' : 'Meu Financeiro v0.9.5-beta.9 · Interface U3 · Feito para você'), h('span', {}, this.state.cloudPersonalTransferred ? 'Personalizações em revisão na nuvem' : 'Fonte local · integração sob autorização'))), this.state.toast ? h('div', { className: 'toast' }, h(Icon, { name: 'check', size: 17 }), this.state.toast) : null, this.state.showEntry && !this.state.contextCategory ? this.renderEntryModal() : null, this.state.editModal ? this.renderEditModal() : null, this.state.detail ? this.renderDetailDrawer() : null, this.state.quickCategory && !this.state.contextCategory ? this.renderQuickCategoryPopover() : null, this.state.contextCategory ? this.renderContextCategory() : null, this.state.planSelected ? this.renderPlanDetail() : null, this.state.planOpen ? this.renderPlanModal() : null, renderIntelligencePanel(this), this.renderCSVPreview(), !this.state.intelligencePanelOpen && !this.state.showEntry && !this.state.editModal && !this.state.detail && !this.state.planOpen && !this.state.planSelected ? h('button', { type: 'button', className: 'mf-ai-fab', 'aria-label': 'Perguntar à IA sobre esta página', title: 'Perguntar à IA sobre esta página', onClick: () => this.openIntelligenceContext() }, h(Icon, { name: 'spark', size: 24 })) : null, h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, ref: (e) => this.fileInput = e, onChange: (e) => { var _a; if ((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0])
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
function d05CsvRecords(input) {
    if (typeof input !== 'string' || input.length > 4000000)
        throw Error('CSV excede limite de 4 MB.');
    const text = input.replace(/^\ufeff/, '');
    const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : Math.min(text.length, 2000));
    const separator = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], field = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (quoted && text[i + 1] === '"') {
                field += '"';
                i++;
                continue;
            }
            if (quoted) {
                quoted = false;
                closed = true;
                continue;
            }
            if (!field && !closed) {
                quoted = true;
                continue;
            }
            throw Error('CSV com aspas inválidas na linha ' + (rows.length + 1));
        }
        if (!quoted && (ch === separator || ch === '\n' || ch === '\r')) {
            row.push(field);
            field = '';
            closed = false;
            if (ch !== separator) {
                if (ch === '\r' && text[i + 1] === '\n')
                    i++;
                if (row.some(x => x.trim()))
                    rows.push(row);
                if (rows.length > 10001)
                    throw Error('CSV excede 10.000 linhas.');
                row = [];
            }
            continue;
        }
        if (closed && !/\s/.test(ch))
            throw Error('CSV com texto após as aspas');
        if (field.length >= 1000)
            throw Error('CSV contém campo acima de 1.000 caracteres.');
        field += ch;
    }
    if (quoted)
        throw Error('CSV com campo entre aspas não encerrado.');
    if (field.length || row.length) {
        row.push(field);
        if (row.some(x => x.trim()))
            rows.push(row);
    }
    if (rows.length < 2)
        throw Error('CSV vazio ou sem lançamentos.');
    if (rows.length > 10001)
        throw Error('CSV excede 10.000 linhas.');
    const cols = rows[0].length;
    if (cols < 3 || cols > 40 || rows.some(r => r.length !== cols))
        throw Error('CSV possui número irregular de colunas.');
    return rows;
}
function d05CsvSafeText(value, max, label) {
    const s = String(value || '').trim();
    if (!s || s.length > max || /[\x00-\x08\x0b-\x1f]/.test(s))
        throw Error('CSV: ' + label + ' inválido');
    if (/^[\s\uFEFF]*[=+@-]/.test(s))
        throw Error('CSV: ' + label + ' com possível fórmula de planilha');
    return s;
}
function d05CsvDate(value) {
    let date = value.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [d, m, y] = date.split('/');
        date = y + '-' + m + '-' + d;
    }
    if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date))
        throw Error('CSV: data inválida');
    const [y, m, d] = date.split('-').map(Number), v = new Date(Date.UTC(y, m - 1, d));
    if (v.toISOString().slice(0, 10) !== date)
        throw Error('CSV: data impossível');
    return date;
}
async function d05CsvDigest(text) {
    if (typeof crypto === 'undefined' || !crypto.subtle)
        throw Error('Importação segura exige digest SHA-256 disponível.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function d05CsvTable(input) {
    const rows = d05CsvRecords(input);
    const headers = rows.shift().map(h => h.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').trim());
    if (new Set(headers).size !== headers.length)
        throw Error('CSV com colunas duplicadas.');
    const find = (...aliases) => headers.findIndex(x => aliases.includes(x));
    if (find('data', 'date') < 0 || find('descricao', 'historico', 'description') < 0 ||
        find('valor', 'amount') < 0)
        throw Error('CSV deve informar data, descrição e valor.');
    return { rows, headers, find };
}
function d05CsvFormulaSafe(value) {
    const text = String(value !== null && value !== void 0 ? value : '');
    return /^[\s\uFEFF]*[=+@-]/.test(text) ? "'" + text : text;
}
class D05Movements extends React.Component {
    constructor(props) {
        super(props);
        this.slots = [];
        this.refSlots = [];
        this.registered = [];
        this.pending = [];
        this.stateCursor = 0;
        this.refCursor = 0;
        this.alive = false;
        this.state = { renderVersion: 0 };
    }
    componentDidMount() { this.alive = true; this.flushEffects(); }
    componentDidUpdate() { this.flushEffects(); }
    componentWillUnmount() {
        this.alive = false;
        for (const item of this.registered)
            if (typeof (item === null || item === void 0 ? void 0 : item.cleanup) === 'function')
                item.cleanup();
    }
    flushEffects() {
        for (let i = 0; i < this.pending.length; i++) {
            const next = this.pending[i], before = this.registered[i];
            const changed = !before || !next.deps || !before.deps || next.deps.length !== before.deps.length ||
                next.deps.some((v, j) => !Object.is(v, before.deps[j]));
            if (!changed)
                continue;
            if (typeof (before === null || before === void 0 ? void 0 : before.cleanup) === 'function')
                before.cleanup();
            const cleanup = next.callback();
            this.registered[i] = { deps: next.deps ? next.deps.slice() : null, cleanup };
        }
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        this.stateCursor = 0;
        this.refCursor = 0;
        this.pending = [];
        const props = this.props;
        const useState = (initial) => {
            const index = this.stateCursor++;
            if (!(index in this.slots))
                this.slots[index] = initial;
            return [this.slots[index], (update) => {
                    if (!this.alive)
                        return;
                    const prior = this.slots[index];
                    const next = typeof update === 'function' ? update(prior) : update;
                    if (Object.is(next, prior))
                        return;
                    this.slots[index] = next;
                    this.setState((s) => ({ renderVersion: (s.renderVersion || 0) + 1 }));
                }];
        };
        const useRef = (initial) => {
            const index = this.refCursor++;
            if (!(index in this.refSlots))
                this.refSlots[index] = { current: initial };
            return this.refSlots[index];
        };
        const useEffect = (callback, deps) => { this.pending.push({ callback, deps }); };
        const host = props.host, state = host.state, bridge = window.financeDesktop || null;
        const [catalog, setCatalog] = useState(null);
        const [decor, setDecor] = useState({ bank: {}, manual: {} });
        const [loadState, setLoadState] = useState('loading');
        const [accessMessage, setAccessMessage] = useState('');
        const incomingCategory = state.qa84TransactionsCategory || state.txCategoryFilter || '';
        const incomingIdentity = incomingCategory ? resolveCategoryVisualIdentity({ categoryName: incomingCategory,
            catalog: state.qa84VisualCatalog || [], aggregate: true }) : null;
        const [search, setSearch] = useState((incomingIdentity === null || incomingIdentity === void 0 ? void 0 : incomingIdentity.source) === 'fallback' ? incomingCategory : '');
        const [source, setSource] = useState(state.txSource || 'all');
        const [metricSource, setMetricSource] = useState('bank');
        const [tab, setTab] = useState(state.txReviewOnly ? 'pending' : 'all');
        const [period, setPeriod] = useState(state.qa84TransactionsSpan ? '' : state.month || iso(new Date()).slice(0, 7));
        const [account, setAccount] = useState('');
        const [kind, setKind] = useState('all');
        const [categoryId, setCategoryId] = useState(incomingIdentity && incomingIdentity.source !== 'fallback' ? incomingIdentity.categoryId : '');
        const [subcategoryId, setSubcategoryId] = useState('');
        const [sort, setSort] = useState('newest');
        const [group, setGroup] = useState(true);
        const [advanced, setAdvanced] = useState(false);
        const [selected, setSelected] = useState(new Set());
        const [picker, setPicker] = useState(null);
        const [preview, setPreview] = useState(null);
        const [review, setReview] = useState(null);
        const [manual, setManual] = useState(null);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState('');
        const [notice, setNotice] = useState('');
        const [confirmedIdentity, setConfirmedIdentity] = useState(null);
        const [autoInfo, setAutoInfo] = useState(null);
        const [autoPreview, setAutoPreview] = useState(null);
        const [autoView, setAutoView] = useState('activation');
        const [autoHistoryEnabled, setAutoHistoryEnabled] = useState(true);
        const [autoNewEnabled, setAutoNewEnabled] = useState(true);
        const [autoReceipts, setAutoReceipts] = useState([]);
        const [autoReceiptCursor, setAutoReceiptCursor] = useState(null);
        const [autoReceiptTotal, setAutoReceiptTotal] = useState(0);
        const [autoReceiptFilter, setAutoReceiptFilter] = useState('all');
        const [autoReceiptBusy, setAutoReceiptBusy] = useState(false);
        const [autoReceiptDetail, setAutoReceiptDetail] = useState(null);
        const [autoProgress, setAutoProgress] = useState(null);
        const [autoWriteJob, setAutoWriteJob] = useState(null);
        const [autoSelected, setAutoSelected] = useState(new Set());
        const [autoStart, setAutoStart] = useState('2000-01-01');
        const [autoEnd, setAutoEnd] = useState('2099-12-31');
        const [autoPanel, setAutoPanel] = useState(true);
        const [autoBusy, setAutoBusy] = useState(false);
        const [autoMessage, setAutoMessage] = useState('');
        const [autoRules, setAutoRules] = useState([]);
        const autoScanRef = useRef({ jobId: null, stop: false });
        const autoWriteRef = useRef({ jobId: null, stop: false });
        const activeTrigger = useRef(null);
        const modalRef = useRef(null);
        const refreshId = useRef(0);
        const approved = D05_APPROVED_PARENTS;
        const parents = ((_a = catalog === null || catalog === void 0 ? void 0 : catalog.parents) === null || _a === void 0 ? void 0 : _a.length) ? catalog.parents : approved;
        const byName = (name) => parents.find((p) => p.name === name) || D05ApprovedParent(name);
        const byId = (id) => parents.find((p) => p.id === id) || approved.find((p) => p.id === id);
        const format = (cents) => fmt(cents);
        const inRange = (date) => period ? date.slice(0, 7) === period : state.qa84TransactionsSpan ?
            date >= state.qa84TransactionsSpan.start && date <= state.qa84TransactionsSpan.end : true;
        const bankData = state.mode === 'demo' ? [] : state.bank.data.transactions || [];
        const realBank = bankData.map((tx) => {
            const key = JSON.stringify([tx.accountId, tx.id]), data = decor.bank[key] || {};
            const parent = byName(tx.category);
            const nature = tx.nature && tx.nature !== 'auto' ? tx.nature : (tx.amount >= 0 ? 'income' : 'expense');
            return { key: 'bank|' + key, id: tx.id, source: 'bank', raw: tx, date: tx.date, description: tx.description,
                merchant: tx.customTitle || tx.merchant || tx.description, category: tx.category,
                categoryId: data.categoryId || (parent === null || parent === void 0 ? void 0 : parent.id) || '', subcategoryId: data.subcategoryId || null,
                amount: tx.amount, kind: nature, account: tx.accountName, accountId: tx.accountId,
                status: tx.status, reviewed: !!tx.reviewed };
        });
        const realManual = (state.data.transactions || []).map((tx) => {
            var _a, _b;
            const data = decor.manual[tx.id] || {}, parent = byName(tx.category);
            return { key: 'manual|' + tx.id, id: tx.id, source: 'manual', raw: tx, date: tx.date,
                description: tx.description, merchant: tx.description, category: tx.category,
                categoryId: tx.categoryId || data.categoryId || (parent === null || parent === void 0 ? void 0 : parent.id) || '',
                subcategoryId: (_b = (_a = tx.subcategoryId) !== null && _a !== void 0 ? _a : data.subcategoryId) !== null && _b !== void 0 ? _b : null,
                amount: tx.kind === 'income' ? tx.amount : -tx.amount, kind: tx.kind,
                account: 'Adicionado por você', accountId: '', status: 'MANUAL', reviewed: false };
        });
        const rows = realBank.concat(realManual);
        const refreshHierarchy = async () => {
            if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05Catalog)) {
                setLoadState('unavailable');
                setAccessMessage('A hierarquia D05 ainda não está conectada pelo processo principal. Consultas legadas disponíveis; classificação bancária por subcategoria bloqueada.');
                return;
            }
            const req = ++refreshId.current;
            try {
                setLoadState('loading');
                if (!bridge.d05SessionAuthorize)
                    throw Error('D05: autorização de sessão não instalada no MAIN');
                const authorization = await bridge.d05SessionAuthorize({ profile: state.mode });
                if ((authorization === null || authorization === void 0 ? void 0 : authorization.profile) !== state.mode)
                    throw Error('D05: sessão vinculada a outro perfil');
                const parentsResult = await bridge.d05Catalog();
                const bankResult = state.mode === 'demo' ? { items: [], truncated: false } :
                    bridge.d05BankList ? await bridge.d05BankList({ limit: 2500 }) : { items: [] };
                const manualResult = bridge.d05ManualList ? await bridge.d05ManualList({ profile: state.mode, limit: 2500 }) : { items: [] };
                if (req !== refreshId.current)
                    return;
                if (!parentsResult || !Array.isArray(parentsResult.parents))
                    throw Error('Catálogo D05 inválido');
                const b = {}, m = {};
                for (const t of bankResult.items || [])
                    b[JSON.stringify([t.accountId, t.id])] = { categoryId: t.categoryId, subcategoryId: t.subcategoryId };
                for (const t of manualResult.items || [])
                    m[t.id] = { categoryId: t.categoryId, subcategoryId: t.subcategoryId };
                setCatalog(parentsResult);
                setDecor({ bank: b, manual: m });
                const readComplete = typeof bridge.d05BankList === 'function' && typeof bridge.d05ManualList === 'function';
                setLoadState(readComplete ? 'ready' : 'partial');
                setAccessMessage(readComplete ? '' : 'Consulta hierárquica parcial: as referências de banco/manual não foram registradas no preload. As linhas legadas permanecem visíveis sem inventar subcategorias.');
            }
            catch (e) {
                if (req !== refreshId.current)
                    return;
                setLoadState(/autoriz|negado|denied|permiss/i.test(String((e === null || e === void 0 ? void 0 : e.message) || e)) ? 'denied' : 'error');
                setAccessMessage('Catálogo D05 indisponível: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
        };
        useEffect(() => {
            if (state.mode === 'real' && (bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoStatus)) {
                void bridge.bankAutoStatus().then((status) => {
                    if ((status === null || status === void 0 ? void 0 : status.contract) === 'D05/AUTO-CATEGORY-V1') {
                        setAutoInfo(status);
                        if (status.applyJob && autoWriteJob === null)
                            setAutoWriteJob(status.applyJob);
                        if (autoInfo === null) {
                            const enabled = (status.permissions || []).filter((p) => p.enabled && p.expiresAt > new Date().toISOString());
                            setAutoSelected(new Set(enabled.map((p) => p.accountId)));
                            if (enabled.length) {
                                setAutoHistoryEnabled(enabled[0].historyEnabled !== 0);
                                setAutoNewEnabled(enabled[0].newEnabled !== 0);
                                setAutoStart(enabled[0].startDate || '2000-01-01');
                                setAutoEnd(enabled[0].endDate || '2099-12-31');
                                setAutoView('center');
                            }
                        }
                    }
                }).catch((e) => setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e)));
            }
        }, [state.mode, state.bank.data.accounts, state.bank.data.transactions]);
        const refreshAuto = async () => {
            if ((bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoStatus) && state.mode === 'real') {
                const result = await bridge.bankAutoStatus();
                setAutoInfo(result);
            }
        };
        const scanAutoPages = async (jobId) => {
            autoScanRef.current.jobId = jobId;
            autoScanRef.current.stop = false;
            while (!autoScanRef.current.stop) {
                let next;
                try {
                    next = await bridge.bankAutoPreviewNext(jobId);
                }
                catch (e) {
                    if (autoScanRef.current.stop)
                        break;
                    throw e;
                }
                if (autoScanRef.current.stop)
                    break;
                setAutoProgress(next);
                if (next.state === 'ready') {
                    setAutoPreview(next.preview);
                    setAutoMessage('Análise de todo o histórico concluída sem categorizar. Revise a prévia antes de confirmar.');
                    break;
                }
                if (next.state !== 'scanning')
                    break;
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };
        const pauseAutoScan = async () => {
            const id = autoScanRef.current.jobId;
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoPreviewPause))
                return;
            autoScanRef.current.stop = true;
            try {
                setAutoProgress(await bridge.bankAutoPreviewPause(id));
                setAutoMessage('Análise pausada; nenhuma categoria foi aplicada.');
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
        };
        const resumeAutoScan = async () => {
            const id = autoScanRef.current.jobId;
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoPreviewResume))
                return;
            setAutoBusy(true);
            setAutoMessage('');
            try {
                setAutoProgress(await bridge.bankAutoPreviewResume(id));
                await scanAutoPages(id);
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setAutoBusy(false);
            }
        };
        const cancelAutoScan = async () => {
            const id = autoScanRef.current.jobId;
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoPreviewCancel))
                return;
            autoScanRef.current.stop = true;
            try {
                await bridge.bankAutoPreviewCancel(id);
                autoScanRef.current.jobId = null;
                setAutoProgress(null);
                setAutoPreview(null);
                setAutoMessage('Análise cancelada; nenhuma classificação aplicada.');
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
        };
        const loadAutoReceipts = async (filter = 'all', cursor = null) => {
            if (!(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoReceipts) || state.mode !== 'real')
                return;
            setAutoReceiptBusy(true);
            try {
                const page = await bridge.bankAutoReceipts({ action: filter, cursor, limit: 20 });
                setAutoReceipts((prev) => cursor ? [...prev, ...(page.items || [])] : page.items || []);
                setAutoReceiptCursor(page.nextCursor || null);
                setAutoReceiptTotal(page.total || 0);
            }
            catch (e) {
                setAutoMessage('Falha na consulta de recibos: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setAutoReceiptBusy(false);
            }
        };
        const openAutoView = (view) => {
            setAutoView(view);
            if (view === 'receipts')
                void loadAutoReceipts(autoReceiptFilter);
        };
        const undoAutoReceipt = async (item) => {
            if (!(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoUndo) || autoBusy || !(item === null || item === void 0 ? void 0 : item.active))
                return;
            setAutoBusy(true);
            setAutoMessage('');
            try {
                const result = await bridge.bankAutoUndo({ accountId: item.accountId, externalId: item.externalId });
                if (result === null || result === void 0 ? void 0 : result.cancelled) {
                    setAutoMessage('Desfazer cancelado; classificação preservada.');
                    return;
                }
                if (!(result === null || result === void 0 ? void 0 : result.undone))
                    throw Error('O recibo não está mais associado a um rótulo ativo.');
                await host.refreshBank();
                await refreshAuto();
                await loadAutoReceipts(autoReceiptFilter);
                setAutoReceiptDetail(null);
                setAutoMessage('Classificação revertida e protegida contra reaplicação automática.');
            }
            catch (e) {
                setAutoMessage('A reversão não foi confirmada: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setAutoBusy(false);
            }
        };
        const runWritePages = async (jobId) => {
            if (!(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoBatchNext))
                throw Error('Aplicação paginada indisponível no preload.');
            autoWriteRef.current = { jobId, stop: false };
            let last = null;
            while (!autoWriteRef.current.stop) {
                try {
                    last = await bridge.bankAutoBatchNext(jobId);
                }
                catch (e) {
                    if (autoWriteRef.current.stop)
                        break;
                    throw e;
                }
                setAutoWriteJob(last);
                if (last.state !== 'running')
                    break;
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (last && !autoWriteRef.current.stop) {
                await host.refreshBank();
                await refreshAuto();
                if (last.state === 'completed')
                    setAutoMessage('Aplicação concluída: ' + String(last.committed) + ' classificações com recibo confirmado.');
                else if (last.state === 'stale')
                    setAutoMessage('Prévia desatualizada. ' + String(last.committed) + ' categorias gravadas permanecem válidas; não houve nova escrita depois da divergência.');
                else if (last.state === 'failed')
                    setAutoMessage('Falha protegida. ' + String(last.committed) + ' categorias já confirmadas permanecem; lote seguinte bloqueado até revisão.');
            }
        };
        const pauseWrite = async () => {
            const id = autoWriteRef.current.jobId || (autoWriteJob === null || autoWriteJob === void 0 ? void 0 : autoWriteJob.jobId);
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoBatchPause))
                return;
            autoWriteRef.current.stop = true;
            try {
                const job = await bridge.bankAutoBatchPause(id);
                setAutoWriteJob(job);
                setAutoMessage('Aplicação pausada após ' + String(job.committed) + ' confirmações. Nenhuma categoria será reprocessada.');
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
        };
        const resumeWrite = async () => {
            const id = autoWriteJob === null || autoWriteJob === void 0 ? void 0 : autoWriteJob.jobId;
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoBatchResume))
                return;
            setAutoBusy(true);
            setAutoMessage('');
            try {
                const job = await bridge.bankAutoBatchResume(id);
                setAutoWriteJob(job);
                await runWritePages(id);
            }
            catch (e) {
                setAutoMessage('Retomada bloqueada: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setAutoBusy(false);
            }
        };
        const cancelWrite = async () => {
            const id = autoWriteJob === null || autoWriteJob === void 0 ? void 0 : autoWriteJob.jobId;
            if (!id || !(bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoBatchCancel))
                return;
            autoWriteRef.current.stop = true;
            try {
                const job = await bridge.bankAutoBatchCancel(id);
                setAutoWriteJob(job);
                await host.refreshBank();
                await refreshAuto();
                setAutoMessage('Lote cancelado. ' + String(job.committed) + ' classificações confirmadas foram preservadas; nenhuma reversão em massa foi executada.');
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
        };
        const runAutoAction = async (action, accountId = null) => {
            if (!bridge || autoBusy || state.mode !== 'real')
                return;
            setAutoBusy(true);
            setAutoMessage('');
            try {
                let result;
                if (action === 'enable') {
                    result = await bridge.bankAutoConfigure({ accountIds: Array.from(autoSelected), startDate: autoStart, endDate: autoEnd,
                        historyEnabled: autoHistoryEnabled, newEnabled: autoNewEnabled, insufficientAction: 'review' });
                    autoScanRef.current.stop = true;
                    autoScanRef.current.jobId = null;
                    setAutoProgress(null);
                    setAutoPreview(null);
                    setAutoView('preview');
                }
                else if (action === 'revoke') {
                    result = await bridge.bankAutoRevoke(accountId);
                    autoScanRef.current.stop = true;
                    setAutoProgress(null);
                    setAutoPreview(null);
                }
                else if (action === 'pause')
                    result = await bridge.bankAutoPause();
                else if (action === 'resume')
                    result = await bridge.bankAutoResume();
                else if (action === 'preview') {
                    if (!bridge.bankAutoPreviewStart || !bridge.bankAutoPreviewNext)
                        throw Error('Serviço de prévia paginada indisponível no preload.');
                    const started = await bridge.bankAutoPreviewStart();
                    autoScanRef.current.jobId = started.jobId;
                    setAutoProgress(started);
                    setAutoPreview(null);
                    if (started.state === 'ready') {
                        setAutoPreview(started.preview);
                        setAutoMessage('Análise anterior concluída e revalidada; nenhuma categoria aplicada.');
                    }
                    else if (started.state === 'paused') {
                        setAutoMessage('Análise anterior pausada. Use Retomar.');
                    }
                    else
                        await scanAutoPages(started.jobId);
                    return;
                }
                else if (action === 'confirm') {
                    if (!(autoPreview === null || autoPreview === void 0 ? void 0 : autoPreview.previewVersion))
                        throw Error('Analise o histórico antes de confirmar.');
                    result = await bridge.bankAutoApply({ previewVersion: autoPreview.previewVersion, limit: 20000 });
                    if (!(result === null || result === void 0 ? void 0 : result.cancelled)) {
                        setAutoPreview(null);
                        setAutoView('center');
                    }
                }
                else if (action === 'run')
                    result = await bridge.bankAutoApply({ limit: 20000 });
                else if (action === 'suggest')
                    result = await bridge.bankAutoRuleSuggestions({ limit: 5 });
                if (action === 'suggest') {
                    setAutoRules((result === null || result === void 0 ? void 0 : result.rules) || []);
                    setAutoMessage('Sugestões somente para prévia; nenhuma regra foi criada.');
                    return;
                }
                if (result === null || result === void 0 ? void 0 : result.cancelled) {
                    setAutoMessage('Operação cancelada; nenhuma classificação aplicada.');
                    return;
                }
                if (result === null || result === void 0 ? void 0 : result.batch) {
                    setAutoWriteJob(result.batch);
                    setAutoView('center');
                    await runWritePages(result.batch.jobId);
                    return;
                }
                if (['failed', 'busy', 'paused', 'awaiting_explicit_consent_or_first_confirmation', 'initial_batch_requires_resolution'].includes(result === null || result === void 0 ? void 0 : result.state))
                    throw Error('A aplicação NÃO foi concluída: ' + String(result.state) + '. Confira os backups e o estado dos jobs antes de tentar novamente.');
                await host.refreshBank();
                await refreshHierarchy();
                await refreshAuto();
                setAutoMessage(action === 'enable' ? 'Contas autorizadas, mas nenhuma classificação aplicada. Confira a prévia inicial.' :
                    action === 'revoke' ? 'Permissão revogada; recibos e rótulos anteriores preservados.' :
                        action === 'pause' ? 'Próximas verificações automáticas pausadas. Uma aplicação já em curso não é cancelada.' :
                            action === 'resume' ? 'Verificações locais reativadas, limitadas às contas já autorizadas.' :
                                'Verificação concluída. Movimentos incertos permanecem para revisão.');
            }
            catch (e) {
                setAutoMessage(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setAutoBusy(false);
            }
        };
        useEffect(() => {
            let current = true;
            if (current)
                void refreshHierarchy();
            return () => { current = false; refreshId.current++; };
        }, [state.mode, state.bank.data.transactions, state.data.transactions]);
        useEffect(() => {
            if (!picker && !review && !manual)
                return;
            const onKey = (event) => {
                var _a, _b;
                if (event.key === 'Tab' && modalRef.current) {
                    const controls = Array.from(modalRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]'));
                    if (controls.length) {
                        const first = controls[0], last = controls[controls.length - 1];
                        if (event.shiftKey && document.activeElement === first) {
                            event.preventDefault();
                            last.focus();
                        }
                        else if (!event.shiftKey && document.activeElement === last) {
                            event.preventDefault();
                            first.focus();
                        }
                    }
                }
                if (event.key === 'Escape' && !busy) {
                    event.preventDefault();
                    event.stopPropagation();
                    setPicker(null);
                    setReview(null);
                    setManual(null);
                    setPreview(null);
                    (_b = (_a = activeTrigger.current) === null || _a === void 0 ? void 0 : _a.focus) === null || _b === void 0 ? void 0 : _b.call(_a);
                }
            };
            window.addEventListener('keydown', onKey, true);
            return () => window.removeEventListener('keydown', onKey, true);
        }, [picker, review, manual, busy]);
        useEffect(() => {
            var _a;
            if (!(picker || review || manual) || !modalRef.current)
                return;
            const searchField = picker && ['parent', 'child'].includes(picker.phase) ?
                modalRef.current.querySelector('.d05-picker-search input') : null;
            (_a = (searchField || modalRef.current.querySelector('input,button'))) === null || _a === void 0 ? void 0 : _a.focus();
        }, [picker === null || picker === void 0 ? void 0 : picker.phase, review === null || review === void 0 ? void 0 : review.id, manual !== null]);
        useEffect(() => { var _a, _b; if (!picker && !review && !manual)
            (_b = (_a = activeTrigger.current) === null || _a === void 0 ? void 0 : _a.focus) === null || _b === void 0 ? void 0 : _b.call(_a); }, [!!picker, !!review, !!manual]);
        const resetSelected = () => { setSelected(new Set()); setPicker(null); setPreview(null); setError(''); };
        const setFilter = (update) => { update(); resetSelected(); };
        const folded = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const contains = (row, q) => {
            var _a;
            if (!q)
                return true;
            const parent = byId(row.categoryId), child = (_a = parent === null || parent === void 0 ? void 0 : parent.subcategories) === null || _a === void 0 ? void 0 : _a.find((c) => c.id === row.subcategoryId);
            return [row.merchant, row.description, row.category, child === null || child === void 0 ? void 0 : child.name, row.account].some(t => folded(t).includes(q));
        };
        const filtered = rows.filter((row) => {
            if (source !== 'all' && row.source !== source)
                return false;
            if (!inRange(row.date))
                return false;
            if (account && (row.source !== 'bank' || row.accountId !== account))
                return false;
            if (kind !== 'all' && row.kind !== kind)
                return false;
            if (categoryId && row.categoryId !== categoryId)
                return false;
            if (subcategoryId && row.subcategoryId !== subcategoryId)
                return false;
            if (!contains(row, folded(search.trim())))
                return false;
            if (tab === 'pending')
                return row.source === 'bank' && row.status === 'POSTED' && !row.reviewed && row.raw.categorySource !== 'automatic';
            if (tab === 'reviewed')
                return row.source === 'bank' && row.status === 'POSTED' && row.reviewed;
            return true;
        }).sort((a, b) => {
            if (sort === 'oldest')
                return a.date.localeCompare(b.date) || a.key.localeCompare(b.key);
            if (sort === 'largest')
                return Math.abs(b.amount) - Math.abs(a.amount) || a.key.localeCompare(b.key);
            if (sort === 'smallest')
                return Math.abs(a.amount) - Math.abs(b.amount) || a.key.localeCompare(b.key);
            return b.date.localeCompare(a.date) || a.key.localeCompare(b.key);
        });
        const onScreen = filtered.slice(0, 500);
        const sources = new Set(filtered.map((r) => r.source));
        const totalsSource = source === 'manual' ? 'manual' : source === 'bank' ? 'bank' : sources.has(metricSource) ? metricSource : (sources.has('bank') ? 'bank' : 'manual');
        const metricsRows = filtered.filter((r) => r.source === totalsSource);
        let income = 0, expense = 0, needs = 0, ignored = 0, pending = 0;
        for (const r of metricsRows) {
            if (r.source === 'bank' && r.status === 'POSTED' && !r.reviewed && r.raw.categorySource !== 'automatic')
                needs++;
            if (r.source === 'bank' && r.status !== 'POSTED') {
                pending++;
                continue;
            }
            if (r.kind === 'ignore' || r.kind === 'transfer') {
                ignored++;
                continue;
            }
            if (r.kind === 'income')
                income += Math.abs(r.amount);
            else if (r.kind === 'expense')
                expense += Math.abs(r.amount);
        }
        const partial = state.mode === 'real' && !!state.bank.data.truncated;
        const openPicker = (event, row = null, kindName = 'row') => {
            var _a;
            (_a = event === null || event === void 0 ? void 0 : event.stopPropagation) === null || _a === void 0 ? void 0 : _a.call(event);
            const trigger = event === null || event === void 0 ? void 0 : event.currentTarget;
            if (!(trigger === null || trigger === void 0 ? void 0 : trigger.getBoundingClientRect))
                return;
            activeTrigger.current = trigger;
            const geometry = qa84B04Geometry(trigger.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
            const old = row ? byId(row.categoryId) : null;
            setError('');
            setNotice('');
            setConfirmedIdentity(null);
            setPreview(null);
            setPicker({ kind: kindName, row, phase: 'parent', query: '', categoryId: (old === null || old === void 0 ? void 0 : old.id) || null,
                subcategoryId: (row === null || row === void 0 ? void 0 : row.subcategoryId) || null, ...geometry,
                originalFingerprint: qa84B04Fingerprint(row),
                selectionSignature: kindName === 'batch' ? JSON.stringify(Array.from(selected).sort()) : null });
        };
        useEffect(() => {
            const fromDrawer = (event) => {
                const request = event === null || event === void 0 ? void 0 : event.detail;
                if (!request || !['bank', 'manual'].includes(request.source) || !request.id)
                    return;
                const row = rows.find((r) => r.source === request.source && r.id === request.id &&
                    (r.source === 'manual' || r.accountId === request.accountId));
                if (!row) {
                    setError('Movimentação não encontrada; atualize o histórico.');
                    return;
                }
                openPicker({ currentTarget: request.trigger, stopPropagation: () => { } }, row, 'drawer');
            };
            window.addEventListener('mf2:d05:open-picker', fromDrawer);
            return () => window.removeEventListener('mf2:d05:open-picker', fromDrawer);
        }, [state.mode, state.data.transactions, state.bank.data.transactions, catalog, decor, selected]);
        const openDetail = (r) => r.source === 'bank' ?
            host.openBankDetail(r.raw, { categoryId: r.categoryId, subcategoryId: r.subcategoryId }) :
            host.openManualDetail(r.raw, { categoryId: r.categoryId, subcategoryId: r.subcategoryId });
        const setParent = (p) => {
            setPreview(null);
            setError('');
            setPicker((old) => ({ ...old, categoryId: p.id, subcategoryId: null, phase: 'child', query: '' }));
        };
        const setDestination = (sub) => {
            setPreview(null);
            setError('');
            setPicker((old) => ({ ...old, subcategoryId: (sub === null || sub === void 0 ? void 0 : sub.id) || null, phase: 'confirm' }));
        };
        const labelTarget = (parentId, childId) => {
            var _a;
            const p = byId(parentId), child = (_a = p === null || p === void 0 ? void 0 : p.subcategories) === null || _a === void 0 ? void 0 : _a.find((x) => x.id === childId);
            return ((p === null || p === void 0 ? void 0 : p.name) || 'Categoria') + (child ? ' › ' + child.name : '');
        };
        const handleClassify = async () => {
            var _a, _b, _c, _d, _e, _f, _g;
            if (!(picker === null || picker === void 0 ? void 0 : picker.categoryId))
                return;
            const destination = { categoryId: picker.categoryId, subcategoryId: picker.subcategoryId || null };
            setBusy(true);
            setError('');
            try {
                if (picker.kind === 'batch') {
                    if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05BankBatchPreview) || !(bridge === null || bridge === void 0 ? void 0 : bridge.d05BankBatchApply))
                        throw Error('Classificação em lote D05 indisponível: integração segura MAIN/preload pendente');
                    const ids = Array.from(selected).map((key) => rows.find((r) => r.key === key)).filter((r) => (r === null || r === void 0 ? void 0 : r.source) === 'bank');
                    if (ids.length !== selected.size || !ids.length || JSON.stringify(Array.from(selected).sort()) !== picker.selectionSignature)
                        throw Error('Seleção alterada; inicie outra prévia');
                    const items = ids.map((r) => ({ accountId: r.accountId, externalId: r.id }));
                    const data = await bridge.d05BankBatchPreview({ items, target: destination });
                    if ((data === null || data === void 0 ? void 0 : data.contract) !== 'D05/BANK-BATCH-PREVIEW-V1' || !(data === null || data === void 0 ? void 0 : data.previewVersion) ||
                        data.count !== items.length)
                        throw Error('Prévia de lote inválida');
                    if (picker.selectionSignature !== JSON.stringify(Array.from(selected).sort()))
                        throw Error('A seleção mudou durante a prévia');
                    setPreview({ ...data, items, rows: ids, destination,
                        fingerprints: ids.map((r) => qa84B04Fingerprint(r)),
                        selectionSignature: picker.selectionSignature,
                        totalCents: ids.reduce((sum, r) => sum + Math.abs(r.amount), 0) });
                    setPicker((old) => ({ ...old, phase: 'batch-verify' }));
                }
                else if (((_a = picker.row) === null || _a === void 0 ? void 0 : _a.source) === 'manual') {
                    const tx = picker.row, existing = state.data.transactions.find((t) => t.id === tx.id);
                    if (!existing || state.mode !== host.state.mode)
                        throw Error('Lançamento desatualizado: atualize o histórico');
                    const parent = byId(destination.categoryId);
                    if (!parent || destination.subcategoryId &&
                        !((_b = parent.subcategories) === null || _b === void 0 ? void 0 : _b.some((s) => s.id === destination.subcategoryId)))
                        throw Error('Categoria/subcategoria incompatível');
                    const current = rows.find((r) => r.key === tx.key);
                    if (!current || qa84B04Fingerprint(current) !== picker.originalFingerprint)
                        throw Error('Movimentação alterada; nova prévia necessária');
                    if (state.mode === 'real') {
                        if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05PersonalWritePreview))
                            throw Error('Gateway de prévia supervisionada indisponível');
                        const proposed = await bridge.d05PersonalWritePreview({ action: 'manual.categorize',
                            profile: 'real', id: tx.id, target: destination });
                        if ((proposed === null || proposed === void 0 ? void 0 : proposed.contract) !== 'D05/PERSONAL-SUPERVISED-PREVIEW-V1' ||
                            (proposed === null || proposed === void 0 ? void 0 : proposed.changesApplied) !== false || ((_c = proposed === null || proposed === void 0 ? void 0 : proposed.after) === null || _c === void 0 ? void 0 : _c.categoryId) !== destination.categoryId ||
                            ((_d = proposed === null || proposed === void 0 ? void 0 : proposed.after) === null || _d === void 0 ? void 0 : _d.subcategoryId) !== destination.subcategoryId)
                            throw Error('Prévia supervisionada não validada');
                        setPreview(proposed);
                        setPicker((old) => ({ ...old, phase: 'personal-locked' }));
                        setNotice('Prévia financeira validada; confirmação pessoal ainda indisponível.');
                    }
                    else {
                        setPreview({ type: 'manual', profile: state.mode, id: tx.id, source: tx.source,
                            before: { categoryId: tx.categoryId, subcategoryId: tx.subcategoryId, category: tx.category },
                            after: destination, parentName: parent.name, fingerprint: picker.originalFingerprint,
                            amount: tx.amount, date: tx.date, changesApplied: false });
                        setPicker((old) => ({ ...old, phase: 'manual-verify' }));
                    }
                }
                else if (((_e = picker.row) === null || _e === void 0 ? void 0 : _e.source) === 'bank') {
                    if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05AssignBank))
                        throw Error('Classificação bancária D05 indisponível: autorização MAIN/preload pendente');
                    const tx = picker.row, current = state.bank.data.transactions.find((t) => t.id === tx.id && t.accountId === tx.accountId);
                    if (!current || current.amount !== tx.amount || current.status !== tx.status)
                        throw Error('Movimentação alterada; atualize antes de classificar');
                    if ((autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) && (bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoCorrect) && state.mode === 'real' &&
                        (autoInfo.permissions || []).some((p) => p.accountId === tx.accountId && p.enabled)) {
                        const accepted = await bridge.bankAutoCorrect({ accountId: tx.accountId, externalId: tx.id, target: destination });
                        if (accepted === null || accepted === void 0 ? void 0 : accepted.corrected) {
                            await host.refreshBank();
                            await refreshHierarchy();
                            await refreshAuto();
                            setNotice('Correção humana protegida e confirmada por recibo SQLite.');
                            setPicker(null);
                            setPreview(null);
                            return;
                        }
                        if (accepted === null || accepted === void 0 ? void 0 : accepted.cancelled) {
                            setNotice('Correção cancelada no MAIN.');
                            return;
                        }
                    }
                    if (!(bridge === null || bridge === void 0 ? void 0 : bridge.d05BankAccountAuthorize) || !(bridge === null || bridge === void 0 ? void 0 : bridge.d05PersonalWritePreview))
                        throw Error('Gateway pessoal supervisionado D05 ainda indisponível');
                    await bridge.d05BankAccountAuthorize({ accountId: tx.accountId });
                    const proposed = await bridge.d05PersonalWritePreview({
                        action: 'bank.categorize', accountId: tx.accountId, externalId: tx.id, target: destination
                    });
                    if ((proposed === null || proposed === void 0 ? void 0 : proposed.contract) !== 'D05/PERSONAL-SUPERVISED-PREVIEW-V1' ||
                        (proposed === null || proposed === void 0 ? void 0 : proposed.changesApplied) !== false || ((_f = proposed === null || proposed === void 0 ? void 0 : proposed.after) === null || _f === void 0 ? void 0 : _f.categoryId) !== destination.categoryId ||
                        ((_g = proposed === null || proposed === void 0 ? void 0 : proposed.after) === null || _g === void 0 ? void 0 : _g.subcategoryId) !== destination.subcategoryId)
                        throw Error('Prévia supervisionada inválida; nenhuma alteração foi feita');
                    setPreview(proposed);
                    setPicker((old) => ({ ...old, phase: 'personal-locked' }));
                    setNotice('Prévia supervisionada conferida. A gravação pessoal permanece bloqueada até homologação.');
                }
            }
            catch (e) {
                setError(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setBusy(false);
            }
        };
        const commitManual = async () => {
            var _a, _b, _c;
            if (!picker || picker.phase !== 'manual-verify' || (preview === null || preview === void 0 ? void 0 : preview.type) !== 'manual' || busy)
                return;
            if (state.mode !== 'demo' || preview.profile !== 'demo') {
                setError('Gravação pessoal ainda não homologada. Prévia somente para consulta.');
                return;
            }
            const tx = state.data.transactions.find((t) => t.id === preview.id);
            const current = rows.find((r) => r.source === 'manual' && r.id === preview.id);
            if (!tx || !current || qa84B04Fingerprint(current) !== preview.fingerprint ||
                preview.id !== ((_a = picker.row) === null || _a === void 0 ? void 0 : _a.id) || picker.originalFingerprint !== preview.fingerprint) {
                setError('Movimentação modificada; prepare outra prévia.');
                return;
            }
            const parent = byId(preview.after.categoryId);
            if (!parent || preview.after.subcategoryId && !((_b = parent.subcategories) === null || _b === void 0 ? void 0 : _b.some((s) => s.id === preview.after.subcategoryId))) {
                setError('Categoria/subcategoria não existe mais.');
                return;
            }
            setBusy(true);
            setError('');
            try {
                if (!(bridge === null || bridge === void 0 ? void 0 : bridge.save) || !(bridge === null || bridge === void 0 ? void 0 : bridge.load))
                    throw Error('SQLite de demonstração indisponível');
                const next = { ...state.data, transactions: state.data.transactions.map((t) => t.id === preview.id ? {
                        ...t, category: parent.name, categoryId: preview.after.categoryId, subcategoryId: preview.after.subcategoryId
                    } : t) };
                const saved = await host.updateData(next, 'Classificação de demonstração salva.');
                if (!saved)
                    throw Error('Persistência não confirmada');
                const verified = await bridge.load('demo');
                const item = (_c = verified === null || verified === void 0 ? void 0 : verified.transactions) === null || _c === void 0 ? void 0 : _c.find((t) => t.id === preview.id);
                if ((item === null || item === void 0 ? void 0 : item.categoryId) !== preview.after.categoryId || (item === null || item === void 0 ? void 0 : item.subcategoryId) !== preview.after.subcategoryId)
                    throw Error('Recibo não confirmado: releia os dados antes de prosseguir');
                setConfirmedIdentity(qa84B03Visual({ categoryId: item.categoryId,
                    subcategoryId: item.subcategoryId, categoryName: item.category }, parents));
                setNotice('Classificação de demonstração confirmada no SQLite.');
                setPreview(null);
                setPicker(null);
                await refreshHierarchy();
            }
            catch (e) {
                setError('Gravação não confirmada: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setBusy(false);
            }
        };
        const commitBatch = async () => {
            if (!picker || !(preview === null || preview === void 0 ? void 0 : preview.previewVersion) || !(bridge === null || bridge === void 0 ? void 0 : bridge.d05BankBatchApply))
                return;
            if (state.mode !== 'demo') {
                setError('Lote pessoal somente em prévia até homologação.');
                return;
            }
            setBusy(true);
            setError('');
            try {
                const ids = Array.from(selected).sort();
                const expected = preview.rows.map((r) => r.key).sort();
                const fresh = preview.rows.map((r) => rows.find((now) => now.key === r.key));
                if (JSON.stringify(ids) !== JSON.stringify(expected) ||
                    preview.selectionSignature !== JSON.stringify(ids) ||
                    fresh.some((r, i) => !r || qa84B04Fingerprint(r) !== preview.fingerprints[i]))
                    throw Error('Seleção ou movimentação alterada; nova prévia necessária');
                const result = await bridge.d05BankBatchApply({ items: preview.items, target: preview.destination, previewVersion: preview.previewVersion });
                if ((result === null || result === void 0 ? void 0 : result.changed) !== preview.items.length)
                    throw Error('Recibo incompleto: verifique o histórico');
                await host.refreshBank();
                await refreshHierarchy();
                setNotice(result.changed + ' classificação(ões) persistidas.');
                setPicker(null);
                setPreview(null);
                setSelected(new Set());
            }
            catch (e) {
                setError('Prévia desatualizada ou acesso negado: ' + String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setBusy(false);
            }
        };
        const reviewNow = async () => {
            var _a, _b;
            if (!review || review.source !== 'bank' || review.status !== 'POSTED' || review.reviewed)
                return;
            const latest = state.bank.data.transactions.find((t) => t.accountId === review.accountId && t.id === review.id);
            if (!latest || latest.status !== 'POSTED' || latest.reviewed || latest.amount !== review.amount) {
                setError('Esta movimentação foi atualizada; reabra a revisão.');
                return;
            }
            setBusy(true);
            setError('');
            try {
                await host.markBankReviewed(latest);
                const current = await host.refreshBank();
                const updated = (_b = (_a = current === null || current === void 0 ? void 0 : current.data) === null || _a === void 0 ? void 0 : _a.transactions) === null || _b === void 0 ? void 0 : _b.find((t) => t.accountId === review.accountId && t.id === review.id);
                if (!(updated === null || updated === void 0 ? void 0 : updated.reviewed))
                    throw Error('Sem confirmação persistida da revisão');
                setReview(null);
                setNotice('Conferência registrada.');
            }
            catch (e) {
                setError(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setBusy(false);
            }
        };
        const saveManual = async () => {
            var _a;
            if (!manual || !(bridge === null || bridge === void 0 ? void 0 : bridge.save))
                return;
            const amount = parsePositiveBRLInput(manual.value), parent = byId(manual.categoryId);
            if (!parent || !Number.isSafeInteger(amount) || amount <= 0 ||
                !/^\d{4}-\d{2}-\d{2}$/.test(manual.date) || iso(fromISO(manual.date)) !== manual.date ||
                !((_a = manual.description) === null || _a === void 0 ? void 0 : _a.trim()) || !['income', 'expense'].includes(manual.kind)) {
                setError('Confira descrição, data, valor e categoria antes de salvar.');
                return;
            }
            setBusy(true);
            setError('');
            try {
                const id = 'd05-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
                const tx = { id, date: manual.date, description: manual.description.trim().slice(0, 180),
                    kind: manual.kind, amount, category: parent.name, categoryId: parent.id,
                    subcategoryId: manual.subcategoryId || null, origin: 'manual' };
                const data = { ...state.data, transactions: [...state.data.transactions, tx] };
                const saved = await host.updateData(data, 'Movimentação manual registrada.');
                if (!saved)
                    throw Error('A gravação não foi confirmada');
                setManual(null);
                setNotice('Lançamento registrado no SQLite.');
                await refreshHierarchy();
            }
            catch (e) {
                setError(String((e === null || e === void 0 ? void 0 : e.message) || e));
            }
            finally {
                setBusy(false);
            }
        };
        const portal = (body, left = 20, top = 60, width = 355) => {
            const safeTop = Math.max(12, Math.min(top, Math.max(12, window.innerHeight - 130)));
            const safeWidth = Math.max(0, Math.min(width, window.innerWidth - 24));
            return ReactDOM.createPortal(h('div', { className: 'd05-overlay', onMouseDown: (e) => {
                    var _a, _b;
                    if (e.target === e.currentTarget && !busy) {
                        setPicker(null);
                        setReview(null);
                        setManual(null);
                        setPreview(null);
                        (_b = (_a = activeTrigger.current) === null || _a === void 0 ? void 0 : _a.focus) === null || _b === void 0 ? void 0 : _b.call(_a);
                    }
                } }, h('section', { ref: modalRef, className: 'd05-floating', role: 'dialog', 'aria-modal': 'true',
                style: { left: Math.max(12, Math.min(left, window.innerWidth - safeWidth - 12)), top: safeTop,
                    width: safeWidth, maxHeight: Math.max(80, window.innerHeight - safeTop - 12) } }, body)), document.body);
        };
        const categoryGrid = (selectedId, onSelect, searchText) => h('div', { className: 'd05-catalog-grid', role: 'group', 'aria-label': 'Categorias principais' }, parents.filter((p) => folded(p.name).includes(folded(searchText))).map((p) => h('button', { key: p.id, type: 'button',
            className: 'd05-catalog-choice ' + (p.id === selectedId ? 'is-current' : ''),
            'aria-pressed': p.id === selectedId, onClick: () => onSelect(p) }, h(D05VectorIcon, { iconKey: p.iconKey, hue: p.hue, size: 20 }), h('span', {}, p.name))));
        const chooser = picker ? (() => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const parent = byId(picker.categoryId), children = (parent === null || parent === void 0 ? void 0 : parent.subcategories) || [];
            const matches = qa84B04Search(parents, picker.query || '');
            const searchable = h('label', { className: 'd05-picker-search' }, h('span', {}, 'Buscar categoria ou subcategoria'), h('input', { className: 'd05-search', type: 'search', autoFocus: true, value: picker.query,
                placeholder: 'Ex.: Streaming, alimentação, transporte',
                onChange: (e) => setPicker({ ...picker, query: e.target.value }) }));
            const resultGrid = h('div', { className: 'd05-catalog-grid', role: 'group', 'aria-label': 'Categorias principais' }, matches.map((entry) => h('div', { className: 'd05-catalog-result', key: entry.parent.id }, h('button', { type: 'button', className: 'd05-catalog-choice ' + (entry.parent.id === picker.categoryId ? 'is-current' : ''),
                'aria-pressed': entry.parent.id === picker.categoryId,
                onClick: () => setParent(entry.parent) }, h(D05VectorIcon, { iconKey: entry.parent.iconKey, hue: entry.parent.hue, size: 21 }), h('span', {}, entry.parent.name)), entry.children.length ? h('div', { className: 'd05-catalog-match' }, entry.children.map((child) => h('button', { type: 'button', key: child.id,
                onClick: () => {
                    setPreview(null);
                    setError('');
                    setPicker((prior) => ({ ...prior, categoryId: entry.parent.id,
                        subcategoryId: child.id, phase: 'confirm', query: '' }));
                } }, h(D05VectorIcon, { iconKey: child.iconKey, hue: child.hue, size: 17 }), entry.parent.name + ' › ' + child.name))) : null)), !matches.length ? h('p', { className: 'd05-message', role: 'status' }, 'Nenhuma categoria encontrada.') : null);
            return portal(h('div', { className: 'd05-picker' }, h('header', { className: 'd05-floating-head' }, h('div', {}, h('small', {}, 'CLASSIFICAÇÃO'), h('h3', {}, picker.kind === 'batch' ? 'Classificar seleção' : 'Categoria da movimentação')), h('button', { type: 'button', 'aria-label': 'Cancelar classificação', onClick: () => { setPicker(null); setPreview(null); } }, '×')), ['parent', 'child'].includes(picker.phase) ? searchable : null, picker.phase === 'parent' ? resultGrid :
                picker.phase === 'child' ? h('div', {}, h('button', { type: 'button', className: 'd05-back', onClick: () => setPicker({ ...picker, phase: 'parent', query: '' }) }, '← Todas as categorias'), h('p', { className: 'd05-picker-caption' }, 'Escolha uma subcategoria ou mantenha apenas ' + (parent === null || parent === void 0 ? void 0 : parent.name)), h('div', { className: 'd05-child-list' }, h('button', { type: 'button', className: 'd05-child', onClick: () => setDestination(null) }, h(D05VectorIcon, { iconKey: parent === null || parent === void 0 ? void 0 : parent.iconKey, hue: parent === null || parent === void 0 ? void 0 : parent.hue }), 'Somente ' + (parent === null || parent === void 0 ? void 0 : parent.name)), children.filter((child) => qa84B04Fold(child.name).includes(qa84B04Fold(picker.query || '')))
                    .map((child) => h('button', { type: 'button', className: 'd05-child', key: child.id, onClick: () => setDestination(child) }, h(D05VectorIcon, { iconKey: child.iconKey, hue: child.hue }), child.name)))) :
                    picker.phase === 'batch-verify' ? h('div', {}, h('p', {}, 'Prévia: ', h('strong', {}, (preview === null || preview === void 0 ? void 0 : preview.count) || 0), ' movimentações na seleção.'), h('p', { className: 'd05-picker-caption' }, 'POSTED: ' + String((preview === null || preview === void 0 ? void 0 : preview.posted) || 0) +
                        ' · PENDING: ' + String((preview === null || preview === void 0 ? void 0 : preview.pending) || 0) + ' · Valor total: ' + format((preview === null || preview === void 0 ? void 0 : preview.totalCents) || 0)), h('p', { className: 'd05-picker-caption' }, 'Destino: ' + labelTarget(picker.categoryId, picker.subcategoryId)), h('ul', { className: 'd05-preview-items' }, ((preview === null || preview === void 0 ? void 0 : preview.rows) || []).slice(0, 20).map((r) => h('li', { key: r.key }, r.merchant, ' · ', format(Math.abs(r.amount))))), (((_a = preview === null || preview === void 0 ? void 0 : preview.rows) === null || _a === void 0 ? void 0 : _a.length) || 0) > 20 ? h('small', {}, 'Demais itens incluídos na prévia validada.') : null, state.mode !== 'demo' ? h('p', { className: 'd05-message', role: 'status' }, 'Classificação em lote pessoal ainda não homologada. Prévia somente para consulta.') : null, h('button', { type: 'button', className: 'd05-confirm', disabled: busy || state.mode !== 'demo',
                        onClick: () => void commitBatch() }, busy ? 'Gravando…' : 'Reconfirmar e aplicar lote')) :
                        picker.phase === 'manual-verify' ? h('div', { className: 'd05-confirm-step' }, h('p', {}, 'Antes: ', h('b', {}, ((_b = preview === null || preview === void 0 ? void 0 : preview.before) === null || _b === void 0 ? void 0 : _b.category) || 'Categoria anterior')), h('p', {}, 'Depois: ', h('b', {}, labelTarget((_c = preview === null || preview === void 0 ? void 0 : preview.after) === null || _c === void 0 ? void 0 : _c.categoryId, (_d = preview === null || preview === void 0 ? void 0 : preview.after) === null || _d === void 0 ? void 0 : _d.subcategoryId))), h('p', { className: 'd05-picker-caption' }, ((_e = picker.row) === null || _e === void 0 ? void 0 : _e.date) + ' · ' + format(Math.abs((preview === null || preview === void 0 ? void 0 : preview.amount) || 0))), state.mode !== 'demo' ? h('p', { className: 'd05-message', role: 'status' }, 'Classificação pessoal indisponível até homologação; nenhuma alteração será gravada.') : null, h('button', { type: 'button', className: 'd05-confirm', disabled: busy || state.mode !== 'demo',
                            onClick: () => void commitManual() }, busy ? 'Gravando…' : 'Reconfirmar e salvar demonstração')) :
                            picker.phase === 'personal-locked' ? h('div', { className: 'd05-confirm-step' }, h('p', {}, 'Antes: ', h('b', {}, ((_f = picker.row) === null || _f === void 0 ? void 0 : _f.category) || 'Categoria atual')), h('p', {}, 'Depois: ', h('b', {}, labelTarget(picker.categoryId, picker.subcategoryId))), h('p', { className: 'd05-message', role: 'status' }, 'Prévia supervisionada concluída. Gravação pessoal ainda não autorizada; nenhum dado foi alterado.')) :
                                h('div', { className: 'd05-confirm-step' }, h('p', {}, 'Antes: ', h('b', {}, ((_g = picker.row) === null || _g === void 0 ? void 0 : _g.category) || 'Seleção atual')), h('p', {}, 'Depois: ', h('b', {}, labelTarget(picker.categoryId, picker.subcategoryId))), h('button', { type: 'button', className: 'd05-confirm', disabled: busy, onClick: () => void handleClassify() }, busy ? 'Conferindo…' : 'Conferir prévia antes de salvar')), error ? h('p', { className: 'd05-message is-error', role: 'alert' }, error) : null, !(bridge === null || bridge === void 0 ? void 0 : bridge.d05AssignBank) && ((_h = picker.row) === null || _h === void 0 ? void 0 : _h.source) === 'bank' ? h('p', { className: 'd05-message', role: 'status' }, 'Salvar no banco indisponível até a conexão segura do processo principal.') : null), picker.left, picker.top, picker.width);
        })() : null;
        const reviewPanel = review ? portal(h('div', {}, h('header', { className: 'd05-floating-head' }, h('div', {}, h('small', {}, 'CONFERÊNCIA'), h('h3', {}, review.merchant)), h('button', { type: 'button', 'aria-label': 'Fechar revisão', onClick: () => setReview(null) }, '×')), h('p', {}, review.date.split('-').reverse().join('/'), ' · ', review.account), h('strong', { className: review.amount < 0 ? 'd05-negative' : 'd05-positive' }, (review.amount < 0 ? '−' : '+') + format(Math.abs(review.amount))), h('p', { className: 'd05-picker-caption' }, 'Categoria: ' + labelTarget(review.categoryId, review.subcategoryId)), h('div', { className: 'd05-review-actions' }, h('button', { type: 'button', className: 'd05-confirm', disabled: busy, onClick: () => void reviewNow() }, busy ? 'Conferindo…' : 'Marcar como revisada'), h('button', { type: 'button', onClick: (e) => { const row = review; setReview(null); openPicker(e, row); } }, 'Corrigir categoria'), h('button', { type: 'button', onClick: () => setReview(null) }, 'Agora não')), error ? h('p', { className: 'd05-message is-error', role: 'alert' }, error) : null), Math.max(14, Math.floor((window.innerWidth - 355) / 2)), Math.max(20, Math.floor((window.innerHeight - 360) / 2)), 355) : null;
        const manualPanel = manual ? portal(h('div', {}, h('header', { className: 'd05-floating-head' }, h('div', {}, h('small', {}, 'LANÇAMENTO MANUAL'), h('h3', {}, 'Nova movimentação')), h('button', { type: 'button', 'aria-label': 'Cancelar lançamento', onClick: () => setManual(null) }, '×')), h('label', { className: 'd05-field' }, 'Descrição', h('input', { value: manual.description, maxLength: 180, onChange: (e) => setManual({ ...manual, description: e.target.value }) })), h('div', { className: 'd05-inline-fields' }, h('label', { className: 'd05-field' }, 'Data', h('input', { type: 'date', value: manual.date, onChange: (e) => setManual({ ...manual, date: e.target.value }) })), h('label', { className: 'd05-field' }, 'Valor (R$)', h('input', { inputMode: 'decimal', value: manual.value, placeholder: '0,00', onChange: (e) => setManual({ ...manual, value: e.target.value }) }))), h('div', { className: 'd05-switch-row' }, ['expense', 'income'].map((v) => h('button', { type: 'button', className: manual.kind === v ? 'active' : '', onClick: () => setManual({ ...manual, kind: v }) }, v === 'expense' ? 'Saída' : 'Entrada'))), h('p', { className: 'd05-picker-caption' }, 'Categoria: ' + labelTarget(manual.categoryId, manual.subcategoryId)), categoryGrid(manual.categoryId, (p) => setManual({ ...manual, categoryId: p.id, subcategoryId: null }), ''), h('div', { className: 'd05-child-list' }, (((_b = byId(manual.categoryId)) === null || _b === void 0 ? void 0 : _b.subcategories) || []).length ? h('div', {}, h('button', { type: 'button', className: !manual.subcategoryId ? 'd05-child is-current' : 'd05-child', onClick: () => setManual({ ...manual, subcategoryId: null }) }, 'Somente categoria-pai'), (((_c = byId(manual.categoryId)) === null || _c === void 0 ? void 0 : _c.subcategories) || []).map((c) => h('button', { type: 'button', key: c.id, className: manual.subcategoryId === c.id ? 'd05-child is-current' : 'd05-child', onClick: () => setManual({ ...manual, subcategoryId: c.id }) }, h(D05VectorIcon, { iconKey: c.iconKey, hue: c.hue, size: 16 }), c.name))) : null), h('button', { type: 'button', className: 'd05-confirm', disabled: busy, onClick: () => void saveManual() }, busy ? 'Salvando…' : 'Confirmar lançamento'), error ? h('p', { className: 'd05-message is-error', role: 'alert' }, error) : null), Math.max(12, Math.floor((window.innerWidth - 540) / 2)), 22, 540) : null;
        if (state.booting)
            return h('section', { className: 'd05-screen', id: 'd05-movements', role: 'status' }, h('p', { className: 'd05-notice' }, 'Carregando registros financeiros…'));
        return h('section', { className: 'd05-screen', id: 'd05-movements' }, h('header', { className: 'd05-head' }, h('div', {}, h('h1', {}, 'Movimentações'), h('p', {}, 'Seu histórico organizado, com contexto e controle.')), h('div', { className: 'd05-head-actions' }, h('button', { type: 'button', onClick: () => { var _a; return (_a = host.csvInput) === null || _a === void 0 ? void 0 : _a.click(); } }, 'Importar CSV'), h('button', { type: 'button', className: 'd05-primary', onClick: (e) => { activeTrigger.current = e.currentTarget; setError(''); setManual({ description: '', date: iso(new Date()), value: '', kind: 'expense', categoryId: 'cat:outros', subcategoryId: null }); } }, '+ Nova movimentação'))), state.booting ? h('p', { className: 'd05-notice', role: 'status' }, 'Carregando dados financeiros…') : null, loadState === 'loading' && (bridge === null || bridge === void 0 ? void 0 : bridge.d05Catalog) ? h('p', { className: 'd05-notice', role: 'status' }, 'Conferindo hierarquia D05…') : null, loadState !== 'ready' && loadState !== 'loading' ? h('p', { className: 'd05-notice', role: 'status' }, accessMessage) : null, notice ? h('p', { className: 'd05-notice', role: 'status' }, confirmedIdentity ? h(D05VectorIcon, { iconKey: confirmedIdentity.iconKey,
            hue: confirmedIdentity.hue, size: 17 }) : null, confirmedIdentity ? confirmedIdentity.label + ' · ' : null, notice) : null, state.mode === 'real' && (bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoStatus) ? h('section', {
            className: 'd05-auto-box mf-cat-shell', 'aria-label': 'Central de categorização automática'
        }, h('header', { className: 'mf-cat-hero' }, h('div', { className: 'mf-cat-identity' }, h('span', { className: 'mf-cat-eyebrow' }, 'INTELIGÊNCIA FINANCEIRA  ·  CAT-UX'), h('h2', {}, 'Categorização inteligente'), h('p', {}, 'Evidências locais verificáveis, sempre sob o seu controle.')), h('div', { className: 'mf-cat-header-actions' }, h('span', { className: 'mf-cat-state', 'data-state': !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) ? 'unavailable' :
                ((_d = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _d === void 0 ? void 0 : _d.paused) ? 'paused' : (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) ? 'active' : 'inactive' }, !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) ? 'Aguardando homologação' : ((_e = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _e === void 0 ? void 0 : _e.paused) ? 'Pausada' :
            (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) ? 'Contas autorizadas' : 'Não ativada'), h('button', { type: 'button', className: 'd05-ghost', 'aria-expanded': autoPanel,
            onClick: () => setAutoPanel(!autoPanel) }, autoPanel ? 'Recolher' : 'Abrir central'))), h('div', { className: 'mf-cat-glance', role: 'status', 'aria-label': 'Resumo da automação' }, h('div', {}, h('small', {}, 'Aplicadas no momento'), h('strong', {}, String((_g = (_f = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.counts) === null || _f === void 0 ? void 0 : _f.classified) !== null && _g !== void 0 ? _g : 0))), h('div', {}, h('small', {}, 'Precisam de revisão'), h('strong', {}, String((_j = (_h = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.counts) === null || _h === void 0 ? void 0 : _h.awaitingReview) !== null && _j !== void 0 ? _j : 0))), h('div', {}, h('small', {}, 'Contas autorizadas'), h('strong', {}, String(((autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.permissions) || []).filter((p) => p.enabled && p.expiresAt > new Date().toISOString()).length)))), autoPanel ? h('div', { className: 'mf-cat-content' }, h('nav', { className: 'mf-cat-nav', role: 'tablist', 'aria-label': 'Etapas e recursos da categorização' }, [{ id: 'activation', name: 'Ativação', number: '01' },
            { id: 'preview', name: 'Análise', number: '02' },
            { id: 'center', name: 'Central', number: '03' },
            { id: 'rules', name: 'Regras', number: '04' },
            { id: 'receipts', name: 'Recibos', number: '05' },
            { id: 'security', name: 'Segurança', number: '06' }].map((v) => h('button', { key: v.id, id: 'mf-cat-tab-' + v.id, type: 'button', role: 'tab',
            'aria-selected': autoView === v.id, 'aria-controls': 'mf-cat-panel-' + v.id,
            className: autoView === v.id ? 'is-current' : '',
            onClick: () => openAutoView(v.id) }, h('small', {}, v.number), v.name))), autoWriteJob ? h('div', { className: 'mf-cat-write-state', role: 'status', 'aria-live': 'polite' }, h('div', { className: 'mf-cat-progress-label' }, h('strong', {}, 'Aplicação em lotes · ' + (autoWriteJob.state === 'completed' ? 'Concluída' :
            autoWriteJob.state === 'running' ? 'Gravando recibos' : autoWriteJob.state === 'paused' ? 'Pausada' :
                autoWriteJob.state === 'cancelled' ? 'Cancelada' : autoWriteJob.state === 'stale' ? 'Prévia desatualizada' : 'Falha protegida')), h('span', {}, String(autoWriteJob.committed || 0) + ' / ' + String(autoWriteJob.proposedTotal || 0) + ' commits')), h('progress', { max: Math.max(1, autoWriteJob.proposedTotal || 0),
            value: Math.min(autoWriteJob.committed || 0, Math.max(1, autoWriteJob.proposedTotal || 0)),
            'aria-label': 'Classificações efetivamente confirmadas no SQLite' }), h('p', { className: 'mf-cat-footnote' }, autoWriteJob.state === 'completed' ?
            'Todas as propostas válidas foram processadas; confira os recibos.' :
            autoWriteJob.state === 'stale' ? 'Dados ou autorizações mudaram. O lote está bloqueado até nova prévia.' :
                autoWriteJob.state === 'failed' ? 'Erro de backup ou COMMIT. O que já foi confirmado possui recibo; nenhuma conclusão foi declarada.' :
                    autoWriteJob.state === 'cancelled' ? 'As classificações confirmadas permanecem. Não foi feito desfazer em massa.' :
                        'A contagem só avança depois do COMMIT SQLite.'), ['running', 'paused', 'failed'].includes(autoWriteJob.state) ? h('div', { className: 'mf-cat-toolbar' }, autoWriteJob.state === 'running' ? h('button', { type: 'button', onClick: () => void pauseWrite() }, 'Pausar aplicação') :
            h('button', { type: 'button', onClick: () => void resumeWrite() }, 'Retomar com revalidação'), h('button', { type: 'button', onClick: () => void cancelWrite() }, 'Cancelar novas aplicações')) : null) : null, h('div', { id: 'mf-cat-panel-' + autoView, role: 'tabpanel', 'aria-labelledby': 'mf-cat-tab-' + autoView,
            className: 'mf-cat-stage', tabIndex: 0 }, autoView === 'activation' ? h('div', { className: 'mf-cat-grid-layout' }, h('section', { className: 'mf-cat-surface' }, h('div', { className: 'mf-cat-section-top' }, h('span', { className: 'mf-cat-step' }, '01 / CONFIGURAÇÃO'), h('h3', {}, 'Escolha onde a automação pode atuar'), h('p', {}, 'Nenhuma conta é escolhida automaticamente. O consentimento será solicitado no aplicativo.')), !(state.bank.data.accounts || []).length ? h('p', { className: 'mf-cat-empty', role: 'status' }, 'Nenhuma conta bancária disponível. Conecte uma conta e sincronize seus dados antes de autorizar.') : null, h('div', { className: 'mf-cat-account-list' }, (state.bank.data.accounts || []).map((account) => {
            const permission = ((autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.permissions) || []).find((p) => p.accountId === account.id);
            const expired = !!permission && permission.expiresAt <= new Date().toISOString();
            return h('button', { key: account.id, type: 'button',
                className: 'mf-cat-account ' + (autoSelected.has(account.id) ? 'is-selected' : ''),
                disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available),
                'aria-pressed': autoSelected.has(account.id),
                onClick: () => {
                    const next = new Set(autoSelected);
                    if (next.has(account.id))
                        next.delete(account.id);
                    else
                        next.add(account.id);
                    setAutoSelected(next);
                } }, h('span', { className: 'mf-cat-account-mark', 'aria-hidden': 'true' }, autoSelected.has(account.id) ? '✓' : ''), h('span', { className: 'mf-cat-account-text' }, h('strong', {}, account.name), h('small', {}, expired ? 'Autorização expirada · renove para continuar' :
                (permission === null || permission === void 0 ? void 0 : permission.enabled) ? 'Autorização existente · alterável' : 'Não autorizada')), h('span', { className: 'mf-cat-account-tail', 'aria-hidden': 'true' }, autoSelected.has(account.id) ? 'Selecionada' : 'Selecionar'));
        })), h('div', { className: 'd05-auto-period mf-cat-period' }, h('label', {}, 'Histórico desde', h('input', { type: 'date', value: autoStart,
            disabled: autoBusy || !autoHistoryEnabled, onChange: (e) => setAutoStart(e.target.value) })), h('label', {}, 'Até', h('input', { type: 'date', value: autoEnd, disabled: autoBusy,
            onChange: (e) => setAutoEnd(e.target.value) }))), h('p', { className: 'mf-cat-footnote' }, 'Alterar contas ou período exige novo consentimento e invalida a prévia anterior.')), h('aside', { className: 'mf-cat-surface mf-cat-preferences' }, h('span', { className: 'mf-cat-step' }, 'PREFERÊNCIAS'), h('h3', {}, 'Como a classificação deve funcionar?'), h('button', { type: 'button', className: 'mf-cat-policy ' + (autoHistoryEnabled ? 'is-selected' : ''),
            disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available), 'aria-pressed': autoHistoryEnabled,
            onClick: () => setAutoHistoryEnabled(!autoHistoryEnabled) }, h('span', {}, h('strong', {}, 'Analisar meu histórico disponível'), h('small', {}, 'Prévia de registros anteriores, sem alterar os originais')), h('span', { className: 'mf-cat-switch', 'aria-hidden': 'true' })), h('button', { type: 'button', className: 'mf-cat-policy ' + (autoNewEnabled ? 'is-selected' : ''),
            disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available), 'aria-pressed': autoNewEnabled,
            onClick: () => setAutoNewEnabled(!autoNewEnabled) }, h('span', {}, h('strong', {}, 'Categorizar novas movimentações'), h('small', {}, 'Verificações locais após sync e durante o uso do app')), h('span', { className: 'mf-cat-switch', 'aria-hidden': 'true' })), h('div', { className: 'mf-cat-policy is-fixed' }, h('span', {}, h('strong', {}, 'Quando não houver evidência suficiente'), h('small', {}, 'Enviar à revisão. Nunca adivinhar categorias.')), h('span', { className: 'mf-cat-fixed' }, 'Sempre revisar')), h('div', { className: 'mf-cat-guarantee' }, h('strong', {}, 'O que permanece protegido'), h('p', {}, 'Valores, datas, extratos originais, classificações manuais, splits, transferências e regras aprovadas.')), h('button', { type: 'button', className: 'd05-confirm mf-cat-main-action',
            disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) || autoSelected.size === 0 || (!autoHistoryEnabled && !autoNewEnabled),
            onClick: () => void runAutoAction('enable') }, autoBusy ? 'Aguardando confirmação…' : 'Autorizar contas e avançar'), h('p', { className: 'mf-cat-footnote' }, 'As opções acima são sugestões. Só a confirmação nativa concede permissão; nenhuma categoria será aplicada nesta etapa.'))) : null, autoView === 'preview' ? h('section', { className: 'mf-cat-surface' }, h('div', { className: 'mf-cat-section-top' }, h('span', { className: 'mf-cat-step' }, '02 / EVIDENCE FLOW'), h('h3', {}, 'Análise e prévia verificável'), h('p', {}, 'O histórico é lido no SQLite em lotes de até 250; nenhum resultado é gravado antes de sua confirmação.')), h('div', { className: 'mf-cat-toolbar' }, h('button', { type: 'button', className: 'd05-confirm',
            disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) || (autoProgress === null || autoProgress === void 0 ? void 0 : autoProgress.state) === 'scanning',
            onClick: () => void runAutoAction('preview') }, autoBusy ? 'Analisando…' : 'Analisar histórico autorizado'), (autoProgress === null || autoProgress === void 0 ? void 0 : autoProgress.state) === 'scanning' ? h('button', { type: 'button',
            onClick: () => void pauseAutoScan() }, 'Pausar') : null, (autoProgress === null || autoProgress === void 0 ? void 0 : autoProgress.state) === 'paused' ? h('button', { type: 'button',
            onClick: () => void resumeAutoScan() }, 'Retomar') : null, ['scanning', 'paused'].includes(autoProgress === null || autoProgress === void 0 ? void 0 : autoProgress.state) ? h('button', { type: 'button',
            onClick: () => void cancelAutoScan() }, 'Cancelar leitura') : null), autoProgress ? h('div', { className: 'mf-cat-progress', role: 'status', 'aria-live': 'polite' }, h('div', { className: 'mf-cat-progress-label' }, h('strong', {}, autoProgress.state === 'ready' ? 'Leitura concluída' :
            autoProgress.state === 'paused' ? 'Leitura pausada' : 'Lendo movimentações'), h('span', {}, String(autoProgress.processed || 0) + ' / ' + String(autoProgress.total || 0))), h('progress', { value: autoProgress.processed || 0, max: Math.max(1, autoProgress.total || 0),
            'aria-label': 'Movimentações efetivamente lidas' })) : null, ((_k = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.applyJob) === null || _k === void 0 ? void 0 : _k.state) === 'stale' ? h('p', { className: 'd05-notice', role: 'alert' }, 'O lote anterior ficou desatualizado. Uma nova leitura e confirmação são obrigatórias; os recibos já gravados serão preservados.') : null, autoPreview ? h('div', {}, h('div', { className: 'mf-cat-metric-grid' }, [{ title: 'Aplicáveis', value: autoPreview.candidateCount || 0 },
            { title: 'A revisar', value: autoPreview.reviewCount || 0 },
            { title: 'Protegidas', value: autoPreview.protectedCount || 0 },
            { title: 'Indisponíveis', value: autoPreview.unavailableCount || 0 }].map((m) => h('div', { key: m.title, className: 'mf-cat-mini-stat' }, h('small', {}, m.title), h('strong', {}, String(m.value))))), h('p', { className: 'mf-cat-caption' }, 'Total analisado no escopo: ' + String((_l = autoPreview.analyzedCount) !== null && _l !== void 0 ? _l : '—') +
            '. As contagens acima não incluem registros fora do consentimento.'), h('div', { className: 'mf-cat-section-top' }, h('h3', {}, 'Amostras de propostas D05'), h('p', {}, 'Mostrando ' + Math.min(12, (autoPreview.candidates || []).length) + ' de ' +
            String(autoPreview.candidateCount || 0) + ' aplicáveis. Nenhuma categoria foi aplicada.')), h('div', { className: 'mf-cat-proposal-list' }, (autoPreview.candidates || []).slice(0, 12).map((item) => {
            var _a, _b;
            const parent = byId((_a = item.target) === null || _a === void 0 ? void 0 : _a.categoryId);
            const child = ((parent === null || parent === void 0 ? void 0 : parent.subcategories) || []).find((c) => { var _a; return c.id === ((_a = item.target) === null || _a === void 0 ? void 0 : _a.subcategoryId); });
            return h('article', { className: 'mf-cat-proposal', key: item.accountId + '|' + item.externalId }, h('div', { className: 'mf-cat-proposal-icon' }, parent ? h(D05VectorIcon, { iconKey: parent.iconKey, hue: parent.hue, size: 20 }) : null), h('div', {}, h('strong', {}, item.merchant || 'Identificação comercial'), h('small', {}, item.explanation || 'Evidência local')), h('span', { className: 'mf-cat-proposal-target' }, ((parent === null || parent === void 0 ? void 0 : parent.name) || ((_b = item.target) === null || _b === void 0 ? void 0 : _b.categoryId) || 'Categoria') +
                (child ? ' · ' + child.name : '')));
        })), h('div', { className: 'mf-cat-confirm-strip' }, h('div', {}, h('strong', {}, 'Pronto para confirmar?'), h('p', {}, 'A confirmação nativa revalidará o manifesto e criará backups e recibos antes de gravar.')), h('button', { type: 'button', className: 'd05-confirm',
            disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) || (autoProgress === null || autoProgress === void 0 ? void 0 : autoProgress.state) !== 'ready' ||
                !autoPreview.previewVersion || ((autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.initialConfirmed) && !!(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.applyJob) && ((_m = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.applyJob) === null || _m === void 0 ? void 0 : _m.state) !== 'stale'),
            onClick: () => void runAutoAction('confirm') }, 'Conferi; aplicar propostas elegíveis')), autoPreview.candidateCount > 20000 ? h('p', { className: 'mf-cat-caption' }, 'Volume elevado: o motor fará commits atômicos de até 250 propostas, com progresso e recuperação persistentes.') : null) : h('p', { className: 'mf-cat-empty' }, 'Nenhuma prévia confirmável nesta sessão. Autorize suas contas e execute a análise somente leitura.'), !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) ? h('p', { className: 'd05-notice' }, 'A RC experimental não possui permissão para escrita pessoal.') : null) : null, autoView === 'center' ? h('div', { className: 'mf-cat-grid-layout' }, h('section', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, '03 / RASTRO VIVO'), h('h3', {}, 'Central da automação'), h('p', { className: 'mf-cat-caption' }, 'Eventos reais de sincronização, verificações locais e classificações confirmadas.'), h('div', { className: 'mf-cat-metric-grid' }, [{ title: 'Aplicadas atualmente', value: ((_o = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.counts) === null || _o === void 0 ? void 0 : _o.classified) || 0 },
            { title: 'Encaminhadas à revisão', value: ((_p = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.counts) === null || _p === void 0 ? void 0 : _p.awaitingReview) || 0 },
            { title: 'Protegidas', value: ((_q = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.counts) === null || _q === void 0 ? void 0 : _q.protected) || 0 }].map((m) => h('div', { key: m.title, className: 'mf-cat-mini-stat' }, h('small', {}, m.title), h('strong', {}, String(m.value))))), h('h4', {}, 'Atividade recente'), (((_r = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _r === void 0 ? void 0 : _r.jobs) || []).length ?
            h('div', { className: 'mf-cat-timeline' }, (autoInfo.jobs.jobs || []).slice(0, 8).map((j) => h('div', { key: j.jobKey, className: 'mf-cat-timeline-row' }, h('span', { className: 'mf-cat-timeline-dot', 'data-state': j.state, 'aria-hidden': 'true' }), h('div', {}, h('strong', {}, j.trigger === 'sync' ? 'Após sincronização' :
                j.trigger === 'daily' ? 'Verificação diária' : 'Ação manual'), h('small', {}, j.startedAt ? new Date(j.startedAt).toLocaleString('pt-BR') : 'Horário indisponível')), h('span', {}, j.state === 'completed' ? String(j.applied || 0) + ' aplicadas' :
                j.state === 'running' ? 'Interrompida / em andamento' : 'Falha protegida')))) :
            h('p', { className: 'mf-cat-empty' }, 'Ainda não há execução registrada.'), h('div', { className: 'mf-cat-toolbar' }, h('button', { type: 'button', disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) || ((_s = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _s === void 0 ? void 0 : _s.paused),
            onClick: () => void runAutoAction('run') }, 'Verificar movimentações'), h('button', { type: 'button', onClick: () => openAutoView('receipts') }, 'Ver recibos'), h('button', { type: 'button', onClick: () => { setTab('pending'); setSource('bank'); setAutoPanel(false); } }, 'Abrir A conferir (D05)'), h('button', { type: 'button', onClick: () => void categoryReviewOpen(host) }, 'Central de Revisão D04')), h('p', { className: 'mf-cat-footnote' }, 'O histórico financeiro completo permanece em Movimentações; a Central não duplica seus lançamentos.')), h('aside', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, 'CONTROLE POR CONTA'), h('h3', {}, 'Permissões e execução'), ((autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.permissions) || []).length ? h('div', { className: 'mf-cat-permissions' }, (autoInfo.permissions || []).map((p) => {
            var _a;
            const expired = p.expiresAt <= new Date().toISOString();
            return h('div', { key: p.accountId, className: 'mf-cat-permission-row' }, h('div', {}, h('strong', {}, p.name), h('small', {}, expired ? 'Expirada' :
                p.enabled ? ((_a = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _a === void 0 ? void 0 : _a.paused) ? 'Ativa · automação pausada' : 'Ativa' : 'Revogada')), p.enabled ? h('button', { type: 'button', disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available),
                onClick: () => void runAutoAction('revoke', p.accountId) }, 'Revogar') : null);
        })) : h('p', { className: 'mf-cat-empty' }, 'Nenhuma conta autorizada.'), h('div', { className: 'mf-cat-toolbar' }, (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) ? h('button', { type: 'button', disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available),
            onClick: () => { var _a; return void runAutoAction(((_a = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _a === void 0 ? void 0 : _a.paused) ? 'resume' : 'pause'); } }, ((_t = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _t === void 0 ? void 0 : _t.paused) ? 'Reativar automação' : 'Pausar automação') : null, h('button', { type: 'button', onClick: () => openAutoView('activation') }, 'Gerenciar contas')), h('p', { className: 'mf-cat-footnote' }, 'Pausar mantém o consentimento; revogar impede novas classificações automáticas.'))) : null, autoView === 'rules' ? h('section', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, '04 / REGRAS E EVIDÊNCIAS'), h('h3', {}, 'Laboratório de padrões'), h('p', {}, 'Sugestões são somente leitura. Aprovar ou editar regras exige o fluxo protegido do catálogo D05.'), h('div', { className: 'mf-cat-toolbar' }, h('button', { type: 'button', className: 'd05-confirm', disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled),
            onClick: () => void runAutoAction('suggest') }, 'Buscar padrões verificáveis'), h('button', { type: 'button', onClick: () => host.setState({ txOrganize: true }) }, 'Abrir editor D05')), autoRules.length ? h('div', { className: 'mf-cat-rule-grid' }, autoRules.map((r) => {
            var _a;
            return h('article', { key: r.accountId + '|' + r.pattern, className: 'mf-cat-rule' }, h('small', { className: 'mf-cat-step' }, 'SUGESTÃO · NÃO APLICADA'), h('h4', {}, r.pattern), h('p', {}, 'Conta: ' + String(((_a = (state.bank.data.accounts || []).find((x) => x.id === r.accountId)) === null || _a === void 0 ? void 0 : _a.name) || 'Conta autorizada')), h('div', { className: 'mf-cat-rule-facts' }, h('span', {}, String(r.suggestedFor || 0) + ' ocorrências verificadas'), h('span', {}, String(r.possibleMatches || 0) + ' possíveis correspondências'), h('span', {}, String(r.possiblePrecedenceConflicts || 0) + ' conflitos de precedência')), h('p', { className: 'mf-cat-caption' }, r.possiblePrecedenceConflicts ?
                'Revisar conflitos antes de considerar qualquer regra.' : 'Nenhuma regra foi criada. Confira o alcance no editor D05.'), h('button', { type: 'button', onClick: () => host.setState({ txOrganize: true }) }, 'Revisar no D05'));
        })) :
            h('p', { className: 'mf-cat-empty' }, 'Nenhuma sugestão consultada ou com evidência suficiente. Isso não significa que uma regra foi aprovada.'), h('h4', {}, 'Regras já ativas no D05'), (state.rules || []).filter((r) => r.enabled && (r.scope === 'bank' || r.scope === 'both')).length ?
            h('div', { className: 'mf-cat-rule-grid' }, (state.rules || []).filter((r) => r.enabled && (r.scope === 'bank' || r.scope === 'both'))
                .slice(0, 8).map((r) => h('article', { key: r.id, className: 'mf-cat-rule' }, h('span', { className: 'mf-cat-step' }, 'REGRA ATIVA DO D05'), h('h4', {}, r.pattern), h('p', {}, 'Destino: ' + r.category + ' · Correspondência: ' + r.matchMode +
                ' · Prioridade: ' + r.priority), h('button', { type: 'button', onClick: () => host.setState({ txOrganize: true }) }, 'Gerenciar no catálogo')))) :
            h('p', { className: 'mf-cat-empty' }, 'Nenhuma regra bancária ativa disponível no catálogo D05.'), h('p', { className: 'mf-cat-footnote' }, 'Âncoras humanas duplicadas e classificação probabilística não calibrada não autorizam regras.'))
            : null, autoView === 'receipts' ? h('section', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, '05 / AUDITORIA E REVERSÃO'), h('h3', {}, 'Histórico de recibos confirmados'), h('p', {}, 'Cada recibo é um registro persistido pelo SQLite. Reversões são individuais e exigem confirmação nativa.'), h('div', { className: 'mf-cat-toolbar', role: 'group', 'aria-label': 'Filtrar recibos' }, [{ id: 'all', label: 'Todas' }, { id: 'apply', label: 'Aplicações' },
            { id: 'correct', label: 'Correções' }, { id: 'undo', label: 'Reversões' }].map((v) => h('button', { key: v.id, type: 'button', 'aria-pressed': autoReceiptFilter === v.id,
            className: autoReceiptFilter === v.id ? 'is-selected' : '',
            disabled: autoReceiptBusy, onClick: () => {
                setAutoReceiptFilter(v.id);
                setAutoReceiptDetail(null);
                void loadAutoReceipts(v.id);
            } }, v.label))), h('p', { className: 'mf-cat-caption' }, String(autoReceiptTotal) + ' recibo(s) neste filtro. ' +
            'A listagem não altera movimentações.'), autoReceipts.length ? h('div', { className: 'mf-cat-receipt-list' }, autoReceipts.map((r) => {
            var _a, _b, _c;
            return h('article', { key: r.receiptId, className: 'mf-cat-receipt' }, h('div', { className: 'mf-cat-receipt-top' }, h('span', { className: 'mf-cat-step' }, r.action === 'apply' ? 'CATEGORIZAÇÃO' :
                r.action === 'undo' ? 'REVERSÃO' : 'CORREÇÃO HUMANA'), h('small', {}, r.at ? new Date(r.at).toLocaleString('pt-BR') : 'Sem data confirmada')), h('strong', {}, r.description || 'Movimentação bancária'), h('p', {}, (r.accountName || 'Conta do histórico') + ' · ' +
                String(((_a = byId(r.afterCategoryId)) === null || _a === void 0 ? void 0 : _a.name) || r.afterCategoryId || 'Sem categoria após operação')), h('div', { className: 'mf-cat-toolbar' }, h('button', { type: 'button', 'aria-expanded': (autoReceiptDetail === null || autoReceiptDetail === void 0 ? void 0 : autoReceiptDetail.receiptId) === r.receiptId,
                onClick: () => setAutoReceiptDetail((autoReceiptDetail === null || autoReceiptDetail === void 0 ? void 0 : autoReceiptDetail.receiptId) === r.receiptId ? null : r) }, 'Detalhes'), r.action === 'apply' && r.active && !r.reversed ? h('button', { type: 'button',
                disabled: autoBusy || !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available), onClick: () => void undoAutoReceipt(r) }, 'Desfazer classificação') : null, h('button', { type: 'button', onClick: () => {
                    setSearch(r.description || '');
                    setSource('bank');
                    setTab('all');
                    setAutoPanel(false);
                } }, 'Localizar em Movimentações')), (autoReceiptDetail === null || autoReceiptDetail === void 0 ? void 0 : autoReceiptDetail.receiptId) === r.receiptId ? h('div', { className: 'mf-cat-receipt-detail' }, h('p', {}, 'ID do recibo: ' + r.receiptId), h('p', {}, 'Movimentação: ' + r.accountId + ' / ' + r.externalId), h('p', {}, 'Antes: ' + (((_b = byId(r.beforeCategoryId)) === null || _b === void 0 ? void 0 : _b.name) || r.beforeCategoryId || 'Sem classificação D05')), h('p', {}, 'Depois: ' + (((_c = byId(r.afterCategoryId)) === null || _c === void 0 ? void 0 : _c.name) || r.afterCategoryId || 'Sem classificação D05')), h('p', {}, 'Evidência: ' + (r.explanation || 'Hash registrado no recibo (detalhes não preservados neste registro).')), h('p', {}, 'Commit SQLite confirmado · ' + (r.reversed ? 'Revertida' : r.active ? 'Ativa' : 'Não ativa'))) : null);
        })) : h('p', { className: 'mf-cat-empty' }, autoReceiptBusy ? 'Consultando recibos…' : 'Nenhum recibo encontrado neste filtro.'), autoReceiptCursor ? h('button', { type: 'button', disabled: autoReceiptBusy,
            onClick: () => void loadAutoReceipts(autoReceiptFilter, autoReceiptCursor) }, autoReceiptBusy ? 'Carregando…' : 'Carregar mais recibos') : null) : null, autoView === 'security' ? h('div', { className: 'mf-cat-grid-layout' }, h('section', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, '06 / RESILIÊNCIA'), h('h3', {}, 'Segurança e recuperação'), h('p', {}, 'Esta área informa estados existentes. Não faz reparos destrutivos ou sincronizações adicionais.'), h('div', { className: 'mf-cat-security-list' }, [{ title: 'Disponibilidade', value: (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) ? 'Distribuição estável habilitada' : 'Somente após homologação' },
            { title: 'Autorização', value: (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.enabled) ? 'Contas no período de validade' : 'Sem contas válidas autorizadas' },
            { title: 'Primeiro lote', value: (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.initialConfirmed) ? 'Confirmado no MAIN' : 'Aguardando prévia e confirmação' },
            { title: 'Verificações', value: ((_u = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _u === void 0 ? void 0 : _u.paused) ? 'Pausadas explicitamente' : 'Automação local não pausada' },
            { title: 'Último job', value: ((_w = (((_v = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _v === void 0 ? void 0 : _v.jobs) || [])[0]) === null || _w === void 0 ? void 0 : _w.state) || 'Nenhuma execução' }].map((v) => h('div', { key: v.title, className: 'mf-cat-security-row' }, h('strong', {}, v.title), h('span', {}, v.value)))), (((_x = autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.jobs) === null || _x === void 0 ? void 0 : _x.jobs) || []).some((x) => x.state === 'failed' || x.state === 'running') ?
            h('p', { className: 'd05-notice', role: 'alert' }, 'Há job falho ou interrompido. Consulte os recibos; uma nova tentativa só deve ocorrer com consentimento válido e estado íntegro.') : null, autoMessage ? h('p', { className: 'd05-notice', role: 'alert' }, autoMessage) : null), h('aside', { className: 'mf-cat-surface' }, h('span', { className: 'mf-cat-step' }, 'GARANTIAS'), h('h3', {}, 'O que nunca muda sem sua decisão'), h('p', {}, 'A categorização utiliza overlay separado. O extrato bancário e os valores originais não são substituídos.'), h('p', {}, 'Um backup verificado é necessário antes da escrita. Falhas de aplicação bloqueiam novas tentativas automáticas.'), h('div', { className: 'mf-cat-toolbar' }, h('button', { type: 'button', onClick: () => openAutoView('receipts') }, 'Consultar recibos'), h('button', { type: 'button', onClick: () => openAutoView('activation') }, 'Revisar autorizações')), !(autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) ? h('p', { className: 'mf-cat-empty' }, 'Disponível após homologação Windows. Nenhuma escrita pessoal será habilitada na RC experimental.') : null)) : null), autoView !== 'security' && autoMessage ? h('p', { className: 'd05-notice', role: 'status', 'aria-live': 'polite' }, autoMessage) : null) : null) : null, h('div', { className: 'd05-metrics' }, [{ name: 'Entradas confirmadas', value: format(income), tone: 'positive', note: 'No escopo selecionado' },
            { name: 'Saídas confirmadas', value: format(expense), tone: 'negative', note: 'Sem pendentes' },
            { name: 'Resultado dos registros', value: format(income - expense), tone: income - expense >= 0 ? 'positive' : 'negative', note: 'Não é saldo disponível' },
            { name: 'A conferir', value: String(needs), tone: 'review', note: 'Banco POSTED não revisado' }
        ].map((m, i) => h(i === 3 ? 'button' : 'article', { key: m.name, type: i === 3 ? 'button' : undefined,
            className: 'd05-metric is-' + m.tone, onClick: i === 3 ? () => setFilter(() => { setTab('pending'); setSource('bank'); setMetricSource('bank'); }) : undefined }, h('small', {}, m.name), h('strong', {}, m.value), h('span', {}, m.note)))), h('section', { className: 'd05-history' }, h('div', { className: 'd05-section-head' }, h('div', {}, h('h2', {}, 'Seu histórico'), h('p', {}, 'Valores por ' + (totalsSource === 'bank' ? 'contas bancárias' : 'movimentações manuais') +
            (source === 'all' && sources.size > 1 ? ' · outras origens visíveis, sem somar duplicatas' : ''))), h('button', { type: 'button', className: 'd05-ghost', onClick: () => { host.setState({ txOrganize: true }); } }, 'Categorias e regras')), h('div', { className: 'd05-tabs', role: 'group', 'aria-label': 'Situação da conferência' }, [{ id: 'all', label: 'Todas' }, { id: 'pending', label: 'A conferir' }, { id: 'reviewed', label: 'Revisadas' }].map((x) => h('button', { type: 'button', key: x.id, 'aria-pressed': tab === x.id, className: tab === x.id ? 'active' : '',
            onClick: () => setFilter(() => setTab(x.id)) }, x.label))), h('div', { className: 'd05-toolbar' }, h('label', { className: 'd05-search-wrap' }, h('span', { className: 'd05-sr-only' }, 'Buscar movimentações'), h('input', {
            value: search, placeholder: 'Buscar estabelecimento, descrição ou categoria',
            onChange: (e) => setFilter(() => setSearch(e.target.value))
        })), h('label', { className: 'd05-filter' }, 'Origem', h('select', { value: source, onChange: (e) => setFilter(() => setSource(e.target.value)) }, h('option', { value: 'all' }, 'Todas'), h('option', { value: 'bank' }, 'Banco'), h('option', { value: 'manual' }, 'Manuais'))), h('label', { className: 'd05-filter' }, 'Mês', h('input', { type: 'month', value: period, onChange: (e) => setFilter(() => setPeriod(e.target.value)) })), h('button', { type: 'button', className: 'd05-more', onClick: () => setAdvanced(!advanced), 'aria-expanded': advanced }, 'Filtros ' + (advanced ? '−' : '+'))), advanced ? h('div', { className: 'd05-advanced' }, h('label', { className: 'd05-filter' }, 'Conta', h('select', { value: account, onChange: (e) => setFilter(() => setAccount(e.target.value)) }, h('option', { value: '' }, 'Todas as contas'), (state.bank.data.accounts || []).map((a) => h('option', { key: a.id, value: a.id }, a.name)))), h('label', { className: 'd05-filter' }, 'Natureza', h('select', { value: kind, onChange: (e) => setFilter(() => setKind(e.target.value)) }, [['all', 'Todas'], ['income', 'Entradas'], ['expense', 'Saídas'], ['transfer', 'Transferências'], ['ignore', 'Ignoradas']].map((x) => h('option', { value: x[0], key: x[0] }, x[1])))), h('label', { className: 'd05-filter' }, 'Ordenação', h('select', { value: sort, onChange: (e) => setFilter(() => setSort(e.target.value)) }, [['newest', 'Mais recentes'], ['oldest', 'Mais antigas'], ['largest', 'Maior valor'], ['smallest', 'Menor valor']].map((x) => h('option', { value: x[0], key: x[0] }, x[1])))), h('label', { className: 'd05-filter' }, 'Resumo financeiro', h('select', { value: metricSource, onChange: (e) => setMetricSource(e.target.value) }, h('option', { value: 'bank' }, 'Bancário'), h('option', { value: 'manual' }, 'Manual'))), h('div', { className: 'd05-parent-filters' }, h('span', {}, 'Categorias'), h('button', { type: 'button', className: !categoryId ? 'active' : '', onClick: () => setFilter(() => { setCategoryId(''); setSubcategoryId(''); }) }, 'Todas'), parents.map((p) => h('button', { type: 'button', key: p.id, className: categoryId === p.id ? 'active' : '', onClick: () => setFilter(() => { setCategoryId(p.id); setSubcategoryId(''); }) }, h(D05VectorIcon, { iconKey: p.iconKey, hue: p.hue, size: 15 }), p.name))), categoryId ? h('div', { className: 'd05-parent-filters' }, h('span', {}, 'Subcategoria'), h('button', { type: 'button', className: !subcategoryId ? 'active' : '', onClick: () => setFilter(() => setSubcategoryId('')) }, 'Todas'), (((_y = byId(categoryId)) === null || _y === void 0 ? void 0 : _y.subcategories) || []).map((c) => h('button', { type: 'button', key: c.id, className: subcategoryId === c.id ? 'active' : '', onClick: () => setFilter(() => setSubcategoryId(c.id)) }, c.name))) : null) : null, h('div', { className: 'd05-history-controls' }, h('button', { type: 'button', role: 'switch', 'aria-checked': group, 'aria-label': 'Agrupar por dia', className: 'd05-group-toggle', onClick: () => setGroup(!group) }, h('span', { className: 'd05-switch-track' }, h('span', { className: 'd05-switch-thumb' })), 'Agrupar por dia'), h('span', {}, filtered.length + ' movimentações no escopo' + (filtered.length > 500 ? ' · exibindo 500' : ''), pending ? ' · ' + pending + ' em processamento' : '', ignored ? ' · ' + ignored + ' transferência(s)/ignorada(s) fora dos totais' : '')), partial ? h('p', { className: 'd05-notice', role: 'status' }, 'Histórico parcial: ' + bankData.length + ' de ' + String(state.bank.data.totalTransactions || '?') + ' movimentações bancárias carregadas. Métricas apenas desta amostra.') : null, selected.size ? h('div', { className: 'd05-bulk-bar', role: 'region', 'aria-label': 'Ações em lote' }, h('b', {}, selected.size + ' selecionada(s)'), h('button', { type: 'button', onClick: (e) => openPicker(e, null, 'batch') }, 'Categorizar seleção'), h('button', { type: 'button', onClick: () => setSelected(new Set()) }, 'Limpar seleção')) : null, filtered.length ? h('div', { className: 'd05-list' }, onScreen.map((r, i) => {
            var _a;
            const p = byId(r.categoryId) || byName(r.category), child = (_a = p === null || p === void 0 ? void 0 : p.subcategories) === null || _a === void 0 ? void 0 : _a.find((c) => c.id === r.subcategoryId);
            const icon = resolveCategoryVisualIdentity({ categoryId: r.categoryId || null,
                subcategoryId: r.subcategoryId || null, categoryName: r.category, catalog: parents });
            const isReview = r.source === 'bank' && r.status === 'POSTED' && !r.reviewed;
            const signed = r.kind === 'transfer' || r.kind === 'ignore' ? 'neutral' : r.amount >= 0 ? 'positive' : 'negative';
            const isSelected = selected.has(r.key);
            const selectAllowed = r.source === 'bank';
            return h('div', { className: 'd05-list-item', key: r.key }, group && (i === 0 || onScreen[i - 1].date !== r.date) ? h('div', { className: 'd05-day' }, pDate(r.date)) : null, h('article', { className: 'd05-row ' + (isSelected ? 'is-selected' : ''),
                onClick: () => openDetail(r) }, h('button', { type: 'button', className: 'd05-select ' + (isSelected ? 'selected' : ''),
                'aria-label': 'Selecionar ' + r.merchant, 'aria-pressed': isSelected, disabled: !selectAllowed,
                onClick: (e) => { e.stopPropagation(); const next = new Set(selected); if (next.has(r.key))
                    next.delete(r.key);
                else
                    next.add(r.key); setSelected(next); setPicker(null); setPreview(null); } }, h('span', { 'aria-hidden': 'true' }, isSelected ? '✓' : '')), h('button', { type: 'button', className: 'd05-row-icon', 'aria-label': 'Alterar categoria de ' + r.merchant,
                onClick: (e) => openPicker(e, r) }, h(CategoryVisualGlyph, { identity: icon, size: 23 })), h('div', { className: 'd05-row-info' }, h('div', { className: 'd05-merchant-line' }, h('button', { type: 'button', className: 'd05-merchant', onClick: (e) => { e.stopPropagation(); openDetail(r); } }, r.merchant), isReview ? h('button', { type: 'button', className: 'd05-review-dot', 'aria-label': 'Conferir movimentação ' + r.merchant,
                title: 'A conferir', onClick: (e) => { e.stopPropagation(); activeTrigger.current = e.currentTarget; setError(''); setReview(r); } }, h('span', { 'aria-hidden': 'true' })) : null, r.source === 'bank' && r.status === 'PENDING' ? h('span', { className: 'd05-pending', title: 'Em processamento', 'aria-label': 'Em processamento' }, h(D05VectorIcon, { iconKey: 'clock-3', hue: 37, size: 16 })) : null), h('small', {}, r.account + ' · ' + ((p === null || p === void 0 ? void 0 : p.name) || r.category) + (child ? ' › ' + child.name : ''), r.source === 'manual' ? ' · Manual' : r.raw.categorySource === 'automatic' ? ' · Automática (evidência verificada)' : ''), r.merchant !== r.description ? h('small', { className: 'd05-desc' }, r.description) : null), h('div', { className: 'd05-row-end' }, h('strong', { className: 'd05-amount ' + signed }, (r.amount >= 0 ? '+' : '−') + format(Math.abs(r.amount))), r.source === 'bank' && r.raw.categorySource === 'automatic' ?
                h('small', { title: r.raw.automaticEvidence || 'Evidência de histórico local' }, 'Categorização local verificada') : null, r.source === 'bank' && r.raw.categorySource === 'automatic' && (autoInfo === null || autoInfo === void 0 ? void 0 : autoInfo.available) && (bridge === null || bridge === void 0 ? void 0 : bridge.bankAutoUndo) ?
                h('button', { type: 'button', className: 'd05-ghost', disabled: autoBusy,
                    onClick: async (e) => {
                        e.stopPropagation();
                        setAutoBusy(true);
                        setAutoMessage('');
                        try {
                            const outcome = await bridge.bankAutoUndo({ accountId: r.accountId, externalId: r.id });
                            if (outcome === null || outcome === void 0 ? void 0 : outcome.undone) {
                                await host.refreshBank();
                                await refreshHierarchy();
                                await refreshAuto();
                                setAutoMessage('Classificação revertida. Movimento protegido contra reaplicação automática.');
                            }
                        }
                        catch (error) {
                            setAutoMessage(String((error === null || error === void 0 ? void 0 : error.message) || error));
                        }
                        finally {
                            setAutoBusy(false);
                        }
                    } }, 'Desfazer') : null, r.kind === 'transfer' || r.kind === 'ignore' ? h('small', {}, r.kind === 'transfer' ? 'Transferência' : 'Desconsiderada') : null)));
        })) : h('div', { className: 'd05-empty' }, h('strong', {}, 'Nenhuma movimentação encontrada'), h('p', {}, 'Altere a pesquisa ou os filtros para continuar.'), h('button', { type: 'button', onClick: () => { setSearch(''); setPeriod(''); setAccount(''); setCategoryId(''); setSubcategoryId(''); setKind('all'); setTab('all'); setSource('all'); } }, 'Limpar filtros'))), chooser, reviewPanel, manualPanel);
    }
}
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
        role: 'slider', tabIndex: 0, ref: (el) => { if (el && el.getAttribute('tabindex') !== '0')
            el.setAttribute('tabindex', '0'); }, 'aria-label': 'Dia selecionado no gráfico de saldo · ' + prettyMonth(month),
        'aria-valuemin': 1, 'aria-valuemax': max, 'aria-valuenow': Number(s.planDay.slice(-2)),
        'aria-valuetext': pDate(s.planDay) + ' · ' + (selected ? fmt(selected.closing) : 'sem valor') + ' · ' + deltaLabel,
        onKeyDown: keyDay,
        onPointerDown: (e) => { var _a, _b; if (e.button !== 0)
            return; (_b = (_a = e.currentTarget).focus) === null || _b === void 0 ? void 0 : _b.call(_a); try {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        catch { } selectPointer(e); },
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
    app.setState({ page: 'intelligence', intelligenceTab: 'chat', intelligenceMainMode: 'chat', categoryReviewOpen: false, intelligenceDraftScope: scope, intelligencePanelOpen: false, detail: null, planSelected: null }, () => { var _a; return (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, behavior: 'instant' }); });
}
function intelligencePrepare(app, question) {
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    app.setState({ page: 'intelligence', intelligenceTab: 'chat', intelligenceMainMode: 'chat', intelligenceDraft: question, intelligenceDraftScope: app.state.intelligencePanelOpen && app.state.intelligenceContextSnapshot ? app.state.intelligenceContextSnapshot : intelligencePageScope(app), intelligencePanelOpen: false, detail: null, planSelected: null });
}
function renderIntelligenceStructuredCard(card) {
    return h('div', { className: 'mf-ai-structured-card', role: 'region', 'aria-label': card.title }, h('div', { className: 'mf-ai-structured-head' }, h('strong', {}, card.title), card.subtitle ? h('small', {}, card.subtitle) : null), Array.isArray(card.metrics) && card.metrics.length ? h('div', { className: 'mf-ai-structured-metrics' }, ...card.metrics.map((m, idx) => h('div', { key: idx, className: 'mf-ai-structured-metric is-' + (m.tone || 'neutral') }, h('small', {}, m.label), h('strong', {}, m.value)))) : null, Array.isArray(card.rows) && card.rows.length ? h('div', { className: 'mf-ai-table-wrap' }, h('table', {}, card.headers ? h('thead', {}, h('tr', {}, h('th', {}, card.headers[0]), h('th', {}, card.headers[1]), card.headers[2] ? h('th', {}, card.headers[2]) : null)) : null, h('tbody', {}, ...card.rows.map((r, idx) => h('tr', { key: idx }, h('td', {}, r.col1), h('td', {}, r.col2), r.col3 !== undefined ? h('td', {}, r.col3) : null))))) : null, card.footnote ? h('small', { className: 'mf-ai-structured-foot' }, card.footnote) : null);
}
function renderIntelligenceActionProposalCard(app, proposal) {
    return renderMfD01Proposal(app, proposal);
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
    if (msg.id.startsWith('local-a-') && !mfLocalMessageLive(app, msg))
        return h('article', { className: 'mf-ai-msg is-assistant is-unavailable' }, h('p', { role: 'status' }, 'Resposta anterior indisponível: a autorização ou o período mudou. Faça uma nova consulta.'));
    if (msg.id.startsWith('ic2-a-') && !mfIC2MessageLive(app, msg))
        return h('article', { className: 'mf-ai-msg is-assistant is-unavailable' }, h('p', { role: 'status' }, 'Consulta anterior bloqueada: a autorização mudou ou expirou. Autorize e consulte novamente.'));
    const isUser = msg.role === 'user';
    const badge = msg.status === 'unavailable' ? h('span', { className: 'mf-ai-msg-badge is-warn' }, 'Consulta não autorizada') :
        msg.status === 'unsupported' ? h('span', { className: 'mf-ai-msg-badge is-info' }, 'Consulta não reconhecida') :
            msg.status === 'unimplemented' ? h('span', { className: 'mf-ai-msg-badge is-info' }, 'Aguarda I2-A') :
                msg.status === 'error' ? h('span', { className: 'mf-ai-msg-badge is-error' }, 'Serviço indisponível') : null;
    return h('article', { key: msg.id, className: 'mf-ai-msg ' + (isUser ? 'is-user' : 'is-assistant') + ' is-' + msg.status }, h('header', { className: 'mf-ai-msg-meta' }, h('strong', {}, isUser ? 'Você' : 'Assistente MF'), h('span', {}, msg.scopeLabel + ' · ' + msg.periodLabel + ' · ' + msg.createdAt), badge), h('div', { className: 'mf-ai-msg-body mf-ai-markdown' }, ...aiMarkdownNodes(msg.text)), msg.id.startsWith('ic2-a-') && msg.ic2Reply && typeof renderMfIC2Adaptive === 'function'
        ? (renderMfIC2Adaptive(app, msg) || (msg.structuredCard && !msg.visual && !msg.visualV3 ? renderIntelligenceStructuredCard(msg.structuredCard) : null))
        : (msg.structuredCard && !msg.visual && !msg.visualV3 ? renderIntelligenceStructuredCard(msg.structuredCard) : null), msg.visualV3 ? mfV3Render(app, msg) : msg.visual ? renderMfVisual(app, msg) : null, msg.operationalEvidence ? h('small', { className: 'mf-premium-evidence' }, msg.operationalEvidence) : null, Array.isArray(msg.operationalActions) && msg.operationalActions.length ? h('div', { className: 'mf-premium-tile-actions' }, ...msg.operationalActions.map((action) => intelligencePremiumButton(app, null, action))) : null, msg.proposal ? renderIntelligenceActionProposalCard(app, msg.proposal) : null, msg.id.startsWith('review-answer-') ? h('button', { type: 'button', className: 'primary-button', onClick: () => void categoryReviewOpen(app) }, 'Abrir Central de Revisão') : null, msg.details ? h('details', { className: 'mf-ai-msg-details' }, h('summary', {}, 'Ver contexto e diagnóstico'), h('p', {}, msg.details)) : null);
}
function intelligenceExampleCard(app, id, title, description, icon, question) {
    return h('div', { className: 'mf-ai-example-card', key: id }, h('span', { className: 'mf-ai-example-icon' }, h(Icon, { name: icon, size: 20 })), h('div', { className: 'mf-ai-example-copy' }, h('strong', {}, title), h('p', {}, description), h('button', { type: 'button', className: 'mf-ai-link', onClick: () => intelligencePrepare(app, question) }, 'Preparar análise', h(Icon, { name: 'arrow', size: 15 }))));
}
function renderIntelligenceHistorySidebar(app) {
    var _a, _b;
    const s = app.state;
    const query = String(s.intelligenceHistoryQuery || '');
    const groups = typeof intelligenceGroupThreadsByDate === 'function' ? intelligenceGroupThreadsByDate(app, query) : [];
    const activeId = s.intelligenceActiveThreadId || null;
    const totalThreads = Array.isArray(s.intelligenceThreads) ? s.intelligenceThreads.length : 0;
    return h('aside', { className: 'mf-ai-history-sidebar', 'aria-label': 'Histórico de conversas' }, h('div', { className: 'mf-ai-history-top' }, h('div', { className: 'mf-ai-history-title-row' }, h('strong', {}, 'Conversas'), h('span', { className: 'mf-ai-thread-count' }, String(totalThreads))), h('button', { type: 'button', className: 'primary-button mf-ai-new-thread-btn', onClick: () => intelligenceCreateThread(app) }, h(Icon, { name: 'plus', size: 14 }), 'Nova conversa')), h('div', { className: 'mf-ai-history-search' }, h('input', { type: 'search', value: query, maxLength: 120, placeholder: 'Buscar no histórico…', 'aria-label': 'Buscar conversas no histórico', onChange: (e) => app.setState({ intelligenceHistoryQuery: e.target.value }) })), s.intelligenceStorageError ? h('p', { className: 'mf-ai-error mf-ai-storage-error', role: 'alert' }, s.intelligenceStorageError) : null, groups.length === 0 ? h('div', { className: 'mf-ai-history-empty' }, h('p', {}, query.trim() ? 'Nenhuma conversa encontrada para “' + query.trim() + '”.' : 'Nenhuma conversa salva neste perfil (' + (s.mode === 'demo' ? 'Demonstração' : 'Pessoal') + ').'), h('small', {}, (s.categoryReviewGrant || ((_a = s.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token)) ? 'Conversa temporária. Mensagens e autorizações não são gravadas no histórico do perfil.' : 'O histórico deste perfil é local e não usa o cofre criptografado. Não inclua senhas nem tokens.')) :
        h('div', { className: 'mf-ai-history-groups', role: 'list' }, ...groups.map((grp) => h('div', { key: grp.label, className: 'mf-ai-history-group' }, h('span', { className: 'mf-ai-history-date-label' }, grp.label), ...grp.items.map((th) => h('div', { key: th.id, role: 'listitem', className: 'mf-ai-thread-item ' + (th.id === activeId ? 'is-active' : '') }, h('button', { type: 'button', className: 'mf-ai-thread-select', 'aria-current': th.id === activeId ? 'true' : 'false', onClick: () => intelligenceSelectThread(app, th.id) }, h('strong', {}, th.title), h('small', {}, th.scopeLabel + ' · ' + th.updatedTime + ' · ' + th.messages.length + ' msg')), h('button', { type: 'button', className: 'mf-ai-thread-delete', 'aria-label': 'Excluir conversa ' + th.title, title: 'Excluir conversa', onClick: () => intelligenceDeleteThread(app, th.id) }, '×')))))), totalThreads > 0 ? h('div', { className: 'mf-ai-history-foot' }, h('button', { type: 'button', className: 'ghost-button full', onClick: () => intelligenceClearHistory(app) }, (s.categoryReviewGrant || ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token)) ? 'Limpar conversa temporária' : 'Limpar histórico do perfil')) : null);
}
const MF_PREMIUM_IDS = ['UI-01', 'UI-02', 'UI-03', 'UI-04', 'UI-05', 'UI-06', 'UI-07', 'UI-08'];
function intelligencePremiumAPI() { return desktop; }
function intelligencePremiumSignature(app) {
    const s = app.state, a = s.localFinancialAccess, g = s.categoryReviewGrant;
    return JSON.stringify([s.mode, s.localFinancialMonth || s.month, (a === null || a === void 0 ? void 0 : a.token) || '', (a === null || a === void 0 ? void 0 : a.source) || '', (a === null || a === void 0 ? void 0 : a.profile) || '',
        (a === null || a === void 0 ? void 0 : a.planning) === true, (g === null || g === void 0 ? void 0 : g.token) || '', s.bankFilter || '']);
}
function intelligencePremiumInvalidate(app) {
    app.__premiumRequest = (app.__premiumRequest || 0) + 1;
    app.setState({ intelligencePremiumReport: null, intelligencePremiumSignature: null, intelligencePremiumLoading: false, intelligencePremiumError: '' });
}
async function intelligencePremiumLoad(app) {
    var _a, _b;
    const api = intelligencePremiumAPI(), signature = intelligencePremiumSignature(app), s = app.state;
    const sequence = (app.__premiumRequest || 0) + 1;
    app.__premiumRequest = sequence;
    app.setState({ intelligencePremiumLoading: true, intelligencePremiumSignature: signature, intelligencePremiumReport: null, intelligencePremiumError: '' });
    if (typeof (api === null || api === void 0 ? void 0 : api.intelligenceOperationalOverview) !== 'function') {
        if (sequence === app.__premiumRequest)
            app.setState({ intelligencePremiumLoading: false,
                intelligencePremiumError: 'A integração com os serviços do PR #51 ainda não está disponível nesta versão do aplicativo.' });
        return;
    }
    const a = s.localFinancialAccess, g = s.categoryReviewGrant, month = s.localFinancialMonth || s.month;
    try {
        const result = await api.intelligenceOperationalOverview({
            month, source: (a === null || a === void 0 ? void 0 : a.source) || (s.mode === 'demo' ? 'manual' : s.localFinancialSource || 'bank'),
            profile: (a === null || a === void 0 ? void 0 : a.profile) || (s.mode === 'demo' ? 'demo' : 'real'), token: (a === null || a === void 0 ? void 0 : a.token) || null, reviewToken: (g === null || g === void 0 ? void 0 : g.token) || null
        });
        if (sequence !== app.__premiumRequest || signature !== intelligencePremiumSignature(app))
            return;
        if ((result === null || result === void 0 ? void 0 : result.contract) !== 'IC-v1/I-P0.1' || ((_a = result === null || result === void 0 ? void 0 : result.privacy) === null || _a === void 0 ? void 0 : _a.changesApplied) !== false ||
            ((_b = result === null || result === void 0 ? void 0 : result.privacy) === null || _b === void 0 ? void 0 : _b.personalAIWritingEnabled) !== false ||
            !Array.isArray(result.cards) || result.cards.length !== 8 ||
            MF_PREMIUM_IDS.some((id, i) => { var _a; return ((_a = result.cards[i]) === null || _a === void 0 ? void 0 : _a.id) !== id; }))
            throw Error('Contrato financeiro inválido.');
        app.setState({ intelligencePremiumReport: result, intelligencePremiumLoading: false, intelligencePremiumError: '' });
    }
    catch (error) {
        if (sequence !== app.__premiumRequest || signature !== intelligencePremiumSignature(app))
            return;
        app.setState({ intelligencePremiumLoading: false, intelligencePremiumReport: null,
            intelligencePremiumError: String((error === null || error === void 0 ? void 0 : error.message) || 'Não foi possível carregar esta análise.').slice(0, 220) });
    }
}
function intelligencePremiumMoney(value) {
    return Number.isSafeInteger(value) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100) : '—';
}
function intelligencePremiumCoverage(value) {
    return value === 'complete_local' ? 'Histórico local analisado' : value === 'partial_local' ? 'Cobertura parcial da fonte local' : 'Cobertura não certificada';
}
function intelligencePremiumState(c) {
    if (!c)
        return 'Aguardando consulta.';
    if (c.uiState === 'ready')
        return '';
    const labels = { loading: 'Consultando dados…', empty: 'Sem registros aplicáveis neste período.',
        denied: 'Autorização necessária para consultar.', expired: 'A autorização expirou. Autorize novamente.',
        stale: 'Consulta desatualizada. Atualize o período.', error: 'Não foi possível consultar esta fonte.',
        unsupported: 'Não disponível para esta fonte ou perfil.' };
    return c.unavailableReason || labels[c.uiState] || 'Não disponível no momento.';
}
function intelligencePremiumAction(app, c, a) {
    var _a, _b;
    if (!(a === null || a === void 0 ? void 0 : a.permitted) || !a.handler)
        return;
    switch (a.handler) {
        case 'navigation:transactions-review':
            app.navigate('review');
            return;
        case 'navigation:transactions':
            app.navigate('transactions');
            return;
        case 'navigation:budgets':
            app.navigate('budgets');
            return;
        case 'navigation:planning':
            app.navigate('planning');
            return;
        case 'navigation:category-editor':
            app.navigate('categories');
            setTimeout(() => { const node = document.getElementById('mf-category-editor-heading'); node === null || node === void 0 ? void 0 : node.scrollIntoView({ block: 'center' }); node === null || node === void 0 ? void 0 : node.focus(); }, 0);
            return;
        case 'navigation:intelligence-chat':
            app.setState({ page: 'intelligence', intelligenceTab: 'chat', intelligenceMainMode: 'chat', categoryReviewOpen: false });
            return;
        case 'navigation:review-history':
            if ((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token)
                void categoryReviewOpen(app);
            return;
        case 'categoryReviewPrepare':
            if (!((_b = app.state.categoryReviewGrant) === null || _b === void 0 ? void 0 : _b.token) || !a.previewRequired || !a.operationId)
                return;
            void (async () => {
                var _a;
                await categoryReviewOpen(app);
                if ((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token)
                    await categoryReviewPrepare(app, 'rule', { suggestionId: a.operationId });
            })();
            return;
    }
}
function intelligencePremiumButton(app, c, a) {
    var _a, _b;
    const routes = ['navigation:transactions-review', 'navigation:transactions', 'navigation:budgets', 'navigation:planning',
        'navigation:category-editor', 'navigation:intelligence-chat', 'navigation:review-history', 'categoryReviewPrepare'];
    const enabled = !!(a === null || a === void 0 ? void 0 : a.permitted) && routes.includes(a === null || a === void 0 ? void 0 : a.handler) &&
        (a.handler !== 'navigation:category-editor' || app.state.mode !== 'demo') &&
        (a.handler !== 'categoryReviewPrepare' || (a.previewRequired === true && !!a.operationId && !!((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token))) &&
        (a.handler !== 'navigation:review-history' || !!((_b = app.state.categoryReviewGrant) === null || _b === void 0 ? void 0 : _b.token));
    return h('button', { type: 'button', key: a.actionId, className: 'mf-premium-action',
        disabled: !enabled, title: !enabled ? (a.disabledReason || 'Ação indisponível neste perfil.') : a.label,
        onClick: () => intelligencePremiumAction(app, c, a) }, a.label, h(Icon, { name: 'arrow', size: 14 }));
}
function intelligencePremiumEvidence(c) {
    var _a;
    if (!c)
        return null;
    return h('small', { className: 'mf-premium-evidence' }, (c.profile === 'synthetic' ? 'Ambiente sintético' : c.source === 'planning' ? 'Planejamento' : c.source === 'bank' ? 'Banco' : c.source === 'manual' ? 'Manual' : 'Fonte local') +
        ' · ' + intelligencePremiumCoverage(c.coverage) +
        (((_a = c.period) === null || _a === void 0 ? void 0 : _a.start) ? ' · ' + c.period.start.slice(0, 7) : ''));
}
function intelligencePremiumTile(app, c, icon, variant = '') {
    var _a;
    if (!c)
        return null;
    const available = c.uiState === 'ready' || c.uiState === 'empty';
    const actions = Array.isArray(c.actions) ? c.actions : [];
    return h('article', { key: c.id, className: 'mf-premium-tile ' + variant + ' is-' + c.uiState, 'aria-labelledby': 'mf-premium-' + c.id }, h('header', { className: 'mf-premium-tile-head' }, h('span', { className: 'mf-premium-tile-icon' }, h(Icon, { name: icon, size: 19 })), h('span', { className: 'mf-premium-contract' }, c.id)), h('h3', { id: 'mf-premium-' + c.id }, c.title), available && Number.isSafeInteger(c.valueCents) ? h('strong', { className: 'mf-premium-value' }, intelligencePremiumMoney(c.valueCents)) :
        available && Number.isSafeInteger(c.count) ? h('strong', { className: 'mf-premium-value' }, String(c.count)) : null, h('p', { className: 'mf-premium-tile-explanation' }, available ?
        (c.uiState === 'empty' ? intelligencePremiumState(c) : c.description || 'Informações disponíveis da fonte consultada.') :
        intelligencePremiumState(c)), available && c.id === 'UI-01' && ((_a = c.evidence) === null || _a === void 0 ? void 0 : _a[1]) ?
        h('p', { className: 'mf-premium-review-split' }, 'Confirmadas: ' + c.evidence[1].posted + ' · Pendentes no banco: ' + c.evidence[1].pendingBank + '. Pendente no banco não implica categoria pendente.') : null, available ? intelligencePremiumEvidence(c) : null, h('div', { className: 'mf-premium-tile-actions' }, ...actions.map((a) => intelligencePremiumButton(app, c, a))));
}
function intelligencePremiumBudgetChart(c) {
    const budgets = (Array.isArray(c === null || c === void 0 ? void 0 : c.budgets) ? c.budgets : []).slice(0, 4);
    return h('div', { className: 'mf-premium-budget-list' }, ...budgets.map((b) => h('div', { key: b.category, className: 'mf-premium-budget-item' }, h('div', { className: 'mf-premium-budget-label' }, h('strong', {}, b.category), h('span', {}, intelligencePremiumMoney(b.spentCents) + ' / ' + intelligencePremiumMoney(b.limitCents))), Number.isFinite(b.percentage) && Number.isSafeInteger(b.limitCents) && b.limitCents > 0 ?
        h('div', { className: 'mf-premium-budget-track', role: 'progressbar', 'aria-label': 'Consumo do orçamento ' + b.category,
            'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, Math.max(0, b.percentage)) }, h('span', { className: b.percentage >= 100 ? 'is-over' : '', style: { width: Math.min(100, Math.max(0, b.percentage)) + '%' } })) : null)));
}
function renderIntelligencePremiumToday(app) {
    return typeof renderMfB05Today === 'function' ? renderMfB05Today(app) : renderMfD03Today(app);
}
function renderIntelligenceAccess(app) {
    if (typeof renderLocalFinancialAccess !== 'function')
        return null;
    const s = app.state, g = s.localFinancialAccess || s.categoryReviewGrant;
    if (!g)
        return renderLocalFinancialAccess(app);
    const expired = g.expiresAt <= Date.now();
    return h('details', { className: 'mf-chat-access', open: expired }, h('summary', {}, h(Icon, { name: 'shield', size: 15 }), expired ? 'Permissão expirada · renovar' : s.categoryReviewGrant ? 'Revisão sintética · gerenciar permissão' : 'Leitura local autorizada · fonte e período', h('small', {}, s.localFinancialMonth || s.month)), renderLocalFinancialAccess(app));
}
function intelligenceChatSession(app) {
    const s = app.state, g = s.localFinancialAccess || s.categoryReviewGrant;
    return { temporary: !!g, expired: !!g && g.expiresAt <= Date.now(), busy: !!(s.aiBusy || s.localFinancialBusy || s.intelligenceDrawerBusy) };
}
function renderIntelligenceComposer(app, drawer = false) {
    const s = app.state, session = intelligenceChatSession(app), draft = String(s.intelligenceDraft || ''), id = drawer ? 'mf-ai-drawer-input' : 'mf-ai-draft';
    const submit = () => { if (draft.trim() && !session.busy && !session.expired)
        void intelligenceSubmitQuestion(app, draft); };
    return h('form', { className: 'mf-chat-composer ' + (drawer ? 'mf-ai-drawer-composer' : 'mf-ai-composer'), onSubmit: (e) => { e.preventDefault(); submit(); } }, session.expired ? h('div', { className: 'mf-chat-expired', role: 'alert' }, h('strong', {}, 'Autorização expirada'), h('p', {}, 'Renove a permissão acima para consultar novamente. Seu rascunho foi preservado.')) : null, h('label', { className: 'mf-ai-composer-label', htmlFor: id }, 'Converse sobre seus registros'), h('textarea', { id, value: draft, rows: 2, maxLength: 750, disabled: session.busy, placeholder: 'Pergunte sobre despesas, categorias ou compromissos…', onChange: (e) => app.setState({ intelligenceDraft: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            submit();
        } } }), h('div', { className: 'mf-chat-compose-footer' }, h('small', {}, session.temporary ? 'Somente nesta sessão · sem IA externa' : 'Histórico local · não inclua credenciais'), h('small', {}, draft.length + '/750 · Shift + Enter para nova linha'), h('button', { type: 'submit', className: 'primary-button', disabled: !draft.trim() || session.busy || session.expired }, session.busy ? 'Consultando…' : 'Enviar', h(Icon, { name: 'arrow', size: 16 }))));
}
function renderIntelligenceFollowups(app) {
    var _a;
    const session = intelligenceChatSession(app), state = app.state, history = intelligenceHistoryList(app);
    const answered = new Set(history.filter(m => m.role === 'user')
        .map(m => String(m.text || '').trim().toLocaleLowerCase('pt-BR')));
    const grant = state.localFinancialAccess;
    const live = !!(grant === null || grant === void 0 ? void 0 : grant.token) && grant.expiresAt > Date.now() && grant.profile === state.mode;
    const review = !!((_a = state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) && state.categoryReviewGrant.expiresAt > Date.now();
    const report = state.intelligencePremiumSignature === intelligencePremiumSignature(app) ?
        state.intelligencePremiumReport : null;
    const signals = typeof mfD03EligibleReport === 'function' &&
        mfD03EligibleReport(report, app) ? mfD03Signals(report, app) : [];
    const sourceQuestions = [];
    if (live) {
        for (const signal of signals) {
            if (signal.kind === 'budget')
                sourceQuestions.push('Quais categorias ultrapassaram o orçamento?');
            if (signal.kind === 'commitment')
                sourceQuestions.push('Quanto tenho comprometido para o próximo mês?');
            if (signal.kind === 'review')
                sourceQuestions.push('Que movimentações preciso revisar?');
        }
        const latest = history.filter(m => m.role === 'assistant' && m.status === 'done').slice(-1)[0];
        if (latest && /alimentação|alimentacao/i.test(latest.text))
            sourceQuestions.push('Quanto gastei com alimentação neste mês?');
    }
    if (review)
        sourceQuestions.push('Que movimentações preciso revisar?');
    const scope = intelligenceContextFor(state.intelligenceContext || state.page);
    const fallbacks = live ? ['Quais foram minhas maiores despesas?', 'Quais despesas aumentaram?',
        'Que movimentações preciso revisar?'] : scope.questions || [];
    const candidates = [...new Set([...sourceQuestions, ...fallbacks])];
    const available = candidates.filter(q => !answered.has(q.trim().toLocaleLowerCase('pt-BR')))
        .filter(q => live || review || !/minhas|meus|foram|minha renda|comprometido/i.test(q)).slice(0, 3);
    if (!available.length)
        return null;
    return h('div', { className: 'mf-chat-followups', 'aria-label': 'Continuar a análise' }, ...available.map(q => h('button', { type: 'button', key: q, disabled: session.busy || session.expired,
        onClick: () => void intelligenceSubmitQuestion(app, q) }, q, h(Icon, { name: 'arrow', size: 13 }))));
}
function renderIntelligenceView(app) {
    if (typeof renderMfB05Main === 'function' && typeof renderMfB05Today === 'function' &&
        typeof renderMfB05Chat === 'function' && typeof renderMfB05Actions === 'function')
        return renderMfB05Main(app);
    return renderIntelligenceViewLegacy(app);
}
function renderIntelligenceViewLegacy(app) {
    var _a, _b, _c, _d, _e;
    if (((_a = app.state.workIntelligenceDemo) === null || _a === void 0 ? void 0 : _a.enabled) && typeof renderWorkIntelligenceDemo === 'function')
        return renderWorkIntelligenceDemo(app);
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    const s = app.state, tab = ['chat', 'today', 'actions'].includes(s.intelligenceMainMode) ? s.intelligenceMainMode : 'chat';
    if (s.categoryReviewOpen)
        return h('section', { className: 'section mf-intelligence-page' }, renderCategoryReview(app));
    const tabs = [{ id: 'today', label: 'Hoje' }, { id: 'chat', label: 'Conversar' }, { id: 'actions', label: 'Plano de ação' }];
    const messages = intelligenceHistoryList(app);
    const allProposals = typeof intelligenceAllProposals === 'function' ? intelligenceAllProposals(app) : messages.map(m => m.proposal).filter(Boolean);
    const convState = typeof intelligenceConversationState === 'function' ? intelligenceConversationState(app) : { kind: 'oauth_disconnected', pill: 'IA externa desconectada · leitura local requer autorização', badge: 'Conta desconectada', css: 'is-offline' };
    const activeScope = s.intelligenceDraftScope || intelligencePageScope(app, s.intelligenceContext || s.page);
    let section = null;
    if (tab === 'today')
        section = renderIntelligencePremiumToday(app);
    if (tab === 'chat')
        section = h('div', { className: 'mf-ai-workbench' + (s.intelligenceHistoryOpen ? '' : ' is-history-closed') }, s.intelligenceHistoryOpen ? renderIntelligenceHistorySidebar(app) : null, h('div', { className: 'mf-ai-chat-main mf-ai-workbench-main' }, h('div', { className: 'mf-ai-workbench-header' }, h('button', { type: 'button', className: 'ghost-button mf-ai-v3-history-toggle',
            'aria-expanded': !!s.intelligenceHistoryOpen, onClick: () => app.setState({ intelligenceHistoryOpen: !s.intelligenceHistoryOpen }) }, s.intelligenceHistoryOpen ? 'Recolher histórico' : 'Histórico de conversas'), h('div', { className: 'mf-ai-chat-hero' }, h('span', { className: 'mf-ai-orb' }, h(Icon, { name: 'spark', size: 25 })), h('h2', {}, 'Uma conversa, mais clareza.'), h('p', {}, (s.categoryReviewGrant || ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token)) ? 'Conversa temporária compartilhada com o chat lateral. Prévia e confirmação continuam disponíveis na Central.' : 'Histórico compartilhado com o chat lateral, salvo localmente quando disponível. Não cole credenciais.')), h('div', { className: 'mf-ai-workbench-badges' }, h('span', { className: 'mf-ai-conn-pill ' + convState.css }, ((_c = s.localFinancialAccess) === null || _c === void 0 ? void 0 : _c.token) ? 'Leitura local autorizada' : convState.pill), h('span', { className: 'mf-ai-scope-badge' }, 'Contexto: ' + activeScope.label + ' · ' + activeScope.period))), s.intelligenceDraftScope ? h('div', { className: 'mf-ai-context-meta' }, h('span', {}, 'Rascunho de ' + s.intelligenceDraftScope.label), h('span', {}, s.intelligenceDraftScope.period)) : null, s.intelligencePreparedQuestion ? h('div', { className: 'mf-ai-prepared', role: 'status' }, h('span', { className: 'micro-label' }, 'PERGUNTA PREPARADA · NÃO ENVIADA'), h('p', {}, s.intelligencePreparedQuestion), h('small', {}, 'Este rascunho não é enviado ao Sol. Use os casos fictícios autorizados abaixo; nenhuma chamada ocorreu aqui.')) : null, messages.length === 0 ? h('div', { className: 'mf-ai-empty-thread' }, h('h3', {}, 'Comece uma análise ou prepare uma categorização supervisionada'), h('p', {}, 'Escolha um ponto de partida. A mesma conversa acompanha você no chat lateral; consultas financeiras autorizadas ficam apenas nesta sessão.'), h('div', { className: 'mf-ai-starter-grid' }, ['Quais foram meus maiores gastos deste mês?', 'Compare minhas despesas com o mês anterior.', 'Quais orçamentos merecem atenção?', 'Quais compromissos tenho para o próximo mês?'].map((q, i) => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: i, onClick: () => intelligenceSubmitQuestion(app, q) }, h('span', {}, q), h(Icon, { name: 'arrow', size: 14 }))))) :
            h('div', { className: 'mf-ai-thread', role: 'log', 'aria-live': 'polite' }, ...messages.map(m => renderIntelligenceMessageItem(app, m)), (s.aiBusy || s.localFinancialBusy) ? h('div', { className: 'mf-ai-msg is-assistant is-streaming', role: 'status' }, h('strong', {}, 'Assistente MF'), h('p', {}, 'Processando solicitação…')) : null), s.aiError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.aiError) : null, renderIntelligenceFollowups(app), renderIntelligenceComposer(app)));
    else if (tab === 'actions')
        section = h('div', { className: 'mf-ai-actions' }, h('div', { className: 'mf-ai-welcome' }, h('span', { className: 'micro-label' }, 'AÇÕES SUPERVISIONADAS E EXEMPLOS · SEM GRAVAÇÃO AUTOMÁTICA'), h('h2', {}, 'Sugestões e prévias para revisar, nunca automáticas.'), h('p', {}, 'As propostas preparadas nas suas conversas aparecem abaixo mantendo a prévia sem gravação até a entrega I2-B.')), allProposals.length ? h('div', { className: 'mf-ai-proposals-list', 'aria-label': 'Propostas supervisionadas da sessão' }, ...allProposals.map(p => renderIntelligenceActionProposalCard(app, p))) :
            h('div', { className: 'mf-ai-empty-actions' }, h('p', {}, 'Nenhuma proposta supervisionada pendente nesta conversa. Peça no chat, por exemplo: “Categorize minha compra do mercado como Alimentação”.')), [{ id: 'limits', title: 'Revisar limites de categorias', description: 'Compare médias, compromissos e uma margem de segurança.', question: 'Prepare uma proposta de limites por categoria para o próximo mês.' },
            { id: 'reserve', title: 'Planejar reserva de emergência', description: 'Estime um objetivo compatível com despesas essenciais e liquidez.', question: 'Como construir uma reserva de emergência considerando meus compromissos?' },
            { id: 'review', title: 'Revisar despesas recorrentes', description: 'Identifique cobranças repetidas antes de propor mudanças.', question: 'Como posso avaliar se meus gastos recorrentes precisam de revisão?' }].map((item) => h('div', { className: 'mf-ai-action-card', key: item.id }, h('div', { className: 'mf-ai-action-text' }, h('span', { className: 'mf-ai-status' }, 'Exemplo ilustrativo'), h('h3', {}, item.title), h('p', {}, item.description), s.intelligenceExpandedAction === item.id ? h('div', { className: 'mf-ai-action-detail' }, 'Na versão conectada, esta proposta mostrará dados utilizados, impacto esperado, validade da análise e ações de aceitar, editar ou rejeitar. Nada será aplicado automaticamente.') : null), h('div', { className: 'mf-ai-action-buttons' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => app.setState({ intelligenceExpandedAction: s.intelligenceExpandedAction === item.id ? null : item.id }) }, s.intelligenceExpandedAction === item.id ? 'Recolher' : 'Ver detalhes'), h('button', { type: 'button', className: 'mf-ai-link', onClick: () => intelligencePrepare(app, item.question) }, 'Preparar análise', h(Icon, { name: 'arrow', size: 15 }))))));
    return h('section', { className: 'section mf-intelligence-page', 'aria-label': 'Inteligência financeira' }, h('div', { className: 'mf-ai-intro' }, h('div', {}, h('span', { className: 'micro-label' }, 'INTELIGÊNCIA FINANCEIRA'), h('h2', {}, 'Seu centro de comando financeiro'), h('p', {}, ((_d = s.localFinancialAccess) === null || _d === void 0 ? void 0 : _d.token) ? 'Hoje e chat consultam os registros autorizados; respostas somente nesta sessão.' : 'Leitura sob autorização, explicações verificáveis e decisões supervisionadas.')), h('span', { className: 'mf-ai-preview-label' }, h(Icon, { name: 'shield', size: 15 }), s.mode === 'demo' ? 'Demonstração isolada' : ((_e = s.localFinancialAccess) === null || _e === void 0 ? void 0 : _e.token) ? 'Leitura local autorizada' : 'Sem consulta externa')), h('details', { className: 'mf-ai-v3-access' }, h('summary', {}, 'Permissões de consulta'), renderIntelligenceAccess(app)), h('button', { type: 'button', className: 'outlined-action', onClick: () => void categoryReviewOpen(app) }, 'Central de revisão · categorização supervisionada'), s.categoryReviewPreview ? h('div', { className: 'mf-review-drawer-pending', role: 'status' }, h('p', {}, 'Uma prévia de categorização aguarda sua decisão.'), h('button', { type: 'button', className: 'primary-button', onClick: () => void categoryReviewOpen(app) }, 'Revisar prévia na Central')) : null, h('details', { className: 'mf-ai-v3-tools' }, h('summary', {}, 'Mais ferramentas'), h('div', { className: 'mf-ai-v3-tool-list' }, ...tabs.filter(item => item.id !== tab).map((item) => h('button', { type: 'button', key: item.id,
        className: 'ghost-button', onClick: () => app.setState({ intelligenceMainMode: item.id, categoryReviewOpen: false }, () => { if (item.id === 'today')
            void intelligencePremiumLoad(app); }) }, item.id === 'today' ? 'Ver panorama existente' : item.id === 'actions' ? 'Ver propostas supervisionadas' : 'Voltar à conversa')), tab !== 'chat' ? h('button', { type: 'button', className: 'primary-button',
        onClick: () => app.setState({ intelligenceMainMode: 'chat' }) }, 'Voltar à conversa') : null)), h('div', { className: 'mf-ai-v3-content', role: 'region', 'aria-label': tab === 'chat' ? 'Conversa financeira' : tab === 'today' ? 'Panorama financeiro' : 'Propostas supervisionadas' }, section), h('details', { className: 'mf-ai-lab-disclosure' }, h('summary', {}, h(Icon, { name: 'settings', size: 17 }), h('span', {}, 'Laboratório de Inteligência'), h('small', {}, 'Configurações técnicas, conexão OAuth, memória e contexto sintético')), renderIntelligenceConnection(app), renderIntelligencePrivacy(app), renderIntelligenceFinancialContext(app)));
}
function renderIntelligencePanel(app) {
    var _a, _b;
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
    const convState = typeof intelligenceConversationState === 'function' ? intelligenceConversationState(app) : { kind: 'oauth_disconnected', pill: 'IA externa desconectada · leitura local requer autorização', badge: 'Conta desconectada', css: 'is-offline' };
    const busy = Boolean(app.state.aiBusy || app.state.localFinancialBusy || app.state.intelligenceDrawerBusy);
    const draft = String(app.state.intelligenceDraft || '');
    return h('div', { className: 'mf-ai-backdrop', role: 'presentation', onMouseDown: (e) => { if (e.target === e.currentTarget)
            app.setState({ intelligencePanelOpen: false }); } }, h('aside', { className: 'mf-ai-drawer mf-ai-drawer-compact mf-d01', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Assistente contextual de ' + info.label }, h('div', { className: 'mf-ai-drawer-head' }, h('div', { className: 'mf-ai-drawer-title-wrap' }, h('div', { className: 'mf-ai-drawer-kicker-row' }, h('span', { className: 'mf-d01-spark', 'aria-hidden': 'true' }, '✦'), h('span', { className: 'micro-label' }, 'SEU ASSISTENTE')), h('h2', {}, 'Assistente Financeiro'), h('small', { className: 'mf-d01-context-subtitle' }, 'Ajudando em ' + info.label)), h('div', { className: 'mf-ai-drawer-head-actions' }, h('button', { type: 'button', className: 'ghost-button mf-ai-expand-btn', 'aria-label': 'Nova conversa', title: 'Iniciar nova conversa', onClick: () => intelligenceCreateThread(app) }, 'Nova'), h('button', { type: 'button', className: 'ghost-button mf-ai-expand-btn', 'aria-label': 'Expandir na aba Inteligência', title: 'Abrir na aba Inteligência mantendo a conversa ativa', onClick: () => intelligenceOpenFullChat(app) }, 'Expandir'), h('button', { type: 'button', className: 'close-button', 'aria-label': 'Fechar assistente', onClick: () => app.setState({ intelligencePanelOpen: false }) }, '×'))), h('details', { className: 'mf-d01-context-disclosure' }, h('summary', {}, 'Contexto da conversa', h(Icon, { name: 'chevron-down', size: 14 })), h('div', { className: 'mf-ai-context-meta mf-ai-drawer-scope' }, h('span', {}, scope.label), h('span', {}, scope.period), h('span', {}, scope.mode), ...scope.filters.map((filter) => h('span', { key: filter }, filter)), h('span', {}, ((_b = app.state.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) ? 'Leitura local autorizada' : convState.pill)), threads.length > 1 ? h('select', { className: 'mf-ai-drawer-thread-select', 'aria-label': 'Alternar conversa ativa', value: activeThreadId, onChange: (e) => intelligenceSelectThread(app, e.target.value) }, ...threads.map((t) => h('option', { key: t.id, value: t.id }, t.title + ' (' + t.messages.length + ')'))) : null), h('details', { className: 'mf-d01-access' }, h('summary', {}, 'Permissões de consulta'), renderIntelligenceAccess(app)), app.state.categoryReviewPreview ? h('div', { className: 'mf-review-drawer-pending' }, h('p', {}, 'Uma prévia de categorização aguarda sua decisão.'), h('button', { type: 'button', className: 'primary-button', onClick: () => void categoryReviewOpen(app) }, 'Revisar prévia na Central')) : null, h('div', { className: 'mf-ai-drawer-body' }, messages.length === 0 ? h('div', { className: 'mf-ai-drawer-empty' }, h('p', { className: 'muted-desc' }, info.description), h('div', { className: 'mf-ai-drawer-suggestions', 'aria-label': 'Sugestões rápidas para ' + info.label }, ...info.questions.filter(q => !intelligenceHistoryList(app).some(m => m.role === 'user' && m.text === q)).slice(0, 2).map((q, i) => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: i, onClick: () => intelligenceSubmitQuestion(app, q) }, h('span', {}, q), h(Icon, { name: 'arrow', size: 15 }))))) :
        h('div', { className: 'mf-ai-drawer-messages', role: 'log', 'aria-live': 'polite' }, ...messages.map(m => renderIntelligenceMessageItem(app, m)), busy ? h('div', { className: 'mf-ai-msg is-assistant is-streaming', role: 'status' }, h('strong', {}, 'Assistente MF'), h('p', {}, 'Processando solicitação no contexto de ' + scope.label + '…')) : null), app.state.intelligenceStorageError ? h('p', { className: 'mf-ai-error', role: 'alert' }, app.state.intelligenceStorageError) : null, app.state.aiError ? h('p', { className: 'mf-ai-error', role: 'alert' }, app.state.aiError) : null), renderIntelligenceFollowups(app), renderIntelligenceComposer(app, true)));
}
function renderIntelligenceSettings(app) {
    return h(Card, { className: 'settings-card mf-ai-settings' }, h('div', { className: 'card-heading' }, h('div', {}, h('h2', {}, 'Inteligência artificial'), h('p', {}, 'Autenticação local e testes fictícios · Entrega 2'))), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Estado'), h('strong', {}, app.state.aiStatus.connected ? 'Conectada' : 'Não conectada')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Modelo previsto'), h('strong', {}, 'GPT-6.1 Sol')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Raciocínio'), h('strong', {}, 'Low / Medium automático')), h('div', { className: 'mf-ai-setting-line' }, h('span', {}, 'Economia de tokens'), h('strong', {}, 'Contexto mínimo + aprovação por teste')), h('p', { className: 'muted-desc' }, 'OAuth e memórias aprovadas são protegidos localmente no Windows. Nenhuma memória é enviada sem consentimento por teste. Dados bancários e sincronização de memórias no PWA continuam indisponíveis para a IA.'), h('details', { className: 'mf-ai-advanced-settings' }, h('summary', {}, 'Inteligência · configurações avançadas'), renderIntelligenceConnection(app), renderIntelligencePrivacy(app), renderIntelligenceFinancialContext(app)), h('button', { type: 'button', className: 'outlined-action full', onClick: () => app.navigate('intelligence') }, h(Icon, { name: 'spark', size: 17 }), 'Abrir Inteligência'));
}
function mfB05Money(cents) {
    return Number.isSafeInteger(cents) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) : '—';
}
function mfB05IsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
function mfB05SafeCents(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function mfB05Unavailable(reason) {
    return { available: false, reason, timeline: [], ending: null, commitments: [], reserveSuggestionCents: null,
        availableBalanceCents: null, bufferCents: null, sourceId: null, asOf: null, period: null };
}
function mfB05VerifiedNumber(value) {
    return value && value.coverage === 'verified' && mfB05SafeCents(value.value) !== null ? value.value : null;
}
function mfB05Events(value, asOf, end, label) {
    if (!value || value.coverage !== 'verified')
        return { error: label + ' sem cobertura verificada.' };
    const v = value.value;
    if (mfB05SafeCents(v) === 0)
        return { events: [] };
    if (!Array.isArray(v))
        return { error: label + ' precisa de registros datados e verificáveis.' };
    const out = [], seen = new Map();
    for (const e of v) {
        if (!e || typeof e.id !== 'string' || !e.id || !mfB05IsoDate(e.due) || mfB05SafeCents(e.amountCents) === null)
            return { error: label + ' contém registro inválido.' };
        const key = e.id, signature = e.due + '|' + e.amountCents;
        if (seen.has(key)) {
            if (seen.get(key) !== signature)
                return { error: label + ' contém IDs conflitantes.' };
            continue;
        }
        seen.set(key, signature);
        if (e.due > asOf && e.due <= end)
            out.push({ id: key, due: e.due, amountCents: e.amountCents });
    }
    return { events: out };
}
function mfB05Project(input) {
    var _a, _b;
    if (!input || input.coverage !== 'verified' || !mfB05IsoDate(input.asOf) ||
        !mfB05IsoDate((_a = input.period) === null || _a === void 0 ? void 0 : _a.from) || !mfB05IsoDate((_b = input.period) === null || _b === void 0 ? void 0 : _b.to) ||
        input.period.from > input.asOf || input.period.to < input.asOf)
        return mfB05Unavailable('Fonte, período ou cobertura da projeção não verificados.');
    const baseline = mfB05VerifiedNumber(input.availableBalance);
    if (baseline === null)
        return mfB05Unavailable('Saldo disponível verificado não fornecido pelo serviço atual.');
    const commitments = input.unpaidFutureCommitments;
    if (!commitments || commitments.coverage !== 'verified' || !Array.isArray(commitments.value))
        return mfB05Unavailable('Agenda de compromissos futuros sem cobertura verificável.');
    const seen = new Map(), future = [];
    for (const c of commitments.value) {
        if (!c || typeof c.id !== 'string' || !c.id || !mfB05IsoDate(c.due) ||
            mfB05SafeCents(c.amountCents) === null)
            return mfB05Unavailable('Compromisso futuro inválido ou sem identificador.');
        if (!['scheduled_unpaid', 'posted', 'paid', 'cancelled'].includes(c.status))
            return mfB05Unavailable('Status de compromisso não verificável para projeção.');
        const signature = c.due + '|' + c.amountCents + '|' + c.status;
        if (seen.has(c.id)) {
            if (seen.get(c.id) !== signature)
                return mfB05Unavailable('Compromissos com IDs conflitantes.');
            continue;
        }
        seen.set(c.id, signature);
        if (c.status === 'scheduled_unpaid' && c.due > input.asOf && c.due <= input.period.to)
            future.push({ id: c.id, due: c.due, amountCents: c.amountCents, description: String(c.description || 'Compromisso previsto') });
    }
    const inc = mfB05Events(input.expectedIncome, input.asOf, input.period.to, 'Receita futura');
    if (inc.error)
        return mfB05Unavailable(inc.error);
    const other = mfB05Events(input.plannedOtherOutflow, input.asOf, input.period.to, 'Outras saídas');
    if (other.error)
        return mfB05Unavailable(other.error);
    const dates = [...new Set([input.asOf, input.period.to,
            ...future.map(x => x.due), ...inc.events.map(x => x.due), ...other.events.map(x => x.due)])].sort();
    const buffer = mfB05SafeCents(input.safetyBufferCents);
    const timeline = [];
    for (const date of dates) {
        const due = future.filter(x => x.due <= date);
        const sum = list => list.reduce((total, item) => total + item.amountCents, 0);
        const consideredCents = sum(due), incomeCents = sum(inc.events.filter(x => x.due <= date)), otherCents = sum(other.events.filter(x => x.due <= date));
        const projectedCents = baseline + incomeCents - consideredCents - otherCents;
        if (!Number.isSafeInteger(projectedCents))
            return mfB05Unavailable('Cálculo excede a faixa monetária segura.');
        const headroomCents = buffer === null ? null : projectedCents - buffer;
        const protectedCents = buffer === null ? null : Math.min(buffer, Math.max(0, projectedCents));
        const freeCents = headroomCents === null ? null : Math.max(0, headroomCents);
        const simpleReconciled = buffer !== null && inc.events.length === 0 && other.events.length === 0 &&
            projectedCents >= buffer && consideredCents + buffer + freeCents === baseline;
        timeline.push({ date, consideredCents, incomeCents, otherCents, projectedCents,
            protectedCents, headroomCents, freeCents, commitmentIds: due.map(x => x.id),
            canRenderSegments: simpleReconciled, isFutureProjection: date > input.asOf });
    }
    const ending = timeline[timeline.length - 1];
    return { available: true, reason: null, sourceId: String(input.availableBalance.sourceId || ''),
        asOf: input.asOf, period: input.period, availableBalanceCents: baseline,
        bufferCents: buffer, commitments: future, timeline, ending,
        reserveSuggestionCents: ending && ending.canRenderSegments ? Math.floor(ending.freeCents / 2) : null };
}
function mfB05Budget(spentCents, limitCents) {
    if (mfB05SafeCents(spentCents) === null || mfB05SafeCents(limitCents) === null)
        return null;
    return { spentCents, limitCents, excessCents: Math.max(0, spentCents - limitCents),
        usagePercent: limitCents === 0 ? null : spentCents * 100 / limitCents,
        remainingCents: Math.max(0, limitCents - spentCents) };
}
function mfB05Comparison(previousCents, currentCents, equalPeriods) {
    if (equalPeriods !== true || mfB05SafeCents(previousCents) === null ||
        mfB05SafeCents(currentCents) === null)
        return null;
    return { previousCents, currentCents, deltaCents: currentCents - previousCents,
        percent: previousCents === 0 ? null : (currentCents - previousCents) * 100 / previousCents };
}
function mfB05ChangeMode(app, mode) {
    if (!['today', 'chat', 'actions'].includes(mode))
        return;
    const previous = app.state.intelligenceMainMode;
    app.setState({ intelligenceMainMode: mode, intelligenceTab: mode, categoryReviewOpen: false,
        intelligenceHistoryOpen: false, mfB05DrawerKind: null }, () => {
        if (mode === 'today' && previous !== mode && typeof intelligencePremiumLoad === 'function' &&
            !app.state.intelligencePremiumLoading && (!app.state.intelligencePremiumReport ||
            app.state.intelligencePremiumSignature !== intelligencePremiumSignature(app))) {
            void intelligencePremiumLoad(app);
            if (typeof intelligenceCopilotInsightsLoad === 'function')
                void intelligenceCopilotInsightsLoad(app);
        }
    });
}
function mfB05Tabs(app, selected) {
    const tabs = [{ id: 'today', label: 'Hoje' }, { id: 'chat', label: 'Conversar' }, { id: 'actions', label: 'Plano de Ação' }];
    return h('nav', { className: 'mf-b05-tabs', role: 'tablist', 'aria-label': 'Áreas da Inteligência' }, ...tabs.map((tab, i) => h('button', { key: tab.id, id: 'mf-b05-tab-' + tab.id, type: 'button',
        role: 'tab', 'aria-selected': selected === tab.id, 'aria-controls': 'mf-b05-panel',
        tabIndex: selected === tab.id ? 0 : -1,
        className: 'mf-b05-tab' + (selected === tab.id ? ' is-active' : ''),
        onClick: () => mfB05ChangeMode(app, tab.id),
        onKeyDown: (event) => {
            var _a;
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key))
                return;
            const next = typeof intelligenceNextTab === 'function' ? intelligenceNextTab(tab.id, event.key) : null;
            if (next) {
                event.preventDefault();
                mfB05ChangeMode(app, next);
                if (typeof document !== 'undefined')
                    (_a = document.getElementById('mf-b05-tab-' + next)) === null || _a === void 0 ? void 0 : _a.focus();
            }
        } }, tab.label)));
}
function mfB05DrawerKeyboard(event, close) {
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
    }
    if (event.key !== 'Tab' || typeof document === 'undefined')
        return;
    const root = event.currentTarget;
    if (!root || typeof root.querySelectorAll !== 'function')
        return;
    const targets = Array.from(root.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]'));
    if (!targets.length)
        return;
    const index = targets.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
        event.preventDefault();
        targets[targets.length - 1].focus();
    }
    else if (!event.shiftKey && index === targets.length - 1) {
        event.preventDefault();
        targets[0].focus();
    }
}
function mfB05ReducedMotion() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function renderMfB05Main(app) {
    var _a, _b, _c;
    if (((_a = app.state.workIntelligenceDemo) === null || _a === void 0 ? void 0 : _a.enabled) && typeof renderWorkIntelligenceDemo === 'function')
        return renderWorkIntelligenceDemo(app);
    if (typeof intelligenceEnsureHydrated === 'function')
        intelligenceEnsureHydrated(app);
    const s = app.state, tab = ['today', 'chat', 'actions'].includes(s.intelligenceMainMode) ?
        s.intelligenceMainMode : 'chat';
    if (s.categoryReviewOpen)
        return h('section', { className: 'section mf-intelligence-page' }, renderCategoryReview(app));
    const messages = intelligenceHistoryList(app);
    const proposals = typeof intelligenceAllProposals === 'function' ? intelligenceAllProposals(app) :
        messages.map(m => m.proposal).filter(Boolean);
    const convState = typeof intelligenceConversationState === 'function' ? intelligenceConversationState(app) :
        { kind: 'oauth_disconnected', pill: 'Conta desconectada · modo local', css: 'is-offline' };
    const scope = s.intelligenceDraftScope || intelligencePageScope(app, s.intelligenceContext || s.page);
    const active = ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) && ((_c = s.localFinancialAccess) === null || _c === void 0 ? void 0 : _c.expiresAt) > Date.now();
    const section = tab === 'today' ? renderMfB05Today(app) :
        tab === 'chat' ? renderMfB05Chat(app, messages, convState, scope) :
            renderMfB05Actions(app, proposals);
    return h('section', { className: 'section mf-intelligence-page mf-b05-page',
        'aria-label': 'Inteligência Financeira' }, h('div', { className: 'mf-b05-top' }, h('strong', { className: 'mf-b05-brand' }, 'Inteligência'), h('span', { className: 'mf-b05-status' }, h('i', { className: 'mf-b05-status-dot', 'aria-hidden': 'true' }), s.mode === 'demo' ? 'Ambiente de demonstração' : active ? 'Leitura local autorizada' : 'Sem leitura pessoal autorizada')), mfB05Tabs(app, tab), h('details', { className: 'mf-b05-permissions' }, h('summary', {}, active ? 'Gerenciar permissão de consulta' : 'Autorizar consulta financeira'), renderIntelligenceAccess(app)), s.categoryReviewPreview ? h('div', { className: 'mf-b05-review-pending', role: 'status' }, h('span', {}, 'Existe uma prévia supervisionada aguardando revisão. '), h('button', { type: 'button', className: 'mf-b05-link', onClick: () => void categoryReviewOpen(app) }, 'Abrir Central de Revisão')) : null, h('div', { id: 'mf-b05-panel', className: 'mf-b05-content', role: 'tabpanel',
        'aria-labelledby': 'mf-b05-tab-' + tab }, section));
}
function mfB05DateLabel(date) {
    if (typeof date !== 'string')
        return '—';
    const p = date.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '—';
}
function mfB05TodaySelected(app, projection) {
    if (!projection.available)
        return null;
    return projection.timeline.find(p => p.date === app.state.mfB05SelectedDate) ||
        projection.timeline[projection.timeline.length - 1] || null;
}
function mfB05OpenDrawer(app, kind, opener) {
    app.setState({ mfB05DrawerKind: kind, mfB05DrawerOpener: opener }, () => {
        var _a;
        if (typeof document !== 'undefined')
            (_a = document.getElementById('mf-b05-drawer-close')) === null || _a === void 0 ? void 0 : _a.focus();
    });
}
function mfB05CloseDrawer(app) {
    const opener = app.state.mfB05DrawerOpener;
    app.setState({ mfB05DrawerKind: null, mfB05DrawerOpener: null }, () => {
        var _a;
        if (opener && typeof document !== 'undefined')
            (_a = document.getElementById(opener)) === null || _a === void 0 ? void 0 : _a.focus();
    });
}
function mfB05Ring(app, projection, point) {
    if (!projection.available || !point || !point.canRenderSegments)
        return h('div', { className: 'mf-b05-ring-empty', role: 'status' }, h(Icon, { name: 'shield', size: 23 }), h('strong', {}, point && point.projectedCents < 0 ? 'Saldo projetado insuficiente' : 'Projeção ainda indisponível'), h('p', {}, point && point.headroomCents < 0 ? 'O cenário apresenta falta de cobertura; um anel positivo seria incorreto.' :
            'O serviço atual não fornece saldo e compromissos futuros reconciliados com cobertura suficiente.'));
    const parts = [
        { key: 'commitments', label: 'Compromissos considerados', cents: point.consideredCents, color: 'var(--mf-b05-commit)' },
        { key: 'margin', label: 'Margem protegida', cents: point.protectedCents, color: 'var(--mf-b05-margin)' },
        { key: 'free', label: 'Folga acima da margem', cents: point.freeCents, color: 'var(--mf-b05-green)' }
    ];
    let offset = 0;
    const circumference = 2 * Math.PI * 82, denominator = projection.availableBalanceCents;
    const segments = parts.map(p => {
        const length = denominator > 0 ? p.cents / denominator * circumference : 0;
        const element = h('circle', { key: p.key, cx: 105, cy: 105, r: 82, fill: 'none', stroke: p.color, strokeWidth: 20,
            strokeDasharray: length + ' ' + circumference, strokeDashoffset: -offset, transform: 'rotate(-90 105 105)',
            className: 'mf-b05-ring-segment', role: 'presentation' });
        offset += length;
        return element;
    });
    return h('div', { className: 'mf-b05-ring-wrap' }, h('div', { className: 'mf-b05-ring-art' }, h('svg', { viewBox: '0 0 210 210', role: 'img', 'aria-label': 'Decomposição do saldo disponível verificado' }, h('circle', { cx: 105, cy: 105, r: 82, fill: 'none', stroke: 'var(--mf-b05-border)', strokeWidth: 20 }), ...segments), h('div', { className: 'mf-b05-ring-center' }, h('small', {}, 'SALDO PROJETADO'), h('strong', {}, mfB05Money(point.projectedCents)), h('span', {}, 'até ' + mfB05DateLabel(point.date)))), h('div', { className: 'mf-b05-ring-legend' }, ...parts.map((p, i) => h('button', { key: p.key, id: 'mf-b05-ring-' + p.key, type: 'button', className: 'mf-b05-legend-row',
        onClick: () => mfB05OpenDrawer(app, p.key, 'mf-b05-ring-' + p.key) }, h('span', { className: 'mf-b05-legend-dot', style: { background: p.color }, 'aria-hidden': 'true' }), h('span', {}, p.label), h('strong', {}, mfB05Money(p.cents))))));
}
function mfB05Timeline(app, projection, selected) {
    if (!projection.available || !selected)
        return h('section', { className: 'mf-b05-route mf-b05-unavailable' }, h('header', {}, h('h3', {}, 'A rota dos próximos dias'), h('small', {}, 'Sem calendário de caixa reconciliado')), h('p', {}, 'Os compromissos registrados podem ser consultados no Planejamento. Para traçar saldos futuros, também precisamos do saldo disponível e das fontes reconciliadas.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => app.navigate('planning') }, 'Abrir Planejamento'));
    const points = projection.timeline, min = Math.min(0, ...points.map(p => p.projectedCents)), max = Math.max(...points.map(p => p.projectedCents)), span = Math.max(1, max - min);
    const coords = points.map((p, i) => ({ x: 30 + i * (540 / Math.max(1, points.length - 1)),
        y: 140 - (p.projectedCents - min) / span * 105, point: p }));
    let d = 'M' + coords[0].x + ' ' + coords[0].y;
    for (let i = 1; i < coords.length; i++)
        d += ' H' + coords[i].x + ' V' + coords[i].y;
    const current = coords.find(x => x.point.date === selected.date) || coords[coords.length - 1];
    return h('section', { className: 'mf-b05-route', role: 'region', 'aria-label': 'Linha do tempo financeira' }, h('header', {}, h('div', {}, h('small', {}, 'ROTA DO PERÍODO'), h('h3', {}, 'Os próximos movimentos')), h('span', { className: 'mf-b05-future-tag' }, 'Valores projetados, não pagamentos realizados')), h('svg', { viewBox: '0 0 600 164', className: 'mf-b05-route-chart', role: 'img',
        'aria-label': 'Saldos projetados por vencimento em degraus' }, h('path', { d, fill: 'none', stroke: 'var(--mf-b05-green)', strokeWidth: 3, strokeLinejoin: 'round' }), h('line', { x1: current.x, y1: 12, x2: current.x, y2: 148, stroke: 'var(--mf-b05-green)', strokeDasharray: '4 5', opacity: .75 }), ...coords.map(p => h('circle', { key: p.point.date, cx: p.x, cy: p.y, r: p.point.date === selected.date ? 6 : 4,
        fill: p.point.date === selected.date ? 'var(--mf-b05-green)' : 'var(--mf-b05-surface)', stroke: 'var(--mf-b05-green)', strokeWidth: 2 }))), h('div', { className: 'mf-b05-route-dates', 'aria-label': 'Marcos financeiros' }, ...points.map(p => h('button', { key: p.date, type: 'button', className: 'mf-b05-date' + (p.date === selected.date ? ' is-active' : ''),
        id: 'mf-b05-date-' + p.date.replace(/-/g, ''), 'aria-pressed': p.date === selected.date,
        onClick: () => app.setState({ mfB05SelectedDate: p.date }) }, mfB05DateLabel(p.date)))), h('aside', { className: 'mf-b05-milestone', role: 'status', 'aria-live': 'polite' }, h('small', {}, 'MARCO DE ' + mfB05DateLabel(selected.date)), h('strong', {}, mfB05Money(selected.projectedCents)), h('span', {}, 'Saldo projetado após compromissos até esta data'), h('p', {}, selected.commitmentIds.length + ' compromisso(s) considerado(s) · ' + mfB05Money(selected.consideredCents)), selected.headroomCents !== null ? h('p', { className: selected.headroomCents < 0 ? 'mf-b05-negative' : '' }, (selected.headroomCents < 0 ? 'Abaixo da margem: ' : 'Folga sobre a margem: ') + mfB05Money(Math.abs(selected.headroomCents))) : null, h('button', { type: 'button', className: 'mf-b05-link', id: 'mf-b05-events',
        onClick: () => mfB05OpenDrawer(app, 'commitments', 'mf-b05-events') }, 'Conferir compromissos')));
}
function mfB05ScenarioKey(app, input) {
    var _a, _b, _c, _d, _e, _f;
    const records = value => {
        var _a;
        return Array.isArray(value === null || value === void 0 ? void 0 : value.value) ?
            value.value.map(x => [x === null || x === void 0 ? void 0 : x.id, x === null || x === void 0 ? void 0 : x.due, x === null || x === void 0 ? void 0 : x.amountCents, x === null || x === void 0 ? void 0 : x.status]) : (_a = value === null || value === void 0 ? void 0 : value.value) !== null && _a !== void 0 ? _a : null;
    };
    return JSON.stringify([intelligencePremiumSignature(app), (input === null || input === void 0 ? void 0 : input.snapshotVersion) || '',
        (input === null || input === void 0 ? void 0 : input.coverage) || '', (input === null || input === void 0 ? void 0 : input.asOf) || '', ((_a = input === null || input === void 0 ? void 0 : input.period) === null || _a === void 0 ? void 0 : _a.from) || '', ((_b = input === null || input === void 0 ? void 0 : input.period) === null || _b === void 0 ? void 0 : _b.to) || '',
        ((_c = input === null || input === void 0 ? void 0 : input.availableBalance) === null || _c === void 0 ? void 0 : _c.sourceId) || '', (_e = (_d = input === null || input === void 0 ? void 0 : input.availableBalance) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : null, (_f = input === null || input === void 0 ? void 0 : input.safetyBufferCents) !== null && _f !== void 0 ? _f : null, records(input === null || input === void 0 ? void 0 : input.unpaidFutureCommitments), records(input === null || input === void 0 ? void 0 : input.expectedIncome),
        records(input === null || input === void 0 ? void 0 : input.plannedOtherOutflow)]);
}
function mfB05ScenarioInput(app, input) {
    if (!input)
        return null;
    const st = app.state, valid = st.mfB05ScenarioSignature === mfB05ScenarioKey(app, input);
    if (!valid)
        return input;
    const cash = Number.isSafeInteger(st.mfB05ScenarioBalanceCents) && st.mfB05ScenarioBalanceCents >= 0 ?
        st.mfB05ScenarioBalanceCents : null;
    const margin = Number.isSafeInteger(st.mfB05ScenarioBufferCents) && st.mfB05ScenarioBufferCents >= 0 ?
        st.mfB05ScenarioBufferCents : null;
    return { ...input,
        availableBalance: cash === null ? input.availableBalance : { ...input.availableBalance, value: cash },
        safetyBufferCents: margin === null ? input.safetyBufferCents : margin };
}
function mfB05ScenarioSet(app, input, key, cents) {
    if (!Number.isSafeInteger(cents) || cents < 0)
        return;
    app.setState({ mfB05ScenarioSignature: mfB05ScenarioKey(app, input), [key]: cents });
}
function mfB05ContextDrawer(app, projection, point, originalInput) {
    var _a;
    const kind = app.state.mfB05DrawerKind;
    if (!kind || !projection.available || !point)
        return null;
    const titles = { commitments: 'Compromissos considerados', margin: 'Margem de segurança', free: 'Folga financeira', scenario: 'Ajustar cenário' };
    const values = { commitments: point.consideredCents, margin: point.protectedCents, free: point.freeCents };
    const close = () => mfB05CloseDrawer(app);
    const items = projection.commitments.filter(c => c.due <= point.date);
    return h('div', { className: 'mf-b05-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget)
            close(); } }, h('aside', { className: 'mf-b05-drawer', role: 'dialog', 'aria-modal': 'true',
        'aria-label': titles[kind] || 'Detalhamento da projeção', onKeyDown: (e) => mfB05DrawerKeyboard(e, close) }, h('header', {}, h('span', {}, 'EVIDÊNCIAS · ' + mfB05DateLabel(point.date)), h('button', { id: 'mf-b05-drawer-close', type: 'button', className: 'ghost-button', onClick: close }, 'Fechar')), h('h2', {}, titles[kind] || 'Cenário'), kind !== 'scenario' ? h('strong', { className: 'mf-b05-drawer-total' }, mfB05Money(values[kind])) : null, kind === 'scenario' && originalInput ? h('div', { className: 'mf-b05-scenario' }, h('p', {}, 'Cenário hipotético da projeção verificada. Nenhum ajuste modifica conta, margem cadastrada ou SQLite.'), ...[{ key: 'mfB05ScenarioBalanceCents', label: 'Saldo disponível hipotético',
            value: projection.availableBalanceCents, original: (_a = originalInput.availableBalance) === null || _a === void 0 ? void 0 : _a.value },
        { key: 'mfB05ScenarioBufferCents', label: 'Margem protegida hipotética',
            value: projection.bufferCents === null ? 0 : projection.bufferCents,
            original: originalInput.safetyBufferCents }].map(item => h('div', { key: item.key, className: 'mf-b05-scenario-field' }, h('label', { htmlFor: 'mf-b05-slider-' + item.key }, item.label + ' · ' + mfB05Money(item.value)), h('input', { id: 'mf-b05-slider-' + item.key, type: 'range', min: 0,
        max: Math.min(100000, Math.max(100, Math.ceil((Math.max(0, item.original || 0) + 100000) / 100) * 2)),
        value: Math.round(item.value / 100), step: 1,
        onChange: (e) => mfB05ScenarioSet(app, originalInput, item.key, Number(e.target.value) * 100) }))), h('button', { type: 'button', className: 'ghost-button',
        onClick: () => app.setState({ mfB05ScenarioSignature: null, mfB05ScenarioBalanceCents: null, mfB05ScenarioBufferCents: null }) }, 'Restaurar premissas verificadas')) : null, kind !== 'scenario' ? h('p', {}, kind === 'commitments' ? 'Compromissos futuros únicos com vencimento até o marco selecionado. Ainda não são pagamentos realizados.' :
        kind === 'margin' ? 'Valor protegido no cenário verificado; não representa dinheiro transferido.' :
            'Valor disponível acima da margem no cenário. Não é uma economia já realizada.') : null, kind === 'commitments' ? h('ul', { className: 'mf-b05-evidence-list' }, ...items.map(c => h('li', { key: c.id }, h('span', {}, c.description + ' · ' + mfB05DateLabel(c.due)), h('strong', {}, mfB05Money(c.amountCents))))) : null, h('small', {}, 'Fonte: ' + projection.sourceId + ' · cenário em ' + projection.asOf), h('button', { type: 'button', className: 'primary-button', onClick: () => { close(); app.navigate('planning'); } }, 'Abrir Planejamento')));
}
function mfB05CategoryBadge(categoryId, subcategoryId, categoryName) {
    if (typeof resolveCategoryVisualIdentity !== 'function' || typeof CategoryVisualGlyph !== 'function')
        return h(Icon, { name: 'pie', size: 18 });
    const identity = resolveCategoryVisualIdentity({ categoryId, subcategoryId, categoryName,
        aggregate: !subcategoryId });
    return h(CategoryVisualGlyph, { identity, size: 22 });
}
function mfB05BudgetDiagnostic(app, categoryId, categoryName, spent, limit, source) {
    const b = mfB05Budget(spent, limit);
    if (!b)
        return null;
    return h('article', { className: 'mf-b05-diagnostic', role: 'group', 'aria-label': 'Orçamento de ' + categoryName }, h('header', {}, mfB05CategoryBadge(categoryId, null, categoryName), h('div', {}, h('small', {}, 'ORÇAMENTO'), h('h3', {}, categoryName))), h('div', { className: 'mf-b05-diagnostic-body' }, h('div', { className: 'mf-b05-mini-orbit',
        style: { '--mf-b05-mini-progress': Math.min(100, b.usagePercent || 0) + '%' } }, h('strong', {}, b.usagePercent === null ? '—' : Math.round(b.usagePercent) + '%')), h('div', {}, h('strong', {}, mfB05Money(spent)), h('p', {}, 'de ' + mfB05Money(limit) + (b.limitCents === 0 ? ' · limite explicitamente zero' : '')), b.excessCents > 0 ? h('p', { className: 'mf-b05-negative' }, 'Acima do limite: ' + mfB05Money(b.excessCents)) : null)), h('small', {}, 'Fonte: ' + String(source || 'consulta autorizada')), h('button', { type: 'button', className: 'mf-b05-link', onClick: () => app.navigate('budgets') }, 'Ver orçamento completo'));
}
function mfB05DeliveryEvidence(input) {
    var _a, _b;
    if (!input || input.coverage !== 'verified' || ((_a = input.comparisons) === null || _a === void 0 ? void 0 : _a.equalDays) !== true ||
        ((_b = input.currentExpenses) === null || _b === void 0 ? void 0 : _b.coverage) !== 'verified')
        return null;
    const c = input.comparisons, p = c.periodA, q = c.periodB;
    if (!p || !q || !mfB05IsoDate(p.from) || !mfB05IsoDate(p.to) ||
        !mfB05IsoDate(q.from) || !mfB05IsoDate(q.to))
        return null;
    const days1 = (Date.parse(p.to + 'T12:00:00Z') - Date.parse(p.from + 'T12:00:00Z')) / 86400000, days2 = (Date.parse(q.to + 'T12:00:00Z') - Date.parse(q.from + 'T12:00:00Z')) / 86400000;
    if (days1 < 0 || days1 !== days2)
        return null;
    const found = Array.isArray(input.currentExpenses.value) && input.currentExpenses.value.some(x => x.categoryId === 'sub:alimentacao/delivery' &&
        x.postedCents === c.deliveryCurrentCents && x.periodStart === q.from && x.periodEnd === q.to);
    if (!found)
        return null;
    return mfB05Comparison(c.deliveryPreviousCents, c.deliveryCurrentCents, true);
}
function mfB05DeliveryDiagnostic(app, comparison) {
    if (!comparison)
        return null;
    const max = Math.max(1, comparison.previousCents, comparison.currentCents);
    return h('article', { className: 'mf-b05-diagnostic', role: 'group', 'aria-label': 'Delivery — comparação equivalente' }, h('header', {}, mfB05CategoryBadge('cat:alimentacao', 'sub:alimentacao/delivery', 'Delivery'), h('div', {}, h('small', {}, 'PERÍODOS EQUIVALENTES'), h('h3', {}, 'Delivery'))), h('div', { className: 'mf-b05-delivery-bars' }, ...[{ label: 'Anterior', cents: comparison.previousCents },
        { label: 'Atual', cents: comparison.currentCents }].map(x => h('div', { key: x.label, className: 'mf-b05-delivery-row' }, h('span', {}, x.label), h('div', { className: 'mf-b05-delivery-track' }, h('i', { style: { width: (x.cents / max * 100) + '%' } })), h('strong', {}, mfB05Money(x.cents))))), h('p', { className: comparison.deltaCents > 0 ? 'mf-b05-amber' : '' }, (comparison.deltaCents > 0 ? 'Aumento: ' : 'Variação: ') + mfB05Money(comparison.deltaCents) +
        (comparison.percent === null ? '' : ' · ' + comparison.percent.toFixed(1).replace('.', ',') + '%')), h('button', { type: 'button', className: 'mf-b05-link', onClick: () => mfB05ChangeMode(app, 'actions') }, 'Examinar Plano de Ação'));
}
function renderMfB05Today(app, explicitVerifiedInput) {
    var _a, _b;
    const s = app.state, signature = intelligencePremiumSignature(app), report = s.intelligencePremiumSignature === signature ? s.intelligencePremiumReport : null, live = mfD03EligibleReport(report, app), signals = live ? mfD03Signals(report, app) : [], simulatedInput = mfB05ScenarioInput(app, explicitVerifiedInput), projection = simulatedInput ? mfB05Project(simulatedInput) :
        mfB05Unavailable('O contrato IC-READ atual não entrega saldo disponível e agenda reconciliada.');
    const selected = mfB05TodaySelected(app, projection);
    return h('section', { className: 'mf-b05-today', role: 'region', 'aria-label': 'Pulso Financeiro' }, h('div', { className: 'mf-b05-editorial' }, h('span', { className: 'mf-b05-kicker' }, 'SEU PANORAMA · ' + (s.localFinancialMonth || s.month || 'PERÍODO ATUAL')), h('h2', {}, 'O mês ainda está em movimento.'), h('p', {}, live ? 'Aqui estão sinais observados nos seus registros autorizados. Projeções futuras exigem informações adicionais verificadas.' :
        'Conecte uma fonte autorizada para transformar registros em decisões com evidência.')), h('article', { className: 'mf-b05-hero' }, h('div', { className: 'mf-b05-hero-copy' }, h('small', {}, projection.available ? 'PULSO FINANCEIRO · PROJEÇÃO VERIFICADA' : 'PULSO FINANCEIRO · DADOS A CONCILIAR'), h('h3', {}, projection.available ? 'Seu dinheiro, com espaço para respirar.' : 'Um panorama claro, sem saldos inventados.'), h('p', {}, projection.available ? 'Selecione os marcos para acompanhar compromissos, margem e folga no mesmo cenário.' :
        'Temos prioridades e orçamento quando autorizados. A projeção de saldo depende de uma fonte que ainda não está disponível no serviço atual.'), projection.available && projection.reserveSuggestionCents !== null ?
        h('div', { className: 'mf-b05-reserve-note' }, h('span', {}, 'Reserva sugerida neste cenário'), h('strong', {}, mfB05Money(projection.reserveSuggestionCents)), h('small', {}, 'Simulação · nada foi transferido')) : null, h('div', { className: 'mf-b05-hero-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => mfB05ChangeMode(app, 'chat') }, 'Conversar sobre meu cenário'), projection.available ? h('button', { id: 'mf-b05-adjust', type: 'button', className: 'ghost-button',
        onClick: () => mfB05OpenDrawer(app, 'scenario', 'mf-b05-adjust') }, 'Ajustar cenário') : null, h('button', { type: 'button', className: 'ghost-button', onClick: () => {
            void intelligencePremiumLoad(app);
            if (typeof intelligenceCopilotInsightsLoad === 'function')
                void intelligenceCopilotInsightsLoad(app);
        }, disabled: !!s.intelligencePremiumLoading }, s.intelligencePremiumLoading ? 'Atualizando…' : 'Atualizar sinais'))), mfB05Ring(app, projection, selected)), mfB05Timeline(app, projection, selected), s.intelligencePremiumError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.intelligencePremiumError) : null, h('div', { className: 'mf-b05-signals-head' }, h('h3', {}, 'Sinais que merecem atenção'), h('small', {}, live ? 'Somente fatos da fonte autorizada' : 'Aguardando consulta e autorização')), h('div', { className: 'mf-b05-signals' }, ...(function () {
        var _a, _b, _c, _d;
        const shown = [];
        if ((explicitVerifiedInput === null || explicitVerifiedInput === void 0 ? void 0 : explicitVerifiedInput.coverage) === 'verified' &&
            ((_a = explicitVerifiedInput.currentExpenses) === null || _a === void 0 ? void 0 : _a.coverage) === 'verified' &&
            ((_b = explicitVerifiedInput.budgets) === null || _b === void 0 ? void 0 : _b.coverage) === 'verified') {
            const food = (_c = explicitVerifiedInput.currentExpenses.value) === null || _c === void 0 ? void 0 : _c.find(x => x.categoryId === 'cat:alimentacao');
            const limit = (_d = explicitVerifiedInput.budgets.value) === null || _d === void 0 ? void 0 : _d.find(x => x.categoryId === 'cat:alimentacao');
            if (food && limit)
                shown.push(mfB05BudgetDiagnostic(app, 'cat:alimentacao', 'Alimentação', food.postedCents, limit.limitCents, explicitVerifiedInput.budgets.sourceId));
        }
        const delivery = mfB05DeliveryEvidence(explicitVerifiedInput);
        if (delivery)
            shown.push(mfB05DeliveryDiagnostic(app, delivery));
        if (!shown.length)
            return signals.slice(0, 2).map(signal => mfD03SignalCard(app, signal));
        return shown;
    })(), !signals.length && !mfB05DeliveryEvidence(explicitVerifiedInput) &&
        !(((_a = explicitVerifiedInput === null || explicitVerifiedInput === void 0 ? void 0 : explicitVerifiedInput.currentExpenses) === null || _a === void 0 ? void 0 : _a.coverage) === 'verified' &&
            ((_b = explicitVerifiedInput === null || explicitVerifiedInput === void 0 ? void 0 : explicitVerifiedInput.budgets) === null || _b === void 0 ? void 0 : _b.coverage) === 'verified') ? h('div', { className: 'mf-b05-empty' }, h('strong', {}, live ? 'Nenhum alerta confirmado neste recorte.' : 'Ainda não há sinais disponíveis.'), h('p', {}, live ? 'Ausência de alerta não garante ausência de despesas futuras.' :
        'Use Permissões de consulta acima e atualize os dados para começar.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => app.navigate('budgets') }, 'Ver Orçamentos')) : null), (function () {
        const env = typeof mfCopilotInsightsLive === 'function' ? mfCopilotInsightsLive(app) : null;
        const list = Array.isArray(env === null || env === void 0 ? void 0 : env.insights) ? env.insights.slice(0, 3) : [];
        if (!list.length)
            return null;
        return h('section', { className: 'mf-copilot-proactive', 'aria-label': 'Radar proativo do Copiloto' }, h('div', { className: 'mf-b05-signals-head' }, h('h3', {}, 'Radar proativo do Copiloto'), h('small', {}, 'Até 3 sinais sem sobreposição · versão ' + String(env.dataVersion || '').slice(0, 12))), h('div', { className: 'mf-copilot-proactive-grid' }, ...list.map((ins) => h('article', { key: ins.insightId, className: 'mf-copilot-proactive-card' }, h('header', {}, mfB05CategoryBadge(ins.categoryId || null, ins.subcategoryId || null, ins.categoryLabel || 'Geral'), h('div', {}, h('small', {}, ins.importance === 'high' ? 'ALTA PRIORIDADE' : 'OPORTUNIDADE'), h('h4', {}, ins.title))), h('p', {}, ins.summary), Number.isSafeInteger(ins.impactCentsMax) ? h('strong', { className: 'mf-copilot-impact' }, ins.impactCentsMin === ins.impactCentsMax ? mfB05Money(ins.impactCentsMax) : mfB05Money(ins.impactCentsMin) + ' – ' + mfB05Money(ins.impactCentsMax)) : null, h('small', { className: 'mf-copilot-uncertainty' }, ins.uncertainty), h('div', { className: 'mf-copilot-proactive-actions' }, h('button', { type: 'button', className: 'mf-b05-link', onClick: () => {
                mfB05ChangeMode(app, 'chat');
                if (typeof localFinancialSubmit === 'function')
                    void localFinancialSubmit(app, ins.recommendedQuestion);
                else
                    app.setState({ intelligenceDraft: ins.recommendedQuestion });
            } }, 'Investigar no Copiloto'), h('button', { type: 'button', className: 'ghost-button', onClick: () => mfB05ChangeMode(app, 'actions') }, 'Plano'))))));
    })(), h('footer', { className: 'mf-b05-footer' }, h('span', {}, 'Da informação à decisão — sempre sob seu controle.'), h('button', { type: 'button', className: 'mf-b05-link', onClick: () => mfB05ChangeMode(app, 'actions') }, 'Explorar Plano de Ação')), mfB05ContextDrawer(app, projection, selected, explicitVerifiedInput), mfD03ContextDrawer(app));
}
function mfB05CloseHistory(app) {
    app.setState({ intelligenceHistoryOpen: false }, () => {
        var _a;
        if (typeof document !== 'undefined')
            (_a = document.getElementById('mf-b05-history-trigger')) === null || _a === void 0 ? void 0 : _a.focus();
    });
}
function mfB05HistoryDrawer(app) {
    if (!app.state.intelligenceHistoryOpen)
        return null;
    const close = () => mfB05CloseHistory(app);
    return h('div', { className: 'mf-b05-backdrop mf-b05-history-scrim',
        onMouseDown: (event) => { if (event.target === event.currentTarget)
            close(); } }, h('aside', { className: 'mf-b05-drawer mf-b05-history-drawer', role: 'dialog', 'aria-modal': 'true',
        'aria-label': 'Histórico de conversas', onKeyDown: (event) => mfB05DrawerKeyboard(event, close) }, h('div', { className: 'mf-b05-drawer-heading' }, h('strong', {}, 'Seu histórico'), h('button', { type: 'button', className: 'ghost-button', onClick: close }, 'Fechar')), renderIntelligenceHistorySidebar(app)));
}
function renderMfB05Chat(app, messages, convState, activeScope) {
    var _a, _b, _c, _d;
    const s = app.state, session = intelligenceChatSession(app);
    const items = Array.isArray(messages) ? messages : [];
    const authorized = !!((_a = s.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) && ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.expiresAt) > Date.now();
    const hasReview = !!((_c = s.categoryReviewGrant) === null || _c === void 0 ? void 0 : _c.token) && ((_d = s.categoryReviewGrant) === null || _d === void 0 ? void 0 : _d.expiresAt) > Date.now();
    return h('section', { className: 'mf-b05-chat', role: 'region', 'aria-label': 'Conversar com a Inteligência' }, h('header', { className: 'mf-b05-chat-head' }, h('div', {}, h('span', { className: 'mf-b05-kicker' }, 'INTELLIGENCE ALIVE · CONVERSAR'), h('h2', {}, 'Uma boa conversa muda a perspectiva.'), h('p', {}, 'Pergunte, compare e decida com contexto e evidências quando disponíveis.')), h('div', { className: 'mf-b05-chat-controls' }, h('button', { id: 'mf-b05-history-trigger', type: 'button', className: 'ghost-button',
        'aria-expanded': !!s.intelligenceHistoryOpen,
        onClick: () => app.setState({ intelligenceHistoryOpen: true }) }, h(Icon, { name: 'clock', size: 16 }), 'Histórico'), h('button', { type: 'button', className: 'primary-button',
        onClick: () => { intelligenceCreateThread(app); app.setState({ intelligenceHistoryOpen: false }); } }, h(Icon, { name: 'plus', size: 15 }), 'Nova conversa'))), h('div', { className: 'mf-b05-chat-scope' }, h('span', { className: (convState === null || convState === void 0 ? void 0 : convState.css) || 'is-offline' }, authorized ? 'Leitura autorizada' : hasReview ? 'Revisão sintética' : (convState === null || convState === void 0 ? void 0 : convState.pill) || 'Sem conexão autorizada'), h('span', {}, 'Contexto: ' + ((activeScope === null || activeScope === void 0 ? void 0 : activeScope.label) || 'Inteligência') + ' · ' + ((activeScope === null || activeScope === void 0 ? void 0 : activeScope.period) || 'Sem período')), session.expired ? h('strong', { className: 'mf-b05-warning' }, 'Permissão expirada — renove em Permissões de consulta') : null), s.intelligenceDraftScope ? h('p', { className: 'mf-b05-chat-context' }, 'Rascunho preparado a partir de ' + s.intelligenceDraftScope.label) : null, s.intelligencePreparedQuestion ? h('div', { className: 'mf-ai-prepared', role: 'status' }, h('p', {}, s.intelligencePreparedQuestion), h('small', {}, 'Pergunta preparada, ainda não enviada.')) : null, h('div', { className: 'mf-b05-chat-thread', role: 'log', 'aria-label': 'Mensagens da conversa', 'aria-live': 'polite' }, items.length ? items.map(msg => renderIntelligenceMessageItem(app, msg)) :
        h('div', { className: 'mf-b05-chat-welcome' }, h('span', { className: 'mf-b05-chat-orb' }, h(Icon, { name: 'spark', size: 30 })), h('h3', {}, 'O que você gostaria de entender hoje?'), h('p', {}, authorized ? 'Explore seus registros autorizados e identifique oportunidades reais.' :
            'Você pode começar com uma pergunta geral. Informações pessoais exigem autorização.'), h('div', { className: 'mf-b05-starters' }, ...(authorized ? ['Quais foram minhas maiores despesas?', 'Quais categorias ultrapassaram o orçamento?'] :
            ['Como organizar minhas despesas mensais?', 'Como planejar uma reserva com segurança?'])
            .map(q => h('button', { type: 'button', key: q, onClick: () => intelligencePrepare(app, q) }, q, h(Icon, { name: 'arrow', size: 14 }))))), s.aiBusy || s.localFinancialBusy ? h('p', { className: 'mf-b05-chat-thinking', role: 'status' }, 'Consultando a fonte disponível…') : null, s.aiError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.aiError) : null, s.intelligenceStorageError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.intelligenceStorageError) : null), renderIntelligenceFollowups(app), h('div', { className: 'mf-b05-chat-composer' }, renderIntelligenceComposer(app)), mfB05HistoryDrawer(app));
}
function mfB05ActionSignals(app) {
    const report = app.state.intelligencePremiumReport;
    return mfD03EligibleReport(report, app) ? mfD03Signals(report, app) : [];
}
function mfB05ActionBudget(signal) {
    var _a;
    if (!signal || signal.kind !== 'budget')
        return null;
    const list = Array.isArray((_a = signal.sourceCard) === null || _a === void 0 ? void 0 : _a.budgets) ? signal.sourceCard.budgets : [];
    const matched = list.find(b => signal.title.endsWith(String(b.category || '')));
    const b = matched;
    if (!b || typeof b.category !== 'string')
        return null;
    const values = mfB05Budget(b.spentCents, b.limitCents);
    return values ? { ...values, category: b.category } : null;
}
function mfB05ActionSnapshotKey(app, signal, budget) {
    var _a, _b, _c, _d;
    const c = signal === null || signal === void 0 ? void 0 : signal.sourceCard, report = app.state.intelligencePremiumReport;
    return JSON.stringify([intelligencePremiumSignature(app), (report === null || report === void 0 ? void 0 : report.snapshotVersion) || '',
        (report === null || report === void 0 ? void 0 : report.asOf) || '', (c === null || c === void 0 ? void 0 : c.asOf) || '', ((_a = c === null || c === void 0 ? void 0 : c.period) === null || _a === void 0 ? void 0 : _a.start) || '', ((_b = c === null || c === void 0 ? void 0 : c.period) === null || _b === void 0 ? void 0 : _b.end) || '',
        (signal === null || signal === void 0 ? void 0 : signal.id) || '', (signal === null || signal === void 0 ? void 0 : signal.sourceId) || '', (budget === null || budget === void 0 ? void 0 : budget.category) || '', (_c = budget === null || budget === void 0 ? void 0 : budget.spentCents) !== null && _c !== void 0 ? _c : null, (_d = budget === null || budget === void 0 ? void 0 : budget.limitCents) !== null && _d !== void 0 ? _d : null]);
}
function mfB05ActionStage(app, step) {
    if (!['understand', 'simulate', 'review'].includes(step))
        return;
    const current = mfB05ActionSignals(app).find(x => x.id === app.state.mfB05ActionId) ||
        mfB05ActionSignals(app)[0] || null;
    const key = mfB05ActionSnapshotKey(app, current, mfB05ActionBudget(current));
    const stale = !!app.state.mfB05ActionSourceSig && app.state.mfB05ActionSourceSig !== key;
    if (stale) {
        app.setState({ mfB05ActionStage: step === 'review' ? 'understand' : step,
            mfB05ActionSourceSig: null, mfB05ActionPreviewCents: null });
        return;
    }
    app.setState({ mfB05ActionStage: step });
}
function mfB05ActionFocus(app, signal) {
    app.setState({ mfB05ActionId: signal.id, mfB05ActionStage: 'understand',
        mfB05ActionPreviewCents: null, mfB05ActionSourceSig: null });
}
function mfB05ActionVisual(app, signal, budget, signature) {
    if (signal.kind === 'budget' && budget) {
        const valid = app.state.mfB05ActionSourceSig === signature;
        const proposed = valid && Number.isSafeInteger(app.state.mfB05ActionPreviewCents) ?
            app.state.mfB05ActionPreviewCents : budget.limitCents;
        const simulated = mfB05Budget(budget.spentCents, proposed);
        const usage = simulated === null || simulated === void 0 ? void 0 : simulated.usagePercent;
        return h('div', { className: 'mf-b05-plan-visual', role: 'group', 'aria-label': 'Orçamento da categoria' }, h('div', { className: 'mf-b05-plan-orbit', style: { '--mf-b05-progress': Math.min(100, usage || 0) + '%' } }, h('small', {}, 'GASTO VERIFICADO'), h('strong', {}, mfB05Money(budget.spentCents)), h('span', {}, usage === null ? 'Limite explícito: R$ 0,00' : Math.round(usage) + '% do limite simulado')), h('div', { className: 'mf-b05-plan-parts' }, h('span', {}, 'Limite atual'), h('strong', {}, mfB05Money(budget.limitCents)), h('span', {}, 'Limite no cenário'), h('strong', {}, mfB05Money(proposed)), h('span', {}, 'Excesso hipotético'), h('strong', { className: simulated.excessCents > 0 ? 'mf-b05-negative' : '' }, mfB05Money(simulated.excessCents))), h('small', {}, 'O gasto registrado permanece igual. Ajustar este cenário não modifica o orçamento.'));
    }
    return h('div', { className: 'mf-b05-plan-visual mf-b05-plan-readonly' }, h(Icon, { name: signal.kind === 'commitment' ? 'calendar' : 'shield', size: 32 }), Number.isSafeInteger(signal.amountCents) ? h('strong', {}, mfB05Money(signal.amountCents)) : null, h('p', {}, signal.kind === 'commitment' ? 'Valor comprometido no planejamento; não é o saldo disponível.' :
        'Há registros que merecem revisão. Este cenário não executa alterações automáticas.'), h('small', {}, 'Fluxo de caixa futuro exige saldo e agenda reconciliados antes de desenhar suas fatias.'));
}
function renderMfB05Actions(app, proposals) {
    var _a, _b, _c;
    const s = app.state, signals = mfB05ActionSignals(app), items = Array.isArray(proposals) ? proposals : [], selected = signals.find(x => x.id === s.mfB05ActionId) || signals[0] || null, budget = mfB05ActionBudget(selected), signature = mfB05ActionSnapshotKey(app, selected, budget), scenarioStale = !!s.mfB05ActionSourceSig && s.mfB05ActionSourceSig !== signature, stage = scenarioStale ? 'understand' :
        ['understand', 'simulate', 'review'].includes(s.mfB05ActionStage) ? s.mfB05ActionStage : 'understand';
    return h('section', { className: 'mf-b05-plan', role: 'region', 'aria-label': 'Plano de Ação' }, h('header', { className: 'mf-b05-plan-head' }, h('span', { className: 'mf-b05-kicker' }, 'INTELLIGENCE ALIVE · PLANO DE AÇÃO'), h('h2', {}, 'Decisões melhores começam com clareza.'), h('p', {}, 'Entenda o fato, teste possibilidades e revise antes de qualquer decisão.')), s.mode === 'real' && s.autoCategoryStatus ? h('section', { className: 'mf-b05-plan-proposals',
        'aria-label': 'Automação bancária autorizada' }, h('h3', {}, 'Categorização automática · contas bancárias'), h('p', {}, s.autoCategoryStatus.enabled ?
        'Ativa em ' + String((s.autoCategoryStatus.permissions || []).filter((x) => x.enabled).length) +
            ' conta(s). Rótulos aplicados: ' + String(((_a = s.autoCategoryStatus.counts) === null || _a === void 0 ? void 0 : _a.classified) || 0) +
            ' · revisão: ' + String(((_b = s.autoCategoryStatus.counts) === null || _b === void 0 ? void 0 : _b.awaitingReview) || 0) + '.' :
        'Desativada. Habilite explicitamente as contas no módulo Movimentações quando o canal estável estiver homologado.'), h('p', {}, 'Motor local de evidências históricas, não inferência de um modelo. Regras e correções humanas prevalecem.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => {
            app.setState({ txSource: 'bank', txReviewOnly: true });
            app.navigate('transactions');
        } }, 'Abrir Movimentações e A conferir')) : null, !selected && !items.length ? h('div', { className: 'mf-b05-plan-empty', role: 'status' }, h(Icon, { name: 'shield', size: 28 }), h('h3', {}, 'Nenhuma oportunidade verificável disponível.'), h('p', {}, 'Autorize a leitura, atualize o período ou converse sobre organização financeira. Não criamos recomendações pessoais sem fatos.'), h('div', { className: 'mf-b05-hero-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => mfB05ChangeMode(app, 'chat') }, 'Abrir Conversar'), h('button', { type: 'button', className: 'ghost-button', onClick: () => {
            var _a;
            const q = 'Onde posso economizar neste mês sem dupla contagem?';
            mfB05ChangeMode(app, 'chat');
            if (typeof localFinancialSubmit === 'function' && ((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token))
                void localFinancialSubmit(app, q);
            else
                app.setState({ intelligenceDraft: q });
        } }, 'Analisar oportunidades de economia'))) : null, selected ? h('div', { className: 'mf-b05-plan-layout' }, h('article', { className: 'mf-b05-plan-feature' }, h('div', { className: 'mf-b05-plan-feature-head' }, h('span', {}, 'FOCO PRINCIPAL · ' + (selected.kind === 'budget' ? 'ORÇAMENTO' :
        selected.kind === 'commitment' ? 'AGENDA' : selected.kind === 'review' ? 'REVISÃO' : 'REGRAS')), h('span', { className: 'mf-b05-plan-chip' }, 'Dado autorizado')), h('h3', {}, selected.title), h('p', {}, selected.detail), mfB05ActionVisual(app, selected, budget, signature), h('div', { className: 'mf-b05-steps', role: 'tablist', 'aria-label': 'Etapas da decisão' }, ...[{ id: 'understand', label: 'Entender' }, { id: 'simulate', label: 'Simular' }, { id: 'review', label: 'Revisar' }]
        .map(x => h('button', { key: x.id, type: 'button', role: 'tab', 'aria-selected': stage === x.id,
        className: stage === x.id ? 'is-active' : '', onClick: () => mfB05ActionStage(app, x.id) }, x.label))), h('div', { className: 'mf-b05-stage', role: 'tabpanel', 'aria-live': 'polite' }, stage === 'understand' ? h('div', {}, h('h4', {}, 'O que os registros mostram'), scenarioStale ? h('p', { className: 'mf-b05-warning', role: 'alert' }, 'Os dados do cenário mudaram. A prévia foi invalidada; faça uma nova simulação.') : null, h('p', {}, selected.meaning + ' · ' + selected.detail), intelligencePremiumEvidence(selected.sourceCard), h('button', { type: 'button', className: 'primary-button', onClick: () => mfB05ActionStage(app, 'simulate') }, 'Explorar cenário')) : null, stage === 'simulate' ? h('div', {}, h('h4', {}, 'Experimente sem alterar seus dados'), budget ? h('div', { className: 'mf-b05-simulator' }, h('label', { htmlFor: 'mf-b05-budget-slider' }, 'Limite hipotético de ' + budget.category), h('input', { id: 'mf-b05-budget-slider', type: 'range', min: 0,
        max: Math.max(100, Math.min(100000, Math.ceil(Math.max(budget.limitCents, budget.spentCents) / 100) * 2)),
        step: 1, value: Math.round((s.mfB05ActionSourceSig === signature &&
            Number.isSafeInteger(s.mfB05ActionPreviewCents) ? s.mfB05ActionPreviewCents : budget.limitCents) / 100),
        onChange: (e) => app.setState({ mfB05ActionSourceSig: signature,
            mfB05ActionPreviewCents: Number(e.target.value) * 100 }) }), h('p', {}, 'A hipótese altera apenas a visualização. O gasto realizado e o limite cadastrado não mudam.')) :
        h('p', {}, 'Este tipo de sinal ainda não possui uma simulação verificável no contrato atual. Nenhuma mudança foi preparada.'), h('button', { type: 'button', className: 'primary-button', onClick: () => mfB05ActionStage(app, 'review') }, 'Revisar cenário')) : null, stage === 'review' ? h('div', {}, h('h4', {}, 'Sua revisão, sem aplicação automática'), h('dl', { className: 'mf-b05-plan-review' }, h('dt', {}, 'Fonte'), h('dd', {}, selected.sourceId), h('dt', {}, 'Escopo'), h('dd', {}, s.localFinancialMonth || s.month || 'Período consultado'), budget ? h('dt', {}, 'Limite original') : null, budget ? h('dd', {}, mfB05Money(budget.limitCents)) : null, budget ? h('dt', {}, 'Limite hipotético') : null, budget ? h('dd', {}, mfB05Money(s.mfB05ActionSourceSig === signature &&
        Number.isSafeInteger(s.mfB05ActionPreviewCents) ? s.mfB05ActionPreviewCents : budget.limitCents)) : null), h('p', { className: 'mf-b05-warning' }, 'Não há capacidade autorizada para aplicar esta simulação pela Inteligência. O SQLite permanece inalterado.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => mfB05ActionStage(app, 'understand') }, 'Voltar ao entendimento'), h('button', { type: 'button', className: 'primary-button', onClick: () => selected.action === 'review' ? void categoryReviewOpen(app) : app.navigate(selected.action),
        disabled: selected.action === 'review' && !((_c = s.categoryReviewGrant) === null || _c === void 0 ? void 0 : _c.token) }, selected.action === 'review' ? 'Abrir revisão supervisionada' : 'Consultar módulo de origem')) : null)), h('aside', { className: 'mf-b05-plan-alternatives' }, h('h3', {}, 'Outras oportunidades'), ...signals.filter(x => x.id !== selected.id).map(x => h('button', { type: 'button', key: x.id, className: 'mf-b05-alternative',
        onClick: () => mfB05ActionFocus(app, x) }, h('strong', {}, x.title), h('span', {}, x.meaning), h(Icon, { name: 'arrow', size: 15 }))), signals.length === 1 ? h('p', {}, 'Outras oportunidades aparecerão quando houver evidências.') : null)) : null, items.length ? h('section', { className: 'mf-b05-plan-proposals', 'aria-label': 'Propostas existentes da sessão' }, h('h3', {}, 'Prévia e revisão supervisionada'), h('p', {}, 'As propostas abaixo usam o mecanismo já existente. Nenhum botão deste plano autoriza escrita pessoal.'), ...items.map(p => renderIntelligenceActionProposalCard(app, p))) : null);
}
function mfD03EligibleReport(report, app) {
    var _a, _b, _c, _d;
    const s = app.state, access = s.localFinancialAccess, review = s.categoryReviewGrant;
    if (!report || report.contract !== 'IC-v1/I-P0.1' || ((_a = report.privacy) === null || _a === void 0 ? void 0 : _a.readOnly) !== true ||
        ((_b = report.privacy) === null || _b === void 0 ? void 0 : _b.changesApplied) !== false || ((_c = report.privacy) === null || _c === void 0 ? void 0 : _c.modelCalled) !== false ||
        ((_d = report.privacy) === null || _d === void 0 ? void 0 : _d.personalAIWritingEnabled) !== false || !Array.isArray(report.cards) ||
        report.cards.length !== 8 || MF_PREMIUM_IDS.some((id, i) => { var _a; return ((_a = report.cards[i]) === null || _a === void 0 ? void 0 : _a.id) !== id; }))
        return false;
    if (s.intelligencePremiumSignature !== intelligencePremiumSignature(app))
        return false;
    const a = (access === null || access === void 0 ? void 0 : access.token) && Number.isFinite(access.expiresAt) && access.expiresAt > Date.now() &&
        access.profile === s.mode && ['bank', 'manual'].includes(access.source);
    const b = (review === null || review === void 0 ? void 0 : review.token) && Number.isFinite(review.expiresAt) && review.expiresAt > Date.now();
    return !!(a || b);
}
function mfD03Signals(report, app) {
    var _a, _b, _c, _d, _e, _f;
    if (!mfD03EligibleReport(report, app))
        return [];
    const s = app.state, activeGrant = !!((_a = s.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) &&
        ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.expiresAt) > Date.now() && ((_c = s.localFinancialAccess) === null || _c === void 0 ? void 0 : _c.profile) === s.mode;
    const activeReview = !!((_d = s.categoryReviewGrant) === null || _d === void 0 ? void 0 : _d.token) && s.categoryReviewGrant.expiresAt > Date.now();
    const cards = report.cards, get = (id) => cards.find((c) => c.id === id);
    const result = [];
    const budgets = get('UI-04');
    if (activeGrant && (budgets === null || budgets === void 0 ? void 0 : budgets.source) === s.localFinancialAccess.source &&
        budgets.profile === s.localFinancialAccess.profile &&
        (budgets.uiState === 'ready' || budgets.uiState === 'empty') &&
        budgets.capability === 'available_read_only' && Array.isArray(budgets.budgets)) {
        const b = budgets.budgets.filter((r) => r && typeof r.category === 'string' &&
            Number.isSafeInteger(r.spentCents) && r.spentCents >= 0 &&
            Number.isSafeInteger(r.limitCents) && r.limitCents >= 0);
        const excess = b.filter((r) => r.spentCents > r.limitCents).sort((a, c) => (c.spentCents - c.limitCents) - (a.spentCents - a.limitCents));
        if (excess.length) {
            const first = excess[0], delta = first.spentCents - first.limitCents;
            if (Number.isSafeInteger(delta))
                result.push({ id: 'budget-excess', priority: 100, kind: 'budget',
                    title: 'Revise o orçamento de ' + first.category,
                    detail: excess.length + ' categoria(s) superaram o limite registrado. O excesso indicado é do período consultado.',
                    amountCents: delta, meaning: 'Excesso observado · ' + first.category, sourceId: 'UI-04',
                    action: 'budgets', actionLabel: 'Ver limites', sourceCard: budgets });
        }
        else {
            const near = b.filter((r) => r.limitCents > 0 && r.spentCents >= r.limitCents * 0.8)
                .sort((a, c) => c.spentCents / c.limitCents - a.spentCents / a.limitCents);
            if (near.length)
                result.push({ id: 'budget-near', priority: 75, kind: 'budget',
                    title: 'Acompanhe ' + near[0].category, detail: 'O consumo atingiu 80% ou mais do limite configurado. Ainda não é uma previsão de estouro.',
                    amountCents: near[0].limitCents - near[0].spentCents,
                    meaning: 'Restante do limite · ' + near[0].category, sourceId: 'UI-04',
                    action: 'budgets', actionLabel: 'Conferir orçamento', sourceCard: budgets });
        }
    }
    const commitments = get('UI-05');
    if (activeGrant && ((_e = s.localFinancialAccess) === null || _e === void 0 ? void 0 : _e.planning) === true &&
        (commitments === null || commitments === void 0 ? void 0 : commitments.profile) === s.mode && (commitments === null || commitments === void 0 ? void 0 : commitments.source) === 'planning' &&
        (commitments === null || commitments === void 0 ? void 0 : commitments.uiState) === 'ready' && commitments.capability === 'available_read_only' &&
        Number.isSafeInteger(commitments.valueCents) && commitments.valueCents >= 0 &&
        Number.isSafeInteger(commitments.count) && commitments.count > 0)
        result.push({ id: 'commitments', priority: 80, kind: 'commitment',
            title: 'Compromissos futuros confirmados',
            detail: commitments.count + ' compromisso(s) ainda previstos no planejamento. Não representa dinheiro já descontado ou saldo disponível.',
            amountCents: commitments.valueCents, meaning: 'Total restante planejado · próximo período', sourceId: 'UI-05',
            action: 'planning', actionLabel: 'Ver agenda', sourceCard: commitments });
    const review = get('UI-01');
    if (activeGrant && ((_f = s.localFinancialAccess) === null || _f === void 0 ? void 0 : _f.source) === 'bank' &&
        (review === null || review === void 0 ? void 0 : review.source) === 'bank' && (review === null || review === void 0 ? void 0 : review.uiState) === 'ready' &&
        Number.isSafeInteger(review.count) && review.count > 0)
        result.push({ id: 'review', priority: 72, kind: 'review', title: 'Há movimentações para conferir',
            detail: review.count + ' movimentação(ões) não revisada(s) no histórico bancário local. PENDING não significa erro de categorização.',
            amountCents: null, meaning: 'Registros para revisão', sourceId: 'UI-01',
            action: 'transactions', actionLabel: 'Inspecionar registros', sourceCard: review });
    const rules = get('UI-02');
    if (activeReview && (rules === null || rules === void 0 ? void 0 : rules.profile) === 'synthetic' && rules.uiState === 'ready' &&
        Number.isSafeInteger(rules.count) && rules.count > 0)
        result.push({ id: 'rules', priority: 67, kind: 'rule', title: 'Regras aguardando sua análise',
            detail: rules.count + ' sugestão(ões) do ambiente sintético. Nenhuma categorização pessoal foi aplicada.',
            amountCents: null, meaning: 'Revisões supervisionadas', sourceId: 'UI-02',
            action: 'review', actionLabel: 'Abrir Central de Revisão', sourceCard: rules });
    return result.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, 3);
}
function mfD03OpenDrawer(app, signal, openerId) {
    app.setState({ mfD03Drawer: signal || { id: 'projection', title: 'Ajustar previsão',
            detail: 'O serviço autorizado atual não disponibiliza saldo disponível e calendário futuro reconciliados no mesmo escopo. Ajuste premissas apenas no Simulador original.',
            meaning: 'Sem previsão certificada', action: 'simulator', actionLabel: 'Abrir Simular Compra',
            amountCents: null }, mfD03OpenerId: openerId }, () => {
        var _a;
        (_a = document.getElementById('mf-d03-drawer-close')) === null || _a === void 0 ? void 0 : _a.focus();
    });
}
function mfD03CloseDrawer(app) {
    const opener = app.state.mfD03OpenerId;
    app.setState({ mfD03Drawer: null, mfD03OpenerId: null }, () => {
        var _a;
        if (opener)
            (_a = document.getElementById(opener)) === null || _a === void 0 ? void 0 : _a.focus();
    });
}
function mfD03Go(app, action) {
    mfD03CloseDrawer(app);
    if (action === 'review') {
        void categoryReviewOpen(app);
        return;
    }
    if (action === 'transactions') {
        app.navigate('review');
        return;
    }
    if (action === 'budgets' || action === 'planning' || action === 'simulator') {
        app.navigate(action);
        return;
    }
    if (action === 'chat') {
        intelligenceOpenFullChat(app);
        return;
    }
}
function mfD03SignalCard(app, s) {
    const id = 'mf-d03-signal-' + s.id;
    return h('article', { key: s.id, className: 'mf-d03-signal', role: 'group', 'aria-label': s.title }, h('div', { className: 'mf-d03-signal-head' }, h('span', { className: 'mf-d03-symbol', 'aria-hidden': 'true' }, h(Icon, { name: s.kind === 'commitment' ? 'calendar' : s.kind === 'budget' ? 'pie' : s.kind === 'review' ? 'filter' : 'spark', size: 18 })), h('span', { className: 'mf-d03-kind' }, s.kind === 'budget' ? 'ORÇAMENTO' :
        s.kind === 'commitment' ? 'AGENDA' : s.kind === 'review' ? 'MOVIMENTAÇÕES' : 'REVISÃO')), h('h3', {}, s.title), Number.isSafeInteger(s.amountCents) ? h('div', { className: 'mf-d03-signal-value' }, h('strong', {}, intelligencePremiumMoney(s.amountCents)), h('small', {}, s.meaning)) : h('small', { className: 'mf-d03-signal-meaning' }, s.meaning), h('p', {}, s.detail), h('button', { id, type: 'button', className: 'mf-d03-signal-action',
        onClick: () => mfD03OpenDrawer(app, s, id) }, s.actionLabel, h(Icon, { name: 'arrow', size: 14 })));
}
function mfD03ContextDrawer(app) {
    const d = app.state.mfD03Drawer;
    if (!d)
        return null;
    const trap = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            mfD03CloseDrawer(app);
            return;
        }
        if (e.key !== 'Tab')
            return;
        const root = document.getElementById('mf-d03-drawer');
        const focusable = Array.from((root === null || root === void 0 ? void 0 : root.querySelectorAll('button:not(:disabled),[tabindex="0"]')) || []);
        if (!focusable.length)
            return;
        const i = focusable.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
            e.preventDefault();
            focusable[focusable.length - 1].focus();
        }
        else if (!e.shiftKey && i === focusable.length - 1) {
            e.preventDefault();
            focusable[0].focus();
        }
    };
    return h('div', { className: 'mf-d03-backdrop', onClick: () => mfD03CloseDrawer(app) }, h('aside', { id: 'mf-d03-drawer', className: 'mf-d03-drawer', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'mf-d03-drawer-title', tabIndex: -1, onKeyDown: trap,
        onClick: (e) => e.stopPropagation() }, h('div', { className: 'mf-d03-drawer-top' }, h('span', { className: 'mf-d03-kicker' }, 'EXPLORAR SINAL'), h('button', { id: 'mf-d03-drawer-close', type: 'button', className: 'ghost-button', onClick: () => mfD03CloseDrawer(app) }, 'Fechar')), h('h3', { id: 'mf-d03-drawer-title' }, d.title), h('p', {}, d.detail), Number.isSafeInteger(d.amountCents) ? h('div', { className: 'mf-d03-drawer-amount' }, h('strong', {}, intelligencePremiumMoney(d.amountCents)), h('span', {}, d.meaning)) : null, d.sourceCard ? intelligencePremiumEvidence(d.sourceCard) :
        h('small', { className: 'mf-premium-evidence' }, 'Projeção pessoal não disponível neste contrato de leitura.'), h('p', { className: 'mf-d03-drawer-caution' }, 'Ação informativa: nenhum saldo é movimentado e nenhuma proposta da IA aplica alterações financeiras.'), h('div', { className: 'mf-d03-drawer-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => mfD03Go(app, d.action) }, d.actionLabel), h('button', { type: 'button', className: 'ghost-button', onClick: () => mfD03Go(app, 'chat') }, 'Conversar sobre isso'))));
}
function renderMfD03Today(app) {
    const s = app.state;
    const signature = intelligencePremiumSignature(app);
    const report = s.intelligencePremiumSignature === signature ? s.intelligencePremiumReport : null;
    const live = mfD03EligibleReport(report, app);
    const signals = live ? mfD03Signals(report, app) : [];
    const pending = !!s.intelligencePremiumLoading;
    const period = s.localFinancialMonth || s.month;
    return h('section', { className: 'mf-d03-today', role: 'region', 'aria-label': 'Inteligência Hoje' }, h('header', { className: 'mf-d03-top' }, h('div', {}, h('span', { className: 'mf-d03-kicker' }, 'INTELIGÊNCIA HOJE · ' + period), h('h2', {}, 'O que merece sua atenção?'), h('p', {}, live ?
        'Prioridades calculadas dos registros autorizados. Você decide o próximo passo.' :
        'Autorize os registros para receber prioridades financeiras com evidência, sem números estimados.')), h('div', { className: 'mf-d03-toolbar' }, h('button', { id: 'mf-d03-adjust', type: 'button', className: 'ghost-button',
        onClick: () => mfD03OpenDrawer(app, null, 'mf-d03-adjust') }, 'Ajustar previsão'), h('button', { id: 'mf-d03-chat', type: 'button', className: 'primary-button',
        onClick: () => intelligenceOpenFullChat(app) }, 'Conversar'), h('button', { type: 'button', className: 'ghost-button', disabled: pending,
        onClick: () => void intelligencePremiumLoad(app) }, pending ? 'Consultando…' : 'Atualizar'))), h('div', { className: 'mf-d03-hero' }, h('small', {}, 'SEU CONTEXTO FINANCEIRO'), h('h3', {}, !live ? 'Uma visão clara começa com dados autorizados.' :
        signals.length ? 'Estes são os assuntos mais relevantes do período.' : 'Nenhum alerta confirmado nos registros consultados.'), h('p', {}, 'O resultado do mês não é saldo bancário. Projeções de disponibilidade e sugestões de reserva permanecem indisponíveis sem saldo e compromissos verificados no mesmo escopo.')), s.intelligencePremiumError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.intelligencePremiumError) : null, pending ? h('div', { role: 'status', className: 'mf-d03-loading' }, 'Atualizando prioridades com dados locais…') : null, h('div', { className: 'mf-d03-layout' }, h('div', { className: 'mf-d03-signals', 'aria-label': 'Prioridades deste período' }, ...signals.map((signal) => mfD03SignalCard(app, signal)), !signals.length ? h('div', { className: 'mf-d03-no-signals', role: 'status' }, h('h3', {}, live ? 'Sem prioridades críticas comprovadas.' : 'Sem leitura financeira habilitada.'), h('p', {}, live ? 'A ausência de alertas locais não confirma ausência de despesas futuras.' :
        'Abra Permissões de consulta acima, autorize uma fonte e atualize esta visão.')) : null), h('aside', { className: 'mf-d03-side', 'aria-label': 'Agenda e revisão' }, h('section', { className: 'mf-d03-side-card' }, h('h3', {}, 'Próximos compromissos'), signals.some((x) => x.kind === 'commitment') ?
        h('p', {}, 'Total confirmado pelo Planejamento autorizado para o próximo período. Datas individuais devem ser consultadas na agenda.') :
        h('p', {}, 'Agenda detalhada indisponível ou sem compromissos confirmados nesta consulta.'), h('button', { type: 'button', className: 'mf-d03-side-link', onClick: () => app.navigate('planning') }, 'Abrir Planejamento')), h('section', { className: 'mf-d03-side-card' }, h('h3', {}, 'Revisar decisões'), h('p', {}, 'Examine sugestões e movimentações. Revisões pessoais pela IA permanecem somente em prévia.'), h('button', { type: 'button', className: 'mf-d03-side-link', onClick: () => void categoryReviewOpen(app) }, 'Central de Revisão')))), h('footer', { className: 'mf-d03-footer' }, h('span', {}, 'Uma conversa continua de onde você parou.'), h('button', { type: 'button', className: 'mf-d03-side-link', onClick: () => intelligenceOpenFullChat(app) }, 'Abrir conversa')), mfD03ContextDrawer(app));
}
const MF_I2_PERSONAL_BINDINGS = new WeakMap();
function mfI2Month(app) { return app.state.localFinancialMonth || app.state.month; }
function mfI2PersonalVisible(app) {
    const r = app.state.mfI2PersonalResult;
    const b = r && MF_I2_PERSONAL_BINDINGS.get(r);
    const a = app.state.localFinancialAccess;
    return !!b && b.access === a && b.token === (a === null || a === void 0 ? void 0 : a.token) && b.month === mfI2Month(app) &&
        b.signature === intelligencePremiumSignature(app) &&
        Number.isFinite(a === null || a === void 0 ? void 0 : a.expiresAt) && a.expiresAt > Date.now() &&
        a.profile === app.state.mode;
}
function mfI2SandboxLive(app) {
    const s = app.state.mfI2Sandbox;
    return !!s && typeof s.sessionId === 'string' && s.month === mfI2Month(app) &&
        Number.isFinite(s.expiresAt) && s.expiresAt > Date.now();
}
async function mfI2PersonalRequest(app, request) {
    const a = app.state.localFinancialAccess, month = mfI2Month(app);
    const api = desktop, signature = intelligencePremiumSignature(app);
    if (!(api === null || api === void 0 ? void 0 : api.intelligenceCategoryPersonal) || !(a === null || a === void 0 ? void 0 : a.token) ||
        !Number.isFinite(a.expiresAt) || a.expiresAt <= Date.now()) {
        app.setState({ mfI2Error: 'Autorize a leitura local antes de investigar suas categorias.' });
        return;
    }
    if (app.state.mfI2Busy)
        return;
    const serial = (app.__mfI2PersonalSerial || 0) + 1;
    app.__mfI2PersonalSerial = serial;
    app.setState({ mfI2Busy: true, mfI2Error: '', mfI2PersonalResult: null });
    try {
        const reply = await api.intelligenceCategoryPersonal({ ...request, scope: {
                token: a.token, source: a.source, profile: a.profile, month
            } });
        if (serial !== app.__mfI2PersonalSerial || app.state.localFinancialAccess !== a ||
            a.expiresAt <= Date.now() || mfI2Month(app) !== month ||
            signature !== intelligencePremiumSignature(app))
            return;
        if (reply && typeof reply === 'object')
            MF_I2_PERSONAL_BINDINGS.set(reply, { access: a, token: a.token, month, signature });
        app.setState({ mfI2PersonalResult: reply });
    }
    catch (err) {
        if (serial === app.__mfI2PersonalSerial)
            app.setState({
                mfI2Error: String((err === null || err === void 0 ? void 0 : err.message) || 'Consulta indisponível.').slice(0, 240)
            });
    }
    finally {
        if (serial === app.__mfI2PersonalSerial)
            app.setState({ mfI2Busy: false });
    }
}
async function mfI2SandboxStart(app) {
    const api = desktop;
    if (app.state.mfI2Busy)
        return;
    if (!(api === null || api === void 0 ? void 0 : api.intelligenceCategorySandboxStart)) {
        app.setState({ mfI2Error: 'Laboratório indisponível nesta versão do Electron.' });
        return;
    }
    const month = mfI2Month(app);
    app.setState({ mfI2Busy: true, mfI2Error: '' });
    try {
        const session = await api.intelligenceCategorySandboxStart(month);
        if (!session || session.mode !== 'SYNTHETIC_PREVIEW' || session.month !== month ||
            typeof session.sessionId !== 'string' || session.expiresAt <= Date.now())
            throw Error('Sessão de laboratório inválida.');
        if (mfI2Month(app) !== month) {
            void api.intelligenceCategorySandboxStop(session.sessionId);
            return;
        }
        app.setState({ mfI2Sandbox: session, mfI2SandboxResult: null, mfI2Proposal: null, mfI2LastProposalId: null,
            mfI2Action: 'category.create', mfI2Name: 'Pets', mfI2NewName: '',
            mfI2Ids: 'demo-market', mfI2RuleId: '', mfI2Question: 'Quais categorias estão sem uso?' });
    }
    catch (err) {
        app.setState({ mfI2Error: String((err === null || err === void 0 ? void 0 : err.message) || 'Laboratório indisponível.').slice(0, 240) });
    }
    finally {
        app.setState({ mfI2Busy: false });
    }
}
async function mfI2SandboxStop(app) {
    var _a;
    const s = app.state.mfI2Sandbox, api = desktop;
    app.setState({ mfI2Sandbox: null, mfI2SandboxResult: null, mfI2Proposal: null, mfI2LastProposalId: null, mfI2Error: '' });
    if (s === null || s === void 0 ? void 0 : s.sessionId)
        try {
            await ((_a = api === null || api === void 0 ? void 0 : api.intelligenceCategorySandboxStop) === null || _a === void 0 ? void 0 : _a.call(api, s.sessionId));
        }
        catch { }
}
async function mfI2SandboxCommand(app, method, additional = {}) {
    const api = desktop, s = app.state.mfI2Sandbox;
    if (!mfI2SandboxLive(app)) {
        app.setState({ mfI2SandboxResult: null, mfI2Proposal: null,
            mfI2Error: 'Sessão sintética encerrada ou expirada. Inicie outra.' });
        return;
    }
    if (app.state.mfI2Busy)
        return;
    app.setState({ mfI2Busy: true, mfI2Error: '' });
    try {
        const response = await api.intelligenceCategorySandboxCommand({
            sessionId: s.sessionId, method, ...additional
        });
        if (app.state.mfI2Sandbox !== s || !mfI2SandboxLive(app))
            return;
        const data = response === null || response === void 0 ? void 0 : response.data;
        const p = (data === null || data === void 0 ? void 0 : data.proposalId) ? data : Array.isArray(data === null || data === void 0 ? void 0 : data.proposals) ?
            data.proposals.find((x) => x === null || x === void 0 ? void 0 : x.proposalId) : null;
        const selected = method === 'propose' || method === 'ask' || method === 'edit' ?
            p || null : method === 'reject' || (response === null || response === void 0 ? void 0 : response.status) === 'applied' ? null : app.state.mfI2Proposal;
        app.setState({ mfI2SandboxResult: response, mfI2Proposal: selected,
            mfI2LastProposalId: additional.proposalId || (p === null || p === void 0 ? void 0 : p.proposalId) || app.state.mfI2LastProposalId || null });
    }
    catch (err) {
        if (app.state.mfI2Sandbox === s)
            app.setState({
                mfI2Error: String((err === null || err === void 0 ? void 0 : err.message) || 'Operação de laboratório indisponível.').slice(0, 240)
            });
    }
    finally {
        app.setState({ mfI2Busy: false });
    }
}
function mfI2Params(app, action, source = 'manual') {
    const name = String(app.state.mfI2Name || '').trim();
    const next = String(app.state.mfI2NewName || '').trim();
    if (action === 'category.create')
        return { name, color: '#2aa898', kind: 'expense', emoji: '✨' };
    if (action === 'category.update')
        return { name, newName: next };
    if (action === 'category.delete')
        return { name };
    if (action === 'transaction.categorize') {
        const ids = [...new Set(String(app.state.mfI2Ids || '').split(',').map(x => x.trim()).filter(Boolean))];
        return { category: next || name, items: ids.map(id => {
                if (source === 'bank') {
                    const sep = id.indexOf('|');
                    return { accountId: sep >= 0 ? id.slice(0, sep) : '',
                        externalId: sep >= 0 ? id.slice(sep + 1) : '' };
                }
                return { id };
            }) };
    }
    return {};
}
function mfI2Evidence(result) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!result)
        return null;
    const v = result.data || {}, p = (v === null || v === void 0 ? void 0 : v.proposalId) ? v : Array.isArray(v === null || v === void 0 ? void 0 : v.proposals) ? v.proposals[0] : null;
    const catalog = v.catalog || (!p && v.categories ? v : null);
    const reasons = [...(Array.isArray(p === null || p === void 0 ? void 0 : p.conflicts) ? p.conflicts : []),
        ...(Array.isArray(p === null || p === void 0 ? void 0 : p.notes) ? p.notes : [])].slice(0, 5);
    const money = (n) => Number.isSafeInteger(n) ?
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100) : 'Valor não verificável';
    return h('div', { className: 'mf-i2-evidence', role: 'status' }, h('p', {}, h('strong', {}, String(result.status || 'indisponível')), ' · ' + String(result.mode || '') + ' · ' + String(result.contract || '')), v.answer ? h('p', {}, String(v.answer).slice(0, 1000)) : null, result.reason ? h('p', {}, String(result.reason).slice(0, 400)) : null, catalog ? h('div', {}, h('strong', {}, 'Catálogo verificado · ' + String(((_a = catalog.categories) === null || _a === void 0 ? void 0 : _a.length) || 0) + ' categorias'), h('p', {}, 'Possíveis duplicidades: ' + String(((_b = catalog.possibleDuplicates) === null || _b === void 0 ? void 0 : _b.length) || 0) +
        ' · Sem referência explícita: ' + String(((_c = catalog.categories) === null || _c === void 0 ? void 0 : _c.filter((x) => x.probablyUnused).length) || 0)), h('p', {}, (catalog.categories || []).slice(0, 14).map((x) => String(x.name)).join(' · ')), h('small', {}, String(catalog.caveat || 'Amostra local; cobertura total não garantida.'))) : null, p ? h('div', {}, h('strong', {}, 'Prévia ' + String(p.actionType || '') + ' · ' + String(p.status)), h('p', {}, 'Referências verificadas: ' + String((_e = (_d = p.impact) === null || _d === void 0 ? void 0 : _d.count) !== null && _e !== void 0 ? _e : 0) +
        ' · Impacto amostral: ' + money((_f = p.impact) === null || _f === void 0 ? void 0 : _f.amountCents)), h('p', {}, 'Antes: ' + JSON.stringify((_g = p.before) !== null && _g !== void 0 ? _g : null).slice(0, 300)), h('p', {}, 'Depois: ' + JSON.stringify((_h = p.after) !== null && _h !== void 0 ? _h : null).slice(0, 300)), ...reasons.map((line) => h('p', {}, String(line).slice(0, 240)))) : null, Array.isArray(v) ? h('p', {}, 'Recibos sintéticos: ' + String(v.length) + ' · ' +
        v.slice(0, 8).map((row) => String(row.proposalId || '') + ' (' + String(row.state || '') + ')').join(' · ')) : null, (v === null || v === void 0 ? void 0 : v.receipt) ? h('div', {}, h('strong', {}, 'Recibo somente sintético · ' + String(v.status || result.status)), h('p', {}, 'ID: ' + String(v.receipt.proposalId || '') + ' · ' + String(v.receipt.confirmedAt || ''))) : null, (v === null || v === void 0 ? void 0 : v.ruleImpact) ? h('p', {}, 'Abrangência de regra: ' + String(v.ruleImpact.matchesLoaded || 0) +
        ' lançamentos carregados; ' + String(v.ruleImpact.wouldChangeLoaded || 0) + ' alterações potenciais') : null, !p && !catalog && !(v === null || v === void 0 ? void 0 : v.receipt) && (v === null || v === void 0 ? void 0 : v.status) ? h('p', {}, String(v.reason || v.status)) : null);
}
function mfI2CategoryPanel(app) {
    var _a;
    const s = app.state, active = mfI2SandboxLive(app), access = s.localFinancialAccess;
    const personalLive = !!(access === null || access === void 0 ? void 0 : access.token) && access.expiresAt > Date.now() &&
        access.profile === s.mode;
    const p = s.mfI2Proposal;
    const confirmable = active && (p === null || p === void 0 ? void 0 : p.status) === 'ready' && (p === null || p === void 0 ? void 0 : p.mayExecuteSynthetic) === true &&
        typeof (p === null || p === void 0 ? void 0 : p.confirmationNonce) === 'string' && p.confirmationNonce.length >= 20 &&
        Number.isFinite(p.expiresAt) && p.expiresAt > Date.now() &&
        Array.isArray(p.conflicts) && p.conflicts.length === 0;
    const busy = !!s.mfI2Busy;
    const button = (title, fn, disabled = false) => h('button', {
        type: 'button', className: 'ghost-button', disabled: busy || disabled, onClick: fn
    }, title);
    const field = (label, key, placeholder) => h('label', { className: 'mf-i2-field' }, h('span', {}, label), h('input', { type: 'text', value: String(s[key] || ''),
        placeholder, onChange: (e) => app.setState({ [key]: e.target.value }) }));
    return h('section', { className: 'mf-i2-rc mf-d04-advanced', 'aria-label': 'Laboratório de categorias I2-B e I2-C' }, h('small', {}, 'I2-B / I2-C · RECURSOS JÁ DESENVOLVIDOS'), h('h3', {}, 'Categorias, regras e propostas verificáveis'), h('p', {}, 'Perfil pessoal: investigação e prévia sem gravação. Confirmação disponível exclusivamente no banco sintético TEMP, por diálogo nativo. D05 14×61 conectado ao SQLite, sujeito a QA.'), h('div', { className: 'mf-i2-group' }, h('strong', {}, '1. Investigar categorias autorizadas (somente leitura)'), personalLive ? h('div', { className: 'mf-i2-controls' }, button('Sem uso ou semelhantes', () => void mfI2PersonalRequest(app, { method: 'analyze' })), button('Listar categorias e regras', () => void mfI2PersonalRequest(app, { method: 'list' })), button('Perguntar sobre categorias', () => void mfI2PersonalRequest(app, { method: 'ask',
        question: String(s.mfI2Question || '').slice(0, 700) })), button('Prévia pessoal de criação', () => void mfI2PersonalRequest(app, { method: 'propose',
        action: 'category.create', params: mfI2Params(app, 'category.create') })), button('Prévia pessoal de edição', () => void mfI2PersonalRequest(app, { method: 'propose',
        action: 'category.update', params: mfI2Params(app, 'category.update') })), button('Prévia pessoal de reclassificação por ID', () => void mfI2PersonalRequest(app, { method: 'propose',
        action: 'transaction.categorize', params: mfI2Params(app, 'transaction.categorize', access.source) })), button('Investigar regra por ID', () => void mfI2PersonalRequest(app, { method: 'inspectRule',
        ruleId: Number(s.mfI2RuleId) }), !Number.isInteger(Number(s.mfI2RuleId)) || Number(s.mfI2RuleId) <= 0)) : h('p', {}, 'Autorize a leitura local no painel de permissões da Inteligência para habilitar dados pessoais.'), mfI2PersonalVisible(app) ? mfI2Evidence(s.mfI2PersonalResult) : null), mfI2QualityPanel(app), h('div', { className: 'mf-i2-group' }, h('strong', {}, '3. Experimentar no banco sintético isolado'), active ? h('p', {}, 'Sessão TEMP · ' + String(s.mfI2Sandbox.month) +
        ' · três registros inventados · gravação exclusivamente sintética') :
        h('p', {}, 'Nenhum dado pessoal será copiado. Uma nova sessão cria um SQLite TEMP independente.'), h('div', { className: 'mf-i2-controls' }, s.mfI2Sandbox ? button('Encerrar e destruir teste', () => void mfI2SandboxStop(app)) :
        button('Iniciar laboratório sintético', () => void mfI2SandboxStart(app)), active ? button('Analisar categorias de teste', () => void mfI2SandboxCommand(app, 'analyze')) : null, active ? button('Listar categorias e regras de teste', () => void mfI2SandboxCommand(app, 'list')) : null, active ? button('Histórico de recibos sintéticos', () => void mfI2SandboxCommand(app, 'history')) : null, active && s.mfI2LastProposalId ? button('Consultar último recibo', () => void mfI2SandboxCommand(app, 'receipt', { proposalId: s.mfI2LastProposalId })) : null), h('div', { className: 'mf-i2-fields' }, field('Categoria atual ou nova', 'mfI2Name', 'Ex.: Pets'), field('Novo nome ou categoria destino', 'mfI2NewName', 'Ex.: Alimentação'), field('IDs por vírgula (banco: conta|ID; teste: demo-market)', 'mfI2Ids', 'demo-market, demo-delivery'), field('ID numérico de regra', 'mfI2RuleId', 'Ex.: 1'), field('Pergunta de categorias ou regras', 'mfI2Question', 'Quais categorias estão sem uso?')), active ? h('div', { className: 'mf-i2-controls' }, button('Propor criação', () => void mfI2SandboxCommand(app, 'propose', {
        action: 'category.create', params: mfI2Params(app, 'category.create')
    })), button('Propor edição', () => void mfI2SandboxCommand(app, 'propose', {
        action: 'category.update', params: mfI2Params(app, 'category.update')
    })), button('Propor exclusão', () => void mfI2SandboxCommand(app, 'propose', {
        action: 'category.delete', params: mfI2Params(app, 'category.delete')
    })), button('Prévia reclassificar por ID', () => void mfI2SandboxCommand(app, 'propose', {
        action: 'transaction.categorize', params: mfI2Params(app, 'transaction.categorize')
    })), button('Perguntar', () => void mfI2SandboxCommand(app, 'ask', {
        question: String(s.mfI2Question || '').slice(0, 700)
    })), button('Investigar regra por ID', () => void mfI2SandboxCommand(app, 'inspectRule', { ruleId: Number(s.mfI2RuleId) }), !Number.isInteger(Number(s.mfI2RuleId)) || Number(s.mfI2RuleId) <= 0)) : null, active && p ? h('div', { className: 'mf-i2-controls' }, button('Editar prévia', () => void mfI2SandboxCommand(app, 'edit', {
        proposalId: p.proposalId, patch: p.actionType === 'category.create' ?
            { name: String(s.mfI2NewName || '').trim() } :
            p.actionType === 'transaction.categorize' ? { category: String(s.mfI2NewName || '').trim() } :
                { newName: String(s.mfI2NewName || '').trim() }
    }), !String(s.mfI2NewName || '').trim()), button('Rejeitar proposta', () => void mfI2SandboxCommand(app, 'reject', { proposalId: p.proposalId })), button('Confirmar APENAS no teste', () => void mfI2SandboxCommand(app, 'confirm', {
        proposalId: p.proposalId, confirmationNonce: p.confirmationNonce
    }), !confirmable)) : null, active ? mfI2Evidence(s.mfI2SandboxResult) : null, active && ((_a = s.mfI2SandboxResult) === null || _a === void 0 ? void 0 : _a.status) === 'recovery_required' && p ?
        button('Consultar recibo, sem reexecutar', () => void mfI2SandboxCommand(app, 'recovery', { proposalId: p.proposalId })) : null, !active && s.mfI2Sandbox ? h('p', {}, 'Sessão encerrada, expirada ou de outro mês. Encerre-a antes de iniciar outra.') : null, h('small', {}, 'Regras bancárias futuras e importação bancária não fazem parte desta amostra manual. Escritas pessoais pela IA permanecem desativadas.')), busy ? h('p', { role: 'status' }, 'Verificando serviço local…') : null, s.mfI2Error ? h('p', { role: 'alert' }, String(s.mfI2Error).slice(0, 240)) : null);
}
const MF_QUALITY_BINDINGS = new WeakMap();
function mfQualityLive(app, reply) {
    const b = reply && MF_QUALITY_BINDINGS.get(reply);
    const a = app.state.localFinancialAccess;
    return !!b && a === b.access && b.token === (a === null || a === void 0 ? void 0 : a.token) && b.month === (app.state.localFinancialMonth || app.state.month) &&
        b.signature === intelligencePremiumSignature(app) && b.account === app.state.mfQualityAccount &&
        Number.isFinite(a.expiresAt) && a.expiresAt > Date.now() &&
        a.source === 'bank' && a.profile === 'real' && app.state.mode === 'real';
}
function mfQualityTarget(app) {
    var _a, _b;
    const parents = ((_a = app.state.mfQualityCatalog) === null || _a === void 0 ? void 0 : _a.parents) || [];
    const p = parents.find((x) => x.id === app.state.mfQualityParent);
    if (!p)
        return null;
    const child = app.state.mfQualityChild || null;
    if (child && !((_b = p.subcategories) === null || _b === void 0 ? void 0 : _b.some((s) => s.id === child)))
        return null;
    return { categoryId: p.id, subcategoryId: child };
}
async function mfQualityAuthorize(app) {
    var _a;
    const s = app.state, api = desktop, accountId = s.mfQualityDesiredAccount;
    if (!((_a = s.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) || s.localFinancialAccess.source !== 'bank' ||
        s.mode !== 'real' || !accountId) {
        app.setState({ mfQualityError: 'Autorize primeiro a leitura bancária e escolha a conta.' });
        return;
    }
    if (s.mfQualityBusy)
        return;
    app.setState({ mfQualityBusy: true, mfQualityError: '' });
    try {
        if (!(api === null || api === void 0 ? void 0 : api.d05SessionAuthorize) || !(api === null || api === void 0 ? void 0 : api.d05BankAccountAuthorize) || !(api === null || api === void 0 ? void 0 : api.d05Catalog))
            throw Error('D05 MAIN/preload ainda indisponível');
        await api.d05SessionAuthorize({ profile: 'real' });
        const grant = await api.d05BankAccountAuthorize({ accountId });
        const catalog = await api.d05Catalog();
        if (app.state.mfQualityDesiredAccount !== accountId)
            return;
        if ((grant === null || grant === void 0 ? void 0 : grant.accountId) !== accountId || !Array.isArray(catalog === null || catalog === void 0 ? void 0 : catalog.parents))
            throw Error('Não foi possível comprovar conta e catálogo D05');
        app.setState({ mfQualityAccount: accountId, mfQualityCatalog: catalog,
            mfQualityParent: '', mfQualityChild: '', mfQualityId: '',
            mfQualityScan: null, mfQualityResult: null });
    }
    catch (e) {
        app.setState({ mfQualityError: String((e === null || e === void 0 ? void 0 : e.message) || e).slice(0, 240) });
    }
    finally {
        app.setState({ mfQualityBusy: false });
    }
}
async function mfQualityRequest(app, request) {
    const api = desktop, s = app.state, a = s.localFinancialAccess;
    const account = s.mfQualityAccount, month = s.localFinancialMonth || s.month;
    const signature = intelligencePremiumSignature(app);
    if (!(api === null || api === void 0 ? void 0 : api.intelligenceCategoryPersonal) || !(a === null || a === void 0 ? void 0 : a.token) || a.source !== 'bank' ||
        a.profile !== 'real' || a.expiresAt <= Date.now() || !account) {
        app.setState({ mfQualityError: 'Concessão IC-READ/conta bancária ausente ou expirada.' });
        return;
    }
    if (s.mfQualityBusy)
        return;
    const serial = (app.__mfQualitySerial || 0) + 1;
    app.__mfQualitySerial = serial;
    app.setState({ mfQualityBusy: true, mfQualityError: '', mfQualityResult: null });
    try {
        const reply = await api.intelligenceCategoryPersonal({ ...request, scope: {
                token: a.token, source: a.source, profile: a.profile, month
            } });
        if (app.__mfQualitySerial !== serial || app.state.localFinancialAccess !== a ||
            a.expiresAt <= Date.now() || app.state.mfQualityAccount !== account ||
            (app.state.localFinancialMonth || app.state.month) !== month ||
            intelligencePremiumSignature(app) !== signature)
            return;
        if (reply && typeof reply === 'object')
            MF_QUALITY_BINDINGS.set(reply, { access: a, token: a.token, month, signature, account });
        app.setState({ mfQualityResult: reply,
            ...(request.method === 'qualityScan' ? { mfQualityScan: reply, mfQualityId: '' } : {}) });
    }
    catch (e) {
        if (app.__mfQualitySerial === serial)
            app.setState({ mfQualityError: String((e === null || e === void 0 ? void 0 : e.message) || 'Análise indisponível').slice(0, 240) });
    }
    finally {
        if (app.__mfQualitySerial === serial)
            app.setState({ mfQualityBusy: false });
    }
}
function mfI2QualityPanel(app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const s = app.state, a = s.localFinancialAccess;
    const live = !!(a === null || a === void 0 ? void 0 : a.token) && a.expiresAt > Date.now() && a.profile === 'real' && a.source === 'bank' && s.mode === 'real';
    const result = mfQualityLive(app, s.mfQualityResult) ? s.mfQualityResult : null;
    const scan = mfQualityLive(app, s.mfQualityScan) ? s.mfQualityScan : null;
    const qualities = Array.isArray((_a = scan === null || scan === void 0 ? void 0 : scan.data) === null || _a === void 0 ? void 0 : _a.quality) ? scan.data.quality : [];
    const accounts = ((_c = (_b = s.bank) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.accounts) || [];
    const parents = ((_d = s.mfQualityCatalog) === null || _d === void 0 ? void 0 : _d.parents) || [];
    const selected = qualities.find((q) => q.qualityId === s.mfQualityId);
    const target = mfQualityTarget(app);
    const busy = !!s.mfQualityBusy;
    const btn = (text, action, disabled = false) => h('button', {
        type: 'button', className: 'ghost-button', disabled: busy || disabled, onClick: action
    }, text);
    const dropdown = (title, value, update, items, empty) => h('label', { className: 'mf-i2-field' }, h('span', {}, title), h('select', { value, onChange: (e) => update(e.target.value) }, h('option', { value: '' }, empty), ...items.map((item) => h('option', { key: item.id, value: item.id }, item.name || item.id))));
    const reason = (r) => String(r || '').slice(0, 200);
    return h('div', { className: 'mf-i2-group mf-i2-quality', role: 'region',
        'aria-label': 'I2-E · recomendações com evidências verificáveis' }, h('strong', {}, '2. I2-D / I2-E · qualidade obrigatória'), h('p', {}, 'Investigações proativas em conta autorizada, com evidências por dia e ID. Sem confirmação pessoal, mesmo com boa qualidade.'), dropdown('Conta que será analisada', String(s.mfQualityDesiredAccount || ''), accountId => app.setState({ mfQualityDesiredAccount: accountId, mfQualityAccount: null,
        mfQualityResult: null, mfQualityScan: null, mfQualityId: '' }), accounts.map((x) => ({ id: x.id, name: x.name || x.id })), 'Escolha a conta'), btn('Autorizar esta conta pelo MAIN', () => void mfQualityAuthorize(app), !live || !s.mfQualityDesiredAccount), live && s.mfQualityAccount ? btn('Pesquisar oportunidades I2-E', () => void mfQualityRequest(app, {
        method: 'qualityScan', filters: { accountId: s.mfQualityAccount }
    })) : null, qualities.length ? dropdown('Evidência encontrada', String(s.mfQualityId || ''), qualityId => app.setState({ mfQualityId: qualityId }), qualities.map((q) => ({ id: q.qualityId,
        name: (q.pattern || q.qualityId) + ' · ' + q.qualityStatus + ' · ' + q.qualityConfidence })), 'Selecione uma evidência') : null, qualities.length ? h('div', { className: 'mf-i2-evidence' }, h('strong', {}, 'Análises: ' + qualities.length), ...qualities.slice(0, 10).map((q) => {
        var _a, _b;
        return h('p', { key: q.qualityId }, String(q.pattern || '') + ' · ' + String(((_a = q.anchorSummary) === null || _a === void 0 ? void 0 : _a.independentDates) || 0) +
            ' dias independentes · ' + String(((_b = q.candidateSummary) === null || _b === void 0 ? void 0 : _b.count) || 0) +
            ' candidatos · ' + (q.reasons || []).map(reason).join(', '));
    })) : null, selected ? h('div', { className: 'mf-i2-evidence' }, h('strong', {}, String(selected.pattern || '') + ' · ' + String(selected.qualityStatus)), h('p', {}, 'Origem ' + String(selected.coverage || '') +
        ' · hash ' + String(selected.evidenceHash || '').slice(0, 20)), h('p', {}, 'Possíveis duplicatas: ' + String(((_e = selected.duplicateWarnings) === null || _e === void 0 ? void 0 : _e.length) || 0) +
        ' · Regras concorrentes: ' + String(((_g = (_f = selected.rulePrecedence) === null || _f === void 0 ? void 0 : _f.affectedRules) === null || _g === void 0 ? void 0 : _g.length) || 0)), h('p', {}, 'O destino deve ser escolhido explicitamente; nenhuma subcategoria será inferida.')) : null, selected && parents.length ? h('div', { className: 'mf-i2-fields' }, dropdown('Categoria-pai D05', String(s.mfQualityParent || ''), id => app.setState({ mfQualityParent: id, mfQualityChild: '' }), parents, 'Escolha categoria'), dropdown('Subcategoria opcional', String(s.mfQualityChild || ''), id => app.setState({ mfQualityChild: id }), ((_h = parents.find((p) => p.id === s.mfQualityParent)) === null || _h === void 0 ? void 0 : _h.subcategories) || [], 'Sem subcategoria')) : null, selected ? h('div', { className: 'mf-i2-controls' }, btn('Inspecionar evidência', () => void mfQualityRequest(app, {
        method: 'qualityDetail', qualityId: selected.qualityId
    })), btn('Prévia hierárquica D05', () => void mfQualityRequest(app, {
        method: 'qualityDraft', qualityId: selected.qualityId, action: 'historical', target
    }), !target), btn('Compor plano (sem executar)', () => void mfQualityRequest(app, {
        method: 'qualityCompose', items: [{ qualityId: selected.qualityId,
                action: 'historical', target }]
    }), !target)) : null, result ? h('div', { className: 'mf-i2-evidence', role: 'status' }, h('strong', {}, String(result.status || 'indisponível') + ' · ' + String(result.contract || '')), result.reason ? h('p', {}, reason(result.reason)) : null, ((_k = (_j = result.data) === null || _j === void 0 ? void 0 : _j.quality) === null || _k === void 0 ? void 0 : _k.qualityId) ? h('p', {}, 'Evidência ' + result.data.quality.qualityId +
        ' · ' + String(result.data.quality.qualityConfidence || '')) : null, ((_l = result.data) === null || _l === void 0 ? void 0 : _l.previewVersion) ? h('p', {}, 'D05 previewVersion: ' + result.data.previewVersion +
        ' · ' + String(result.data.count) + ' lançamentos · escrita pessoal NÃO autorizada') : null, ((_m = result.data) === null || _m === void 0 ? void 0 : _m.steps) ? h('p', {}, 'Plano: ' + String(result.data.steps.length) +
        ' etapas · aplicação bloqueada') : null) : null, !live ? h('p', {}, 'Ative a leitura bancária nas permissões antes de usar o I2-E.') : null, busy ? h('p', { role: 'status' }, 'Conferindo as evidências locais…') : null, s.mfQualityError ? h('p', { role: 'alert' }, String(s.mfQualityError).slice(0, 240)) : null);
}
const MF_D04_PALETTE = ['#53d896', '#79a6fa', '#f5bc63', '#ff7a88', '#b49be8'];
function mfD04StableId(r) { return JSON.stringify([r.accountId || '', r.externalId || '']); }
function mfD04Entries(app) {
    const s = app.state, grant = s.categoryReviewGrant, report = s.categoryReviewReport, queue = s.categoryReviewQueue;
    if (!(grant === null || grant === void 0 ? void 0 : grant.token) || !(Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now()) || !report)
        return [];
    const entries = [];
    for (const r of Array.isArray(report.suggestions) ? report.suggestions : []) {
        if (!r || typeof r.id !== 'string' || !r.id)
            continue;
        const cands = [];
        const seen = new Set();
        for (const x of Array.isArray(r.examples) ? r.examples : []) {
            if (!x || !Number.isSafeInteger(x.amount) || !x.description)
                continue;
            const id = mfD04StableId(x);
            if (seen.has(id) || id === '["",""]')
                continue;
            seen.add(id);
            cands.push({ id, title: String(x.description).slice(0, 120), date: String(x.date || ''),
                amountCents: Math.abs(x.amount) });
        }
        entries.push({ id: 'rule:' + r.id, kind: 'category_rule', title: String(r.name || r.pattern || 'Sugestão').slice(0, 100),
            status: 'pending', source: 'Sugestão supervisionada', category: String(r.category || ''), original: r, candidates: cands });
    }
    for (const r of Array.isArray(queue === null || queue === void 0 ? void 0 : queue.rows) ? queue.rows : []) {
        if (!r || !r.externalId || !r.accountId || !Number.isSafeInteger(r.amount))
            continue;
        const id = mfD04StableId(r);
        entries.push({ id: 'row:' + id, kind: 'category_change', title: String(r.description || 'Movimentação').slice(0, 100),
            status: 'pending', source: String(r.accountName || 'Fonte de teste'),
            category: String(r.suggestedCategory || r.category || ''), original: r,
            candidates: [{ id, title: String(r.description || ''), date: String(r.date || ''), amountCents: Math.abs(r.amount) }] });
    }
    for (const a of Array.isArray(report.audit) ? report.audit : []) {
        if (!(a === null || a === void 0 ? void 0 : a.id))
            continue;
        entries.push({ id: 'audit:' + String(a.id), kind: 'audit', title: String(a.action || 'Decisão'),
            status: 'history', source: 'Auditoria do serviço', category: '', original: a, candidates: [] });
    }
    return entries;
}
function mfD04DraftFor(app, entry) {
    var _a, _b;
    const existing = (_a = app.state.mfD04Drafts) === null || _a === void 0 ? void 0 : _a[entry.id];
    if (existing)
        return existing;
    return { name: entry.title, category: entry.category,
        terms: String(((_b = entry.original) === null || _b === void 0 ? void 0 : _b.pattern) || entry.title), color: MF_D04_PALETTE[0],
        past: entry.kind === 'category_change', future: entry.kind === 'category_rule', revision: 0, saved: false };
}
function mfD04Patch(app, entry, patch) {
    const current = mfD04DraftFor(app, entry);
    const next = { ...current, ...patch, revision: current.revision + 1, saved: false };
    app.setState({ mfD04Drafts: { ...app.state.mfD04Drafts, [entry.id]: next },
        categoryReviewPreview: null, categoryReviewConfirmed: false, categoryReviewReceipt: null });
}
function mfD04Discard(app, entry) {
    const drafts = { ...app.state.mfD04Drafts };
    delete drafts[entry.id];
    const excluded = { ...app.state.mfD04Excluded };
    delete excluded[entry.id];
    app.setState({ mfD04Drafts: drafts, mfD04Excluded: excluded,
        categoryReviewPreview: null, categoryReviewConfirmed: false, mfD04Edit: false });
}
function mfD04SelectedIds(entry, exclusions) {
    const excluded = new Set(exclusions);
    return entry.candidates.filter(x => !excluded.has(x.id)).map(x => x.id);
}
function mfD04Impact(entry, draft, exclusions) {
    const selected = mfD04SelectedIds(entry, exclusions);
    const unique = new Set(selected);
    let cents = 0;
    if (draft.past) {
        for (const c of entry.candidates) {
            if (!unique.has(c.id))
                continue;
            if (!Number.isSafeInteger(c.amountCents) || c.amountCents < 0)
                return { count: 0, cents: null, eligible: false };
            cents += c.amountCents;
            if (!Number.isSafeInteger(cents))
                return { count: 0, cents: null, eligible: false };
        }
    }
    const active = draft.past || draft.future;
    const changed = entry.kind === 'category_rule' ? !!draft.category.trim() : entry.kind === 'category_change' ?
        !!draft.category.trim() && draft.category !== String(entry.original.category || '') : false;
    return { count: draft.past ? unique.size : 0, cents,
        eligible: active && changed && (draft.future || unique.size > 0),
        samplePartial: entry.kind === 'category_rule' &&
            (entry.original.compatible > entry.candidates.length ||
                entry.original.examplesPartial === true) };
}
function mfD04SavedDraft(app, entry) {
    const current = mfD04DraftFor(app, entry);
    if (!current.name.trim() || !current.category.trim() || !current.terms.trim()) {
        app.setState({ mfD04Error: 'Informe nome, critério e categoria antes de salvar o rascunho.' });
        return;
    }
    const next = { ...current, saved: true, revision: current.revision + 1 };
    app.setState({ mfD04Drafts: { ...app.state.mfD04Drafts, [entry.id]: next },
        mfD04Error: 'Rascunho local salvo. Somente alterações suportadas pelo serviço podem virar prévia de aplicação.',
        categoryReviewPreview: null, categoryReviewConfirmed: false, mfD04Edit: false });
}
function mfD04ServiceEligible(app, entry, draft, exclusions) {
    var _a, _b, _c;
    if (!((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) ||
        !(Number.isFinite(app.state.categoryReviewGrant.expiresAt) && app.state.categoryReviewGrant.expiresAt > Date.now()) ||
        !app.state.categoryReviewAvailable || !mfD04Impact(entry, draft, exclusions).eligible ||
        exclusions.length || draft.color !== MF_D04_PALETTE[0])
        return false;
    if (entry.kind === 'category_rule') {
        return !draft.past && draft.future && draft.name === entry.title &&
            draft.terms === String(entry.original.pattern || entry.title) &&
            ((_b = entry.original) === null || _b === void 0 ? void 0 : _b.state) !== 'denied' && ((_c = entry.original) === null || _c === void 0 ? void 0 : _c.state) !== 'deferred';
    }
    if (entry.kind === 'category_change') {
        const r = entry.original;
        return draft.past && !draft.future && draft.name === entry.title &&
            r.batchEligible === true && r.status === 'POSTED' && !r.manual && !r.hasSplits;
    }
    return false;
}
function mfD04Prepare(app, entry) {
    var _a;
    const draft = mfD04DraftFor(app, entry), excluded = ((_a = app.state.mfD04Excluded) === null || _a === void 0 ? void 0 : _a[entry.id]) || [];
    if (!mfD04ServiceEligible(app, entry, draft, excluded)) {
        app.setState({ mfD04Error: 'Esta combinação de rascunho, exclusões e escopos não possui aplicação segura neste serviço. Revise os dados manualmente ou mantenha como proposta.' });
        return;
    }
    app.mfD04ModalFocused = false;
    app.setState({ mfD04Error: '', categoryReviewPreview: null, categoryReviewConfirmed: false });
    if (entry.kind === 'category_rule') {
        void categoryReviewPrepare(app, 'rule', { suggestionId: entry.original.id, category: draft.category });
        return;
    }
    void categoryReviewPrepare(app, 'classify', { items: [entry.original], category: draft.category });
}
function mfD04PreviewModal(app) {
    const p = app.state.categoryReviewPreview;
    if (!p)
        return null;
    const dismiss = () => app.setState({ categoryReviewPreview: null, categoryReviewConfirmed: false });
    const key = (e) => {
        var _a;
        if (e.key === 'Escape') {
            e.preventDefault();
            dismiss();
            return;
        }
        if (e.key !== 'Tab')
            return;
        const nodes = Array.from(((_a = document.getElementById('mf-d04-modal')) === null || _a === void 0 ? void 0 : _a.querySelectorAll('button:not(:disabled),input:not(:disabled)')) || []);
        if (!nodes.length)
            return;
        const i = nodes.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
            e.preventDefault();
            nodes[nodes.length - 1].focus();
        }
        else if (!e.shiftKey && i === nodes.length - 1) {
            e.preventDefault();
            nodes[0].focus();
        }
    };
    return h('div', { className: 'mf-d04-modal-overlay', onClick: dismiss }, h('div', { id: 'mf-d04-modal', className: 'mf-d04-modal', role: 'dialog', 'aria-modal': 'true',
        'aria-label': 'Conferir prévia do serviço sintético', onKeyDown: key,
        onClick: (e) => e.stopPropagation() }, h('div', { className: 'mf-d04-modal-top' }, h('strong', {}, 'Conferência obrigatória'), h('button', { type: 'button', className: 'ghost-button', onClick: dismiss,
        ref: (node) => { if (node && !app.mfD04ModalFocused) {
            app.mfD04ModalFocused = true;
            node.focus();
        } } }, 'Fechar')), renderCategoryReviewPreview(app)));
}
function mfD04Queue(app, entries, selected) {
    const s = app.state, stage = s.mfD04Stage || 'pending';
    const q = String(s.mfD04Search || '').toLocaleLowerCase('pt-BR');
    const visible = entries.filter(e => (stage === 'all' || e.status === stage) &&
        (e.title + ' ' + e.category + ' ' + e.source).toLocaleLowerCase('pt-BR').includes(q));
    const controls = ['pending', 'history', 'all'].map(id => h('button', { key: id, type: 'button',
        className: stage === id ? 'active' : '', 'aria-pressed': stage === id,
        onClick: () => app.setState({ mfD04Stage: id, categoryReviewPreview: null, categoryReviewConfirmed: false }) }, id === 'pending' ? 'Pendentes' : id === 'history' ? 'Histórico' : 'Todas'));
    const items = visible.slice(0, 80).map(entry => h('button', { type: 'button', key: entry.id,
        className: 'mf-d04-item' + (entry.id === (selected === null || selected === void 0 ? void 0 : selected.id) ? ' is-selected' : ''),
        'aria-pressed': entry.id === (selected === null || selected === void 0 ? void 0 : selected.id),
        onClick: () => app.setState({ mfD04Selected: entry.id, mfD04Edit: false,
            categoryReviewPreview: null, categoryReviewConfirmed: false, mfD04Error: '' }) }, h('span', { className: 'mf-d04-item-head' }, h('strong', {}, entry.title), h('small', {}, entry.status === 'history' ? 'Histórico' : 'Pendente')), h('span', {}, entry.source + ' · ' + (entry.kind === 'category_rule' ? 'Regra' : entry.kind === 'category_change' ? 'Movimentação' : 'Decisão')), h('small', {}, entry.candidates.length + ' registro(s) na amostra')));
    return h('section', { className: 'mf-d04-queue', 'aria-label': 'Fila de revisão' }, h('div', { className: 'mf-d04-queue-top' }, h('h3', {}, 'Fila de decisões'), h('span', {}, entries.filter(e => e.status === 'pending').length + ' pendentes nesta consulta')), h('label', { className: 'mf-d04-search' }, 'Buscar revisões', h('input', { type: 'search', value: s.mfD04Search || '', placeholder: 'Nome, origem ou categoria',
        onChange: (e) => app.setState({ mfD04Search: e.target.value,
            categoryReviewPreview: null, categoryReviewConfirmed: false }) })), h('div', { className: 'mf-d04-filters', role: 'group', 'aria-label': 'Filtrar revisões' }, ...controls), h('div', { className: 'mf-d04-items' }, ...items, !items.length ? h('p', { className: 'mf-d04-no-results' }, 'Nenhuma revisão neste filtro.') : null));
}
function mfD04Details(app, entry) {
    var _a;
    if (!entry)
        return h('section', { className: 'mf-d04-detail' }, h('p', {}, 'Selecione uma revisão para conferir.'));
    const s = app.state, d = mfD04DraftFor(app, entry);
    if (entry.kind === 'audit')
        return h('section', { className: 'mf-d04-detail' }, h('div', { className: 'mf-d04-summary' }, h('h3', {}, 'Decisão auditada: ' + entry.title), h('p', {}, 'ID ' + String(entry.original.id) + ' · ' + String(entry.original.appliedAt || '')), h('p', {}, 'Desfazer: ' + String(entry.original.undoState || 'indisponível')), entry.original.undoState === 'available' ? h('button', { type: 'button', className: 'ghost-button',
            onClick: () => void categoryReviewPrepare(app, 'undo', { commandId: entry.original.id }) }, 'Preparar desfazer pelo serviço') : null));
    const excluded = ((_a = s.mfD04Excluded) === null || _a === void 0 ? void 0 : _a[entry.id]) || [];
    const impact = mfD04Impact(entry, d, excluded);
    const change = (patch) => mfD04Patch(app, entry, patch);
    const canPrepare = mfD04ServiceEligible(app, entry, d, excluded);
    const fields = [['name', 'Nome da proposta'], ['category', 'Categoria de destino'], ['terms', 'Critério']].map(([key, label]) => h('label', { key }, label, h('input', { type: 'text', value: d[key],
        onChange: (e) => change({ [key]: e.target.value }) })));
    const colorButtons = MF_D04_PALETTE.map(color => h('button', { key: color, type: 'button',
        style: { background: color }, 'aria-pressed': d.color === color, 'aria-label': 'Cor ' + color,
        onClick: () => change({ color }) }));
    const editor = s.mfD04Edit ? h('section', { className: 'mf-d04-editor', 'aria-label': 'Editor isolado' }, ...fields, h('div', { className: 'mf-d04-colors' }, ...colorButtons), h('div', { className: 'mf-d04-actions' }, h('button', { type: 'button', className: 'primary-button', onClick: () => mfD04SavedDraft(app, entry) }, 'Salvar ajustes locais'), h('button', { type: 'button', className: 'ghost-button', onClick: () => mfD04Discard(app, entry) }, 'Descartar alterações'))) : null;
    const candidates = entry.candidates.map(item => h('label', { key: item.id }, h('input', { type: 'checkbox', checked: !excluded.includes(item.id),
        onChange: (e) => {
            var _a;
            const old = ((_a = app.state.mfD04Excluded) === null || _a === void 0 ? void 0 : _a[entry.id]) || [];
            const next = e.target.checked ? old.filter(id => id !== item.id) : [...old, item.id];
            app.setState({ mfD04Excluded: { ...app.state.mfD04Excluded, [entry.id]: next },
                categoryReviewPreview: null, categoryReviewConfirmed: false });
        } }), h('span', {}, item.title + ' · ' + item.date), h('strong', {}, intelligencePremiumMoney(item.amountCents))));
    const actions = [
        h('button', { type: 'button', className: 'primary-button', disabled: !canPrepare,
            title: canPrepare ? 'Revalidação real no serviço sintético' : 'Este rascunho/escopo não possui aplicação segura',
            onClick: () => mfD04Prepare(app, entry) }, 'Preparar no serviço')
    ];
    if (entry.kind === 'category_rule' && s.categoryReviewAvailable) {
        for (const state of ['denied', 'deferred']) {
            actions.push(h('button', { key: state, type: 'button', className: 'ghost-button',
                onClick: () => void categoryReviewPrepare(app, 'decision', { suggestionId: entry.original.id, state }) }, state === 'denied' ? 'Recusar' : 'Adiar'));
        }
    }
    return h('section', { className: 'mf-d04-detail', 'aria-label': 'Detalhe da proposta' }, h('div', { className: 'mf-d04-detail-inner' }, h('div', { className: 'mf-d04-detail-head' }, h('div', {}, h('small', {}, entry.source), h('h3', {}, entry.title)), h('button', { type: 'button', className: 'ghost-button',
        onClick: () => app.setState({ mfD04Edit: !s.mfD04Edit }) }, s.mfD04Edit ? 'Recolher editor' : 'Editar rascunho')), h('div', { className: 'mf-d04-diff' }, h('div', {}, h('small', {}, 'SITUAÇÃO ATUAL'), h('strong', {}, String(entry.original.category || 'Sem categoria'))), h('span', { 'aria-hidden': 'true' }, '→'), h('div', {}, h('small', {}, 'PROPOSTA'), h('strong', {}, d.category || 'Sem categoria'))), editor, h('div', { className: 'mf-d04-scopes' }, h('label', {}, h('input', { type: 'checkbox', checked: d.past,
        onChange: (e) => change({ past: e.target.checked }) }), 'Organizar anteriores'), h('label', {}, h('input', { type: 'checkbox', checked: d.future,
        onChange: (e) => change({ future: e.target.checked }) }), 'Categorizar futuras')), h('div', { className: 'mf-d04-impact' }, h('strong', {}, impact.count + ' registro(s) anteriores nesta amostra'), h('strong', {}, impact.cents === null ? 'Valor indisponível' : intelligencePremiumMoney(impact.cents)), h('small', {}, impact.samplePartial ? 'Amostra parcial, não todo o histórico elegível.' : 'Soma apenas de IDs selecionados.'), !d.past ? h('p', {}, 'Passado desligado: impacto histórico R$ 0,00.') : null, d.future ? h('p', {}, 'Futuro não representa quantidade prevista de transações.') : null), h('div', { className: 'mf-d04-candidates' }, h('h4', {}, 'Registros de referência'), ...candidates, !candidates.length ? h('p', {}, 'Sem registros elegíveis nesta amostra.') : null), h('div', { className: 'mf-d04-actions' }, ...actions), h('p', { className: 'mf-d04-footnote' }, 'Alterações de termos, cor, escopos ou exclusões que o serviço não consegue revalidar permanecem rascunho, sem escrita pessoal.')));
}
function mfD04Render(app) {
    var _a, _b;
    const s = app.state, grant = s.categoryReviewGrant;
    const grantLive = !!(grant === null || grant === void 0 ? void 0 : grant.token) && Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now();
    const report = grantLive ? s.categoryReviewReport : null;
    const entries = mfD04Entries(app), stage = s.mfD04Stage || 'pending';
    const query = String(s.mfD04Search || '').toLocaleLowerCase('pt-BR');
    const visible = entries.filter(e => (stage === 'all' || e.status === stage) &&
        (e.title + ' ' + e.category + ' ' + e.source).toLocaleLowerCase('pt-BR').includes(query));
    const selected = visible.find(e => e.id === s.mfD04Selected) || visible[0] || null;
    const body = grantLive && report ? h('div', { className: 'mf-d04-body' }, mfD04Queue(app, entries, selected), mfD04Details(app, selected), h('details', { className: 'mf-d04-advanced' }, h('summary', {}, 'Outras ferramentas do serviço de revisão'), renderCategoryReviewLegacy(app))) : null;
    const empty = !grantLive ? h('div', { className: 'mf-d04-empty', role: 'status' }, h('h3', {}, s.categoryReviewAvailable === false ? 'Revisão legada indisponível neste perfil' : 'Autorize uma revisão supervisionada'), h('p', {}, 'Escrita pela IA no perfil pessoal permanece desativada. A prévia de teste exige perfil sintético validado.'), s.categoryReviewAvailable ? h('button', { type: 'button', className: 'primary-button',
        disabled: s.categoryReviewBusy, onClick: () => void categoryReviewEnable(app) }, 'Autorizar revisão sintética') : null) : null;
    return h('section', { className: 'mf-d04-review', role: 'region', 'aria-label': 'Central de Revisão V1.1' }, h('header', { className: 'mf-d04-heading' }, h('div', {}, h('small', {}, 'INTELIGÊNCIA / CENTRAL DE REVISÕES'), h('h2', {}, 'Revise antes de decidir.'), h('p', {}, 'Sugestões e movimentações do serviço autorizado, com decisão supervisionada.')), h('div', { className: 'mf-d04-heading-actions' }, h('button', { type: 'button', className: 'ghost-button',
        onClick: () => app.setState({ categoryReviewOpen: false, intelligenceMainMode: 'chat' }) }, 'Voltar à conversa'), grant ? h('button', { type: 'button', className: 'ghost-button',
        onClick: () => void categoryReviewRun(app, () => categoryReviewRefresh(app)) }, 'Atualizar fila') : null)), s.mode === 'real' && s.autoCategoryStatus ? h('section', { className: 'mf-d04-auto-summary',
        role: 'region', 'aria-label': 'Categorização automática' }, h('strong', {}, 'Categorização automática do banco · ' + (s.autoCategoryStatus.enabled ? 'Ativada' : 'Desativada')), h('p', {}, String(((_a = s.autoCategoryStatus.counts) === null || _a === void 0 ? void 0 : _a.classified) || 0) + ' rótulos automáticos registrados · ' +
        String(((_b = s.autoCategoryStatus.counts) === null || _b === void 0 ? void 0 : _b.awaitingReview) || 0) + ' movimentações requerem conferência.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => {
            app.setState({ categoryReviewOpen: false, txSource: 'bank', txReviewOnly: true });
            app.navigate('transactions');
        } }, 'Abrir fila bancária no D05')) : null, empty, body, mfI2CategoryPanel(app), s.mfD04Error ? h('p', { className: 'mf-ai-error', role: 'status' }, s.mfD04Error) : null, s.categoryReviewError ? h('p', { className: 'mf-ai-error', role: 'alert' }, s.categoryReviewError) : null, s.categoryReviewBusy ? h('p', { role: 'status' }, 'Conferindo o serviço…') : null, s.categoryReviewReceipt && grantLive ? h('p', { className: 'mf-d04-receipt', role: 'status' }, 'Ação confirmada pelo serviço: ' + String(s.categoryReviewReceipt.id)) : null, grantLive ? mfD04PreviewModal(app) : null);
}
const MF_D01_COLORS = ['#53d896', '#ff7a88', '#f5bc63', '#79a6fa', '#b49be8', '#57bbba'];
function mfD01Revision(p, edit) {
    return JSON.stringify([p.id, p.origin, p.txId, p.accountId || '', p.amountCents, p.date,
        p.currentCategory, p.proposedCategory, edit.name, edit.color, edit.criterion,
        edit.history, edit.future, edit.selected]);
}
function mfD01Default(p) {
    return { proposalId: p.id, name: p.proposedCategory || '', color: MF_D01_COLORS[0],
        criterion: String(p.rawDescription || p.description || '').slice(0, 100),
        history: true, future: false, selected: !!p.txId };
}
function mfD01Current(app, p) {
    var _a;
    const value = (_a = app.state.mfD01Committed) === null || _a === void 0 ? void 0 : _a[p.id];
    return value && value.proposalId === p.id ? value : mfD01Default(p);
}
function mfD01EditBegin(app, p) {
    const old = mfD01Current(app, p);
    app.setState({ mfD01Edit: { ...old }, mfD01Review: null });
}
function mfD01EditChange(app, patch) {
    if (!app.state.mfD01Edit)
        return;
    app.setState({ mfD01Edit: { ...app.state.mfD01Edit, ...patch }, mfD01Review: null });
}
function mfD01EditDiscard(app) {
    app.setState({ mfD01Edit: null, mfD01Review: null });
}
function mfD01Original(p, edit) {
    const original = mfD01Default(p);
    return edit.name === original.name && edit.color === original.color && edit.criterion === original.criterion &&
        edit.history === original.history && edit.future === false && edit.selected === original.selected;
}
function mfD01EditSave(app, p) {
    const edit = app.state.mfD01Edit;
    if (!edit || edit.proposalId !== p.id)
        return;
    if (!String(edit.name || '').trim())
        return;
    const next = { ...edit, name: edit.name.trim(), criterion: edit.criterion.trim() };
    app.setState({ mfD01Committed: { ...(app.state.mfD01Committed || {}), [p.id]: next },
        mfD01Edit: null, mfD01Review: null, mfD01LocalVerified: null });
}
function mfD01EnterReview(app, p) {
    const edit = mfD01Current(app, p);
    if (!edit.history && !edit.future)
        return;
    const revision = mfD01Revision(p, edit);
    let freshness = false;
    if (edit.history && edit.selected && p.txId && p.status !== 'ambiguous' &&
        typeof intelligenceVerifyProposalRecord === 'function') {
        const verified = intelligenceVerifyProposalRecord(app, p);
        freshness = !!(verified === null || verified === void 0 ? void 0 : verified.ok);
    }
    app.setState({ mfD01Review: { proposalId: p.id, revision, consent: false, freshness } });
}
function mfD01VerifyReview(app, p) {
    var _a;
    const edit = mfD01Current(app, p), review = app.state.mfD01Review;
    if (!review || review.proposalId !== p.id || review.revision !== mfD01Revision(p, edit))
        return false;
    if (!edit.history || !edit.selected || !p.txId ||
        (p.status !== 'pending' && p.status !== 'preview_confirmed'))
        return false;
    if (typeof intelligenceVerifyProposalRecord !== 'function' || !((_a = intelligenceVerifyProposalRecord(app, p)) === null || _a === void 0 ? void 0 : _a.ok))
        return false;
    return true;
}
function mfD01FormatCents(value) {
    return Number.isSafeInteger(value) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value) / 100) : '—';
}
function renderMfD01Proposal(app, p) {
    var _a, _b, _c, _d, _e;
    const edit = mfD01Current(app, p);
    const review = ((_a = app.state.mfD01Review) === null || _a === void 0 ? void 0 : _a.proposalId) === p.id ? app.state.mfD01Review : null;
    const all = Array.isArray(p.candidates) ? p.candidates : [];
    const ambiguous = p.status === 'ambiguous', eligible = p.status === 'pending' || p.status === 'preview_confirmed';
    const fresh = review && mfD01VerifyReview(app, p);
    const money = mfD01FormatCents(p.amountCents);
    const signed = p.txKind === 'expense' ? '-' + money : money;
    const current = p.currentCategory || 'Não categorizada';
    const revision = mfD01Revision(p, edit);
    const priorVerified = ((_b = app.state.mfD01LocalVerified) === null || _b === void 0 ? void 0 : _b.proposalId) === p.id && ((_c = app.state.mfD01LocalVerified) === null || _c === void 0 ? void 0 : _c.revision) === revision &&
        typeof intelligenceVerifyProposalRecord === 'function' && ((_d = intelligenceVerifyProposalRecord(app, p)) === null || _d === void 0 ? void 0 : _d.ok) === true;
    const unchanged = mfD01Original(p, edit);
    const activeEdit = ((_e = app.state.mfD01Edit) === null || _e === void 0 ? void 0 : _e.proposalId) === p.id ? app.state.mfD01Edit : null;
    return h('section', { className: 'mf-d01-proposal status-' + p.status, role: 'region', 'aria-label': 'Proposta de categoria supervisionada' }, h('div', { className: 'mf-d01-proposal-lead' }, h('span', { className: 'mf-d01-category-icon', style: { color: edit.color, '--mf-d01-icon-color': edit.color } }, '✦'), h('div', { className: 'mf-d01-proposal-title' }, h('small', {}, 'Proposta de organização · somente leitura'), h('h3', {}, edit.name || 'Nova categoria'), h('p', {}, 'Critério: ' + (edit.criterion || 'A definir'))), h('button', { type: 'button', className: 'ghost-button mf-d01-edit-trigger', onClick: () => mfD01EditBegin(app, p) }, 'Personalizar')), h('div', { className: 'mf-d01-stats' }, h('div', {}, h('small', {}, 'Selecionadas'), h('strong', {}, String(!ambiguous && edit.selected && p.txId ? 1 : 0))), h('div', {}, h('small', {}, 'Valor na prévia'), h('strong', {}, !ambiguous && edit.selected && p.txId ? signed : '—')), h('div', {}, h('small', {}, 'A conferir'), h('strong', {}, String(ambiguous ? Math.max(1, p.candidatesCount || all.length) : 0)))), ambiguous ? h('div', { className: 'mf-d01-warning', role: 'status' }, h('strong', {}, 'Encontramos lançamentos parecidos'), h('p', {}, 'Escolha o registro correto antes de continuar. Nenhuma correspondência ambígua será aplicada automaticamente.'), ...all.slice(0, p.visibleLimit || 8).map((c) => h('button', { type: 'button', className: 'mf-d01-candidate', key: c.candidateKey,
        onClick: () => intelligenceSelectActionCandidate(app, p.id, c.candidateKey) }, h('span', {}, c.description + ' · ' + c.date), h('strong', {}, mfD01FormatCents(c.amountCents)))), all.length > (p.visibleLimit || 8) ? h('button', { type: 'button', className: 'ghost-button', onClick: () => intelligenceExpandProposalCandidates(app, p.id) }, 'Mostrar mais registros') : null) :
        h('div', { className: 'mf-d01-affected' }, h('strong', {}, 'Movimentação identificada'), h('label', { className: 'mf-d01-transaction' }, h('input', { type: 'checkbox', checked: edit.selected, disabled: !p.txId || !eligible, onChange: (e) => {
                app.setState({ mfD01Committed: { ...(app.state.mfD01Committed || {}), [p.id]: { ...edit, selected: e.target.checked } }, mfD01Review: null });
            } }), h('span', {}, h('b', {}, p.description), h('small', {}, p.date + ' · ' + (p.origin === 'bank' ? 'Banco' : 'Manual') + ' · ' + current + ' → ' + edit.name)), h('strong', {}, signed))), h('div', { className: 'mf-d01-scopes' }, h('label', {}, h('input', { type: 'checkbox', checked: edit.history, disabled: ambiguous, onChange: (e) => {
            app.setState({ mfD01Committed: { ...(app.state.mfD01Committed || {}), [p.id]: { ...edit, history: e.target.checked } }, mfD01Review: null });
        } }), 'Organizar compras anteriores'), h('label', {}, h('input', { type: 'checkbox', checked: edit.future, onChange: (e) => {
            app.setState({ mfD01Committed: { ...(app.state.mfD01Committed || {}), [p.id]: { ...edit, future: e.target.checked } }, mfD01Review: null });
        } }), 'Categorizar próximas compras')), edit.future ? h('p', { className: 'mf-d01-warning' }, 'A regra para compras futuras ainda não possui prévia e serviço transacional autorizados; não será ativada aqui.') : null, h('div', { className: 'mf-d01-actions' }, h('button', { type: 'button', className: 'primary-button',
        disabled: ambiguous || !eligible || (!edit.history && !edit.future),
        onClick: () => mfD01EnterReview(app, p) }, 'Conferir proposta'), h('button', { type: 'button', className: 'ghost-button', disabled: p.status === 'denied',
        onClick: () => { intelligenceResolveActionProposal(app, p.id, 'deny'); app.setState({ mfD01Review: null, mfD01Edit: null }); } }, 'Recusar')), review ? h('div', { className: 'mf-d01-confirm', role: 'group', 'aria-label': 'Reconfirmação de prévia sem gravação' }, h('strong', {}, 'Confira antes de prosseguir'), h('p', {}, edit.name + ' · ' + (edit.history ? 'Compras anteriores' : 'Sem histórico') +
        (edit.future ? ' + próximas compras' : '') + ' · ' + (edit.selected && p.txId ? money : 'Nenhum lançamento selecionado')), h('small', {}, 'Prévia local ' + (fresh ? 'conferida' : 'desatualizada ou sem cobertura') +
        ' · identificador ' + p.id.slice(0, 22) + ' · nenhuma escrita disponível'), !fresh ? h('p', { role: 'alert' }, 'A identificação mudou ou falta cobertura. Revise a seleção antes de confirmar.') : null, h('label', {}, h('input', { type: 'checkbox', checked: !!review.consent, disabled: !fresh,
        onChange: (e) => app.setState({ mfD01Review: { ...review, consent: e.target.checked } }) }), 'Confirmo que conferi os dados desta prévia sem gravação.'), h('div', { className: 'mf-d01-actions' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => app.setState({ mfD01Review: null }) }, 'Voltar'), h('button', { type: 'button', className: 'primary-button', disabled: !fresh || !review.consent || !edit.history || !edit.selected || !p.txId,
        onClick: () => {
            var _a;
            if (!mfD01VerifyReview(app, p) || !((_a = app.state.mfD01Review) === null || _a === void 0 ? void 0 : _a.consent))
                return;
            if (mfD01Original(p, edit))
                intelligenceResolveActionProposal(app, p.id, 'approve');
            app.setState({ mfD01Review: null, mfD01LocalVerified: { proposalId: p.id, revision } });
        } }, 'Validar prévia sem gravar'))) :
        null, unchanged && p.resultMessage ? h('p', { className: 'mf-d01-result', role: 'status' }, p.resultMessage) : null, priorVerified ? h('p', { className: 'mf-d01-readonly', role: 'status' }, 'Prévia conferida. Não foi aplicada nenhuma alteração. A aplicação por IA no perfil pessoal permanece indisponível.') : null, h('div', { className: 'mf-d01-manual' }, h('p', {}, 'Para criar uma categoria agora, use o editor manual. Isso é separado desta proposta.'), h('button', { type: 'button', className: 'ghost-button', disabled: app.state.mode === 'demo',
        onClick: () => { app.setState({ mfD01Review: null, intelligencePanelOpen: false }); app.navigate('categories'); } }, 'Abrir editor manual')), activeEdit ? h('div', { className: 'mf-d01-modal-backdrop', role: 'presentation' }, h('div', { className: 'mf-d01-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Personalizar proposta',
        onKeyDown: (e) => { if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            mfD01EditDiscard(app);
        } } }, h('h3', {}, 'Personalizar categoria'), h('label', {}, 'Nome', h('input', { autoFocus: true, value: activeEdit.name, maxLength: 60, onChange: (e) => mfD01EditChange(app, { name: e.target.value }) })), h('label', {}, 'Critério de identificação', h('input', { value: activeEdit.criterion, maxLength: 100, onChange: (e) => mfD01EditChange(app, { criterion: e.target.value }) })), h('fieldset', {}, h('legend', {}, 'Cor da categoria'), ...MF_D01_COLORS.map(color => h('button', { type: 'button', key: color, className: 'mf-d01-color ' + (color === activeEdit.color ? 'is-selected' : ''),
        style: { backgroundColor: color }, 'aria-label': 'Selecionar cor ' + color, 'aria-pressed': color === activeEdit.color,
        onClick: () => mfD01EditChange(app, { color }) }, ' '))), h('div', { className: 'mf-d01-actions' }, h('button', { type: 'button', className: 'ghost-button', onClick: () => mfD01EditDiscard(app) }, 'Descartar edição'), h('button', { type: 'button', className: 'primary-button', disabled: !activeEdit.name.trim(),
        onClick: () => mfD01EditSave(app, p) }, 'Salvar prévia')))) : null);
}
const MF_VISUAL_COLORS = ['#60b8a6', '#f4b560', '#7ca3e9', '#b48ee7', '#ed8995', '#9bc86e', '#c6a470', '#80b6ce'];
function mfVisualMoney(cents) {
    return Number.isSafeInteger(cents) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) : '—';
}
function mfVisualRequested(question) {
    const q = String(question || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/para onde (?:foi|vai) (?:minha |meu |a )?(?:renda|dinheiro)|fluxo de (?:dinheiro|renda)|sankey|distribuicao da renda/.test(q))
        return 'sankey';
    if (/treemap|mapa de (?:gastos|despesas|categorias)|distribuicao (?:dos |de )?gastos|despesas por categoria/.test(q))
        return 'treemap';
    return null;
}
function mfVisualFromOperational(o, kind) {
    var _a;
    if (!o || o.contract !== 'IC-v1/I-P0.2-read-only' || o.readOnly !== true ||
        o.changesApplied !== false || o.modelCalled !== false ||
        !['bank', 'manual'].includes(o.source) || !['real', 'demo'].includes(o.profile))
        return null;
    const f = o.facts, p = (_a = o.period) === null || _a === void 0 ? void 0 : _a.start;
    if (!f || f.visualSource !== 'finance-period-ledger-v1' || typeof p !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p))
        return null;
    if (![f.incomeCents, f.expenseCents, f.netCents].every(Number.isSafeInteger) ||
        f.incomeCents < 0 || f.expenseCents < 0 || f.netCents !== f.incomeCents - f.expenseCents)
        return null;
    if (!Array.isArray(f.expenseCategories) || f.expenseCategories.length > 10000)
        return null;
    const seen = new Set();
    let sum = 0;
    const categories = [];
    for (const item of f.expenseCategories) {
        if (!item || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.name) ||
            !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0 ||
            !Number.isSafeInteger(item.movementCount) || item.movementCount < 1 ||
            !Array.isArray(item.movements) || item.movements.length > 20)
            return null;
        seen.add(item.name);
        sum += item.amountCents;
        if (!Number.isSafeInteger(sum))
            return null;
        const movements = [];
        for (const m of item.movements) {
            if (!m || typeof m.id !== 'string' || typeof m.date !== 'string' ||
                !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || typeof m.description !== 'string' ||
                !Number.isSafeInteger(m.amountCents) || m.amountCents <= 0)
                return null;
            movements.push({ id: m.id.slice(0, 100), date: m.date, description: m.description.slice(0, 120), amountCents: m.amountCents });
        }
        if (movements.length > item.movementCount)
            return null;
        const partial = !!item.detailsPartial || movements.length < item.movementCount;
        if (!partial && movements.reduce((n, m) => n + m.amountCents, 0) !== item.amountCents)
            return null;
        categories.push({ name: item.name, amountCents: item.amountCents, movementCount: item.movementCount,
            movements, detailsPartial: partial });
    }
    if (sum !== f.expenseCents)
        return null;
    categories.sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name, 'pt-BR'));
    const coverage = o.coverage === 'partial_local' ? 'partial_local' : o.coverage === 'complete_local' ? 'complete_local' : 'unknown';
    const cannotShowSankey = kind === 'sankey' && (f.incomeCents === 0 || f.netCents < 0);
    const state = f.expenseCents === 0 ? 'empty' : cannotShowSankey ? 'partial' : 'ready';
    const reason = cannotShowSankey ?
        'Neste período as despesas excederam as entradas, ou não houve receita. Não é possível desenhar um fluxo de saída de renda sem criar números fictícios.' :
        coverage === 'partial_local' ? 'Histórico parcial: números proporcionais apenas aos registros locais carregados.' :
            coverage === 'unknown' ? 'A origem local foi reconciliada no período, mas a cobertura do extrato completo não está certificada.' : 'Valores reconciliados no período.';
    return { kind, source: o.source, profile: o.profile, period: p.slice(0, 7), coverage,
        incomeCents: f.incomeCents, expenseCents: f.expenseCents, netCents: f.netCents,
        categories, state, reason };
}
function mfVisualRects(cats, x = 0, y = 0, w = 100, h = 100) {
    if (!cats.length)
        return [];
    if (cats.length === 1)
        return [{ name: cats[0].name, x, y, w, h, amountCents: cats[0].amountCents }];
    const total = cats.reduce((sum, c) => sum + c.amountCents, 0);
    let split = 1, part = cats[0].amountCents;
    while (split < cats.length - 1 && part < total / 2) {
        part += cats[split].amountCents;
        split++;
    }
    const frac = part / total;
    if (w >= h)
        return [...mfVisualRects(cats.slice(0, split), x, y, w * frac, h),
            ...mfVisualRects(cats.slice(split), x + w * frac, y, w * (1 - frac), h)];
    return [...mfVisualRects(cats.slice(0, split), x, y, w, h * frac),
        ...mfVisualRects(cats.slice(split), x, y + h * frac, w, h * (1 - frac))];
}
function mfVisualSelected(app, messageId, data) {
    var _a;
    const active = app.state.mfVisualSelection;
    return (active === null || active === void 0 ? void 0 : active.messageId) === messageId && (data.categories.some(c => c.name === active.name) ||
        (data.kind === 'sankey' && data.netCents > 0 && active.name === '__result__')) ? active.name : (((_a = data.categories[0]) === null || _a === void 0 ? void 0 : _a.name) || '');
}
function mfVisualChoose(app, messageId, name) {
    app.setState({ mfVisualSelection: { messageId, name } });
}
function mfVisualOpenTransactions(app, name, month, source) {
    app.navigate('transactions');
    if (typeof app.setSharedMonth === 'function')
        app.setSharedMonth(month);
    app.setState({ txSource: source, txCategoryFilter: name, txKindFilter: 'expense', txReviewOnly: false,
        txSelected: [], query: '' });
}
function mfVisualMonthBefore(month) {
    const m = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(month);
    if (!m)
        return '';
    const year = Number(m[1]), mo = Number(m[2]);
    return (mo === 1 ? year - 1 : year) + '-' + String(mo === 1 ? 12 : mo - 1).padStart(2, '0');
}
async function mfVisualComparePrevious(app, messageId, current, name) {
    var _a, _b, _c, _d;
    const token = (_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token;
    const prev = mfVisualMonthBefore(current.period);
    const api = desktop;
    if (!token || !prev || !(api === null || api === void 0 ? void 0 : api.intelligenceOperationalAsk))
        return;
    const signature = intelligencePremiumSignature(app), request = (app.__mfVisualRequest || 0) + 1;
    app.__mfVisualRequest = request;
    app.setState({ mfVisualCompare: { messageId, name, status: 'loading' } });
    try {
        const r = await api.intelligenceOperationalAsk({ month: prev, token, question: 'Radar financeiro' });
        const prior = mfVisualFromOperational(r, 'treemap');
        if (request !== app.__mfVisualRequest || signature !== intelligencePremiumSignature(app) ||
            ((_b = app.state.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) !== token)
            return;
        if (!prior || prior.source !== current.source || prior.profile !== current.profile ||
            prior.period !== prev || prior.coverage === 'partial_local') {
            app.setState({ mfVisualCompare: { messageId, name, status: 'partial' } });
            return;
        }
        const before = ((_c = prior.categories.find(c => c.name === name)) === null || _c === void 0 ? void 0 : _c.amountCents) || 0;
        const now = ((_d = current.categories.find(c => c.name === name)) === null || _d === void 0 ? void 0 : _d.amountCents) || 0;
        app.setState({ mfVisualCompare: { messageId, name, status: 'ready', before, now, prev } });
    }
    catch {
        if (request === app.__mfVisualRequest)
            app.setState({ mfVisualCompare: { messageId, name, status: 'error' } });
    }
}
function mfVisualRibbon(x1, x2, top1, top2, height) {
    const bend = (x2 - x1) * .46;
    return 'M' + x1 + ' ' + top1 + ' C' + (x1 + bend) + ' ' + top1 + ' ' + (x2 - bend) + ' ' + top2 + ' ' + x2 + ' ' + top2 +
        ' L' + x2 + ' ' + (top2 + height) + ' C' + (x2 - bend) + ' ' + (top2 + height) + ' ' + (x1 + bend) + ' ' + (top1 + height) + ' ' + x1 + ' ' + (top1 + height) + ' Z';
}
function renderMfVisual(app, msg) {
    var _a, _b, _c, _d, _e;
    const data = msg.visual;
    if (!data)
        return null;
    const selected = mfVisualSelected(app, msg.id, data), active = data.categories.find(c => c.name === selected);
    const total = data.expenseCents;
    const resultSelected = selected === '__result__';
    const detailOpen = ((_a = app.state.mfVisualDetailsOpen) === null || _a === void 0 ? void 0 : _a.messageId) === msg.id && ((_b = app.state.mfVisualDetailsOpen) === null || _b === void 0 ? void 0 : _b.name) === selected;
    const compact = app.state.intelligencePanelOpen === true;
    const compare = ((_c = app.state.mfVisualCompare) === null || _c === void 0 ? void 0 : _c.messageId) === msg.id && ((_d = app.state.mfVisualCompare) === null || _d === void 0 ? void 0 : _d.name) === selected ? app.state.mfVisualCompare : null;
    const tone = (index) => MF_VISUAL_COLORS[index % MF_VISUAL_COLORS.length];
    const open = (name) => mfVisualChoose(app, msg.id, name);
    const legend = h('div', { className: 'mf-vr-legend', role: 'list', 'aria-label': 'Categorias incluídas no período' }, ...data.categories.map((c, i) => h('button', { type: 'button', role: 'listitem', className: 'mf-vr-legend-item ' + (c.name === selected ? 'is-selected' : ''),
        key: c.name, 'aria-pressed': c.name === selected, onClick: () => open(c.name) }, h('span', { className: 'mf-vr-dot', style: { backgroundColor: tone(i) }, 'aria-hidden': 'true' }), h('span', { className: 'mf-vr-legend-title' }, c.name), h('strong', {}, mfVisualMoney(c.amountCents) + ' · ' + (total ? ((c.amountCents / total) * 100).toFixed(1) : '0') + '%'))));
    let graphic = null;
    if (data.state === 'ready' && data.kind === 'treemap') {
        const rects = mfVisualRects(data.categories);
        graphic = h('div', { className: 'mf-vr-treemap', role: 'group', 'aria-label': 'Treemap com área proporcional aos gastos' }, ...rects.map(rect => {
            const i = data.categories.findIndex(c => c.name === rect.name);
            return h('button', { type: 'button', key: rect.name, className: 'mf-vr-tile ' + (rect.name === selected ? 'is-selected' : ''),
                title: rect.name + ' · ' + mfVisualMoney(rect.amountCents), onClick: () => open(rect.name),
                'aria-label': rect.name + ' · ' + mfVisualMoney(rect.amountCents),
                style: { left: rect.x + '%', top: rect.y + '%', width: rect.w + '%', height: rect.h + '%',
                    '--mf-vr-color': tone(i) } }, rect.w >= 17 && rect.h >= 19 ? h('span', {}, rect.name) : null, rect.w >= 20 && rect.h >= 25 ? h('strong', {}, mfVisualMoney(rect.amountCents)) : null);
        }));
    }
    if (data.state === 'ready' && data.kind === 'sankey') {
        const hTotal = 190, scale = hTotal / data.incomeCents;
        const eHeight = data.expenseCents * scale, nHeight = data.netCents * scale;
        let current = 25;
        graphic = h('div', { className: 'mf-vr-flow-wrap' }, h('svg', { className: 'mf-vr-flow', viewBox: '0 0 900 258', role: 'img', 'aria-label': 'Receitas distribuídas em despesas por categoria e resultado do período' }, h('rect', { x: 20, y: 25, width: 26, height: hTotal, rx: 6, fill: '#6b8fa9' }), h('path', { d: mfVisualRibbon(46, 320, 25, 25, eHeight), fill: '#d98b7e', opacity: .55 }), nHeight > 0 ? h('g', { role: 'button', tabIndex: 0, 'aria-label': 'Resultado do período ' + mfVisualMoney(data.netCents),
            onClick: () => open('__result__'), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open('__result__');
            } } }, h('path', { d: mfVisualRibbon(46, 710, 25 + eHeight, 25 + eHeight, nHeight), fill: '#53d896', opacity: resultSelected ? 1 : .67 })) : null, h('rect', { x: 320, y: 25, width: 24, height: eHeight, rx: 5, fill: '#d98b7e' }), ...data.categories.map((c, i) => {
            const height = c.amountCents * scale, top = current;
            current += height;
            return h('g', { key: c.name, role: 'button', tabIndex: 0, 'aria-label': c.name + ' ' + mfVisualMoney(c.amountCents),
                onClick: () => open(c.name), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(c.name);
                } } }, h('path', { className: 'mf-vr-flow-ribbon ' + (c.name === selected ? 'is-selected' : ''),
                d: mfVisualRibbon(344, 710, top, top, height), fill: tone(i), opacity: c.name === selected ? .9 : .55 }), h('rect', { x: 710, y: top, width: 24, height: height, fill: tone(i) }));
        }), nHeight > 0 ? h('rect', { x: 710, y: 25 + eHeight, width: 24, height: nHeight, fill: '#53d896' }) : null, h('text', { x: 20, y: 15, fill: 'currentColor' }, 'Receitas'), h('text', { x: 320, y: 15, fill: 'currentColor' }, 'Despesas'), h('text', { x: 710, y: 15, fill: 'currentColor' }, 'Categorias / resultado')));
    }
    return h('section', { className: 'mf-vr-card mf-vr-' + data.kind + (compact ? ' is-compact' : ''), role: 'region',
        'aria-label': data.kind === 'treemap' ? 'Distribuição dos gastos por categoria' : 'Fluxo de dinheiro reconciliado' }, h('header', { className: 'mf-vr-head' }, h('div', {}, h('small', {}, data.period + ' · ' + (data.source === 'bank' ? 'Banco' : 'Manual') + ' · ' + (data.coverage === 'partial_local' ? 'Histórico parcial' : 'Registros locais')), h('h3', {}, data.kind === 'treemap' ? 'Para onde foram os gastos' : 'Para onde foi a renda?')), h('strong', {}, mfVisualMoney(data.kind === 'treemap' ? data.expenseCents : data.incomeCents))), data.kind === 'sankey' ? h('div', { className: 'mf-vr-totals' }, h('span', {}, 'Receitas ' + mfVisualMoney(data.incomeCents)), h('span', {}, 'Despesas ' + mfVisualMoney(data.expenseCents)), h('button', { type: 'button', className: 'mf-vr-result-action', disabled: data.netCents <= 0,
        'aria-pressed': resultSelected, onClick: () => open('__result__') }, 'Resultado do período ' + mfVisualMoney(data.netCents))) : null, h('p', { className: 'mf-vr-cover', role: data.state === 'partial' ? 'alert' : 'note' }, data.reason), data.state === 'empty' ? h('p', { className: 'mf-vr-empty' }, 'Não existem despesas reconciliadas para esse período.') : null, graphic, data.categories.length ? legend : null, active ? h('div', { className: 'mf-vr-inspector' }, h('strong', {}, active.name), h('p', {}, mfVisualMoney(active.amountCents) + ' · ' + ((active.amountCents / data.expenseCents) * 100).toFixed(1) + '% das despesas · ' + active.movementCount + ' movimentação(ões) considerada(s)'), detailOpen ? h('div', { className: 'mf-vr-details', role: 'region', 'aria-label': 'Movimentações de ' + active.name }, h('strong', {}, 'Movimentações de ' + active.name), h('ul', {}, ...active.movements.map(m => h('li', { key: m.id + '-' + m.date }, m.date + ' · ' + m.description + ' · ' + mfVisualMoney(m.amountCents)))), active.detailsPartial ? h('p', { role: 'status' }, 'Amostra parcial: ' + active.movements.length + ' de ' + active.movementCount + ' registros.') : null, active.detailsPartial ? h('button', { type: 'button', onClick: () => mfVisualOpenTransactions(app, active.name, data.period, data.source) }, 'Abrir histórico completo') : null) : null, h('div', { className: 'mf-vr-actions' }, h('button', { type: 'button', 'aria-expanded': !!detailOpen,
        onClick: () => app.setState({ mfVisualDetailsOpen: detailOpen ? null : { messageId: msg.id, name: active.name } }) }, detailOpen ? 'Ocultar movimentações' : 'Ver movimentações'), h('button', { type: 'button', disabled: !((_e = app.state.localFinancialAccess) === null || _e === void 0 ? void 0 : _e.token),
        onClick: () => void mfVisualComparePrevious(app, msg.id, data, active.name) }, 'Comparar mês anterior')), compare ? h('p', { role: 'status' }, compare.status === 'ready' ?
        'Anterior ' + mfVisualMoney(compare.before) + ' · atual ' + mfVisualMoney(compare.now) + ' · diferença ' + mfVisualMoney(compare.now - compare.before) :
        compare.status === 'loading' ? 'Consultando mês anterior…' :
            'Não há uma comparação completa e autorizada disponível.') : null) : null, resultSelected ? h('p', { className: 'mf-vr-result-note', role: 'status' }, 'Resultado do período: ' + mfVisualMoney(data.netCents) + '. Isso representa receitas menos despesas efetivas do período; não é o saldo disponível da conta.') : null, h('details', { className: 'mf-vr-table' }, h('summary', {}, 'Tabela acessível · ' + data.categories.length + ' categorias'), h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Categoria'), h('th', {}, 'Despesas'), h('th', {}, 'Participação'))), h('tbody', {}, ...data.categories.map(c => h('tr', { key: c.name }, h('td', {}, c.name), h('td', {}, mfVisualMoney(c.amountCents)), h('td', {}, ((c.amountCents / (data.expenseCents || 1)) * 100).toFixed(1) + '%')))))));
}
const MF_V3_GRANT_BINDINGS = new WeakMap();
function mfV3BindGrant(card, access, signature) {
    if (card && (access === null || access === void 0 ? void 0 : access.token) && typeof signature === 'string') {
        MF_V3_GRANT_BINDINGS.set(card, { access, token: access.token, signature });
    }
    return card;
}
function mfV3MatchesGrant(card, access, signature) {
    const binding = card && MF_V3_GRANT_BINDINGS.get(card);
    return !!binding && binding.access === access && binding.token === (access === null || access === void 0 ? void 0 : access.token) &&
        binding.signature === signature;
}
const MF_V3_KINDS = [
    ['VR-01', 'summary', 'Resumo executivo'], ['VR-02', 'kpi', 'Indicador financeiro'],
    ['VR-03', 'compare', 'Antes e depois'], ['VR-04', 'trend', 'Tendência temporal'],
    ['VR-05', 'bar', 'Barras comparativas'], ['VR-06', 'donut', 'Distribuição de despesas'],
    ['VR-07', 'treemap', 'Treemap de despesas'], ['VR-08', 'sankey', 'Fluxo de dinheiro'],
    ['VR-09', 'rank', 'Ranking de variações'], ['VR-10', 'drilldown', 'Investigar despesas'],
    ['VR-11', 'table', 'Tabela de movimentações'], ['VR-12', 'recurring', 'Recorrências'],
    ['VR-13', 'budget', 'Orçamento'], ['VR-14', 'cashflow', 'Fluxo de caixa'],
    ['VR-15', 'whatif', 'Simulação'], ['VR-16', 'scenario', 'Cenários'],
    ['VR-17', 'goal', 'Metas'], ['VR-18', 'debt', 'Dívidas'],
    ['VR-19', 'portfolio', 'Patrimônio'], ['VR-20', 'insight', 'Oportunidades'],
    ['VR-21', 'plan', 'Plano de ação'], ['VR-22', 'proposal', 'Propostas'],
    ['VR-23', 'approval', 'Aprovações e recibos'], ['VR-24', 'report', 'Relatório'],
    ['VR-25', 'quality', 'Qualidade dos dados'], ['VR-26', 'state', 'Estados especiais']
];
const MF_V3_HEAT = ['#ff516a', '#ff7470', '#fa935d', '#f4b350', '#f4d363'];
function mfV3Registry() {
    const approved = new Set(['treemap', 'sankey', 'rank']);
    const connected = new Set(['summary', 'kpi', 'compare', 'trend', 'bar', 'donut', 'treemap', 'sankey',
        'rank', 'drilldown', 'table', 'budget', 'cashflow', 'insight', 'report', 'quality', 'state']);
    return MF_V3_KINDS.map(x => ({ id: x[0], kind: x[1], title: x[2],
        designStatus: approved.has(x[1]) ? 'DESIGN_APPROVED' :
            x[1] === 'drilldown' ? 'BASELINE_ACCEPTED_FOR_BATCH' : 'DESIGN_SPECIFIED_BY_INHERITANCE',
        capability: connected.has(x[1]) ? 'LOCAL_FACTS_ADAPTER' :
            x[1] === 'proposal' ? 'D01_SUPERVISED_PREVIEW' : 'AWAITING_BACKEND_OR_OPERATION',
        implementation: 'RENDERER_IMPLEMENTED_NOT_HOMOLOGATED' }));
}
function mfV3Allowed(kind) { return MF_V3_KINDS.some(x => x[1] === kind); }
function mfV3Title(kind) { const hit = MF_V3_KINDS.find(x => x[1] === kind); return hit ? hit[2] : 'Resposta financeira'; }
function mfV3Money(n) { return Number.isSafeInteger(n) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100) : '—'; }
function mfV3Delta(a, b) { return Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(a - b) ? a - b : null; }
function mfV3Pct(now, before) { return Number.isSafeInteger(now) && Number.isSafeInteger(before) && before > 0 ? Math.round((now - before) * 1000 / before) / 10 : null; }
function mfV3Fold(q) { return String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function mfV3Requested(q) {
    const s = mfV3Fold(q);
    const patterns = [
        ['sankey', /para onde foi (minha|a) renda|fluxo de dinheiro|sankey/],
        ['treemap', /treemap|mapa de (gastos|despesas|categorias)/],
        ['rank', /quem aumentou|ranking (de )?(aumentos|variac|despesas)|aumentos por categoria/],
        ['drilldown', /investig(ar|acao)|de onde veio (esse|essa|o) (total|valor|gasto)|detalhar categoria/],
        ['table', /tabela de (transac|moviment)|liste (as )?(transac|moviment)/],
        ['recurring', /recorrenc|assinaturas (recorrentes|que pago)|cobrancas repetidas/],
        ['budget', /orcamento|limites por categoria|meus limites/],
        ['cashflow', /fluxo de caixa|entradas e saidas do mes/],
        ['whatif', /e se (eu )?(comprar|gastar)|simular gasto/],
        ['scenario', /cenario|cenarios financeiros/],
        ['goal', /meta financeira|metas de econom/],
        ['debt', /minhas dividas|emprestimos|dividas cadastradas/],
        ['portfolio', /patrimonio|investimentos/],
        ['insight', /oportunidades de econom|economizar mais/],
        ['plan', /plano de acao|criar plano financeiro/],
        ['proposal', /minhas propostas|proposta de categoria/],
        ['approval', /recibo de (acao|alteracao)|aprovacoes/],
        ['report', /relatorio de despesas|relatorio financeiro/],
        ['quality', /qualidade dos dados|cobertura do extrato|dados faltantes/],
        ['trend', /tendencia temporal|evolucao mensal|linha de tendencia/],
        ['compare', /compare|comparar|mes anterior|antes e depois/],
        ['bar', /barras comparativas|grafico de barras/],
        ['donut', /grafico de rosca|rosca de gastos|distribuicao percentual/],
        ['kpi', /indicador isolado|quanto gastei com |total de despesas/],
        ['summary', /resumo executivo|como foi meu mes|meu mes financeiro|panorama financeiro/],
        ['state', /estado da consulta|porque nao aparece/]
    ];
    const found = patterns.find(([kind, re]) => re.test(s));
    return found ? found[0] : null;
}
function mfV3NeedsPrevious(kind) { return kind === 'compare' || kind === 'rank' || kind === 'drilldown' || kind === 'trend'; }
function mfV3FromOperational(op, kind, prior) {
    if (!mfV3Allowed(kind) || !op || op.contract !== 'IC-v1/I-P0.2-read-only' || op.readOnly !== true ||
        op.changesApplied !== false || op.modelCalled !== false || !['ready', 'empty'].includes(op.uiState))
        return null;
    const original = mfVisualFromOperational(op, 'treemap');
    if (!original)
        return null;
    const p = op.facts, budgets = [];
    if (Array.isArray(p.budgets)) {
        for (const b of p.budgets) {
            if (typeof b.category !== 'string' || !b.category.trim() ||
                !Number.isSafeInteger(b.spentCents) || b.spentCents < 0 ||
                !Number.isSafeInteger(b.limitCents) || b.limitCents < 0)
                return null;
            budgets.push({ category: b.category, spentCents: b.spentCents, limitCents: b.limitCents });
        }
    }
    let prev = null;
    if (prior && prior.contract === 'IC-v1/I-P0.2-read-only' && prior.readOnly === true &&
        prior.changesApplied === false && prior.modelCalled === false &&
        prior.source === original.source && prior.profile === original.profile) {
        const v = mfVisualFromOperational(prior, 'treemap');
        if (v && v.period === mfVisualMonthBefore(original.period))
            prev = { period: v.period, categories: v.categories, expenseCents: v.expenseCents,
                incomeCents: v.incomeCents, coverage: v.coverage };
    }
    const sourcePartial = original.coverage === 'partial_local';
    const sankeyNotRepresentable = kind === 'sankey' && (original.incomeCents === 0 || original.netCents < 0);
    const blockedPrev = mfV3NeedsPrevious(kind) && (!prev || prev.coverage === 'partial_local' || sourcePartial);
    const unsupported = ['recurring', 'goal', 'debt', 'portfolio', 'approval', 'whatif', 'scenario'].includes(kind);
    const quality = unsupported ? 'unavailable' : blockedPrev || sourcePartial || sankeyNotRepresentable ? 'partial' :
        original.expenseCents === 0 && original.incomeCents === 0 ? 'empty' : 'ready';
    const reason = sankeyNotRepresentable ? 'Receita ausente ou resultado negativo: não há fluxo de receitas que represente estes gastos sem criar dinheiro fictício. Consulte a tabela.' :
        unsupported ? 'Os serviços locais ainda não fornecem fatos verificáveis para esta família. Nenhuma operação foi executada.' :
            blockedPrev ? 'Comparação indisponível: a fonte e a cobertura dos dois meses não foram verificadas.' :
                sourcePartial ? 'Histórico parcial: valores limitados aos registros locais carregados.' :
                    original.coverage === 'unknown' ? 'Totais reconciliados dos registros locais; cobertura integral não certificada.' :
                        'Totais reconciliados dos registros autorizados neste período.';
    return { kind, period: original.period, source: original.source, profile: original.profile,
        coverage: original.coverage, asOf: typeof op.asOf === 'string' ? op.asOf : null, quality, reason,
        incomeCents: original.incomeCents, expenseCents: original.expenseCents, netCents: original.netCents,
        categories: original.categories, budgets, previous: prev,
        original: kind === 'sankey' ? mfVisualFromOperational(op, 'sankey') : original };
}
function mfV3CompareRows(v) {
    if (!v || !v.previous)
        return [];
    const base = new Map(v.previous.categories.map((c) => [c.name, c.amountCents]));
    const current = new Map(v.categories.map((c) => [c.name, c.amountCents]));
    const names = new Set([...base.keys(), ...current.keys()]);
    return [...names].map((name) => {
        var _a, _b;
        const before = (_a = base.get(name)) !== null && _a !== void 0 ? _a : 0, now = (_b = current.get(name)) !== null && _b !== void 0 ? _b : 0, delta = mfV3Delta(now, before);
        return { name, before, now, delta, relative: mfV3Pct(now, before) };
    }).sort((a, b) => {
        if (a.delta === null)
            return b.delta === null ? a.name.localeCompare(b.name, 'pt-BR') : 1;
        if (b.delta === null)
            return -1;
        return b.delta - a.delta || a.name.localeCompare(b.name, 'pt-BR');
    });
}
function mfV3Heat(rows) {
    const positive = rows.filter(x => x.delta !== null && x.delta > 0).sort((a, b) => { var _a, _b; return ((_a = b.delta) !== null && _a !== void 0 ? _a : 0) - ((_b = a.delta) !== null && _b !== void 0 ? _b : 0) || a.name.localeCompare(b.name, 'pt-BR'); });
    const unique = [...new Set(positive.flatMap(x => x.delta === null ? [] : [x.delta]))];
    return rows.map(r => ({ ...r, heat: r.delta === null || r.delta <= 0 ? null :
            MF_V3_HEAT[Math.min(4, unique.indexOf(r.delta))] }));
}
function mfV3Records(v) {
    const records = [];
    for (const c of v.categories)
        for (const m of c.movements)
            records.push({ category: c.name, id: m.id, date: m.date, description: m.description, amountCents: m.amountCents });
    return records;
}
function mfV3RecordsPartial(v) { return v.categories.some(c => c.detailsPartial); }
function mfV3Schema() {
    return { schemaVersion: '1', kinds: mfV3Registry().map(x => x.kind), maxPrimary: 1, maxSupplementary: 2,
        densities: ['compact', 'standard', 'analysis', 'mobile'], source: 'authorized local deterministic read' };
}
function mfV3Mode(app, msg) {
    return app.state.mfV3AnalysisMessageId === msg.id ? 'analysis' : app.state.intelligencePanelOpen ? 'compact' : 'standard';
}
function mfV3Table(headers, rows) {
    return h('div', { className: 'mf-v3-scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...headers.map(x => h('th', { key: x }, x)))), h('tbody', {}, ...rows.map((row, i) => h('tr', { key: i }, ...row.map((cell, j) => h('td', { key: j }, cell)))))));
}
function mfV3Bar(label, value, pct, color, onClick) {
    return h('button', { type: 'button', className: 'mf-v3-bar', onClick }, h('div', { className: 'mf-v3-bar-head' }, h('span', {}, label), h('strong', {}, value)), h('div', { className: 'mf-v3-track' }, h('span', { style: { width: Math.max(0, Math.min(100, pct || 0)) + '%', background: color } })));
}
function mfV3Live(app, d) {
    const a = app.state.localFinancialAccess;
    const month = app.state.localFinancialMonth || app.state.month;
    return !!(a === null || a === void 0 ? void 0 : a.token) && mfV3MatchesGrant(d, a, intelligencePremiumSignature(app)) &&
        Number.isFinite(a.expiresAt) && a.expiresAt > Date.now() &&
        a.source === d.source && a.profile === d.profile && month === d.period &&
        app.state.mode === d.profile;
}
function mfV3Render(app, msg) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const d = msg.visualV3;
    if (!d || !mfV3Allowed(d.kind))
        return null;
    if (!mfV3Live(app, d))
        return h('section', { className: 'mf-v3-card state-stale', role: 'alert',
            'aria-label': 'Análise local desatualizada' }, h('strong', {}, 'Atualize esta consulta para visualizar os números.'), h('p', {}, 'A autorização, fonte, perfil ou período mudou ou expirou. Abra Permissões de consulta e execute novamente a pergunta.'), h('small', {}, 'Nenhum dado antigo será exibido nem alterado.'));
    const mode = mfV3Mode(app, msg), kind = d.kind, compact = mode === 'compact', analysis = mode === 'analysis';
    const cap = analysis ? 100 : compact ? 5 : 12;
    const money = mfV3Money;
    const action = (label, fn, disabled = false) => h('button', { type: 'button', className: 'mf-v3-action', disabled, onClick: fn }, label);
    const expand = () => app.setState({ mfV3AnalysisMessageId: analysis ? null : msg.id });
    const info = (text) => h('p', { className: 'mf-v3-info', role: 'status' }, text);
    const missing = (text) => h('div', { className: 'mf-v3-missing', role: 'status' }, h('strong', {}, text), info(d.reason));
    const kpi = (label, cents, tone = '') => h('div', { className: 'mf-v3-kpi ' + tone }, h('small', {}, label), h('strong', {}, money(cents)));
    const cats = d.categories;
    const choose = (name) => app.setState({ mfV3Selected: { messageId: msg.id, name } });
    const selected = ((_a = app.state.mfV3Selected) === null || _a === void 0 ? void 0 : _a.messageId) === msg.id ?
        cats.find(x => x.name === app.state.mfV3Selected.name) : null;
    const legend = h('div', { className: 'mf-v3-legend' }, ...cats.slice(0, cap).map((c, i) => action(c.name + ' · ' + money(c.amountCents), () => choose(c.name))));
    let view = null;
    if (kind === 'treemap' || kind === 'sankey') {
        view = renderMfVisual(app, { ...msg, visual: { ...d.original, kind } });
    }
    else if (kind === 'summary') {
        view = h('div', { className: 'mf-v3-stack' }, h('div', { className: 'mf-v3-kpis' }, kpi('Entradas', d.incomeCents, 'positive'), kpi('Despesas', d.expenseCents, 'negative'), kpi('Resultado do mês', d.netCents, d.netCents >= 0 ? 'positive' : 'negative')), cats.length ? legend : info('Nenhuma categoria de despesa registrada.'), action('Explorar categorias', expand));
    }
    else if (kind === 'kpi') {
        const cat = selected || cats[0];
        view = h('div', { className: 'mf-v3-highlight' }, h('span', {}, cat ? cat.name : 'Despesas efetivas'), h('strong', {}, money(cat ? cat.amountCents : d.expenseCents)), legend);
    }
    else if (kind === 'compare' || kind === 'trend' || kind === 'rank') {
        if (!d.previous || d.quality === 'partial')
            view = missing('Comparação sem cobertura verificável');
        else {
            const rows = mfV3Heat(mfV3CompareRows(d));
            const changePct = mfV3Pct(d.expenseCents, d.previous.expenseCents);
            if (kind === 'compare')
                view = h('div', { className: 'mf-v3-stack' }, h('div', { className: 'mf-v3-kpis' }, kpi(d.previous.period, d.previous.expenseCents), kpi(d.period, d.expenseCents), kpi('Diferença', mfV3Delta(d.expenseCents, d.previous.expenseCents))), info(changePct === null ?
                    'Base zero ou valores não verificáveis: percentual omitido.' :
                    'Variação ' + changePct.toFixed(1) + '%'), action('Explorar diferenças por categoria', expand), analysis ? mfV3DeltaList(app, msg, rows) : null);
            else if (kind === 'trend')
                view = h('div', { className: 'mf-v3-stack' }, info('Somente dois meses estão disponíveis: comparação factual, não tendência de longo prazo.'), h('div', { className: 'mf-v3-kpis' }, kpi(d.previous.period, d.previous.expenseCents), kpi(d.period, d.expenseCents)), mfV3DeltaList(app, msg, rows.slice(0, cap)));
            else {
                const sort = ((_b = app.state.mfV3Sort) === null || _b === void 0 ? void 0 : _b.messageId) === msg.id ? app.state.mfV3Sort.mode : 'absolute';
                const rowsUnknown = rows.filter(r => r.delta === null);
                const rowsPositive = rows.filter((r) => r.delta !== null && r.delta > 0)
                    .sort((a, b) => {
                    var _a, _b;
                    return sort === 'relative' ?
                        ((_a = b.relative) !== null && _a !== void 0 ? _a : -Infinity) - ((_b = a.relative) !== null && _b !== void 0 ? _b : -Infinity) || b.delta - a.delta : b.delta - a.delta;
                });
                const max = rowsPositive.reduce((m, r) => Math.max(m, r.delta), 1);
                view = h('div', { className: 'mf-v3-stack' }, h('div', { className: 'mf-v3-toolbar' }, action('Impacto em R$', () => app.setState({ mfV3Sort: { messageId: msg.id, mode: 'absolute' } })), action('Crescimento %', () => app.setState({ mfV3Sort: { messageId: msg.id, mode: 'relative' } }))), info('Cores de calor representam a magnitude dos aumentos de despesas, nunca saldos ou receitas.'), ...rowsPositive.slice(0, cap).map(r => mfV3Bar(r.name, money(r.delta) + ' · ' +
                    (r.relative === null ? 'base zero' : r.relative.toFixed(1) + '%'), r.delta / max * 100, r.heat, () => choose(r.name))), rowsPositive.length === 0 ? info('Nenhum aumento confirmado.') : null, rowsUnknown.length ? info(rowsUnknown.length + ' variação(ões) com valor não verificável, omitidas do ranking.') : null, rows.filter(r => r.delta !== null && r.delta <= 0).length ? h('div', { className: 'mf-v3-neutral' }, action(app.state.mfV3ShowNeutral === msg.id ? 'Ocultar sem aumento' : 'Mostrar sem aumento', () => app.setState({ mfV3ShowNeutral: app.state.mfV3ShowNeutral === msg.id ? null : msg.id })), app.state.mfV3ShowNeutral === msg.id ? rows.filter(r => r.delta !== null && r.delta <= 0).map(r => mfV3Bar(r.name, money(r.delta), 0, 'var(--muted)', () => choose(r.name))) : null) : null);
            }
        }
    }
    else if (kind === 'bar') {
        const max = Math.max(1, ...cats.map(c => c.amountCents));
        view = h('div', { className: 'mf-v3-stack' }, ...cats.slice(0, cap).map(c => mfV3Bar(c.name, money(c.amountCents), c.amountCents / max * 100, 'var(--green)', () => choose(c.name))), cats.length > cap ? info('Mostrando ' + cap + ' de ' + cats.length + ' categorias; explore a análise para ver todas.') : null);
    }
    else if (kind === 'donut') {
        if (!d.expenseCents)
            view = missing('Distribuição sem despesas confirmadas');
        else {
            let offset = 0;
            const slices = cats.map((c, i) => {
                const first = offset;
                offset += c.amountCents / d.expenseCents * 100;
                return MF_VISUAL_COLORS[i % MF_VISUAL_COLORS.length] + ' ' + first.toFixed(5) + '% ' + offset.toFixed(5) + '%';
            });
            view = h('div', { className: 'mf-v3-donut-wrap' }, h('div', { className: 'mf-v3-donut', role: 'img', 'aria-label': 'Rosca de distribuição; valores disponíveis na lista',
                style: { background: 'conic-gradient(' + slices.join(',') + ')' } }, h('span', {}, money(d.expenseCents))), legend);
        }
    }
    else if (kind === 'drilldown') {
        const current = ((_c = app.state.mfV3Drill) === null || _c === void 0 ? void 0 : _c.messageId) === msg.id ? app.state.mfV3Drill : {};
        const cat = cats.find(c => c.name === current.category) || cats[0];
        const write = (patch) => app.setState({ mfV3Drill: { messageId: msg.id, ...current, ...patch } });
        const groups = cat ? [...new Set(cat.movements.map(m => m.description))] : [];
        const rows = cat ? cat.movements.filter(m => (!current.group || m.description === current.group) &&
            (!current.search || m.description.toLowerCase().includes(String(current.search).toLowerCase())))
            .sort((a, b) => current.sort === 'amount' ? b.amountCents - a.amountCents : b.date.localeCompare(a.date)) : [];
        view = h('div', { className: 'mf-v3-stack' }, h('div', { className: 'mf-v3-crumb' }, action('Categorias', () => write({ category: null, group: null, search: '' })), current.category ? info(' / ' + current.category) : null, current.group ? info(' / ' + current.group) : null), !current.category ? cats.slice(0, cap).map(c => action(c.name + ' · ' + money(c.amountCents), () => write({ category: c.name, group: null }))) : null, current.category ? h('div', { className: 'mf-v3-stack' }, info((cat.detailsPartial ? 'Amostra parcial. ' : '') + 'Agrupamento por descrição; não atribui estabelecimento automaticamente.'), h('label', {}, 'Buscar descrição', h('input', { type: 'search', value: current.search || '',
            onChange: (e) => write({ search: e.target.value }) })), !current.group ? groups.map(g => action(g, () => write({ group: g }))) : action('Voltar aos grupos', () => write({ group: null })), h('div', { className: 'mf-v3-toolbar' }, action('Recentes', () => write({ sort: 'date' })), action('Maior valor', () => write({ sort: 'amount' }))), mfV3Table(['Data', 'Registro', 'Valor'], rows.slice(0, cap).map(r => [r.date, r.description, money(r.amountCents)]))) : null);
    }
    else if (kind === 'table' || kind === 'report') {
        const rows = mfV3Records(d);
        const query = ((_d = app.state.mfV3Search) === null || _d === void 0 ? void 0 : _d.messageId) === msg.id ? app.state.mfV3Search.value : '';
        const order = ((_e = app.state.mfV3TableOrder) === null || _e === void 0 ? void 0 : _e.messageId) === msg.id ? app.state.mfV3TableOrder.order : 'date';
        const list = rows.filter(r => (r.description + ' ' + r.category).toLowerCase().includes(String(query).toLowerCase()))
            .sort((a, b) => order === 'amount' ? b.amountCents - a.amountCents : b.date.localeCompare(a.date));
        view = h('div', { className: 'mf-v3-stack' }, h('label', {}, 'Pesquisar registros', h('input', { type: 'search', value: query,
            onChange: (e) => app.setState({ mfV3Search: { messageId: msg.id, value: e.target.value } }) })), h('div', { className: 'mf-v3-toolbar' }, action('Mais recentes', () => app.setState({ mfV3TableOrder: { messageId: msg.id, order: 'date' } })), action('Maior gasto', () => app.setState({ mfV3TableOrder: { messageId: msg.id, order: 'amount' } }))), info((mfV3RecordsPartial(d) ? 'Amostra parcial; ' : '') + 'Tabela dos registros locais verificados. Nenhum arquivo foi gerado.'), mfV3Table(['Data', 'Categoria / descrição', 'Valor'], list.slice(0, cap).map(r => [r.date, r.category + ' · ' + r.description, money(r.amountCents)])), list.length > cap ? action('Mostrar mais registros', expand) : null);
    }
    else if (kind === 'budget') {
        view = d.budgets.length ? h('div', { className: 'mf-v3-stack' }, ...d.budgets.slice(0, cap).map(b => h('div', { className: 'mf-v3-budget', key: b.category }, h('div', { className: 'mf-v3-bar-head' }, h('strong', {}, b.category), h('span', {}, money(b.spentCents) + ' / ' + money(b.limitCents))), b.limitCents > 0 ? h('div', { className: 'mf-v3-track' }, h('span', { style: { width: Math.min(100, b.spentCents / b.limitCents * 100) + '%', background: 'var(--red)' } })) : null, h('small', {}, b.limitCents === 0 ? 'Limite zero definido' + (b.spentCents ? ' · excedido em ' + money(b.spentCents) : '') :
            b.spentCents > b.limitCents ? 'Excedido em ' + money(b.spentCents - b.limitCents) :
                'Restam ' + money(b.limitCents - b.spentCents))))) : missing('Limites financeiros indisponíveis neste período');
    }
    else if (kind === 'cashflow') {
        view = h('div', { className: 'mf-v3-stack' }, h('div', { className: 'mf-v3-kpis' }, kpi('Receitas do período', d.incomeCents), kpi('Despesas do período', d.expenseCents), kpi('Resultado do período', d.netCents)), info('Resultado mensal observado, não saldo bancário, nem projeção futura.'));
    }
    else if (kind === 'insight') {
        const c = cats[0];
        view = c ? h('div', { className: 'mf-v3-stack' }, h('strong', {}, 'Maior participação: ' + c.name), h('p', {}, money(c.amountCents) + ' · ' + (100 * c.amountCents / d.expenseCents).toFixed(1) + '% das despesas locais.'), info('Concentração observada não demonstra desperdício ou causalidade.'), action('Examinar categorias', expand)) : missing('Sem despesas para identificar concentrações');
    }
    else if (kind === 'plan') {
        view = h('div', { className: 'mf-v3-stack' }, info('Etapas sugeridas para conferência, não ações realizadas.'), h('ol', {}, h('li', {}, 'Verificar lançamentos.'), h('li', {}, 'Rever limites.'), h('li', {}, 'Simular propostas no módulo próprio.')), action('Abrir Planejamento', () => app.navigate('planning')));
    }
    else if (kind === 'quality') {
        view = h('div', { className: 'mf-v3-stack' }, info('Origem ' + d.source + ' · ' + d.period + ' · cobertura ' + d.coverage +
            ' · data da leitura ' + (d.asOf || 'não informada')), info(mfV3RecordsPartial(d) ? 'Algumas categorias têm apenas uma amostra de transações.' :
            'Registros por categoria localmente conciliados; cobertura bancária integral não certificada.'));
    }
    else if (kind === 'proposal') {
        view = msg.proposal ? renderMfD01Proposal(app, msg.proposal) : missing('Nenhuma proposta autorizada nesta conversa');
    }
    else if (kind === 'whatif' || kind === 'scenario') {
        view = h('div', { className: 'mf-v3-stack' }, info('Simulações precisam do motor original com premissas, compromissos e fluxo diário. Nenhum resultado foi calculado aqui.'), action('Abrir Simular Compra', () => app.navigate('simulator')));
    }
    else if (kind === 'approval') {
        view = missing('Sem recibo durável de operação confirmada');
    }
    else if (kind === 'state') {
        view = missing(d.quality === 'ready' ? 'Consulta somente de leitura disponível' : 'Consulta indisponível ou incompleta');
    }
    else {
        view = missing('Dados financeiros verificáveis ainda não disponíveis para esta família');
    }
    const detail = selected && ['bar', 'donut', 'rank'].includes(kind) ?
        h('div', { className: 'mf-v3-selection', role: 'region', 'aria-label': 'Detalhes selecionados' }, h('strong', {}, selected.name), h('p', {}, money(selected.amountCents) + ' de ' + money(d.expenseCents) + ' em ' + d.period), kind === 'rank' && d.previous ? h('p', {}, 'Antes ' + money(((_f = d.previous.categories.find(c => c.name === selected.name)) === null || _f === void 0 ? void 0 : _f.amountCents) || 0) +
            ' · agora ' + money(selected.amountCents) + ' · variação ' +
            money(mfV3Delta(selected.amountCents, (_h = (_g = d.previous.categories.find(c => c.name === selected.name)) === null || _g === void 0 ? void 0 : _g.amountCents) !== null && _h !== void 0 ? _h : 0))) : null, h('details', {}, h('summary', {}, 'Ver movimentações' + (selected.detailsPartial ? ' · amostra parcial' : '')), mfV3Table(['Data', 'Descrição', 'Valor'], selected.movements.map(m => [m.date, m.description, money(m.amountCents)])))) : null;
    return h('section', { className: 'mf-v3-card mf-v3-' + kind + ' mf-v3-' + mode + ' state-' + d.quality, role: 'region',
        'aria-label': mfV3Title(kind) + ' · ' + d.period }, h('header', { className: 'mf-v3-head' }, h('div', {}, h('small', {}, d.period + ' · ' + (d.source === 'bank' ? 'Banco' : 'Manual')), h('h3', {}, mfV3Title(kind))), !compact ? action(analysis ? 'Recolher análise' : 'Explorar análise', expand, ['unavailable', 'expired', 'denied'].includes(d.quality)) : null), h('p', { className: 'mf-v3-evidence', role: d.quality === 'partial' ? 'status' : 'note' }, d.reason), view, detail, h('details', { className: 'mf-v3-evidence-more' }, h('summary', {}, 'Fonte e limitações'), h('p', {}, 'Origem: ' + d.source + ' · perfil ' + d.profile + ' · ' + d.period + ' · cobertura ' + d.coverage +
        ' · atualizado ' + (d.asOf || 'sem horário registrado'))));
}
function mfV3DeltaList(app, msg, rows) {
    const max = Math.max(1, ...rows.filter(r => r.delta > 0).map(r => r.delta));
    return h('div', { className: 'mf-v3-stack' }, ...rows.map(r => mfV3Bar(r.name, mfV3Money(r.delta) + (r.relative === null ? '' : ' · ' + r.relative.toFixed(1) + '%'), r.delta > 0 ? r.delta / max * 100 : 0, r.delta > 0 ? r.heat : 'var(--muted)', () => app.setState({ mfV3Selected: { messageId: msg.id, name: r.name } }))));
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
    return { kind: 'oauth_disconnected', pill: 'IA externa desconectada · leitura local requer autorização', badge: 'Sem OAuth', css: 'is-offline' };
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
function mfIC2Valid(r, access, month) {
    var _a, _b, _c, _d;
    if (!r || r.version !== 2 || r.contract !== 'I2-A/D02-V3' ||
        r.readOnly !== true || r.changesApplied !== false || r.modelCalled !== false ||
        r.source !== (access === null || access === void 0 ? void 0 : access.source) || r.profile !== (access === null || access === void 0 ? void 0 : access.profile) || r.period !== month ||
        typeof r.answer !== 'string' || r.answer.length > 4000 ||
        typeof r.conversationId !== 'string' ||
        !Array.isArray(r.facts) || r.facts.length > 4 ||
        !Array.isArray(r.blocks) || r.blocks.length > 3 ||
        !Array.isArray(r.actions) || r.actions.length !== 0 ||
        !Array.isArray(r.alerts) || !Array.isArray(r.followUps) ||
        !['ready', 'partial', 'denied', 'stale', 'unavailable', 'needs_clarification', 'unsupported'].includes(r.status))
        return false;
    const ids = new Set();
    for (const f of r.facts) {
        if ((f === null || f === void 0 ? void 0 : f.version) !== 2 || typeof f.id !== 'string' || !f.id.startsWith('i2a:') ||
            f.source !== access.source || f.profile !== access.profile ||
            ((_b = (_a = f.period) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.slice(0, 7)) !== month || ((_d = (_c = f.period) === null || _c === void 0 ? void 0 : _c.end) === null || _d === void 0 ? void 0 : _d.slice(0, 7)) !== month ||
            !f.value || typeof f.value !== 'object')
            return false;
        ids.add(f.id);
    }
    return r.blocks.every((b) => b && typeof b.kind === 'string' &&
        (b.factRef === null || ids.has(b.factRef)));
}
function mfIC2Card(r) {
    var _a, _b, _c;
    if (!['ready', 'partial'].includes(r.status) || !r.facts.length)
        return null;
    const money = (v) => Number.isSafeInteger(v) ?
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100) : 'Sem evidência';
    const metrics = [];
    const rows = [];
    let title = 'Leitura financeira verificada';
    let headers = ['Fato', 'Valor'];
    for (const fact of r.facts) {
        const f = fact.value || {};
        if (fact.tool === 'summary' || fact.tool === 'categories') {
            title = fact.tool === 'categories' ? 'Gastos na categoria' : 'Resumo financeiro do mês';
            if (Number.isSafeInteger(f.incomeCents))
                metrics.push({ label: 'Receitas', value: money(f.incomeCents) });
            if (Number.isSafeInteger(f.expenseCents))
                metrics.push({ label: 'Despesas', value: money(f.expenseCents) });
            if (fact.tool === 'categories' && Number.isSafeInteger(f.selectedCents))
                metrics.push({ label: 'Categoria selecionada', value: money(f.selectedCents) });
            for (const c of (Array.isArray(f.categories) ? f.categories : []).slice(0, 12))
                if (typeof c.name === 'string' && Number.isSafeInteger(c.amountCents))
                    rows.push({ col1: c.name.slice(0, 100), col2: money(c.amountCents) });
        }
        else if (fact.tool === 'compare_spending_breakdown') {
            title = 'Investigação das despesas';
            if (Number.isSafeInteger(f.previousCents))
                metrics.push({ label: 'Anterior', value: money(f.previousCents) });
            if (Number.isSafeInteger(f.currentCents))
                metrics.push({ label: 'Atual', value: money(f.currentCents) });
            if (Number.isSafeInteger(f.deltaCents))
                metrics.push({ label: 'Variação', value: money(f.deltaCents),
                    tone: f.deltaCents > 0 ? 'warning' : 'neutral' });
            headers = ['Categoria', 'Anterior / atual', 'Variação'];
            for (const x of (Array.isArray(f.contributions) ? f.contributions : []).slice(0, 12))
                if (typeof x.label === 'string' && Number.isSafeInteger(x.deltaCents))
                    rows.push({ col1: x.label.slice(0, 100),
                        col2: money(x.previousCents) + ' / ' + money(x.currentCents), col3: money(x.deltaCents) });
        }
        else if (fact.tool === 'compare') {
            title = 'Comparação com o mês anterior';
            if (Number.isSafeInteger(f.deltaExpenseCents))
                metrics.push({ label: 'Variação de despesas', value: money(f.deltaExpenseCents), tone: f.deltaExpenseCents > 0 ? 'warning' : 'neutral' });
            headers = ['Categoria', 'Atual / anterior', 'Variação'];
            for (const x of (Array.isArray(f.rank) ? f.rank : []).slice(0, 12))
                if (typeof x.category === 'string')
                    rows.push({ col1: x.category.slice(0, 100), col2: money(x.nowCents) + ' / ' + money(x.previousCents), col3: money(x.deltaCents) });
        }
        else if (fact.tool === 'merchants') {
            title = 'Estabelecimentos nos registros locais';
            headers = ['Estabelecimento', 'Gasto atual', 'Variação'];
            for (const m of (Array.isArray(f.merchants) ? f.merchants : []).slice(0, 12))
                if (typeof m.merchant === 'string')
                    rows.push({ col1: m.merchant.slice(0, 100), col2: money(m.amountCents), col3: money(m.deltaCents) });
        }
        else if (fact.tool === 'budgets') {
            title = 'Orçamentos registrados';
            headers = ['Categoria', 'Gasto', 'Limite'];
            for (const b of (Array.isArray(f.budgets) ? f.budgets : []).slice(0, 12))
                if (typeof b.category === 'string')
                    rows.push({ col1: b.category.slice(0, 100), col2: money(b.spentCents), col3: money(b.limitCents) });
        }
        else if (fact.tool === 'commitments') {
            title = 'Compromissos confirmados';
            if (Number.isSafeInteger((_a = f.commitments) === null || _a === void 0 ? void 0 : _a.totalCents))
                metrics.push({ label: 'Total restante planejado', value: money(f.commitments.totalCents) });
        }
        else if (fact.tool === 'simulate') {
            title = 'Simulação hipotética, sem lançamento';
            if (Number.isSafeInteger(f.hypotheticalSavingsCents))
                metrics.push({ label: 'Economia hipotética', value: money(f.hypotheticalSavingsCents) });
        }
        else if (fact.tool === 'quality') {
            title = 'Qualidade dos dados consultados';
            if (Number.isSafeInteger(f.loaded))
                metrics.push({ label: 'Registros carregados', value: String(f.loaded) });
        }
        else if (fact.tool === 'recommend_savings') {
            title = 'Oportunidades de economia (sem dupla contagem)';
            if (Number.isSafeInteger(f.targetCents))
                metrics.push({ label: 'Meta informada', value: money(f.targetCents) });
            if (Number.isSafeInteger(f.maxIndependentSavingsCents))
                metrics.push({ label: 'Espaço independente', value: money(f.maxIndependentSavingsCents), tone: f.targetVerified ? 'positive' : 'warning' });
            headers = ['Grupo / categoria', 'Gasto atual', 'Redução sugerida'];
            for (const opp of (Array.isArray(f.opportunities) ? f.opportunities : []).slice(0, 12))
                if (typeof opp.categoryLabel === 'string')
                    rows.push({ col1: opp.categoryLabel.slice(0, 100), col2: money(opp.currentCents), col3: money(opp.minSaveCents) + ' – ' + money(opp.maxSaveCents) });
        }
        else if (fact.tool === 'detect_recurring_candidates') {
            title = 'Candidatos recorrentes e hábitos';
            if (Number.isSafeInteger(f.estimatedMonthlyTotalCents))
                metrics.push({ label: 'Faixa mensal observada', value: money(f.estimatedMonthlyTotalCents) });
            if (Number.isSafeInteger(f.priceHikeCount) && f.priceHikeCount > 0)
                metrics.push({ label: 'Reajustes detectados', value: String(f.priceHikeCount), tone: 'warning' });
            headers = ['Descrição', 'Meses / certeza', 'Último valor'];
            for (const c of (Array.isArray(f.candidates) ? f.candidates : []).slice(0, 12))
                if (typeof c.merchant === 'string')
                    rows.push({ col1: c.merchant.slice(0, 100),
                        col2: (((_b = c.observedMonths) === null || _b === void 0 ? void 0 : _b.length) || 0) + ' meses · ' + (c.certainty === 'strong_candidate' ? 'forte' : 'candidato'),
                        col3: money(c.latestCents) });
        }
        else if (fact.tool === 'simulate_purchase') {
            title = 'Simulação de decisão · somente leitura';
            if (Number.isSafeInteger(f.principalCents))
                metrics.push({ label: 'Principal', value: money(f.principalCents) });
            if (Number.isSafeInteger(f.totalCents))
                metrics.push({ label: 'Total simulado', value: money(f.totalCents) });
            if (Number.isSafeInteger(f.minimumAfterPurchaseCents))
                metrics.push({ label: 'Saldo mínimo após', value: money(f.minimumAfterPurchaseCents), tone: f.risk === 'risk' ? 'warning' : 'positive' });
            headers = ['Parcela / data', 'Valor', 'Cenário'];
            for (const s of (Array.isArray(f.schedule) ? f.schedule : []).slice(0, 12))
                rows.push({ col1: String(s.date || ''), col2: money((_c = s.amountCents) !== null && _c !== void 0 ? _c : s.amount), col3: (f.installments || 1) + 'x' });
        }
    }
    const warnings = r.alerts.filter(x => typeof x === 'string').slice(0, 3).map(x => x.slice(0, 220));
    const notice = r.status === 'partial' ? 'Cobertura parcial; os valores não representam o histórico integral.' : 'Fatos calculados localmente a partir da origem autorizada.';
    return { title, subtitle: r.period + ' · ' + (r.source === 'bank' ? 'Banco' : 'Manual') +
            ' · ' + (r.profile === 'demo' ? 'Demonstração' : 'Pessoal'),
        metrics: metrics.slice(0, 4), rows: rows.slice(0, 12), headers,
        footnote: [notice, 'Resultado mensal não equivale ao saldo disponível.', ...warnings].join(' ') };
}
const MF_IC2_MESSAGE_GRANTS = new WeakMap();
function mfIC2BindMessage(msg, access, signature, month) {
    if (access === null || access === void 0 ? void 0 : access.token)
        MF_IC2_MESSAGE_GRANTS.set(msg, { access, token: access.token, signature, month });
    return msg;
}
function mfIC2MessageLive(app, msg) {
    const b = MF_IC2_MESSAGE_GRANTS.get(msg), access = app.state.localFinancialAccess;
    return !!b && b.access === access && b.token === (access === null || access === void 0 ? void 0 : access.token) &&
        b.signature === intelligencePremiumSignature(app) &&
        b.month === (app.state.localFinancialMonth || app.state.month) &&
        (access === null || access === void 0 ? void 0 : access.profile) === (app.state.mode === 'demo' ? 'demo' : 'real') &&
        Number.isFinite(access.expiresAt) && access.expiresAt > Date.now();
}
function mfIC2AdaptiveDensity(app, msg) {
    var _a, _b;
    if (((_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.mfV3AnalysisMessageId) === (msg === null || msg === void 0 ? void 0 : msg.id))
        return 'analysis';
    if ((_b = app === null || app === void 0 ? void 0 : app.state) === null || _b === void 0 ? void 0 : _b.intelligencePanelOpen)
        return 'compact';
    if (typeof window !== 'undefined' && window.innerWidth < 720)
        return 'mobile';
    return 'standard';
}
function mfIC2Money(cents) {
    return Number.isSafeInteger(cents) ?
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) : 'Sem evidência';
}
function mfIC2AdaptiveModel(r, density = 'standard') {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!r || !['ready', 'partial'].includes(r.status) || !Array.isArray(r.facts) || !r.facts.length)
        return null;
    const card = mfIC2Card(r);
    if (!card)
        return null;
    const primary = r.facts[0], val = (primary === null || primary === void 0 ? void 0 : primary.value) || {}, tool = String((primary === null || primary === void 0 ? void 0 : primary.tool) || '');
    const maxMetrics = density === 'compact' ? 2 : 4;
    const maxRows = density === 'analysis' ? 25 : density === 'compact' ? 5 : 10;
    const epistemic = r.status === 'partial' ? { tone: 'partial', label: 'Fato · cobertura parcial' } :
        tool === 'simulate_purchase' || tool === 'simulate' ? { tone: 'simulation', label: 'Simulação hipotética' } :
            tool === 'recommend_savings' ? { tone: 'estimate', label: 'Estimativa anti-dupla-contagem' } :
                tool === 'detect_recurring_candidates' ? { tone: 'estimate', label: 'Hipótese · confirmar assinatura' } :
                    { tone: 'fact', label: 'Fato verificado' };
    const visualRows = [];
    const supplementary = [];
    if (tool === 'compare_spending_breakdown') {
        const contribs = Array.isArray(val.contributions) ? val.contributions : [];
        const maxAbs = Math.max(1, ...contribs.map((c) => Math.abs(c.deltaCents || 0)));
        for (const c of contribs.slice(0, maxRows)) {
            const d = Number.isSafeInteger(c.deltaCents) ? c.deltaCents : 0;
            visualRows.push({
                label: String(c.label || 'Categoria').slice(0, 100),
                categoryId: c.categoryId || null, subcategoryId: c.subcategoryId || null,
                col2: mfIC2Money(c.previousCents) + ' / ' + mfIC2Money(c.currentCents),
                col3: (d > 0 ? '+' : '') + mfIC2Money(d),
                barPct: Math.min(100, Math.round(Math.abs(d) / maxAbs * 100)),
                barUp: d > 0
            });
        }
        if (density === 'analysis' && Array.isArray(val.merchants) && val.merchants.length) {
            supplementary.push({
                kind: 'merchants',
                title: 'Estabelecimentos normalizados no período',
                items: val.merchants.slice(0, 8).map((m) => ({
                    label: String(m.merchant || 'Não identificado').slice(0, 90),
                    col2: mfIC2Money(m.previousCents) + ' → ' + mfIC2Money(m.currentCents),
                    col3: String(m.previousCount || 0) + ' → ' + String(m.currentCount || 0) + 'x'
                }))
            });
        }
    }
    else if (tool === 'recommend_savings') {
        const opps = Array.isArray(val.opportunities) ? val.opportunities : [];
        const maxSave = Math.max(1, ...opps.map((o) => o.maxSaveCents || 0));
        for (const o of opps.slice(0, maxRows)) {
            visualRows.push({
                label: String(o.categoryLabel || 'Grupo').slice(0, 100),
                categoryId: o.categoryId || null, subcategoryId: o.subcategoryId || null,
                col2: mfIC2Money(o.currentCents),
                col3: mfIC2Money(o.minSaveCents) + ' – ' + mfIC2Money(o.maxSaveCents),
                barPct: Math.min(100, Math.round((o.maxSaveCents || 0) / maxSave * 100)),
                barUp: false,
                pill: o.independentIncluded ? 'Independente' : 'Sobreposição evitada'
            });
        }
        if (Array.isArray(val.scenarios) && val.scenarios.length) {
            supplementary.push({
                kind: 'scenarios',
                title: 'Cenários graduais (grupos independentes)',
                items: val.scenarios.slice(0, 3)
            });
        }
    }
    else if (tool === 'detect_recurring_candidates') {
        const cands = Array.isArray(val.candidates) ? val.candidates : [];
        const maxEst = Math.max(1, ...cands.map((c) => c.estimatedMonthlyCents || 0));
        for (const c of cands.slice(0, maxRows)) {
            visualRows.push({
                label: String(c.merchant || 'Recorrente').slice(0, 100),
                categoryId: c.categoryId || null, subcategoryId: c.subcategoryId || null,
                col2: (((_a = c.observedMonths) === null || _a === void 0 ? void 0 : _a.length) || 0) + ' meses · anual ' + mfIC2Money(c.estimatedAnnualMinCents) + '–' + mfIC2Money(c.estimatedAnnualMaxCents),
                col3: mfIC2Money(c.latestCents) + '/mês',
                barPct: Math.min(100, Math.round((c.estimatedMonthlyCents || 0) / maxEst * 100)),
                barUp: !!c.priceIncreased,
                pill: c.priceIncreased ? 'Reajuste +' + (mfIC2Money(c.priceDeltaCents)) : c.certainty === 'strong_candidate' ? 'Forte' : null
            });
        }
        if (Array.isArray(val.habits) && val.habits.length) {
            supplementary.push({
                kind: 'habits',
                title: 'Hábitos frequentes observados',
                items: val.habits.slice(0, 5)
            });
        }
    }
    else if (tool === 'simulate_purchase') {
        for (const r0 of (card.rows || []).slice(0, maxRows)) {
            visualRows.push({ label: r0.col1, col2: r0.col2, col3: r0.col3, barPct: null, barUp: false });
        }
        if (val.cashComparison || val.risk) {
            supplementary.push({
                kind: 'decision',
                title: 'Comparativo à vista vs parcelado e limites do fluxo',
                items: [{
                        cashTotalCents: (_c = (_b = val.cashComparison) === null || _b === void 0 ? void 0 : _b.totalCents) !== null && _c !== void 0 ? _c : val.principalCents,
                        installmentsTotalCents: val.totalCents,
                        interestCents: (_d = val.interestCents) !== null && _d !== void 0 ? _d : 0,
                        installments: (_e = val.installments) !== null && _e !== void 0 ? _e : 1,
                        minimumAfterPurchaseCents: (_f = val.minimumAfterPurchaseCents) !== null && _f !== void 0 ? _f : null,
                        worstDay: val.worstDay || null,
                        risk: val.risk || 'unknown',
                        cashflowVerified: !!val.cashflowVerified
                    }]
            });
        }
    }
    else {
        for (const r0 of (card.rows || []).slice(0, maxRows)) {
            visualRows.push({ label: r0.col1, col2: r0.col2, col3: r0.col3, barPct: null, barUp: false });
        }
    }
    const evList = Array.isArray(r.evidence) ? r.evidence : [];
    const rawIds = new Set();
    for (const ev of evList)
        if (Array.isArray(ev === null || ev === void 0 ? void 0 : ev.sourceIds))
            for (const id of ev.sourceIds)
                if (typeof id === 'string' && id)
                    rawIds.add(id);
    for (const c of (Array.isArray(val.contributions) ? val.contributions : []))
        if (Array.isArray(c === null || c === void 0 ? void 0 : c.evidenceIds))
            for (const id of c.evidenceIds)
                if (typeof id === 'string' && id)
                    rawIds.add(id);
    for (const o of (Array.isArray(val.opportunities) ? val.opportunities : []))
        if (Array.isArray(o === null || o === void 0 ? void 0 : o.evidenceIds))
            for (const id of o.evidenceIds)
                if (typeof id === 'string' && id)
                    rawIds.add(id);
    for (const c of (Array.isArray(val.candidates) ? val.candidates : []))
        if (Array.isArray(c === null || c === void 0 ? void 0 : c.evidenceIds))
            for (const id of c.evidenceIds)
                if (typeof id === 'string' && id)
                    rawIds.add(id);
    const sampleIds = [...rawIds].slice(0, 5);
    return {
        density, tool, card, epistemic,
        metrics: (card.metrics || []).slice(0, maxMetrics),
        rows: visualRows,
        supplementary: supplementary.slice(0, 2),
        blocks: (Array.isArray(r.blocks) ? r.blocks : []).slice(0, 3),
        followUps: (Array.isArray(r.followUps) ? r.followUps : []).slice(0, 3),
        evidenceSummary: {
            dataVersion: String(val.dataVersion || ((_g = evList[0]) === null || _g === void 0 ? void 0 : _g.dataVersion) || 'local').slice(0, 16),
            method: String(val.method || ((_h = evList[0]) === null || _h === void 0 ? void 0 : _h.method) || 'shared/finance-period-ledger.mjs'),
            count: rawIds.size,
            sampleIds
        }
    };
}
function renderMfIC2Adaptive(app, msg) {
    if (typeof h !== 'function')
        return null;
    const r = msg === null || msg === void 0 ? void 0 : msg.ic2Reply;
    if (!r || !mfIC2MessageLive(app, msg))
        return null;
    const density = mfIC2AdaptiveDensity(app, msg);
    const model = mfIC2AdaptiveModel(r, density);
    if (!model)
        return null;
    const expanded = density === 'analysis';
    const catGlyph = (label, categoryId, subcategoryId) => {
        if (typeof resolveCategoryVisualIdentity !== 'function' || typeof CategoryVisualGlyph !== 'function')
            return null;
        const identity = resolveCategoryVisualIdentity({ categoryId: categoryId || null, subcategoryId: subcategoryId || null, categoryName: label, aggregate: !subcategoryId });
        return h(CategoryVisualGlyph, { identity, size: density === 'compact' ? 16 : 18 });
    };
    const navAction = model.tool === 'simulate_purchase' && typeof (app === null || app === void 0 ? void 0 : app.navigate) === 'function' ?
        h('button', { type: 'button', className: 'mf-ic2-toggle-btn', onClick: () => app.navigate('simulator') }, 'Abrir Simular Compra') : null;
    return h('div', { className: 'mf-ai-structured-card mf-ic2-adaptive mf-ic2-density-' + density, role: 'region', 'aria-label': model.card.title }, h('div', { className: 'mf-ic2-adaptive-head' }, h('div', { className: 'mf-ic2-adaptive-title' }, h('strong', {}, model.card.title), model.card.subtitle ? h('small', {}, model.card.subtitle) : null), h('div', { className: 'mf-ic2-adaptive-controls' }, h('span', { className: 'mf-ic2-epistemic-badge is-' + model.epistemic.tone }, model.epistemic.label), h('button', { type: 'button', className: 'mf-ic2-toggle-btn',
        onClick: () => app.setState({ mfV3AnalysisMessageId: expanded ? null : msg.id }) }, expanded ? 'Recolher análise' : 'Explorar análise'))), model.metrics.length ? h('div', { className: 'mf-ai-structured-metrics' }, ...model.metrics.map((m, idx) => h('div', { key: idx, className: 'mf-ai-structured-metric is-' + (m.tone || 'neutral') }, h('small', {}, m.label), h('strong', {}, m.value)))) : null, model.rows.length ? h('div', { className: 'mf-ai-table-wrap' }, h('table', {}, model.card.headers ? h('thead', {}, h('tr', {}, h('th', {}, model.card.headers[0]), h('th', {}, model.card.headers[1]), model.card.headers[2] ? h('th', {}, model.card.headers[2]) : null)) : null, h('tbody', {}, ...model.rows.map((row, idx) => h('tr', { key: idx }, h('td', {}, h('span', { className: 'mf-ic2-cat-cell' }, row.categoryId || row.subcategoryId ? catGlyph(row.label, row.categoryId, row.subcategoryId) : null, h('span', {}, row.label), row.pill ? h('span', { className: 'mf-ic2-pill' + (row.barUp ? ' is-hike' : '') }, row.pill) : null)), h('td', {}, row.barPct === null ? row.col2 : h('div', { className: 'mf-ic2-bar-cell' }, h('span', {}, row.col2), h('div', { className: 'mf-ic2-bar-track', 'aria-hidden': 'true' }, h('span', { className: row.barUp ? 'is-up' : '', style: { width: Math.max(4, row.barPct) + '%' } })))), row.col3 !== undefined ? h('td', {}, row.col3) : null))))) : null, ...model.supplementary.map((blk, bIdx) => {
        if (blk.kind === 'scenarios') {
            return h('div', { key: bIdx, className: 'mf-ic2-subblock' }, h('span', { className: 'mf-ic2-subblock-title' }, blk.title), h('div', { className: 'mf-ic2-scenario-grid' }, ...blk.items.map((sc, i) => h('div', { key: i, className: 'mf-ic2-scenario-card' + (sc.goalReached ? ' is-target-met' : '') }, h('small', {}, sc.label || sc.id || 'Cenário'), h('strong', {}, mfIC2Money(sc.saveCents)), h('span', {}, sc.goalReached === true ? 'Atinge a meta' : sc.goalReached === false ? 'Abaixo da meta' : 'Redução estimada')))));
        }
        if (blk.kind === 'merchants' || blk.kind === 'habits') {
            return h('div', { key: bIdx, className: 'mf-ic2-subblock' }, h('span', { className: 'mf-ic2-subblock-title' }, blk.title), h('div', { className: 'mf-ai-table-wrap' }, h('table', {}, h('tbody', {}, ...blk.items.map((it, i) => h('tr', { key: i }, h('td', {}, String(it.label || it.merchant || 'Item')), h('td', {}, String(it.col2 || (it.monthlyCountAvg ? it.monthlyCountAvg + 'x/mês' : ''))), h('td', {}, String(it.col3 || (it.avgTicketCents !== undefined ? mfIC2Money(it.avgTicketCents) : '')))))))));
        }
        if (blk.kind === 'decision' && blk.items[0]) {
            const d = blk.items[0];
            return h('div', { key: bIdx, className: 'mf-ic2-subblock' }, h('span', { className: 'mf-ic2-subblock-title' }, blk.title), h('div', { className: 'mf-ic2-scenario-grid' }, h('div', { className: 'mf-ic2-scenario-card' }, h('small', {}, 'À vista'), h('strong', {}, mfIC2Money(d.cashTotalCents)), h('span', {}, 'Sem parcelamento')), h('div', { className: 'mf-ic2-scenario-card' }, h('small', {}, d.installments + 'x simulado'), h('strong', {}, mfIC2Money(d.installmentsTotalCents)), h('span', {}, 'Juros: ' + mfIC2Money(d.interestCents))), h('div', { className: 'mf-ic2-scenario-card' }, h('small', {}, d.cashflowVerified ? 'Menor saldo' : 'Projeção'), h('strong', {}, d.cashflowVerified ? mfIC2Money(d.minimumAfterPurchaseCents) : 'Requer planejamento'), h('span', {}, d.worstDay ? 'Data: ' + d.worstDay : 'Somente cálculo de parcelas'))), navAction);
        }
        return null;
    }), h('details', { className: 'mf-ic2-evidence-disclosure' }, h('summary', {}, 'Evidências verificadas (' + model.evidenceSummary.count + ' registros citados · versão ' + model.evidenceSummary.dataVersion + ')'), h('div', { className: 'mf-ic2-evidence-meta' }, h('span', {}, 'Motor: ' + model.evidenceSummary.method + ' · Densidade: ' + density), model.evidenceSummary.sampleIds.length ? h('span', {}, 'Amostra de IDs: ' + model.evidenceSummary.sampleIds.join(', ')) : null)), model.followUps.length && typeof intelligenceSubmitQuestion === 'function' ? h('div', { className: 'mf-ic2-followups', 'aria-label': 'Próximas investigações' }, ...model.followUps.map((fu, i) => h('button', { key: i, type: 'button', className: 'mf-ic2-followup-chip',
        onClick: () => void intelligenceSubmitQuestion(app, fu.question || fu.label) }, String(fu.label || fu.question || 'Aprofundar')))) : null, model.card.footnote ? h('small', { className: 'mf-ai-structured-foot' }, model.card.footnote) : null);
}
const MF_LOCAL_MESSAGE_GRANTS = new WeakMap();
function mfLocalBindMessage(msg, access, signature, month) {
    if (access === null || access === void 0 ? void 0 : access.token)
        MF_LOCAL_MESSAGE_GRANTS.set(msg, { access, token: access.token, signature, month });
    return msg;
}
function mfLocalMessageLive(app, msg) {
    const b = MF_LOCAL_MESSAGE_GRANTS.get(msg);
    const access = app.state.localFinancialAccess;
    return !!b && b.access === access && b.token === (access === null || access === void 0 ? void 0 : access.token) &&
        b.signature === intelligencePremiumSignature(app) &&
        b.month === (app.state.localFinancialMonth || app.state.month) &&
        msg.periodLabel === b.month &&
        (access === null || access === void 0 ? void 0 : access.profile) === (app.state.mode === 'demo' ? 'demo' : 'real') &&
        Number.isFinite(access === null || access === void 0 ? void 0 : access.expiresAt) && access.expiresAt > Date.now();
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
        app.__ic2Conversation = null;
        app.__ic2InvestigationActive = false;
        const backup = ((_b = s.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.backup) || { intelligenceThreads: s.intelligenceThreads, intelligenceMessages: s.intelligenceMessages, intelligenceActiveThreadId: s.intelligenceActiveThreadId, intelligenceHydratedMode: s.intelligenceHydratedMode };
        app.setState({ localFinancialAccess: { ...grant, backup }, localFinancialBusy: false, localFinancialRadar: null, intelligenceCopilotInsights: null, intelligenceThreads: [], intelligenceMessages: [], intelligenceActiveThreadId: null, intelligenceDraft: '', intelligencePreparedQuestion: '', workIntelligenceDemo: s.workIntelligenceDemo ? { ...s.workIntelligenceDemo, enabled: false } : undefined }, () => { void localFinancialRadar(app); if (typeof intelligencePremiumLoad === 'function')
            void intelligencePremiumLoad(app); void intelligenceCopilotInsightsLoad(app); });
    }
    catch {
        app.setState({ localFinancialBusy: false, localFinancialError: 'Não foi possível autorizar a leitura local. Nenhum dado foi consultado por esta solicitação.' });
    }
}
function localFinancialDisable(app) {
    var _a, _b;
    app.__ic2Conversation = null;
    app.__ic2InvestigationActive = false;
    app.__localRadarRequest = (app.__localRadarRequest || 0) + 1;
    app.__copilotInsightsRequest = (app.__copilotInsightsRequest || 0) + 1;
    const access = app.state.localFinancialAccess;
    app.__localReadGeneration = (app.__localReadGeneration || 0) + 1;
    app.setState({ ...access === null || access === void 0 ? void 0 : access.backup, localFinancialAccess: null, localFinancialRadar: null, intelligenceCopilotInsights: null, localFinancialBusy: false, localFinancialError: '', intelligenceDraft: '' }, () => { if (typeof intelligencePremiumLoad === 'function')
        void intelligencePremiumLoad(app); });
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
    const request = (app.__localRadarRequest || 0) + 1;
    app.__localRadarRequest = request;
    try {
        const result = await localFinancialQuery(app, { intent: 'radar' });
        if (app.__localRadarRequest !== request)
            return;
        app.setState({ localFinancialRadar: result, localFinancialError: '' });
    }
    catch (e) {
        if (app.__localRadarRequest !== request)
            return;
        app.setState({ localFinancialError: String(e.message || 'Consulta indisponível.').slice(0, 180) });
    }
}
async function localFinancialSubmit(app, question) {
    var _a, _b, _c, _d;
    if (app.state.localFinancialBusy || !String(question || '').trim())
        return;
    const access = app.state.localFinancialAccess;
    const q = String(question).trim().slice(0, 700), scope = intelligencePageScope(app), messages = [...intelligenceHistoryList(app)];
    const threadAtStart = app.state.intelligenceActiveThreadId || null;
    const api = localFinancialAPI();
    const month = app.state.localFinancialMonth || app.state.month, signature = intelligencePremiumSignature(app);
    const foldedQuestion = intelligenceFoldText(q);
    const financialInvestigation = /por que.*(despes|gast)|investig|categorias?.*contribu|estabelec.*(cresc|aument)|mostre.*estabelec|despes.*(aument|subi)|gast.*(aument|mais)|onde.*gastando|o que aumentou|compar.*(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|mes)/.test(foldedQuestion);
    const sameThread = !!((_a = app.__ic2Conversation) === null || _a === void 0 ? void 0 : _a.answerId) && messages.some((m) => m.id === app.__ic2Conversation.answerId);
    const i3Followup = sameThread && !!app.__ic2InvestigationActive &&
        /^(e |esse |essa |no |na |quanto |me mostre|mostre |onde )|recorrente|isolado|pontual/.test(foldedQuestion);
    const i3Requested = financialInvestigation || i3Followup;
    const copilotIntentRequested = i3Requested ||
        /(economiz|poupar|guardar|cortar gastos|reduzir gastos|reduzir despesas|plano de economia|meta de econom|recorrenc|assinatur|cobrancas? repetid|reajuste|habitos?|simular compra|posso comprar|comprar .* em \d+x|\b\d+\s*x\b|parcelar|proximos \d{1,2} meses)/.test(foldedQuestion);
    const v3Requested = mfV3Requested(q);
    const v3Kind = !copilotIntentRequested && typeof (api === null || api === void 0 ? void 0 : api.intelligenceOperationalAsk) === 'function' &&
        v3Requested && v3Requested !== 'proposal' && v3Requested !== 'approval' ? v3Requested : null;
    let previousOperational = null;
    const request = (app.__localChatRequest || 0) + 1;
    app.__localChatRequest = request;
    const user = { id: 'local-u-' + Date.now(), role: 'user', text: q, status: 'sent',
        createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: month };
    app.setState({ localFinancialBusy: true, intelligenceDraft: '' });
    let reply = null, operational = null, ic2 = null, error = '';
    try {
        if (!v3Kind && typeof (api === null || api === void 0 ? void 0 : api.intelligenceIC2ReadQuery) === 'function') {
            const previous = app.__ic2Conversation;
            const conversationId = (previous === null || previous === void 0 ? void 0 : previous.access) === access && (previous === null || previous === void 0 ? void 0 : previous.signature) === signature &&
                (previous === null || previous === void 0 ? void 0 : previous.answerId) && messages.some((m) => m.id === previous.answerId) ? previous.id : null;
            const density = app.state.intelligencePanelOpen ? 'compact' :
                (typeof window !== 'undefined' && window.innerWidth < 720 ? 'mobile' : 'standard');
            const safePage = ['overview', 'transactions', 'planning', 'budgets', 'assistant', 'simulator', 'banks', 'settings', 'intelligence'].includes(app.state.page) ? app.state.page : 'intelligence';
            const pageContext = { page: safePage,
                ...(app.state.txCategoryFilter && typeof app.state.txCategoryFilter === 'string' ? { category: app.state.txCategoryFilter.slice(0, 80) } : {}) };
            ic2 = await api.intelligenceIC2ReadQuery({ token: access.token,
                source: access.source, profile: access.profile, month, question: q, density, pageContext,
                ...(conversationId ? { conversationId } : {}) });
            if (!mfIC2Valid(ic2, access, month))
                throw Error('Resposta IC2 não verificada.');
        }
        else if (typeof (api === null || api === void 0 ? void 0 : api.intelligenceOperationalAsk) === 'function') {
            operational = await api.intelligenceOperationalAsk({ token: access.token, month,
                question: v3Kind ? 'Radar financeiro' : q });
            if ((operational === null || operational === void 0 ? void 0 : operational.contract) !== 'IC-v1/I-P0.2-read-only' || operational.readOnly !== true ||
                operational.changesApplied !== false || operational.modelCalled !== false)
                throw Error('Resposta operacional não verificada.');
            if (v3Kind && mfV3NeedsPrevious(v3Kind) && (operational === null || operational === void 0 ? void 0 : operational.uiState) === 'ready') {
                const priorMonth = mfVisualMonthBefore(month);
                if (priorMonth) {
                    try {
                        previousOperational = await api.intelligenceOperationalAsk({ token: access.token, month: priorMonth, question: 'Radar financeiro' });
                    }
                    catch {
                        previousOperational = null;
                    }
                }
            }
        }
        else {
            const parsed = localFinancialParse(q, app.state.categories);
            if (parsed)
                reply = await localFinancialQuery(app, parsed);
            else
                error = 'Consulta ainda não reconhecida. Comandos de escrita não são executados por esta consulta local.';
        }
    }
    catch (e) {
        error = String((e === null || e === void 0 ? void 0 : e.message) || 'Consulta local indisponível.').slice(0, 220);
    }
    if (request !== app.__localChatRequest || (app.state.intelligenceActiveThreadId || null) !== threadAtStart ||
        app.state.localFinancialAccess !== access ||
        ((_b = app.state.localFinancialAccess) === null || _b === void 0 ? void 0 : _b.token) !== (access === null || access === void 0 ? void 0 : access.token) ||
        signature !== intelligencePremiumSignature(app)) {
        if (request === app.__localChatRequest)
            app.setState({ localFinancialBusy: false });
        return;
    }
    app.__ic2InvestigationActive = !!(ic2 && ['ready', 'partial'].includes(ic2.status) &&
        ((_c = ic2.facts) === null || _c === void 0 ? void 0 : _c.some((fact) => fact.tool === 'compare_spending_breakdown')));
    if (ic2 && ['ready', 'partial', 'needs_clarification', 'unsupported'].includes(ic2.status))
        app.__ic2Conversation = { access, signature, id: ic2.conversationId };
    const state = operational === null || operational === void 0 ? void 0 : operational.uiState;
    let answerText = (ic2 === null || ic2 === void 0 ? void 0 : ic2.answer) || (operational === null || operational === void 0 ? void 0 : operational.answer) || (reply === null || reply === void 0 ? void 0 : reply.text) || error || 'Consulta indisponível.';
    const finalStatus = ic2 ?
        (['ready', 'partial'].includes(ic2.status) ? 'done' : ic2.status === 'unsupported' || ic2.status === 'needs_clarification' ? 'unsupported' :
            ic2.status === 'denied' || ic2.status === 'stale' ? 'unavailable' : 'error') : operational ?
        (state === 'ready' || state === 'empty' ? 'done' : state === 'unsupported' ? 'unsupported' : state === 'denied' || state === 'expired' ? 'unavailable' : 'error') :
        reply ? 'done' : 'error';
    const factsValid = operational && (state === 'ready' || state === 'empty');
    const evidence = ic2 && ['ready', 'partial'].includes(ic2.status) ?
        'IC2 · ' + (ic2.source === 'bank' ? 'Fonte bancária' : 'Fonte manual') + ' · ' + month + ' · leitura local' :
        factsValid ? (operational.profile === 'synthetic' ? 'Ambiente sintético' : 'Fonte ' + (operational.source === 'bank' ? 'bancária' : 'manual')) +
            ' · ' + intelligencePremiumCoverage(operational.coverage) + ' · ' + month : '';
    const visualV3 = v3Kind && factsValid ? mfV3BindGrant(mfV3FromOperational(operational, v3Kind, previousOperational), access, signature) : null;
    if (v3Kind) {
        answerText = !visualV3 ? 'Não há evidência suficiente para apresentar esta análise com segurança. Nenhum valor foi estimado.' :
            visualV3.quality === 'unavailable' ? 'Esta família visual não tem serviço financeiro operacional compatível neste momento.' :
                visualV3.quality === 'partial' ? 'Os registros são parciais ou não permitem uma comparação completa. Veja as limitações a seguir.' :
                    'Consulte a visualização calculada a partir dos registros locais autorizados.';
    }
    const visualKind = !v3Kind && factsValid ? mfVisualRequested(q) : null;
    const visual = visualKind ? mfVisualFromOperational(operational, visualKind) : null;
    const answer = {
        id: (ic2 ? 'ic2-a-' : 'local-a-') + Date.now(), role: 'assistant', text: answerText, status: finalStatus,
        createdAt: intelligenceNowTime(), scopeLabel: scope.label, periodLabel: month,
        structuredCard: ic2 ? mfIC2Card(ic2) : factsValid && operational.card ? operational.card : (reply === null || reply === void 0 ? void 0 : reply.card) || null,
        visual, visualV3,
        ic2Reply: ic2 || undefined,
        ic2FollowUps: ic2 && Array.isArray(ic2.followUps) ? ic2.followUps.slice(0, 3) : undefined,
        operationalActions: factsValid && !visualV3 && Array.isArray(operational.actions) ? operational.actions : [],
        operationalEvidence: evidence,
        details: ic2 ? 'IC2-READ-QUERY · ' + (ic2.status === 'partial' ? 'Cobertura parcial. ' : '') +
            'Fatos locais verificáveis, sem escrita financeira ou modelo externo.' : v3Kind && !visualV3 ? 'Os fatos autorizados não permitem esta visualização; nenhuma informação foi estimada.' :
            visualKind && !visual ? 'Não há evidências suficientes para desenhar o gráfico com totais reconciliados. Confira fonte e cobertura.' :
                factsValid ? 'Consulta local determinística, sem IA externa. Não foi executada qualquer alteração.' :
                    reply ? JSON.stringify(reply.references) : 'Nenhuma alteração financeira nem envio externo.'
    };
    if (ic2) {
        mfIC2BindMessage(answer, access, signature, month);
        if (((_d = app.__ic2Conversation) === null || _d === void 0 ? void 0 : _d.id) === ic2.conversationId)
            app.__ic2Conversation.answerId = answer.id;
    }
    else
        mfLocalBindMessage(answer, access, signature, month);
    intelligenceSyncThreadMessages(app, [...messages, user, answer], scope);
    app.setState({ localFinancialBusy: false }, () => {
        if (typeof document !== 'undefined') {
            const scroll = () => {
                for (const el of Array.from(document.querySelectorAll('.mf-b05-chat-thread, .mf-ai-drawer-body')))
                    el.scrollTop = el.scrollHeight;
            };
            if (typeof requestAnimationFrame === 'function')
                requestAnimationFrame(scroll);
            else
                scroll();
        }
    });
}
function renderLocalFinancialAccess(app) {
    const s = app.state, access = s.localFinancialAccess, active = (access === null || access === void 0 ? void 0 : access.token) && access.expiresAt > Date.now();
    if (s.categoryReviewGrant)
        return h('section', { className: 'mf-ai-explainer' }, h('div', {}, h('strong', {}, 'Revisão sintética autorizada · conversa temporária'), h('p', {}, 'Mensagens e prévias ficam apenas nesta sessão. Regras e decisões confirmadas são auditadas no SQLite de teste.'), h('button', { type: 'button', className: 'ghost-button', onClick: () => categoryReviewDisable(app) }, 'Encerrar revisão e limpar respostas da sessão')));
    return h('section', { className: 'mf-ai-explainer mf-ai-local-access', 'aria-label': 'Permissão de leitura financeira local' }, h('div', {}, h('strong', {}, active ? 'Leitura local autorizada · sem IA externa' : 'Consultar seus registros locais'), h('p', {}, 'Ao autorizar, movimentos e limites da fonte escolhida serão lidos neste computador. Respostas ficam apenas na memória desta sessão. Consultas usam o mês e a fonte abaixo, sem herdar filtros da tabela.'), access ? h('p', {}, 'Fonte: ' + access.source + ' · perfil ' + access.profile + ' · autorização por até 15 minutos.') : null, h('div', { className: 'mf-ai-access-fields' }, !access ? h('label', { className: 'mf-ai-access-field' }, 'Fonte', h('select', { value: s.mode === 'demo' ? 'manual' : s.localFinancialSource || 'bank', disabled: s.mode === 'demo', onChange: (e) => app.setState({ localFinancialSource: e.target.value }) }, h('option', { value: 'bank' }, 'Contas conectadas'), h('option', { value: 'manual' }, 'Lançamentos manuais'))) : null, h('label', { className: 'mf-ai-access-field' }, 'Mês da consulta', h('input', { type: 'month', value: s.localFinancialMonth || s.month, onChange: (e) => app.setState({ localFinancialMonth: e.target.value, localFinancialRadar: null, intelligenceCopilotInsights: null }, () => { if (typeof intelligencePremiumLoad === 'function')
            void intelligencePremiumLoad(app); void intelligenceCopilotInsightsLoad(app); }) })), !access && s.mode !== 'demo' ? h('label', { className: 'mf-ai-access-planning' }, h('input', { type: 'checkbox', checked: s.localFinancialPlanning === true, onChange: (e) => app.setState({ localFinancialPlanning: e.target.checked }) }), h('span', {}, 'Permitir também leitura do Planejamento')) : null), h('div', { className: 'mf-ai-proposal-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: s.localFinancialBusy, onClick: () => active ? (void localFinancialRadar(app), void intelligencePremiumLoad(app), void intelligenceCopilotInsightsLoad(app)) : void localFinancialEnable(app) }, active ? 'Atualizar radar' : 'Autorizar leitura local'), access ? h('button', { type: 'button', className: 'ghost-button', onClick: () => localFinancialDisable(app) }, 'Encerrar leitura e limpar respostas da sessão') : null), s.localFinancialError ? h('p', { role: 'alert' }, s.localFinancialError) : null));
}
function renderLocalFinancialRadar(app) {
    const report = app.state.localFinancialRadar;
    return h('div', { className: 'mf-ai-today' }, h('h2', {}, 'O que seus registros mostram hoje'), report ? renderIntelligenceStructuredCard(report.card) : h('p', { role: 'status' }, 'Atualize o radar para consultar o mês escolhido.'), h('div', { className: 'mf-ai-starter-grid' }, ...['Quanto gastei com alimentação neste mês?', 'Quais foram minhas maiores despesas?', 'Quais categorias ultrapassaram o orçamento?', 'Quanto tenho comprometido para o próximo mês?', 'Quais despesas aumentaram?', 'Que movimentações preciso revisar?', 'Quanto gastei em assinaturas?', 'Quais dados faltam para avaliar uma compra?'].map(q => h('button', { type: 'button', className: 'mf-ai-context-prompt', key: q, onClick: () => { app.setState({ intelligenceTab: 'chat', intelligenceMainMode: 'chat' }); void localFinancialSubmit(app, q); } }, q))));
}
const MF_COPILOT_INSIGHTS_GRANTS = new WeakMap();
function mfCopilotInsightsLive(app) {
    var _a;
    const env = (_a = app === null || app === void 0 ? void 0 : app.state) === null || _a === void 0 ? void 0 : _a.intelligenceCopilotInsights;
    if (!env || env.contract !== 'MF2-PROACTIVE-V1')
        return null;
    const b = MF_COPILOT_INSIGHTS_GRANTS.get(env);
    const access = app.state.localFinancialAccess;
    const month = app.state.localFinancialMonth || app.state.month;
    return !!b && b.access === access && b.token === (access === null || access === void 0 ? void 0 : access.token) &&
        b.signature === intelligencePremiumSignature(app) && b.month === month &&
        (access === null || access === void 0 ? void 0 : access.profile) === (app.state.mode === 'demo' ? 'demo' : 'real') &&
        Number.isFinite(access === null || access === void 0 ? void 0 : access.expiresAt) && access.expiresAt > Date.now() ? env : null;
}
async function intelligenceCopilotInsightsLoad(app) {
    var _a;
    const api = localFinancialAPI();
    const s = app === null || app === void 0 ? void 0 : app.state, access = s === null || s === void 0 ? void 0 : s.localFinancialAccess;
    const request = (app.__copilotInsightsRequest || 0) + 1;
    app.__copilotInsightsRequest = request;
    if (!(access === null || access === void 0 ? void 0 : access.token) || access.expiresAt <= Date.now() || typeof (api === null || api === void 0 ? void 0 : api.intelligenceCopilotInsights) !== 'function') {
        if (s)
            app.setState({ intelligenceCopilotInsights: null });
        return;
    }
    const month = s.localFinancialMonth || s.month, signature = intelligencePremiumSignature(app);
    try {
        const env = await api.intelligenceCopilotInsights({ token: access.token, source: access.source, profile: access.profile, month });
        if (request !== app.__copilotInsightsRequest || app.state.localFinancialAccess !== access ||
            ((_a = app.state.localFinancialAccess) === null || _a === void 0 ? void 0 : _a.token) !== access.token ||
            signature !== intelligencePremiumSignature(app))
            return;
        if ((env === null || env === void 0 ? void 0 : env.contract) !== 'MF2-PROACTIVE-V1' || env.readOnly !== true || env.changesApplied !== false)
            return;
        MF_COPILOT_INSIGHTS_GRANTS.set(env, { access, token: access.token, signature, month });
        app.setState({ intelligenceCopilotInsights: env });
    }
    catch {
        if (request === app.__copilotInsightsRequest)
            app.setState({ intelligenceCopilotInsights: null });
    }
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
    const filters = { ...app.state.categoryReviewFilters }, revision = app.state.categoryReviewFilterRevision || 0;
    const request = (app.categoryReviewRequest || 0) + 1;
    app.categoryReviewRequest = request;
    const api = categoryReviewAPI();
    const [report, queue] = await Promise.all([api.categoryReviewList({ token: grant.token }), api.categoryReviewQueue({ token: grant.token, after, limit: 50, filters })]);
    if (((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) !== grant.token || app.categoryReviewRequest !== request || (app.state.categoryReviewFilterRevision || 0) !== revision)
        return;
    app.setState({ categoryReviewReport: report, categoryReviewQueue: queue, categoryReviewCursor: after, categoryReviewFiltersDirty: false, categoryReviewSelected: [], categoryReviewPreview: null, categoryReviewConfirmed: false });
}
function categoryReviewSetFilter(app, name, value) {
    app.setState({ categoryReviewFilters: { ...app.state.categoryReviewFilters, [name]: value }, categoryReviewFilterRevision: (app.state.categoryReviewFilterRevision || 0) + 1, categoryReviewFiltersDirty: true, categoryReviewQueue: null, categoryReviewSelected: [], categoryReviewPreview: null, categoryReviewConfirmed: false, categoryReviewDetail: null });
}
function categoryReviewTab(app, index) { app.setState({ categoryReviewTab: index, categoryReviewDetail: null }, () => categoryReviewJump('mf-review-section-' + index)); }
function categoryReviewJump(id) {
    const section = document.getElementById(id);
    if ((section === null || section === void 0 ? void 0 : section.tagName) === 'DETAILS')
        section.open = true;
    section === null || section === void 0 ? void 0 : section.scrollIntoView({ block: 'start' });
    section === null || section === void 0 ? void 0 : section.focus({ preventScroll: true });
}
async function categoryReviewHistory(app, rule) {
    app.setState({ categoryReviewFilters: { accountId: rule.accountId, pattern: rule.pattern }, categoryReviewFilterRevision: (app.state.categoryReviewFilterRevision || 0) + 1, categoryReviewQueue: null, categoryReviewSelected: [], categoryReviewPreview: null });
    await categoryReviewRun(app, async () => { await categoryReviewRefresh(app); categoryReviewTab(app, 1); });
}
async function categoryReviewOpen(app) {
    app.setState({ page: 'intelligence', intelligencePanelOpen: false, intelligenceTab: 'actions', categoryReviewOpen: true }, () => { var _a; return (_a = document.scrollingElement) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0, behavior: 'instant' }); });
    await categoryReviewRun(app, async () => {
        var _a, _b;
        const status = await ((_b = (_a = categoryReviewAPI()) === null || _a === void 0 ? void 0 : _a.categoryReviewStatus) === null || _b === void 0 ? void 0 : _b.call(_a));
        app.setState({ categoryReviewAvailable: (status === null || status === void 0 ? void 0 : status.available) === true });
        if (app.state.categoryReviewGrant && (!app.state.categoryReviewReport ||
            !app.state.categoryReviewQueue || app.state.categoryReviewFiltersDirty))
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
        app.setState({ categoryReviewGrant: grant, categoryReviewBackup: backup,
            categoryReviewReport: null, categoryReviewQueue: null, categoryReviewPreview: null,
            categoryReviewConfirmed: false, categoryReviewReceipt: null, categoryReviewSelected: [], categoryReviewDetail: null,
            categoryReviewFilters: {}, categoryReviewFilterRevision: (app.state.categoryReviewFilterRevision || 0) + 1,
            mfD04Drafts: {}, mfD04Excluded: {}, mfD04Selected: null, mfD04Error: '', mfD04Stage: 'pending', mfD04Search: '',
            intelligenceThreads: [], intelligenceMessages: [], intelligenceActiveThreadId: null });
        await categoryReviewRefresh(app);
    });
}
function categoryReviewDisable(app) {
    var _a;
    const grant = app.state.categoryReviewGrant;
    app.categoryReviewRequest = (app.categoryReviewRequest || 0) + 1;
    app.setState({ ...app.state.categoryReviewBackup, categoryReviewGrant: null, categoryReviewBackup: null,
        categoryReviewReport: null, categoryReviewQueue: null, categoryReviewPreview: null, categoryReviewSelected: [],
        categoryReviewConfirmed: false, categoryReviewReceipt: null, categoryReviewDetail: null,
        categoryReviewFilters: {}, categoryReviewFilterRevision: (app.state.categoryReviewFilterRevision || 0) + 1,
        mfD04Drafts: {}, mfD04Excluded: {}, mfD04Selected: null, mfD04Error: '', mfD04Stage: 'pending', mfD04Search: '',
        categoryReviewOpen: false, categoryReviewError: '', categoryReviewBusy: false });
    if (grant)
        void ((_a = categoryReviewAPI()) === null || _a === void 0 ? void 0 : _a.categoryReviewRevoke({ token: grant.token }).catch(() => { }));
}
async function categoryReviewPrepare(app, action, payload) {
    const revision = app.state.categoryReviewFilterRevision || 0;
    await categoryReviewRun(app, async () => {
        var _a;
        const grant = app.state.categoryReviewGrant;
        const preview = await categoryReviewAPI().categoryReviewPrepare({ token: grant.token, action, payload });
        if (((_a = app.state.categoryReviewGrant) === null || _a === void 0 ? void 0 : _a.token) === grant.token && (app.state.categoryReviewFilterRevision || 0) === revision)
            app.setState({ categoryReviewPreview: preview, categoryReviewConfirmed: false, categoryReviewReceipt: null }, () => { var _a; return (_a = document.querySelector('.mf-review-preview')) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ block: 'start' }); });
    });
}
async function categoryReviewConfirm(app) {
    const p = app.state.categoryReviewPreview, g = app.state.categoryReviewGrant;
    if (!p || !g || !Number.isFinite(g.expiresAt) || g.expiresAt <= Date.now() || !app.state.categoryReviewConfirmed)
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
    var _a, _b, _c, _d;
    const p = app.state.categoryReviewPreview;
    if (!p)
        return null;
    return h('section', { className: 'mf-review-preview', 'aria-label': 'Prévia da ação supervisionada' }, h('span', { className: 'micro-label' }, 'PRÉVIA · NENHUMA ALTERAÇÃO EXECUTADA'), h('h3', {}, p.title), h('p', {}, p.summary), h('div', { className: 'mf-review-impact' }, h('strong', {}, ((_c = (_a = p.affectedTotal) !== null && _a !== void 0 ? _a : (_b = p.affected) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) + ' movimentações'), h('span', {}, new Set((p.affected || []).map((r) => r.accountId)).size + ' conta(s) no histórico'), h('span', {}, p.rule ? 'Regra com alcance explícito' : 'Somente os registros desta prévia')), p.rule ? h('dl', { className: 'mf-review-rule-details' }, ...Object.entries({ Padrão: p.rule.pattern, Correspondência: 'Descrição exata', ...(p.rule.previousCategory ? { 'Categoria anterior': p.rule.previousCategory } : {}), Categoria: p.rule.category, Conta: p.rule.accountName, Natureza: p.rule.nature === 'expense' ? 'Saída' : 'Entrada', Prioridade: p.rule.priority }).map(([k, v]) => h('div', { key: k }, h('dt', {}, k), h('dd', {}, String(v))))) : null, p.historicalEligible != null ? h('p', {}, p.historicalEligible + (p.historicalPartial ? '+' : '') + ' registro(s) anteriores elegíveis. Aplicar ao histórico exige outra seleção e outra confirmação.') : null, ((_d = p.affected) === null || _d === void 0 ? void 0 : _d.length) ? h('div', { className: 'mf-review-table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Movimentação', 'Valor', 'Antes', 'Depois'].map(t => h('th', { key: t }, t)))), h('tbody', {}, ...p.affected.map((r) => h('tr', { key: categoryReviewKey(r) }, h('td', {}, r.description || r.externalId, h('small', {}, r.accountName || r.accountId)), h('td', {}, r.amount != null ? fmt(Math.abs(r.amount)) : '—'), h('td', {}, r.category || '—'), h('td', {}, r.newCategory || '—')))))) : null, p.totalCents != null ? h('p', {}, 'Total absoluto da seleção: ' + fmt(p.totalCents)) : null, p.partial ? h('p', {}, 'Prévia limitada aos primeiros 100 registros de ' + p.affectedTotal + '.') : null, h('label', { className: 'mf-review-confirm' }, h('input', { type: 'checkbox', checked: !!app.state.categoryReviewConfirmed, disabled: app.state.categoryReviewBusy, onChange: (e) => app.setState({ categoryReviewConfirmed: e.target.checked }) }), 'Conferi esta prévia e autorizo somente esta ação nos dados sintéticos.'), h('div', { className: 'mf-review-actions' }, h('button', { type: 'button', className: 'primary-button', disabled: !app.state.categoryReviewConfirmed || app.state.categoryReviewBusy || p.expiresAt <= Date.now(), onClick: () => void categoryReviewConfirm(app) }, 'Confirmar esta ação'), h('button', { type: 'button', className: 'ghost-button', disabled: app.state.categoryReviewBusy, onClick: () => app.setState({ categoryReviewPreview: null, categoryReviewConfirmed: false }) }, 'Cancelar sem aplicar')));
}
function renderCategoryReviewRow(app, r, selected, button) {
    const reasons = { generic_category: 'Categoria genérica', not_reviewed: 'Ainda não revisada', inconsistent_pattern: 'Classificações divergentes', split_individual_review: 'Possui divisão', outdated_classification: 'Classificação desatualizada após importação' };
    return h('tr', { key: categoryReviewKey(r) }, h('td', {}, h('input', { type: 'checkbox', 'aria-label': 'Selecionar ' + r.description + ' ' + r.externalId,
        disabled: app.state.categoryReviewBusy || !r.batchEligible, checked: selected.some(x => categoryReviewKey(x) === categoryReviewKey(r)),
        onChange: (e) => app.setState({ categoryReviewSelected: e.target.checked ? [...selected, r].slice(0, 100) : selected.filter(x => categoryReviewKey(x) !== categoryReviewKey(r)) }) })), h('td', {}, r.description, h('small', {}, r.date + ' · ' + r.accountName + ' · ' + r.status)), h('td', {}, h('strong', {}, r.category), h('small', {}, r.suggestedCategory ? 'Sugestão: ' + r.suggestedCategory : 'Sem sugestão automática'), h('span', { className: 'mf-review-confidence is-' + r.confidence }, categoryReviewConfidence(r.confidence)), h('small', {}, r.reasons.map(v => reasons[v]).join(' · '))), h('td', {}, fmt(Math.abs(r.amount))), h('td', {}, button('Detalhes', () => app.setState({ categoryReviewDetail: r })), button('Revisar individualmente', () => void categoryReviewPrepare(app, 'classify', { items: [r], category: app.state.categoryReviewCategory || r.suggestedCategory || 'Alimentação' }), r.manual || r.hasSplits || r.status !== 'POSTED'), button('Marcar como revisada', () => void categoryReviewPrepare(app, 'reviewed', { items: [r] }))));
}
function renderCategoryReviewLegacy(app) {
    var _a, _b, _c;
    const s = app.state, g = s.categoryReviewGrant, report = s.categoryReviewReport, queue = s.categoryReviewQueue, busy = !!s.categoryReviewBusy, selected = s.categoryReviewSelected || [], filters = s.categoryReviewFilters || {};
    const button = (label, action, disabled = false) => h('button', { type: 'button', className: 'ghost-button', disabled: busy || disabled, onClick: action }, label);
    const categorySelect = (value, onChange, label = 'Categoria') => h('select', { 'aria-label': label, value, disabled: busy, onChange: (e) => onChange(e.target.value) }, ...((report === null || report === void 0 ? void 0 : report.categories) || []).map((c) => h('option', { key: c.name, value: c.name }, c.name)));
    const setFilter = (name, value) => categoryReviewSetFilter(app, name, value);
    const visibleRows = ((queue === null || queue === void 0 ? void 0 : queue.rows) || []).filter((r) => (r.description + ' ' + r.accountName + ' ' + r.category).toLocaleLowerCase().includes((s.categoryReviewSearch || '').toLocaleLowerCase()));
    const pageEligible = visibleRows.filter((r) => r.batchEligible), tab = (_a = s.categoryReviewTab) !== null && _a !== void 0 ? _a : 1, detail = s.categoryReviewDetail;
    const paging = () => h('div', { className: 'mf-review-actions mf-review-pagination' }, button('Primeira página', () => void categoryReviewRun(app, () => categoryReviewRefresh(app)), !s.categoryReviewCursor || s.categoryReviewFiltersDirty), button('Próxima página', () => void categoryReviewRun(app, () => categoryReviewRefresh(app, queue.nextCursor)), (queue === null || queue === void 0 ? void 0 : queue.nextCursor) == null || s.categoryReviewFiltersDirty), h('small', {}, queue ? queue.rows.length + ' registros nesta página · ' + queue.coverage : 'Até 50 registros por página.'));
    return h('section', { className: 'mf-review', 'aria-label': 'Central de revisão inteligente' }, h('header', { className: 'mf-review-header' }, h('div', {}, h('span', { className: 'micro-label' }, 'INTELIGÊNCIA · DECISÕES LOCAIS'), h('h2', {}, 'Central de revisão'), h('p', {}, 'Entenda o padrão. Confira a seleção. Decida o que pode mudar.')), g ? h('div', { className: 'mf-review-actions' }, button('Conversar', () => app.setState({ categoryReviewOpen: false, intelligenceTab: 'chat' })), button('Encerrar revisão', () => categoryReviewDisable(app))) : button('Voltar', () => app.setState({ categoryReviewOpen: false }))), h('p', { className: 'mf-review-safety' }, 'Homologação com dados sintéticos. Escrita da Inteligência permanece desativada no perfil pessoal.'), !g ? h('div', { className: 'mf-review-empty' }, h('h3', {}, s.categoryReviewAvailable === false ? 'Aguardando homologação' : 'Começar uma revisão supervisionada'), h('p', {}, s.categoryReviewAvailable === false ? 'Este perfil não permite escrita pela Inteligência. O fluxo pode ser testado na candidata Electron com perfil sintético validado.' : 'Autorize a leitura do perfil de teste para encontrar padrões e preparar ações. Cada gravação terá uma prévia e confirmação separadas.'), s.categoryReviewAvailable ? h('button', { type: 'button', className: 'primary-button', disabled: busy, onClick: () => void categoryReviewEnable(app) }, 'Autorizar revisão dos dados sintéticos') : null) : null, s.categoryReviewError ? h('p', { role: 'alert', className: 'mf-ai-error' }, s.categoryReviewError) : null, busy ? h('p', { role: 'status' }, 'Conferindo os registros e as permissões…') : null, g && report ? h('div', { className: 'mf-review-content' }, h('div', { className: 'mf-review-summary' }, h('div', {}, h('strong', {}, String(report.suggestionsTotal)), h('span', {}, 'regras sugeridas')), h('div', {}, h('strong', {}, String(report.scanned)), h('span', {}, 'registros locais analisados')), h('div', {}, h('strong', {}, String(report.rules.filter((r) => r.enabled).length)), h('span', {}, 'regras ativas')), button('Atualizar análise', () => void categoryReviewRun(app, () => categoryReviewRefresh(app)))), h('nav', { className: 'mf-review-sections', 'aria-label': 'Seções da revisão', role: 'tablist' }, ...['Sugestões', 'Movimentações', 'Regras', 'Decisões'].map((label, i) => { var _a; return h('button', { type: 'button', role: 'tab', 'aria-selected': tab === i, 'aria-controls': 'mf-review-section-' + i, disabled: busy, onClick: () => categoryReviewTab(app, i) }, label, h('small', {}, String([report.suggestionsTotal, ((_a = queue === null || queue === void 0 ? void 0 : queue.rows) === null || _a === void 0 ? void 0 : _a.length) || 0, report.rules.length, report.audit.length][i]))); })), report.suggestionsPartial ? h('p', {}, 'Exibindo 100 de ' + report.suggestionsTotal + ' sugestões.') : null, renderCategoryReviewPreview(app), s.categoryReviewReceipt ? h('div', { className: 'mf-review-receipt', role: 'status' }, h('strong', {}, 'Ação persistida e auditada.'), h('p', {}, 'Comprovante: ' + s.categoryReviewReceipt.id), ((_b = s.categoryReviewReceipt.backup) === null || _b === void 0 ? void 0 : _b.verified) ? h('small', {}, 'Cópia de segurança verificada antes desta ação.') : null, s.categoryReviewReceipt.action === 'rule' ? h('div', {}, h('p', {}, 'Regra criada para as próximas importações. Deseja aplicar também aos lançamentos anteriores compatíveis?'), button('Revisar histórico compatível', () => void categoryReviewHistory(app, s.categoryReviewReceipt.rule)), button('Agora não', () => app.setState({ categoryReviewReceipt: null }))) : null) : null, h('section', { id: 'mf-review-section-0', hidden: tab !== 0, tabIndex: -1, 'aria-label': 'Sugestões de regras' }, h('h3', {}, 'Padrões que podem reduzir seu trabalho'), !report.suggestions.length ? h('p', { className: 'mf-review-empty' }, 'Nenhum padrão novo com evidência manual nesta análise.') : null, ...report.suggestions.map((r) => {
        var _a;
        return h('article', { key: r.id, className: 'mf-review-suggestion' }, h('div', { className: 'mf-review-suggestion-head' }, h('h4', {}, r.name), h('span', { className: 'mf-review-confidence is-' + r.confidence }, 'Confiança ' + categoryReviewConfidence(r.confidence) + (r.state === 'deferred' ? ' · adiada' : ''))), h('p', {}, r.reason), h('p', {}, r.accountName + ' · ' + (r.nature === 'expense' ? 'Saídas' : 'Entradas') + ' · descrição exata · ' + r.compatible + ' compatíveis'), r.conflicts.length ? h('p', { className: 'mf-ai-error' }, 'Divergências: ' + r.conflicts.join(' · ')) : null, h('ul', {}, ...r.examples.map((e) => h('li', { key: categoryReviewKey(e) }, e.date + ' · ' + e.description + ' · ' + fmt(Math.abs(e.amount)) + ' · ' + e.category))), h('div', { className: 'mf-review-actions' }, categorySelect(((_a = s.categoryReviewEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category, v => app.setState({ categoryReviewEdits: { ...s.categoryReviewEdits, [r.id]: v } }), 'Editar categoria da sugestão ' + r.pattern), button('Aceitar / simular regra', () => { var _a; return void categoryReviewPrepare(app, 'rule', { suggestionId: r.id, category: ((_a = s.categoryReviewEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category }); }), button('Negar', () => void categoryReviewPrepare(app, 'decision', { suggestionId: r.id, state: 'denied' })), button('Adiar', () => void categoryReviewPrepare(app, 'decision', { suggestionId: r.id, state: 'deferred' }))));
    })), h('section', { id: 'mf-review-section-1', hidden: tab !== 1, tabIndex: -1, 'aria-label': 'Movimentações para revisar' }, h('h3', {}, 'Sua fila de revisão'), h('p', {}, 'Selecione registros ou abra os detalhes para conferir a evidência. Nenhuma categoria muda sem prévia e confirmação.'), h('label', { className: 'mf-review-search' }, 'Buscar nesta página', h('input', { type: 'search', value: s.categoryReviewSearch || '', placeholder: 'Descrição, conta ou categoria', onChange: (e) => app.setState({ categoryReviewSearch: e.target.value, categoryReviewSelected: [], categoryReviewDetail: null }) })), h('div', { className: 'mf-review-filters' }, h('label', {}, 'Conta', h('select', { value: filters.accountId || '', onChange: (e) => setFilter('accountId', e.target.value) }, h('option', { value: '' }, 'Todas as contas'), ...report.accounts.map((a) => h('option', { key: a.id, value: a.id }, a.name)))), h('label', {}, 'De', h('input', { type: 'date', value: filters.start || '', onChange: (e) => setFilter('start', e.target.value) })), h('label', {}, 'Até', h('input', { type: 'date', value: filters.end || '', onChange: (e) => setFilter('end', e.target.value) })), h('label', {}, 'Confiança', h('select', { value: filters.confidence || '', onChange: (e) => setFilter('confidence', e.target.value) }, ...['', 'high', 'medium', 'low', 'none'].map(v => h('option', { key: v, value: v }, v ? categoryReviewConfidence(v) : 'Todas')))), button('Aplicar filtros', () => void categoryReviewRun(app, () => categoryReviewRefresh(app))), filters.pattern ? button('Limpar padrão', () => app.setState({ categoryReviewFilters: { ...filters, pattern: '' } }, () => void categoryReviewRun(app, () => categoryReviewRefresh(app)))) : null), s.categoryReviewFiltersDirty ? h('p', { className: 'mf-review-filter-notice', role: 'status' }, 'Filtros alterados. Aplique-os para carregar e selecionar os registros da nova consulta.') : null, paging(), h('div', { className: 'mf-review-actions mf-review-selection' }, h('span', { role: 'status' }, selected.length + ' selecionado(s)'), button('Selecionar elegíveis desta página', () => app.setState({ categoryReviewSelected: pageEligible }), !pageEligible.length || s.categoryReviewFiltersDirty), categorySelect(s.categoryReviewCategory || 'Alimentação', v => app.setState({ categoryReviewCategory: v }), 'Categoria da seleção'), h('button', { type: 'button', className: 'primary-button', disabled: busy || !selected.length || s.categoryReviewFiltersDirty, onClick: () => void categoryReviewPrepare(app, 'classify', { items: selected, category: s.categoryReviewCategory || 'Alimentação' }) }, 'Preparar classificação da seleção'), button('Limpar seleção', () => app.setState({ categoryReviewSelected: [] }))), queue ? h('small', {}, pageEligible.length + ' elegíveis nesta página. Classificações manuais, divisões, baixa confiança e registros bancários ainda não confirmados ficam fora da seleção em lote.') : null, detail ? h('aside', { className: 'mf-review-inspector', 'aria-label': 'Detalhes da movimentação' }, h('div', {}, h('span', { className: 'micro-label' }, 'INSPEÇÃO · SEM ALTERAÇÃO'), h('h3', {}, detail.description), h('p', {}, detail.date + ' · ' + detail.accountName), h('strong', {}, fmt(Math.abs(detail.amount)))), h('div', {}, h('p', {}, 'Atual: ' + detail.category + ' · Sugestão: ' + (detail.suggestedCategory || 'sem evidência suficiente')), h('p', {}, 'Confiança ' + categoryReviewConfidence(detail.confidence) + ' · ' + detail.status), categorySelect(s.categoryReviewCategory || detail.suggestedCategory || 'Alimentação', v => app.setState({ categoryReviewCategory: v }), 'Categoria para revisar este registro'), button('Preparar revisão deste registro', () => void categoryReviewPrepare(app, 'classify', { items: [detail], category: s.categoryReviewCategory || detail.suggestedCategory || 'Alimentação' }), detail.manual || detail.hasSplits || detail.status !== 'POSTED'), button('Fechar detalhes', () => app.setState({ categoryReviewDetail: null })))) : null, queue ? h('div', { className: 'mf-review-table-wrap', tabIndex: 0, role: 'region', 'aria-label': 'Registros da página para revisar' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Selecionar', 'Movimentação', 'Categoria / evidência', 'Valor', 'Revisão'].map(t => h('th', { key: t, scope: 'col' }, t)))), h('tbody', {}, ...visibleRows.map((r) => renderCategoryReviewRow(app, r, selected, button))))) : null, !s.categoryReviewFiltersDirty && !((_c = queue === null || queue === void 0 ? void 0 : queue.rows) === null || _c === void 0 ? void 0 : _c.length) ? h('p', { className: 'mf-review-empty' }, 'Nenhum registro para estes filtros.') : null), h('section', { id: 'mf-review-section-2', hidden: tab !== 2, tabIndex: -1, 'aria-label': 'Gestão de regras' }, h('h3', {}, 'Regras ativas e pausadas'), !report.rules.length ? h('p', { className: 'mf-review-empty' }, 'Nenhuma regra criada. Aceite uma sugestão após conferir sua prévia.') : null, ...report.rules.map((r) => { var _a; return h('div', { className: 'mf-review-managed', key: r.id }, h('strong', {}, r.pattern + ' → ' + r.category), h('small', {}, (r.enabled ? 'Ativa' : 'Pausada') + ' · prioridade ' + r.priority + (r.constraint ? ' · conta específica · importações futuras' : ' · regra existente')), r.constraint ? h('div', { className: 'mf-review-actions' }, categorySelect(((_a = s.categoryReviewRuleEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category, v => app.setState({ categoryReviewRuleEdits: { ...s.categoryReviewRuleEdits, [r.id]: v } }), 'Categoria da regra ' + r.id), button('Simular edição', () => { var _a; return void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: 'edit', category: ((_a = s.categoryReviewRuleEdits) === null || _a === void 0 ? void 0 : _a[r.id]) || r.category }); }), button(r.enabled ? 'Pausar' : 'Reativar', () => void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: r.enabled ? 'pause' : 'resume' })), button('Excluir com prévia', () => void categoryReviewPrepare(app, 'manage-rule', { ruleId: r.id, change: 'delete' }))) : h('small', {}, 'Editar em Configurações de categorias.')); })), h('details', { id: 'mf-review-section-3', hidden: tab !== 3, tabIndex: -1 }, h('summary', {}, 'Decisões e auditoria local'), ...report.audit.map((a) => h('div', { className: 'mf-review-audit', key: a.id }, h('span', {}, ({ rule: 'Regra criada', classify: 'Classificação', reviewed: 'Revisão', decision: 'Decisão', undo: 'Reversão', forget: 'Preferências apagadas', 'manage-rule': 'Regra atualizada' }[a.action] || 'Ação') + ' · ' + new Date(a.appliedAt).toLocaleString('pt-BR') + ' · ' + ({ available: 'Pode desfazer', undone: 'Desfeita', not_applicable: 'Registrada' }[a.undoState] || 'Registrada')), a.undoState === 'available' ? button('Preparar desfazer', () => void categoryReviewPrepare(app, 'undo', { commandId: a.id })) : null)), h('p', {}, report.decisions.length + ' decisão(ões) recente(s): ' + report.decisions.map((d) => ({ denied: 'negada', deferred: 'adiada', accepted: 'aceita', edited: 'editada' }[d.state])).join(', ')), button('Apagar preferências de sugestões', () => void categoryReviewPrepare(app, 'forget', {})))) : null);
}
function renderCategoryReview(app) {
    return mfD04Render(app);
}
