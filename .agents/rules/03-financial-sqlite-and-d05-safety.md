# Regra — Integridade Financeira, SQLite, D05 e Segurança da IA

## 1. Invariantes Financeiras e SQLite

- **Centavos inteiros sempre:** todo valor monetário autoritativo usa inteiros seguros (`Number.isSafeInteger`); nunca usar float para saldos/totais nem fabricar `0` para saldo desconhecido/parcial.
- **Imutabilidade e precedência:** `bank_transactions` permanece imutável após ingestão Pluggy; precedência inviolável `manual > rule > automatic (mf_auto_labels) > bank provider category`. Transferências próprias e ignoradas não distorcem receita/despesa (`effectiveNature`).
- **Transações e recuperação:** mutações SQLite críticas em `BEGIN IMMEDIATE` com `foreign_keys = ON`, modo WAL íntegro, backup online `node:sqlite` validado por `PRAGMA integrity_check` antes de escrita em lote ou restauração, limpeza completa de arquivos auxiliares de staging (`-wal`, `-shm`, `.d05-before-v7.sqlite*`) no `finally`, e geração de recibo individual com suporte a reversão (`undo`).

## 2. Taxonomia D05 e Segurança da Inteligência Financeira

- **Catálogo D05 oficial:** **14 categorias pai, 61 subcategorias, 67 SVGs** (`electron/d05-taxonomy.json`, `shared/d05-svg-registry.json`). Manter contraste WCAG AA em tema claro e escuro.
- **Escrita pessoal da IA bloqueada:** `D05PersonalWriteGateway.approvedForPersonal()` permanece `false` e `shared/ai-policy.mjs` mantém `financialDataEnabled: false` e `paidApiFallback: false` até autorização explícita futura.
- **Valores determinísticos:** no Copiloto Financeiro (M2+), todo valor financeiro calculado vem exclusivamente de `shared/finance-period-ledger.mjs` e dos serviços canônicos do processo `MAIN` com controle de `grant` e `dataVersion` — nunca de estimativa ou criação do modelo de linguagem.
- **Proibição de HTML/JS arbitrário no renderer:** respostas visuais da IA usam exclusivamente contratos tipados e componentes React/TS validados.
- **Dados estritamente sintéticos em QA:** executar testes sempre com `MF_QA_SYNTHETIC=1`, sem `MF_REAL_PROFILE` e sem variáveis `PLUGGY_*`, em diretórios isolados ou temporários.
