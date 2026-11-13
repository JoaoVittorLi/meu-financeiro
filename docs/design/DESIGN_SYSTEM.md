# MF2 — Sistema visual aprovado e políticas

Direção geral do produto: [DESIGN_DIRECTION_PREMIUM.md](../ai-context/DESIGN_DIRECTION_PREMIUM.md) na baseline PR #54. D01 aprovado: [TOKENS.json](./screens/d01-chat-lateral/TOKENS.json) e [DESIGN_SPEC.md](./screens/d01-chat-lateral/DESIGN_SPEC.md).

## Base visual canônica

| Token | Dark | Light |
|---|---|---|
| Canvas | `#141414` | `#f4f4f6` |
| Superfície | `#1a1a1a` | `#ffffff` |
| Superfície elevada | `#202328` | `#f4f4f5` |
| Borda | `#303034` | `#e5e5e8` |
| Texto | `#fafafa` | `#171717` |
| Secundário | `#b1b1ba` | `#64646e` |
| Positivo / CTA | `#53d896` | `#087e49` |
| Negativo / despesa | `#ff7a88` | `#c92a3c` |
| Atenção | `#f5bc63` | `#975b00` |

Fonte: `Segoe UI Variable` com fallback `Segoe UI, system-ui`. Raio do drawer 22 px, card 18 px, modal 20 px, botões 10 px. Motion rápido (140–250 ms) e `prefers-reduced-motion`.

## Consistência de experiência

- Nunca criar faixa de metadados de desenvolvimento no topo do chat. Contexto discreto abaixo do título, detalhes de fonte/período sob demanda.
- Usuário fala com um assistente, não com o backend. O campo de mensagem fica fixo, e a confirmação financeira aparece apenas em operação concreta.
- Perguntas de acompanhamento mudam conforme fatos e histórico da conversa: explicação → economia possível → plano → projeção. Não são lista estática nem repetitiva.
- Cores semânticas: aumento de despesas é desfavorável, redução favorável; quando não há base de comparação suficiente, neutro.
- Valores são formatados com `pt-BR`; separar despesa, resultado e saldo bancário.
- Ações condicionais exigem estado (disponível, sem permissão, loading, erro, stale e conflito); nenhum botão operacional fictício no perfil pessoal.
- Modais de edição e reconfirmação têm propósitos diferentes. Salvar rascunho não é autorizar gravação.
- Prévia antes de regra categórica abrange histórico, futuras transações, exclusões, duplicidades, precedência e ambiguidades.
- Aprovado D01 V4.5 **não substitui** desenho das D02–D12. Cada tela deve passar por avaliação própria.

A existência do protótipo não ativa escrita por IA no perfil real. Serviços e transações seguem sob controle do Integrador.
