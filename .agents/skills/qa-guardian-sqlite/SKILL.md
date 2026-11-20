---
name: qa-guardian-sqlite
description: Independent financial integrity and SQLite WAL/backup/recovery guardian skill for Meu Financeiro (recommended model: pro).
---

# Skill — Guardião Financeiro & SQLite (`pro`)

## Quando ativar
Ao revisar ou auditar qualquer mudança em `electron/db.cjs`, `electron/planning.cjs`, `electron/recovery.cjs`, `electron/d05-auto-categorization.cjs`, `electron/d05-personal-gate.cjs`, `electron/d05-rc-gate.cjs`, `electron/cat01-*.cjs`, `electron/cat02-classifier.cjs` ou `shared/finance-period-ledger.mjs`.

## Checklist obrigatório
1. **Valores monetários:** confirmar `Number.isSafeInteger` em centavos e ausência de normalização falsa (`null`/`undefined` nunca vira `0` silencioso).
2. **Transações e WAL:** verificar `BEGIN IMMEDIATE`, `foreign_keys = ON`, fechamento seguro de `DatabaseSync` em blocos `try/catch`/`finally` (sem leak de handle `EBUSY` no Windows) e limpeza de `-wal`/`-shm`/`.d05-before-v7.sqlite*` em staging.
3. **Backup & Restore:** confirmar `backupTo()` + `PRAGMA integrity_check` antes de mutações em lote; rejeição de backups inválidos/pré-corrompidos; rebinding de serviços em `main.cjs` após restore.
4. **Precedência & Recibos:** confirmar `manual > rule > automatic > bank`, proteção de splits, transferências, vínculos manuais e `approvedForPersonal() === false`.
5. **Execução real:** rodar `MF_QA_SYNTHETIC=1 npm run test:db` no SHA exato e conferir `0` falhas e `0` pulos.
