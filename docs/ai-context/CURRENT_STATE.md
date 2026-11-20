# Estado comprovado do projeto — atualizado em 19/11/2026

> **Reconciliação oficial de marcos (19/11/2026):**
> - `M1_IMPLEMENTATION_COMPLETE` — escopo funcional do Marco 1 (`CAT-P0 Opção A`, `CAT-UX 01–06`, `D05 14×61`, `B01–B05`, `I2/I3-01`, `RC2.2/2.3` e `M1.1` Visão Geral) integrado nesta branch (`PR #105`).
> - `M1_TECHNICALLY_HOMOLOGATED` — patch experimental `M1.1` (`0.9.5-beta.9`) homologado em Nível A + B + C (`15/15` PASS) em `b7a3d8a` (docs consolidados em `ffc70f2`).
> - `V1_STABLE_RELEASE_PENDING` — candidata estável preparada em branch isolada `release/v1.0.0-rc.1-candidate-20261119` (`1a22181e6adcb52cca214922821b9f265b76c753`, `v1.0.0-rc.1`), com `test:types`, `compile`, `build-preload check`, `check-bundle` (`31`), `test:db` (`1006/1006` PASS, `0` skipped), `mobile-push` (`133/133`), `test:asar` (`1/1`), `provenance:verify` (`23` arquivos), `test:electron-smoke` e `dist:windows:stable` (`verify-asar` + `asar-stable-verification.json`: `mfDistributionChannel="stable"`, `productName="Meu Financeiro"`, `d05Parents=14`, `d05Subcategories=61`, `svgGlyphs=67`, `approvedForPersonal=false`, `financialDataEnabled=false`, `paidApiFallback=false`); instalador `C:\Dev\releases\V1-STABLE-RC1\MeuFinanceiro-Instalador-1.0.0-rc.1-x64.exe` (`115.734.512` bytes, `SHA-256` `7dd641f380ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`), sem instalação/execução local para proteger `%APPDATA%\meu-financeiro-desktop`. Bloqueios para GO definitivo `1.0.0`: Nível C do pacote `stable` em Windows limpo/VM isolada e decisão humana na issue `#71`.
> - `M2_IN_PROGRESS` — trilha paralela do Copiloto Financeiro F1–F5 (`feat/mf2-intelligence-3-0-copilot-20261118` @ `e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6`); **o Marco 2 não bloqueia a promoção da v1.0.0**.

**Natureza:** registro factual vinculado ao repositório e às execuções verificadas em disco no workspace isolado `C:\Dev\meu-financeiro`. Nunca promove `NOT_RUN` ou `BLOCKED` a `PASS`.

## Estado Consolidado — Marco 1 (v1.0.0 / PR #105)

- **Repositório:** `JoaoVittorLi/meu-financeiro`
- **Branch ativa do Marco 1:** `feat/mf1-cat-p0-consolidation-20261117` (PR #105, empilhado sobre `#104` / `#100` / `#96` / `#94`)
- **Baseline preservada no remoto antes da Iteração 8:** `6e15914c4c27e0623a7f41cf568175bf6070f735` (publicada em `origin/feat/mf1-cat-p0-consolidation-20261117`).
- **Branch `main`:** intacta em `e0d5131ebeda855a792614d9986f40e5bb94af5e` (`v0.9.4`, sem merge nem tags).
- **Formato único de distribuição:** **Instalador NSIS Windows x64** (`--win nsis --x64`). Versão **Portable** descartada permanentemente.
  - **Estado atual (Marco 1 aprovado em `M1-BASELINE` + Patch Visual `M1.1` Rodada Final `0.9.5-beta.9` [`b7a3d8a`]: `TECHNICALLY_HOMOLOGATED — OWNER_VISUAL_ACCEPTANCE_PENDING`):**
    - **Aprovação formal de M1-BASELINE (preservado):** o proprietário aprovou formalmente o Marco 1 experimental (`0.9.5-beta.8`, `fe2b3186` / docs `c0351d3`, SHA-256 `e96e0604c931d063509e673372552f2a35010f137bb4f88735297c0f1dac6110`), preservado intacto em `C:\Dev\releases\M1-BASELINE\` e no Google Drive privado (`Meu Financeiro/M1-BASELINE`).
    - **Instalador NSIS anterior (`M1.1` pré-refinamento, `f60f319f`):** `MeuFinanceiro-Instalador-0.9.5-beta.9-x64.exe` (`115.740.284` bytes, SHA-256 `934690ca...3a47`) permanece arquivado intacto em `C:\Dev\releases\M1.1-VISUAL\` e no Google Drive privado.
    - **Homologação técnica completa da rodada final `M1.1` (`b7a3d8afcb00b4e0ef84148169fa010bcd156175`, `0.9.5-beta.9`):**
      - **Build NSIS & Proveniência:** `MeuFinanceiro-Instalador-0.9.5-beta.9-x64.exe` (`115.740.811` bytes, SHA-256 `9d515411a8ef362c8f01ce58d95759fdcbd892e9af3e425c0292f9ddd7606be1`), `SHA256.txt` (`112` bytes) e `renderer-provenance.json` (`5.867` bytes) arquivados em `C:\Dev\releases\M1.1-VISUAL-b7a3d8a\`; `verify-asar` PASS (`PASS: ASAR corresponde byte a byte ao renderer compilado e testado.`).
      - **Nível C no EXE instalado (`C:\Dev\mf-nsis-test-install`, perfil sintético isolado):** `14/14` jornadas `PASS` (`FAIL: 0`, `RuntimeIssues: 0`), `d05Parents: 14`, `d05Subcategories: 61`, `svgCount: 67`, `DB integrity: ok`, `integerCentsOnly: true`, `HOST_FOLDERS_UNTOUCHED: True`. Verificação visual direta no EXE instalado (`installed-overview-verification.json` + PNGs `1920x1080-light`, `1366x768-dark`, `1024x720-light`): `hitCheck.same === true` em `.mf-source-panel`, ícones D05 exatos nos 5 itens demo (`Assinaturas:282`, `Internet e telefone:193`, `Transporte:205`, `Supermercado:26`, `Aluguel:264`), `overflow: false`, `HOST_FOLDERS_UNTOUCHED_VISUAL: True`.
      - **Pareceres independentes (`pro`):** pré-build Visual (`APPROVE`, `3438b05d`) + pré-build Forense (`APPROVE`, `b455da1a`) + pós-Nível C Forense (`GO`, `b455da1a`).
      - **Entrega privada no Google Drive (acesso restrito ao proprietário):** pasta `Meu Financeiro/M1.1-VISUAL-b7a3d8a` (ID `1QPHFjnhNk7hH6b7JVZKK7R7fiirav0eY`), contendo `MeuFinanceiro-Instalador-0.9.5-beta.9-x64.exe` (ID `1HjUAbskvcTXEuvDIBBEDvl-EOPfyaJvX`, `DRIVE_HASH_MATCH: True`), `SHA256.txt` (ID `1reRmmmqvjBKuFhGx81BBTwHM7g0ype4w`) e `renderer-provenance.json` (ID `1JKJovYsr0vNMLtO9I2rNg2yzXHBz-RC0`).
  - **Restrições ativas preservadas:** `approvedForPersonal() === false` (`electron/main.cjs`, `electron/d05-personal-gate.cjs`), `financialDataEnabled: false` (`shared/ai-policy.mjs`), dados sintéticos exclusivos (`MF_QA_SYNTHETIC=1`), `main` intacta em `v0.9.4` sem merge/tags.

## Próximo Passo
- **Frente v1.0.0 (`V1_STABLE_RELEASE_PENDING`):** validar o instalador estável `C:\Dev\releases\V1-STABLE-RC1\MeuFinanceiro-Instalador-1.0.0-rc.1-x64.exe` (`release/v1.0.0-rc.1-candidate-20261119` @ `1a22181e6adcb52cca214922821b9f265b76c753`, `SHA-256` `7dd641f380ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`) em VM Windows limpa (Nível C `stable`) e colher aprovação expressa do proprietário na issue `#71` antes de merge na `main` ou tag `v1.0.0`.
- **Frente Marco 2 (`M2_IN_PROGRESS`, não bloqueante para 1.0.0):** concluída a implementação integrada das fatias F1–F5 na worktree `C:\Dev\meu-financeiro-worktrees\m2-copilot` (`feat/mf2-intelligence-3-0-copilot-20261118` @ `e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6`) com `APPROVE` duplo dos auditores `pro` (Visual e Forense/Financeiro), seguindo para empacotamento/Nível C experimental isolado.

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

