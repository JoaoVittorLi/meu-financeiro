# I3-00 V2 — Resumo executivo para o proprietário

**Data:** 16/11/2026. **Natureza:** especificação e revisão estática; nenhum CI, Windows/Electron, SQLite real, API paga, EXE ou gravação pessoal executados por esta missão. PR #91 é a auditoria V1; PR #88 é staging B01–B04 não homologado; B05 design aprovado conforme issue #84. Branch de I3-00 V2 somente docs.

## 1. Por que a IA atual parece básica?
Porque o chat existe, mas a interpretação de pedidos financeiros ainda é limitada por roteadores locais de regex/intenções finitas (IC-v1/IC2/V3), ferramentas majoritariamente de consulta e caminhos paralelos. O cliente generativo identificado oferece laboratório sintético separado, não uma investigação pessoal livre e comprovada. O sistema não demonstra hoje a jornada “quero economizar R$300” de ponta a ponta no Electron homologado.

## 2. O que já podemos reaproveitar?
FinanceDB/ledger canônico, LocalFinancialIntelligence, FinancialReadTools (9 nomes), ConversationContextStore, PlanningStore, orçamento e serviços hierárquicos D05, I2-D/E de qualidade/categorias, gateway supervisionado de laboratório e componentes de chat/revisão. São evidências de **código**, não de aprovação de QA. Não duplicar parser de valores nem motor de cálculo.

## 3. O que construir?
Um roteador coerente, leitura multimensal com cobertura, envelope único de evidência, análise de variações/merchants/recorrências, motor de economia que evita sobreposição, simulação de meta, insightId persistente por snapshot, adapters B05 e drafts tipados de orçamento/planejamento. Ferramentas de execução exigem gateways específicos, homologação e autorização independentes.

## 4. Como entender solicitações complexas?
Pedido ⇒ intenção+escopo ⇒ plano limitado de ferramentas somente leitura ⇒ ledger calcula ⇒ resposta explica com fontes. Começar com roteamento determinístico melhorado e comparar, em laboratório sintético separado, um planejador LLM que somente seleciona ferramentas permitidas. LLM não recebe token ou extrato, não calcula dinheiro nem escreve.

## 5. Como identificar economias reais?
Seis meses de histórico autorizado, comparar períodos equivalentes, identificar gasto variável e recorrência candidata, consultar orçamento e compromissos essenciais, calcular redução plausível por cenário sem sobrepor a mesma despesa. Se não há evidência para R$300, dizer isso. Na fixture mestre: delivery -R$150, outros -R$30, assinatura candidata -R$50 ⇒ máximo hipotético de R$230, **não** uma meta de R$300 comprovada.

## 6. Como oferecer sugestões proativas?
Motor local de oportunidades com evidenceId, dataVersion, impacto e incerteza; ranking por relevância, deduplicação e ação concreta. B05 Hoje V6 recebe até três insights; Conversar V5 explica o mesmo insightId e Plano V5 reutiliza as premissas. Sem consentimento, usar empty state — nunca simular dados pessoais.

## 7. Como preparar ações?
Gerar draft estruturado de orçamento ou planejamento e apresentar antes/depois na Central; read e prepare não são write. Para gravar no futuro, precisa de gateway próprio homologado, escopo, snapshot, revalidação, confirmação nativa, backup, idempotência, recibo, QA e autorização expressa. approvedForPersonal do MAIN continua false.

## 8. Quando cada jornada fica demonstrável?
| Marco | Experiência demonstrável | Escopo |
|---|---|---|
| M0 | arquitetura/testes/contratos revisáveis | docs, sem runtime |
| M1 | J2 investigação de aumento com números reconciliados | leitura + chat |
| M2 | J1 plano de economia; J3 simulação de compra | leitura, simulação, plano sem write |
| M3 | J4 Hoje proativo com mesmo insight em Conversar/Plano | dados autorizados + UI B05 |
| M4 | J5 preparação de mudanças na Central | draft e preview; **write pessoal OFF** |

## 9. O que impede execução pessoal?
Faltam gates pessoais homologados por tipo de ação, QA final e evidência de recuperação, contrato de orçamento/planejamento com before/after, avaliação de segurança e autorização explícita do proprietário. A existência de banco e D05 não basta. PR #76 e PR #88 continuam sem homologação nessa revisão.

## 10. Qual deve ser a primeira missão de código?
**I3-01 V2 — Investigação verificável de aumento de despesas.** Implementar fatia M1-S1, totalmente read-only. Pedir “Por que minhas despesas aumentaram nos últimos meses?”, interpretar intervalo, consultar ledger/categorias/merchants, decompor variações sem confundir causalidade, mostrar cobertura/proveniência e produzir resposta real no chat com follow-up.

**Critério de demonstração:** fixture F1 outubro 37000 vs novembro 42000 centavos, delta +5000, decomposição -5000 Alimentação +4000 Transporte +6000 Seguro +0 Assinatura; nenhum pendente ou transferência somado. Se 2600 movimentos e só 2500 lidos, informar parcial. Troca de conta/token no meio da pergunta impede resposta. A tela mostra evidência, não texto genérico, e nenhuma alteração é persistida.

**Ownership:** criar PR próprio após aprovação desta V2, basear no SHA atualizado do integrador e coordenar src/intelligence-local.ts, intelligence-view.ts, MAIN/preload com issue #49; evitar conflito com implementação B05. Não iniciar M2/M3/M4 enquanto M1 não demonstrar jornada completa e invariantes.

## Critérios da aprovação desta V2
- 40 capacidades preservadas com estado honesto, dez UNKNOWN investigadas.
- 50 testes V1 corrigidos estruturalmente, status NOT_RUN, fixture de seis meses reconciliada.
- Nove contratos de leitura/análise/simulação com JSON Schemas, exemplos, erros e aceites.
- J1–J5, M0–M4, fronteiras de ownership, rubrica e PoC LLM sintética **somente planejada**.
- Documentação apta a execução dividida em fatias. Não declarar QA/merge/EXE.

## Links principais
- [PR #91 — V1](https://github.com/JoaoVittorLi/meu-financeiro/pull/91)
- [PR #76 — RC global](https://github.com/JoaoVittorLi/meu-financeiro/pull/76)
- [PR #88 — B01–B04](https://github.com/JoaoVittorLi/meu-financeiro/pull/88)
- [Issue #84 — B05](https://github.com/JoaoVittorLi/meu-financeiro/issues/84)
- [Issue #89 — IA3](https://github.com/JoaoVittorLi/meu-financeiro/issues/89)
- [Issue #49 — ownership](https://github.com/JoaoVittorLi/meu-financeiro/issues/49)
