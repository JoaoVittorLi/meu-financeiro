# MF1 / MF2 — Sincronização Persistente Antigravity `.agents/`, Diretriz NSIS e Roadmap Marcos 1–5

**Data:** 2026-11-18
**Branch:** `feat/mf1-cat-p0-consolidation-20261117` (PR #105, baseline preservada no remoto em `6e15914c4c27e0623a7f41cf568175bf6070f735`)
**Responsável:** Orchestrator Argon (`C:\Dev\meu-financeiro`)
**Status:** Sincronizado para execução dos gates finais do Marco 1 (Nível A + Nível B + Auditoria + Nível C NSIS experimental) antes da transição para o Marco 2.

## 1. Estrutura Persistente Implantada no Repositório

- `AGENTS.md` — atualizado para governança Antigravity/Argon (`Node 22.23.4` / `npm 10.9.9` / `Electron 45.2.3`), formato exclusivo NSIS Windows x64, memória permanente no GitHub e ciclo de 7 estágios.
- `.agents/rules/00-permanent-nsis-homologation.md` — Diretriz Permanente de Homologação por Marco (Níveis A, B e C obrigatórios, Portable fora de escopo, nunca gerar instaladores automaticamente sem autorização).
- `.agents/rules/01-model-allocation-and-teamwork.md` — alocação `pro`/`Argon` (Arquitetura, Inteligência Financeira, Design/Visual, Guardião SQLite, Auditor Adversarial) vs `flash` (Execução, Testes, Estresse), sem redundância e com independência de auditoria.
- `.agents/rules/02-worktree-isolation-and-github-memory.md` — isolamento `C:\Dev\meu-financeiro`, preservação do workspace OneDrive (`Carbon Meu Financeiro`), regra single-writer e registro contínuo em docs canônicos existentes.
- `.agents/rules/03-financial-sqlite-and-d05-safety.md` — centavos inteiros, WAL, backups com `integrity_check`, catálogo D05 `14×61×67`, `approvedForPersonal() === false`, `MF_QA_SYNTHETIC=1`.
- `.agents/skills/{qa-guardian-sqlite,forensic-auditor,electron-nivel-b-c-qa,d05-financial-integrity}/SKILL.md` — checklists executáveis por especialidade.
- `.agents/scripts/run_workflow.py` — orquestrador Python `stdlib` dos 7 estágios (`01_descoberta` a `07_entrega`) com guarda `MF_QA_SYNTHETIC=1`, verificação NSIS-only e trava `--owner-approved-nsis`.

## 2. Documentos Canônicos Atualizados (Sem Duplicatas)

- `docs/ROADMAP_MF2.md` — reconstrução oficial dos Marcos 1–5 (incluindo visão aprovada do Marco 2: Copiloto Financeiro `F1–F5`, Sistema Adaptativo de Respostas e Linguagem Permanente).
- `docs/ai-context/CURRENT_STATE.md`, `ACTIVE_WORK.md`, `GAPS_AND_GATES.md`, `TESTING_AND_RELEASE.md`, `OPERATING_PROTOCOL.md`, `WORK_PROMPT.md`.
- `docs/ai-context/MARKET_FEATURES_DEEP_DIVE.md` & `IDEA_REGISTER.md` — síntese competitiva verificada (`2026-11-18`) sobre Monarch Money, YNAB, Copilot Money, Rocket Money, Mobills e Organizze, convertida em 7 oportunidades priorizadas (`INOV-01`..`INOV-07`).

## 3. Escopo de Segurança e Bloqueios Mantidos

- `D05PersonalWriteGateway.approvedForPersonal()` permanece `false`.
- `shared/ai-policy.mjs` mantém `financialDataEnabled: false` e `paidApiFallback: false`.
- Nenhum merge na `main`, nenhuma tag/release, nenhum CircleCI pago, zero leitura/escrita em perfis pessoais ou no workspace OneDrive.
