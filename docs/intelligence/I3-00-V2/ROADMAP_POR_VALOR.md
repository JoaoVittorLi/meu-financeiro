# I3-00 V2 — Roadmap por marcos de valor

Status: proposta para aprovação. Não confundir fase de planejamento com trabalho executado. Ordem prioriza valor perceptível antes de uma infraestrutura extensa. Cada missão de código futura deve usar branch e PR próprios, com snapshot de #76/#88 e owners da #49; a I3-00 V2 não abre implementação.

| Marco | Resultado para quem usa | Fatia funcional fim-a-fim | Dependências reais | Esforço relativo | Owner proposto | Gate |
|---|---|---|---|---|---|---|
| M0 | Especificações confiáveis | inventário de 40; 50 testes corrigidos; contratos tipados; desenho PoC LLM sintética; baseline #88 | PR #91, #76, #88, #84 | M | Arquitetura I3 (docs) | schema validado e PR documental revisado |
| M1 | “Entendeu por que gastei mais” | pergunta → router único → tools por período → ledger → evidência → resposta no chat / empty state | read grant, FinanceDB, IC2, D05; UI consumer integrador | L | INT-ROUTING + INT-TRUTH | J2 com deltas exatos e casos adversariais |
| M2 | “Montou um plano para economizar R$300” | gastos e merchants → recorrências → oportunidades não sobrepostas → simulação → plano contextual na UI | M1, read budgeting/planning, critérios de gasto essencial | L | INT-ANALYTICS + INT-ADVISOR | teste mestre 6 meses e meta inviável explícita |
| M3 | “Me alertou antes de eu perguntar” | scan com dataVersion → ranking → insightId → Hoje/Conversar/Plano → dedup/recusa | M2 e B05 integrada, memória consentida se usada | L | INT-INSIGHTS + B05-ADAPTER | mesmo insight em telas, sem repetição e sem leak |
| M4 | “Preparou mudanças para eu confirmar” | plano → drafts tipados → antes/depois → Central → gates bloqueados ou autorização futura separada | M0-M3, D05 gate, QA Windows, novos gates orçamento/planejamento | XL | INT-PROPOSALS + OWNER-MAIN | sem gravação pessoal por default; recibos só após novo gate |

Esforços S/M/L/XL são relativos e não representam horas/prazos garantidos. Não executar CircleCI nem APIs pagas nesta missão.

## FATIAS VERTICAIS — com critério real de conclusão

### M1-S1 — Investigar aumento entre períodos (primeira missão de código recomendada)
- **Pedido:** “Por que minhas despesas aumentaram nos últimos meses?”
- **Resultado:** decomposição correta por categoria e top merchants, frequência e ticket médio quando disponível; fatos com período/fonte/coverage; hipótese rotulada.
- **Dados:** bank OU manual, POSTED por intervalo, categoryId/subcategoryId, merchant e estado truncado; source grant.
- **Reuso:** FinancialReadTools.summary/compare/categories/merchants, LocalFinancialIntelligence, shared/finance-period-ledger.mjs.
- **A construir:** adaptador read_month_range/read_category_delta, envelope Evidence v1, roteador unificado de compatibilidade e apresentação no chat real.
- **Interface:** Conversar B05 ou fallback da tela integrada atual; compatibilidade com layout existente.
- **Permissão:** leitura vigente revalidada, sem escrever.
- **No data:** estado no_data com CTA autorizado, sem números.
- **Teste:** F1 delta despesas +5000 centavos; alimentação -5000, transporte +4000, seguro +6000, assinatura 0; cuidado com base zero e período parcial.
- **Métrica:** 100% de reconciliação de valores nos golden cases; 0 violações de grant em testes negativos; percentual de entendimento por rubrica só após medir.
- **Dependências/riscos:** integração B01–B05 não homologada; conflitos se editar src/intelligence-local.ts e intelligence-view.ts.
- **DONE:** demonstração real no Electron com fixtures sintéticas (depois QA Windows), logs das ferramentas chamadas, comparação exata e sem dado inventado.

### M2-S1 — Plano de economia por meta
- **Pedido:** “Quero economizar R$300 mensais.”
- **Resultado:** oportunidades auditáveis, estimativas realistas e alternativa caso a meta não feche.
- **Reuso:** M1, simulate, orçamento D05, PlanningStore.
- **A construir:** detecção de recorrências multimensais, overlapGroup, scoring e simulador para economia com limites explícitos.
- **Interface:** Conversar + Plano; mesmos evidenceIds/planId.
- **Autorização:** read + planning quando necessário; proposta sem commit.
- **Sem dados:** insuficiência de cobertura e necessidade de dados declaradas.
- **Teste:** master fixture seis meses; receitas futuras não somadas ao caixa real; compromissos essenciais protegidos.
- **DONE:** plano fundamentado na UI sem prometer viabilidade incorreta.

### M3-S1 — Hoje com oportunidade não repetitiva
- **Pedido:** abrir Inteligência sem perguntar.
- **Resultado:** insight de economia/risco com ação Investigar ou Simular.
- **Reuso:** recommendations M2; B05 aprovado.
- **A construir:** evidenceFingerprint, insightId estável por dataVersion, lifecycle e dedup local.
- **Autorização:** leitura válida; memória opt-in separada.
- **Teste:** sem conta mostra empty state; update altera versão; recusa não reaparece diariamente; sem leak.
- **DONE:** Hoje e Conversar explicam exatamente o mesmo insight.

### M4-S1 — Proposta de novo limite
- **Pedido:** “Prepare limites para o próximo mês.”
- **Resultado:** draft com before/after, categorias D05 e estado de autorização.
- **Reuso:** orçamento e D05 review; gate D05 para categorização não substitui gate de orçamento.
- **A construir:** contrato tipado e idempotente de draft, serviço de preview e futuro gateway específico.
- **Permissão:** PREPARE_ONLY; PERSONAL_WRITE_BLOCKED até autorização explícita posterior.
- **Teste:** perfil real não grava; sandbox valida snapshot, replay, rollback/recibo antes de futura habilitação.
- **DONE:** Central exibe prévia correta e bloqueio efetivo sem execução oculta.

## Pacotes de trabalho e fronteiras de arquivos sugeridas
| Trabalho | Owner | Pode alterar futuramente | Não alterar sem coordenação |
|---|---|---|---|
| Roteamento/read-only (M1) | INT-ROUTING | novos módulos de adaptação e testes de roteamento | src/intelligence-local.ts, electron/main.cjs, preload enquanto Integrador trabalhar |
| Ledger/evidência (M1/M2) | INT-TRUTH | serviços novos de consulta e testes, reaproveitando shared/finance-period-ledger.mjs | código financeiro canônico sem contrato de integração |
| Recomendação (M2/M3) | INT-ADVISOR | novos módulos de opportunities, fixtures, testes | I2-D/E e qualidade já existentes sem QA e owner |
| B05 bindings (M3) | INT-B05 | adapters de viewmodel e testes visuais com design aprovado | CSS/protótipos da branch de Designer |
| Draft/gates (M4) | INT-SUPERVISED | contratos e testes sintéticos, após revisão OWNER-MAIN | approvedForPersonal=false, MAIN/preload ou dados reais sem autorização |

## Gates compartilhados
- **G0 — Truth:** fixtures, money integers, POSTED/TRANSFER, reconciliado por fonte e cobertura.
- **G1 — Access:** token/owner/profile/account/scope dataVersion antes e depois de cada read.
- **G2 — Behavior:** golden tests de J1/J2/J3 e rubric score testável; não chamar resposta genérica de concluída.
- **G3 — UX:** consumidor B05 ou interface integrada funcional, acessibilidade, estados vazios e animação reduced-motion.
- **G4 — Runtime:** Node22.23.4, TS, DB, compile, F08, ASAR e Electron Windows após autorização do proprietário e logs reais; nenhuma inferência de PASS.
- **G5 — Writes:** política e autorização separadas; preview, confirmação independente, backup, receipt, recovery; gate de pessoal continua OFF até missão própria.

## Ordem de entregas e aprovação
M0 (documentação) → aprovação do proprietário → M1-S1 em PR de código → QA dirigido → M2-S1 → M3-S1 → M4-S1 PREPARE_ONLY. A prova de conceito LLM sintética pode ser testada em missão separada após aprovar o POC_LLM_PLAN.md, sem bloquear o M1 determinístico. Não fazer merge automático no PR #76.
