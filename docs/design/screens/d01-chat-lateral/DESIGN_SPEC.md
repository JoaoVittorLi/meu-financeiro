# D01 — Chat Lateral Premium | Design final V4.5

**Estado:** DESIGN_APPROVED pelo proprietário em 13/11/2026; especificação congelada V4.5 após polimento final autorizado.  
**Protótipo canônico:** [prototype.html](./prototype.html).  
**Base de integração:** PR #54, SHA `55de81c03c3171edd0b325eb66d63630018c23c4`.  
**Coordenação:** issue #56; índice #55; contratos #49; PR Draft documental #57.

## Decisões finais

- Preservar a experiência do Chat Lateral V4.2–V4.4 validada: drawer contextual alinhado à direita, 520 px de largura de referência, canto superior esquerdo arredondado, cabeçalho compacto, histórico contínuo, composer fixo no rodapé, versões claro/escuro e expansão.
- Não mostrar etiquetas de desenvolvedor, banners permanentes de autorização, nem faixa superior com chips `Visão geral / período / dados de teste`. Fonte, período e cobertura apenas em contexto relevante ou no menu `⋯`, com linguagem de cliente.
- Perguntas sugeridas são **follow-ups progressivos**, provenientes do contexto da página, evidências reais autorizadas e histórico da conversa; não repetir perguntas consumidas. Ausência de evidência implica ausência de sugestão, nunca informação inventada.
- Novo fluxo aprovado: pedido de categoria e regra → proposta conversacional → critérios editáveis → métricas de impacto → seleção por movimentação → casos ambíguos separados → opções de histórico/futuro → **segunda confirmação** → recibo → possível desfazer.
- **Prioridade visual:** nome/ícone da categoria, critério de identificação, resumo dos impactos, lançamentos afetados, alerta contextual, alcance da regra e CTA final. Evitar bordas redundantes e excesso de verde. Verde identifica ação primária ou resultado positivo; despesa permanece vermelha, risco âmbar.
- Edição em modal isolado: trocar cor não apaga nome ou seleção; `Descartar edição` não altera proposta. Recalcular prévia depois de salvar.
- Preview e recibo usam números tabulares, categorias legíveis e valores no padrão `R$ 177,50`; valores de despesas apresentam sinal negativo no contexto das movimentações.
- O aviso `Netflix Gift Card` é contextual, não uma prova universal de que compras similares são irrelevantes. Ele não entra na regra por falta de correspondência inequívoca; pode ser revisto manualmente.

## Estrutura visual

| Elemento | Requisito |
|---|---|
| Sidebar | Mesma hierarquia do app: CONTROLE, ORGANIZAÇÃO e FERRAMENTAS |
| Cabeçalho | Ícone ✦, “Assistente Financeiro”, subtítulo contextual e ações Nova, ⋯, Expandir, Fechar |
| Mensagem do usuário | Bolha discreta à direita |
| Proposta | Card único com seções separadas por linhas leves, raio 18 px e tipografia hierárquica |
| Categoria | Ícone colorido 44 px; nome 19 px; subtítulo 10 px |
| Impacto | Três métricas: quantidade, valor afetado e casos a conferir |
| Registros | Checkbox individual, descrição, data, categoria atual → proposta e valor |
| Ambiguidade | Aviso âmbar com causa resumida e expansão opcional |
| Escopo | Dois switches separados: compras anteriores e próximas compras |
| Confirmação | Modal com resumo e caixa de autorização desmarcada por padrão |
| Recibo | Estado confirmado, total alterado, link de detalhes e Desfazer quando viável |
| Composer | Fixo; conversa não deve ser substituída por formulário |
| Motion | 140–250 ms, movimento sutil; `prefers-reduced-motion` |

## Paleta (fontes atuais do produto)

**Dark:** background `#141414`, surface `#1a1a1a`, surface2 `#202328`, stroke `#303034`, texto `#fafafa`, verde `#53d896`, vermelho `#ff7a88`, âmbar `#f5bc63`.  
**Light:** background `#f4f4f6`, surface `#ffffff`, surface2 `#f4f4f5`, stroke `#e5e5e8`, texto `#171717`, verde `#087e49`, vermelho `#c92a3c`, âmbar `#975b00`.

O protótipo é uma **demonstração com fixtures sintéticas**. A aprovação visual não prova equivalência pixel a pixel com a V3 original (HTML V3 não localizado), nem autoriza escrita financeira real.

**Mudanças de design não autorizadas ao executor:** substituir identidade, trocar semântica das cores, adicionar banners técnicos, eliminar segunda confirmação, esconder lançamentos afetados, incluir ambiguidades automaticamente, trocar ações reais por botões fictícios.
