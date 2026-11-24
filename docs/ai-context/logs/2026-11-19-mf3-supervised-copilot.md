# Log de Implementação — Marco 3: Copiloto com Ações Supervisionadas, GPT-6.2 Sol, M3-SALARY e Estável 1.0.0

- **Branch:** `feat/mf3-supervised-copilot-1-0-0-20261119`
- **Worktree isolada:** `C:\Dev\meu-financeiro-worktrees\m3-supervised-copilot`
- **Base ancestral M2:** `6b9c9ad2686fd5191ef937470768ef463c60e4a8` (sobre código homologado `e3c153c`)
- **Portabilidade da linha RC.1:** `tests/v1-stable-candidate-gate.test.cjs` trazido de `1a22181e6adcb52cca214922821b9f265b76c753` para verificação contínua da compatibilidade `stablePackaged=true` + Pluggy + CAT-P0 Opção A.

## Fase 1 — S0 (Fundação) + GPT-6.2 Sol + S1 (Categorização Supervisionada + Recibo + Desfazer)
- **Roadmap Oficial Revisado:** docs canônicos atualizados (`M1` concluído/homologado, `M2` homologado experimental, `M3` nova prioridade S0–S5 + 1.0.0, `M4` preditivo/conciliação, Multidispositivo/PWA congelado mantendo Pluggy desktop ativo).
- **Migração `gpt-6.2-sol` + Raciocínio Adaptativo:**
  - `shared/ai-policy.mjs`, `shared/ai-context.mjs`, `electron/ai-vault.cjs`, `electron/ai-personal.cjs`, `electron/ai-client.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `src/intelligence-integration.ts`, `src/intelligence-view.ts`.
  - Suporte exclusivo a `gpt-6.2-sol` com tiers `['low', 'medium', 'high']`, seletor contextual `selectAdaptiveEffort`, rejeição explícita de `none`/`minimal`/`xhigh`, cancelamento `ai:cancel` (`AbortController`), zero retries automáticos, zero fallback pago e distinção `CONFIGURADO` vs `TESTADO_COM_MOCK` vs `INFERÊNCIA_REAL_VERIFICADA`.
- **S1 — Categorização Supervisionada End-to-End:**
  - `electron/d05-personal-gate.cjs`: adicionados `'manual.batch-categorize'`, opt-in explícito `m3CapabilityCheck` (preservando `approvedForPersonal: () => false` intacto), snapshot `before_json`, `listReceipts` e reversão protegida `undoReceipt` com pré-backup verificado, revalidação anti-stale, diálogo nativo e atomicidade `BEGIN IMMEDIATE`.
  - `electron/copilot-actions.cjs`: interpretador determinístico PT-BR somente leitura (`MF3/ACTION-DRAFT-V1`), identificação de estabelecimento/ambiguidades, resolução hierárquica D05, separação explícita de regra futura solicitada (preparação S3) e exclusão por item.
  - `electron/main.cjs`, `electron/preload.cjs`, `src/copilot-supervised-actions.ts`, `src/intelligence-local.ts`, `src/intelligence-view.ts`, `app/intelligence.css`: canal `copilot:action-*`, ativação/revogação nativa em `app_meta` (`m3_supervised_actions_enabled`), card interativo no chat/drawer com checkboxes, `Confirmar e aplicar` nativo, atualização imediata de `Movimentações`/`Orçamentos`, recibo e botão `Desfazer`.
