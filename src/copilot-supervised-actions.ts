/* M3 — Supervised Copilot Actions Renderer UI (S1..S4).
 * Runs in the same TypeScript module:none bundle as src/app.ts.
 * Never mutates SQLite directly; every write goes through D05PersonalWriteGateway IPC + native MAIN confirmation. */

const MF_M3_ACTION_GRANTS = new WeakMap<any, { access: any; signature: string; month: string; revision: number }>();
const MF_M3_ACTION_UI_STATE = new WeakMap<any, {
  selectedKeys: Set<string>;
  accountId: string | null;
  busy: boolean;
  capability: { available: boolean; enabled: boolean } | null;
  receipt: any | null;
  undoState: string | null;
  error: string;
  dismissed: boolean;
}>();

function copilotBindActionMessage(msg: any, access: any, signature: string, month: string, revision: number = 0) {
  if (access?.token) MF_M3_ACTION_GRANTS.set(msg, { access, signature, month, revision });
  return msg;
}

function copilotActionMessageLive(app: any, msg: any): boolean {
  const b = MF_M3_ACTION_GRANTS.get(msg);
  const access: LocalFinancialAccess = app?.state?.localFinancialAccess;
  const hasReceipt = !!(MF_M3_ACTION_UI_STATE.get(msg)?.receipt || MF_M3_SALARY_UI_STATE.get(msg)?.receipt);
  const curRevision = Number(app?.state?.financeRevision || 0);
  return !!b &&
    b.access === access &&
    !!access?.token &&
    b.signature === intelligencePremiumSignature(app) &&
    b.month === (app.state.localFinancialMonth || app.state.month) &&
    (hasReceipt || b.revision === curRevision) &&
    access?.profile === (app.state.mode === 'demo' ? 'demo' : 'real') &&
    (!access?.expiresAt || access.expiresAt > Date.now());
}

function copilotForceRender(app: any) {
  if (!app || typeof app.setState !== 'function') return;
  app.setState((prev: any) => ({ localFinancialError: prev?.localFinancialError || '' }));
}

async function copilotRefreshAppData(app: any, profile: string) {
  const api = desktop as any;
  if (!api || !app) return;
  try {
    if (typeof api.load === 'function') {
      const latest = await api.load(profile);
      if (latest) app.setState({ data: safeData(latest) });
    }
  } catch { /* keep UI stable if manual reload interrupted */ }
  try {
    if (typeof app.refreshBank === 'function') await app.refreshBank();
  } catch { /* ignore */ }
  try {
    if (typeof app.refreshCategories === 'function') await app.refreshCategories();
    if (typeof app.loadQA84VisualCatalog === 'function') void app.loadQA84VisualCatalog();
  } catch { /* ignore */ }
  try {
    if (typeof app.refreshPlanning === 'function') await app.refreshPlanning();
  } catch { /* ignore */ }
  try {
    if (typeof app.setState === 'function') {
      app.setState((prev: any) => ({ financeRevision: Number(prev?.financeRevision || 0) + 1 }));
    }
  } catch { /* ignore */ }
  try {
    if (app.state?.localFinancialAccess?.token) {
      if (typeof localFinancialRadar === 'function') void localFinancialRadar(app);
      if (typeof intelligencePremiumLoad === 'function') void intelligencePremiumLoad(app);
      if (typeof intelligenceCopilotInsightsLoad === 'function') void intelligenceCopilotInsightsLoad(app);
    }
  } catch { /* ignore */ }
}

function copilotEffortLabel(effort: string): string {
  if (effort === 'high') return 'Alto';
  if (effort === 'medium') return 'Médio';
  return 'Baixo';
}

function copilotParseBrlCents(raw: any): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 0 && raw <= 100_000_000_000 ? raw : null;
  }
  const clean = String(raw || '').replace(/r\$/gi, '').replace(/\s+/g, '').trim();
  if (!clean) return null;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(clean)) {
    const [i, f = ''] = clean.split(',');
    const val = Number(i.replace(/\./g, '')) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
    return Number.isSafeInteger(val) && val >= 0 && val <= 100_000_000_000 ? val : null;
  }
  if (/^\d+(?:,\d{1,2})?$/.test(clean)) {
    const [i, f = ''] = clean.split(',');
    const val = Number(i) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
    return Number.isSafeInteger(val) && val >= 0 && val <= 100_000_000_000 ? val : null;
  }
  if (/^\d+\.\d{1,2}$/.test(clean)) {
    const [i, f = ''] = clean.split('.');
    const val = Number(i) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
    return Number.isSafeInteger(val) && val >= 0 && val <= 100_000_000_000 ? val : null;
  }
  return null;
}

function copilotFormatEditCents(cents: number): string {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',');
}

const MF_M3_SALARY_UI_STATE = new WeakMap<any, {
  selectedCats: Set<string>;
  lockedCats: Set<string>;
  editedCents: Map<string, number>;
  editedText: Map<string, string>;
  updateIncome: boolean;
  applyRecurring: boolean;
  busy: boolean;
  capability: { available: boolean; enabled: boolean } | null;
  receipt: any | null;
  undoState: string | null;
  error: string;
  dismissed: boolean;
}>();

function copilotGetSalaryUiState(keyObj: any, draft: any) {
  let st = MF_M3_SALARY_UI_STATE.get(keyObj);
  if (st) return st;
  const items: any[] = Array.isArray(draft?.items) ? draft.items : [];
  const selectedCats = new Set<string>();
  const lockedCats = new Set<string>(Array.isArray(draft?.lockedCategories) ? draft.lockedCategories : []);
  const editedCents = new Map<string, number>();
  const editedText = new Map<string, string>();
  for (const it of items) {
    if (!it?.category) continue;
    selectedCats.add(it.category);
    if (it.isLocked) lockedCats.add(it.category);
    const val = Number.isSafeInteger(it.proposedLimitCents) ? it.proposedLimitCents : 0;
    editedCents.set(it.category, val);
    editedText.set(it.category, copilotFormatEditCents(val));
  }
  st = {
    selectedCats,
    lockedCats,
    editedCents,
    editedText,
    updateIncome: !!draft?.updateIncomeSetting,
    applyRecurring: !!draft?.applyRecurring,
    busy: false,
    capability: draft?.capability || null,
    receipt: null,
    undoState: null,
    error: '',
    dismissed: false
  };
  MF_M3_SALARY_UI_STATE.set(keyObj, st);
  return st;
}

async function copilotEnableSalaryCapability(app: any, keyObj: any, draft: any, onChange?: () => void) {
  const api = desktop as any;
  const st = copilotGetSalaryUiState(keyObj, draft);
  if (!api?.copilotActionCapabilityEnable || st.busy) return;
  st.busy = true;
  st.error = '';
  if (onChange) onChange(); else copilotForceRender(app);
  try {
    const res = await api.copilotActionCapabilityEnable();
    st.capability = {
      available: st.capability ? !!st.capability.available : true,
      enabled: !!res?.enabled
    };
    if (res?.cancelled && !res?.enabled) {
      st.error = 'Ativação cancelada. Nenhuma permissão foi concedida.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível ativar as ações supervisionadas.');
  } finally {
    st.busy = false;
    if (onChange) onChange(); else copilotForceRender(app);
  }
}

function copilotCollectLocksPayload(st: any): Record<string, number> {
  const lockedCategories: Record<string, number> = {};
  for (const cat of st.lockedCats || []) {
    const cents = st.editedCents.get(cat);
    if (Number.isSafeInteger(cents) && (cents as number) >= 0) {
      lockedCategories[cat] = cents as number;
    }
  }
  return lockedCategories;
}

async function copilotRecalcSalaryDraft(
  app: any,
  keyObj: any,
  draft: any,
  mode: string,
  onReplaceDraft: (next: any) => void
) {
  const api = desktop as any;
  const st = copilotGetSalaryUiState(keyObj, draft);
  if (!api?.copilotSalaryBudgetPropose || st.busy || st.receipt) return;
  st.busy = true;
  st.error = '';
  copilotForceRender(app);
  try {
    const accessToken = app?.state?.localFinancialAccess?.token;
    const nextDraft = await api.copilotSalaryBudgetPropose({
      ...(typeof accessToken === 'string' && accessToken ? { token: accessToken } : {}),
      profile: draft.profile,
      source: draft.source,
      month: draft.month,
      salaryCents: draft.salaryCents,
      reserveGoalCents: draft.requestedReserveCents ?? null,
      profileMode: mode,
      lockedCategories: copilotCollectLocksPayload(st),
      updateIncomeSetting: st.updateIncome,
      applyRecurring: st.applyRecurring
    });
    if (nextDraft?.contract === 'MF3/SALARY-BUDGET-PROPOSAL-V1') {
      nextDraft.capability = st.capability;
      MF_M3_SALARY_UI_STATE.delete(keyObj);
      const nextSt = copilotGetSalaryUiState(keyObj, nextDraft);
      for (const c of st.lockedCats) nextSt.lockedCats.add(c);
      nextSt.applyRecurring = st.applyRecurring;
      nextSt.updateIncome = st.updateIncome;
      onReplaceDraft(nextDraft);
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível recalcular os orçamentos.');
    st.busy = false;
    copilotForceRender(app);
  }
}

async function copilotSwitchSalaryMode(app: any, keyObj: any, draft: any, mode: string, onReplaceDraft: (next: any) => void) {
  return copilotRecalcSalaryDraft(app, keyObj, draft, mode, onReplaceDraft);
}

async function copilotExecuteSalaryBudget(app: any, keyObj: any, draft: any, onChange?: () => void) {
  const api = desktop as any;
  const st = copilotGetSalaryUiState(keyObj, draft);
  if (!api || st.busy || st.receipt) return;
  const items: any[] = Array.isArray(draft?.items) ? draft.items : [];
  const budgets: Array<{ category: string; amountCents: number }> = [];
  for (const it of items) {
    if (!st.selectedCats.has(it.category)) continue;
    const rawCents = st.editedCents.get(it.category);
    if (!Number.isSafeInteger(rawCents) || (rawCents as number) < 0) {
      st.error = `Valor inválido para a categoria "${it.category}". Use formato monetário válido (ex.: 1.250,00).`;
      if (onChange) onChange(); else copilotForceRender(app);
      return;
    }
    budgets.push({ category: it.category, amountCents: rawCents as number });
  }
  if (!budgets.length) {
    st.error = 'Selecione ao menos uma categoria para aplicar novos limites.';
    if (onChange) onChange(); else copilotForceRender(app);
    return;
  }
  if (!api.d05SessionAuthorize || !api.copilotActionPrepare || !api.copilotActionConfirm) {
    st.error = 'Bridge desktop de ações supervisionadas indisponível nesta sessão.';
    if (onChange) onChange(); else copilotForceRender(app);
    return;
  }

  st.busy = true;
  st.error = '';
  if (onChange) onChange(); else copilotForceRender(app);
  try {
    await api.d05SessionAuthorize({ profile: draft.profile });
    const prepared = await api.copilotActionPrepare({
      action: 'budgets.reorganize',
      profile: draft.profile,
      month: draft.month,
      applyRecurring: !!st.applyRecurring,
      budgets,
      updateIncomeSetting: st.updateIncome,
      ...(st.updateIncome ? { salaryCents: draft.salaryCents } : {})
    });
    if (!prepared || prepared.contract !== 'D05/PERSONAL-SUPERVISED-PREVIEW-V1') {
      throw Error('Prévia oficial D05 não confirmada.');
    }
    if (prepared.personalWriteAuthorized === false) {
      if (typeof api.copilotActionCapabilityStatus === 'function') {
        const cap = await api.copilotActionCapabilityStatus().catch(() => null);
        if (cap) st.capability = { available: !!cap.available, enabled: !!cap.enabled };
      }
      st.error = 'Ative primeiro "Ações supervisionadas do Copiloto" para autorizar gravações locais com confirmação nativa.';
      return;
    }
    const confirmed = await api.copilotActionConfirm({
      proposalId: prepared.proposalId,
      nonce: prepared.nonce
    });
    if (confirmed?.status === 'applied' && confirmed.changesApplied === true) {
      st.receipt = confirmed.receipt;
      st.undoState = confirmed.undoState || 'available';
      await copilotRefreshAppData(app, draft.profile);
    } else if (confirmed?.status === 'denied') {
      st.error = confirmed.reason || 'Confirmação cancelada ou negada. Nenhuma alteração foi gravada.';
    } else {
      st.error = confirmed?.reason || 'Os orçamentos mudaram antes da confirmação; gere uma nova simulação.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível aplicar a reorganização de orçamentos.');
  } finally {
    st.busy = false;
    if (onChange) onChange(); else copilotForceRender(app);
  }
}

async function copilotUndoSalaryBudget(app: any, keyObj: any, draft: any, onChange?: () => void) {
  const api = desktop as any;
  const st = copilotGetSalaryUiState(keyObj, draft);
  if (!api?.copilotActionUndo || !st.receipt || st.busy || st.undoState !== 'available') return;

  st.busy = true;
  st.error = '';
  if (onChange) onChange(); else copilotForceRender(app);
  try {
    await api.d05SessionAuthorize({ profile: draft.profile });
    const res = await api.copilotActionUndo({ proposalId: st.receipt.proposalId });
    if (res?.status === 'undone') {
      st.undoState = 'undone';
      st.receipt = res.receipt || st.receipt;
      await copilotRefreshAppData(app, draft.profile);
    } else if (res?.status === 'already_undone') {
      st.undoState = 'undone';
    } else {
      st.error = res?.reason || 'Os orçamentos foram alterados posteriormente; reversão automática bloqueada.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível desfazer a reorganização.');
  } finally {
    st.busy = false;
    if (onChange) onChange(); else copilotForceRender(app);
  }
}

function renderSalaryBudgetProposalBox(
  app: any,
  keyObj: any,
  draft: any,
  opts: { onReplaceDraft?: (next: any) => void; onDismiss?: () => void } = {}
) {
  if (!draft || draft.contract !== 'MF3/SALARY-BUDGET-PROPOSAL-V1') return null;

  if (draft.status === 'needs_clarification') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Esclarecimento de salário' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'REORGANIZAÇÃO POR SALÁRIO'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Informe o salário')),
      h('p', { className: 'mf-m3-action-muted' }, draft.answer));
  }

  const st = copilotGetSalaryUiState(keyObj, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' },
      'Proposta salarial descartada · nenhuma alteração foi gravada nos orçamentos.');
  }

  const items: any[] = Array.isArray(draft.items) ? draft.items : [];
  let selectedCount = 0;
  let selectedTotalCents = 0;
  let invalidInput = false;
  for (const it of items) {
    if (!st.selectedCats.has(it.category)) continue;
    selectedCount++;
    const c = st.editedCents.get(it.category);
    if (Number.isSafeInteger(c) && (c as number) >= 0) {
      selectedTotalCents += c as number;
    } else {
      invalidInput = true;
    }
  }
  const marginAfterEdits = draft.salaryCents - selectedTotalCents;
  const needOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;
  const confidenceLabel =
    draft.confidence === 'high' ? `Base forte (${draft.completeMonthsAnalyzed} meses completos)` :
    draft.confidence === 'medium' ? `Base média (${draft.completeMonthsAnalyzed} meses completos)` :
    draft.completeMonthsAnalyzed === 1 ? 'Base inicial (1 mês completo)' : 'Estimativa sem histórico completo';

  const statusText = st.receipt
    ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo')
    : 'Simulação · nada gravado';
  const statusClass = st.receipt
    ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact')
    : 'mf-ic2-epistemic-badge is-simulation';
  const salaryProvenanceLabel =
    draft.salaryStatus === 'received_in_statement'
      ? `Salário detectado nas entradas (${fmt(draft.observedSalaryCents || draft.observedIncomeCents || 0)}) · sem duplicação`
      : `Referência prevista para ${draft.month}` + (draft.plannedIncomeCents > 0 ? ` · Previsto aberto ${fmt(draft.plannedIncomeCents)}` : '');

  return h('div', { className: 'mf-m3-action-card mf-m3-salary-card', role: 'region', 'aria-label': 'Reorganização de orçamentos por salário' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' },
        `PLANO POR SALÁRIO · ${draft.source === 'bank' ? 'CONTAS CONECTADAS' : 'MANUAL'} · ${draft.month} · ` +
        (st.applyRecurring ? 'MÊS + RECORRENTE' : 'VÁLIDO NESTE MÊS')),
      h('div', { className: 'mf-m3-action-badges' },
        draft.revision && draft.revision > 1
          ? h('span', { className: 'mf-ic2-pill is-strong' }, `Revisão v${draft.revision}`)
          : null,
        h('span', { className: 'mf-ic2-pill' }, confidenceLabel),
        h('span', { className: statusClass }, statusText))),

    Array.isArray(draft.revisionDiff) && draft.revisionDiff.length > 0
      ? h('div', { className: 'mf-m3-salary-revision-diff', role: 'note' },
          h('strong', {}, `Alterações na revisão v${draft.revision}: `),
          ...draft.revisionDiff.slice(0, 5).map((d: any, idx: number) =>
            h('span', { key: idx, className: 'mf-ic2-pill' },
              `${d.category}: ${d.deltaCents > 0 ? '+' : '−'}${fmt(Math.abs(d.deltaCents))}`)
          ))
      : null,

    h('p', { className: 'mf-m3-salary-submeta' },
      salaryProvenanceLabel + (draft.incomeVsBalanceNote ? ' · ' + draft.incomeVsBalanceNote : '')),

    h('div', { className: 'mf-m3-salary-kpis' },
      h('div', { className: 'mf-m3-salary-kpi' },
        h('small', {}, 'Salário informado'),
        h('strong', {}, fmt(draft.salaryCents))),
      h('div', { className: 'mf-m3-salary-kpi' },
        h('small', {}, `Limites selecionados (${selectedCount})`),
        h('strong', {}, fmt(selectedTotalCents))),
      h('div', { className: 'mf-m3-salary-kpi ' + (marginAfterEdits < 0 ? 'is-deficit' : 'is-surplus') },
        h('small', {}, marginAfterEdits < 0 ? 'Déficit sobre salário' : 'Margem / Reserva'),
        h('strong', {}, (marginAfterEdits < 0 ? '−' : '') + fmt(Math.abs(marginAfterEdits))))),

    Array.isArray(draft.redistributions) && draft.redistributions.length > 0
      ? h('div', { className: 'mf-m3-salary-redistributions', role: 'region', 'aria-label': 'Redistribuições propostas' },
          h('strong', {}, `Redistribuições recomendadas (${draft.redistributions.length})`),
          h('ul', {},
            ...draft.redistributions.slice(0, 6).map((rd: any, idx: number) =>
              h('li', { key: idx },
                h('b', {}, `${rd.fromCategory} → ${rd.toCategory} (${fmt(rd.amountCents)})`),
                h('span', {}, ` — ${rd.reason}`)))))
      : null,

    !st.receipt && typeof (desktop as any)?.copilotSalaryBudgetPropose === 'function' && opts.onReplaceDraft
      ? h('div', { className: 'mf-m3-salary-modes', role: 'group', 'aria-label': 'Perfil de distribuição' },
          [
            { id: 'conservative', label: 'Conservador (20%)' },
            { id: 'balanced', label: 'Equilibrado (15%)' },
            { id: 'flexible', label: 'Flexível (10%)' }
          ].map((m) =>
            h('button', {
              key: m.id,
              type: 'button',
              className: 'mf-ic2-followup-chip' + (draft.profileMode === m.id ? ' is-active' : ''),
              disabled: st.busy,
              onClick: () => void copilotSwitchSalaryMode(app, keyObj, draft, m.id, opts.onReplaceDraft!)
            }, m.label)
          ))
      : null,

    Array.isArray(draft.warnings) && draft.warnings.length > 0
      ? h('div', { className: 'mf-m3-action-warnings' },
          ...draft.warnings.map((w: string, i: number) =>
            h('p', { key: i, className: 'mf-m3-action-notice' }, w)))
      : null,

    h('div', { className: 'mf-m3-salary-list', role: 'list', 'aria-label': 'Limites propostos por categoria' },
      ...items.map((it) => {
        const checked = st.selectedCats.has(it.category);
        const locked = st.lockedCats.has(it.category);
        const identity = resolveCategoryVisualIdentity({
          categoryName: it.category,
          catalog: app?.state?.qa84VisualCatalog || [],
          aggregate: true
        });
        const editedVal = st.editedCents.get(it.category);
        const currentDiff = it.currentLimitCents !== null && Number.isSafeInteger(editedVal)
          ? (editedVal as number) - it.currentLimitCents
          : null;
        return h('div', { key: it.category, role: 'listitem', className: 'mf-m3-salary-row' + (checked ? ' is-selected' : '') + (locked ? ' is-locked' : '') },
          h('input', {
            type: 'checkbox',
            checked,
            disabled: !!st.receipt || st.busy,
            'aria-label': 'Incluir ' + it.category,
            onChange: (e: any) => {
              if (e.target.checked) st.selectedCats.add(it.category);
              else st.selectedCats.delete(it.category);
              st.error = '';
              copilotForceRender(app);
            }
          }),
          h(CategoryVisualGlyph, { identity, size: 19 }),
          h('div', { className: 'mf-m3-salary-row-copy' },
            h('div', { className: 'mf-m3-salary-row-title' },
              h('strong', {}, it.category),
              h('span', { className: 'mf-ic2-pill' }, it.tierLabel),
              it.isProtected ? h('span', { className: 'mf-ic2-pill is-strong' }, 'Preservada') : null,
              it.atypicalDetected ? h('span', { className: 'mf-ic2-pill' }, 'Mês atípico') : null,
              !st.receipt && checked && opts.onReplaceDraft
                ? h('button', {
                    type: 'button',
                    className: 'mf-m3-salary-lock-btn' + (locked ? ' is-active' : ''),
                    disabled: st.busy,
                    'aria-pressed': locked,
                    onClick: () => {
                      if (st.lockedCats.has(it.category)) st.lockedCats.delete(it.category);
                      else st.lockedCats.add(it.category);
                      void copilotRecalcSalaryDraft(app, keyObj, draft, draft.profileMode || 'balanced', opts.onReplaceDraft!);
                    }
                  }, locked ? 'Fixado' : 'Fixar')
                : locked ? h('span', { className: 'mf-ic2-pill is-strong' }, 'Fixado') : null),
            h('small', {},
              `Atual: ${it.currentLimitCents !== null ? fmt(it.currentLimitCents) : 'Sem limite'} · ` +
              `3m: ${fmt(it.avg3mCents ?? it.historicalAvgCents)} · ` +
              `6m: ${fmt(it.avg6mCents ?? it.historicalAvgCents)} · ` +
              `Realizado+Prev.: ${fmt(it.committedFloorCents)}` +
              (currentDiff !== null && currentDiff !== 0
                ? ` (${currentDiff > 0 ? '+' : '−'}${fmt(Math.abs(currentDiff))})`
                : '')),
            h('small', { className: 'mf-m3-salary-rationale' }, it.rationale)),
          h('label', { className: 'mf-m3-salary-input-wrap' },
            h('span', {}, 'Novo R$'),
            h('input', {
              type: 'text',
              inputMode: 'decimal',
              disabled: !!st.receipt || st.busy || !checked,
              value: st.editedText.get(it.category) ?? copilotFormatEditCents(it.proposedLimitCents),
              'aria-label': 'Novo limite em reais para ' + it.category,
              onChange: (e: any) => {
                const text = String(e.target.value);
                st.editedText.set(it.category, text);
                const parsed = copilotParseBrlCents(text);
                if (parsed !== null) st.editedCents.set(it.category, parsed);
                else st.editedCents.delete(it.category);
                st.error = '';
                copilotForceRender(app);
              }
            })));
      })),

    !st.receipt
      ? h('div', { className: 'mf-m3-salary-options' },
          h('label', { className: 'mf-m3-salary-income-opt' },
            h('input', {
              type: 'checkbox',
              checked: st.applyRecurring,
              disabled: st.busy,
              onChange: (e: any) => {
                st.applyRecurring = !!e.target.checked;
                copilotForceRender(app);
              }
            }),
            h('span', {}, `Aplicar também como limite recorrente para os próximos meses (padrão: somente ${draft.month})`)),
          h('label', { className: 'mf-m3-salary-income-opt' },
            h('input', {
              type: 'checkbox',
              checked: st.updateIncome,
              disabled: st.busy,
              onChange: (e: any) => {
                st.updateIncome = !!e.target.checked;
                copilotForceRender(app);
              }
            }),
            h('span', {}, `Atualizar também renda mensal de referência no perfil para ${fmt(draft.salaryCents)} (não cria lançamento no extrato)`)))
      : null,

    needOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Para gravar esses novos limites no banco SQLite com confirmação nativa e reversão, ative antes as ações supervisionadas.'),
          h('button', {
            type: 'button',
            className: 'secondary-button',
            disabled: st.busy,
            onClick: () => void copilotEnableSalaryCapability(app, keyObj, draft)
          }, st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,

    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {},
              st.undoState === 'undone'
                ? 'Limites anteriores restaurados com sucesso'
                : `Orçamentos atualizados em ${st.receipt.affectedCount || selectedCount} categoria(s)`),
            h('small', {}, `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', {
                type: 'button',
                className: 'ghost-button',
                disabled: st.busy,
                onClick: () => void copilotUndoSalaryBudget(app, keyObj, draft)
              }, st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || selectedCount === 0 || invalidInput || !!needOptIn,
            onClick: () => void copilotExecuteSalaryBudget(app, keyObj, draft)
          }, st.busy ? 'Aguardando confirmação…' : `Confirmar e aplicar (${selectedCount} categorias)`),
          h('button', {
            type: 'button',
            className: 'ghost-button',
            disabled: st.busy,
            onClick: () => {
              if (opts.onDismiss) opts.onDismiss();
              else { st.dismissed = true; st.error = ''; copilotForceRender(app); }
            }
          }, 'Descartar')),

    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}

function renderBudgetsSalaryPanel(app: any, useBank: boolean) {
  const api = desktop as any;
  if (!api?.copilotSalaryBudgetPropose) return null;
  const curMonth = String(app?.state?.month || '');
  const curMode = String(app?.state?.mode || 'real');
  const curRev = Number(app?.state?.financeRevision || 0);
  if (!app.__m3SalaryPanel) {
    const curInc = app?.state?.data?.settings?.income;
    app.__m3SalaryPanel = {
      open: false,
      month: curMonth,
      mode: curMode,
      useBank,
      revision: curRev,
      salaryText: curInc > 0 ? copilotFormatEditCents(curInc) : '',
      reserveText: '',
      profileMode: 'balanced',
      busy: false,
      error: '',
      proposal: null
    };
  }
  const panel = app.__m3SalaryPanel;
  const contextChanged =
    panel.month !== curMonth ||
    panel.mode !== curMode ||
    panel.useBank !== useBank ||
    panel.revision !== curRev;
  if (contextChanged) {
    const hasReceipt = !!(panel.proposal && MF_M3_SALARY_UI_STATE.get(panel.proposal)?.receipt);
    if (panel.mode !== curMode) {
      const nextInc = app?.state?.data?.settings?.income;
      panel.proposal = null;
      panel.error = '';
      panel.open = false;
      panel.salaryText = nextInc > 0 ? copilotFormatEditCents(nextInc) : '';
    } else if (!hasReceipt) {
      panel.proposal = null;
      panel.error = '';
    }
    panel.month = curMonth;
    panel.mode = curMode;
    panel.useBank = useBank;
    panel.revision = curRev;
  }
  if (!panel.open) return null;

  const generate = async () => {
    const salaryCents = copilotParseBrlCents(panel.salaryText);
    if (!salaryCents || salaryCents <= 0) {
      panel.error = 'Informe um salário líquido mensal válido em reais (ex.: 7.500,00).';
      copilotForceRender(app);
      return;
    }
    const reserveTrim = String(panel.reserveText || '').trim();
    let reserveGoalCents: number | null = null;
    if (reserveTrim) {
      reserveGoalCents = copilotParseBrlCents(reserveTrim);
      if (reserveGoalCents === null || reserveGoalCents > salaryCents) {
        panel.error = 'Meta de reserva inválida ou maior que o salário informado.';
        copilotForceRender(app);
        return;
      }
    }
    panel.busy = true;
    panel.error = '';
    copilotForceRender(app);
    try {
      const profile = app.state.mode === 'demo' ? 'demo' : 'real';
      const source = profile === 'demo' ? 'manual' : useBank ? 'bank' : 'manual';
      const draft = await api.copilotSalaryBudgetPropose({
        profile,
        source,
        month: app.state.month,
        salaryCents,
        reserveGoalCents,
        profileMode: panel.profileMode,
        updateIncomeSetting: false
      });
      const cap = typeof api.copilotActionCapabilityStatus === 'function'
        ? await api.copilotActionCapabilityStatus().catch(() => null)
        : null;
      if (draft) draft.capability = cap ? { available: !!cap.available, enabled: !!cap.enabled } : null;
      panel.proposal = draft;
    } catch (e: any) {
      panel.error = String(e?.message || 'Não foi possível calcular a reorganização.');
    } finally {
      panel.busy = false;
      copilotForceRender(app);
    }
  };

  return h('section', { className: 'mf-m3-salary-panel card', role: 'region', 'aria-label': 'Planejador de orçamento por salário' },
    h('div', { className: 'mf-m3-salary-panel-head' },
      h('div', {},
        h('span', { className: 'micro-label' }, 'PLANEJADOR POR SALÁRIO'),
        h('h2', {}, 'Reorganizar limites a partir do seu salário mensal'),
        h('p', {}, 'Calcula médias reais apenas de meses completos anteriores, soma compromissos restantes do Planejamento e exige sua confirmação antes de alterar limites.')),
      h('button', {
        type: 'button',
        className: 'ghost-button',
        onClick: () => { panel.open = false; copilotForceRender(app); }
      }, 'Fechar')),

    h('div', { className: 'mf-m3-salary-form' },
      h('label', {}, 'Salário mensal líquido (R$)',
        h('input', {
          type: 'text',
          inputMode: 'decimal',
          placeholder: 'Ex.: 7.500,00',
          value: panel.salaryText,
          disabled: panel.busy,
          onChange: (e: any) => { panel.salaryText = String(e.target.value); panel.error = ''; copilotForceRender(app); }
        })),
      h('label', {}, 'Meta de reserva (R$, opcional)',
        h('input', {
          type: 'text',
          inputMode: 'decimal',
          placeholder: 'Padrão pelo perfil',
          value: panel.reserveText,
          disabled: panel.busy,
          onChange: (e: any) => { panel.reserveText = String(e.target.value); panel.error = ''; copilotForceRender(app); }
        })),
      h('label', {}, 'Estratégia',
        h('select', {
          value: panel.profileMode,
          disabled: panel.busy,
          onChange: (e: any) => { panel.profileMode = String(e.target.value); copilotForceRender(app); }
        },
          h('option', { value: 'conservative' }, 'Conservador (20% reserva)'),
          h('option', { value: 'balanced' }, 'Equilibrado (15% reserva)'),
          h('option', { value: 'flexible' }, 'Flexível (10% reserva)'))),
      h('button', {
        type: 'button',
        className: 'primary-button',
        disabled: panel.busy,
        onClick: () => void generate()
      }, panel.busy ? 'Calculando…' : 'Simular reorganização')),

    panel.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, panel.error) : null,
    panel.proposal
      ? renderSalaryBudgetProposalBox(app, panel.proposal, panel.proposal, {
          onReplaceDraft: (nextDraft) => { panel.proposal = nextDraft; copilotForceRender(app); },
          onDismiss: () => { panel.proposal = null; copilotForceRender(app); }
        })
      : null);
}

function copilotGetActionUiState(msg: any, draft: any) {
  let st = MF_M3_ACTION_UI_STATE.get(msg);
  if (st) return st;
  const items: any[] = Array.isArray(draft?.items) ? draft.items : [];
  const accounts: string[] = Array.isArray(draft?.accountIds) ? draft.accountIds : [];
  const defaultAccountId = draft?.source === 'bank' && accounts.length > 0 ? accounts[0] : null;
  const initialSelected = new Set<string>();
  for (const item of items) {
    if (!item?.eligible) continue;
    if (defaultAccountId && draft?.ambiguousAccounts && item.accountId !== defaultAccountId) continue;
    initialSelected.add(String(item.key));
  }
  st = {
    selectedKeys: initialSelected,
    accountId: defaultAccountId,
    busy: false,
    capability: draft?.capability || null,
    receipt: null,
    undoState: null,
    error: '',
    dismissed: false
  };
  MF_M3_ACTION_UI_STATE.set(msg, st);
  return st;
}

async function copilotEnableSupervisedCapability(app: any, msg: any, draft: any) {
  const api = desktop as any;
  const st = copilotGetActionUiState(msg, draft);
  if (!api?.copilotActionCapabilityEnable || st.busy) return;
  st.busy = true;
  st.error = '';
  copilotForceRender(app);
  try {
    const res = await api.copilotActionCapabilityEnable();
    st.capability = {
      available: st.capability ? !!st.capability.available : true,
      enabled: !!res?.enabled
    };
    if (res?.cancelled && !res?.enabled) {
      st.error = 'Ativação cancelada. Nenhuma permissão foi concedida.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível ativar as ações supervisionadas.');
  } finally {
    st.busy = false;
    copilotForceRender(app);
  }
}

async function copilotExecuteSupervisedAction(app: any, msg: any, draft: any) {
  const api = desktop as any;
  const st = copilotGetActionUiState(msg, draft);
  if (!api || st.busy || st.receipt) return;
  const allItems: any[] = Array.isArray(draft?.items) ? draft.items : [];
  const selected = allItems.filter((it) => it?.eligible && st.selectedKeys.has(String(it.key)));
  if (selected.length === 0) {
    st.error = 'Selecione ao menos uma movimentação elegível para continuar.';
    copilotForceRender(app);
    return;
  }

  let accountId: string | null = null;
  if (draft.source === 'bank') {
    const pickedAccounts = [...new Set(selected.map((it) => it.accountId).filter(Boolean))];
    if (pickedAccounts.length !== 1) {
      st.error = 'Selecione lançamentos de apenas uma conta bancária por confirmação.';
      copilotForceRender(app);
      return;
    }
    accountId = String(pickedAccounts[0]);
  }

  if (!api.d05SessionAuthorize || !api.copilotActionPrepare || !api.copilotActionConfirm) {
    st.error = 'Bridge desktop de ações supervisionadas indisponível nesta sessão.';
    copilotForceRender(app);
    return;
  }

  st.busy = true;
  st.error = '';
  copilotForceRender(app);
  try {
    await api.d05SessionAuthorize({ profile: draft.profile });
    if (draft.source === 'bank' && accountId) {
      await api.d05BankAccountAuthorize({ accountId });
    }

    let action = '';
    const preparePayload: any = {
      profile: draft.profile,
      target: {
        categoryId: draft.target?.categoryId,
        subcategoryId: draft.target?.subcategoryId ?? null
      }
    };

    if (draft.source === 'bank') {
      preparePayload.accountId = accountId;
      if (selected.length === 1) {
        action = 'bank.categorize';
        preparePayload.externalId = selected[0].externalId || selected[0].id;
      } else {
        action = 'bank.batch-categorize';
        const batchItems = selected.map((it) => ({
          accountId: it.accountId,
          externalId: it.externalId || it.id
        }));
        const previewBatch = await api.d05BankBatchPreview({
          items: batchItems,
          target: preparePayload.target
        });
        preparePayload.items = batchItems;
        preparePayload.previewVersion = previewBatch.previewVersion;
      }
    } else {
      if (selected.length === 1) {
        action = 'manual.categorize';
        preparePayload.id = selected[0].id;
      } else {
        action = 'manual.batch-categorize';
        preparePayload.items = selected.map((it) => ({ id: it.id }));
      }
    }

    preparePayload.action = action;
    const prepared = await api.copilotActionPrepare(preparePayload);
    if (!prepared || prepared.contract !== 'D05/PERSONAL-SUPERVISED-PREVIEW-V1') {
      throw Error('Prévia oficial D05 não confirmada.');
    }
    if (prepared.personalWriteAuthorized === false) {
      if (typeof api.copilotActionCapabilityStatus === 'function') {
        const cap = await api.copilotActionCapabilityStatus().catch(() => null);
        if (cap) st.capability = { available: !!cap.available, enabled: !!cap.enabled };
      }
      st.error = 'Ative primeiro "Ações supervisionadas do Copiloto" para autorizar gravações locais com confirmação nativa.';
      return;
    }

    const confirmed = await api.copilotActionConfirm({
      proposalId: prepared.proposalId,
      nonce: prepared.nonce,
      ...(accountId ? { accountId } : {})
    });

    if (confirmed?.status === 'applied' && confirmed.changesApplied === true) {
      st.receipt = confirmed.receipt;
      st.undoState = confirmed.undoState || 'available';
      await copilotRefreshAppData(app, draft.profile);
    } else if (confirmed?.status === 'denied') {
      st.error = confirmed.reason || 'Confirmação cancelada ou negada. Nenhuma alteração foi gravada.';
    } else {
      st.error = confirmed?.reason || 'Os registros mudaram antes da confirmação; solicite uma nova prévia.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível concluir a ação supervisionada.');
  } finally {
    st.busy = false;
    copilotForceRender(app);
  }
}

async function copilotUndoSupervisedAction(app: any, msg: any, draft: any) {
  const api = desktop as any;
  const st = copilotGetActionUiState(msg, draft);
  if (!api?.copilotActionUndo || !st.receipt || st.busy || st.undoState !== 'available') return;

  st.busy = true;
  st.error = '';
  copilotForceRender(app);
  try {
    await api.d05SessionAuthorize({ profile: draft.profile });
    if (st.receipt.accountId && typeof api.d05BankAccountAuthorize === 'function') {
      await api.d05BankAccountAuthorize({ accountId: st.receipt.accountId });
    }
    const res = await api.copilotActionUndo({
      proposalId: st.receipt.proposalId,
      ...(st.receipt.accountId ? { accountId: st.receipt.accountId } : {})
    });
    if (res?.status === 'undone') {
      st.undoState = 'undone';
      st.receipt = res.receipt || st.receipt;
      await copilotRefreshAppData(app, draft.profile);
    } else if (res?.status === 'already_undone') {
      st.undoState = 'undone';
    } else {
      st.error = res?.reason || 'Não foi possível desfazer automaticamente este recibo.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Erro ao tentar desfazer a operação.');
  } finally {
    st.busy = false;
    copilotForceRender(app);
  }
}

function copilotGetGenericDraftUiState(msg: any, draft: any) {
  let st = MF_M3_ACTION_UI_STATE.get(msg);
  if (st) return st;
  const accounts: string[] = Array.isArray(draft?.accountIds) ? draft.accountIds : [];
  const defaultAccountId = accounts.length > 0 ? accounts[0] : null;
  st = {
    selectedKeys: new Set<string>(draft?.proposedLimitCents !== undefined ? [String(draft.proposedLimitCents)] : []),
    accountId: defaultAccountId,
    busy: false,
    capability: draft?.capability || null,
    receipt: null,
    undoState: null,
    error: '',
    dismissed: false
  };
  (st as any).applyRecurring = !!draft?.applyRecurring;
  (st as any).editedLimitText =
    Number.isSafeInteger(draft?.proposedLimitCents) ? copilotFormatEditCents(draft.proposedLimitCents) : '';
  MF_M3_ACTION_UI_STATE.set(msg, st);
  return st;
}

async function copilotEnableGenericCapability(app: any, msg: any, draft: any) {
  return copilotEnableSupervisedCapability(app, msg, draft);
}

async function copilotGenericExecute(app: any, msg: any, draft: any, preparePayload: any, accountId: string | null = null) {
  const api = desktop as any;
  const st = copilotGetGenericDraftUiState(msg, draft);
  if (!api || st.busy || st.receipt) return;
  if (!api.d05SessionAuthorize || !api.copilotActionPrepare || !api.copilotActionConfirm) {
    st.error = 'Bridge desktop de ações supervisionadas indisponível nesta sessão.';
    copilotForceRender(app);
    return;
  }
  st.busy = true;
  st.error = '';
  copilotForceRender(app);
  try {
    await api.d05SessionAuthorize({ profile: draft.profile });
    if (accountId && typeof api.d05BankAccountAuthorize === 'function') {
      await api.d05BankAccountAuthorize({ accountId });
    }
    const prepared = await api.copilotActionPrepare(preparePayload);
    if (!prepared || prepared.contract !== 'D05/PERSONAL-SUPERVISED-PREVIEW-V1') {
      throw Error('Prévia oficial D05 não confirmada.');
    }
    if (prepared.personalWriteAuthorized === false) {
      if (typeof api.copilotActionCapabilityStatus === 'function') {
        const cap = await api.copilotActionCapabilityStatus().catch(() => null);
        if (cap) st.capability = { available: !!cap.available, enabled: !!cap.enabled };
      }
      st.error = 'Ative primeiro "Ações supervisionadas do Copiloto" para autorizar gravações locais com confirmação nativa.';
      return;
    }
    const confirmed = await api.copilotActionConfirm({
      proposalId: prepared.proposalId,
      nonce: prepared.nonce,
      ...(accountId ? { accountId } : {})
    });
    if (confirmed?.status === 'applied' && confirmed.changesApplied === true) {
      st.receipt = confirmed.receipt;
      st.undoState = confirmed.undoState || 'available';
      await copilotRefreshAppData(app, draft.profile);
    } else if (confirmed?.status === 'denied') {
      st.error = confirmed.reason || 'Confirmação cancelada ou negada. Nenhuma alteração foi gravada.';
    } else {
      st.error = confirmed?.reason || 'Os registros mudaram antes da confirmação; solicite uma nova prévia.';
    }
  } catch (e: any) {
    st.error = String(e?.message || 'Não foi possível concluir a ação supervisionada.');
  } finally {
    st.busy = false;
    copilotForceRender(app);
  }
}

async function copilotGenericUndo(app: any, msg: any, draft: any) {
  return copilotUndoSupervisedAction(app, msg, draft);
}

function renderRuleDraftCard(app: any, msg: any, draft: any) {
  if (draft.status === 'needs_clarification' || draft.status === 'unavailable') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Regra supervisionada' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'REGRA SUPERVISIONADA'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Somente leitura')));
  }
  const st = copilotGetGenericDraftUiState(msg, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' },
      'Proposta de regra descartada · nenhuma regra foi gravada.');
  }
  const needOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;
  const isToggle = draft.action === 'rule.toggle';
  const accounts: any[] = Array.isArray(draft.accounts) ? draft.accounts : [];
  const selectedAccountId = st.accountId || accounts[0]?.id || null;

  const statusText = st.receipt
    ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo')
    : 'Prévia · nada gravado';
  const statusClass = st.receipt
    ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact')
    : 'mf-ic2-epistemic-badge is-simulation';

  return h('div', { className: 'mf-m3-action-card', role: 'region', 'aria-label': 'Prévia de regra supervisionada' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' }, isToggle ? 'ALTERNAR REGRA' : 'REGRA AUTOMÁTICA FUTURA'),
      h('div', { className: 'mf-m3-action-badges' },
        !isToggle ? h('span', { className: 'mf-ic2-pill is-strong mf-m3-badge-future' }, `Somente futuras (> #${draft.afterRowid ?? 0})`) : null,
        h('span', { className: statusClass }, statusText))),

    h('div', { className: 'mf-m3-action-target' },
      h('div', { className: 'mf-m3-action-target-copy' },
        h('small', {}, isToggle ? (draft.enabled ? 'Ativar regra existente' : 'Desativar regra existente') : `Quando descrição contiver “${draft.pattern}”`),
        h('strong', {}, `${draft.pattern} → ${draft.targetLabel}`)),
      h('div', { className: 'mf-m3-action-target-total' },
        h('small', {}, 'Natureza'),
        h('strong', {}, draft.nature === 'income' ? 'Entrada' : 'Saída'))),

    Array.isArray(draft.warnings) && draft.warnings.length > 0
      ? h('div', { className: 'mf-m3-action-warnings' },
          ...draft.warnings.map((w: string, i: number) => h('p', { key: i, className: 'mf-m3-action-notice is-rule-note' }, w)))
      : null,

    !isToggle && accounts.length > 1 && !st.receipt
      ? h('div', { className: 'mf-m3-action-account-picker' },
          h('label', {}, 'Conta vinculada à regra',
            h('select', {
              value: selectedAccountId || '',
              disabled: st.busy,
              onChange: (e: any) => { st.accountId = String(e.target.value); copilotForceRender(app); }
            }, ...accounts.map((a) => h('option', { key: a.id, value: a.id }, a.name)))))
      : null,

    !isToggle && Array.isArray(draft.sampleMatches) && draft.sampleMatches.length > 0
      ? h('details', { className: 'mf-m3-action-excluded' },
          h('summary', {}, `${draft.sampleMatches.length} exemplo(s) recente(s) compatível(is) — apenas visualização, histórico não será alterado`),
          h('ul', {},
            ...draft.sampleMatches.slice(0, 10).map((m: any) =>
              h('li', { key: m.accountId + '|' + m.externalId }, `${m.date} · ${m.description} (${fmt(m.amountCents)}) · Atual: ${m.currentCategory}`)
            )))
      : null,

    needOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Ative as ações supervisionadas para salvar regras automáticas com confirmação nativa e reversão em 1 clique.'),
          h('button', { type: 'button', className: 'secondary-button', disabled: st.busy, onClick: () => void copilotEnableGenericCapability(app, msg, draft) },
            st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,

    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {}, st.undoState === 'undone' ? 'Regra revertida ao estado anterior' : isToggle ? 'Status da regra atualizado' : `Regra futura criada (#${st.receipt.result?.ruleId || ''})`),
            h('small', {}, `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => void copilotGenericUndo(app, msg, draft) },
                st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || !!needOptIn || (!isToggle && !selectedAccountId),
            onClick: () => {
              const payload = isToggle
                ? { action: 'rule.toggle', profile: draft.profile, id: draft.ruleId, enabled: draft.enabled, ...(selectedAccountId ? { accountId: selectedAccountId } : {}) }
                : {
                    action: 'rule.save',
                    profile: draft.profile,
                    accountId: selectedAccountId,
                    pattern: draft.pattern,
                    matchMode: draft.matchMode || 'contains',
                    priority: draft.priority || 100,
                    target: draft.target,
                    constraint: { accountId: selectedAccountId, nature: draft.nature || 'expense', afterRowid: draft.afterRowid ?? 0 }
                  };
              void copilotGenericExecute(app, msg, draft, payload, selectedAccountId);
            }
          }, st.busy ? 'Aguardando confirmação…' : isToggle ? (draft.enabled ? 'Confirmar ativação' : 'Confirmar desativação') : 'Confirmar e criar regra futura'),
          h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => { st.dismissed = true; st.error = ''; copilotForceRender(app); } }, 'Descartar')),

    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}

function renderCategoryDraftCard(app: any, msg: any, draft: any) {
  if (draft.status === 'needs_clarification' || draft.status === 'unavailable') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Estrutura de categorias' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'CATEGORIAS'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Sem gravação')));
  }
  const st = copilotGetGenericDraftUiState(msg, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' }, 'Proposta descartada · catálogo mantido sem alterações.');
  }
  const needOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;
  const statusText = st.receipt ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo') : 'Prévia · nada gravado';
  const statusClass = st.receipt ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact') : 'mf-ic2-epistemic-badge is-simulation';
  const headline =
    draft.action === 'category.create' ? `Nova categoria: ${draft.name}` :
    draft.action === 'category.rename' ? `${draft.currentName} → ${draft.newName}` :
    draft.action === 'subcategory.create' ? `${draft.parentName} › ${draft.name}` :
    `${draft.parentName} › ${draft.currentName} → ${draft.newName}`;

  return h('div', { className: 'mf-m3-action-card', role: 'region', 'aria-label': 'Prévia de categoria supervisionada' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' }, 'ESTRUTURA DE CATEGORIAS'),
      h('span', { className: statusClass }, statusText)),
    h('div', { className: 'mf-m3-action-target' },
      h('div', { className: 'mf-m3-action-target-copy' },
        h('small', {}, draft.action.replace('.', ' · ').toUpperCase()),
        h('strong', {}, headline))),
    needOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Ative as ações supervisionadas para confirmar alterações no catálogo D05.'),
          h('button', { type: 'button', className: 'secondary-button', disabled: st.busy, onClick: () => void copilotEnableGenericCapability(app, msg, draft) },
            st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,
    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {}, st.undoState === 'undone' ? 'Catálogo restaurado ao estado anterior' : 'Catálogo atualizado com sucesso'),
            h('small', {}, `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => void copilotGenericUndo(app, msg, draft) }, st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || !!needOptIn,
            onClick: () => void copilotGenericExecute(app, msg, draft, { action: draft.action, profile: draft.profile, ...(draft.payload || {}) })
          }, st.busy ? 'Aguardando confirmação…' : 'Confirmar e aplicar'),
          h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => { st.dismissed = true; st.error = ''; copilotForceRender(app); } }, 'Descartar')),
    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}

function renderBudgetEditDraftCard(app: any, msg: any, draft: any) {
  if (draft.status === 'needs_clarification' || draft.status === 'unavailable') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Ajuste de orçamento' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'ORÇAMENTO MENSAL'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Sem gravação')));
  }
  const st: any = copilotGetGenericDraftUiState(msg, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' }, 'Ajuste descartado · orçamento mantido.');
  }
  const needOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;
  const parsedVal = copilotParseBrlCents(st.editedLimitText);
  const amountCents = parsedVal !== null ? parsedVal : draft.proposedLimitCents;
  const statusText = st.receipt ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo') : 'Prévia · nada gravado';
  const statusClass = st.receipt ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact') : 'mf-ic2-epistemic-badge is-simulation';

  return h('div', { className: 'mf-m3-action-card', role: 'region', 'aria-label': 'Prévia de ajuste de orçamento' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' }, `ORÇAMENTO · ${draft.month} · ` + (st.applyRecurring ? 'MÊS + RECORRENTE' : 'SOMENTE NESTE MÊS')),
      h('span', { className: statusClass }, statusText)),
    h('div', { className: 'mf-m3-action-target' },
      h('div', { className: 'mf-m3-action-target-copy' },
        h('small', {}, `Atual: ${draft.currentLimitCents !== null ? fmt(draft.currentLimitCents) : 'Sem limite'} · Gasto no mês: ${fmt(draft.currentSpentCents || 0)}`),
        h('strong', {}, `${draft.category} → ${fmt(amountCents)}`)),
      !st.receipt
        ? h('label', { className: 'mf-m3-salary-input-wrap' },
            h('span', {}, 'Limite R$'),
            h('input', {
              type: 'text',
              inputMode: 'decimal',
              disabled: st.busy,
              value: st.editedLimitText,
              onChange: (e: any) => { st.editedLimitText = String(e.target.value); copilotForceRender(app); }
            }))
        : null),
    !st.receipt
      ? h('label', { className: 'mf-m3-salary-income-opt' },
          h('input', { type: 'checkbox', checked: !!st.applyRecurring, disabled: st.busy, onChange: (e: any) => { st.applyRecurring = !!e.target.checked; copilotForceRender(app); } }),
          h('span', {}, `Aplicar também como limite recorrente para os próximos meses (padrão: somente ${draft.month})`))
      : null,
    Array.isArray(draft.warnings) && draft.warnings.length > 0
      ? h('div', { className: 'mf-m3-action-warnings' }, ...draft.warnings.map((w: string, i: number) => h('p', { key: i, className: 'mf-m3-action-notice' }, w)))
      : null,
    needOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Ative as ações supervisionadas para atualizar seu orçamento com backup SQLite.'),
          h('button', { type: 'button', className: 'secondary-button', disabled: st.busy, onClick: () => void copilotEnableGenericCapability(app, msg, draft) }, st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,
    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {}, st.undoState === 'undone' ? 'Limite anterior restaurado' : `Limite de ${draft.category} atualizado`),
            h('small', {}, `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => void copilotGenericUndo(app, msg, draft) }, st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || parsedVal === null || !!needOptIn,
            onClick: () => void copilotGenericExecute(app, msg, draft, {
              action: 'budgets.reorganize',
              profile: draft.profile,
              month: draft.month,
              applyRecurring: !!st.applyRecurring,
              budgets: [{ category: draft.category, amountCents }]
            })
          }, st.busy ? 'Aguardando confirmação…' : 'Confirmar novo limite'),
          h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => { st.dismissed = true; st.error = ''; copilotForceRender(app); } }, 'Descartar')),
    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}

function renderPlanningDraftCard(app: any, msg: any, draft: any) {
  if (draft.status === 'needs_clarification' || draft.status === 'unavailable') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Planejamento supervisionado' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'PLANEJAMENTO'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Sem gravação')));
  }
  const st = copilotGetGenericDraftUiState(msg, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' }, 'Prévia de planejamento descartada · nenhum item criado ou alterado.');
  }
  const needOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;
  const statusText = st.receipt ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo') : 'Prévia · nada gravado';
  const statusClass = st.receipt ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact') : 'mf-ic2-epistemic-badge is-simulation';

  return h('div', { className: 'mf-m3-action-card', role: 'region', 'aria-label': 'Prévia de planejamento supervisionado' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' }, draft.fromSimulation ? 'SIMULAÇÃO → PLANEJAMENTO' : 'PLANEJAMENTO LOCAL'),
      h('div', { className: 'mf-m3-action-badges' },
        h('span', { className: 'mf-ic2-pill mf-m3-badge-no-payment' }, 'Não realiza pagamento bancário'),
        h('span', { className: statusClass }, statusText))),

    h('div', { className: 'mf-m3-action-target' },
      h('div', { className: 'mf-m3-action-target-copy' },
        h('small', {}, draft.action === 'planning.create' ? `${draft.kind === 'income' ? 'Receita prevista' : 'Despesa prevista'} · ${draft.targetLabel || 'Outros'} · Vencimento ${draft.dueDate}` : draft.changeLabel || draft.afterSummary || draft.dueDate),
        h('strong', {}, draft.title)),
      h('div', { className: 'mf-m3-action-target-total' },
        h('small', {}, draft.count > 1 ? `${draft.count}x` : 'Valor'),
        h('strong', {}, fmt(draft.totalAmountCents ?? draft.amountCents ?? 0)))),

    draft.noBankPaymentNotice
      ? h('p', { className: 'mf-m3-action-notice is-rule-note', role: 'note' }, draft.noBankPaymentNotice)
      : null,
    Array.isArray(draft.warnings) && draft.warnings.length > 0
      ? h('div', { className: 'mf-m3-action-warnings' }, ...draft.warnings.map((w: string, i: number) => h('p', { key: i, className: 'mf-m3-action-notice' }, w)))
      : null,
    needOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Ative as ações supervisionadas para salvar itens no Planejamento local com backup SQLite.'),
          h('button', { type: 'button', className: 'secondary-button', disabled: st.busy, onClick: () => void copilotEnableGenericCapability(app, msg, draft) }, st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,
    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {}, st.undoState === 'undone' ? 'Planejamento restaurado ao estado anterior' : 'Planejamento atualizado com sucesso'),
            h('small', {}, `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => void copilotGenericUndo(app, msg, draft) }, st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || !!needOptIn,
            onClick: () => void copilotGenericExecute(
              app,
              msg,
              draft,
              { action: draft.action, profile: draft.profile, ...(draft.payload || {}) },
              Array.isArray(draft.accountIds) && draft.accountIds.length > 0 ? draft.accountIds[0] : (draft.payload?.accountId || null)
            )
          }, st.busy ? 'Aguardando confirmação…' : 'Confirmar no Planejamento'),
          h('button', { type: 'button', className: 'ghost-button', disabled: st.busy, onClick: () => { st.dismissed = true; st.error = ''; copilotForceRender(app); } }, 'Descartar')),
    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}

function renderCopilotActionCard(app: any, msg: any) {
  const draft = msg?.m3ActionDraft;
  if (!draft) return null;
  if (draft.contract === 'MF3/SALARY-BUDGET-PROPOSAL-V1') {
    return renderSalaryBudgetProposalBox(app, msg, draft, {
      onReplaceDraft: (nextDraft) => {
        msg.m3ActionDraft = nextDraft;
        copilotForceRender(app);
      }
    });
  }
  if (draft.contract === 'MF3/RULE-DRAFT-V1') return renderRuleDraftCard(app, msg, draft);
  if (draft.contract === 'MF3/CATEGORY-DRAFT-V1') return renderCategoryDraftCard(app, msg, draft);
  if (draft.contract === 'MF3/BUDGET-EDIT-DRAFT-V1') return renderBudgetEditDraftCard(app, msg, draft);
  if (draft.contract === 'MF3/PLANNING-DRAFT-V1') return renderPlanningDraftCard(app, msg, draft);
  if (draft.contract !== 'MF3/ACTION-DRAFT-V1') return null;

  if (draft.status === 'needs_clarification' || draft.status === 'unavailable') {
    return h('div', { className: 'mf-m3-action-card is-info', role: 'region', 'aria-label': 'Esclarecimento de ação' },
      h('div', { className: 'mf-m3-action-head' },
        h('span', { className: 'micro-label' }, 'AÇÃO SUPERVISIONADA · SOMENTE LEITURA'),
        h('span', { className: 'mf-ic2-epistemic-badge is-estimate' }, 'Sem gravação')),
      draft.futureRuleNotice ? h('p', { className: 'mf-m3-action-notice' }, draft.futureRuleNotice) : null,
      draft.excludedBySafetyCount > 0 ? h('small', { className: 'mf-m3-action-muted' },
        `${draft.excludedBySafetyCount} registro(s) foram protegidos fora do escopo (pendentes, splits ou transferências).`) : null);
  }

  const st = copilotGetActionUiState(msg, draft);
  if (st.dismissed) {
    return h('div', { className: 'mf-m3-action-card is-dismissed', role: 'status' },
      'Prévia descartada · nenhuma alteração foi gravada no banco SQLite.');
  }

  const items: any[] = Array.isArray(draft.items) ? draft.items : [];
  const visibleItems = draft.ambiguousAccounts && st.accountId
    ? items.filter((it) => it.accountId === st.accountId)
    : items;
  const eligibleItems = visibleItems.filter((it) => it.eligible);
  const excludedItems = visibleItems.filter((it) => !it.eligible);
  const selectedItems = eligibleItems.filter((it) => st.selectedKeys.has(String(it.key)));
  const selectedTotalCents = selectedItems.reduce((n, it) => n + Number(it.amountCents || 0), 0);

  const identity = resolveCategoryVisualIdentity({
    categoryId: draft.target?.categoryId || null,
    subcategoryId: draft.target?.subcategoryId || null,
    categoryName: draft.targetLabel,
    catalog: app?.state?.qa84VisualCatalog
  });

  const accountNamesById = new Map<string, string>();
  for (const it of items) {
    if (it.accountId && !accountNamesById.has(it.accountId)) {
      accountNamesById.set(it.accountId, String(it.accountName || it.accountId));
    }
  }
  const accountOptions: string[] = Array.isArray(draft.accountIds) ? draft.accountIds : [];
  const needCapabilityOptIn = !st.receipt && st.capability && st.capability.available && !st.capability.enabled;

  const statusBadgeText = st.receipt
    ? (st.undoState === 'undone' ? 'Revertida com backup' : 'Aplicada · com recibo')
    : 'Prévia · nada gravado';
  const statusBadgeClass = st.receipt
    ? (st.undoState === 'undone' ? 'mf-ic2-epistemic-badge is-estimate' : 'mf-ic2-epistemic-badge is-fact')
    : 'mf-ic2-epistemic-badge is-simulation';

  return h('div', { className: 'mf-m3-action-card', role: 'region', 'aria-label': 'Prévia de ação supervisionada' },
    h('div', { className: 'mf-m3-action-head' },
      h('span', { className: 'micro-label' },
        draft.source === 'bank' ? 'PRÉVIA · MOVIMENTAÇÃO BANCÁRIA' : 'PRÉVIA · LANÇAMENTO MANUAL'),
      h('div', { className: 'mf-m3-action-badges' },
        h('span', { className: 'mf-ic2-pill' }, 'Esforço: ' + copilotEffortLabel(draft.effort)),
        h('span', { className: statusBadgeClass }, statusBadgeText))),

    h('div', { className: 'mf-m3-action-target' },
      h(CategoryVisualGlyph, { identity, size: 22, variant: 'icon' }),
      h('div', { className: 'mf-m3-action-target-copy' },
        h('small', {}, 'Destino D05 após sua confirmação'),
        h('strong', {}, draft.targetLabel)),
      h('div', { className: 'mf-m3-action-target-total' },
        h('small', {}, `${selectedItems.length} selecionado(s)`),
        h('strong', {}, fmt(selectedTotalCents)))),

    Array.isArray(draft.warnings) && draft.warnings.length > 0
      ? h('div', { className: 'mf-m3-action-warnings' },
          ...draft.warnings.map((w: string, idx: number) => h('p', { key: idx, className: 'mf-m3-action-notice' }, w)))
      : null,

    draft.futureRuleNotice
      ? h('div', { className: 'mf-m3-action-notice is-rule-note', role: 'note' }, draft.futureRuleNotice)
      : null,

    draft.ambiguousAccounts && accountOptions.length > 1 && !st.receipt
      ? h('div', { className: 'mf-m3-action-account-picker' },
          h('label', {}, 'Conta para esta confirmação nativa',
            h('select', {
              value: st.accountId || accountOptions[0],
              disabled: st.busy,
              onChange: (e: any) => {
                const nextAccount = String(e.target.value);
                st.accountId = nextAccount;
                st.selectedKeys = new Set(
                  items.filter((it) => it.eligible && it.accountId === nextAccount).map((it) => String(it.key))
                );
                st.error = '';
                copilotForceRender(app);
              }
            }, ...accountOptions.map((id) =>
              h('option', { key: id, value: id }, accountNamesById.get(id) || id)
            ))))
      : null,

    h('div', { className: 'mf-m3-action-items', role: 'list', 'aria-label': 'Itens encontrados para revisão' },
      ...eligibleItems.map((it) => {
        const checked = st.selectedKeys.has(String(it.key));
        return h('label', { key: it.key, className: 'mf-m3-action-row' + (checked ? ' is-selected' : '') },
          h('input', {
            type: 'checkbox',
            checked,
            disabled: !!st.receipt || st.busy,
            onChange: (e: any) => {
              if (e.target.checked) st.selectedKeys.add(String(it.key));
              else st.selectedKeys.delete(String(it.key));
              st.error = '';
              copilotForceRender(app);
            }
          }),
          h('div', { className: 'mf-m3-action-row-copy' },
            h('strong', {}, it.description),
            h('small', {},
              `${it.date} · Atual: ${it.currentCategory || 'Outros'} → ${draft.targetLabel}` +
              (draft.source === 'bank' && it.accountName ? ` · ${it.accountName}` : ''))),
          h('span', { className: 'mf-m3-action-row-amount' }, fmt(it.amountCents)));
      })),

    excludedItems.length > 0
      ? h('details', { className: 'mf-m3-action-excluded' },
          h('summary', {}, `${excludedItems.length} item(ns) não elegível(is) protegido(s) fora do lote`),
          h('ul', {},
            ...excludedItems.slice(0, 12).map((it) =>
              h('li', { key: it.key }, `${it.date} · ${it.description} (${fmt(it.amountCents)}) — ${it.ineligibleReason}`)
            )))
      : null,

    needCapabilityOptIn
      ? h('div', { className: 'mf-m3-action-optin' },
          h('p', {}, 'Para executar alterações locais confirmadas neste perfil, ative antes as ações supervisionadas com registro e reversão em 1 clique.'),
          h('button', {
            type: 'button',
            className: 'secondary-button',
            disabled: st.busy,
            onClick: () => void copilotEnableSupervisedCapability(app, msg, draft)
          }, st.busy ? 'Ativando…' : 'Ativar ações supervisionadas'))
      : null,

    st.receipt
      ? h('div', { className: 'mf-m3-action-receipt', role: 'status' },
          h('div', { className: 'mf-m3-action-receipt-info' },
            h('strong', {},
              st.undoState === 'undone'
                ? 'Alteração revertida para o estado anterior'
                : `Alteração aplicada em ${st.receipt.affectedCount || selectedItems.length} lançamento(s)`),
            h('small', {},
              `Recibo ${String(st.receipt.proposalId || '').slice(0, 8)} · Backup SQLite verificado`)),
          st.undoState === 'available'
            ? h('button', {
                type: 'button',
                className: 'ghost-button',
                disabled: st.busy,
                onClick: () => void copilotUndoSupervisedAction(app, msg, draft)
              }, st.busy ? 'Revertendo…' : 'Desfazer')
            : h('span', { className: 'mf-ic2-pill' }, 'Desfeito'))
      : h('div', { className: 'mf-m3-action-footer' },
          h('button', {
            type: 'button',
            className: 'primary-button',
            disabled: st.busy || selectedItems.length === 0 || !!needCapabilityOptIn,
            onClick: () => void copilotExecuteSupervisedAction(app, msg, draft)
          }, st.busy ? 'Aguardando confirmação…' : `Confirmar e aplicar (${selectedItems.length})`),
          h('button', {
            type: 'button',
            className: 'ghost-button',
            disabled: st.busy,
            onClick: () => {
              st.dismissed = true;
              st.error = '';
              copilotForceRender(app);
            }
          }, 'Descartar')),

    st.error ? h('p', { className: 'mf-m3-action-error', role: 'alert' }, st.error) : null);
}
