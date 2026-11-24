'use strict';
// M3-S5: Ephemeral MAIN-side session continuity store.
// Strictly bound to (owner, token, profile, month); cleared automatically on revoke,
// profile/mode switch, DB restore, or token expiry. Never persisted to disk.

class CopilotSessionContext {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.sessions = new Map();
  }

  _key(owner, token, profile, month) {
    return `${owner}|${token}|${profile}|${month}`;
  }

  prune(now = this.clock()) {
    for (const [k, s] of this.sessions.entries()) {
      if (s.expiresAt && s.expiresAt <= now) {
        this.sessions.delete(k);
      }
    }
  }

  clearByToken(token) {
    if (!token) return;
    for (const [k, s] of this.sessions.entries()) {
      if (s.token === token) this.sessions.delete(k);
    }
  }

  clearOwner(owner) {
    for (const [k, s] of this.sessions.entries()) {
      if (s.owner === owner) this.sessions.delete(k);
    }
  }

  clearAll() {
    this.sessions.clear();
  }

  invalidateFinancialDrafts() {
    for (const s of this.sessions.values()) {
      s.activeSalaryDraft = null;
      s.activeCategorizeDraft = null;
      s.activeRuleDraft = null;
      s.activePlanningDraft = null;
      s.lastSavings = null;
      s.lastInvestigation = null;
      s.lastTransactions = [];
    }
  }

  touch(scope, owner) {
    if (!scope?.token || !Number.isInteger(owner)) return null;
    this.prune();
    const k = this._key(owner, scope.token, scope.profile, scope.month);
    let st = this.sessions.get(k);
    if (!st) {
      st = {
        owner,
        token: scope.token,
        profile: scope.profile,
        source: scope.source,
        month: scope.month,
        expiresAt: scope.expiresAt || this.clock() + 15 * 60 * 1000,
        lastCategory: null,
        lastMerchant: null,
        lastTransactions: [],
        lastSimulation: null,
        lastSavings: null,
        lastRecurring: null,
        lastInvestigation: null,
        activeSalaryDraft: null,
        activeCategorizeDraft: null,
        activeRuleDraft: null,
        activePlanningDraft: null
      };
      this.sessions.set(k, st);
    } else if (scope.source !== st.source) {
      st.source = scope.source;
      st.activeCategorizeDraft = null;
      st.activeRuleDraft = null;
    }
    return st;
  }

  get(scope, owner) {
    this.prune();
    if (!scope?.token || !Number.isInteger(owner)) return null;
    return this.sessions.get(this._key(owner, scope.token, scope.profile, scope.month)) || null;
  }

  recordSkillOutput(scope, owner, kind, payload) {
    const st = this.touch(scope, owner);
    if (!st || !payload) return;
    if (kind === 'simulation') {
      st.lastSimulation = payload;
    } else if (kind === 'investigation') {
      st.lastInvestigation = payload;
      if (payload.category) st.lastCategory = payload.category;
      if (payload.merchant) st.lastMerchant = payload.merchant;
    } else if (kind === 'savings') {
      st.lastSavings = payload;
      if (payload.topCategory) st.lastCategory = payload.topCategory;
    } else if (kind === 'recurring') {
      st.lastRecurring = payload;
    }
  }

  recordDraft(scope, owner, draft) {
    const st = this.touch(scope, owner);
    if (!st || !draft) return;
    if (draft.contract === 'MF3/SALARY-BUDGET-PROPOSAL-V1' && draft.status === 'ready') {
      st.activeSalaryDraft = {
        ...draft,
        revision: Number.isInteger(draft.revision) ? draft.revision : 1
      };
    } else if (draft.contract === 'MF3/ACTION-DRAFT-V1' && draft.status === 'ready') {
      st.activeCategorizeDraft = draft;
      if (draft.targetLabel) st.lastCategory = draft.targetLabel.split(' › ')[0];
      if (draft.merchantQuery) st.lastMerchant = draft.merchantQuery;
      if (Array.isArray(draft.items)) st.lastTransactions = draft.items;
    } else if (draft.contract === 'MF3/RULE-DRAFT-V1' && draft.status === 'ready') {
      st.activeRuleDraft = draft;
      if (draft.pattern) st.lastMerchant = draft.pattern;
      if (draft.targetLabel) st.lastCategory = draft.targetLabel.split(' › ')[0];
    } else if (draft.contract === 'MF3/PLANNING-DRAFT-V1' && draft.status === 'ready') {
      st.activePlanningDraft = draft;
      if (draft.category) st.lastCategory = draft.category;
    }
  }
}

module.exports = { CopilotSessionContext };
