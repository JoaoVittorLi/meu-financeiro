# D01 V4.5 — Handoff para Executor de Engenharia

**Decisão:** design aprovado, pacote de especificação pronto.  
**Implementação:** NÃO iniciada por esta branch.  
**Base:** PR #54 (`55de81c03c3171edd0b325eb66d63630018c23c4`).  
**Coordenar com:** integrador issue #49 e issue D01 #56. Não sobrescrever branches compartilhadas nem fazer merge de produto em `main`.

## Artefato canônico

`docs/design/screens/d01-chat-lateral/prototype.html` é a referência de layout e comportamento demonstrativo. Leia `DESIGN_SPEC.md`, `BEHAVIOR_SPEC.md`, `TOKENS.json`, `FIXTURES.json`, `ACCEPTANCE.md` e `CHANGELOG.md` antes de modificar a UI.

## Superfícies existentes

- `src/intelligence-view.ts`: drawer, contexto, composer, mensagens, histórico e navegação ao chat expandido.
- `src/app.ts`: shell, sidebar, categorias, operações manuais, acionamento de IPC.
- `app/intelligence.css`, `app/design-system.css`, `app/style.css`, `app/intelligence-review.css`: estilos e design system.
- `electron/db.cjs`: `categoriesStatus`, `categorySave`, `ruleSave`/`ruleDelete` e categorizações manuais quando autorizadas.
- `electron/category-review.cjs`: caminhos segregados de prévia/revisão **sintéticos**, não concedem escrita IA no perfil pessoal.
- `electron/financial-intelligence.cjs`: consultas locais `read-only` consentidas; não transformar token de leitura em autorização de escrita.
- `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`: IC-READ, IC-CATS, IC-RULES, IC-MOVE, IC-REVIEW, IC-LLM; UI-06, UI-07, UI-08.

## Plano de implementação proposto

1. Reproduzir visual do D01 preservando APIs e estado de conversação/histórico já existentes.
2. Criar adaptador de prévia **read-only** determinístico e auditável para a nova categoria, critérios e histórico selecionado, sobre perfil/fonte autorizados. A IA não decide o conjunto final por texto livre.
3. Distinguir regra futura, reclassificação de histórico e criação de categoria. Mostrar precedência, duplicidade, conflitos, splits, overrides, PENDING/POSTED e escopo.
4. Introduzir serviço formal de transação com `previewVersion`, expiração, revalidação e consentimento contextual por operação. Sem contrato aprovado, manter o botão real de aplicar indisponível e explicar por quê.
5. Aplicar atomicamente quando suportado (ou compensação explícita/testada), persistir recibo e não alegar sucesso completo após commit parcial.
6. Disponibilizar undo somente se serviço garantir reversão segura e auditar conflitos.
7. Rodar testes unitários, TypeScript, SQLite, F08/ASAR/IPC e smoke Electron em 1366/1920 nos temas claro/escuro, com comparação de screenshots. Isolar fixtures do perfil pessoal.

## Matriz mínima de evento → contrato

| Evento | Dados/UI | Contrato/serviço requerido | Gate |
|---|---|---|---|
| Iniciar pedido | contexto/página/conversa | IC-READ, IC-LLM quando contratado | autorização de leitura |
| Propor categoria | nome/cor/termos | IC-CATS + IC-RULES como inventário | não escrever |
| Avaliar prévia | IDs, categorias atuais, naturezas, soma, exclusões, precedência | **novo adaptador read-only** | cobertura comprovada |
| Personalizar | draft isolado e nova prévia | local até salvar draft, depois adaptador | invalidar consentimento |
| Reconfirmar | snapshot, exceções, escopo passado/futuro | **novo contrato de consentimento** | revisão fresca, checkbox |
| Aplicar | categoria/regra/histórico | IC-CATS/IC-RULES/IC-MOVE via orquestração supervisionada | integrador aprovar escrita IA |
| Recibo | IDs de operações aplicadas | serviço de transação + auditoria | após resposta confirmada |
| Desfazer | prévia e conflitos posteriores | novo contrato de rollback validado | não prometer undo indisponível |

## Limites

Não habilitar escrita IA pessoal automaticamente, não fazer deploy Production, build Windows pago, instalador nem merge de `main` sem autorização específica. O HTML é um mock isolado. Refino de design fora do protótipo só mediante questão concreta; não reabrir redesign geral.
