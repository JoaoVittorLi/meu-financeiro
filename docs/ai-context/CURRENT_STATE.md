# Estado comprovado do projeto — atualizado em 18/11/2026

**Natureza:** registro factual vinculado ao repositório e às execuções verificadas em disco no workspace isolado `C:\Dev\meu-financeiro`. Nunca promove `NOT_RUN` ou `BLOCKED` a `PASS`.

## Estado Consolidado — Marco 1 (v1.0.0 / PR #105)

- **Repositório:** `JoaoVittorLi/meu-financeiro`
- **Branch ativa do Marco 1:** `feat/mf1-cat-p0-consolidation-20261117` (PR #105, empilhado sobre `#104` / `#100` / `#96` / `#94`)
- **Baseline preservada no remoto antes da Iteração 8:** `6e15914c4c27e0623a7f41cf568175bf6070f735` (publicada em `origin/feat/mf1-cat-p0-consolidation-20261117`).
- **Branch `main`:** intacta em `e0d5131ebeda855a792614d9986f40e5bb94af5e` (`v0.9.4`, sem merge nem tags).
- **Formato único de distribuição:** **Instalador NSIS Windows x64** (`--win nsis --x64`). Versão **Portable** descartada permanentemente.
- **Estado atual (Marco 1 — Iteração 15 + Homologação Real Nível C `M1-BASELINE` CONCLUÍDOS):**
  - **Nível A:** **PASS** no SHA `d2204265c49703b9f6698d53da02ab8f5f6475d7` (sem alterações posteriores em `electron/`, `src/`, `app/`, `shared/`, `tests/`): `test:types`, `compile`, `build-preload check`, `check-bundle` (`31` entradas), `test:asar` (`1/1` em `516,20 ms`), `test:db` (`1000/1000`, `0` falhas em `200,71s`), `mobile-push` (`133/133` em `2,14s`).
  - **Auditorias independentes (`pro`) da Iteração 15:** Guardião Financeiro/CAT02 (`VEREDITO: APPROVE` em `d220426` — `88/88` focal, `74/74` vetores Wave 14, varredura de `76` bases PSP, `40/40+4` legítimos BR) + Auditor Forense (`VEREDITO: GO` em `d0fe413`). Ajuste subsequente restrito a `scripts/nivel-b-interactive-qa.cjs` (`SetForegroundWindow` Win32 + busca recursiva de `#32770` no helper de QA para janela empacotada) no SHA `fe2b31861c3c1f9860a026e68e4ca02294e55065`.
  - **Nível B:** **PASS** em `fe2b31861c3c1f9860a026e68e4ca02294e55065` (`nivel-b-interactive-qa.cjs` `14/14` jornadas `PJ-01..09`/`NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`, além de `32/32` PNGs no `test:electron-smoke` + `verify-visual-matrix`).
  - **Nível C (Aplicativo Windows NSIS experimental realmente instalado — `M1-BASELINE`):** **PASS**:
    - Backup pré-M1 criado em `C:\Dev\backups\Meu-Financeiro-RC-Experimental-pre-M1-bin`.
    - Instalador gerado localmente no SHA `fe2b31861c3c1f9860a026e68e4ca02294e55065` (`npx electron-builder --win nsis --x64 --publish never`, zero Portable, zero CircleCI pago): `C:\Dev\releases\M1-BASELINE\MeuFinanceiro-Instalador-0.9.5-beta.8-x64.exe` (`115.740.233` bytes, SHA-256 `e96e0604c931d063509e673372552f2a35010f137bb4f88735297c0f1dac6110`), identificado como canal experimental `0.9.5-beta.8` (não `1.0.0` estável).
    - ASAR validado byte a byte (`verify-asar` PASS), catálogo D05 íntegro (`14` pais, `61` subcategorias, `67` SVGs) e `appId = app.local.meufinanceiro.rcall01`.
    - Instalado silenciosamente em `C:\Dev\mf-nsis-test-install\Meu Financeiro RC Experimental.exe` e executado via `scripts/nivel-c-nsis-qa.cjs` com `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR=C:\Dev\mf-nsis-test-userdata`, `MF_QA_SYNTHETIC=1` e `MF_DESKTOP_SMOKE_DIR` ausente: **`14/14` jornadas PASS (`PJ-01..09`, `NJ-01..05`, `0` RuntimeIssues)**, persistência pós-fechar/reabrir na UI DOM, `PRAGMA integrity_check = ok`, centavos inteiros e pastas pessoais do host (`%LOCALAPPDATA%\Programs\Meu Financeiro`, `%APPDATA%\meu-financeiro-desktop`, `%APPDATA%\Meu Financeiro`, `%APPDATA%\MeuFinanceiro-RC-ALL-01-Experimental`) com timestamps e contagens inalterados.
  - **Restrições ativas preservadas:** `approvedForPersonal() === false` (`electron/main.cjs`, `electron/d05-personal-gate.cjs`), `financialDataEnabled: false` (`shared/ai-policy.mjs`), dados sintéticos exclusivos (`MF_QA_SYNTHETIC=1`), `main` intacta em `v0.9.4` sem merge/tags.

## Próximo Passo
- Aguardar avaliação e decisão explícita do proprietário sobre o aceite final do Marco 1 (`M1-BASELINE` experimental `0.9.5-beta.8`) e eventual liberação do **Marco 2 — Inteligência Financeira 3.0**. **Não iniciar o Marco 2 automaticamente.**

---

## Histórico Anterior — Snapshot de Auditoria de 09/11/2026 & Checkpoint 12/11/2026

## Resumo executivo

- Repositório privado: https://github.com/JoaoVittorLi/meu-financeiro.
- Branch padrão **main**: SHA e0d5131ebeda855a792614d9986f40e5bb94af5e, package 0.9.4.
- Última release formal encontrada: [v0.9.4](https://github.com/JoaoVittorLi/meu-financeiro/releases/tag/v0.9.4).
- Branch de desenvolvimento **design/despezzas-d1-d4**: SHA c535cb01403689480d01560de3daa1cae71780d2, desktop e PWA package 0.9.5-beta.6; [PR #16](https://github.com/JoaoVittorLi/meu-financeiro/pull/16) draft, base fix/asar-windows-nested-paths.
- Foram encontrados **17 PRs abertos, todos draft**: **#1–#16** para desenvolvimento/integração em cadeia e **#17** exclusivamente documental. Nenhum integrado à main na data da verificação. Não fazer merges em massa.
- D1–D4 (fundação visual) **não são U1–U4**. A U4 definitiva (equivalência PWA das U1–U3 e acabamento) não foi implementada nessa revisão.
- Nenhuma alteração de código ou release resulta desta documentação.

## Estado por área

| Frente | Evidência em GitHub | Limitação obrigatória |
| --- | --- | --- |
| Desktop base | v0.9.4 em main; release formal publicada | Não contém o conjunto da PR #16 |
| Design D1–D4 | app/design-system.css, app/appearance.js, temas PWA; docs/DESIGN_D*.md | Fundamentos visuais, não toda a paridade funcional |
| U1 Visão Geral | docs/DESIGN_U1_OVERVIEW.md; tests/overview-u1.test.cjs | Implementada no renderer desktop, EXE novo não homologado |
| U2 Movimentações + Planejamento | docs/DESIGN_U2_OPERATIONS.md; tests/operations-u2.test.cjs | Desktop; não prova UX equivalente no PWA |
| U3 Orçamentos + Contas + Simulador | docs/DESIGN_U3_DECISIONS.md; tests/decisions-u3.test.cjs | Desktop; sem build/instalação Windows do SHA U3 comprovados |
| U4 PWA equivalente | Planejada nos documentos U1–U3; PWA já tem funções próprias | **Pendente**; não considerar PWA vazio nem paritário |
| Inteligência E1/E2 | src/intelligence-view.ts, electron/ai-auth.cjs, ai-client.cjs | UI e cliente experimental; autenticação/inferência real não homologadas |
| Inteligência E3 | electron/ai-personal.cjs; shared/ai-context.mjs | Memória/contexto local em código; não implica dados financeiros reais |
| Inteligência E4.1 | shared/ai-financial-context.mjs | Contexto fictício, não auditoria de conta bancária |
| PWA/Cloudflare | mobile-push/public/finance-*.js e mobile-push/src/finance-*.js | Staging Preview, paridade/cutover não homologados |
| Pluggy | Integração read-only e staging protegidos | Consentimento, saldo as-of e cobertura do extrato exigem verificação real |

## Precisão do estado da IA

Em shared/ai-policy.mjs o código contém AI_MODEL='gpt-6.1-sol', esforços low/medium e **publicCapabilities()** declara: pwaInferenceEnabled=false, financialDataEnabled=false, paidApiFallback=false, dataSource='demonstration_only'. Isso é **configuração/contrato de demonstração**, não comprovação de acesso efetivo ao modelo, assinatura ou inferência bancária. O app deve permanecer funcional sem IA.

O usuário manifestou a intenção de a U4 evoluir para operações multiárea autorizadas, com prévia, recusa quando dados mudarem, rollback e histórico. **Esse desejo/relato de outro chat não foi comprovado como código publicado** no SHA aqui auditado.

## Financeiro Cloudflare: evidências históricas, não conclusão

- Primeiro checkpoint relatou **1 conta e 630 transações** no Pluggy e no desktop, sem confronto de identidades.
- Diagnóstico subsequente do Preview indicou **632 transações em staging**, **1 conta**, **93 registros pessoais** de **17 tabelas**; 7/7 referências encontradas e 0 faltantes no diagnóstico pontual.
- Os números são de momentos/escopos distintos. **Não assumir dois lançamentos duplicados**: pode haver histórico preservado pelo staging. Faltam hashes comparativos mensais Windows×nuvem, datas, centavos, categorias, saldos de referência e restauração.
- E1_CONCILIATION_REPORT.md descreve checkpoints ainda pendentes. Manter SQLite como fonte local até migração homologada.
- A PWA usa Cloudflare Access/identidade protegida no ambiente configurado; testes e documentação não substituem verificação de sessão e permissão em produção.

## CI e publicação

- Em PR #15, SHA 44fb1b04828dded9ba5e7944e7650f23a99bfa0d, CircleCI **preflight_linux success** ([job 20](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/20)) e **build_windows success** ([job 21](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/21)). Esses resultados **não são** da U3.
- Em PR #16, SHA c535cb0: nenhum status CircleCI informado no endpoint de commit consultado. Houve Worker Build bem-sucedido, que não prova EXE ou paridade visual.
- Docs da U3 reportam **222/222 testes desktop**, **129/129 Worker/PWA**, **1/1 ASAR** no ambiente de desenvolvimento. Os números são **evidências relatadas na PR**, não testes rerodados neste processo de documentação.
- Nenhum novo instalador U3 executado em Windows foi comprovado; não divulgar link de EXE U3 como lançamento.

## Atualização documental de 09/11/2026

- [PR #17](https://github.com/JoaoVittorLi/meu-financeiro/pull/17) é uma branch **somente de documentação** derivada do SHA do PR #16, sem mudança de aplicativo. ROADMAP_MF2.md foi ampliado para especificar as Rodadas **A (analisar)** e **B (executar)** e requisitos de atualização contínua; PRODUCT_BLUEPRINT e ANALYSIS_PLAYBOOK aprofundam a visão futura. Isso **não muda o estado de homologação de nenhuma funcionalidade**.
- A sessão Work anterior não é acessível pelo conector; não se pode afirmar que U4 ou avanços de IA não existam localmente. O fato demonstrado é que **não aparecem na branch de desenvolvimento verificada**.
- Confirmado nesta reconferência: main em e0d5131, PR #16 em c535cb0, última release formal v0.9.4 e nenhum status CircleCI para c535cb0. Próxima execução é precedida de análise e checkpoint.

## Próximo gate

**Rodada A + MF2-00**: fazer primeiro análise ampla de produto/código e reconciliação do Work; após aprovação, verificar SHA mais recente de cada frente, inspecionar alterações locais do Work antes de sobrescrevê-las, executar preflight e build Windows para o SHA U3/candidato real, testar instalador isoladamente, catalogar cadeia de PRs e decidir baseline de integração.

**Não realizar como parte do gate:** Cloudflare Production, cutover financeiro, imports destrutivos, merge direto na main ou liberação de IA com leitura/escrita bancária.

**Atualização obrigatória:** integrador revisa este arquivo após integração e inclui links para novos SHA, PR, CI e evidência real; não basta alterar a data.

## Checkpoint de integração — 12/11/2026
Integrador temporário autorizado: integration/mf2-q1-operational-premium-20261112 une #48/#51/#52 com coord/#50. Código6979ba2,533 testes PASS, gates locais e IPC Electron PASS, QA nativo Premium e evidências novas publicados na candidata. Não integrado à main, não instalado, sem escrita pessoal ou build Windows. Consultar log2026-11-12-INTEGRATION-Q1-I-R.md e HEAD do PR da união. Status global de produção não promovido.

