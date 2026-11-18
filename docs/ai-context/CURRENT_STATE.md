# Estado comprovado do projeto — atualizado em 18/11/2026

**Natureza:** registro factual vinculado ao repositório e às execuções verificadas em disco no workspace isolado `C:\Dev\meu-financeiro`. Nunca promove `NOT_RUN` ou `BLOCKED` a `PASS`.

## Estado Consolidado — Marco 1 (v1.0.0 / PR #105)

- **Repositório:** `JoaoVittorLi/meu-financeiro`
- **Branch ativa do Marco 1:** `feat/mf1-cat-p0-consolidation-20261117` (PR #105, empilhado sobre `#104` / `#100` / `#96` / `#94`)
- **Baseline preservada no remoto antes da Iteração 8:** `6e15914c4c27e0623a7f41cf568175bf6070f735` (publicada em `origin/feat/mf1-cat-p0-consolidation-20261117`).
- **Branch `main`:** intacta em `e0d5131ebeda855a792614d9986f40e5bb94af5e` (`v0.9.4`, sem merge nem tags).
- **Formato único de distribuição:** **Instalador NSIS Windows x64** (`--win nsis --x64`). Versão **Portable** descartada permanentemente.
- **Estado atual (Iteração 15 — Nível A e Nível B APROVADOS após fechamento estrutural das 7 classes Wave 14; pronto para auditoria final `pro` e Nível C NSIS experimental):**
  - **Checkpoint publicado no remoto:** HEAD `017b1b29a2a64672fad8c482afb1d627d5e37487` (`6e15914..017b1b2`, 7 commits da Iteração 8 até a Iteração 14) publicado em `origin/feat/mf1-cat-p0-consolidation-20261117`.
  - **Iteração 15 validada no workspace:** fechamento estrutural das 7 classes apontadas na auditoria Wave 14 em `electron/cat02-classifier.cjs`:
    1. Remoção de `?` opcional em `rede`/`vero`/`stone` dentro de `SAFE_PORTUGUESE_PREFIX_WORDS` (fechando `TERMINALSTONE`, `TERMINALVERO`, `TERMINALREDE`, `ECSTONE`, `ECST ONE`, etc.).
    2. Quebra por `/` em `hasSplitIntermediaryWindow` restrita a pares numéricos `10/10`, fechando splits com `/` (`M/P`, `P/A/G`, `T/O/N`, `V/E/R/O`, `I/F/O/O/D`, `P/I/X`, `Ｍ/Ｐ`).
    3. Prefixos POS/numéricos à esquerda/sufixos corporativos (`expandCandidateTokens`, `CORP_OR_CHANNEL_RIGHT_RE`, `CONTEXTUAL_OR_SHORT_OPEN_SUFFIXES`, `/99pay|99food|c6pay/`), fechando `01DROGASILMP01`, `01BOTECO<PSP>01` / `01BOTECO<PSP>SP` (76 bases PSP), `EC01BOTECOMP`, `AB0199FOODSP` e `QUITANDAMPLTDA`/`QUITANDASTONE`/`VERO`/`REDE`/`TON`/`CORA`/`BIN` enquanto protege nomes próprios (`GLADSTONE`, `MILTON`, `EVERTON`, etc.).
    4. Detecção de fragmentos colados a tokens adjacentes via `hasGluedIntermediaryInToken` dentro de `hasSplitIntermediaryWindow` (cobrindo `BOTECOM P`, `BOTECOM PCE`, `DROGASILM P`, `T ONPADARIA`, `P AGPADARIA`, `BOTECOP AG01`, `BOTECOC 6 P A YSP`, preservando `DROGARIA PAGUE MENOS 10/10` e `BAR EVERTON`).
    5. `\d{1,4}ml` exige `Array.isArray(merchantTokens) && merchantTokens.includes(tok)` e `POS_CONTROL_LEFT_RE` (bloqueando `EC01/POS01/PADARIA 10ML` em `MULTI_SIGNAL_RECONCILED` sem `merchant.name` e preservando `5ML`/`500ML`).
    6. Expansão de `NON_CARD_RAIL_RE` para abreviações/truncamentos (`AUTO_DEB`, `AUTODEB`, `DEBITO_AUTOMATIC`, `DEBAUTO01`, `DEBITO_CONTA`, `DDA`).
    7. Consistência `receiverConsistent` em `classifyCandidate`: se `receiverCnpj` existe, exige `receiverName` e `merchantCnpj === receiverCnpj`.
    Adicionados `w14-01..46` e `w14-leg-37..42` em `tests/cat-p0-calibration.test.cjs` (`G6-18`) e criado `scripts/nivel-c-nsis-qa.cjs` + parametrização de `scripts/nivel-b-interactive-qa.cjs`.
  - **Nível A:** **PASS** (`test:types`, `compile`, `build-preload check`, `check-bundle` 31 entradas, `test:asar` `1/1` em `516,20 ms`, `test:db` `1000/1000` em `200,71s`, `mobile-push` `133/133` em `2,14s`).
  - **Nível B:** **PASS** (`test:electron-smoke` + `verify-visual-matrix` `32/32` PNGs + `nivel-b-interactive-qa.cjs` `14/14` jornadas `PJ-01..09`/`NJ-01..05` com `FAIL: 0`, `RuntimeIssues: 0`).
  - **Nível C (Instalador NSIS experimental `M1-BASELINE`):** autorizado pela Diretriz do Proprietário (` closures P0 `); execução imediata pós-auditoria `pro` da Iteração 15 (`C:\Dev\releases\M1-BASELINE\`, instalação isolada em `C:\Dev\mf-nsis-test-install`, perfil sintético `C:\Dev\mf-nsis-test-userdata`).
  - **Restrições ativas preservadas:** `approvedForPersonal() === false` (`electron/main.cjs`, `electron/d05-personal-gate.cjs`), `financialDataEnabled: false` (`shared/ai-policy.mjs`), dados sintéticos exclusivos (`MF_QA_SYNTHETIC=1`), zero uso de perfis pessoais ou CircleCI pago.

## Próximos Passos Imediatos (Pós-Iteração 15)
1. Validar `provenance:create` + `provenance:verify` no SHA da Iteração 15, obter pareceres finais `pro` (critério objetivo de fechamento M1 focado em P0 reais) e publicar o commit no PR #105.
2. Preservar backup da pasta experimental anterior e executar **Nível C completo (`npx electron-builder --win nsis --x64 --publish never` -> `C:\Dev\releases\M1-BASELINE\` -> instalação silenciosa em `C:\Dev\mf-nsis-test-install` -> `node scripts/nivel-c-nsis-qa.cjs` com `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR=C:\Dev\mf-nsis-test-userdata`, persistência pós-restart e verificação de intocabilidade das pastas do host)**.
3. Registrar o relatório final do Nível C no PR #105 e **aguardar decisão explícita do proprietário antes de iniciar o Marco 2**.

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

