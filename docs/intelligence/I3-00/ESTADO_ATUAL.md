# ESTADO ATUAL — Arquitetura e gargalos comprovados

# I3-00 — Evidências, escopo e limites

Data: 2026-11-16. Baseline: PR #76, HEAD 1bc1b89bf5bdefc0196b0851e690a99f825ca85a. Inspeção estática via GitHub, sem checkout, sem testes reais, sem Electron Windows e sem consulta a informações bancárias pessoais. Estados relativos somente a esse HEAD, salvo indicação explícita de PR paralelo. [Issue I3-00](https://github.com/JoaoVittorLi/meu-financeiro/issues/89).

**Status de evidência**: CODE_IMPLEMENTED_NOT_TESTED indica código verificável, mas não runtime homologado; BLOCKED_BY_POLICY indica bloqueio explícito; PARTIAL indica cadeia incompleta; UNKNOWN indica investigação insuficiente. Nenhuma capacidade foi classificada como RUNTIME_VERIFIED apenas por ler código.


## Fontes e HEADs
- [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76): 1bc1b89bf5bdefc0196b0851e690a99f825ca85a, base de referência desta auditoria; código integrado, QA Windows pendente. Não usar o HEAD anterior de descrições de issue.
- [I2-D PR #79](https://github.com/JoaoVittorLi/meu-financeiro/pull/79): fd5aca036ae96ca3aef99be752a2bfdeb9750688, aberto.
- [I2-E PR #80](https://github.com/JoaoVittorLi/meu-financeiro/pull/80): c56675d02f6d1b5ac9074fb9039aad3d74ff81e1, aberto.
- [B01/B02 PR #85](https://github.com/JoaoVittorLi/meu-financeiro/pull/85): 155911e58766be25d622ef7e979a00af1f944c24, não homologado.
- [B03/B04 PR #86](https://github.com/JoaoVittorLi/meu-financeiro/pull/86): 5fbe45c73dc0b101774749fe769c35133dbf7c7b e [PR #87](https://github.com/JoaoVittorLi/meu-financeiro/pull/87): ddaf560dd5756365114f9bc990e231c6121576ee; duas soluções concorrentes, reconciliar com #85 antes de integração.
- [B05 issue #84](https://github.com/JoaoVittorLi/meu-financeiro/issues/84): design Hoje V6, Conversar e Plano V5 aprovado, implementação Electron pendente; não confundir design com capacidade operacional.
- [Release #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) / [QA #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65): NO-GO para declarar primeiro EXE homologado. [Ownership #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49).

## Reconstrução dos caminhos reais
**Caminho 1 — leitor local IC-v1:** src/intelligence-local.ts: localFinancialEnable() solicita consentimento por fonte e perfil, recebe token e expiração de 15 minutos; localFinancialQuery() envia mês e intenção a electron/preload.cjs, IPC finance:read-query em electron/main.cjs, LocalFinancialIntelligence.query() em electron/financial-intelligence.cjs; agregação via shared/finance-period-ledger.mjs, banco FinanceDB, opcionalmente PlanningStore. A resposta exige version=1, readOnly=true, inferenceCalled=false e changesApplied=false. O parser de compatibilidade localFinancialParse() classifica apenas oito intenções: radar, category, largest, budgets, commitments, compare, review e purchase. Status: CODE_IMPLEMENTED_NOT_TESTED.

**Caminho 2 — I2-A/IC2 conversacional:** src/intelligence-local.ts: localFinancialSubmit() prefere intelligence:ic2-read-query quando não há exigência V3; electron/intelligence-ic2-adapter.cjs valida contrato e token antes e após; electron/intelligence-orchestrator.cjs: ask() usa localPlan() — expressões regulares e prioridades fixas — e FinancialReadTools.execute(); responde com fatos e blocos IC2, sem chamar modelo. As nove ferramentas existentes em electron/intelligence-tools.cjs são summary, compare, categories, merchants, transactions, budgets, commitments, simulate e quality. O plano máximo é de quatro etapas (electron/intelligence-provider.cjs: validatePlan), e resposta IC2 permite no máximo quatro fatos e três blocos. Status: CODE_IMPLEMENTED_NOT_TESTED; suporte natural amplo: PARTIAL.

**Caminho 3 — família visual V3 e operacional:** src/intelligence-v3-core.ts: mfV3Requested() detecta famílias por regex; src/intelligence-local.ts pode desviar a solicitação para intelligence:operational-ask e buscar radar do mês anterior. electron/intelligence-operational.cjs agrega cartões de review, radar, budgets, commitments, categories, chat e mantém recomendações de regra/recibos sintéticos separados. Os módulos src/intelligence-v3-ui.ts e src/intelligence-today-v2.ts renderizam evidências sem inventar saldo disponível. Status: CODE_IMPLEMENTED_NOT_TESTED; multiplicidade de rotas reduz consistência.

**Caminho 4 — categorias I2-B/C/D/E:** electron/main.cjs registra intelligence:category-personal e IPC de laboratório; electron/intelligence-category-rc.cjs: bindPersonal() liga CategoryProposalService, ProactiveCategoryAdvisor (I2-D), EvidenceQualityService (I2-E) e bridges. Há capacidade de leitura, análise e prévias hierárquicas D05; personalCall() impede operações pessoais não permitidas, inclusive prévias planas ambíguas; d05QualityDraft() exige categoria/subcategoria explícitas, conta ativa, evidências frescas e limite de dez itens verificáveis. Escritas sintéticas rodam em cofre SQLite de teste com confirmação nativa; **não** são autorização para escritas reais. Status: CODE_IMPLEMENTED_NOT_TESTED / BLOCKED_BY_POLICY onde apropriado.

**Caminho 5 — gate pessoal D05:** electron/d05-personal-gate.cjs: confirmPreview() verifica owner, nonce, hash de estado, conta, idempotência por recibo, backup SQLite, confirmação nativa e transação; aprovado somente se approvedForPersonal() verdadeiro ou cofre sintético. O comentário do próprio código e a issue #71 mantêm escrita pessoal experimental bloqueada até homologação. Status: BLOCKED_BY_POLICY para acionamento da IA; gate implementado sem prova Windows desta revisão.

**Caminho 6 — ChatGPT externo:** electron/ai-client.cjs: ChatGPTDemoClient, Responses API, caso de demonstração e máximo de três testes. shared/ai-policy.mjs fixa o modelo gpt-6.1-sol; shared/ai-financial-context.mjs tem marcador explícito synthetic only e proíbe uso de extratos reais; electron/ai-auth.cjs e electron/ai-vault.cjs tratam identidade/OAuth criptografado. Não há ligação comprovada modelo externo → ferramentas IC2 sobre dados pessoais. Status: MOCK_ONLY/DEMO para o caso financeiro e PARTIAL para o objetivo de conversa avançada com dados reais. Não assumir assinatura = API gratuita.

## Segurança, limites e semântica financeira
1. electron/financial-intelligence.cjs, LocalFinancialIntelligence: leitura por fonte única (bank OU manual), perfil e owner, concessão em memória com TTL 15 min; Planning requer consentimento adicional.
2. electron/intelligence-context.cjs, ConversationContextStore: até 40 conversas ativas, TTL padrão 10 min; scope inclui owner, token, fonte, perfil, mês. Contexto do orquestrador efêmero, NÃO memória pessoal persistente.
3. src/intelligence-integration.ts, intelligenceEnsureHydrated()/intelligenceSyncThreadMessages(): histórico local de threads existe fora da leitura autorizada; ao autorizar consulta, src/intelligence-local.ts limpa histórico ativo e restaura backup da interface ao revogar. Não equivale a memória financeira de longo prazo com fonte válida.
4. electron/financial-intelligence.cjs, bankOverview(): até 2.500 lançamentos bancários carregados e aviso truncated; compromissos via planner.list() podem atingir 5.000 e ser parciais. O número de registros carregados não certifica histórico completo.
5. electron/intelligence-tools.cjs: filtro máximo de 25 IDs, 20 categorias excluídas; consulta por estabelecimento devolve até 25 grupos; comparação apenas mês atual e anterior; simulação simples por percentuais inteiros sobre uma categoria, não previsão de poupança.
6. shared/finance-period-ledger.mjs: não somar fontes bancárias e manuais sem conciliação. O motor considera status/natureza/splits; nem resultado mensal nem expectativa de receitas devem ser tratados como saldo disponível.
7. electron/intelligence-provider.cjs: SyntheticPlanningAdapter só é habilitável com fixtures sintéticas explícitas; não há planejador LLM de produção nesse caminho.
8. src/intelligence-v3-core.ts e src/intelligence-local.ts: regex para tipos visuais pode retirar questões do IC2. Inspecionar prioridade antes de alterar roteamento.
9. electron/ai-personal.cjs: memórias do uso demo vinculadas ao sujeito ChatGPT e criptografadas em armazenamento local; não representam contexto durável de transações.

## Limitações confirmadas, causa e correção proposta
| ID | Sintoma | Evidência técnica | Causa | Gravidade | Correção proposta |
|---|---|---|---|---|---|
| L01 | Pedidos naturais não entendidos | intelligence-orchestrator.cjs: localPlan; intelligence-local.ts: localFinancialParse | regex/roteamento finito | Alta | planejador tipado multietapas + testes por intenção |
| L02 | Modelo avançado não investiga dados reais | ai-client.cjs + ai-financial-context.mjs | caminho de inferência separado, sintético | Crítica | roteamento seguro para tools com autorização e política distinta; não desbloquear modelo sem revisão |
| L03 | IA não executa orçamento/plano pessoal | intelligence-category-rc.cjs: personalCall; d05-personal-gate.cjs: confirmPreview | bloqueio deliberado e contratos específicos | Crítica, intencional | preparar ações tipadas e gate D05 homologado, somente após autorização futura |
| L04 | Comparações e merchants superficiais | intelligence-tools.cjs: execute(compare/merchants) | 2 meses e limites de agrupamento; sem inferência causal | Alta | consulta determinística multifaixa, origem e cobertura |
| L05 | Histórico financeiro pode estar incompleto | financial-intelligence.cjs: truncated/2.500 | teto do carregamento | Alta | metadados de cobertura/consulta paginada autorizada |
| L06 | Conexão entre várias solicitações curta | intelligence-context.cjs: TTL 10min | memória episódica efêmera | Média | contexto por escopo, compactação auditável, metas com opt-in |
| L07 | Ferramentas desconectadas da superfície de chat | intelligence-category-rc.cjs, intelligence-local.ts, intelligence-operational.cjs | serviços especializados e rotas concorrentes | Alta | registry com contratos de leitura/proposta e mesmo recibo/evidência |
| L08 | Recomendações pessoais raras/genéricas | intelligence-operational.cjs: cartões e regras sintéticas; I2-D dedicado à taxonomia | não há engine transversal de economia e objetivos demonstrado | Alta | engine versionada de oportunidades financeiras |
| L09 | B03/B04 conflitantes e B05 visual-only | PRs #85–#87; issue #84 | dependências de integração paralelas | Alta | handoff versionado e QA antes da integração |
| L10 | Risco de resolver categoria por texto plano | intelligence-category-rc.cjs: ambiguity/d05QualityDraft | D05 exige IDs pai/filho resolvidos | Alta | preservar a resolução explícita, proibir fallback silencioso |

## Hipóteses ainda NÃO verificadas
Integridade da sincronização real Pluggy ponta a ponta; execução exata de cada ramo de QA no Windows; todos os caminhos de histórico na nuvem; cobertura de todas as categorias em dados bancários reais; desempenho e latência em lote; situação de ferramentas de investimento e calendário fora dos módulos inspecionados. Esses pontos permanecem UNKNOWN, não ABSENT.

## Referências do código auditado
- [financial-intelligence.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/financial-intelligence.cjs) (blob a6c7a00dd3d03282ba5f5e679e4fd2dfe2f42a4c)
- [intelligence-orchestrator.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-orchestrator.cjs) (blob f0bd38fd699fbbbefdc940d47854e2a4469c1872)
- [intelligence-tools.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-tools.cjs) (blob 1ee7d1391d33866409e6020d76ddf88b1bdc0c36)
- [intelligence-context.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-context.cjs)
- [intelligence-provider.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-provider.cjs)
- [intelligence-category-rc.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-category-rc.cjs)
- [intelligence-category-opportunities.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-category-opportunities.cjs)
- [intelligence-category-quality.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/intelligence-category-quality.cjs)
- [d05-personal-gate.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/d05-personal-gate.cjs)
- [intelligence-local.ts](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/src/intelligence-local.ts)
- [intelligence-integration.ts](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/src/intelligence-integration.ts)
- [ai-client.cjs](https://github.com/JoaoVittorLi/meu-financeiro/blob/1bc1b89bf5bdefc0196b0851e690a99f825ca85a/electron/ai-client.cjs)

## Leitura complementar
[Matriz de capacidades](MATRIZ_CAPACIDADES.md) · [100+ intenções](MAPA_INTENCOES.md) · [Arquitetura de ferramentas](ARQUITETURA_FERRAMENTAS.md) · [Roadmap](ROADMAP_I3.md) · [Resumo executivo](RESUMO_EXECUTIVO.md).
