# Meu Financeiro 2.0 — mapa de navegação do GitHub

**Use este índice em vez de procurar a decisão mais recente entre dezenas de comentários.**

## Documentação vigente

1. [STATUS_ATUAL.md](STATUS_ATUAL.md) — **ponto de entrada único**: o que está integrado, em desenvolvimento ou bloqueado; SHAs de referência e decisões.
2. [PLANO_DE_RELEASE.md](PLANO_DE_RELEASE.md) — dependências, ownership, critérios de aceite e pipeline até o EXE.
3. [Issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) — decisão de produto e estado operacional do primeiro EXE; fonte principal de aprovação de release.
4. [Issue #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49) — coordenação dos executores e fronteiras dos arquivos.
5. [Issue #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) — QA, SHA e evidências (não apenas número de testes versionados).

## Código e branches vivos

| Finalidade | Local | Quem responde |
|---|---|---|
| Baseline e candidata unificada | [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | Integrador |
| D05 E1/E2/E3 | [PR #81](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | Executor D05 |
| Backend I2-D | [PR #79](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) | Inteligência / Integrador |
| Backend I2-E e handoff final | [PR #80](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | Inteligência / Integrador |
| Design D05 integral aprovado | [PR #57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57), [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) | Designer |
| Contrato funcional D05 bloqueante | [Issue #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) | Executor D05 / Integrador |

**Handoff técnico IA definitivo:** [I2-DE / PR #80](https://github.com/JoaoVittorLi/meu-financeiro/blob/feat/mf2-i2e-category-reliability-20261113/docs/ai-context/I2_DE_RC_INTEGRATION_HANDOFF_20261113.md).

**Pacote visual D05 definitivo:** [Índice do PR #57](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/screens/d05-movimentacoes/D05_FINAL_DELIVERY_INDEX.md).

## O que é histórico (não é instrução operacional vigente)

- **README original v0.9.4**: descreve a última linha antiga do aplicativo; não define o escopo nem a QA da MF2.
- **PRs #31–#54**: etapas anteriores Beta, Argon, U5, Q1; preservadas em histórico/Git, mas a versão atual não deve ser reconstruída por merge em sequência indiscriminada.
- **PRs #60/#63/#68/#73, #64/#75/#78**: fontes já absorvidas na candidata #76; **não rodar pipelines separados como caminho padrão** para release.
- **PR #57** é fonte de design, não código funcional nem prova Electron.
- **Textos antigos de #71/#49/#65/#74 e comentários anteriores** podem dizer que D05 e I2-D/E ficam para depois, ou apontar para RC SHA antigo. **Foram superados pela decisão de exigir tudo no primeiro EXE.** Arquivados em [HISTORICO_ISSUES_20261114.md](HISTORICO_ISSUES_20261114.md), quando disponíveis.
- **Datas/SHAs em docs** são retratos; **sempre consultar HEAD atual** antes de programar/testar.

## Protocolo para atualizar status sem criar ruído

- Cada dono altera seu **PR próprio**; PR #81 para D05, #76 para integrador. Não competir por `main.cjs` e `preload.cjs`.
- Ao publicar código, atualizar **descrição do PR** com SHA, estado `CODE_PRESENT / UI_CONNECTED / TESTED`, testes PASS/FAIL/NOT_RUN e **PRÓXIMO PASSO**.
- Atualizar só o [STATUS_ATUAL.md](STATUS_ATUAL.md) e [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) em marcos importantes (E3, I2-D/E integrada, escrita pessoal, QA). Evitar 10 comentários para cada ajuste.
- Não apagar issues, PRs ou branches antigas para fazer o Git parecer limpo; preservar rastreabilidade e arquivar contexto.
- Não publicar bases pessoais, credenciais, informações bancárias reais ou tokens de API; repositório está público.
