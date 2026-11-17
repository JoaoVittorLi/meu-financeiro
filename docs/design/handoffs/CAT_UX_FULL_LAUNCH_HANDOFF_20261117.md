# CAT-UX — Pacote único de lançamento / categorização bancária automática · 2026-11-17

**Produto:** Meu Financeiro 1.0.0 · **Prioridade P0** · **Repositório:** JoaoVittorLi/meu-financeiro

**Decisão do proprietário (conversa, 17/11/2026):** criar TODAS as superfícies e estados da categorização em lote, sem múltiplas rodadas de avaliação individual; priorizar entrega de funcionalidade real. Ele fará uma aprovação global e revisões pós-lançamento se necessário. Isso **não dispensa segurança, regressões, QA ou consentimento**. Esta entrega é o **handoff completo de design**, não um merge de código, um EXE ou um atestado de testes.

## 1. Precedência e estado das aprovações

| Superfície | Versão | Estado |
| --- | --- | --- |
| D08 Planejamento — Horizonte Financeiro | V3 Motion Remaster corrigida | **DESIGN_APPROVED** pelo proprietário (17/11) / implementação Electron não comprovada |
| CAT-UX-01 Configuração Inicial Inteligente | V1 | **DESIGN_APPROVED** explicitamente |
| CAT-UX-02 Evidence Flow / análise inicial | V1 | **DESIGN_PRESENTED**, incluída no mandato de pacote único; sem aceite visual isolado |
| CAT-UX-03 Central da Automação / Rastro Vivo | V1 corrigida | **DESIGN_APPROVED** explicitamente |
| CAT-UX-04 Regras e Evidências | Pacote único | **BATCH_DESIGN_DELIVERY**, sujeito a aprovação global |
| CAT-UX-05 Histórico / Recibos / Reversão | Pacote único | **BATCH_DESIGN_DELIVERY**, sujeito a aprovação global |
| CAT-UX-06 Segurança / Recuperação / Estados | Pacote único | **BATCH_DESIGN_DELIVERY**, sujeito a aprovação global |

**Diretriz:** uma experiência e uma navegação; não recriar B04 Central de Revisão, D05 catálogo/edição ou B05 Inteligência. D01–D08, B01–B05 preservados. Linguagem visual premium já aprovada: superfícies neutras, top border reveal breve, microtransições de dados, SVG canônicos D05, dark/light e reduced motion; nada de loops decorativos permanentes.

## 2. Código existente verificado (PRs e caminhos)

- **PR #100** `feat/mf-v1-p0-bank-auto-categorization-20261117` sobre **#96**, com motor `electron/d05-auto-categorization.cjs`, integração `electron/main.cjs`, `electron/preload.cjs`, `electron/db.cjs`, UI `src/d05-movements.ts` e `app/d05-movements.css`, testes `tests/d05-auto-categorization.test.cjs`. Estado PR Draft, QA real/Windows não executado nesse SHA.
- **PR #104** `fix/mf1-p0-auto-anchors-qa-20261117` sobre #100 corrige evidências duplicadas: não contar como âncoras independentes transações distintas com mesmo estabelecimento/conta/data/centavos. Testes declarados; QA Node/SQLite real e Electron ainda não comprovados.
- O motor tem `status()`, `configure()`, `plan()`, `apply()`, `revoke()`, `correct()`, `undo()`. O preload existente expõe `bankAutoStatus`, `bankAutoConfigure`, `bankAutoRevoke`, `bankAutoApply`, `bankAutoReview`, `bankAutoRuleSuggestions`, `bankAutoReceipt`, `bankAutoUndo`, `bankAutoCorrect`.
- `src/d05-movements.ts` já exibe uma `.d05-auto-box` com resumo, conta/período, autorização, aplicar, sugerir regras, revogar e desfazer movimentação. **Evoluir esta superfície, não duplicar o serviço.**
- A atual implementação do `bank:auto-configure` no MAIN **executa `autoCategory.apply()` logo após `configure()`**. Isso conflita com CAT-UX-01 + CAT-UX-02: **a primeira aplicação exige prévia completa, seguida de confirmação distinta**. É **P0 bloqueante**; não mascarar com modal apenas cosmético. Exigir prévia assinada/estável, revalidação após consentimento, decisão de aplicar, proteção transacional e recibo.
- `stablePackaged` restringe o uso real da automação, e o gateway geral D05 mantém `approvedForPersonal:()=>false`. **Não remover salvaguardas para maquiar prontidão**; homologar a candidata final em Windows.
- A classificação atual é **determinística por evidências locais/regras verificadas**, sem inferência livre de LLM. A interface deve dizer “classificação por evidências locais”, não inventar percentuais de confiança, pesquisa de comerciante externa, modelo LLM ou taxas de acerto.

## 3. Jornada de interface completa — CAT-UX 01 a 06

### CAT-UX-01 · Ativação por conta (aprovada)
Entrada quando sem consentimento, expirado ou revogado. Cards inteiros clicáveis e nunca pré-selecionados; contas reais mascaradas e filtros de data; flags histórica e futuras, consentimento próprio para cada opção, garantias fixas sobre revisão manual, PENDING/splits/transferências. Resumo + confirmação nativa MAIN, distinta de leitura IC-READ. Sem conta, erro, loading, expirado, revogado e parcial com ações não destrutivas. Avançar para CAT-UX-02 **não aplica categorias**.

### CAT-UX-02 · Análise em lotes e prévia
Barra de progresso determinada por lotes concluídos reais, percentual somente com denominador conhecido; caso contrário progresso indeterminado. Pausar e retomar sem duplicar, erro do lote não conta, suporte a falha na sincronização e licença revogada. Evidências reconciliadas em `aplicáveis + revisão + protegidas + sem dados/descartadas = total elegível analisado`. Prévia navegável por conta/categoria/movimentação/justificativa, filtros e total exato. Um único botão **“Conferi; aplicar propostas elegíveis”** separado do opt-in, com confirmação nativa e transação no MAIN. Sem 177/41/22 fictícios em conta real. Mostrar `0 aplicações` até retorno de recibos. Falha parcial não virar `Concluído`.

### CAT-UX-03 · Central da automação (aprovada)
Indicadores mínimos: aplicadas, revisão e protegidas, com unidade/período/conta. Feed cronológico de ações reais, origem de sincronização, badge de `PENDENTE`/aplicada/revertida; detalhes de evidências e categoria anterior/final, recibo e botão de reversão com confirmação. Contas em painel separado: ativa, pausada, revogada, expirada; pause/resume apenas quando backend suportar persistência explícita; caso contrário desabilitar e explicar, **não fingir pausa**. Links contextuais direcionam para B04 e D05 filtrados.

### CAT-UX-04 · Laboratório de regras e padrões
Aba dedicada à lista das sugestões já fornecidas por `bankAutoRuleSuggestions`. Cada cartão exibe padrão, conta, ocorrências realmente verificadas, potenciais conflitos/precedência, fonte da regra e cobertura. Preview x “Regra aprovada” visualmente distintos. Criar/regra/save via D05 somente após confirmação e validação MAIN; sugestão nunca grava regra por si. Estados: sem padrões, evidência insuficiente, contraditória e aliases indevidos. Evitar prometer que IA “aprendeu” irrestritamente; registros humanos são âncoras sujeitas ao bloqueio #104.

### CAT-UX-05 · Recibos e desfazer
Histórico pesquisável/paginado e filtrado de aplicações, correções humanas e reversões. Detalhe: `accountId+externalId` estável, `receiptId`, ação, anterior/novo D05 pai/filho, data, cobertura, evidência hash/explicação quando disponível, snapshot/backup **verificado**, autor da decisão. Desfazer um registro por `bankAutoUndo`, com confirmação própria, revalidação e feedback “retornado à categoria anterior”; recibo original permanece. Não prometer undo de lote se API não oferece. Navegação do feed com IDs, sem confiar só em merchant/descrição.

### CAT-UX-06 · Resiliência e controles
Centro de estado (não nova arquitetura): habilitada vs pausada vs revogada vs expirada vs incompatível com RC vs sem conta vs indisponível vs sincronização parcial vs erro transitório vs rollback. Explicar o que aconteceu e qual operação foi/não foi gravada; incentivar reconexão consentida, consulta do recibo ou tentativa segura quando backend suportar. Se `bankAutoStatus().available=false`, mostrar **“Disponível após homologação”**, nunca call-to-action funcional falso. Garantir UI dark/light, keyboard, focus ring, screen reader, reduced-motion, privacidade (não revelar amplitude da base em gráficos) e performance com volume.

## 4. Contrato de dados, garantias e ações

1. Fonte financeira única: banco `POSTED` elegível e `UPDATED` quando aplicável, com contas autorizadas; `PENDING`, split, transferências, links manuais, revisões já protegidas, registros ambiguamente duplicados e aliases conflitantes **nunca automáticos**.
2. Ordem de precedência: decisão humana > regra explícita aprovada > overlay automático > classificação do provedor; jamais escrever `bank_transactions` de origem como categoria.
3. Resolver pai/filho pelo catálogo D05 real (14 categorias/61 subcategorias/67 SVGs); nunca gerar nova categoria ou usar `palette[index]`/emoji como identidade canônica.
4. Lógica verificável: 5 correções coerentes independentes em 3 datas (provisório), aliases exatos aprovados e `evidenceVerdict` I2-E `high`; **sem percentual de confiança inventado e sem LLM** no motor atual.
5. Consentimento por conta, período, expiração, revogação e estado stable/experimental. P0: a primeira concessão **não desencadeia apply** sem prévia e confirmação autônoma.
6. Escritas `apply` / `correct` / `undo`: BACKUP SQLite íntegro e válido, `BEGIN IMMEDIATE`, revalidar durante transação, dedup/idempotência, recibos, rollback, feedback tombstone. Não afirmar “sucesso” antes do retorno.
7. UI não deve oferecer pausa real sem uma flag/IPC correspondente persistente; distinguir revogar de pausar.
8. Não acionar API do banco nem pagamentos apenas para UI; leitura e integração nos IPC existentes, mudança backend mínima e supervisionada.

## 5. Mapa de implantação sem novos motores

| Superfície | Reutilização / código | Lacuna |
|---|---|---|
| Configuração | `bankAutoStatus`, `bankAutoConfigure`, `bankAutoRevoke`, MAIN nativo | Desacoplar opt-in da primeira aplicação |
| Análise e prévia | `D05AutoCategorization.plan()`, IPC sob guarda, D05 picker existente | Expor prévia limitada e ligar confirmação a token/snapshot revalidado |
| Painel pós-aplicação | `bankAutoStatus`, D05 movements, review list, B05 | Paginador/recibos reais; sem números fictícios |
| Laboratório de regras | `bankAutoRuleSuggestions`, regras D05 existentes | Aprovação humana explícita / resolver de precedência |
| Auditoria/reversão | `bankAutoReceipt`, `bankAutoUndo`, `bankAutoCorrect` | Filtros/eventos reais; não criar undo de lote |
| Estados de segurança | `bankAutoStatus.available`, sync status, erro nativo | Pausa granular só se persistida no MAIN; reparação idempotente |

## 6. Testes P0 para liberar a 1.0.0

- [ ] Autorização das contas nunca aplica sem prévia + confirmação independente.
- [ ] Contas, datas, sessão, estado `stablePackaged`, expiração e revogação tratados.
- [ ] Lote parcial/falha/retomada não duplica contagem, escrita ou recibo.
- [ ] `POSTED` vs `PENDING`, split/transfer/ignorado, duplicatas (#104), reviews manuais e regras conflitantes.
- [ ] Categoria/subcategoria real do catálogo; recorrências sem inferência falsa.
- [ ] Prévia reconciliada com plano revalidado no MAIN e recibos após commit; alterações concorrentes abortam o plano.
- [ ] Aplicar/corrigir/desfazer atômicos e reversíveis com backup íntegro, rollback e tombstone.
- [ ] Regra sugerida não é aplicada sem decisão humana; navegação B04 e D05 preservada.
- [ ] Estado `available=false` bloqueia de verdade controles de escrita, sem bypass experimental.
- [ ] Node 22/SQLite real, `npm run test:db`, TS, Electron, preload/ASAR/F08, Windows (1366/1920, zoom 125/150%), keyboard/focus, dark/light/reduced-motion, smoke com conexão Pluggy e 630+ registros.
- [ ] Status de cada teste publicado `PASS/FAIL/NOT_RUN` e SHA exato, sem herdar PASS de outro PR.

## 7. Gate, ownership e entrega

**Próximo executor único de código:** partir do HEAD atual da cadeia **#94 → #96 → #100 → #104**, resolver conflitos/integração de PRs, sem coedição cega; testar base e corrigir o fluxo de prévia antes do refactor visual. Registrar evidência no issue #71 / QA #65 / ownership #49. Preservar o workstream #57 de design. Não editar `electron/main.cjs`, `preload.cjs` ou migrações sem coordenação e regressões concretas. Nenhum EXE, merge `main`, tag ou GO apenas por aprovação visual.

**Status no fechamento deste documento:** `BATCH_UX_SPEC_READY / APPROVED_SUBSCREENS_PRESERVED / CODE_EXISTING_IN_DRAFT_PRS / FIRST_RUN_PREVIEW_MISSING / QA_NODE_WINDOWS_NOT_RUN / EXE_NO_GO`.
