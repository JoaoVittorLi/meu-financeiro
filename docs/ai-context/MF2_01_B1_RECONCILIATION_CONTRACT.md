# MF2-01/B1 — Contrato de conciliação financeira (dry-run)

**Status:** implementação B1 em branch isolada, **não homologada**, sem ativação de sincronização ou fonte cloud canônica. Deriva da revisão técnica `a4d88ced28c59b21520f4d67a51373cd71bdc8a2` (PR #19) e preserva os mecanismos E1 existentes.

## 1. Componentes reais e execução

- `shared/mf2-reconciliation.mjs`: `reconcileSnapshots(windows, cloud)` — função pura e determinística, sem IO, gravação, rede, relógio ou inferência de transações.
- `electron/cloud-reconciliation-read.cjs`: `readWindowsReconciliationSnapshot(finance)` — lê um banco SQLite **já aberto** do processo privilegiado Windows. Não chama `new FinanceDB`, não abre caminhos do usuário nem executa `CREATE/UPDATE/INSERT/DELETE`; apenas `SELECT`. Exclui perfil `demo` dos lançamentos manuais.
- `mobile-push/src/finance-reconciliation-read.js`: `readCloudReconciliationSnapshot(storage)` — consulta o SQLite do Durable Object **dentro do contexto autenticado já existente**; apenas `SELECT`, sem `ensureBankStaging` ou `ensurePersonalEdits` (ambos criam tabelas). Lê staging bancário, sidecar de categorias e, quando disponível, a **última quarentena verificada** e revisões de `bank_custom_titles`. Não cria rota pública, não consulta Pluggy e não faz deploy.
- `scripts/mf2-reconciliation-fixture.cjs`: gerador offline de relatório inteiramente sintético, sem carregar dados pessoais.
- `tests/mf2-reconciliation.test.cjs`: testes sintéticos; o comando `npm run test:db` já inclui `tests/*.test.cjs`, portanto não altera scripts/dependências.

**Nota essencial:** os dois adaptadores existem e podem ser exercitados no mesmo processo de teste com armazenamento autorizado/injetado; **ainda não existe transporte autenticado de snapshots brutos Cloudflare → Windows**. O contrato E1 atualmente implantado compartilha apenas resumos/digests. Não expor snapshots brutos em HTTP, IPC de renderer, PWA, PR, telemetria ou logs. O handshake privado de comparação entre aparelhos é objeto da **B2**, sujeito a novo gate. Essa limitação não impede os testes B1 com fixtures.

## 2. Entrada: `mf2-reconciliation-b1-v1` (forma interna)

Cada argumento é um objeto contendo até 100.000 registros por coleção:

| Coleção | Identidade | Campos comparados | Origem |
| --- | --- | --- | --- |
| `accounts[]` | `account_id` | `item_id`, `currency`, `balance_cents` (nulo ≠ 0) | `bank_accounts` / `mf_bank_staging_accounts` |
| `transactions[]` | `[account_id,external_id]` | `date`, `amount_cents`, `description`, `status`, `category` + `categoryCovered` | `bank_transactions` / `mf_bank_staging_transactions` + sidecar |
| `manualTransactions[]` | `[profile,id]` | `date`, `amount_cents`, `kind`, `category`, `origin` | `transactions WHERE profile='real'` / quarentena verificada |
| `overlays[]` | `[account_id,external_id]` | `category`, `nature`, `manual_id`, `title`, `splits[]`, `revision` quando ambos os lados o fornecem | Tabelas pessoais de edições/vínculos/splits |
| `metadata` | Fonte | `historyComplete` (true/false/null), `overlayCoverage` (`complete`/`verified_import`/`unavailable`), `lastFetched` (contagem/null), `snapshotKind` | Diagnóstico da origem |

Uma transação bancária continua **separada** de transação manual: não são unificadas mesmo se data e centavos coincidirem; `bank_manual_links` tem caráter informativo, não desencadeia escrituras ou liquidação. `transfer` somente quando marcado explicitamente pela natureza; Pix/despesas não são inferidos como transferência própria. Sinais monetários no banco são inteiros de centavos, sem `Math.round` ou ponto flutuante autoritativo; registros manuais usam `kind` como no SQLite. `updated_at` e `source_updated_at` preservam contexto, sem presumir `as-of` bancário comparável.

**Semântica de categorias:** categoria original `NULL` do Pluggy na linha *existente* do sidecar vira o default do desktop `Outros`; sidecar **ausente** resulta em `categoryCovered=false`/pendência, nunca igualdade presumida. Edição manual fica em overlay separado do extrato bruto. Quarentena pessoal importada pode estar defasada em relação às edições atuais e deve ser tratada como evidência histórica, não dado já sincronizado.

## 3. Saída verificável

`reconcileSnapshots` retorna JSON com:

- `contract: "mf2-reconciliation-b1-v1"`, `stage: "read_only_dry_run"`, `ok: true`.
- `sources.windows/cloud`: contagens separadas de contas, transações bancárias, manuais e overlays.
- `comparable`: quantidade observada e equivalente por entidade; overlays explicitam `checked`.
- `flowClassification`: **contagens auxiliares, não somas monetárias**. `bankIncome`/`bankExpense`/`bankZero` contam apenas transações bancárias `status=POSTED` (confirmadas) por sinal; `pendingBankIncome`/`pendingBankExpense`/`pendingBankZero` contam separadamente `status=PENDING` (ainda não confirmadas); `unclassifiedBankStatus` sinaliza os outros status sem tratá-los como confirmados. Transações explicitamente `nature=transfer` ou `nature=ignore` não entram nesses contadores de fluxo. `manualIncome`/`manualExpense` são separados por `kind`, `explicitTransfers` conta natureza indicada, `linkedManualReferences` conta vínculos; `ledgerTotalsCombined=false`. Status incompleto permanece uma divergência, nunca fluxo confirmado.
- `summary.state`: `requires_manual_review`, `consistent_observed_scope_only` ou `consistent_observed_scope`. **Nenhum** desses status é aprovação de cutover; cobertura histórica e saldos as-of permanecem gates separados.
- `summary.byType`, `issues`, `bankCountDelta`, `historicalHypotheses`, `omittedIssues` e `differences[]` (limitado a 200 achados, com contagens globais).
- Cada diferença informa `type`, `entity`, `reference`, `field`, `side`, `reason` e `action`. **Não** contém valores, IDs bancários, texto de lançamento ou saldos.
- `databaseChanged=false`, `financialSyncEnabled=false`, `cloudCutoverAllowed=false`, `automaticSettlementEnabled=false`, `personalDataIncluded=false`.

A referência `R000001` etc. é um **apelido determinístico por comparação**, calculado a partir da ordenação privada das chaves; não é ID externo nem chave persistente entre comparações com universos diferentes. As identidades brutas permanecem somente nas entradas confiáveis da função. Identidades inválidas são sinalizadas como `INVALID-<lado>-<ordinal>`.

**Divergências:** `only_one_source`, `financial_difference` (data/centavos), `status_difference`, `category_difference`, `attribute_difference`, `account_identity_difference`, `incomplete`, `duplicate_identity`, `possible_duplicate` (agrupamento heurístico para **revisão**, não deduplicação), `personal_edit_difference` `revision_conflict`, `missing_account_reference` e `orphan_personal_overlay`. A interpretação requer julgamento; campos não observáveis não equivalem a valores nulos/zero.

## 4. Investigação 630 × 632 e limites

O número **630 vs 632 foi relatado em instantes/contextos distintos**. O staging preserva histórico além do último fetch Pluggy. O algoritmo nunca converte diferença de contagem em afirmação de perda, fraude ou duplicidade. Relatório sintético disponível em `logs/2026-11-10-MF2-01-B1-synthetic-report.json`: Windows 630, staging 632, `lastFetched=630`, **2 linhas somente na nuvem**, uma divergência de status, uma ausência de metadado de categoria e saldo **desconhecido**. Trata-se de **cinco achados inventados**; nenhum representa transação de pessoa real.

O núcleo puro não faz capturas transacionais consistentes entre dois processos e não confirma janela histórica, instante do saldo, autenticidade do usuário de Preview, paridade de revisões editadas depois da quarentena, backup/restore ou conciliação dos 17 conjuntos pessoais. Não executar conciliação live transportando dados brutos até ter protocolo seguro e autorização da B2.

## 5. Teste, execução e portas de segurança

```bash
node --test tests/mf2-reconciliation.test.cjs
node scripts/mf2-reconciliation-fixture.cjs
npm run test:db
```

Os primeiros dois comandos são **offline**, sem Pluggy, Cloudflare, filesystem financeiro ou IA paga. `npm run test:db` executa toda a suíte Node/SQLite existente e pode depender do Node/npm fixados e dos módulos originais; somente marcar PASS após observar execução real. Não há mudanças na configuração CircleCI.

**B2 futura:** combinar E1 digest/hash já implementado com protocolo autenticado, minimização de dados, comparação de identidade sem exportar IDs ao renderer, captura consistente/as-of, CAS/revisões, consentimento, idempotência, restauração ensaiada e roteiros de conflitos. Restringir a Preview protegido; nenhuma flag financeira pode ser ativada automaticamente. **G0 e G1 permanecem NÃO HOMOLOGADOS.**
