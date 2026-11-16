# RESUMO EXECUTIVO — I3-00 / Inteligência Financeira 3.0

**Data:** 16/11/2026 · **Fonte principal:** GitHub do Meu Financeiro 2.0, [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), HEAD fixado **1bc1b89bf5bdefc0196b0851e690a99f825ca85a**. [Issue dedicada #89](https://github.com/JoaoVittorLi/meu-financeiro/issues/89). Esta missão é **auditoria estática + arquitetura + planejamento documental**; não representa QA Windows, teste SQLite real, validação de contas pessoais ou aprovação de escrita.

## 1. O que nossa IA consegue fazer atualmente?
**Existe código para** consultar gastos, receitas e resultado mensal; categorias, limites, maiores despesas, compromissos do mês seguinte, revisão, comparação; pesquisar merchants; filtrar IDs e excluir categorias; simular cortes percentuais sobre gastos; conferir qualidade e parcialidade; emitir cartões estruturados e fatos para o chat; gerar oportunidades de reorganização de categorias com evidência e validação I2-E; preparar prévias hierárquicas D05; persistir histórico local de conversa de interface fora de certas sessões autorizadas. As ações de categorização têm laboratório sintético separado para confirmações.

**A ressalva é essencial:** o código identificado **não foi testado nesta missão no Windows**. A maioria dos itens é CODE_IMPLEMENTED_NOT_TESTED; I2-D/E foram publicados e integrados pelo PR #76 mas não devem ser declarados homologados só por isso. Fontes: [ESTADO_ATUAL](ESTADO_ATUAL.md), [MATRIZ_CAPACIDADES](MATRIZ_CAPACIDADES.md).

## 2. O que ela parece fazer, mas não consegue completar?
A conversa tem aparência de assistente inteligente, porém a execução de ferramentas financeiras ocorre por plano local baseado em expressões e, para chamadas ao modelo, o caminho aprovado é demo sintético separado. O sistema não comprovou capacidade de investigar livremente 12 meses de dados por estabelecimento, construir um plano completo de economia, manter objetivos financeiros duráveis, editar orçamento por linguagem natural nem executar modificações pessoais autorizadas pela IA em ambiente real. **Isso não significa ausência absoluta em todo o repositório:** funções fora dos módulos inspecionados permanecem UNKNOWN.

B05 Hoje/Conversar/Plano de Ação tem **design aprovado** e interface futura documentada na [issue #84](https://github.com/JoaoVittorLi/meu-financeiro/issues/84), mas implementação Electron final é pendente. B01/B02 (#85) e B03/B04 (#86 e #87) ainda exigem integração/QA. Não tratar a aprovação do protótipo como implementação.

## 3. Por que está limitada?
- **Roteamento:** electron/intelligence-orchestrator.cjs usa localPlan() com regex e prioridades; src/intelligence-local.ts mantém parser de compatibilidade com oito intenções. São chamadas limitadas, não planejamento financeiro aberto.
- **Ferramentas:** electron/intelligence-tools.cjs oferece nove leituras e uma simulação de percentual, teto de quatro etapas de plano via validatePlan(); não cobre o universo de pedidos cotidianos.
- **Dados:** LocalFinancialIntelligence lê fonte única por mês; banco pode truncar em 2.500 registros. Comparações e merchants têm limites internos. Não confundir saldos com resultados.
- **Contexto:** ConversationContextStore efêmero, TTL de dez minutos; histórico visual e memória financeira não são a mesma coisa.
- **IA externa:** ChatGPTDemoClient usa contexto **synthetic only** definido em shared/ai-financial-context.mjs, sem extrato pessoal real no caminho aprovado.
- **Segurança intencional:** o gateway pessoal D05 exige approvedForPersonal e consentimento; pessoal permanece bloqueado, por decisão de segurança.
- **Integração:** IC-v1, IC2, V3, I2-D/E e visual B05 têm caminhos e responsabilidades diferentes.

## 4. Dez oportunidades prioritárias
| Ordem proposta | Oportunidade | Valor ao usuário | Dependência |
|---|---|---|---|
| 1 | Interpretar melhor perguntas naturais | Menos “não consigo” injustificados | I3-01 |
| 2 | Respostas com fonte, cobertura e método | Confiabilidade mesmo com histórico parcial | I3-02 |
| 3 | Categorias D05 pai/filho no chat | Gastos reais detalhados e consistentes | I3-03 + B01–B04 |
| 4 | Análises multimensais por estabelecimento | Entender mudanças de hábito com dados | I3-05 |
| 5 | Sugerir limites inteligentes por subcategoria | Orçamentos adequados ao histórico | I3-06 |
| 6 | Detectar despesas recorrentes/assinaturas | Oportunidades de economia sem suposições | I3-07 |
| 7 | Plano para economia mensal com cenários | Responder “quero poupar R$ 400” | I3-07 + I3-08 |
| 8 | Alertas confiáveis sobre compromissos e metas | Antecipar problemas e decisões | I3-08/09 |
| 9 | Hoje/Conversar/Plano com mesmas evidências | UX premium sustentada por serviço real | I3-09/10 |
| 10 | Preparar alterações revisáveis no app | Transformar recomendação em plano concreto | I3-11/12, homologação e autorização |

## 5. O que pode evoluir mais rapidamente?
**Quick wins relativos, condicionados a QA:** melhorar motivos de “unsupported” sem inventar ferramentas; exibir falta de cobertura local e limites de período; unificar retornos das ferramentas existentes; apresentar mais claramente simulação vs fato; reaproveitar os dados I2-D/E para apresentar sugestão de revisão de categoria sem habilitar escrita. São melhorias que exploram serviços já implementados. Nenhuma foi codificada nesta auditoria.

## 6. Quais mudanças estruturais são necessárias?
Uma camada de ferramentas tipadas e determinísticas; resposta financeira com IDs/provenance/coverage/time; orquestração por plano validado; central única de contexto/escopo; view-model compartilhado por Hoje, Conversar, Plano e Central; motor de insights persistindo apenas metadados e decisões, sem duplicar ledger. O modelo de linguagem coordena e explica, mas **não calcula nem grava números financeiros como fonte de verdade**. Ver [26 contratos de ferramentas](ARQUITETURA_FERRAMENTAS.md).

## 7. Como a IA se tornará proativa?
Com um motor de oportunidades que reage a eventos versionados: sincronização válida, mudança de categoria, orçamento, planejamento ou objetivo. Ele detecta tendências, recorrência provável, orçamento excedido, possível risco de caixa quando houver saldo confiável e oportunidades de economia. Cada insight carrega evidência, impacto, premissa, confiança qualitativa, nextAction, validade e estado (mostrado/aceito/adiado/rejeitado/resolvido). A aba Hoje deve mostrar poucas descobertas de alto valor e evitar repetição. Ver [INTELIGENCIA_PROATIVA](INTELIGENCIA_PROATIVA.md).

## 8. Quais ações poderá preparar e executar com autorização?
Preparar propostas para alterar limites de orçamento, compromissos de planejamento e categorização D05, desde que seus contratos realmente existam; prévia Antes/Depois e confirmação individual. **Nenhuma escrita pessoal é liberada por esta auditoria.** O D05PersonalWriteGateway existente já documenta nonce, fingerprint, backup, recibo e verificações pós-COMMIT, mas tem gate de aprovação deliberado. A futura I3-12 depende de decisão separada do proprietário e de QA Windows. Não existe autorização de cancelar serviços ou mover dinheiro externamente.

## 9. Quais são os riscos principais?
1. Declarar resultado de mock como runtime Windows.
2. Somar banco e manual ou incorporar PENDING/transfer/ignore indevidamente.
3. Usar extrato truncado como histórico integral.
4. Interpretar meta/simulação como dinheiro disponível.
5. Fazer fallback de categoryId/subcategoryId para texto ambíguo.
6. Roteamento por regex errar a intenção e responder outro assunto.
7. Permitir o modelo fornecer números, owner, token, SQL ou instruções de gravação.
8. Quebrar testes/ownership durante integração #85/#86/#87 e B05.
9. Habilitar escrita pessoal antes de validação e autorização.
10. Criar custo de modelo externo sem comprovar elegibilidade, contrato e privacidade.

**Nota de segurança adicional:** a consulta de metadados ao GitHub nesta sessão retornou visibility=public para o repositório, embora o histórico do projeto o descreva como privado. É necessário verificar a visibilidade nas configurações do GitHub antes de publicar dados sensíveis. Esta auditoria não incluiu extratos pessoais, chaves nem tokens e usou somente fixtures fictícias para especificar testes.

## 10. Qual é a próxima missão?
**I3-01 — Unificação de roteamento e respostas financeiras verificáveis, somente leitura.** Primeiro revisar este mapeamento, reconciliar o HEAD canônico após B01–B04, confirmar ownership e escrever testes sintéticos; então implementar exclusivamente o roteador/evidence envelope, sem novos write endpoints. I3-00 **não** autorizou I3-01 nem executou CI.

## Entrega documental auditável
| Documento | Conteúdo |
|---|---|
| [ESTADO_ATUAL.md](ESTADO_ATUAL.md) | Arquitetura real, módulos, código, SHAs, limitações |
| [MATRIZ_CAPACIDADES.md](MATRIZ_CAPACIDADES.md) | 40 capacidades, maturidade e evidências |
| [MAPA_INTENCOES.md](MAPA_INTENCOES.md) | 120 cenários naturais em 15 domínios |
| [ARQUITETURA_FERRAMENTAS.md](ARQUITETURA_FERRAMENTAS.md) | 26 contratos propostos com 20 campos cada |
| [INTELIGENCIA_PROATIVA.md](INTELIGENCIA_PROATIVA.md) | Insight schema, motores, UX e ciclo de vida |
| [ROADMAP_I3.md](ROADMAP_I3.md) | 15 iniciativas, ordem, dependências, gates |
| [TESTES_DE_ACEITACAO.md](TESTES_DE_ACEITACAO.md) | 50 testes **planejados** com fixture sintética; 50 NOT_RUN |
| [RESUMO_EXECUTIVO.md](RESUMO_EXECUTIVO.md) | Síntese para decisão do proprietário |

## Limites reais da auditoria
Esta análise consultou referências importantes de PRs/issues, HEADs e código de rotas, IPC, serviços de leitura, ferramentas, categoria I2-D/E, segurança D05 e interação visual. **Não foi uma leitura integral linha a linha de todos os arquivos, todos os commits, todos os testes, todos os comentários de issues nem uma validação do runtime.** Logo, a classificação UNKNOWN permanece para capacidades cujos módulos não foram extensivamente examinados. Os inventários de intenção e contratos são especificações de próxima fase, não funcionalidades existentes. A publicação permite auditoria colaborativa e aprofundamento versionado antes da implementação.
