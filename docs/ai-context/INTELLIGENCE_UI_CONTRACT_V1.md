# MF2 — Contrato compartilhado Inteligência ↔ Redesign — IC v1

**Status:** especificação de integração e inventário de capacidades existentes, **não** prova de implementação dos novos adaptadores. **Owner:** Integrador. Mudanças propostas no issue #49. Base técnica revisada: PR #48 / 810a2bc.

## Princípio "sem botões mortos"

Cada card ou ação que se apresentar como operacional tem: (1) ID e objetivo, (2) origem exata do dado, (3) cobertura/período/perfil, (4) condição de disponibilidade, (5) ação com handler validado, (6) estados carregando/vazio/erro/sem autorização/desatualizado, (7) resposta visível e (8) teste. Um componente apenas conceitual deve estar explicitamente rotulado "Em desenvolvimento", sem CTA falsa. Não usar valores, contadores, indicadores de confiança ou alertas fictícios no perfil pessoal.

## Inventário do código existente — não reconstruir

| ID | Fonte/serviço real (preload IPC) | Situação verificada na baseline | Como UI deve tratar |
| --- | --- | --- | --- |
| IC-READ | localFinancialAuthorize / localFinancialQuery / localFinancialRevoke; electron/financial-intelligence.cjs | Consultas locais **read-only**, com consentimento por fonte, perfil e prazo; intenções radar/category/largest/budgets/commitments/compare/review/purchase | Renderizar fonte, período, cobertura parcial, erro, permissão e revogação. **Não** permitir escrita a partir desse token |
| IC-REVIEW | categoryReviewStatus / Authorize / List / Queue / Prepare / Confirm / Revoke; electron/category-review.cjs | Revisão, padrões, regras futuras e ações **somente no perfil sintético isolado**; status.available é falso no perfil pessoal/empacotado | Mostrar função indisponível para escrita pessoal; nunca simular sucesso. Em perfil sintético, usar prévia real → consentimento → recibo |
| IC-CATS | categoriesStatus / categorySave / categoryDelete; electron/db.cjs | Criação, renomeação/cores/emoji e remoção de categoria disponíveis no editor pessoal atual, com validação no processo principal | CTA "+ Nova categoria" abre fluxo real e preserva contexto da movimentação; não confundir com autorização de escrita por IA |
| IC-RULES | ruleSave / ruleDelete / categoriesStatus; matchRule, upsertRule | Regras determinísticas manuais existentes, scope/prioridade/precedência próprias | Editor real só se o usuário pedir; regras propostas pela IA têm consentimento separado e restrições adicionais |
| IC-MOVE | bankCategorize / bankBatch / bankSplit; FinanceDB | Correções pessoais explicitamente iniciadas na UI, já existentes | Não chamar em nome da IA sem escopo de ação supervisionada aprovado; preservar overrides, natureza e split |
| IC-PLAN | planOverview / planSimulate / planCreate / planEdit / planStatus | Consulta/simulação e edições manuais de Planejamento existentes | Consultas podem alimentar cards; escrever só por fluxo manual validado ou futuro contrato IA aprovado |
| IC-LLM | aiStatus / aiCapabilities / aiRunDemo e integração experimental | A experiência generativa existente é demonstrativa/restrita; **não** equivale a chat financeiro real pleno | Diferenciar resposta determinística, demo e inferência real. Não prometer IA generativa pessoal sem autorização de provedor/custo |

**Observação:** IC-READ "review" lista movimentações não revisadas pela fonte autorizada, mas não é a Central IC-REVIEW de escrita e não garante histórico remoto integral. O cache bankOverview de 2.500 linhas não garante a cobertura de todo SQLite.

## Contrato semântico de apresentação — especificação a implementar pelos executores

Todo card financeiro operacional proposto pelo Executor I DEVE fornecer ao Executor R dados tipados equivalentes aos campos abaixo (nomes finais/type exports serão acordados em PR):
- **id** estável e **kind** (financial_metric / review_inbox / rule_suggestion / budget_alert / commitment / action_receipt / chat_answer).
- **capability**: available_read_only | synthetic_only | unavailable | awaiting_permission | error.
- **source**: bank | manual | planning | synthetic | combined_validated; **profile**: real | demo | synthetic.
- **asOf**, **period**, **coverage**: complete_local | partial_local | unknown; nunca alegar extrato bancário integral sem prova.
- **title**, **description**, **evidence** (origem e critérios verificáveis); **confidence** high/medium/low/unknown apenas para padrões fundamentados.
- **valueCents** apenas quando houver valor financeiro inteiro e origem validada; formato monetário é responsabilidade do renderer.
- **actions[]**: actionId, label, permitted, disabledReason, previewRequired, operationId opcional, handler/protocolo validado.
- **uiState**: loading | ready | empty | denied | expired | stale | error | unsupported.
- **status**: suggested | accepted | edited | denied | deferred | applied | undone | not_applicable, quando representar revisão ou ação auditada.

Este objeto é **especificação**, NÃO afirmar que existe como API TypeScript pronta. Criar adaptador junto da primeira fatia vertical, de preferência em um novo módulo exclusivo do Executor I, com mock estritamente sintético para testes e integração com as APIs acima. Evitar mudar os tipos existentes de src/intelligence-view.ts sem coordenação.

## Matriz de cards ↔ fontes ↔ ação (contrato de aceite)

| ID do card | Dado autorizado a mostrar agora | Ação válida | Proibido |
| --- | --- | --- | --- |
| UI-01 "A revisar" | IC-READ no perfil real e escopo autorizado; IC-REVIEW Queue apenas em sintético; cobertura indicada | Abrir Movimentações filtradas (real) ou Central (sintético) | Mostrar fila sintética como pessoal; usar PENDING bancário como "pendente de categoria" |
| UI-02 "Regras sugeridas" | IC-REVIEW List no perfil sintético | Prévia/editar/aceitar/negar/adiar apenas sintético | CTA "Aceitar" ativo no perfil pessoal sem capability |
| UI-03 "Radar" | IC-READ Query radar com grant | Abrir detalhe/fonte ou filtro real | Inventar alertas, misturar fontes ou declarar previsão sem modelo |
| UI-04 "Orçamentos" | IC-READ Query budgets ou motor canônico existente | Abrir Orçamentos/filtro; edição manual explícita | Ajustar orçamento via IA sem contrato de escrita autorizado |
| UI-05 "Compromissos" | IC-READ Query commitments com escopo planning autorizado | Abrir Planejamento | Chamar compromisso confirmado uma previsão estimada |
| UI-06 "Nova categoria" | IC-CATS; lista real de categorias | Abrir formulário contextual → categorySave por iniciativa do usuário | Perder lançamento atual; criar categoria fictícia em demo |
| UI-07 "Chat financeiro" | IC-READ + IC-REVIEW conforme capability | Consultar, explicar, propor, navegar e preparar ação quando permitida | Chat com botão "executado" sem recibo; texto demo como dado pessoal |
| UI-08 "Recibo/Desfazer" | IC-REVIEW Confirm/recibo em sintético | Undo condicionado ao estado, em sintético | Desfazer mudanças de terceiros ou posteriores sem revalidação |

## Ações e estados — handshake obrigatório

1. **QUERY:** UI solicita fonte, período e escopo; serviço verifica grant, monta evidências/cobertura; UI exibe resultado OU erro/indisponibilidade.
2. **OPEN:** navegação leva diretamente à fila ou ao registro, com filtro correto. Se origem não está disponível, abrir estado informativo sem prometer ação.
3. **PREPARE:** UI recebe proposta ID, diffs, registros afetados, data de expiração; nenhuma escrita aqui.
4. **CONFIRM:** consentimento explícito da operação e perfil; serviço revalida a prévia e aplica atomicamente; UI mostra recibo confirmado (não otimista).
5. **DENY/DEFER/CANCEL:** decisão registrada quando o serviço existir, ou cancelamento local; não executar classificação.
6. **UNDO:** somente se permitido e sem conflito com alterações posteriores; nova prévia e confirmação quando exigidas.
7. **SESSION:** troca de conta/fonte/período/revogação zera seleção e prévia; respostas antigas não podem alterar estado da nova sessão.

Cada evento deve produzir estados para tema claro/escuro, teclado, leitores de tela, carregamento, vazio, erro, offline/sem conta e reduzida animação.

## Mudanças de contrato

Executor I abre comentário "CONTRACT-CHANGE PROPOSED" no issue #49 com ID, motivo, formato, callback/IPC, compatibilidade, risco, teste. Executor R só implementa chamada após definição; enquanto pendente usa UI com capability inativa **sem botão morto**. Integrador publica IC v2 ao aceitar alterações incompatíveis. Nenhum dos dois sobrescreve este documento em paralelo.