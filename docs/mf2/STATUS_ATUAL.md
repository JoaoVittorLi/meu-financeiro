# Meu Financeiro 2.0 — estado atual (fonte de referência)

> **Atualizado em 14/11/2026.** Retrato operacional, não promessa de release. Para o estado em tempo real, conferir HEADs dos PRs.  
> **Decisão do proprietário:** **não gerar o primeiro EXE** antes de D01–D05, I2-A/B/C/D/E, taxonomia 14×61, biblioteca 67 SVG, escrita pessoal **supervisionada e homologada**, integração e QA reais.  
> **Fonte de coordenação:** [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71). **Quem dispara CircleCI/build:** exclusivamente o proprietário.

## Estado por entrega

| Entrega | Fonte oficial | Estado comprovado |
|---|---|---|
| Base financeira + D01/D02/D03/D04 | [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | **Código integrado** na RC, QA oficial pendente |
| I2-A, I2-B e I2-C | [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | **Código integrado**, leituras pessoais/prévias e laboratório sintético conectados; **escrita pessoal pela IA OFF** |
| I2-D proatividade | [PR #79](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) | Código backend publicado **fora da RC**; 25 testes versionados NOT_RUN |
| I2-E qualidade/explicabilidade | [PR #80](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | Código backend e handoff publicado **fora da RC**; 23 testes versionados NOT_RUN |
| D05 — design inteiro V1.3 | [PR #57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57) / [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) | **DESIGN_APPROVED**; não confundir com Electron implementado |
| D05 E1 (SQLite/migração) | [PR #81](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) / [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) | Código publicado; suíte oficial/backup/restore reais ainda exigem prova |
| D05 E2 (serviços, regras, classificação e adaptador IPC) | [PR #81](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | Código publicado; **adaptador ainda não conectado a MAIN/preload da candidata** |
| D05 E3 (Movimentações + 67 SVGs no renderer real) | [PR #81](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | Em desenvolvimento; último PR indica **E3 iniciado apenas em assets**, NÃO UI conectada |
| Escrita pessoal supervisionada pela IA | [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | **Não implementada/homologada**; mecanismo I2-C atual é só sintético |
| Linux/Node, Electron/Windows QA, ASAR e EXE | [issue #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) | **Sem PASS oficial demonstrado no SHA integrado atual; nenhum EXE entregue** |

## SHAs de referência deste retrato

| Fonte | SHA completo |
|---|---|
| [#76 RC base](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | `545ac5e00199ad4969c69b76e433f17f242ad44e` |
| [#81 D05 Executor](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | `42765cbfe21c17a7d371cb917b6b77fc53ff5644` |
| [#79 I2-D](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) | `fd5aca036ae96ca3aef99be752a2bfdeb9750688` |
| [#80 I2-E](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1` |
| [#57 D05 design](https://github.com/JoaoVittorLi/meu-financeiro/pull/57) | `f93497a86a50470ed3e86bd4c3e3250b2396ab5a` |

**Aviso:** SHA é retrato, não referência móvel nem permissão de executar CI. Revalidar HEAD, branch e árvore antes de qualquer QA ou importação.

## Pendências para o primeiro EXE — ordem de dependências

1. **Executor D05:** concluir E3 no PR #81; ligar componentes reais aos serviços E1/E2 e provar 14 pais/61 filhos/67 ícones em SQLite + Electron. Corrigir defeitos E1/E2 comprovados e documentar testes.
2. **Integrador:** incorporar I2-D/E seletivamente ao PR #76 usando o [handoff](https://github.com/JoaoVittorLi/meu-financeiro/blob/feat/mf2-i2e-category-reliability-20261113/docs/ai-context/I2_DE_RC_INTEGRATION_HANDOFF_20261113.md); Quality Gate I2-E é a única via de recomendações. Proteger MAIN, owner, conta, grant e IPC.
3. **Integrador + D05:** ligar adaptador D05 ao MAIN/preload (não conceder permissão no renderer); validar resolvedor canônico `{categoryId, subcategoryId|null}` em todos os fluxos. Histórico legado permanece com filho nulo, sem inferência automática.
4. **Integrador:** implementar/promover gateway **pessoal supervisionado separado** do executor sintético, somente após backup, escopo/grant, prévia com IDs/versionamento, confirmação humana nativa, COMMIT+recibo idempotente, rollback/recovery e testes. Não simplesmente passar banco pessoal ao executor sintético.
5. **Integrador:** publicar uma nova candidata unificada no PR #76, com matriz `CODE_PRESENT / UI_CONNECTED / TESTED / WRITE_ENABLED` e SHA exato.
6. **Proprietário:** executar Linux preflight → QA Windows → build NSIS/Portable, separadamente, com evidências no **SHA final**. Ver [plano de release](PLANO_DE_RELEASE.md).

## Restrições que seguem vigentes

- Não fazer merge na `main`, não executar CI pago sem autorização, não alterar produção Cloudflare, não consumir API paga automaticamente.
- **RC Windows experimental é offline e usa SQLite isolado.** Pluggy/Cloudflare/LLM externo estão bloqueados no packaged atual; não prometer sincronização bancária real nem importar dados pessoais automaticamente.
- Não promover design aprovado, teste V8/mock, deploy de preview Cloudflare ou teste de sintaxe a `QA PASS`.
- D05, IA e integrações compartilhadas não devem ser editadas simultaneamente por donos diferentes. Ownership: [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49).
- Repositório atualmente público: não publicar bases pessoais, logs com tokens, chaves Pluggy ou credenciais.

> **Para novas conversas e novos executores:** comece por **este arquivo**, o [roteiro](PLANO_DE_RELEASE.md), o [índice](GUIA_DE_NAVEGACAO.md), os PRs vivos e o SHA atual. Não use resumos históricos como instrução de execução.
