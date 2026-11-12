# Q1 — evidências reais do Electron

Imagens JPEG preservadas do Computer Use Windows; somente perfil e SQLite fictícios. Sem geração, composição ou emulação de viewport. Dimensões efetivas, tema e SHA/estágio estão em [captures.json](captures.json). Capturas iniciais1366×767 e1920×1032 permanecem identificadas como tal; as finais incluem1366×768 e1920×1080 (F11 nativo). A alteração final9e4b1a8 é no main/recuperação; renderer/estilos são idênticos aos retestados em810a2bc.

## Comparações principais

| Problema / fluxo | Antes | Depois / resultado |
| --- | --- | --- |
| Filtro de outra conta conservava lista antiga | [Lista antiga selecionável](1920-native-light-filter-stale-before.jpg) | [Lista invalidada com aviso](1366-light-filter-invalidated-after.jpg), [aplicação correta](1366-light-account-filter-applied.jpg) |
| Prévia de edição sem categorias | [Sem detalhes](1920-light-rule-edit-missing-details-before.jpg) | [Categoria anterior/nova, conta e natureza](1366-light-rule-edit-details-after.jpg) |
| Expansão do drawer permanecia na Central | [Resultado incorreto](1920-light-chat-expanded-continuity.jpg) | [Chat principal](1366-light-chat-expansion-fixed.jpg), [mensagens e contexto preservados](1366-light-chat-continuity-fixed.jpg) |
| Marca cortada em1366 | [Inicial](1366-light-overview-before.jpg) | [Marca inteira](1366-light-brand-after.jpg) |
| Alerta do simulador com borda verde | [Inicial](1920-native-light-simulator-result.jpg) | [Borda warning](1920-dark-simulator-warning-after.jpg), [CSS computado](after-styles-dark.json) |

## Operações e persistência

[Regra futura: prévia](1366-light-future-rule-preview.jpg) · [Recibo](1366-light-rule-receipt.jpg) · [Lote de2](1366-light-batch-preview.jpg) · [SQLite antes do undo](sqlite-before-undo.json) · [SQLite depois do undo](sqlite-after-undo.json) · [Edição gravada e pausa](1366-light-rule-paused.jpg) · [Reinício preserva decisões](1366-light-review-restart-persistence.jpg) · [Backup salvo pela UI](1920-dark-ui-backup-saved.jpg) · [Recibo no código final9e4b1a8](1920-light-final-sha-confirmation.jpg) · [Auditoria SQLite final](sqlite-final.json).

O lote autorizou exatamente `cafe-4` e `cafe-5`, 1890 centavos cada; undo removeu esses overrides e preservou a classificação individual autorizada de `other-cafe`. Regra futura não mudou histórico. A marcação de revisão não mudou categoria. Testes reais de IPC/SQLite verificaram importações futuras, reimportação, escopos, override humano, stale, rollback e dupla confirmação; não confundir esses testes com cliques de UI. [Gates executados](validation.json).

## Matriz visual e interações

- Central: [1366 claro](1366-light-review-restart-persistence.jpg), [1366 escuro](1366-dark-review-queue-final.jpg), [1920 claro no código final](1920-light-central-final-sha.jpg), [1920 escuro](1920-dark-review-queue-final.jpg), [segunda página com23 registros](1366-dark-review-second-page.jpg).
- Hover da despesa escura: [normal](1920-dark-expense-normal.jpg) → [hover](1920-dark-expense-hover.jpg) → [retorno](1920-dark-expense-return.jpg). Vermelho preservado. Sequência clara inicial também consta no manifesto; nenhum defeito semântico de hover reproduzido nessa métrica.
- [Visão geral](1920-dark-overview-final.jpg), [movimentações e lançamento persistido](1920-dark-movements-final.jpg), [planejamento persistido](1920-dark-planning-final.jpg), [drawer](1920-dark-planning-drawer.jpg), [orçamentos/B3 e limite zero](1920-dark-b3-exceeded-final.jpg), [simulador](1920-dark-simulator-warning-after.jpg), [contas](1920-dark-accounts-final.jpg), [navegação conta→movimentações](1920-dark-account-to-movements.jpg), [configurações](1920-dark-settings-final.jpg).
- Smoke do código final9e4b1a8: [1366 escuro](1366-dark-final-sha-smoke.jpg), [1920 escuro](1920-dark-final-sha-smoke.jpg), [1920 claro](1920-light-final-sha-smoke.jpg).

Não há captura de restore pessoal completo, instalador ou build Windows. O diálogo de restore sintético foi cancelado; a recuperação completa foi testada em contrato automatizado com SQLite real. Os diálogos nativos de arquivos que mostravam pastas do computador não foram exportados para este PR.
