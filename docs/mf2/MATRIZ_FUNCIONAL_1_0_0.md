# Matriz funcional — escopo verificado da candidata 1.0.0

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 19 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Fotografia:** 17/11/2026, árvore funcional PR #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff` baseada em PR #94 `674108e...`. Esta matriz é **inventário do código**, não certificação de versão lançada. `main` não recebeu a candidata.

## Regras das colunas

- **CODE_PRESENT:** `YES` = módulo/regra existe na árvore; `PARTIAL` = contrato ou implementação incompleta; `NO` = não há feature final.
- **UI_CONNECTED:** `YES` = renderer/preload/rotas de acesso conectados em código; `PARTIAL` = somente ramo/fallback/estado controlado; `NO` = sem interface de uso real.
- **TESTED:** `HIST94` = provas locais do proprietário no SHA #94, **não transferíveis ao #96**; `SYNTHETIC_ONLY` = check isolado ou teste versionado, sem PASS oficial do #96; `NOT_RUN` = faltam provas do SHA novo. `HIST94` **não** é homologação atual.
- **AVAILABLE:** `CANDIDATE_ONLY` = uso programado no Electron candidato, **não lançado**; `CONDITIONAL` = exige fonte/grant/perfil/flags; `BLOCKED` = indisponível; `PLANNED` = futuro. **Nenhuma linha equivale a estabilidade 1.0 aprovada.**

## Núcleo financeiro e D01–D05

| Recurso | CODE_PRESENT | UI_CONNECTED | TESTED | AVAILABLE | Limitação / referência |
|---|---|---|---|---|---|
| Perfis real/demo e lançamentos manuais | YES | YES | HIST94 | CANDIDATE_ONLY | SQLite local; preview/confirm de classificação e fonte separados |
| Movimentações bancárias / POSTED/PENDING | YES | YES | HIST94 | CONDITIONAL | Histórico depende de Pluggy/sync anterior; no RC empacotado a conexão é OFF |
| Filtros por período, fonte, contas, categorias | YES | YES | HIST94 | CANDIDATE_ONLY | Cobertura bancária e contagem carregada podem ser parciais |
| Classificação/revisão manual e regras | YES | YES | HIST94 | CANDIDATE_ONLY | Edições locais supervisionadas, não alteram extrato bancário original |
| Splits, transfer/ignore, duplicidade | YES | YES | HIST94 | CANDIDATE_ONLY | Reconciliar centavos/status; regressão no SHA novo pendente |
| D05 E1 migração SQLite v7 | YES | PARTIAL | HIST94 | CONDITIONAL | Migração é backend; backup/restore e integridade RC2.3 aguardam novo QA |
| D05 E2 serviços/IPC/CRUD de categorias | YES | YES | HIST94 | CANDIDATE_ONLY | Escopo categoryId/subcategoryId e gates MAIN; QA Windows pendente |
| D05 E3 UI premium Movimentações | YES | YES | HIST94 | CANDIDATE_ONLY | Revisão visual, foco, Escape, temas e 67 SVGs ainda sem aceite Windows |
| Catálogo D05 14 pais / 61 filhos / 67 SVGs | YES | YES | HIST94 | CANDIDATE_ONLY | Identidade aprovada no design; não confundir com QA da migração |
| Orçamentos por natureza, limite zero/indefinido | YES | YES | HIST94 | CANDIDATE_ONLY | Fonte bancária/manual explícita, períodos comparáveis |
| Planejamento e compromissos | YES | YES | HIST94 | CANDIDATE_ONLY | Registro exige confirmação; não projetar saldo sem fonte verificada |
| Simular compra e planejar esta compra | YES | YES | HIST94 | CANDIDATE_ONLY | Cenário hipotético ≠ compromisso; parcela/juros precisam conferência |
| Minhas contas, saldo de referência e histórico | YES | YES | HIST94 | CONDITIONAL | Saldo com timestamp/coverage; Pluggy depende de canal e cofre |
| D01 Conversar / chat integrado | YES | YES | HIST94 | CONDITIONAL | Grants e modo desconectado; respostas baseadas em dados permitidos |
| D02 interfaces de Inteligência | YES | YES | HIST94 | CANDIDATE_ONLY | Contrato UI do design, sem aprovação Windows atual |
| D03 Hoje V2 e visualizações | YES | YES | HIST94 | CANDIDATE_ONLY | Mantido como fallback da rota B05, não remover |
| D04 Central de Revisão V1.1 | YES | YES | HIST94 | CONDITIONAL | Apenas evidência/autorização/preview; escrita IA pessoal OFF |
| B01 Visão Geral V3 | YES | YES | HIST94 | CANDIDATE_ONLY | Alinhamento/identidade e responsividade precisam screenshots atuais |
| B02 Orçamentos V7 | YES | YES | HIST94 | CANDIDATE_ONLY | Iconografia D05, limites e chart revisados; QA Windows pendente |
| B03 Movimentações V2 | YES | YES | HIST94 | CANDIDATE_ONLY | Consistência de ícones e detalhes no Electron pendente |
| B04 seletor D05 V2 | YES | YES | HIST94 | CANDIDATE_ONLY | Popup adaptativo, teclado/Escape e focus trap precisam QA |
| B05 Hoje V6 / Pulso Financeiro | YES | YES | HIST94 | CONDITIONAL | **Projeção real bloqueada** sem IC-READ caixa disponível + agenda reconciliada; fallback honesto |
| B05 Conversar V5 | YES | YES | HIST94 | CONDITIONAL | Composer corrigido em #96, QA visual do novo SHA NOT_RUN |
| B05 Plano de Ação V5 | YES | YES | HIST94 | CONDITIONAL | Simulações de leitura, revisão autorizada; não realiza escrita financeira IA |

## P0 1.0 aprovado / implementação em PR #100 (fora do HEAD #96)

| Recurso | CODE_PRESENT | UI_CONNECTED | TESTED | AVAILABLE | Limitação / referência |
|---|---|---|---|---|---|
| Categorização automática bancária pessoal (por conta) | YES **PR #100** | YES **PR #100** | ISOLATED_V8_PASS; NODE_SQLITE_NOT_RUN | **BLOCKED** | Opt-in no MAIN e SQLite, 90 dias, 5 correções coerentes em 3 datas, I2-E; calibração/segurança/Windows obrigatórias antes de uso real |
| 14×61 D05 automático, precedência manual/regra | YES **PR #100** | YES **PR #100** | OFFICIAL_NOT_RUN | **BLOCKED** | Overlay separado; POSTED, sincronização completa, sem split/transfer/ignore; correção protegida e recibo |
| Recibos, backup, reversão e sugestões de regras aprováveis | YES **PR #100** | YES **PR #100** | 19 TESTS_VERSIONED; NOT_RUN | **BLOCKED** | Sugestões são somente prévia, regras novas exigem aprovação distinta; restaurar e inspecionar no Windows |
| Outras escritas pessoais da IA | PARTIAL | PARTIAL | NOT_RUN | **BLOCKED** | `approvedForPersonal:()=>false` permanece. Não ampliar o grant de categorização automaticamente |

**Atenção:** nesta tabela, `YES PR #100` significa código existente **em branch concorrente ainda não integrado ao HEAD #96**; **AVAILABLE=BLOCKED** até CI/QA Windows e integração. A decisão Opção A de liberar exclusivamente categorização automática para a 1.0 é obrigatória; outras escritas não entram no escopo P0.

## Inteligência, banco e infraestrutura

| Recurso | CODE_PRESENT | UI_CONNECTED | TESTED | AVAILABLE | Limitação / referência |
|---|---|---|---|---|---|
| I2-A IC-READ/IC2 / grants e leitura | YES | YES | HIST94 | CONDITIONAL | Fonte/perfil/mês/owner, expiração/revogação; não extrapolar dados |
| I2-B categorias e revisão de propostas | YES | YES | HIST94 | CONDITIONAL | Revisão local permitida apenas pelo fluxo autorizado; IA não executa writes pessoais |
| I2-C atomicidade, recibos, sandbox | YES | PARTIAL | HIST94 | CONDITIONAL | Sandbox sintético e provas de rollback, gateway pessoal de IA ainda bloqueado |
| I2-D sugestões proativas | YES | YES | HIST94 | CONDITIONAL | Requer fatos, candidatos e quality gate; nenhuma escrita automática |
| I2-E avaliação de evidência/Quality Gate | YES | YES | HIST94 | CONDITIONAL | Rejeitar incongruência, hierarquia D05, stale e baixa cobertura |
| I3-00 / arquitetura Intelligence 3.0 | PARTIAL | NO | NOT_RUN | PLANNED | Concepção e direcionamento; **não** anunciar como módulo funcional |
| I3-01 investigação financeira comparativa | YES | YES | HIST94 | CONDITIONAL | Leitura por período, evidências, cobertura parcial, contexto/conta; sem transações arbitrárias |
| Escrita IA pessoal supervisionada | PARTIAL | PARTIAL | NOT_RUN | BLOCKED | Código de gate/preview, mas `approvedForPersonal:()=>false`; decisão explícita #71 |
| IA externa / LLM configurável | YES | PARTIAL | NOT_RUN | CONDITIONAL | OAuth/cofre/autorização; RC/smoke proíbem rede; não garantido offline |
| Pluggy importação/sincronização | YES | YES | HIST94 | CONDITIONAL | Disabled na RC; stable ainda não aprovado/validação com credenciais reais proibida |
| Histórico bancário offline se cofre indisponível | YES | YES | SYNTHETIC_ONLY | CONDITIONAL | RC2.2 `bank:status` com fallback, teste Windows pending |
| SQLite v7 / WAL / migrações / backup pré-upgrade | YES | PARTIAL | SYNTHETIC_ONLY | CONDITIONAL | RC2.3 cinco novos testes versionados, oficial SHA #96 NOT_RUN |
| Seleção de canal/pastas stable, RC e smoke | YES | PARTIAL | SYNTHETIC_ONLY | CONDITIONAL | Requer marker real no ASAR Windows e path no runtime |
| Electron 45 sandbox, IPC/preload bundled | YES | YES | HIST94 | CANDIDATE_ONLY | Segurança runtime Windows precisa confirmação |
| Cloudflare Worker/PWA e cutover pessoal | PARTIAL | PARTIAL | NOT_RUN | BLOCKED | Código Worker existe, **migração/paridade pessoal não aprovada** |
| Projeção verificada IC-READ (saldo+agenda) | NO | NO | NOT_RUN | PLANNED | Contrato composto ausente; fixtures não são saldos pessoais |

## Qualificação

`TESTED=HIST94` significa somente que o PR #94 reportou 901/901 testes Node/SQLite e ASAR/TypeScript/F08 PASS em seu SHA; isso **não requalifica #96**. Revisão B01–B05 e D05 pelo proprietário foi **DESIGN_APPROVED**, não Electron Windows aprovado. Features `CONDITIONAL` nunca podem surgir automaticamente por upgrade; exigem seus grants/controle explícito.

O **status final de lançamento é NO-GO**, conforme [STATUS_ATUAL](STATUS_ATUAL.md) e [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71).


## Addendum CAT-01 a CAT-05 — P0 obrigatório 1.0.0 (17/11/2026)

**Decisão do proprietário:** classificação automática bancária com consentimento explícito é requisito **P0 bloqueante da 1.0.0**. As linhas abaixo descrevem PRs de desenvolvimento isolados, **não funcionalidades já integradas ao snapshot #96**.

| Módulo P0 | CODE_PRESENT na branch própria | UI_CONNECTED na candidata #96 | TESTED (no SHA exato) | Estado de release |
|---|---|---|---|---|
| CAT-01 — evidências opcionais Pluggy + SQLite | YES, PR #99 | NO | V8 parcial; SQLite NOT_RUN | BLOCKED |
| CAT-02 — fusão D05/Quality Gate/Naive Bayes local não calibrado | YES, PR #99 | NO | 19 casos de lógica PASS em V8; Node NOT_RUN | BLOCKED |
| CAT-03 — full-history SQLite com prévia, pausa e manifest | YES, PR #101 | NO | 9 testes SQLite versionados, NOT_RUN | BLOCKED |
| CAT-04 — eventos locais pós-sync/diário e deduplicação | YES, PR #102 | NO | 8 checks sintéticos V8 em conjunto com CAT-05; Node NOT_RUN | BLOCKED |
| CAT-05 — consentimento específico D05, recibos atômicos e desfazer | YES, PR #102 | NO | 22 testes SQLite versionados; NOT_RUN | BLOCKED |

**Não existem** APIs de categorização pessoal do CAT-05 habilitadas na candidata; `approvedForPersonal:()=>false` continua obrigatório para os demais fluxos. A bandeira `approvedForCategorization` é específica e **false por padrão**, dependente de integração MAIN, backup e QA. Não chamar protótipos, serviços isolados ou testes V8 de “automação pronta”.

Sem classificação manual prévia ou Pluggy Premium, decisões sem corroborar são encaminhadas para revisão; o Naive Bayes local apenas sugere e não autoriza escrita. A primeira execução exige prévia completa e confirmação nativa única; depois, apenas contas consentidas podem receber categorização local automática. O ledger original nunca recebe regravação por essas ações.

**Dependência de integração:** PRs [#99](https://github.com/JoaoVittorLi/meu-financeiro/pull/99) → [#101](https://github.com/JoaoVittorLi/meu-financeiro/pull/101) → [#102](https://github.com/JoaoVittorLi/meu-financeiro/pull/102), todos Draft e ainda não integrados à #96. Ownership MAIN/preload/SQLite/UI: #49.
