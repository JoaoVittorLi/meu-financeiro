# MATRIZ DE CAPACIDADES — I3-00

# I3-00 — Evidências, escopo e limites

Data: 2026-11-16. Baseline: PR #76, HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a. Inspeção estática via GitHub, sem checkout, sem testes reais, sem Electron Windows e sem consulta a informações bancárias pessoais. Estados relativos somente a esse HEAD, salvo indicação explícita de PR paralelo. [Issue I3-00](https://github.com/JoaoVittorLi/meu-financeiro/issues/89).

**Status de evidência**: CODE_IMPLEMENTED_NOT_TESTED indica código verificável, mas não runtime homologado; BLOCKED_BY_POLICY indica bloqueio explícito; PARTIAL indica cadeia incompleta; UNKNOWN indica investigação insuficiente. Nenhuma capacidade foi classificada como RUNTIME_VERIFIED apenas por ler código.


Status técnico é baseado no caminho de código inspecionado, não em execução de Electron. Níveis N0..N5: não entende / explica / consulta / recomenda-simula / prepara / executa após consentimento. Nível desejado N5 não é autonomia irrestrita. **UNKNOWN não significa ausência.** Para cada item, o campo de prova e o próximo passo vinculam a conclusão a um teste futuro; não inferir condições em contas reais.

## Inventário auditado (40 capacidades)

| ID | Capacidade | Status | Atual → alvo | Caminho de evidência | Limite conhecido | Próximo passo |
|---|---|---|---|---|---|---|
| C01 | Autorização local read-only por fonte/perfil | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: authorize; preload finance:read-authorize | consentimento, token, owner, 15min | runtime Windows |
| C02 | Resumo despesas, receitas e resultado mensal | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: query(radar) | fonte única; não é saldo | fixture de reconciliação |
| C03 | Gasto de categoria pai | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | financial-intelligence.cjs: category | somente categoria textual | D05 hierarquia |
| C04 | Subcategoria D05 detalhada em conversa | PARTIAL | N1 → N3 | d05-category-service.cjs; intelligence-category-rc.cjs | destino D05 existe, leitura conversacional ampla não comprovada | contrato com categoriaId/subcategoryId |
| C05 | Maiores despesas | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | financial-intelligence.cjs: largest | 10 itens | testes fonte e período |
| C06 | Limites e excesso de orçamento | CODE_IMPLEMENTED_NOT_TESTED | N2 → N4 | financial-intelligence.cjs: budgets | limites do cadastro manual | integração hierarquia B02 |
| C07 | Compromissos próximos | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | financial-intelligence.cjs: commitments | requires planning, próximos 1 mês | fluxo de caixa |
| C08 | Comparação com mês anterior | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: compare | 2 meses; causalidade não provada | comparação multi-período |
| C09 | Estabelecimentos e frequência | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: merchants | 25 grupos; normalização literal | recorrência e lojas |
| C10 | Drilldown transações por IDs | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: transactions | 25 IDs; escopo mensal | paginação segura |
| C11 | Simulação de redução percentual categoria | CODE_IMPLEMENTED_NOT_TESTED | N3 → N3 | intelligence-tools.cjs: simulate | percentual inteiro; hipotético | cobertura e metas |
| C12 | Qualidade de cobertura | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-tools.cjs: quality | parcial 2500; não certifica integralidade | relatório data quality |
| C13 | Roteamento de intenção livre complexo | PARTIAL | N1 → N3 | intelligence-orchestrator.cjs: localPlan | regex; limites de etapas | planejador tipado |
| C14 | Plano multi-tool local | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-provider.cjs: validatePlan | até 4 etapas; sem modelo real | composição validada |
| C15 | Follow-up contextualmente limitado | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-context.cjs: ConversationContextStore | 10min, 40 contextos, 1 fonte/mês | memória episódica |
| C16 | Memória persistente de objetivos financeiros | UNKNOWN | N0 → N3 | intelligence-integration.ts; ai-personal.cjs | histórico de UI ≠ memória objetivos | levantamento de persistência |
| C17 | Histórico de threads local | CODE_IMPLEMENTED_NOT_TESTED | N2 → N2 | intelligence-integration.ts: intelligencePersistThreads/EnsureHydrated | modo de leitura autorizado é efêmero | testes reinício e privacidade |
| C18 | Chat lateral e principal compartilhados | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-view.ts: intelligenceHistoryList | navegação não é orquestração única | teste crossover |
| C19 | D03 Hoje com sinais e evidências | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-today-v2.ts: mfD03Signals | orçamentos/agenda/revisão | B05 V6 semântica |
| C20 | Famílias visuais V3 | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | intelligence-v3-core.ts; intelligence-v3-ui.ts | regex desvia IC2 | contrato unificado |
| C21 | D04 revisão sintética | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-review-v11.ts; category-review.cjs | perfil sintético | QA homologação |
| C22 | I2-B propostas de categoria | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-proposals.cjs | preview e escopo, não executar pessoal | reforço hierárquico |
| C23 | I2-C confirmação em laboratório | CODE_IMPLEMENTED_NOT_TESTED | N5 → N5 | intelligence-category-rc.cjs: sandboxCall | TEMP sintético e confirmação nativa | testes banco/backup |
| C24 | I2-D oportunidades categoria | CODE_IMPLEMENTED_NOT_TESTED | N3 → N3 | intelligence-category-opportunities.cjs: scan | somente taxonomia/estabelecimentos | insight transversal |
| C25 | I2-E qualidade/adversarial | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-quality.cjs: analysis/draft | evidência mínima; bloqueio duplicates | fixtures adversariais |
| C26 | I2-E prévia hierárquica D05 | CODE_IMPLEMENTED_NOT_TESTED | N4 → N4 | intelligence-category-rc.cjs: d05QualityDraft | lote 10, fonte bank, conta ativa | QA B03/B04 |
| C27 | Escrita pessoal comandada pela IA | BLOCKED_BY_POLICY | N1 → N5 | intelligence-category-rc.cjs: personalCall | deliberadamente proibida | homologação/autorização futura |
| C28 | Gateway D05 escrita supervisionada | BLOCKED_BY_POLICY | N4 → N5 | d05-personal-gate.cjs: confirmPreview | approvedForPersonal gate; personal não aprovado | QA de consentimento e recibo |
| C29 | ChatGPT externo sobre extrato pessoal | BLOCKED_BY_POLICY | N0 → N3 | ai-client.cjs; ai-financial-context.mjs | somente demo sintética; sem envio real | nova política e consentimento |
| C30 | AI demo GPT 6.1 Sol | CODE_IMPLEMENTED_NOT_TESTED | N1 → N1 | shared/ai-policy.mjs; ai-client.cjs | max 3 testes; elegibilidade externa | não testar dados reais |
| C31 | Recomendações economia delivery/assinaturas | UNKNOWN | N0 → N3 | operational.cjs; advisor I2-D | não demonstrado motor transversal | projetar recurring engine |
| C32 | Proatividade de metas e caixa futuro | UNKNOWN | N0 → N3 | intelligence-today-v2.ts | sinais reativos; sem objetivo persistente | motor de oportunidades |
| C33 | Orçamento criado por IA com preview | UNKNOWN | N1 → N4 | finance budgets; D05 only | contrato de escrita não verificado | mapear orçamento service |
| C34 | Planejamento criado por IA com preview | UNKNOWN | N1 → N4 | planning.cjs; plan UI | contrato de ação IA não verificado | mapear planning service |
| C35 | Investimentos/portfólio ao vivo | UNKNOWN | N0 → N2 | nenhum serviço inspecionado | não inferir ausência global | avaliar dados e permissão |
| C36 | Cancelamento externo de assinaturas | UNKNOWN | N0 → N0 | fora do backend auditado | operação externa regulada | manter não executável sem integração |
| C37 | Automação periódica de insights | UNKNOWN | N0 → N3 | sem motor event-driven auditado | agendamento e dados frescos | projeto futuras etapas |
| C38 | Quality gate Windows final | UNKNOWN | N0 → N2 | issues #65/#71 | sem execução nesta missão | rodar QA autorizado |
| C39 | Análise de dívidas e antecipações | UNKNOWN | N0 → N3 | planejamento/simulador existem | contratos específicos não auditados | mapear saldos e taxas |
| C40 | Respostas com origem, período, exclusões | CODE_IMPLEMENTED_NOT_TESTED | N2 → N3 | IC2 gateway, tools: reference | limites de auditoria e cobertura | contrato resposta verificável |

## Matriz transversal de autorização, entrada e saída
| Família | Entrada exigida | Dados reais consultáveis | Saída atual comprovável por código | Permissão/riscos |
|---|---|---|---|---|
| IC-v1 read | token + owner + source + profile + month + intent | SQLite/FinanceDB e opcional PlanningStore | refs, fatos, cartão, exclusões | leitura 15min; uma fonte; nunca saldo inferido |
| I2-A IC2 | contexto ativo + pergunta + mês | serviços IC-READ | fatos de 9 ferramentas, blocos visuais, alertas | sem modelo e sem escritas |
| I2-B/C | scope + método tipado + target | categorias/regras/movimentações no ledger canônico | análise e preview; sandbox com confirmação | pessoal read-only, sintético sob gate |
| I2-D/E | fonte, conta, evidência, qualidade, D05 target | ajustes manuais anteriores e histórico carregado | oportunidades de categoria, evidência, recusa, drafts | suspeita ≠ verdade; sem inferir IDs |
| D05 gateway | proposta, nonce, owner, backup, confirmação | snapshot financeiro sob MAIN | recibo persistido apenas se gate aprovado | escrita pessoal bloqueada |
| Demo IA | caso sintético e consentimento separado | **não** extratos | resposta generativa a demo, se elegível | não reutilizar para dados reais |

## Regras para avaliação
- Somente teste funcional observável no alvo muda uma capacidade para RUNTIME_VERIFIED, com SHA e log.
- UI_ONLY requer demonstrar superfície sem respectivo serviço; não atribuído automaticamente a B05 porque os serviços antigos podem ser reutilizados.
- MOCK_ONLY exige provar que só existe fixture/demo; o client externo é demo, não confundir com todo IC2.
- BLOCKED_BY_POLICY é uma condição de segurança, não bug a ser corrigido.
- Todas as propostas futuras devem usar resposta com source, profile, period, coverage, method, excludes, readAt e classification(fact/estimate/simulation), sem fornecer credenciais ao modelo.

[Estado atual](ESTADO_ATUAL.md) · [Mapa de intenções](MAPA_INTENCOES.md) · [Testes](TESTES_DE_ACEITACAO.md).
