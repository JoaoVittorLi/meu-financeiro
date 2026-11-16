# I3-00 V2 — Mapa de capacidades

Fonte: inventário de 40 capacidades da [V1](https://github.com/JoaoVittorLi/meu-financeiro/blob/research/mf2-i3-00-capability-audit-20261116/docs/intelligence/I3-00/MATRIZ_CAPACIDADES.md), reclassificado por jornadas J1–J5 e marcos. Código lido: PR #76 HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a. V2 não executou runtime. Os estados CODE_IMPLEMENTED_NOT_TESTED não significam PASS, UNKNOWN não significa ABSENT e M não significa já desenvolvido.

| ID | Capacidade | Estado da V1 | Nível | Evidência no código | Limite/lacuna | Prova pendente | Jornada | Marco |
|---|---|---|---|---|---|---|---|---|
| C01 | Autorização local read-only por fonte/perfil | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: authorize; preload finance:read-authorize | consentimento, token, owner, 15min | runtime Windows | TRANSVERSAL | M0 |
| C02 | Resumo despesas, receitas e resultado mensal | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: query(radar) | fonte única; não é saldo | fixture de reconciliação | J2 | M1 |
| C03 | Gasto de categoria pai | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | financial-intelligence.cjs: category | somente categoria textual | D05 hierarquia | J1 | M1 |
| C04 | Subcategoria D05 detalhada em conversa | PARTIAL | N1 → N3 | d05-category-service.cjs; intelligence-category-rc.cjs | destino D05 existe, leitura conversacional ampla não comprovada | contrato com categoriaId/subcategoryId | J1 | M1 |
| C05 | Maiores despesas | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: largest | 10 itens | testes fonte e período | J2 | M1 |
| C06 | Limites e excesso de orçamento | CODE_IMPLEMENTED_NOT_TESTED | N2 → N4 | financial-intelligence.cjs: budgets | limites do cadastro manual | integração hierarquia B02 | J1,J3 | M2 |
| C07 | Compromissos próximos | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | financial-intelligence.cjs: commitments | requires planning, próximos 1 mês | fluxo de caixa | J1,J3 | M2 |
| C08 | Comparação com mês anterior | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: compare | 2 meses; causalidade não provada | comparação multi-período | J1,J2 | M1 |
| C09 | Estabelecimentos e frequência | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: merchants | 25 grupos; normalização literal | recorrência e lojas | J1,J2 | M1 |
| C10 | Drilldown transações por IDs | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: transactions | 25 IDs; escopo mensal | paginação segura | J1,J2 | M1 |
| C11 | Simulação de redução percentual categoria | CODE_IMPLEMENTED_NOT_TESTED | N3 → N3 | intelligence-tools.cjs: simulate | percentual inteiro; hipotético | cobertura e metas | J1,J3 | M2 |
| C12 | Qualidade de cobertura | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: quality | parcial 2500; não certifica integralidade | relatório data quality | J1,J2 | M1 |
| C13 | Roteamento de intenção livre complexo | PARTIAL | N1 → N3 | intelligence-orchestrator.cjs: localPlan | regex; limites de etapas | planejador tipado | J1,J2 | M1 |
| C14 | Plano multi-tool local | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-provider.cjs: validatePlan | até 4 etapas; sem modelo real | composição validada | J1,J2 | M1 |
| C15 | Follow-up contextualmente limitado | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-context.cjs: ConversationContextStore | 10min, 40 contextos, 1 fonte/mês | memória episódica | J2 | M1 |
| C16 | Memória persistente de objetivos financeiros | UNKNOWN | N0 → N3 | intelligence-integration.ts; ai-personal.cjs | histórico de UI ≠ memória objetivos | levantamento de persistência | J3,J4 | M3 |
| C17 | Histórico de threads local | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | intelligence-integration.ts: intelligencePersistThreads/EnsureHydrated | modo de leitura autorizado é efêmero | testes reinício e privacidade | J4 | M3 |
| C18 | Chat lateral e principal compartilhados | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-view.ts: intelligenceHistoryList | navegação não é orquestração única | teste crossover | J4 | M1 |
| C19 | D03 Hoje com sinais e evidências | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-today-v2.ts: mfD03Signals | orçamentos/agenda/revisão | B05 V6 semântica | J4 | M3 |
| C20 | Famílias visuais V3 | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-v3-core.ts; intelligence-v3-ui.ts | regex desvia IC2 | contrato unificado | J2 | M1 |
| C21 | D04 revisão sintética | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-review-v11.ts; category-review.cjs | perfil sintético | QA homologação | J5 | M4 |
| C22 | I2-B propostas de categoria | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-proposals.cjs | preview e escopo, não executar pessoal | reforço hierárquico | J5 | M4 |
| C23 | I2-C confirmação em laboratório | CODE_IMPLEMENTED_NOT_TESTED | N5 → N5 | intelligence-category-rc.cjs: sandboxCall | TEMP sintético e confirmação nativa | testes banco/backup | J5 | M4 |
| C24 | I2-D oportunidades categoria | CODE_IMPLEMENTED_NOT_TESTED | N3 → N3 | intelligence-category-opportunities.cjs: scan | somente taxonomia/estabelecimentos | insight transversal | J1,J4 | M3 |
| C25 | I2-E qualidade/adversarial | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-quality.cjs: analysis/draft | evidência mínima; bloqueio duplicates | fixtures adversariais | J5 | M4 |
| C26 | I2-E prévia hierárquica D05 | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-rc.cjs: d05QualityDraft | lote 10, fonte bank, conta ativa | QA B03/B04 | J5 | M4 |
| C27 | Escrita pessoal comandada pela IA | BLOCKED_BY_POLICY | N1 → N5 | intelligence-category-rc.cjs: personalCall | deliberadamente proibida | homologação/autorização futura | J5 | M4 |
| C28 | Gateway D05 escrita supervisionada | BLOCKED_BY_POLICY | N4 → N5 | d05-personal-gate.cjs: confirmPreview | approvedForPersonal gate; personal não aprovado | QA de consentimento e recibo | J3,J5 | M4 |
| C29 | ChatGPT externo sobre extrato pessoal | BLOCKED_BY_POLICY | N0 → N3 | ai-client.cjs; ai-financial-context.mjs | somente demo sintética; sem envio real | nova política e consentimento | TRANSVERSAL | M0 |
| C30 | AI demo GPT 6.1 Sol | CODE_IMPLEMENTED_NOT_TESTED | N1 → N1 | shared/ai-policy.mjs; ai-client.cjs | max 3 testes; elegibilidade externa | não testar dados reais | J4 | M0 |
| C31 | Recomendações economia delivery/assinaturas | UNKNOWN | N0 → N3 | operational.cjs; advisor I2-D | não demonstrado motor transversal | projetar recurring engine | J1,J4 | M2 |
| C32 | Proatividade de metas e caixa futuro | UNKNOWN | N0 → N3 | intelligence-today-v2.ts | sinais reativos; sem objetivo persistente | motor de oportunidades | J4 | M3 |
| C33 | Orçamento criado por IA com preview | UNKNOWN | N1 → N4 | finance budgets; D05 only | contrato de escrita não verificado | mapear orçamento service | J1,J3,J5 | M4 |
| C34 | Planejamento criado por IA com preview | UNKNOWN | N1 → N4 | planning.cjs; plan UI | contrato de ação IA não verificado | mapear planning service | J3,J5 | M4 |
| C35 | Investimentos/portfólio ao vivo | UNKNOWN | N0 → N2 | nenhum serviço inspecionado | não inferir ausência global | avaliar dados e permissão | TRANSVERSAL | FORA_MVP |
| C36 | Cancelamento externo de assinaturas | UNKNOWN | N0 → N0 | fora do backend auditado | operação externa regulada | manter não executável sem integração | J5 | FORA_MVP |
| C37 | Automação periódica de insights | UNKNOWN | N0 → N3 | sem motor event-driven auditado | agendamento e dados frescos | projeto futuras etapas | J4 | M3+ |
| C38 | Quality gate Windows final | UNKNOWN | N0 → N2 | issues #65/#71 | sem execução nesta missão | rodar QA autorizado | TRANSVERSAL | GATE_RELEASE |
| C39 | Análise de dívidas e antecipações | UNKNOWN | N0 → N3 | planejamento/simulador existem | contratos específicos não auditados | mapear saldos e taxas | J3 | PESQUISA |
| C40 | Respostas com origem, período, exclusões | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | IC2 gateway, tools: reference | limites de auditoria e cobertura | contrato resposta verificável | J2 | M1 |

**Total preservado:** 40/40. O marco especifica a primeira necessidade de avaliação ou construção; uma capacidade pode reaparecer nos marcos seguintes.

## Ajustes analíticos da V2
- C16: AIPersonalStore mantém memória de demonstração vinculada ao sujeito ChatGPT; **não comprova** meta persistente de finanças nem memória transacional, que seguem UNKNOWN.
- C32: intelligence-operational.cjs já produz cartões e alertas de orçamento; **não comprova** metas persistentes, predição de caixa nem proatividade por eventos.
- C33/C34: FinanceDB.save e PlanningStore.create/list estão no código. **Não constituem** ferramenta de chat com preview e confirmação para orçamento/planejamento pessoais.
- C31/C39: merchants, simulate percentual e planejamento não substituem detector completo de oportunidades nem cálculo de dívidas com taxas, CET e descontos verificáveis.
- C35/C36/C37: sem evidência suficiente para confirmar motor de investimentos, cancelamento externo ou scheduler pessoal. Mantêm UNKNOWN fora do MVP, sem declarar inexistência.
- C38: QA Windows é um estado de verificação, não capacidade financeira; permanece NOT_VERIFIED. PR #88 declara NOT_RUN para Node/Windows.

## Três dimensões obrigatórias de status
1. **Código:** CODE_PRESENT, PARTIAL, UNKNOWN, BLOCKED_BY_POLICY.
2. **Execução:** NOT_RUN, PASS_SYNTHETIC, PASS_WINDOWS, FAIL. Nenhum PASS atribuído por esta documentação.
3. **Escopo:** DEMO_ONLY, READ_ONLY_PERSONAL_WITH_GRANT (a homologar por QA), PREPARE_ONLY, PERSONAL_WRITE_BLOCKED.

## Intenções da V1 — agrupamento por resultado (120 originais preservadas no PR #91)
O [MAPA_INTENCOES.md V1](https://github.com/JoaoVittorLi/meu-financeiro/blob/research/mf2-i3-00-capability-audit-20261116/docs/intelligence/I3-00/MAPA_INTENCOES.md) permanece fonte do inventário granular. Nesta V2, nenhuma contagem artificial adicional é exigida. A priorização de intenção é: **J1 economia mensal** (maior valor), **J2 investigação** (maior frequência/capacidade transversal), **J3 planejamento** (impacto em decisão), **J4 proatividade** (reuso de resultados), **J5 preparação supervisionada** (risco mais alto). Para cada intenção que entrar em código: identificar IDs da V1 equivalentes, estado atual, data/fonte, autorização, componente B05, teste e critério de aceite. Duplicatas sem diferença operacional são consolidadas durante execução, não removidas do histórico.

## Lacunas de investigação que não devem ser preenchidas por suposição
- Registro de cobertura ao ultrapassar 2.500 movimentos bancários e source reconciliation.
- API de orçamento hierárquico D05 no ledger para orçamento pessoal e subcategorias.
- Contrato de leitura multimensal com paginação estável.
- Fonte real de ativos/investimentos e crédito; juros e descontos não podem ser inventados.
- Estado e revogação de memória de objetivos de longo prazo.
- Resultado de testes Windows, Electron, F08, ASAR e financeiro integrado no HEAD do futuro executor.

**Critério de passagem para CODE_IMPLEMENTED:** prova de arquivo/serviço no SHA indicado; para demonstrar função no produto, exigir teste executado com log, fixture, code path e UI consumidora. Não promover estados por parecer documental.
