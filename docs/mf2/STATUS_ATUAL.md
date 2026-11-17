# STATUS ATUAL — Meu Financeiro / preparação 1.0.0

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 19 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Cadeia funcional em preparação:** #94 → #96 → [#100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) (P0 ainda **não integrado ao #96/main**). Documentação #98 descreve três branches e depende do merge controlado do P0. Não contar o código em #100 como QA ou disponibilidade da #96.


> **Painel canônico de referência documental**, atualizado em 17/11/2026. A decisão/GO continua exclusivamente na [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71); coordenação técnica na [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49). O PR documental não altera o aplicativo nem o status de testes.

## Estado verificado

| Elemento | Estado em 17/11/2026 | Evidência |
|---|---|---|
| Baseline histórica | `main`, README v0.9.4, **não é a candidata 1.0** | [PR documental #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82), [arquivo do README](HISTORICO_README_v0_9_4.md) |
| RC consolidada | **PR #94 Draft**, HEAD `674108e961691d419700cbce7fe5f2c3ed3b962e`, base #76 | [#94](https://github.com/JoaoVittorLi/meu-financeiro/pull/94) |
| Hotfix e candidata mais recente | **PR #96 Draft**, HEAD **`2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`**, base #94; RC-ALL-02.3 implementada no código | [#96](https://github.com/JoaoVittorLi/meu-financeiro/pull/96) · [RC-ALL-02.3](../ai-context/RC_ALL_02_3_BACKUP_GATE_20261117.md) |
| Documento ancestral | **PR #82 Draft** baseado na `main` anterior, conteúdo ainda útil como arquivo histórico | [#82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82) |
| Package/lock | **0.9.5-beta.8** em ambos; Node **22.23.4** e npm **10.9.9**; Electron **45.2.3** | `package.json`, `package-lock.json` no HEAD #96 |
| I3-01 | Código de investigação incorporado ao #94 pela linha #95; execução com grants e dados parciais | [#95](https://github.com/JoaoVittorLi/meu-financeiro/pull/95), `electron/intelligence-investigation.cjs` |
| Escrita pessoal IA | **Desativada** em `electron/main.cjs` (`approvedForPersonal:()=>false`); não habilitar em 1.0 sem decisão expressa | [#96](https://github.com/JoaoVittorLi/meu-financeiro/pull/96) |
| Release definitivo 1.0.0 | **NÃO CRIADO / NO-GO**; sem tag, merge main ou instalador estável autorizado | [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) |

## Evidências, sem propagar PASS entre SHAs

| Escopo + SHA | Prova conhecida | Classificação |
|---|---|---|
| PR #94 `674108e...` | Registros do proprietário: 901/901 Node/SQLite, TypeScript, ASAR e F08 PASS; CircleCI `preflight_linux: success` | **PASS histórico daquele SHA, não do #96** |
| PR #94 `674108e...` | CircleCI `build_windows: error`; log concreto não obtido na revisão | **ERROR**, causa indeterminada; não atribuir ao código sem log |
| PR #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff` | 5 regressões SQLite sintéticas adicionadas (`tests/rc-all-02-3-backup.test.cjs`) e 12 testes RC2.2, comandos registrados | **TESTS_VERSIONED; OFFICIAL_TESTS_NOT_RUN** |
| RC-ALL-02.3 (mesmo #96) | 10/10 verificações isoladas V8 com FS/SQLite simulado; relato pontual 5/5 SQLite em Node 22.16.0 | **ISOLATED_PASS**, não PASS da suíte Node 22.23.4 |
| SHA #96 atual | `npm ci`, TypeScript, `test:db`, preload, ASAR/F08, Electron GUI, Windows, Pluggy sintético em pacote real | **NOT_RUN** |
| Documentação deste PR | Apenas arquivos Markdown e cópias históricas; nenhuma alteração de código | **DOCS_ONLY, QA CODE INALTERADO** |

## Escopo em código e limitações principais

A candidata possui D01–D05, B01–B05, D05 14×61×67, I2-A/B/C/D/E e I3-01 em sua árvore. Isso **não** constitui homologação de UI no EXE. B05 Pulso Financeiro não exibe projeção pessoal numérica sem saldo disponível + compromissos datados verificados pelo IC-READ; fallback honesto permanece. Pluggy/Cloudflare/LLM externo são **bloqueados no canal RC experimental**. O fluxo stable futuro mantém cofre Windows e banco local, porém sua continuidade depende de teste sintético no empacotado real. Escrita pessoal IA não é permitida.

Detalhamento linha a linha: [MATRIZ_FUNCIONAL_1_0_0.md](MATRIZ_FUNCIONAL_1_0_0.md).

## Bloqueios ativos

1. **P0 QA oficial no SHA atual**: Node/npm fixados, 17 novas verificações RC2.2/RC2.3 e suíte histórica; investigar qualquer FAIL sem relabel.
2. **P0 Windows real**: GUI Electron, 32 capturas e B01–B05, segurança IPC/preload, identidade `stable` dentro do ASAR, persistência de SQLite e Pluggy com fixtures exclusivamente sintéticas.
3. **P0 falha anterior do job Windows**: recuperar log bruto e classificar erro de infraestrutura/produto; enquanto desconhecido, gate não aprovado.
4. **P0 OPÇÃO A DECIDIDA:** categorização automática pessoal por conta **obrigatória para a 1.0**. PR #100 implementa caminho dedicado, mas release BLOQUEADO até execução Node/SQLite/Windows no HEAD integrado e calibração/aceite. Outras escritas IA podem continuar OFF.
5. **P0 publicação**: QA completo e autorização do proprietário para fixação `1.0.0`, `v1.0.0`, GitHub Release, Windows stable/instalador, atualização de perfis reais.
6. **P1 produto**: concluir aceite D05 e B01–B05 em Electron real. Issues #74/#84 permanecem abertas até provas.

## Governança

- **GO/NO-GO:** [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71). **Owner e conflitos:** [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49). **Gates:** [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65).
- **Design/conformidade:** [#84](https://github.com/JoaoVittorLi/meu-financeiro/issues/84) e [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74).
- **Instruções de execução:** [PLANO_DE_RELEASE](PLANO_DE_RELEASE.md) e [MATRIZ_QA](MATRIZ_QA_1_0_0.md).
- SHAs são **instantâneos**: conferir HEAD vivo do PR #96 antes de qualquer teste; todo novo commit após o SHA verificado invalida os gates aplicáveis.


## CAT-01 a CAT-05 — nova decisão P0 (17/11/2026)

**Novo bloqueador formal:** o proprietário tornou a categorização automática bancária com consentimento um requisito necessário para a versão **1.0.0**. Não é uma entrega opcional pós-release.

PRs de implementação **isolada**: [#99](https://github.com/JoaoVittorLi/meu-financeiro/pull/99) (evidências Pluggy e motor D05; 19/19 de lógica V8 PASS, SQLite NOT_RUN), [#101](https://github.com/JoaoVittorLi/meu-financeiro/pull/101) (prévia de histórico completo; Node SQLite NOT_RUN), [#102](https://github.com/JoaoVittorLi/meu-financeiro/pull/102) (consentimento, automação local, recibos e undo; 8/8 checks isolados V8 PASS, Node SQLite NOT_RUN).

Esses PRs ainda **não conectam a automação ao Electron real**: MAIN/preload/renderer/migração são trabalho de integração da #49. Valores iniciais de checkbox não equivalem a consentimento; `approvedForCategorization` está falso por padrão. `approvedForPersonal:()=>false` deve permanecer para outras escritas IA.

**Resultado: 1.0.0 NO-GO**, até integrar CAT-01–05 na candidata, demonstrar 600+ transações sintéticas, Node/SQLite, Electron Windows, rollback/backup/restore, proteção manual e UX. Versão/tag/EXE continuam proibidos sem nova aprovação explícita.

## P0 CAT — revisão de segurança das evidências / PR #104 (17/11/2026)

**Nova regressão isolada:** [PR #104](https://github.com/JoaoVittorLi/meu-financeiro/pull/104), Draft **sobre o PR #100**. Ele evita que lançamentos importados com IDs diferentes e mesmo estabelecimento, data e valor sejam contados como cinco correções humanas independentes. A evidência qualitativa I2-E passa a receber a contagem de possíveis duplicatas; transações ambíguas devem ir para revisão, sem gravação automática. Uma regressão sintética adicional foi adicionada: suíte do PR #104 contém **20 testes declarados**, não executados no Node oficial.

**Dependência:** Integrador deve reconciliar **PR #100 + #104** com a cadeia modular #99 → #101 → #102 *seletivamente*, sem dois escritores/consentimentos ativos para a mesma movimentação. O QA final e a avaliação de falso positivo **ainda estão NOT_RUN**; não afirmar calibração do critério 5 correções/3 datas nem GO da 1.0.