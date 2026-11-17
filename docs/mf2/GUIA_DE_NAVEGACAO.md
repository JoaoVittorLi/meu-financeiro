# Guia de navegação — Meu Financeiro / candidata 1.0.0

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 18 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Ramo P0 em execução:** [#100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) (categorização automática, ainda não integrado a #96), [#98](https://github.com/JoaoVittorLi/meu-financeiro/pull/98) (documentação). A decisão Opção A consta na issue #71; QA #65; ownership #49. Nenhuma escrita pessoal geral foi habilitada.


> Índice vigente para a árvore de código **PR #96** HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`, em 17/11/2026. A documentação vinda do [PR #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82) foi revisada e reutilizada aqui; o PR #82 e seus SHAs são **históricos**, não instruções para rodar o release.

## Onde começar

| Prioridade | Documento | Responsabilidade |
|---|---|---|
| 1 | [STATUS_ATUAL](STATUS_ATUAL.md) | Fonte factual do estado, SHA e NO-GO; não duplicar o painel |
| 2 | [MATRIZ_FUNCIONAL](MATRIZ_FUNCIONAL_1_0_0.md) | Implementado, UI conectada, QA e disponibilidade por módulo |
| 3 | [PLANO_DE_RELEASE](PLANO_DE_RELEASE.md) | Critérios de aceite e aprovação exclusiva do proprietário |
| 4 | [MATRIZ_QA](MATRIZ_QA_1_0_0.md) | Checklist de execução real por SHA |
| 5 | [ARQUITETURA](ARQUITETURA.md) | Dados, IPC, Electron, IA e serviços |
| 6 | [DADOS_MIGRACAO](DADOS_MIGRACAO.md) | Regras de canal e restauração |
| 7 | [RELEASE_NOTES_1_0_0](RELEASE_NOTES_1_0_0.md) | Rascunho das notas, **não release publicado** |
| 8 | [ROADMAP_POS_1_0](ROADMAP_POS_1_0.md) | Futuro, não anunciar como funcionalidade atual |
| 9 | [CHANGELOG](../../CHANGELOG.md) | Histórico e incompatibilidades |

## Issues canônicas

- **[#71 RELEASE](https://github.com/JoaoVittorLi/meu-financeiro/issues/71):** único local de GO/NO-GO, escopo 1.0 e decisão sobre escrita IA; equivale ao acompanhamento do marco v1.0.0 enquanto um Milestone GitHub próprio não for criado com permissão.
- **[#49 COORDENAÇÃO](https://github.com/JoaoVittorLi/meu-financeiro/issues/49):** responsáveis, branches, fronteiras de MAIN/preload.
- **[#65 QA](https://github.com/JoaoVittorLi/meu-financeiro/issues/65):** comandos/CI/Windows/artefatos com log e SHA.
- **[#74 D05](https://github.com/JoaoVittorLi/meu-financeiro/issues/74):** aceite real de SQLite/IPC/UI da D05, não só design.
- **[#84 VISUAL](https://github.com/JoaoVittorLi/meu-financeiro/issues/84):** aceite B01–B05/Electron real.
- [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) e [#57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57): decisões e design D05 congelados.

## Cadeia funcional atual e fontes

| Fase | PR(s) | Condição |
|---|---|---|
| Beta/UX e base inicial | #22, #31–#54, #60, #63, #68 | **HISTÓRICO**, preservar Git e notas; não usar como QA atual |
| D03/D04 e I2-A/B/C | #64, #73, #75, #78 → **[#76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76)** | Incorporadas à RC anterior; #76 não é mais o HEAD final |
| D05 14×61×67 | #57 design, #81 execução, #74 QA | Código integrado na candidata, aceite Windows pendente |
| I2-D/E | #79/#80 → #76 → #94 | Quality Gate / propostas de leitura; QA no novo SHA pendente |
| B01/B02/B03/B04 | #85/#86 → #88 → **#94** | Reuso da implementação aprovada, sem duplicar PR #87 |
| B05 Premium | #92 → **[#94](https://github.com/JoaoVittorLi/meu-financeiro/pull/94)** | Hoje V6, Conversar V5, Plano V5; projeção real condicionada a IC-READ |
| I3-00 / I3-01 | #89/#93 planejamento, **[#95](https://github.com/JoaoVittorLi/meu-financeiro/pull/95)** integrado em #94 | I3-00 é marco arquitetural; I3-01 código read-only de investigação |
| Segurança Pluggy/SQLite/B05 compositor | **[#96](https://github.com/JoaoVittorLi/meu-financeiro/pull/96)** | RC2.2 + RC2.3, Draft, testes oficiais no SHA atual pendentes |
| Histórico documental | **[#82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82)** | Acervo de decisões/README e textos preservados; não confundir com código #96 |
| Preparação documental 1.0 | PR desta branch | **DOCS_ONLY** empilhado no #96, não publicado em main |

## Onde está a evidência técnica

- [RC-ALL-02 B01–B05 QA](../ai-context/RC_ALL_02_B01_B05_QA_20261116.md) — histórico do #94.
- [RC-ALL-02.2 Pluggy e B05](../ai-context/RC_ALL_02_2_HOTFIX_20261116.md), [RC-ALL-02.3 backup](../ai-context/RC_ALL_02_3_BACKUP_GATE_20261117.md) — mudança atual.
- [I3-01](../intelligence/I3-01/EXECUTOR_HANDOFF.md) — investigação e limitações.
- [I2-D/E](../ai-context/I2_DE_RC_INTEGRATION_HANDOFF_20261113.md) — handoff original; partes descritas como "a integrar" são **históricas** porque a candidata já incorporou código.
- [Arquivo de issues 14/11](HISTORICO_ISSUES_20261114.md), [README v0.9.4](HISTORICO_README_v0_9_4.md), [histórico das entregas](HISTORICO_LINHA_BETA.md) — **somente histórico**, nunca fonte vigente de GO.

## Regra para novos agentes

Consultar primeiro HEAD vivo dos PRs #94 e #96 e `STATUS_ATUAL`; nunca tratar PASS de outra árvore como prova da atual. Não fechar issue por código publicado sem QA/aceite. Não remover histórico, redirecionar documentos vigentes para um único índice e registrar mudanças de status relevantes somente em #71 (release), #49 (ownership) e #65 (QA). Nenhum EXE, CircleCI pago, merge main, tag, mudança em perfil pessoal ou escrita IA sem autorização.
