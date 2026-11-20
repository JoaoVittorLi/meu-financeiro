# Estado comprovado do projeto — atualizado em 19/11/2026 (Início do Marco 3)

> **Roadmap Oficial Revisado (19/11/2026):**
> - **M1 — Fundação Financeira:** implementação concluída e homologação técnica registrada (`PR #105` `61d9b81`, `M1.1` `b7a3d8a`, candidata `v1.0.0-rc.1` `1a22181e`, `SHA-256` `7dd641f3680ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`).
> - **M2 — Inteligência Financeira 3.0:** homologação experimental concluída (`e3c153c` / docs `6b9c9ad`, `PR Draft #107`, Nível C `15/15` + `VEREDITO: GO`); aceite funcional final do proprietário separado.
> - **M3 — Copiloto com Ações Financeiras Supervisionadas (NOVA PRIORIDADE — AUTORIZADO PARA IMPLEMENTAÇÃO S0→S5):** escrita supervisionada (`D05PersonalWriteGateway`), `GPT-6.2 Sol` (`gpt-6.2-sol`), **`M3-SALARY`** (orçamento inteligente por salário), regras por conta (`rule.save`), Planejamento/Orçamentos por conversa e entrega consolidada **M1 + M2 + M3 na versão estável 1.0.0** na worktree isolada `C:\Dev\meu-financeiro-worktrees\m3-supervised-copilot` (`feat/mf3-supervised-copilot-1-0-0-20261119`).
> - **M4 — Planejamento Preditivo e Conciliação:** backlog pós-M3. **Multidispositivo / PWA / Cloudflare:** desenvolvimento congelado para descontinuação futura (sem remoção de código/testes compartilhados sem inventário/autorização; **Pluggy/Open Finance desktop mantido ativo**).

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
- **Marco 3 (`feat/mf3-supervised-copilot-1-0-0-20261119`):** executar fatias **S0 → S1 (categorização supervisionada + recibo/desfazer) → M3 GPT-6.2 Sol → S2 (`M3-SALARY` orçamento inteligente por salário) → S3 (regras por conta) → S4 (planejamento/orçamentos + F4) → S5 (continuidade + consolidação estável `1.0.0`)**, mantendo `main` (`e0d5131ebeda855a792614d9986f40e5bb94af5e`) e perfis pessoais/NSIS estável do host intocados durante QA sintético.
- **Marco 1 / 2 baselines preservadas:** `M1-BASELINE`, `M1.1-VISUAL`, `M1.1-VISUAL-b7a3d8a`, `V1-STABLE-RC1` (`1a22181e`, `SHA-256` `7dd641f3680ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`) e `M2-COPILOT-RC` (`e3c153c`). Ver log `docs/ai-context/logs/2026-11-19-mf3-supervised-copilot.md`.

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

