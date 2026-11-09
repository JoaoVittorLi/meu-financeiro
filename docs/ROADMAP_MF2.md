# Meu Financeiro 2.0 — roadmap mestre com escopo fechado

**Versão do planejamento:** 1.0 • **Data-base:** 09/11/2026 • **Status:** direção de produto, não atestado de implementação.  
**Entrada para outras IAs:** [docs/ai-context/README.md](ai-context/README.md).

## Missão e norte

Criar gestão financeira pessoal premium, consistente no Windows e Android PWA, com dados reconciliados, planejamento preditivo, visão de dinheiro seguro para gastar e IA que **consulte de verdade** e só **escreva com autorização e auditoria**. Preservar tudo de valor construído na 0.9.x. A experiência deve ser útil mesmo sem banco conectado, sem Internet ou sem IA, respeitando estados de disponibilidade.

Cinco princípios permanentes:
1. **Fonte de verdade única após migração homologada** — não ativar cloud finance antes de conciliação.
2. **Motor financeiro determinístico compartilhado** — IA não calcula saldos de forma autoritativa.
3. **Experiência multiplataforma coerente** — Windows/PWA com os mesmos contratos, datas e valores.
4. **Ações autorizadas, reversíveis quando tecnicamente possível e auditáveis** — nunca escrita irrestrita.
5. **Escopo 2.0 fechado** — ideias adicionais vão para backlog 2.1 salvo correção crítica ou substituição justificada.

## Benchmark consolidado → decisões

| Referência | Selecionar como capacidade | Não copiar |
| --- | --- | --- |
| Copilot Money | Painel refinado, análise de fluxo, categorização | Ativos proprietários/UI literal |
| Monarch Money | Painel modular, orçamento flexível, metas | Modelo avançado sem persistência real |
| Origin/Cleo | Contexto e conversa financeira | IA que afirma fazer ações não executadas |
| Rocket Money/Snoop | Recorrências, alertas, vazamentos de gasto | Cancelamentos automáticos com terceiros |
| YNAB | Alocação orçamentária e prioridades | Contabilidade incompatível com saldos reais |
| PocketGuard | Dinheiro seguro para gastar | Número que ignora cobertura do saldo |
| Simplifi | Fluxo de caixa futuro | Previsão apresentada como saldo confirmado |
| Actual Budget/Lunch Money | Consistência, regras e auditabilidade | Duplicação de engines |
| Mobills/Organizze | Simplicidade e realidade brasileira | Complexidade de menus desnecessária |
| Kinvo | Patrimônio e proventos | Ordens de negociação automáticas |

**Taxonomia final de navegação (objetivo, não estado atual):** Visão Geral; Movimentações; Planejamento (inclui Laboratório de Decisões/Simulador); Orçamentos; Metas e Patrimônio; Inteligência; Contas; Configurações. Não criar Radar como aba adicional: integrado a Visão Geral/IA/notificações.

## Trilha de dependências

MF2-00 → MF2-01 → MF2-02 → MF2-03 → MF2-04.  
MF2-05 depende de MF2-02/03; MF2-06 depende MF2-02/05; MF2-07 depende MF2-06; MF2-08 depende MF2-02/07; MF2-09 depende MF2-02 e interfaces/domínios MF2-04…08; MF2-10 depende de todos. Projetos independentes podem ter **especificação** antecipada, mas integração/lançamento respeitam gates.

## Entregas e critérios definitivos

### MF2-00 — Estabilização, baseline e PRs

**Escopo:** inspecionar código e Work não publicado; catalogar PRs empilhados; homologar U3 0.9.5-beta.6 ou seu sucessor; preflight, build Windows, ASAR/proveniência, smoke isolado Windows, branch de integração protegida, build reproduzível. Não acrescentar recursos de produto.

**Aceite G0:** SHA identificado, testes executados verificavelmente, instalador + portátil com SHA256, teste visual funcional Windows, riscos e estratégia de integração registrados. Não afirmar homologação por documentação de testes.

### MF2-01 — Integridade, cloud e sincronização

**Escopo:** comparar Windows×Preview por identidade conta+transação, status, centavos, data, saldo as-of, categoria, split e referências; investigar 630×632 sem pressupor causa; backup e restore testados; CAS/revisões, idempotência, conflitos explícitos, permissões. Fazer migração gradual apenas com autorização e rollback.

**Aceite G1:** ausência de divergências não explicadas, recuperação demonstrada, sincronização PC↔PWA com testes concorrentes, sem duplicatas ou perda silenciosa. Flags financeiras só mudam em ação controlada.

### MF2-02 — Motor financeiro único

**Escopo:** ledger banco/manual, contas/saldos, categorias e splits, transferências, compromissos/parcelas, orçamento, fluxo, metas, dívidas, simulação, patrimônio. Contratos de consulta e comando com schemas e revisões; matemática de centavos e datas.

**Aceite G2:** golden tests cruzados Windows/Worker, mesmas entradas geram mesmo resultado, sem fórmulas alternativas em telas.

### MF2-03 — U4 multiplataforma

**Escopo:** adaptar U1–U3 para PWA, preservar recursos atuais; equivalência de ações de Movimentações, Planejamento, Orçamentos, Contas, Simulador e Inteligência nos limites homologados; responsividade, teclado, temas, estados vazios; contratos compartilhados.

**Aceite G3:** jornadas centrais funcionam em Windows/PWA, resultados coincidem, 320/390/768/1366/1920 e temas revisados; diferenças de plataforma documentadas, sem declarar inferência real onde só há demo.

### MF2-04 — Design premium + Visão Geral modular

**Escopo:** sistema visual consistente, cartões configuráveis com tamanhos controlados, ordenação e preferências, indicadores com drill-down e origem, privacidade visual; incorporar saldo seguro quando MF2-06 entregar motor.

**Aceite G4:** personalização salva, layout acessível e fluido, dados iguais ao núcleo e nenhum card de saldo seguro inventado.

### MF2-05 — Movimentações inteligentes

**Escopo:** classificações por prioridade manual>regra>provedor>sugestão, regras simuladas antes de lote, revisão humana, recorrências, despesas repetidas/anômalas, custos anualizados, busca/filtros e histórico da intervenção.

**Aceite G5:** não editar lançamento bruto, não sobrescrever classificação manual silenciosamente, regras reprodutíveis, banco/manual não duplicados.

### MF2-06 — Planejamento preditivo e Laboratório de Decisões

**Escopo:** caixa diário/mensal, compromissos e ciclos salariais, receitas confirmadas versus incertas, saldo mínimo, saldo seguro com cobertura/hipóteses visíveis, simulação A/B à vista/parcelado/adiar/antecipar dívida, sem persistir ação simulada.

**Aceite G6:** não descontar duas vezes pagamentos, não contar receitas incertas como recebidas, saldo seguro indisponível quando base insuficiente, simulações auditáveis e não destrutivas.

### MF2-07 — Orçamentos, metas e dívidas

**Escopo:** modo simples e avançado no mesmo motor, alocação por período, rollover opcional, transferir orçamento, alertas e previsão; metas/reservas; empréstimos/parcelas, juros, cronogramas e antecipação com parâmetros explícitos.

**Aceite G7:** zero distinto de não definido, reserva virtual não vira saldo bancário, simulações de dívida não executam pagamento, regras de amortização verificadas.

### MF2-08 — Relatórios e patrimônio

**Escopo:** relatórios rastreáveis e exportáveis, ativos/passivos e patrimônio líquido, carteira básica, aportes, retiradas, custo de aquisição, cotações identificadas, proventos/dividendos; rentabilidade separada de aporte.

**Aceite G8:** valores conciliados, sem contar transferências internas como ganho, preços com data/fonte, sem ordens automáticas.

### MF2-09 — Inteligência operacional e Radar

Quatro subfases:
- **09A Viabilidade**: validar mecanismo autorizado de acesso a modelo, autenticação, custo e limite; não supor que Plus cobre API ou que string no código significa serviço real.
- **09B Leitura**: IA consulta ferramentas de leitura do núcleo, com origem, período, cobertura e evidências.
- **09C Escrita**: preparar diffs multiárea, validar versão de dados, pedir confirmação, executar transação idempotente, registrar auditoria, reverter quando permitido; jamais pagamento/transferência/ordem de investimento.
- **09D Radar**: alertas determinísticos sobre saldo, vencimento, orçamento, recorrência, anomalia, meta e dívida; IA explica, não inventa evento.

**Aceite G9:** sem exposição de segredos; autorização e logs de cada ação; recusa quando dados mudam; custos controlados; IA indisponível não bloqueia finanças.

### MF2-10 — Homologação e lançamento 2.0

**Escopo:** suíte e2e financeira, permissões, falha/offline, segurança, performance, visual/accessibilidade, migrações e restauração, instalador NSIS e portátil, PWA compatível no mesmo SHA/contrato, checksums e changelog, plano de rollback.

**Aceite G10:** zero bloqueios conhecidos, sem diferenças financeiras inexplicadas, Windows/PWA testados, release 2.0.0 somente após aprovação.

## Regras financeiras transversais

Valores em centavos exatos; IDs estáveis; distinção posted/pending; banco e manual sem soma automática; transferências próprias neutras; orçamento não é saldo; saldo desconhecido não é zero; receita futura incerta não é recebida; parcelamento, pagamento parcial e vínculo não geram dupla contagem; previsão não representa garantia de liquidez. Evidências e qualidade são parte do contrato de apresentação.

## Fora do 2.0 sem redefinição explícita do escopo

Pix/pagamentos automáticos, negociação/cancelamento externo de assinaturas, ordens de ativos, consultoria de investimento autônoma, gestão empresarial/fiscal, gamificação complexa, multiusuário e apps nativos macOS/Linux.

## Processo

Marcos têm estados NAO_INICIADO, EM_DESENVOLVIMENTO, EM_TESTE, BLOQUEADO, VALIDADO, INTEGRADO e PUBLICADO. Nenhuma tarefa salta de código presente para PUBLICADO. Cada entrega inclui testes, evidências, changelog/log e revisão. Ver [OPERATING_PROTOCOL](ai-context/OPERATING_PROTOCOL.md) e [GAPS_AND_GATES](ai-context/GAPS_AND_GATES.md).

**Ponto de partida verificado:** MF2-00. U1–U3 desktop existem na PR #16, mas o EXE do SHA atual não está homologado. Não iniciar cutover para acelerar o roadmap.
