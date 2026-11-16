# I3-00 V2 — Revisão crítica da auditoria V1

Data: 2026-11-16. Natureza: revisão estática/documental; nenhum teste de runtime executado. Fonte base: [PR #91](https://github.com/JoaoVittorLi/meu-financeiro/pull/91), HEAD 7f809c104256136a8800c1bdac54aece1e42b00c. Código de referência: [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a. Integração visual paralela: [PR #88](https://github.com/JoaoVittorLi/meu-financeiro/pull/88), HEAD 200aafb6f8000e7d6c1dad221a63482356ee4510, não homologado. Os HEADs são snapshots, não afirmações sobre execução futura.

## O que preservar da V1
- Oito documentos no PR #91, separados deste PR; 40 capacidades, 120 intenções, 26 nomes de ferramentas, 15 propostas de desenvolvimento e 50 cenários de teste. Essas quantidades são do inventário documental, não prova de funcionalidades em produção.
- A distinção CODE_IMPLEMENTED_NOT_TESTED / PARTIAL / BLOCKED_BY_POLICY / UNKNOWN. Nenhum CODE_IMPLEMENTED_NOT_TESTED passa a RUNTIME_VERIFIED sem QA.
- Cadeia comprovável por leitura de código: IC-v1 (LocalFinancialIntelligence e ledger), IC2 (IntelligenceOrchestrator + FinancialReadTools + ConversationContextStore), V3 operacional, I2-D/E (qualidade da categorização) e gateway D05. O caminho de API externa (ChatGPTDemoClient) permanece sintético; não é acesso ilimitado ao extrato.
- Invariantes: POSTED vs PENDING; transferências ignoradas no gasto; centavos inteiros; fonte por escopo; categoria D05 por ID; limite explícito zero distinto de null; snapshots e recibos; escrita pessoal bloqueada.

## Erros e mudanças obrigatórias
| Achado | Evidência | Tratamento V2 |
|---|---|---|
| 50 linhas da matriz de testes com 10 campos contra 11 colunas | TESTES_DE_ACEITACAO.md do PR #91 | Preservar os 50 IDs e inserir mapeamento explícito de ferramenta na coluna correta; validar aridade e semântica; todos NOT_RUN |
| 26 contratos genericamente repetidos | ARQUITETURA_FERRAMENTAS.md V1 | Manter como catálogo; especificar schemas JSON concretos apenas de ferramentas MVP, com payload, erros, origem e aceite |
| 10 capacidades UNKNOWN | MATRIZ_CAPACIDADES.md V1 | Investigar evidências abaixo; UNKNOWN não vira ABSENT só por busca inconclusiva |
| Dependências de #85/#86/#87 como integração futura isolada | ROADMAP_I3.md V1 | Reconhecer #88 como staging B01–B04; não supor sua homologação nem a implantação B05 |
| Valor de economia e investigação adiado | iniciativas I3-05/I3-07/I3-08 da V1 | M1 entrega investigação perceptível; M2 entrega plano de economia ponta a ponta; POC LLM sintética é especificada desde M0 |
| Projetos de POC tratados como funcionalidades | roteiro V1 | Diferenciar DESIGNED, CODE_PRESENT, SYNTHETIC_EXECUTED e PERSONAL_HOMOLOGATED |

## Investigação dirigida das dez capacidades UNKNOWN
| ID | Capacidade | Evidência inspecionada neste snapshot | Diagnóstico e teste necessário |
|---|---|---|---|
| C16 | Memória persistente de objetivos | electron/ai-personal.cjs tem AIPersonalStore com memórias para sujeito ChatGPT; intelligence-context.cjs guarda contexto efêmero | PARTIAL para armazenamento de memória de demonstração; UNKNOWN para meta financeira versionada, opt-in, consentimento e revogação após sincronização. Testar reinício e revogação sem reaproveitar fatos obsoletos |
| C31 | Economia delivery/assinaturas | intelligence-tools.cjs oferece merchants/categorias/simulate; I2-D focaliza categoria e qualidade | UNKNOWN para recomendações de economia transversal; não foi verificado motor de recorrência/limites com plano completo |
| C32 | Metas proativas e caixa futuro | intelligence-operational.cjs produz cartões e consultas; intelligence-today-v2.ts tem sinais | PARTIAL para cartões; UNKNOWN para metas e alertas antecipatórios persistentes. Testar eventos e não repetição |
| C33 | Orçamento criado por IA com preview | FinanceDB.load/save e consultas budgets; D05 gate restringe operações específicas | UNKNOWN para contrato de proposta/preview de orçamento derivado de chat; persistência geral de orçamento não autoriza escrita por IA |
| C34 | Planejamento criado por IA com preview | PlanningStore.create/list em electron/planning.cjs | PARTIAL para API de planejamento existente; UNKNOWN para ferramenta IA e autorização de proposta/gravação |
| C35 | Investimentos ao vivo | Nenhuma fonte específica comprovada nos módulos de inteligência inspecionados | UNKNOWN; deve exigir fonte real, dataAsOf, consentimento e QA; não incluir no MVP sem prova |
| C36 | Cancelamento externo de assinaturas | Não foi comprovado conector ou contrato externo | UNKNOWN quanto a integrações gerais e UNSUPPORTED como ação autorizada pela missão; não automatizar cancelamento |
| C37 | Rotinas periódicas de insights | Motor de cartões existe; nenhum agendador proativo pessoal homologado demonstrado | UNKNOWN; separar evento local de tarefa agendada e exigir opt-in |
| C38 | QA final Windows | Issues #65/#71; PR #88 documenta testes NOT_RUN | NOT_VERIFIED, não capacidade funcional ausente; somente logs e testes executados podem aprovar |
| C39 | Análise de dívidas/antecipações | PlanningStore, simulate de percentuais e ledger inspecionados; sem contrato comprovado de juros e ofertas | UNKNOWN; nunca inferir taxa, saldo, desconto de antecipação ou CET |

## Estado atualizado de integração e ownership
- PR #76 permanece candidato consolidado, Draft e não homologado.
- PR #88 publicou integração B01 V3, B02 V7 e B03/B04 V2 em staging, relatando testes oficiais NOT_RUN; pode mudar, mas NÃO tratar #88 como prova de funcionamento.
- Issue #84: B05 Hoje V6, Conversar V5 e Plano V5 são designs aprovados; código Electron e QA pendentes na revisão. B05 é consumidor de evidências, não motor de cálculo.
- Issue #49: Integrador é dono de MAIN/preload/IA principal; projeto I3 V2 altera apenas docs. Qualquer executor deverá declarar arquivos de ownership e obter snapshot atualizado antes de tocar em código.

## Decisões que mudaram
1. Jornada J1 (economizar por mês) passa a principal critério de produto.
2. Planejamento assistido por LLM pode ser avaliado cedo **somente em POC sintética isolada**, sem ativar API externa nem custo.
3. Orquestração tipada, motor determinístico e envelope de evidência servem simultaneamente Hoje, Conversar e Plano.
4. Primeiro código recomendado é uma fatia vertical de investigação com resposta baseada em ledger (M1), não 15 APIs desconectadas.
5. Contratos e testes não afirmam execução ou acesso real; revisão por owner + homologação por gate antes de qualquer merge.

Fontes: [V1/ESTADO_ATUAL](https://github.com/JoaoVittorLi/meu-financeiro/blob/research/mf2-i3-00-capability-audit-20261116/docs/intelligence/I3-00/ESTADO_ATUAL.md), [V1/MATRIZ](https://github.com/JoaoVittorLi/meu-financeiro/blob/research/mf2-i3-00-capability-audit-20261116/docs/intelligence/I3-00/MATRIZ_CAPACIDADES.md), [V1/TESTES](https://github.com/JoaoVittorLi/meu-financeiro/blob/research/mf2-i3-00-capability-audit-20261116/docs/intelligence/I3-00/TESTES_DE_ACEITACAO.md).


## Adendo V2.1 — baseline RC-ALL-02 B01–B05

A baseline do produto para implementar I3-01 passou a ser o PR #94, branch `integration/mf2-rc-all-02-b01-b05-20261116`, HEAD `d6693b42b21a1e4bf957f882dc3321506eaaa3c8` consultado em 16/11/2026. A V2 usou #76 para auditoria estática histórica; isso não autoriza transportar arquivos ou sobrescrever a integração. #94 contém `src/intelligence-b05-chat.ts`, `src/intelligence-b05-finance.ts`, `src/intelligence-b05-actions.ts`, `src/intelligence-b05-today.ts`, `src/intelligence-b05-motion.ts`, além de `src/intelligence-local.ts`, `src/intelligence-view.ts` e testes. B05 Conversar reutiliza `localFinancialSubmit` e IC2 pelo preload; a função financeira composta do Pulso V6 permanece dependência separada e fora de M1-S1. QA Node/Windows da candidata precisa ser comprovado por logs, não por snapshot.
