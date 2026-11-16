# INTELIGÊNCIA PROATIVA — MOTOR DE OPORTUNIDADES FINANCEIRAS I3

**Estado deste documento:** arquitetura PROPOSTA; não foi implementada. Baseline de auditoria PR #76, HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a, 16/11/2026. Atual I2-D [PR #79](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) e I2-E [PR #80](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) **não** devem ser confundidos com motor geral de economia: eles investigam taxonomia, classificação e qualidade de evidência.

## 1. Objetivo operacional
Responder proativamente a perguntas que o usuário nem sempre sabe formular: quais gastos variaram; qual recorrência surgiu; qual obrigação aproxima-se; qual orçamento está em risco; se a meta de economizar R$ 400/mês é plausível; o que fazer agora. Cada insight deve ter base verificável, valor estimado com premissas, confiança qualitativa e **uma próxima ação concreta**. Nada de conselhos vagos e nenhuma alteração silenciosa.

### Modelo proposto de insight
| Campo | Tipo/requisito | Função |
|---|---|---|
| id | hash determinístico versionado | deduplicar por usuário local, tipo, fonte, escopo, entidade e janela |
| version | inteiro | migração do contrato |
| kind | enum: factual / hypothesis / recommendation / actionable_proposal | impedir hipótese de ser descrita como fato |
| type | enum: budget_risk, recurring_charge, spend_change, debt_pressure, cash_gap, savings_goal, classification_quality, anomaly | classificar a descoberta |
| title | texto curto | elemento principal de Hoje |
| explanation | texto ancorado a métricas | por que importa |
| evidence | array de refIds/version/fonte/period/centavos/filtros/exclusões | auditoria e drilldown |
| period | ISO início/fim e timezone | comparar mesmo intervalo |
| asOf / dataVersion | carimbo e hash do snapshot | invalidar após sync/edição |
| coverage | complete_local/partial_local/unknown com loaded/truncated | impedir confiança falsa |
| impact | amountCents/rangeCents + horizon + likelihoodQualifier | impacto potencial, nunca garantido |
| assumptions | lista explícita | distinguir correlação de causa e hipótese |
| confidence | supported / probable / weak / insufficient | valor qualitativo, não porcentagem inventada |
| priorityScore | composição explicável de impacto, urgência, evidência, frequência, esforço, risco | ordenar sem autoridade oculta |
| nextAction | navigate / investigate / simulate / prepare | ação disponível REAL, status e permissão |
| capabilityRequired | ferramenta tipada e versão | impedir CTA que não funciona |
| reviewState | new / shown / accepted / deferred / rejected / expired / resolved | ciclo de vida |
| expiresAt | datetime | validade |
| dismissedUntil | datetime opcional | evitar mensagens repetidas |
| provenance | local engine/version/algorithm | atualização reprodutível |
| supersededBy | insight id opcional | quando uma evidência corrige anterior |

## 2. Gatilhos e atualização
| Evento (a implementar/verificar) | Recalcular | Observações |
|---|---|---|
| Nova sincronização bancária concluída | recorrências, variação, anomalias, data quality | não executar se sincronização falhou ou fonte parcial sem aviso |
| Categorização confirmada | insights de categoria, orçamento e objetivos afetados | invalidar por categoryId/subcategoryId, nunca refazer todo o mundo |
| Ajuste de orçamento | limite excedido, risco e redistribuição | nova versão de orçamento invalida prévia anterior |
| Mudança de planejamento | compromissos, risco de caixa, metas | excluir cancelled/settled do resto a pagar |
| Nova meta ou mudança de preferência | lista priorizada de oportunidades | consentimento específico para persistir objetivo |
| Abertura da aba Hoje | avaliação leve on-demand, se dados frescos | não disparar API automaticamente |
| Virada do mês | comparar períodos e revisar metas | apenas se dados suficientes |
| Revisão periódica opt-in | insights vencidos/novos | agendamento não confirmado; especificar depois |

Proposta de cadência: recomputação **determinística incremental** em eventos relevantes; lote mais amplo quando Hoje é aberta e faltam snapshots recentes; modelo de linguagem somente para explicar/consolidar achados candidatos após limite de custo e autorização, nunca para inventar métrica. Desativar polling agressivo. Guardar hash de entradas para cache e deduplicação.

## 3. Motor de descoberta: algoritmos iniciais
| ID | Insight | Pré-condições de evidência | Fórmula/estratégia | Decisão segura |
|---|---|---|---|---|
| P01 | Orçamento excedido | limite com versão + gastos POSTED válidos | gasto − limite em centavos; limite 0 é válido | fato (não inferir gasto futuro) |
| P02 | Risco de ultrapassagem | dias decorridos + dias restantes + cobertura e comportamento histórico | faixa, não extrapolação pontual sem histórico mínimo | hipótese/projeção |
| P03 | Aumento de categoria | ≥2 meses com comparabilidade verificada | delta absolutos, percentuais nulos na base 0 | contribuição aritmética, não causalidade |
| P04 | Merchant concentrado | mapeamento consistente + ≥2 períodos | soma por merchant normalizado, top-share | candidato a investigação |
| P05 | Assinatura provável | múltiplos lançamentos POSTED, mesma origem, valores/datas compatíveis | recurrência por periodicidade e variação admitida | não afirmar serviço ativo ou desnecessário |
| P06 | Microdespesas acumuladas | frequência de uma classe observável | total mês e frequência em IDs, comparação com períodos | oportunidade com redução hipotética |
| P07 | Economia por corte percentual | categoria disponível no mês com cobertura conhecida | round(valor × percentual/100) | simulação, não poupança efetiva |
| P08 | Compromissos relevantes próximos | PlanningStore autorizado, status planned e certainty confirmed | soma dos remaining em janela | fato do planejamento, não baixa do saldo |
| P09 | Risco de caixa | saldo inicial **confirmado e datado** + fluxo previsto | faixa acumulada e ponto mínimo | se não houver saldo: unavailable, nunca deduzir saldo por resultado mensal |
| P10 | Meta mensal de economia | objetivo com consentimento + despesas variáveis elegíveis | portfolio de cenários limitado à economia realista | proposta de plano, impacto não garantido |
| P11 | Categoria sem classificação | registros válidos e identificadores | amountCents / total elegível, detalhes | fila de revisão, não autoclassificação |
| P12 | Anomalia potencial | histórico comparável e sem duplicidades não resolvidas | distanciamento de mediana/faixa robusta + tamanho amostral | hipótese, sem acusar fraude |
| P13 | Regra de categorização conflituosa | I2-E com precedence e correções manuais independentes | evidência hash e critérios do quality gate | ação bloqueada se suspeita de duplicata ou cobertura parcial |
| P14 | Concentração de dívidas | contrato e parcelas efetivamente importados | comprometimento de renda/fluxo | não calcular taxa de juros sem dados |
| P15 | Revisão após ação aplicada | recibo de serviço financeiro + novos dados | comparar indicador antes/depois com mesma fonte | observar associação, não afirmar causalidade |

## 4. Priorização transparente (modelo inicial proposto)
A pontuação **não** substitui a segurança. Primeiro filtrar propostas sem grant, source/period incompatíveis, cobertura desconhecida para certas conclusões, conflito de classificação ou capacidade não suportada. Depois rankear:
- 30% impacto potencial normalizado em janela comparável (sem inflar valores por multiplicação mensal);
- 25% urgência de evento real: vencimento/limite/falta de tempo;
- 20% robustez da evidência: IDs, período, cobertura e consistência;
- 15% esforço/viabilidade de ação confirmada;
- 10% relevância de objetivo e preferência opt-in.

**Pesos são hipótese de produto para calibração, não resultado financeiro medido.** Registrar componentes para explicar por que o insight está acima de outro. Nunca premiar uma recomendação de economia por ser visualmente impactante; a liquidez, compromissos e riscos vêm primeiro.

## 5. Anti-spam e ciclo de vida
1. Novo dado produz insightId e sourceSnapshot; candidate inicialmente não exibido até validação das pré-condições.
2. Exibir no máximo 3–5 sugestões principais na aba Hoje; ordenar pelo score; o resto fica em exploração, sem lotar a tela.
3. Rejeição explícita = não reaparecer a mesma combinação até mudança material de fatos ou até o prazo definido pelo usuário; evitar loops diários.
4. Adiamento: prazo respeitado, sem virar aceita automaticamente.
5. Quando dados mudam, marcar insight stale e recalcular. Nunca permitir confirmação de proposta antiga.
6. Accepted significa apenas que o usuário aceitou investigar/considerar; Applied exige recibo do serviço MAIN independente.
7. Resolved somente após evidência objetiva de que o problema deixou de existir.
8. Guardar histórico de sugestões e razões sem armazenar extratos duplicados.
9. Permitir desabilitar proatividade por domínio, fonte ou totalmente.
10. Sem contas conectadas, não produzir mensagens insinuando comportamento de gastos pessoais.

## 6. Superfícies B05
- **Hoje V6 (Pulso Financeiro):** painel de 3 descobertas com movimento discreto e prioridade baseada em dados; usar empty/partial/stale/denied reais, jamais copiar fixture como resultado. Apresentar importância em linguagem simples.
- **Conversar V5:** pergunta contextual “Por que surgiu essa oportunidade?”, seguido de evidências, comparação e cenários. Um insight tem o mesmo ID no chat e no detalhe da aba Hoje.
- **Plano de Ação V5:** etapas propostas, economia potencial por ação, dependências e versão. Explicitar o que só foi sugerido e o que foi executado.
- **Central de Revisão:** agrupamento de proposals preparadas, cada uma com Antes/Depois, impacto e consentimento específico; casos pessoais continuam bloqueados até homologação.
- **Chat lateral:** descoberta resumida com ação de abrir a investigação; não permitir executar dentro do balão.

A [issue B05 #84](https://github.com/JoaoVittorLi/meu-financeiro/issues/84) é fonte visual; os cards só podem anunciar função quando o backend fornecer capability e status. O design aprovado é input de UX, não comprovante de integração.

## 7. Exemplos de linguagem correta
| Evidência | Texto permitido | Texto proibido |
|---|---|---|
| Delivery R$ 240/mês por três meses | “Delivery representou R$ 240 neste mês. Simular redução de 25% representa R$ 60 no mesmo período.” | “Você vai economizar R$ 60 por mês com certeza.” |
| Débitos similares mensais | “Identifiquei possível recorrência; confirme se é assinatura.” | “Você paga por uma assinatura inútil.” |
| Limite R$ 0, gasto R$ 80 | “Limite definido em zero; há R$ 80 em despesas neste grupo.” | “Sem orçamento cadastrado” |
| Histórico bancário truncado | “Análise parcial dos registros carregados; não representa todas as transações.” | “Analisei todo seu extrato.” |
| Resultado positivo mês | “Receitas menos despesas foram positivas no período.” | “Você tem esse dinheiro disponível para gastar.” |

## 8. Dependências e testes
P0: contrato unificado de evidence/freshness; fonte única FinanceDB; roteamento IC2; cobertura parcial e status; D05 IDs. P1: recorrências, merchant, savings, orçamentos. P2: motor de eventos/insights com estado e persistência não financeira. P3: gated preview/receipt dos serviços homologados. P4: objetivos de longo prazo e calendário explícito.

Casos mínimos: ausência de histórico, bancário truncado, mês vazio, categoria com limite zero, duplicidade provável, assinaturas incertas, meta impossível, mudança de data/source, PENDING, transferência ignorada, recusa e cooldown, surpresa de sync, resposta LLM que sugere ação insegura. Consulte [TESTES_DE_ACEITACAO](TESTES_DE_ACEITACAO.md). **Não foram executados testes nesta I3-00.**

[Arquitetura](ARQUITETURA_FERRAMENTAS.md) · [Roadmap](ROADMAP_I3.md) · [Resumo](RESUMO_EXECUTIVO.md).
