# Categorização supervisionada — execução 12/11/2026

Base: `qa/mf2-functional-product-candidate-20261112`, SHA `34750c9841f8cf47ea369f5780cef80e39938d8c`, reconfirmado com as branches #43/#44/#45 via Git remoto antes de editar. Checkout gerenciado isolado; branch `feat/mf2-supervised-categorization-20261112`. HEAD final: consultar a branch/PR deste log. A missão do proprietário autoriza implementação, commits e PRs Draft, sem merge, instalador ou produção.

## Comportamento entregue

- Detecção conservadora: descrição normalizada **exata**, conta e natureza; aprende de overrides humanos. Não agrupa nomes semelhantes, não usa PIX/TED/cartão genéricos como identificação. Próprias classificações são marcadas para não retroalimentar a evidência.
- Confiança alta/média/baixa por quantidade e conflitos, sem percentuais inventados. Exemplos reais da fixture, justificativa, escopo e prévia. Edição de categoria na sugestão, negar e adiar persistentes; recusas reaparecem apenas com mudança de evidência.
- Regra aprovada gravada em `category_rules` por `FinanceDB.upsertRule`, com restrição aditiva por conta/natureza e limite de `rowid`. Usa **matchRule existente** em `bankOverview` e agregados; não há segundo motor. Registros existentes não mudam ao aprovar uma regra futura. Reimportar usa o mesmo registro e não duplica a decisão.
- A revisão usa paginação SQLite por chave, não o cache de 2.500 do renderer. Filtra conta/período/confiança/padrão; até 50 registros por página, 100 por comando. Listagem de sugestões limitada explicitamente a 100, com indicação de cobertura; análise local não certifica o extrato remoto.
- Prévia separada para histórico: seleção explícita, categoria anterior/nova e valor total absoluto. Overrides, splits, vínculos manuais, PENDING e transfer/ignore protegidos contra reclassificação. Baixa confiança não entra em aprovação coletiva, mesmo após negar a sugestão. Revisão individual do estado pode preservar categorias manuais.
- Contratos principais validam sender e perfil; leitura não concede escrita. Confirmação contém ID/digest da prévia, consentimento específico, origem e prazo. Estado revalidado dentro de `BEGIN IMMEDIATE`, execução via FinanceDB, auditoria e commit atômicos. Repetição retorna o recibo sem executar de novo. Falha de classificação ou de auditoria reverte tudo.
- Reversão de lote compara o estado atual com o aplicado e restaura override e notas anteriores; conflito posterior recusa. Regra pode ser desfeita antes de uso; após novas importações pede pausa com impacto. Pausar, reativar, editar categoria e excluir têm prévia com cobertura explícita.
- Chat principal e drawer reconhecem pedidos de revisão/sugestão/desfazer e encaminham à mesma Central/prévia, sem executar por texto. Conversas e permissões da revisão ficam na sessão; histórico legado é preservado e restaurado ao encerrar. Auditoria de ações confirmadas permanece no SQLite sintético. Apagar preferências não apaga regras, categorias ou auditoria.

## Proteção do perfil pessoal

`CategoryReviewService` é instanciado no processo principal **somente** quando `isolateSmokeProfile` já confirmou Electron de desenvolvimento e diretório temporário isolado. Fora desse contexto, status informa indisponibilidade e todos os novos endpoints recusam. O construtor recusa antes de acessar SQLite quando `syntheticProfile` não é true. Novas tabelas não foram acrescentadas ao construtor normal de FinanceDB. Matcher só consulta restrições se a tabela existir.

Nenhum SQLite pessoal aberto por estes testes. Instalação existente usada apenas para referência visual; sem instalação por cima, migração pessoal, chamadas externas, CI Windows, pagamento ou merge. Rede HTTP/HTTPS da candidata permanece bloqueada pelo perfil smoke existente.

## Testes de código

Windows local, Node **22.23.4**, npm **10.9.9**, lockfile via `npm ci --no-audit --no-fund`; temporário explícito descartável.

| Gate | Resultado |
| --- | --- |
| Baseline `npm run test:db` em 34750c9 | 459/459 PASS |
| `npm run test:db` após implementação | 489/489 PASS, 0 skip |
| `npm run test:types` | PASS |
| `npm run compile` | PASS, incluindo gerador canônico |
| `node scripts/renderer-provenance.cjs check-bundle` | F08 PASS, 11 entradas |
| `npm run test:asar` | 1/1 PASS |
| Proveniência create/verify | PASS no checkpoint 912a597; repetir no HEAD final limpo |

30 testes novos: 26 de serviço/SQLite + 4 de callbacks/persistência de UI. Incluem futuro versus passado, reimportação, ambiguidades e confiança, decisões, regras pausadas/conflitos, splits/PENDING/transfer, manual, stale/duplicação, falha parcial e de auditoria, reversão, limite após o centésimo registro, 2.515 registros paginados, reopen e backup/restauração SQLite. Testes de componentes chamam o serviço de produção com SQLite; não são apresentados como Electron E2E.

## Computer Use real — cobertura observada

Electron **45.2.3**, candidata com fontes da branch, perfil sintético criado por `scripts/category-review-fixture.cjs`; janela real de aproximadamente 1486×933. Capturas exibidas pelo Computer Use nesta conversa, sem imagens geradas, protótipo HTML, alteração de mídia ou emulação de viewport. Binário de desenvolvimento existente reutilizado; não foi gerado instalador.

Inspeção inicial das oito áreas: Visão Geral, Movimentações, Planejamento, Minhas Contas, Orçamentos, Simular Compra, Configurações e Inteligência. Cobertura pontual de navegação/estados, **não** homologação de todos os CRUDs. O card de despesas preservou vermelho em normal → ponteiro → retorno. B3: caso de limite zero mostra “Acima do limite”; não foi substituída a geometria.

Pela interface: autorizar revisão sintética → detectar CAFETERIA FLORESTA/3 decisões → prévia de regra futura → confirmar → recibo. Conferência read-only do SQLite sintético: 1 regra, restrição `after_rowid=11`, **zero overrides nos dois registros históricos**. Nova decisão pela UI selecionou esses dois registros, exibiu R$ 37,80 e Outros → Alimentação, aplicou e auditou. A prévia de desfazer foi confirmada pela UI; SQLite comprovou zero overrides históricos e comando `undone`. Pedido “Revise tudo que está pendente.” no chat exibiu botão funcional para a Central. Recibos sintéticos não contêm dados pessoais.

Primeira tentativa de início com `windowsHide:true` não expôs janela. Diagnóstico mostrou renderer carregado; lançamento **interativo** com `windowsHide:false` tornou a candidata acessível ao Computer Use. Nenhuma proteção foi removida. A instalação pessoal não foi usada como prova da candidata.

Defeitos de UX observados e reservados para PR visual separado: mês/checkbox de leitura com alturas/alinhamento inconsistentes; ao navegar de Orçamentos rolado para Simular Compra, o título de destino ficou acima da área visível. Tema escuro e rodada visual final do refinamento serão registrados no PR visual.

## Limites e próximos gates

### Reforço após o primeiro checkpoint #46

O checkpoint inicial `912a597` tinha 486 testes. Revisão adicional identificou a necessidade de invalidar também **classificações históricas já executadas** quando a instituição altera descrição/valor/data/status/natureza. Proveniência agora vincula o override supervisionado ao conteúdo aprovado: `bankOverview` e agregados ignoram uma classificação desatualizada, a fila explica o motivo e permite nova decisão individual. Uma correção humana explícita remove essa proveniência, mesmo escolhendo a mesma categoria, e é preservada em importações e protegida contra desfazer posterior. Notas/estado de revisão não ressuscitam uma regra negada sem mudança de evidência relevante. Três regressões adicionais; **489/489 PASS** no estado final. O commit subsequente atualiza código, roadmap e o TAP desta entrega.

Implementação conservadora não faz associação aproximada de comerciantes nem inferência generativa. A edição de sugestões mantém padrão exato/conta/natureza; categoria é editável, prioridade validada no contrato. Não entrega agentes de orçamento/planejamento/metas/assinaturas, detecção nova de duplicatas ou migração do histórico legado para cofre. Esses itens seguem posteriores à categorização e à homologação.

G5/G9: **homologação parcial sintética**, nunca escrita pessoal liberada. Próximos gates: revisão do Draft, QA final em temas/escalas e cenários adicionais, autorização específica antes de qualquer habilitação pessoal/Windows CI/instalador. Reversão de código: reverter os commits e recompilar; tabelas são aditivas e apenas em perfis descartáveis. Não executar transformação em banco pessoal.
