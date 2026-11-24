'use strict';
// M3 — Supervised Action Interpreter (read-only proposal builder for S1..S5).
// Never mutates SQLite, never executes dynamic SQL, never infers unverified data.
const { D05CategoryService } = require('./d05-category-service.cjs');
const { normalizedName } = require('./d05-hierarchy.cjs');
const {
  parseMoneyToCents,
  parseSalaryBudgetCommand,
  buildSalaryBudgetProposal
} = require('./copilot-salary-budget.cjs');
const { parseBrlCents } = require('./intelligence-savings.cjs');

const MONTH_RX = /^20\d\d-(0[1-9]|1[0-2])$/;

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const safeText = (s, max = 140) =>
  String(s || '')
    .replace(/[\x00-\x1f\x7f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const FUTURE_RULE_RX =
  /(?:\s*(?:,|;|e)\s*(?:crie|criar|fa[çc]a|gere|salve|adicione)\s+(?:uma?\s+)?regra\s+(?:para|nas|nos|as|os)\s+pr[óo]xim[ao]s?(?:\s+movimenta[çc][õo]es|\s+compras|\s+lan[çc]amentos)?|\s*(?:,|;|e)\s*(?:crie|criar|salve)\s+(?:uma?\s+)?regra.*)$/i;

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function validIsoDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDay);
  const dt = new Date(Date.UTC(y, m - 1, clampedDay));
  return dt.toISOString().slice(0, 10);
}

function parsePlanningDueDate(question, scopeMonth) {
  const q = String(question || '');
  const isoMatch = /\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.exec(q);
  if (isoMatch) {
    const out = validIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (out) return out;
  }
  const brMatch = /\b([0-3]?\d)\/([01]?\d)(?:\/(20\d\d))?\b/.exec(q);
  if (brMatch) {
    const baseYear = Number(scopeMonth.slice(0, 4));
    const out = validIsoDate(brMatch[3] ? Number(brMatch[3]) : baseYear, Number(brMatch[2]), Number(brMatch[1]));
    if (out) return out;
  }
  const f = fold(q);
  const nextMonth = /\b(proximo mes|mes que vem)\b/.test(f);
  const dayMatch = /\bdia\s+(\d{1,2})\b/.exec(f);
  const targetMonth = nextMonth ? shiftMonth(scopeMonth, 1) : scopeMonth;
  const [y, m] = targetMonth.split('-').map(Number);
  if (dayMatch) {
    return validIsoDate(y, m, Number(dayMatch[1]));
  }
  if (nextMonth) {
    return validIsoDate(y, m, 5);
  }
  if (/\beste mes|nesse mes|mes atual\b/.test(f)) {
    return validIsoDate(y, m, 15);
  }
  // Default to targetMonth day 10 when user omits explicit date for planning item
  return validIsoDate(y, m, 10);
}

function resolveD05Target(rawTarget, catalogParents) {
  const cleaned = String(rawTarget || '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();
  if (!cleaned) return { ok: false, reason: 'missing_target' };
  const parts = cleaned
    .split(/\s*(?:>|›|\/|->)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const rawParent = parts[0] || '';
  const rawChild = parts[1] || '';
  const foldedParent = fold(rawParent);

  const parentMatches = (catalogParents || []).filter(
    (p) => fold(p.name) === foldedParent || (foldedParent.length >= 4 && fold(p.name).includes(foldedParent))
  );
  if (parentMatches.length === 0) {
    // Allow matching directly by unambiguous subcategory name when user omitted parent.
    if (!rawChild) {
      const childHits = [];
      for (const p of catalogParents || []) {
        for (const c of p.subcategories || []) {
          if (fold(c.name) === foldedParent) childHits.push({ parent: p, child: c });
        }
      }
      if (childHits.length === 1) {
        return {
          ok: true,
          parent: childHits[0].parent,
          child: childHits[0].child,
          target: { categoryId: childHits[0].parent.id, subcategoryId: childHits[0].child.id },
          targetLabel: `${childHits[0].parent.name} › ${childHits[0].child.name}`
        };
      }
    }
    return { ok: false, reason: 'unknown_parent', rawParent };
  }
  if (parentMatches.length > 1) {
    const exact = parentMatches.find((p) => fold(p.name) === foldedParent);
    if (!exact) return { ok: false, reason: 'ambiguous_parent', candidates: parentMatches.map((p) => p.name) };
    parentMatches.splice(0, parentMatches.length, exact);
  }
  const parent = parentMatches[0];
  if (!rawChild) {
    return {
      ok: true,
      parent,
      child: null,
      target: { categoryId: parent.id, subcategoryId: null },
      targetLabel: parent.name
    };
  }
  const foldedChild = fold(rawChild);
  const childMatches = (parent.subcategories || []).filter(
    (c) => fold(c.name) === foldedChild || (foldedChild.length >= 3 && fold(c.name).includes(foldedChild))
  );
  if (childMatches.length === 0) {
    return {
      ok: false,
      reason: 'unknown_subcategory',
      parentName: parent.name,
      rawChild,
      availableChildren: (parent.subcategories || []).map((c) => c.name)
    };
  }
  const exactChild = childMatches.find((c) => fold(c.name) === foldedChild);
  if (childMatches.length > 1 && !exactChild) {
    return {
      ok: false,
      reason: 'ambiguous_subcategory',
      parentName: parent.name,
      candidates: childMatches.map((c) => c.name)
    };
  }
  const child = exactChild || childMatches[0];
  return {
    ok: true,
    parent,
    child,
    target: { categoryId: parent.id, subcategoryId: child.id },
    targetLabel: `${parent.name} › ${child.name}`
  };
}

function parseCategorizeCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;

  const hasFutureRule = FUTURE_RULE_RX.test(raw);
  const withoutRule = raw.replace(FUTURE_RULE_RX, '').trim();

  // Do not shadow "Sempre que aparecer X, coloque em Y" (that is a rule command, handled by S3).
  if (/^(?:sempre que|toda vez que)\b/i.test(withoutRule)) return null;

  const m =
    /^(?:por favor,?\s*)?(?:coloque|coloquem|categoriz(?:e|ar)|recategoriz(?:e|ar)|classifiqu(?:e|ar)|reclassifiqu(?:e|ar)|mova|mover|alter(?:e|ar)\s+(?:a\s+)?categoria|mud(?:e|ar)\s+(?:a\s+)?categoria)\s+(.+?)\s+(?:em|como|para)\s+(.+?)[.?!]*$/i.exec(
      withoutRule
    );
  if (!m) return null;

  let subject = m[1].trim();
  const targetRaw = m[2].trim();

  const anaphoraOnly =
    /^(?:todas?\s+as\s+|todos?\s+os\s+)?(?:essas?|esses?|estas?|estes?|elas|eles)(?:\s+(?:movimenta[çc][õo]es|transa[çc][õo]es|compras?|gastos?|despesas?|lan[çc]amentos?|registros?))?$/i.test(
      subject
    );
  if (anaphoraOnly) {
    return {
      anaphoric: true,
      merchantQuery: null,
      targetRaw: safeText(targetRaw.replace(/\s*(?:->|>|›)\s*/g, ' › '), 120),
      originFilter: 'all',
      futureRuleRequested: hasFutureRule
    };
  }

  let originFilter = 'all';
  if (/\b(?:lan[çc]amento(?:s)?\s+manua(?:l|is)|manualmente|no\s+manual)\b/i.test(subject)) {
    originFilter = 'manual';
    subject = subject.replace(
      /\b(?:no(?:s)?\s+lan[çc]amento(?:s)?\s+manua(?:l|is)|lan[çc]amento(?:s)?\s+manua(?:l|is)|manualmente|no\s+manual)\b/gi,
      ' '
    );
  } else if (/\b(?:do\s+banco|no\s+banco|banc[áa]ri[ao]s?|conta\s+banc[áa]ria)\b/i.test(subject)) {
    originFilter = 'bank';
    subject = subject.replace(/\b(?:do\s+banco|no\s+banco|banc[áa]ri[ao]s?|na\s+conta\s+banc[áa]ria)\b/gi, ' ');
  }

  subject = subject
    .replace(
      /^(?:(?:(?:todas?\s+as|todos?\s+os|a|o|as|os|minha|meu|minhas|meus|esses?|essas?)\s+)?(?:(?:compras?|despesas?|gastos?|lan[çc]amentos?|movimenta[çc][õo]es|transa[çc][õo]es|pagamentos?|registros?)\s+)?(?:(?:d[aeo]s?|no|na|nos|nas|em|com|sobre|para)\s+)?)?/i,
      ''
    )
    .replace(/^(?:d[aeo]\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:d[aeo]s?\s+)?/i, '')
    .replace(/\b(?:feita|feito|realizada|realizado)?\s*(?:de\s+)?(?:hoje|ontem|anteontem)\s*$/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!subject || subject.length < 2) return null;
  const normalizedTarget = targetRaw.replace(/\s*(?:->|>|›)\s*/g, ' › ');
  return {
    anaphoric: false,
    merchantQuery: safeText(subject, 120),
    targetRaw: safeText(normalizedTarget, 120),
    originFilter,
    futureRuleRequested: hasFutureRule
  };
}

function parseRuleCreateCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;

  // "Sempre que aparecer iFood, coloque em Alimentação > Delivery"
  let m =
    /^(?:por favor,?\s*)?(?:sempre que|toda vez que)\s+(?:aparecer|vier|houver|tiver|surgir|encontrar)?\s*(?:["'“”]?([^,"']+?)["'“”]?)?\s*,?\s*(?:coloque|colocar|categoriz(?:e|ar)|classifiqu(?:e|ar)|mova|mover|jogue|va para)\s+(?:(?:ela|ele|isso|a compra|o gasto|os gastos)?\s*)?(?:em|como|para)\s+(.+?)[.?!]*$/i.exec(
      raw
    );
  if (m && m[1] && m[2]) {
    const pattern = safeText(m[1].replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''), 120);
    const targetRaw = safeText(m[2].replace(/\s*(?:->|>|›)\s*/g, ' › '), 120);
    if (pattern.length >= 2 && targetRaw) {
      return { intent: 'rule_create', pattern, targetRaw, matchMode: 'contains' };
    }
  }

  // "Crie uma regra para iFood ir para Alimentação > Delivery" / "Regra para Uber em Transporte"
  m =
    /^(?:por favor,?\s*)?(?:(?:crie|criar|salve|salvar|fa[çc]a|fazer|adicione|adicionar)\s+(?:uma?\s+)?)?regra(?:\s+futura|\s+autom[áa]tica)?\s+(?:para|quando\s+(?:aparecer|vier))\s+(?:["'“”]?(.+?)["'“”]?)\s+(?:(?:ir|v[áa]|ser\s+classificad[ao])\s+(?:para|como|em)|em|como|para|->)\s+(.+?)[.?!]*$/i.exec(
      raw
    );
  if (m && m[1] && m[2]) {
    const pattern = safeText(
      m[1]
        .replace(/^(?:o\s+estabelecimento|a\s+descri[çc][ãa]o|lan[çc]amentos\s+d[aeo]s?)\s+/i, '')
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''),
      120
    );
    const targetRaw = safeText(m[2].replace(/\s*(?:->|>|›)\s*/g, ' › '), 120);
    if (pattern.length >= 2 && targetRaw) {
      return { intent: 'rule_create', pattern, targetRaw, matchMode: 'contains' };
    }
  }

  // Rule toggle: "Desative a regra do iFood" / "Ative a regra Uber"
  m =
    /^(?:por favor,?\s*)?(desativ\w*|paus\w*|desabilit\w*|ativ\w*|reabilit\w*|habilit\w*)\s+(?:a\s+)?regra\s+(?:d[aeo]s?\s+|para\s+)?(.+?)[.?!]*$/i.exec(
      raw
    );
  if (m && m[2]) {
    const enabled = !/^des|^paus/i.test(fold(m[1]));
    const query = safeText(m[2].replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''), 120);
    if (query.length >= 2) {
      return { intent: 'rule_toggle', query, enabled };
    }
  }
  return null;
}

function parseCategoryStructureCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;

  // "Crie a subcategoria Delivery em Alimentação"
  let m =
    /^(?:por favor,?\s*)?(?:crie|criar|adicione|adicionar|inclua|incluir|nova)\s+(?:a\s+)?subcategoria\s+["'“”]?(.+?)["'“”]?\s+(?:em|na\s+categoria|dentro\s+de|no\s+grupo|sob)\s+["'“”]?(.+?)["'“”]?[.?!]*$/i.exec(
      raw
    );
  if (m) {
    return {
      intent: 'subcategory_create',
      name: safeText(m[1], 80),
      parentRaw: safeText(m[2], 70)
    };
  }

  // "Renomeie a subcategoria Delivery em Alimentação para Entregas" or "Renomeie a subcategoria Delivery para Entregas"
  m =
    /^(?:por favor,?\s*)?(?:renomei\w*|mud\w*\s+o\s+nome\s+d[aeo]?|alter\w*\s+o\s+nome\s+d[aeo]?)\s+(?:a\s+)?subcategoria\s+["'“”]?(.+?)["'“”]?(?:\s+(?:em|de|na\s+categoria)\s+["'“”]?(.+?)["'“”]?)?\s+(?:para|como)\s+["'“”]?(.+?)["'“”]?[.?!]*$/i.exec(
      raw
    );
  if (m) {
    return {
      intent: 'subcategory_rename',
      currentName: safeText(m[1], 80),
      parentRaw: m[2] ? safeText(m[2], 70) : null,
      newName: safeText(m[3], 80)
    };
  }

  // "Renomeie a categoria Pets para Animais"
  m =
    /^(?:por favor,?\s*)?(?:renomei\w*|mud\w*\s+o\s+nome\s+d[aeo]?|alter\w*\s+o\s+nome\s+d[aeo]?)\s+(?:a\s+)?categoria\s+["'“”]?(.+?)["'“”]?\s+(?:para|como)\s+["'“”]?(.+?)["'“”]?[.?!]*$/i.exec(
      raw
    );
  if (m) {
    return {
      intent: 'category_rename',
      currentName: safeText(m[1], 70),
      newName: safeText(m[2], 70)
    };
  }

  // "Crie a categoria Pets" / "Crie a categoria Viagens de despesa"
  m =
    /^(?:por favor,?\s*)?(?:crie|criar|adicione|adicionar|nova)\s+(?:a\s+)?categoria\s+["'“”]?(.+?)["'“”]?[.?!]*$/i.exec(
      raw
    );
  if (m) {
    let body = m[1].trim();
    let kind = 'expense';
    if (/\s+de\s+receitas?\s*$/i.test(body)) {
      kind = 'income';
      body = body.replace(/\s+de\s+receitas?\s*$/i, '').trim();
    } else if (/\s+de\s+despesas?\s*$/i.test(body)) {
      kind = 'expense';
      body = body.replace(/\s+de\s+despesas?\s*$/i, '').trim();
    } else if (/\s+(?:mista|de\s+ambos)\s*$/i.test(body)) {
      kind = 'both';
      body = body.replace(/\s+(?:mista|de\s+ambos)\s*$/i, '').trim();
    }
    if (body) {
      return { intent: 'category_create', name: safeText(body, 70), kind };
    }
  }
  return null;
}

function parseSingleBudgetCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;
  const f = fold(raw);

  // "Deixe meu limite de lazer em R$ 250." / "Ajuste o orçamento de alimentação para R$ 900."
  const m =
    /^(?:por favor,?\s*)?(?:deixe|defin\w*|ajust\w*|mud\w*|alter\w*|coloque|fique\s+com)\s+(?:o\s+|meu\s+)?(?:limite|or[çc]amento|teto)\s+(?:d[aeo]s?\s+|em\s+|para\s+)?(.+?)\s+(?:em|para|a|=)\s+(r\$\s*(?:\d+(?:[.,]\d+)?\s*mil|\d+(?:[.,]\d+)*)|(?:\d+(?:[.,]\d+)?\s*mil|\d+(?:[.,]\d+)*)(?:\s*reais)?)(.*)$/i.exec(
      raw
    );
  if (!m) return null;
  if (/\b(?:salario|renda|reorganiz)\b/.test(f)) return null;
  const categoryRaw = safeText(m[1], 70);
  const amountCents = parseMoneyToCents(m[2], { allowZero: true });
  if (!categoryRaw || amountCents === null) return null;
  const tail = fold(m[3] || '');
  const applyRecurring = /\b(?:recorrente|todos os meses|proximos meses|fixo todo mes)\b/.test(tail);
  return {
    intent: 'budget_single_edit',
    categoryRaw,
    amountCents,
    applyRecurring
  };
}

function parsePlanningCommand(question) {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;
  const f = fold(raw);

  // S5 F4 -> Planning anaphora: "Adicione ao planejamento a compra parcelada que acabamos de simular"
  if (
    /\b(?:planejamento|agenda(?:r|mente)?|compromisso)\b/.test(f) &&
    /\b(?:simul\w*|acabamos de|essa compra|a compra parcelada)\b/.test(f) &&
    !/r\$|\d{1,3}(?:[.,]\d{3})*/.test(f)
  ) {
    return { intent: 'planning_from_simulation' };
  }

  // Planning status/cancel: "Cancele o compromisso previsto Academia" / "Marque Academia como paga manualmente"
  let m =
    /^(?:por favor,?\s*)?(cancel\w*|reativ\w*)\s+(?:o\s+|a\s+)?(?:compromisso|despesa prevista|receita prevista|conta prevista|lan[çc]amento planejado|planejamento)\s+["'“”]?(.+?)["'“”]?[.?!]*$/i.exec(
      raw
    );
  if (m && m[2]) {
    return {
      intent: 'planning_status',
      query: safeText(m[2], 120),
      status: /^cancel/i.test(fold(m[1])) ? 'cancelled' : 'planned'
    };
  }

  // Planning update: "Altere o vencimento do Condomínio para dia 10." / "Mude o valor de Internet prevista para R$ 120."
  m =
    /^(?:por favor,?\s*)?(?:alter\w*|mud\w*|atualiz\w*|ajust\w*|remarqu\w*)\s+(?:o\s+|a\s+)?(vencimento|data|valor)\s+(?:d[aeo]s?\s+|no\s+|na\s+)?(.+?)\s+(?:para|em)\s+(.+?)[.?!]*$/i.exec(
      raw
    );
  if (m) {
    const field = fold(m[1]) === 'valor' ? 'amount' : 'dueDate';
    const query = safeText(m[2].replace(/\bprevist[ao]\b/gi, '').trim(), 120);
    const valueRaw = m[3].trim();
    return {
      intent: 'planning_update',
      field,
      query,
      valueRaw
    };
  }

  // Planning create:
  // "Registre uma despesa prevista de R$ 135 para esportes no próximo mês."
  // "Adicione uma conta prevista de R$ 450 de Condomínio para dia 10."
  const isPlanVerb = /\b(?:registr\w*|adicion\w*|crie|criar|agend\w*|planej\w*|lan[çc]\w*|coloque|inclu\w*)\b/.test(f);
  const isPlanNoun = /\b(?:despesa prevista|receita prevista|conta prevista|compromisso|parcela prevista|planejamento|previst[ao])\b/.test(f);
  if (isPlanVerb && isPlanNoun) {
    const amountCents = parseBrlCents(raw) ?? parseMoneyToCents(raw);
    if (!amountCents || amountCents <= 0) return null;
    const kind = /\b(?:receita|entrada|receber|faturamento)\b/.test(f) ? 'income' : 'expense';
    const instMatch = /\b(\d{1,2})\s*(?:x\b|vezes|parcelas?)/i.exec(f);
    let mode = 'once';
    let count = 1;
    if (instMatch) {
      count = Number(instMatch[1]);
      if (count >= 2 && count <= 36) mode = 'installments';
    } else if (/\b(?:todo mes|mensal|recorrente)\b/.test(f)) {
      mode = 'monthly';
      count = 12;
    }

    // Extract title/topic around "para X" / "de X" excluding amount and date words
    let topic = '';
    const paraMatch =
      /(?:\b(?:para|com\s+descri[çc][ãa]o|de\s+nome|t[íi]tulo)\s+)(?!dia\b|o\s+pr[óo]ximo|pr[óo]ximo\s+m[êe]s|\d{1,2}\/\d{1,2}|20\d\d-)([a-zA-ZÀ-ÿ0-9\s\-]{2,80}?)(?=\s+(?:no\s+pr[óo]ximo|em\s+\d|para\s+(?:o\s+)?pr[óo]ximo|dia\s+\d|em\s+20\d\d|na\s+categoria|[.,?!]|$))/i.exec(
        raw
      );
    if (paraMatch && paraMatch[1]) {
      topic = paraMatch[1].trim();
    } else {
      // Try noun after amount: "de R$ 450 de Condomínio para dia 10"
      const afterVal =
        /(?:r\$\s*\d[\d.,]*(?:\s*mil)?)\s+(?:d[aeo]\s+|para\s+)([a-zA-ZÀ-ÿ0-9\s\-]{2,70}?)(?=\s+(?:para\s+dia|dia\s+\d|em\s+\d|no\s+pr[óo]ximo|[.,?!]|$))/i.exec(
          raw
        );
      if (afterVal && afterVal[1]) topic = afterVal[1].trim();
    }
    topic = safeText(topic.replace(/^(?:o|a|os|as|um|uma)\s+/i, ''), 120);
    if (!topic) topic = kind === 'income' ? 'Receita prevista' : 'Despesa prevista';
    const explicitCatMatch = /\bna categoria\s+["'“”]?([^.,?!]+)["'“”]?/i.exec(raw);

    return {
      intent: 'planning_create',
      kind,
      amountCents,
      mode,
      count,
      title: topic.charAt(0).toUpperCase() + topic.slice(1),
      explicitCategory: explicitCatMatch ? safeText(explicitCatMatch[1], 70) : null
    };
  }
  return null;
}

function parseSalaryRefinementCommand(question, activeSalaryDraft) {
  if (!activeSalaryDraft || activeSalaryDraft.contract !== 'MF3/SALARY-BUDGET-PROPOSAL-V1' || activeSalaryDraft.status !== 'ready') {
    return null;
  }
  const raw = String(question || '').trim();
  if (!raw || raw.length > 700) return null;
  const f = fold(raw);

  // Do not hijack a fresh full salary command
  if (/\bmeu salario\b.*\be\s*r\$/i.test(f) && /\breorganiz/i.test(f)) return null;

  const deltaMoney = parseBrlCents(raw) ?? parseMoneyToCents(raw);

  // Budget transfer between categories inside active salary draft:
  // "Transfira R$ 200 de Lazer para Alimentação" / "Passe 150 de Compras para Educação"
  if (/\b(?:transf\w*|pass\w*|mova|mover|realoqu\w*|desloqu\w*)\b/.test(f)) {
    const items = Array.isArray(activeSalaryDraft.items) ? activeSalaryDraft.items : [];
    const transferRx = /\bde\s+["'“”]?([^,"']+?)["'“”]?\s+para\s+["'“”]?([^.,?!;"']+?)["'“”]?[.?!]*$/i.exec(raw);
    const matchesCat = (hint) => {
      const hf = fold(hint);
      if (!hf) return null;
      return (
        items.find((it) => fold(it.category) === hf) ||
        items.find((it) => hf.length >= 3 && (fold(it.category).includes(hf) || hf.includes(fold(it.category)))) ||
        null
      );
    };
    let donor = transferRx ? matchesCat(transferRx[1]) : null;
    let recipient = transferRx ? matchesCat(transferRx[2]) : null;
    if (!donor || !recipient) {
      const ordered = items
        .map((it) => ({ it, idx: f.indexOf(fold(it.category)) }))
        .filter((x) => x.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      if (!donor && ordered.length >= 2) donor = ordered[0].it;
      if (!recipient && ordered.length >= 2) recipient = ordered[1].it;
    }
    if (!deltaMoney || deltaMoney <= 0 || !donor || !recipient || donor.category === recipient.category) {
      return { kind: 'clarify_transfer', missingAmount: !deltaMoney || deltaMoney <= 0 };
    }
    return {
      kind: 'transfer_category',
      fromCategory: donor.category,
      toCategory: recipient.category,
      amountCents: deltaMoney
    };
  }

  // Check reserve adjustment: "Gostei, mas quero guardar R$ 200 a mais." / "Aumente a reserva em R$ 300"
  if (
    deltaMoney !== null &&
    (/\b(gostei|mas quero|quero guardar|aument\w*.*reserva|poup\w*.*mais|reserv\w*.*mais)\b/.test(f) ||
      /\b(guardar|poupar|reservar|reserva)\b.*\b(a mais|mais)\b/.test(f))
  ) {
    const baseReserve = Number.isSafeInteger(activeSalaryDraft.requestedReserveCents)
      ? activeSalaryDraft.requestedReserveCents
      : activeSalaryDraft.proposedReserveCents || 0;
    const isRelative = /\b(a mais|mais|aument\w*|som\w*|acrescent\w*)\b/.test(f);
    const isMinus = /\b(a menos|reduz\w*.*reserva|dimin\w*.*reserva|tir\w*.*reserva)\b/.test(f);
    const nextReserveGoalCents = isMinus
      ? Math.max(0, baseReserve - deltaMoney)
      : isRelative
        ? baseReserve + deltaMoney
        : deltaMoney;
    return {
      kind: 'adjust_reserve',
      nextReserveGoalCents,
      deltaCents: isMinus ? -deltaMoney : isRelative ? deltaMoney : nextReserveGoalCents - baseReserve
    };
  }

  // Protect without reduction ("Não reduza Moradia", "Não corte Transporte")
  if (/\bn[ãa]o\s+(?:reduz\w*|cort\w*|diminu\w*|mex\w*)\b/i.test(raw)) {
    const items = Array.isArray(activeSalaryDraft.items) ? activeSalaryDraft.items : [];
    const hit = items.find((it) => f.includes(fold(it.category)));
    if (hit) {
      return {
        kind: 'protect_category',
        category: hit.category,
        targetCents: Math.max(hit.proposedLimitCents || 0, hit.currentLimitCents || 0, hit.committedFloorCents || 0)
      };
    }
    return { kind: 'missing_category_for_lock' };
  }

  // Check category lock/unlock: "Trave Moradia e recalcule." / "Destrave Moradia"
  if (/\b(?:trave|travar|fixe|fixar|mantenha|preserv\w*|destrave|destravar|desbloque\w*)\b/.test(f)) {
    const items = Array.isArray(activeSalaryDraft.items) ? activeSalaryDraft.items : [];
    const hit = items.find((it) => f.includes(fold(it.category)));
    if (hit) {
      const unlock = /\b(?:destrav\w*|desbloque\w*|solt\w*)\b/.test(f);
      return {
        kind: unlock ? 'unlock_category' : 'lock_category',
        category: hit.category,
        targetCents: hit.proposedLimitCents
      };
    }
    return { kind: 'missing_category_for_lock' };
  }

  // Check single category tweak inside active salary draft:
  // "Reduza mais R$ 100 em Alimentação." / "Aumente R$ 150 em Transporte" / "Deixe Lazer em R$ 300"
  if (deltaMoney !== null && /\b(?:reduz\w*|cort\w*|diminu\w*|aument\w*|sub\w*|deix\w*|recalcul\w*|ajust\w*)\b/.test(f)) {
    const items = Array.isArray(activeSalaryDraft.items) ? activeSalaryDraft.items : [];
    const hit = items.find((it) => f.includes(fold(it.category)));
    if (hit) {
      const isCut = /\b(?:reduz\w*|cort\w*|diminu\w*|tir\w*)\b/.test(f);
      const isAdd = /\b(?:aument\w*|sub\w*|som\w*|acrescent\w*)\b/.test(f);
      const currentVal = hit.proposedLimitCents || 0;
      const targetCents = isCut
        ? Math.max(0, currentVal - deltaMoney)
        : isAdd
          ? currentVal + deltaMoney
          : deltaMoney;
      return {
        kind: 'adjust_category',
        category: hit.category,
        targetCents,
        previousCents: currentVal
      };
    }
  }

  return null;
}

function collectLockedMapFromDraft(draft) {
  const locked = {};
  for (const it of draft?.items || []) {
    if (it?.isLocked && Number.isSafeInteger(it.proposedLimitCents)) {
      locked[it.category] = it.proposedLimitCents;
    }
  }
  return locked;
}

function buildRuleSaveDraft({ db, scope, cmd, targetRes }) {
  if (scope.profile !== 'real' || scope.source !== 'bank') {
    return {
      matched: true,
      contract: 'MF3/RULE-DRAFT-V1',
      intent: 'rule_create',
      action: 'rule.save',
      status: 'needs_clarification',
      effort: 'medium',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      pattern: cmd.pattern,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      answer:
        'Regras automáticas pessoais valem apenas para **movimentações bancárias futuras**. Autorize a fonte **"Contas conectadas"** no perfil pessoal para preparar esta regra.',
      warnings: []
    };
  }

  const sql = db.db;
  const overview = db.bankOverview();
  const accounts = (overview.accounts || []).map((a) => ({ id: a.id, name: safeText(a.name, 80) }));
  if (!accounts.length) {
    return {
      matched: true,
      contract: 'MF3/RULE-DRAFT-V1',
      intent: 'rule_create',
      action: 'rule.save',
      status: 'unavailable',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      pattern: cmd.pattern,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      answer: 'Nenhuma conta bancária conectada foi encontrada para vincular a regra.',
      warnings: []
    };
  }

  const maxRow = sql.prepare('SELECT COALESCE(MAX(rowid), 0) AS maxRowid FROM bank_transactions').get();
  const afterRowid = Number.isInteger(maxRow?.maxRowid) ? maxRow.maxRowid : 0;
  const patternFold = fold(cmd.pattern);
  const sampleMatches = (overview.transactions || [])
    .filter((t) => fold(t.customTitle || t.description || '').includes(patternFold))
    .slice(0, 10)
    .map((t) => ({
      accountId: t.accountId,
      accountName: accounts.find((a) => a.id === t.accountId)?.name || t.accountId,
      externalId: t.id,
      date: t.date,
      description: safeText(t.customTitle || t.description, 100),
      amountCents: Math.abs(t.amount || 0),
      kind: (t.nature === 'income' || (t.nature !== 'expense' && t.amount > 0)) ? 'income' : 'expense',
      currentCategory: t.category || 'Outros'
    }));

  const nature =
    targetRes.parent.kind === 'income'
      ? 'income'
      : targetRes.parent.kind === 'expense'
        ? 'expense'
        : sampleMatches[0]?.kind || 'expense';

  const rules = db.listCategories().rules || [];
  const conflicts = rules
    .filter((r) => {
      const rp = fold(r.pattern);
      return rp === patternFold || rp.includes(patternFold) || patternFold.includes(rp);
    })
    .map((r) => ({
      id: r.id,
      pattern: r.pattern,
      matchMode: r.matchMode,
      category: r.category,
      enabled: !!r.enabled,
      accountId: r.constraint?.accountId || null
    }));

  const warnings = [
    `Escopo seguro: válida apenas para movimentações FUTURAS (após registro #${afterRowid}) da conta selecionada; histórico anterior e transferências/splits permanecem intocados.`
  ];
  if (conflicts.length > 0) {
    warnings.push(
      `Atenção: existe(m) ${conflicts.length} regra(s) parecida(s) (${conflicts.map((c) => `"${c.pattern}" → ${c.category}`).join(', ')}). Confira prioridade/conflitos antes de confirmar.`
    );
  }
  if (accounts.length > 1) {
    warnings.push('Há mais de uma conta bancária: escolha na prévia qual conta receberá esta regra.');
  }

  return {
    matched: true,
    contract: 'MF3/RULE-DRAFT-V1',
    intent: 'rule_create',
    action: 'rule.save',
    status: 'ready',
    effort: conflicts.length > 0 || accounts.length > 1 ? 'high' : 'medium',
    readOnly: true,
    changesApplied: false,
    source: 'bank',
    profile: scope.profile,
    month: scope.month,
    futureOnly: true,
    afterRowid,
    pattern: cmd.pattern,
    matchMode: cmd.matchMode || 'contains',
    priority: 100,
    nature,
    target: targetRes.target,
    targetLabel: targetRes.targetLabel,
    accounts,
    accountIds: accounts.map((a) => a.id),
    ambiguousAccounts: accounts.length > 1,
    sampleMatches,
    conflicts,
    warnings,
    answer:
      `Preparei uma regra futura para **“${cmd.pattern}” → ${targetRes.targetLabel}** ` +
      `(escopo por conta, somente após o histórico atual #${afterRowid}` +
      (sampleMatches.length ? `, ${sampleMatches.length} exemplo(s) encontrado(s) apenas para conferência` : '') +
      '). Confirme na janela nativa para ativar.'
  };
}

function resolvePlanningDuplicate(planner, title, dueDate, kind) {
  if (!planner || typeof planner.list !== 'function') return [];
  const monthPrefix = String(dueDate || '').slice(0, 7);
  const titleFold = fold(title);
  const existing = planner.list({}) || [];
  return existing
    .filter((item) => {
      if (item.status === 'cancelled') return false;
      if (item.kind !== kind) return false;
      const sameMonth = String(item.dueDate || '').slice(0, 7) === monthPrefix;
      const itemFold = fold(item.title);
      return sameMonth && (itemFold === titleFold || itemFold.includes(titleFold) || titleFold.includes(itemFold));
    })
    .slice(0, 3)
    .map((x) => ({ id: x.id, title: x.title, dueDate: x.dueDate, amountCents: x.amount }));
}

function inferPlanningCategory(topic, kind, catalogParents, explicitCat) {
  if (explicitCat) {
    const res = resolveD05Target(explicitCat, catalogParents);
    if (!res.ok) return { errorRes: res };
    if (res.parent.kind !== 'both' && res.parent.kind !== kind) {
      return { incompatible: res.parent.name };
    }
    return { target: res.target, targetLabel: res.targetLabel, category: res.parent.name };
  }
  const t = fold(topic);
  // Direct category / subcategory match first
  for (const p of catalogParents || []) {
    if (p.kind !== 'both' && p.kind !== kind) continue;
    if (t.includes(fold(p.name)) && fold(p.name).length >= 3) {
      return {
        target: { categoryId: p.id, subcategoryId: null },
        targetLabel: p.name,
        category: p.name
      };
    }
    for (const c of p.subcategories || []) {
      if (t.includes(fold(c.name)) && fold(c.name).length >= 3) {
        return {
          target: { categoryId: p.id, subcategoryId: c.id },
          targetLabel: `${p.name} › ${c.name}`,
          category: p.name
        };
      }
    }
  }
  const keywordMap =
    kind === 'income'
      ? [[/salario|holerite|pagamento/, 'Salário'], [/rendiment|juros|dividendo/, 'Rendimentos'], [/reembols/, 'Reembolsos']]
      : [
          [/esport|academia|natacao|corrida|futbol|tenis|lazer|cinema|viagem|show/, 'Lazer'],
          [/medico|farmacia|dentista|clinica|consulta|saude/, 'Saúde'],
          [/condominio|aluguel|iptu|luz|agua|energia|moradia/, 'Moradia'],
          [/internet|telefone|celular|conta|fatura/, 'Contas'],
          [/mercado|supermercado|ifood|restaurante|lanche|almoco|padaria/, 'Alimentação'],
          [/uber|99|combustivel|gasolina|onibus|metro|estacionamento/, 'Transporte'],
          [/curso|faculdade|escola|livro|educacao/, 'Educação'],
          [/netflix|spotify|assinatura|streaming/, 'Assinaturas']
        ];
  for (const [rx, catName] of keywordMap) {
    if (rx.test(t)) {
      const p = (catalogParents || []).find((x) => fold(x.name) === fold(catName));
      if (p && (p.kind === 'both' || p.kind === kind)) {
        return {
          target: { categoryId: p.id, subcategoryId: null },
          targetLabel: p.name,
          category: p.name
        };
      }
    }
  }
  const fallback = (catalogParents || []).find((p) => fold(p.name) === 'outros') || catalogParents?.[0];
  return {
    target: fallback ? { categoryId: fallback.id, subcategoryId: null } : undefined,
    targetLabel: fallback?.name || 'Outros',
    category: fallback?.name || 'Outros'
  };
}

function buildPlanningCreateDraft({ scope, db, planner, catalog, title, kind, amountCents, dueDate, mode, count, categoryInfo, extraNotes = '', fromSimulation = false }) {
  const moneyFmt = (c) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100);
  const duplicates = resolvePlanningDuplicate(planner, title, dueDate, kind);
  const perInstallment = mode === 'installments' ? Math.floor(amountCents / count) : amountCents;
  const totalAmountCents = mode === 'installments' ? amountCents : amountCents * count;
  const warnings = [];
  if (duplicates.length > 0) {
    warnings.push(
      `Possível duplicidade detectada no mesmo mês: ${duplicates.map((d) => `${d.title} (${d.dueDate}, ${moneyFmt(d.amountCents)})`).join('; ')}. Confira antes de confirmar.`
    );
  }
  const noBankPaymentNotice =
    'Este registro altera apenas o Planejamento local e NÃO efetua pagamento, débito automático ou transferência bancária.';

  return {
    matched: true,
    contract: 'MF3/PLANNING-DRAFT-V1',
    intent: 'planning_create',
    action: 'planning.create',
    status: 'ready',
    effort: duplicates.length > 0 || count > 1 ? 'high' : 'medium',
    readOnly: true,
    changesApplied: false,
    source: scope.source,
    profile: scope.profile,
    month: scope.month,
    fromSimulation,
    noBankPaymentNotice,
    payload: {
      title,
      kind,
      amount: amountCents,
      dueDate,
      category: categoryInfo.category,
      ...(categoryInfo.target ? { target: categoryInfo.target } : {}),
      mode,
      count,
      certainty: 'confirmed',
      notes: extraNotes
    },
    target: categoryInfo.target || null,
    targetLabel: categoryInfo.targetLabel || categoryInfo.category,
    title,
    kind,
    amountCents,
    totalAmountCents,
    perInstallmentCents: perInstallment,
    dueDate,
    mode,
    count,
    duplicates,
    warnings,
    answer:
      `Preparei o registro no Planejamento para **${title}** (` +
      (mode === 'installments'
        ? `${count}x de ≈ ${moneyFmt(perInstallment)} · total ${moneyFmt(totalAmountCents)}`
        : `${moneyFmt(amountCents)}` + (count > 1 ? ` · ${count} ocorrências` : '')) +
      `, vencimento inicial **${dueDate}**, categoria **${categoryInfo.targetLabel || categoryInfo.category}**). ` +
      'Nenhuma gravação ou pagamento foi efetuado.'
  };
}

function interpretCopilotAction({ local, planner = null, scope, owner, question, sessionCtx = null } = {}) {
  if (!local || typeof local.query !== 'function') {
    throw Error('CopilotActions: serviço local obrigatório.');
  }
  const effectivePlanner = planner || local.planner || null;
  const db = local.db;

  // Read-verify active local session BEFORE inspecting catalog/session
  const ensureGrant = () => {
    const grant = local.query({ token: scope.token, month: scope.month, intent: 'radar' }, owner);
    if (
      grant?.version !== 1 ||
      grant.readOnly !== true ||
      grant.references?.source !== scope.source ||
      grant.references?.profile !== scope.profile
    ) {
      throw Error('CopilotActions: concessão de leitura inválida ou expirada.');
    }
    return grant;
  };

  const st = sessionCtx ? sessionCtx.get(scope, owner) : null;
  const salaryRefineCmd = st?.activeSalaryDraft ? parseSalaryRefinementCommand(question, st.activeSalaryDraft) : null;
  const salaryCmd = salaryRefineCmd ? null : parseSalaryBudgetCommand(question);
  const planningCmd = salaryRefineCmd || salaryCmd ? null : parsePlanningCommand(question);
  const categoryCmd = salaryRefineCmd || salaryCmd || planningCmd ? null : parseCategoryStructureCommand(question);
  const ruleCmd = salaryRefineCmd || salaryCmd || planningCmd || categoryCmd ? null : parseRuleCreateCommand(question);
  const singleBudgetCmd =
    salaryRefineCmd || salaryCmd || planningCmd || categoryCmd || ruleCmd ? null : parseSingleBudgetCommand(question);
  const cmd =
    salaryRefineCmd || salaryCmd || planningCmd || categoryCmd || ruleCmd || singleBudgetCmd
      ? null
      : parseCategorizeCommand(question);

  // Also detect anaphoric savings/budget suggestion ("Use o valor que você sugeriu")
  const foldedQ = fold(question);
  const anaphoricSavingsBudget =
    !salaryRefineCmd &&
    !salaryCmd &&
    !planningCmd &&
    !categoryCmd &&
    !ruleCmd &&
    !singleBudgetCmd &&
    !cmd &&
    /\b(?:use|apliqu\w*|ajuste)\b.*\b(?:valor que voce sugeriu|economia sugerida|reducao sugerida|essa reducao)\b/.test(
      foldedQ
    );

  if (!salaryRefineCmd && !salaryCmd && !planningCmd && !categoryCmd && !ruleCmd && !singleBudgetCmd && !cmd && !anaphoricSavingsBudget) {
    return { matched: false };
  }

  ensureGrant();
  const finish = (draft) => {
    if (sessionCtx && draft && draft.status === 'ready') {
      sessionCtx.recordDraft(scope, owner, draft);
    }
    return draft;
  };

  // --- S5: Multi-turn active salary draft refinement ---
  if (salaryRefineCmd) {
    const prev = st.activeSalaryDraft;
    if (salaryRefineCmd.kind === 'missing_category_for_lock') {
      return {
        matched: true,
        contract: 'MF3/SALARY-BUDGET-PROPOSAL-V1',
        intent: 'salary_budget_reorg',
        status: 'needs_clarification',
        effort: 'medium',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        items: [],
        warnings: [],
        answer:
          'Informe o nome da categoria que deseja fixar ou liberar na proposta atual (ex.: "Trave Moradia e recalcule").'
      };
    }

    if (salaryRefineCmd.kind === 'clarify_transfer') {
      return {
        matched: true,
        contract: 'MF3/SALARY-BUDGET-PROPOSAL-V1',
        intent: 'salary_budget_reorg',
        status: 'needs_clarification',
        effort: 'medium',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        items: [],
        warnings: [],
        answer: salaryRefineCmd.missingAmount
          ? 'Informe o valor e as duas categorias para transferir na proposta (ex.: "Transfira R$ 200 de Lazer para Alimentação").'
          : 'Não consegui identificar duas categorias distintas do orçamento atual para transferir. Informe origem, destino e valor.'
      };
    }

    const lockedMap = collectLockedMapFromDraft(prev);
    let protectedCats = Array.isArray(prev.protectedCategories) ? [...prev.protectedCategories] : [];
    const protectedHints = Array.isArray(prev.protectedHints) ? [...prev.protectedHints] : [];
    let reserveGoalCents = prev.requestedReserveCents ?? null;
    if (salaryRefineCmd.kind === 'adjust_reserve') {
      reserveGoalCents = Math.min(prev.salaryCents, Math.max(0, salaryRefineCmd.nextReserveGoalCents));
    } else if (salaryRefineCmd.kind === 'protect_category') {
      if (!protectedCats.some((c) => fold(c) === fold(salaryRefineCmd.category))) {
        protectedCats.push(salaryRefineCmd.category);
      }
      lockedMap[salaryRefineCmd.category] = salaryRefineCmd.targetCents;
    } else if (salaryRefineCmd.kind === 'transfer_category') {
      const donor = (prev.items || []).find((i) => i.category === salaryRefineCmd.fromCategory);
      const recip = (prev.items || []).find((i) => i.category === salaryRefineCmd.toCategory);
      const donorFloor = donor?.committedFloorCents || 0;
      const nextDonor = (donor?.proposedLimitCents || 0) - salaryRefineCmd.amountCents;
      if (nextDonor < donorFloor) {
        const mf = (c) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
        return {
          matched: true,
          contract: 'MF3/SALARY-BUDGET-PROPOSAL-V1',
          intent: 'salary_budget_reorg',
          status: 'needs_clarification',
          effort: 'medium',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          items: [],
          warnings: [],
          answer: `Não é possível transferir ${mf(salaryRefineCmd.amountCents)} de **${salaryRefineCmd.fromCategory}** porque ${mf(donorFloor)} já estão comprometidos neste mês.`
        };
      }
      lockedMap[salaryRefineCmd.fromCategory] = nextDonor;
      lockedMap[salaryRefineCmd.toCategory] = (recip?.proposedLimitCents || 0) + salaryRefineCmd.amountCents;
    } else if (salaryRefineCmd.kind === 'lock_category' || salaryRefineCmd.kind === 'adjust_category') {
      lockedMap[salaryRefineCmd.category] = salaryRefineCmd.targetCents;
    } else if (salaryRefineCmd.kind === 'unlock_category') {
      for (const k of Object.keys(lockedMap)) {
        if (fold(k) === fold(salaryRefineCmd.category)) delete lockedMap[k];
      }
      protectedCats = protectedCats.filter((c) => fold(c) !== fold(salaryRefineCmd.category));
    }

    const next = buildSalaryBudgetProposal({
      db,
      planner: effectivePlanner,
      profile: scope.profile,
      source: scope.source,
      month: scope.month,
      salaryCents: prev.salaryCents,
      reserveGoalCents,
      profileMode: prev.profileMode || 'balanced',
      protectedCategories: protectedCats,
      protectedHints,
      lockedCategories: lockedMap,
      updateIncomeSetting: !!prev.updateIncomeSetting,
      applyRecurring: !!prev.applyRecurring
    });

    const prevMap = new Map((prev.items || []).map((it) => [it.category, it.proposedLimitCents]));
    const revisionDiff = (next.items || [])
      .map((it) => {
        const beforeVal = prevMap.get(it.category) ?? 0;
        const deltaCents = it.proposedLimitCents - beforeVal;
        return deltaCents !== 0
          ? {
              category: it.category,
              previousCents: beforeVal,
              proposedCents: it.proposedLimitCents,
              deltaCents
            }
          : null;
      })
      .filter(Boolean);

    const nextRev = (prev.revision || 1) + 1;
    const reserveDeltaCents = (next.proposedReserveCents || 0) - (prev.proposedReserveCents || 0);
    const enriched = {
      ...next,
      revision: nextRev,
      previousRevision: prev.revision || 1,
      revisionDiff,
      reserveDeltaCents,
      answer:
        `Atualizei sua proposta salarial (**Revisão v${nextRev}** · somente prévia, nada gravado ainda): ` +
        (revisionDiff.length
          ? `${revisionDiff.length} categoria(s) ajustada(s)`
          : 'limites mantidos') +
        (reserveDeltaCents !== 0
          ? `, margem/reserva ${reserveDeltaCents > 0 ? '+' : '−'}${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(reserveDeltaCents) / 100)}`
          : '') +
        '. Confira os valores atualizados abaixo antes de confirmar.'
    };
    return finish(enriched);
  }

  // --- S2: Salary budget proposal ---
  if (salaryCmd) {
    if (salaryCmd.missingSalary) {
      return {
        matched: true,
        contract: 'MF3/SALARY-BUDGET-PROPOSAL-V1',
        intent: 'salary_budget_reorg',
        status: 'needs_clarification',
        effort: 'medium',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        items: [],
        warnings: [],
        answer:
          'Para reorganizar seus orçamentos de forma realista, informe seu salário líquido deste mês em reais (ex.: "Meu salário este mês é R$ 6.500, reorganize meus orçamentos").'
      };
    }
    const prop = buildSalaryBudgetProposal({
      db,
      planner: effectivePlanner,
      profile: scope.profile,
      source: scope.source,
      month: scope.month,
      salaryCents: salaryCmd.salaryCents,
      reserveGoalCents: salaryCmd.reserveGoalCents,
      profileMode: salaryCmd.profileMode,
      protectedHints: salaryCmd.protectedHints,
      updateIncomeSetting: salaryCmd.updateIncomeSetting
    });
    prop.revision = 1;
    return finish(prop);
  }

  const svc = new D05CategoryService(db);
  const catalog = svc.listCatalog();

  // --- S5 Anaphora: Apply suggested savings reduction to monthly budget ---
  if (anaphoricSavingsBudget) {
    const opps = Array.isArray(st?.lastSavings?.opportunities) ? st.lastSavings.opportunities : [];
    const opp = opps.find((o) => o.kind !== 'merchant' && o.categoryLabel) || opps[0];
    if (!opp) {
      return {
        matched: true,
        contract: 'MF3/BUDGET-EDIT-DRAFT-V1',
        intent: 'budget_single_edit',
        status: 'needs_clarification',
        effort: 'high',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        answer:
          'Não encontrei nenhuma sugestão recente de economia nesta sessão. Pergunte primeiro "Onde posso economizar?" ou informe a categoria e o novo limite em reais.'
      };
    }
    const rawCatHint =
      opp.kind === 'merchant'
        ? /\(([^)]+)\)\s*$/.exec(String(opp.categoryLabel || ''))?.[1] || opp.categoryLabel
        : opp.categoryLabel;
    const targetRes = resolveD05Target(rawCatHint, catalog.parents);
    const catName = targetRes.ok ? targetRes.parent.name : rawCatHint;
    const effective =
      typeof db.effectiveBudgets === 'function' ? db.effectiveBudgets(scope.profile, scope.month).effective : {};
    const currentSpentCents = opp.currentCents || 0;
    const suggestedSaveCents = opp.baseSaveCents || 0;
    const currentLimit = Number.isSafeInteger(effective[catName]) ? effective[catName] : currentSpentCents;
    const proposedLimit = Math.max(0, Math.max(currentSpentCents ? Math.round(currentSpentCents * 0.85) : 0, currentLimit - suggestedSaveCents));
    return finish({
      matched: true,
      contract: 'MF3/BUDGET-EDIT-DRAFT-V1',
      intent: 'budget_single_edit',
      action: 'budgets.reorganize',
      status: 'ready',
      effort: 'medium',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      applyRecurring: false,
      category: catName,
      currentLimitCents: Number.isSafeInteger(effective[catName]) ? effective[catName] : null,
      proposedLimitCents: proposedLimit,
      suggestedSavingsCents: suggestedSaveCents,
      warnings: [`Alteração válida somente para ${scope.month} (salvo se marcar opção recorrente).`],
      answer:
        `Com base na economia sugerida em **${catName}**, preparei o novo limite mensal (${scope.month}) para **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposedLimit / 100)}**. Confirme na prévia abaixo.`
    });
  }

  // --- S4 Single-Category Budget Edit ---
  if (singleBudgetCmd) {
    const resolved = resolveD05Target(singleBudgetCmd.categoryRaw, catalog.parents);
    if (!resolved.ok || resolved.parent.kind === 'income') {
      const expenseNames = catalog.parents.filter((p) => p.kind !== 'income').map((p) => p.name);
      return {
        matched: true,
        contract: 'MF3/BUDGET-EDIT-DRAFT-V1',
        intent: 'budget_single_edit',
        status: 'needs_clarification',
        effort: 'medium',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        answer:
          resolved.ok && resolved.parent.kind === 'income'
            ? `A categoria “${resolved.parent.name}” é de receita; orçamentos controlam categorias de despesa.`
            : `Não encontrei a categoria de orçamento “${singleBudgetCmd.categoryRaw}”. Opções: ${expenseNames.join(', ')}.`
      };
    }
    const catName = resolved.parent.name;
    const effective =
      typeof db.effectiveBudgets === 'function' ? db.effectiveBudgets(scope.profile, scope.month).effective : {};
    const currentLimitCents = Number.isSafeInteger(effective[catName]) ? effective[catName] : null;
    const radar = local.query({ token: scope.token, month: scope.month, intent: 'radar' }, owner);
    const spentRow = (radar?.facts?.expenseCategories || []).find((c) => fold(c.name) === fold(catName));
    const currentSpentCents = spentRow?.amountCents || 0;
    const warnings = [];
    if (currentSpentCents > singleBudgetCmd.amountCents) {
      warnings.push(
        `Neste mês você já gastou ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentSpentCents / 100)}, acima do novo limite proposto.`
      );
    }
    return finish({
      matched: true,
      contract: 'MF3/BUDGET-EDIT-DRAFT-V1',
      intent: 'budget_single_edit',
      action: 'budgets.reorganize',
      status: 'ready',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      applyRecurring: !!singleBudgetCmd.applyRecurring,
      category: catName,
      target: resolved.target,
      currentLimitCents,
      proposedLimitCents: singleBudgetCmd.amountCents,
      currentSpentCents,
      warnings,
      answer:
        `Preparei a alteração do limite de **${catName}** para **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(singleBudgetCmd.amountCents / 100)}**` +
        (singleBudgetCmd.applyRecurring ? ' (mês atual + recorrente).' : ` (válido somente em ${scope.month}).`)
    });
  }

  // --- S4 Planning ---
  if (planningCmd) {
    if (!effectivePlanner) {
      return {
        matched: true,
        contract: 'MF3/PLANNING-DRAFT-V1',
        intent: 'planning',
        status: 'unavailable',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        answer: 'Serviço local de Planejamento não está disponível nesta sessão.'
      };
    }

    if (planningCmd.intent === 'planning_from_simulation') {
      const sim = st?.lastSimulation;
      if (!sim || sim.mode !== 'purchase' || !Number.isSafeInteger(sim.principalCents) || sim.principalCents <= 0) {
        return {
          matched: true,
          contract: 'MF3/PLANNING-DRAFT-V1',
          intent: 'planning_create',
          status: 'needs_clarification',
          effort: 'medium',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer:
            'Ainda não encontrei uma simulação de compra recente nesta sessão. Simule primeiro a compra (ex.: "Simule comprar R$ 1.800 em 6x") para convertê-la em planejamento.'
        };
      }
      const installments = Math.max(1, Math.min(36, Number(sim.installments || 1)));
      const firstDate = sim.schedule?.[0]?.date || parsePlanningDueDate('', scope.month);
      const totalCents = Number.isSafeInteger(sim.totalCents) && sim.totalCents > 0 ? sim.totalCents : sim.principalCents;
      const catInfo = inferPlanningCategory(st?.lastCategory || 'compras', 'expense', catalog.parents, null);
      return finish(
        buildPlanningCreateDraft({
          scope,
          db,
          planner: effectivePlanner,
          catalog,
          title: `Compra simulada (${installments}x)`,
          kind: 'expense',
          amountCents: totalCents,
          dueDate: firstDate,
          mode: installments > 1 ? 'installments' : 'once',
          count: installments,
          categoryInfo: catInfo,
          extraNotes: `Convertido da simulação F4 (${installments}x${sim.monthlyRate ? ` a ${sim.monthlyRate}% a.m.` : ' sem juros'}).`,
          fromSimulation: true
        })
      );
    }

    if (planningCmd.intent === 'planning_create') {
      const dueDate = parsePlanningDueDate(question, scope.month);
      const catInfo = inferPlanningCategory(
        planningCmd.title,
        planningCmd.kind,
        catalog.parents,
        planningCmd.explicitCategory
      );
      if (catInfo.errorRes || catInfo.incompatible) {
        return {
          matched: true,
          contract: 'MF3/PLANNING-DRAFT-V1',
          intent: 'planning_create',
          status: 'needs_clarification',
          effort: 'medium',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: catInfo.incompatible
            ? `A categoria “${catInfo.incompatible}” não é compatível com ${planningCmd.kind === 'income' ? 'receita' : 'despesa'}.`
            : 'Não consegui localizar a categoria informada no catálogo D05 para este item de planejamento.'
        };
      }
      return finish(
        buildPlanningCreateDraft({
          scope,
          db,
          planner: effectivePlanner,
          catalog,
          title: planningCmd.title,
          kind: planningCmd.kind,
          amountCents: planningCmd.amountCents,
          dueDate,
          mode: planningCmd.mode,
          count: planningCmd.count,
          categoryInfo: catInfo
        })
      );
    }

    if (planningCmd.intent === 'planning_update' || planningCmd.intent === 'planning_status') {
      const all = effectivePlanner.list({});
      const qFold = fold(planningCmd.query);
      const matches = all.filter((x) => {
        const tf = fold(x.title);
        return x.status !== 'cancelled' && (tf === qFold || tf.includes(qFold) || qFold.includes(tf));
      });
      if (matches.length === 0) {
        return {
          matched: true,
          contract: 'MF3/PLANNING-DRAFT-V1',
          intent: planningCmd.intent,
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Não encontrei compromisso ativo no Planejamento correspondente a “${planningCmd.query}”.`
        };
      }
      if (matches.length > 1) {
        const exact = matches.filter((x) => fold(x.title) === qFold);
        if (exact.length !== 1) {
          return {
            matched: true,
            contract: 'MF3/PLANNING-DRAFT-V1',
            intent: planningCmd.intent,
            status: 'needs_clarification',
            effort: 'high',
            readOnly: true,
            changesApplied: false,
            source: scope.source,
            profile: scope.profile,
            month: scope.month,
            answer:
              `Encontrei ${matches.length} compromissos parecidos com “${planningCmd.query}”: ` +
              matches
                .slice(0, 5)
                .map((x) => `“${x.title}” (${x.dueDate}, ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(x.amount / 100)})`)
                .join('; ') +
              '. Informe o título ou data exata.'
          };
        }
        matches.splice(0, matches.length, exact[0]);
      }
      const targetItem = matches[0];
      const noBankPaymentNotice =
        'Este ajuste altera apenas o seu Planejamento local e NÃO efetua pagamento ou transferência bancária.';

      if (planningCmd.intent === 'planning_status') {
        return finish({
          matched: true,
          contract: 'MF3/PLANNING-DRAFT-V1',
          intent: 'planning_status',
          action: 'planning.status',
          status: 'ready',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          noBankPaymentNotice,
          accountIds: targetItem.accountId ? [targetItem.accountId] : [],
          payload: { id: targetItem.id, status: planningCmd.status },
          title: targetItem.title,
          kind: targetItem.kind,
          amountCents: targetItem.amount,
          dueDate: targetItem.dueDate,
          beforeSummary: `Situação atual: ${targetItem.status}`,
          afterSummary: `Nova situação: ${planningCmd.status}`,
          warnings: [],
          answer: `Preparei a alteração de situação de **${targetItem.title}** (${targetItem.dueDate}) para **${planningCmd.status === 'cancelled' ? 'Cancelado' : 'Planejado'}**.`
        });
      }

      const nextPayload = { id: targetItem.id };
      let changeLabel = '';
      if (planningCmd.field === 'amount') {
        const nextCents = parseMoneyToCents(planningCmd.valueRaw) ?? parseBrlCents(planningCmd.valueRaw);
        if (!nextCents || nextCents <= 0) {
          return {
            matched: true,
            contract: 'MF3/PLANNING-DRAFT-V1',
            intent: 'planning_update',
            status: 'needs_clarification',
            effort: 'low',
            readOnly: true,
            changesApplied: false,
            source: scope.source,
            profile: scope.profile,
            month: scope.month,
            answer: 'Informe o novo valor em reais (ex.: "Mude o valor de Condomínio para R$ 520").'
          };
        }
        nextPayload.amount = nextCents;
        const mf = (c) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
        changeLabel = `Valor: ${mf(targetItem.amount)} → ${mf(nextCents)}`;
      } else {
        const itemMonth = String(targetItem.dueDate || scope.month).slice(0, 7);
        const nextDue = parsePlanningDueDate(planningCmd.valueRaw, itemMonth);
        if (!nextDue) {
          return {
            matched: true,
            contract: 'MF3/PLANNING-DRAFT-V1',
            intent: 'planning_update',
            status: 'needs_clarification',
            effort: 'low',
            readOnly: true,
            changesApplied: false,
            source: scope.source,
            profile: scope.profile,
            month: scope.month,
            answer: 'Não consegui entender a nova data de vencimento (use "dia 10" ou DD/MM/AAAA).'
          };
        }
        nextPayload.dueDate = nextDue;
        changeLabel = `Vencimento: ${targetItem.dueDate} → ${nextDue}`;
      }

      return finish({
        matched: true,
        contract: 'MF3/PLANNING-DRAFT-V1',
        intent: 'planning_update',
        action: 'planning.update',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        noBankPaymentNotice,
        accountIds: targetItem.accountId ? [targetItem.accountId] : [],
        payload: nextPayload,
        title: targetItem.title,
        kind: targetItem.kind,
        amountCents: nextPayload.amount || targetItem.amount,
        dueDate: nextPayload.dueDate || targetItem.dueDate,
        changeLabel,
        warnings: [],
        answer: `Preparei a atualização de **${targetItem.title}** (${changeLabel}). Nenhuma gravação ou pagamento foi realizado.`
      });
    }
  }

  // --- S3 Categories & Subcategories ---
  if (categoryCmd) {
    if (categoryCmd.intent === 'category_create') {
      const clash = catalog.parents.find((p) => fold(p.name) === fold(categoryCmd.name));
      if (clash) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'category_create',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `A categoria **${clash.name}** já existe no catálogo atual.`
        };
      }
      return finish({
        matched: true,
        contract: 'MF3/CATEGORY-DRAFT-V1',
        intent: 'category_create',
        action: 'category.create',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        payload: {
          name: categoryCmd.name,
          kind: categoryCmd.kind,
          color: '#6b7280',
          emoji: '✨',
          iconKey: 'tag',
          hue: 210
        },
        name: categoryCmd.name,
        kind: categoryCmd.kind,
        warnings: [],
        answer: `Preparei a criação da categoria personalizada **${categoryCmd.name}** (${categoryCmd.kind === 'income' ? 'Receita' : categoryCmd.kind === 'both' ? 'Mista' : 'Despesa'}). Confirme na janela nativa.`
      });
    }

    if (categoryCmd.intent === 'category_rename') {
      const cur = catalog.parents.find((p) => fold(p.name) === fold(categoryCmd.currentName));
      if (!cur) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'category_rename',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Não encontrei a categoria “${categoryCmd.currentName}”.`
        };
      }
      if (cur.builtIn) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'category_rename',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `A categoria padrão **${cur.name}** faz parte da taxonomia oficial D05 e não pode ser renomeada.`
        };
      }
      if (catalog.parents.some((p) => fold(p.name) === fold(categoryCmd.newName) && p.id !== cur.id)) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'category_rename',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Já existe uma categoria chamada “${categoryCmd.newName}”.`
        };
      }
      return finish({
        matched: true,
        contract: 'MF3/CATEGORY-DRAFT-V1',
        intent: 'category_rename',
        action: 'category.rename',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        payload: { currentName: cur.name, newName: categoryCmd.newName },
        currentName: cur.name,
        newName: categoryCmd.newName,
        warnings: [],
        answer: `Preparei a renomeação da categoria personalizada **${cur.name} → ${categoryCmd.newName}**. Confirme na janela nativa.`
      });
    }

    if (categoryCmd.intent === 'subcategory_create') {
      const parentRes = resolveD05Target(categoryCmd.parentRaw, catalog.parents);
      if (!parentRes.ok) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'subcategory_create',
          status: 'needs_clarification',
          effort: 'medium',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Não localizei a categoria-pai “${categoryCmd.parentRaw}”. Informe uma categoria válida (ex.: "Crie a subcategoria Delivery em Alimentação").`
        };
      }
      const norm = normalizedName(categoryCmd.name);
      const dup = (parentRes.parent.subcategories || []).find((s) => normalizedName(s.name) === norm);
      if (dup) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'subcategory_create',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `A subcategoria **${dup.name}** já existe em **${parentRes.parent.name}**.`
        };
      }
      return finish({
        matched: true,
        contract: 'MF3/CATEGORY-DRAFT-V1',
        intent: 'subcategory_create',
        action: 'subcategory.create',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        payload: {
          parentCategoryId: parentRes.parent.id,
          name: categoryCmd.name,
          iconKey: parentRes.parent.iconKey || 'tag',
          hue: Number.isInteger(parentRes.parent.hue) ? parentRes.parent.hue : 210
        },
        parentName: parentRes.parent.name,
        name: categoryCmd.name,
        warnings: [],
        answer: `Preparei a criação da subcategoria **${parentRes.parent.name} › ${categoryCmd.name}**. Confirme na janela nativa.`
      });
    }

    if (categoryCmd.intent === 'subcategory_rename') {
      const matches = [];
      for (const p of catalog.parents) {
        if (categoryCmd.parentRaw && fold(p.name) !== fold(categoryCmd.parentRaw)) continue;
        for (const s of p.subcategories || []) {
          if (normalizedName(s.name) === normalizedName(categoryCmd.currentName)) {
            matches.push({ parent: p, sub: s });
          }
        }
      }
      if (matches.length === 0) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'subcategory_rename',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Não encontrei a subcategoria “${categoryCmd.currentName}”.`
        };
      }
      if (matches.length > 1) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'subcategory_rename',
          status: 'needs_clarification',
          effort: 'high',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Existe mais de uma subcategoria “${categoryCmd.currentName}” (${matches.map((m) => m.parent.name).join(', ')}). Informe a categoria-pai.`
        };
      }
      const { parent, sub } = matches[0];
      if (sub.builtIn) {
        return {
          matched: true,
          contract: 'MF3/CATEGORY-DRAFT-V1',
          intent: 'subcategory_rename',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `A subcategoria oficial **${parent.name} › ${sub.name}** é imutável no catálogo D05.`
        };
      }
      return finish({
        matched: true,
        contract: 'MF3/CATEGORY-DRAFT-V1',
        intent: 'subcategory_rename',
        action: 'subcategory.rename',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        payload: { id: sub.id, newName: categoryCmd.newName },
        parentName: parent.name,
        currentName: sub.name,
        newName: categoryCmd.newName,
        warnings: [],
        answer: `Preparei a renomeação da subcategoria personalizada **${parent.name} › ${sub.name} → ${categoryCmd.newName}**. Confirme na janela nativa.`
      });
    }
  }

  // --- S3 Rules ---
  if (ruleCmd) {
    if (ruleCmd.intent === 'rule_toggle') {
      if (scope.profile !== 'real') {
        return {
          matched: true,
          contract: 'MF3/RULE-DRAFT-V1',
          intent: 'rule_toggle',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: 'Ativar ou desativar regras bancárias está disponível no perfil pessoal.'
        };
      }
      const qFold = fold(ruleCmd.query);
      const rules = (db.listCategories().rules || []).filter((r) => fold(r.pattern).includes(qFold) || qFold.includes(fold(r.pattern)));
      if (rules.length === 0) {
        return {
          matched: true,
          contract: 'MF3/RULE-DRAFT-V1',
          intent: 'rule_toggle',
          status: 'unavailable',
          effort: 'low',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          answer: `Não encontrei regra correspondente a “${ruleCmd.query}”.`
        };
      }
      if (rules.length > 1) {
        const exact = rules.filter((r) => fold(r.pattern) === qFold);
        if (exact.length !== 1) {
          return {
            matched: true,
            contract: 'MF3/RULE-DRAFT-V1',
            intent: 'rule_toggle',
            status: 'needs_clarification',
            effort: 'high',
            readOnly: true,
            changesApplied: false,
            source: scope.source,
            profile: scope.profile,
            month: scope.month,
            answer:
              `Encontrei ${rules.length} regras parecidas: ${rules.map((r) => `“${r.pattern}” → ${r.category}`).join('; ')}. Informe o padrão exato.`
          };
        }
        rules.splice(0, rules.length, exact[0]);
      }
      const r = rules[0];
      return finish({
        matched: true,
        contract: 'MF3/RULE-DRAFT-V1',
        intent: 'rule_toggle',
        action: 'rule.toggle',
        status: 'ready',
        effort: 'low',
        readOnly: true,
        changesApplied: false,
        source: 'bank',
        profile: scope.profile,
        month: scope.month,
        ruleId: r.id,
        pattern: r.pattern,
        enabled: ruleCmd.enabled,
        targetLabel: r.category,
        accountIds: r.constraint?.accountId ? [r.constraint.accountId] : [],
        warnings: [],
        answer: `Preparei para **${ruleCmd.enabled ? 'ativar' : 'desativar'}** a regra **“${r.pattern}” → ${r.category}**. Confirme na janela nativa.`
      });
    }

    const targetRes = resolveD05Target(ruleCmd.targetRaw, catalog.parents);
    if (!targetRes.ok) {
      return {
        matched: true,
        contract: 'MF3/RULE-DRAFT-V1',
        intent: 'rule_create',
        status: 'needs_clarification',
        effort: 'high',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        pattern: ruleCmd.pattern,
        answer:
          targetRes.reason === 'unknown_subcategory'
            ? `A subcategoria “${targetRes.rawChild}” não existe em ${targetRes.parentName}. Opções: ${targetRes.availableChildren.join(', ') || 'nenhuma'}. Você pode criá-la antes (ex.: "Crie a subcategoria ${targetRes.rawChild} em ${targetRes.parentName}").`
            : `Não encontrei o destino D05 “${ruleCmd.targetRaw}” para a regra.`
      };
    }
    return finish(buildRuleSaveDraft({ db, scope, cmd: ruleCmd, targetRes }));
  }

  // --- S1 Categorize & S5 Anaphora ("essas movimentações") ---
  const targetRes = resolveD05Target(cmd.targetRaw, catalog.parents);

  if (!targetRes.ok) {
    let message = 'Não consegui identificar a categoria D05 de destino com segurança. Nenhuma alteração foi preparada.';
    if (targetRes.reason === 'unknown_subcategory') {
      message = `A subcategoria “${safeText(targetRes.rawChild, 60)}” não foi encontrada em ${targetRes.parentName}. Opções disponíveis: ${targetRes.availableChildren.join(', ') || 'nenhuma'}.`;
    } else if (targetRes.reason === 'ambiguous_subcategory' || targetRes.reason === 'ambiguous_parent') {
      message = `O destino informado pode corresponder a mais de uma categoria (${targetRes.candidates.join(', ')}). Informe o nome exato para preparar a prévia.`;
    } else if (targetRes.reason === 'unknown_parent') {
      message = `Não encontrei a categoria “${safeText(targetRes.rawParent, 60)}” no catálogo atual D05. Informe uma das 14 categorias oficiais ou "Categoria > Subcategoria".`;
    }
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'needs_clarification',
      effort: 'high',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      merchantQuery: cmd.merchantQuery || '',
      futureRuleRequested: cmd.futureRuleRequested,
      items: [],
      eligibleCount: 0,
      excludedBySafetyCount: 0,
      totalAmountCents: 0,
      answer: message,
      warnings: []
    };
  }

  if (cmd.anaphoric) {
    const rememberedKeys = new Set((st?.lastTransactions || []).map((t) => t.key).filter(Boolean));
    const fallbackMerchant = st?.lastMerchant || null;
    if (rememberedKeys.size === 0 && !fallbackMerchant) {
      return {
        matched: true,
        contract: 'MF3/ACTION-DRAFT-V1',
        intent: 'categorize',
        status: 'needs_clarification',
        effort: 'high',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        merchantQuery: '',
        items: [],
        eligibleCount: 0,
        excludedBySafetyCount: 0,
        totalAmountCents: 0,
        answer:
          'Não encontrei uma lista anterior de movimentações ativa nesta sessão para aplicar essa mudança. Informe o estabelecimento ou descrição (ex.: "Coloque as compras do Mercado em Alimentação").',
        warnings: []
      };
    }
    if (rememberedKeys.size === 0 && fallbackMerchant) {
      cmd.merchantQuery = fallbackMerchant;
      cmd.anaphoric = false;
    } else {
      // Match strictly by keys retained in active ephemeral session
      const txList = [];
      if (scope.source === 'bank') {
        const view = svc.bankView({ limit: 2500 });
        const overview = db.bankOverview();
        const accountNames = new Map((overview.accounts || []).map((a) => [a.id, safeText(a.name, 80)]));
        for (const row of view.items || []) {
          const k = `${row.accountId}|${row.id}`;
          if (!rememberedKeys.has(k)) continue;
          const nature = row.nature && row.nature !== 'auto' ? row.nature : row.amount < 0 ? 'expense' : 'income';
          const txKind = nature === 'income' ? 'income' : 'expense';
          const eligible =
            row.status === 'POSTED' &&
            nature !== 'transfer' &&
            nature !== 'ignore' &&
            !(Array.isArray(row.splits) && row.splits.length > 0) &&
            (targetRes.parent.kind === 'both' || targetRes.parent.kind === txKind);
          txList.push({
            key: k,
            origin: 'bank',
            accountId: row.accountId,
            accountName: accountNames.get(row.accountId) || row.accountId,
            id: row.id,
            externalId: row.id,
            date: row.date,
            description: safeText(row.merchant || row.description || 'Movimentação bancária', 120),
            rawDescription: safeText(row.description || '', 120),
            amountCents: Math.abs(row.amount || 0),
            txKind,
            status: row.status,
            currentCategory: row.category || 'Outros',
            currentCategoryId: row.categoryId || null,
            currentSubcategoryId: row.subcategoryId || null,
            eligible,
            ineligibleReason: eligible ? null : 'Incompatível com segurança ou natureza da categoria'
          });
        }
      } else {
        const manual = svc.listManual({ profile: scope.profile, limit: 2500 });
        for (const row of manual.items || []) {
          const k = `manual|${row.id}`;
          if (!rememberedKeys.has(k)) continue;
          const eligible = targetRes.parent.kind === 'both' || targetRes.parent.kind === row.kind;
          txList.push({
            key: k,
            origin: 'manual',
            accountId: null,
            accountName: 'Manual',
            id: row.id,
            externalId: null,
            date: row.date,
            description: safeText(row.description || 'Lançamento manual', 120),
            rawDescription: safeText(row.description || '', 120),
            amountCents: Math.abs(row.amount || 0),
            txKind: row.kind,
            status: 'MANUAL',
            currentCategory: row.category || 'Outros',
            currentCategoryId: row.categoryId || null,
            currentSubcategoryId: row.subcategoryId || null,
            eligible,
            ineligibleReason: eligible ? null : `Categoria "${targetRes.parent.name}" incompatível`
          });
        }
      }
      const eligibleAnaphoric = txList.filter((x) => x.eligible);
      if (!eligibleAnaphoric.length) {
        return {
          matched: true,
          contract: 'MF3/ACTION-DRAFT-V1',
          intent: 'categorize',
          status: 'unavailable',
          effort: 'medium',
          readOnly: true,
          changesApplied: false,
          source: scope.source,
          profile: scope.profile,
          month: scope.month,
          target: targetRes.target,
          targetLabel: targetRes.targetLabel,
          merchantQuery: st?.lastMerchant || 'seleção da sessão',
          items: [],
          eligibleCount: 0,
          excludedBySafetyCount: txList.length,
          totalAmountCents: 0,
          answer: `Nenhum dos lançamentos da etapa anterior é elegível para **${targetRes.targetLabel}**.`,
          warnings: []
        };
      }
      const distinctAcc = [...new Set(eligibleAnaphoric.map((i) => i.accountId).filter(Boolean))];
      const totalCents = eligibleAnaphoric.reduce((n, it) => n + it.amountCents, 0);
      const act =
        scope.source === 'bank'
          ? eligibleAnaphoric.length === 1
            ? 'bank.categorize'
            : 'bank.batch-categorize'
          : eligibleAnaphoric.length === 1
            ? 'manual.categorize'
            : 'manual.batch-categorize';
      return finish({
        matched: true,
        contract: 'MF3/ACTION-DRAFT-V1',
        intent: 'categorize',
        status: 'ready',
        effort: distinctAcc.length > 1 ? 'high' : 'medium',
        readOnly: true,
        changesApplied: false,
        source: scope.source,
        profile: scope.profile,
        month: scope.month,
        action: act,
        target: targetRes.target,
        targetLabel: targetRes.targetLabel,
        merchantQuery: st?.lastMerchant || 'seleção anterior',
        items: txList,
        eligibleCount: eligibleAnaphoric.length,
        excludedBySafetyCount: txList.length - eligibleAnaphoric.length,
        totalAmountCents: totalCents,
        accountIds: distinctAcc,
        ambiguousAccounts: distinctAcc.length > 1,
        ambiguousMerchants: false,
        futureRuleRequested: cmd.futureRuleRequested,
        futureRulePattern: cmd.futureRuleRequested ? st?.lastMerchant || null : null,
        futureRuleNotice: null,
        warnings: [],
        answer: `Reaproveitei os **${eligibleAnaphoric.length} lançamento(s)** da sessão para **${targetRes.targetLabel}**. Revise e confirme na janela nativa.`
      });
    }
  }

  if (cmd.originFilter !== 'all' && cmd.originFilter !== scope.source) {
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'needs_clarification',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      merchantQuery: cmd.merchantQuery,
      futureRuleRequested: cmd.futureRuleRequested,
      items: [],
      eligibleCount: 0,
      excludedBySafetyCount: 0,
      totalAmountCents: 0,
      answer:
        cmd.originFilter === 'bank'
          ? 'A sessão autorizada está lendo lançamentos manuais, mas você pediu movimentações bancárias. Autorize a fonte "Contas conectadas" para preparar esta ação.'
          : 'A sessão autorizada está lendo contas conectadas, mas você pediu lançamentos manuais. Autorize a fonte "Lançamentos manuais" para preparar esta ação.',
      warnings: []
    };
  }

  const queryFold = fold(cmd.merchantQuery);
  const queryTokens = queryFold.split(' ').filter((w) => w.length >= 2);
  const matchesTerm = (text) => {
    const hay = fold(text);
    if (!hay) return false;
    if (hay.includes(queryFold)) return true;
    return queryTokens.length > 0 && queryTokens.every((t) => hay.includes(t));
  };

  const candidates = [];
  if (scope.source === 'bank') {
    const view = svc.bankView({ limit: 2500 });
    const overview = db.bankOverview();
    const metaByKey = new Map((overview.transactions || []).map((t) => [JSON.stringify([t.accountId, t.id]), t]));
    const accountNames = new Map((overview.accounts || []).map((a) => [a.id, safeText(a.name, 80)]));

    for (const row of view.items || []) {
      const meta = metaByKey.get(JSON.stringify([row.accountId, row.id])) || row;
      const customTitle = safeText(meta.customTitle || row.merchant || '', 120);
      const rawDesc = safeText(row.description || '', 120);
      if (!matchesTerm(customTitle) && !matchesTerm(rawDesc)) continue;

      let eligible = true;
      let ineligibleReason = null;
      const nature = row.nature && row.nature !== 'auto' ? row.nature : row.amount < 0 ? 'expense' : 'income';
      const txKind = nature === 'income' ? 'income' : 'expense';
      if (row.status !== 'POSTED') {
        eligible = false;
        ineligibleReason = 'Movimentação pendente no banco';
      } else if (nature === 'transfer' || nature === 'ignore') {
        eligible = false;
        ineligibleReason = 'Transferência própria ou ignorada';
      } else if (Array.isArray(row.splits) && row.splits.length > 0) {
        eligible = false;
        ineligibleReason = 'Movimentação já dividida em partes (split)';
      } else if (targetRes.parent.kind !== 'both' && targetRes.parent.kind !== txKind) {
        eligible = false;
        ineligibleReason = `Categoria "${targetRes.parent.name}" incompatível com ${txKind === 'income' ? 'entrada' : 'saída'}`;
      }

      candidates.push({
        key: `${row.accountId}|${row.id}`,
        origin: 'bank',
        accountId: row.accountId,
        accountName: accountNames.get(row.accountId) || row.accountId,
        id: row.id,
        externalId: row.id,
        date: row.date,
        description: customTitle || rawDesc || 'Movimentação bancária',
        rawDescription: rawDesc,
        amountCents: Math.abs(row.amount || 0),
        txKind,
        status: row.status,
        currentCategory: row.category || 'Outros',
        currentCategoryId: row.categoryId || null,
        currentSubcategoryId: row.subcategoryId || null,
        eligible,
        ineligibleReason
      });
    }
  } else {
    const manual = svc.listManual({ profile: scope.profile, limit: 2500 });
    for (const row of manual.items || []) {
      const desc = safeText(row.description || '', 120);
      if (!matchesTerm(desc)) continue;
      let eligible = true;
      let ineligibleReason = null;
      if (targetRes.parent.kind !== 'both' && targetRes.parent.kind !== row.kind) {
        eligible = false;
        ineligibleReason = `Categoria "${targetRes.parent.name}" incompatível com ${row.kind === 'income' ? 'receita' : 'despesa'}`;
      }
      candidates.push({
        key: `manual|${row.id}`,
        origin: 'manual',
        accountId: null,
        accountName: 'Manual',
        id: row.id,
        externalId: null,
        date: row.date,
        description: desc || 'Lançamento manual',
        rawDescription: desc,
        amountCents: Math.abs(row.amount || 0),
        txKind: row.kind,
        status: 'MANUAL',
        currentCategory: row.category || 'Outros',
        currentCategoryId: row.categoryId || null,
        currentSubcategoryId: row.subcategoryId || null,
        eligible,
        ineligibleReason
      });
    }
  }

  candidates.sort((a, b) => b.date.localeCompare(a.date) || b.amountCents - a.amountCents || a.key.localeCompare(b.key));
  const limited = candidates.slice(0, 100);
  const eligibleItems = limited.filter((x) => x.eligible);
  const excludedItems = limited.filter((x) => !x.eligible);

  if (eligibleItems.length === 0) {
    const extraReason = excludedItems.length
      ? ` Encontrei ${excludedItems.length} registro(s), porém bloqueados por segurança (${excludedItems[0].ineligibleReason}).`
      : '';
    return {
      matched: true,
      contract: 'MF3/ACTION-DRAFT-V1',
      intent: 'categorize',
      status: 'unavailable',
      effort: 'low',
      readOnly: true,
      changesApplied: false,
      source: scope.source,
      profile: scope.profile,
      month: scope.month,
      target: targetRes.target,
      targetLabel: targetRes.targetLabel,
      merchantQuery: cmd.merchantQuery,
      futureRuleRequested: cmd.futureRuleRequested,
      items: limited,
      eligibleCount: 0,
      excludedBySafetyCount: excludedItems.length,
      totalAmountCents: 0,
      answer: `Não encontrei movimentações elegíveis correspondentes a “${cmd.merchantQuery}” para classificar em **${targetRes.targetLabel}**.${extraReason}`,
      warnings: []
    };
  }

  const distinctAccounts = [...new Set(eligibleItems.map((i) => i.accountId).filter(Boolean))];
  const distinctDescriptions = new Set(eligibleItems.map((i) => fold(i.description)));
  const totalAmountCents = eligibleItems.reduce((n, it) => n + it.amountCents, 0);
  const warnings = [];
  if (candidates.length > 100) {
    warnings.push(`Mostrando os 100 registros mais recentes de ${candidates.length} encontrados (limite por lote).`);
  }
  if (excludedItems.length > 0) {
    warnings.push(`${excludedItems.length} lançamento(s) não elegível(is) (pendente, dividido ou transferência) foram isolados fora do lote.`);
  }
  if (distinctAccounts.length > 1) {
    warnings.push('Há lançamentos em mais de uma conta bancária; selecione uma única conta por confirmação nativa.');
  }
  if (distinctDescriptions.size > 1) {
    warnings.push(`Foram encontrados ${distinctDescriptions.size} nomes parecidos de estabelecimento; desmarque qualquer item indesejado antes de confirmar.`);
  }

  const futureRuleNotice = cmd.futureRuleRequested
    ? `Pedido separado para regra futura de “${cmd.merchantQuery}”: a reclassificação histórica e a criação de regra futura são tratadas em etapas distintas; aqui você confirma os lançamentos selecionados e pode depois solicitar “Sempre que aparecer ${cmd.merchantQuery}, coloque em ${targetRes.targetLabel}”.`
    : null;

  const action =
    scope.source === 'bank'
      ? eligibleItems.length === 1
        ? 'bank.categorize'
        : 'bank.batch-categorize'
      : eligibleItems.length === 1
        ? 'manual.categorize'
        : 'manual.batch-categorize';

  const effort =
    distinctAccounts.length > 1 || distinctDescriptions.size > 1 || cmd.futureRuleRequested ? 'high' : 'low';

  return finish({
    matched: true,
    contract: 'MF3/ACTION-DRAFT-V1',
    intent: 'categorize',
    status: 'ready',
    effort,
    readOnly: true,
    changesApplied: false,
    source: scope.source,
    profile: scope.profile,
    month: scope.month,
    action,
    target: targetRes.target,
    targetLabel: targetRes.targetLabel,
    merchantQuery: cmd.merchantQuery,
    items: limited,
    eligibleCount: eligibleItems.length,
    excludedBySafetyCount: excludedItems.length,
    totalAmountCents,
    accountIds: distinctAccounts,
    ambiguousAccounts: distinctAccounts.length > 1,
    ambiguousMerchants: distinctDescriptions.size > 1,
    futureRuleRequested: cmd.futureRuleRequested,
    futureRulePattern: cmd.futureRuleRequested ? cmd.merchantQuery : null,
    futureRuleNotice,
    warnings,
    answer:
      `Localizei **${eligibleItems.length} lançamento(s)** elegível(is) para **${cmd.merchantQuery}**. ` +
      `Revise a prévia para **${targetRes.targetLabel}** abaixo, desmarque se desejar excluir algum item e confirme na janela nativa antes de aplicar.`
  });
}

module.exports = {
  parseCategorizeCommand,
  parseRuleCreateCommand,
  parseCategoryStructureCommand,
  parseSingleBudgetCommand,
  parsePlanningCommand,
  resolveD05Target,
  interpretCopilotAction
};
