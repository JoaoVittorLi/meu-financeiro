# Estado comprovado do projeto — atualizado em 18/11/2026

**Natureza:** registro factual vinculado ao repositório e às execuções verificadas em disco no workspace isolado `C:\Dev\meu-financeiro`. Nunca promove `NOT_RUN` ou `BLOCKED` a `PASS`.

## Estado Consolidado — Marco 1 (v1.0.0 / PR #105)

- **Repositório:** `JoaoVittorLi/meu-financeiro`
- **Branch ativa do Marco 1:** `feat/mf1-cat-p0-consolidation-20261117` (PR #105, empilhado sobre `#104` / `#100` / `#96` / `#94`)
- **Baseline preservada no remoto antes da Iteração 8:** `6e15914c4c27e0623a7f41cf568175bf6070f735` (publicada em `origin/feat/mf1-cat-p0-consolidation-20261117`).
- **Branch `main`:** intacta em `e0d5131ebeda855a792614d9986f40e5bb94af5e` (`v0.9.4`, sem merge nem tags).
- **Formato único de distribuição:** **Instalador NSIS Windows x64** (`--win nsis --x64`). Versão **Portable** descartada permanentemente.
  - **Estado atual (Marco 1 aprovado em `M1-BASELINE` + Patch Visual `M1.1` `0.9.5-beta.9` HOMOLOGADO EM NÍVEL A + B + C + GOOGLE DRIVE PRIVADO):**
    - **Aprovação formal de M1-BASELINE (preservado):** o proprietário aprovou formalmente o Marco 1 experimental (`0.9.5-beta.8`, `fe2b3186` / docs `c0351d3`), preservado intacto em `C:\Dev\releases\M1-BASELINE\` e no Google Drive privado (`Meu Financeiro/M1-BASELINE`), autorizando exclusivamente o patch visual localizado da **Visão Geral** (`M1.1`, versão experimental `0.9.5-beta.9`).
    - **Correção visual `M1.1` (Visão Geral exclusiva, código no SHA `f60f319f089e4672b9e15590e72ff967107132ab`):** fechamento correto de `.u1-left-stack` após `.u1-rhythm` em `src/app.ts` e ajuste de CSS Grid em `app/overview.css` (`Seu ritmo de gastos` em ~2/3 + `.u1-side-stack` compacta com `Na sua agenda` e `Orçamento em foco` sem altura artificial em ~1/3; `Para onde foi seu dinheiro` integrado em largura total com 2 colunas em `@media (min-width: 1181px)` e coluna única abaixo; responsividade sem overflow horizontal e rodapé protegido da FAB), sem impactar Movimentações, Planejamento, Orçamentos, Contas, Simular compra ou Inteligência.
    - **Nível A (`f60f319f` / `0.9.5-beta.9`):** **PASS**: `test:types`, `compile`, `build-preload check`, `check-bundle` (`31` entradas), `test:asar` (`1/1`), `test:db` (**`1002/1002`**, `0` falhas — inclui `tests/overview-m1-1-layout.test.cjs`), `mobile-push` (**`133/133`**), `provenance:create` + `provenance:verify` PASS.
    - **Nível B (`f60f319f` / `0.9.5-beta.9`):** **PASS** (`test:electron-smoke` + `verify-visual-matrix` **`32/32` PNGs** em `8` áreas / `4` presets, `nivel-b-interactive-qa.cjs` **`14/14`** jornadas `PJ-01..09`/`NJ-01..05`, `FAIL: 0`, `RuntimeIssues: 0`, além de comparativo `before` vs `after` em `1920x1080`, `1366x768` e `1024x720` claro/escuro).
    - **Nível C (`M1.1` `0.9.5-beta.9` realmente instalado):** **PASS**:
      - Instalador NSIS x64 (`--win nsis --x64 --publish never`, zero Portable, zero CI pago) gerado em `C:\Dev\releases\M1.1-VISUAL\MeuFinanceiro-Instalador-0.9.5-beta.9-x64.exe` (**`115.740.284` bytes**, SHA-256 `934690ca13b18b433ee62175070937ec53e9d741403b6faded6db7cbcb9e3a47`), com `verify-asar` PASS byte a byte.
      - Instalado silenciosamente em `C:\Dev\mf-nsis-test-install\Meu Financeiro RC Experimental.exe` com `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR=C:\Dev\mf-nsis-test-userdata`, `MF_QA_SYNTHETIC=1` e `MF_DESKTOP_SMOKE_DIR` ausente: **`14/14` jornadas PASS (`PJ-01..09`, `NJ-01..05`, `0` RuntimeIssues)**, `ASAR version=0.9.5-beta.9` (`appId: app.local.meufinanceiro.rcall01`, D05 `14/61/67`), `PRAGMA integrity_check = ok`, centavos inteiros e **`HOST_FOLDERS_UNTOUCHED: true`**.
      - Publicado em pasta privada **restrita ao proprietário** no Google Drive (`Meu Financeiro/M1.1-VISUAL`, ID `1XTT-ebnBTkmFr0tfBxG0cv3_EbRA8igI`, arquivo ID `1IoRKpYkUt2YwzI-agqC6N7OO4oe_nUQ_`), com download de conferência confirmado em `115.740.284` bytes e SHA-256 idêntico (`DRIVE_HASH_MATCH: True`).
  - **Restrições ativas preservadas:** `approvedForPersonal() === false` (`electron/main.cjs`, `electron/d05-personal-gate.cjs`), `financialDataEnabled: false` (`shared/ai-policy.mjs`), dados sintéticos exclusivos (`MF_QA_SYNTHETIC=1`), `main` intacta em `v0.9.4` sem merge/tags.

## Próximo Passo
- Entregar o pacote final `M1.1` (`0.9.5-beta.9`) ao proprietário com link privado do Google Drive, SHA-256 e evidências visuais. **Marco 2 permanece suspenso até decisão explícita do proprietário.**

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

