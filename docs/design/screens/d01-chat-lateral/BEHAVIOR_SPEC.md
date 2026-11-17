# D01 V4.5 — Contrato de comportamento

## Máquina de estados

`COMPOSING` → `PREVIEW_READY` → `EDITING` (opcional; salvar/descartar) → `AWAITING_RECONFIRMATION` → `APPLYING` → `RECEIPT`.  
Caminhos alternativos: `EMPTY`, `DENIED`, `EXPIRED`, `STALE`, `ERROR`, `CANCELLED`, `CONFLICT`; `UNDO_PREVIEW` / `UNDO_RECEIPT` apenas quando serviço permitir.

### Proposta

A IA interpreta um pedido, mas a lista de afetados **não pode ser inventada pelo modelo**. A consulta de avaliação real deve considerar categoria, nomes, padrões, escopo, exclusões, identificadores de transação e precedência. Mostrar número de itens, soma dos valores e detalhes individualizados; se o conjunto estiver incompleto, indicar cobertura parcial.

### Personalização

- Editar nome, cor e descrições usando **rascunho isolado**.
- Descartar restaura todos os campos; trocar a cor não reinicializa nome nem checkboxes.
- Salvar recalcula correspondências e elimina exclusões incompatíveis; invalida consentimento antigo.
- O protótipo V4.5 usa 3 condições determinísticas de demonstração. Regras reais devem usar sintaxe do serviço autorizado e prever conflitos, precedência e overrides manuais.

### Histórico e futuro

- `Organizar compras anteriores` controla exclusivamente a reclassificação da lista selecionada.
- `Categorizar próximas compras` determina a ativação da regra determinística para transações futuras.
- Nunca apresentar atualização histórica como consequência inevitável de ativar regras futuras.
- Desabilitar CTA se o usuário desativar ambos os escopos.
- Registros ambíguos entram em fila de revisão, nunca em aplicação automática.

### Reconferência e atomicidade

- Ao entrar em confirmação, receber um `revisionId`/snapshot gerado pelo serviço.
- Mostrar nome final, critérios de identificação, escopo, contagem e soma, exceções e registros afetados.
- Checkbox **desmarcada** a cada entrada; botão de aplicar inicialmente inativo.
- Mudanças em seleção/fonte/conta/período/regras/categorias revogam autorização anterior.
- Revalidar prévia no servidor imediatamente antes da escrita. Se mudar, interromper e apresentar nova comparação; nunca usar snapshot antigo.
- Categoria + regra + histórico são ações distintas que demandam desenho transacional confiável; nenhuma operação parcial deve ser descrita como sucesso total.

### Recibo/undo

Recibo real contém IDs de categoria, regra e operações aplicadas, escopo, hash/versão da prévia e lista auditável de registros. Desfazer só fica ativo quando serviço indicar elegibilidade, sem sobrescrever alterações posteriores feitas por outra origem. Caso contrário, mostrar explicação e caminho de revisão manual.

### Conversa e UX

- Preservar histórico e rascunho ao navegar/expandir e evitar sugestões repetidas.
- Seguir com perguntas contextualizadas, como “Como economizar com estas assinaturas?”, depois diagnóstico, plano e efeito projetado — sem recomendar economias garantidas.
- Estados loading, erro, vazio, sem permissão, sessão expirada e offline têm mensagens compreensíveis.
- Esc/Escape fecha modal descartando apenas o rascunho de edição; Enter envia mensagem e Shift+Enter quebra linha.
- Testar foco visível, leitura por leitores de tela, largura reduzida e `prefers-reduced-motion`.

O HTML publicado implementa **simulação local**, não as transações reais ou o fluxo completo de estados de backend.
