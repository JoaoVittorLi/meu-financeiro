/* M3 — Supervised Copilot Actions Renderer UI (S1..S4).
 * Runs in the same TypeScript module:none bundle as src/app.ts.
 * Never mutates SQLite directly; every write goes through D05PersonalWriteGateway IPC + native MAIN confirmation. */

const MF_M3_ACTION_GRANTS = new WeakMap<any, { access: any; signature: string; month: string }>();
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

function copilotBindActionMessage(msg: any, access: any, signature: string, month: string) {
  if (access?.token) MF_M3_ACTION_GRANTS.set(msg, { access, signature, month });
  return msg;
}

function copilotActionMessageLive(app: any, msg: any): boolean {
  const b = MF_M3_ACTION_GRANTS.get(msg);
  const access: LocalFinancialAccess = app?.state?.localFinancialAccess;
  return !!b &&
    b.access === access &&
    !!access?.token &&
    b.signature === intelligencePremiumSignature(app) &&
    b.month === (app.state.localFinancialMonth || app.state.month) &&
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
    if (typeof app.refreshPlanning === 'function') await app.refreshPlanning();
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

function renderCopilotActionCard(app: any, msg: any) {
  const draft = msg?.m3ActionDraft;
  if (!draft || draft.contract !== 'MF3/ACTION-DRAFT-V1') return null;

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
