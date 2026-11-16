# Meu Financeiro 2.0 — Contrato GLOBAL de identidade visual de categorias

**Prioridade:** P1 / bloqueante para B01, B02, B03, B04 e qualquer tela que renderize categoria.  
**Status:** Design aprovado como requisito transversal pelo proprietário em 16/11/2026. Implementação ainda **não iniciada**.

## Problema reproduzido (PR #76)

- Visão Geral `src/app.ts`: `palette[index]` e `categoryColor(name,index)` podem produzir hue diferente da categoria.
- Orçamentos `src/app.ts`: `info.emoji||'✨'` independente do catálogo D05.
- Últimas movimentações `src/app.ts`: `Icon` associado a `kind` (natureza financeira), não à identidade da categoria.
- Detalhes `src/app.ts`: `cat?.emoji||'✨'`.
- D05 `src/d05-movements.ts`: `D05VectorIcon` consome `iconKey,hue` do catálogo.
- Resultado conhecido: **Assinaturas** exibe seta genérica na lista, celular/emoji no detalhe e SVG `repeat-2` no seletor.

## Exigência de produto

**Não mapear emoji, SVG e cor separadamente em cada tela.** O sistema deve possuir um único catálogo de identidade de categoria/subcategoria; cada tela consome uma **única função** que devolve o descriptor visual inteiro. O emoji legado, se ainda necessário, deve vir desse mesmo descriptor, jamais de `info.emoji` independentes ou regras de texto.

### Fonte de verdade

1. `electron/d05-taxonomy.json`: IDs estáveis `cat:*` e `sub:<pai>/<filho>`, nomes, `iconKey`, `hue`, `kind`, `parentId`.
2. `shared/d05-svg-registry.json`: conjunto aprovado de 67 SVGs locais; sem buscar ícones online ou permitir HTML de merchants.
3. Helper existente `src/d05-visual-assets.ts`: preferir estender/extrair para o resolver único, evitando divergência e duplicação.
4. **Uma fonte derivada para emoji legado** por ID, versionada apenas se existir requisito concreto de emoji (migração/compatibilidade/a11y); não usar emoji como artefato principal, nem como chave de classificação.

### API ilustrativa (proposta, não contrato já implementado)

```ts
type CategoryVisualIdentity = Readonly<{
  categoryId: string | null;
  subcategoryId: string | null;
  source: "sub" | "parent" | "custom" | "legacy" | "fallback";
  label: string;
  parentLabel?: string;
  iconKey: string;
  hue: number;
  legacyEmoji?: string; // opcional; sempre resolvido pelo MESMO ID
  kind: "income" | "expense" | "both" | "unknown";
}>;
function resolveCategoryVisualIdentity(input: {
  categoryId?: string | null;
  subcategoryId?: string | null;
  categoryName?: string | null; // somente para legado
  categoryKind?: string | null;
}): CategoryVisualIdentity;
```

**Nunca** resolver o nome quando ID válido está presente. Ordem:
1. Filho válido que pertence ao pai → filho, inclusive icon/hue/emoji se houver.
2. Pai válido → pai.
3. Categoria personalizada com ID e configuração visual válida → descriptor custom estável. **Não** gerar cor por posição/index nem pelo nome.
4. Legado (sem ID) → migrador/mapeamento determinístico existente, somente para exibição; se ambíguo, não classificar silenciosamente.
5. Fallback estável `cat:outros` / `shapes` para categoria desconhecida, com rótulo real preservado e aviso apenas quando relevante.

### COMPONENTE

`<CategoryIdentity identity={resolved} variant="icon|iconLabel|compact" />` consome `iconKey`, `hue`, `label` resolvidos JUNTOS.  
`<CategoryVisualGlyph />` usa SVG local aprovado em vez de emoji por padrão.

- **Vistas agregadas** (Visão Geral por categoria e orçamento principal): **pai**.
- **Vistas transacionais** (últimas, lista, detalhes, pesquisa, revisão): **filho** quando registrado; senão **pai**; senão fallback. Mesma transação ID → identidade idêntica em todos os pontos de exibição.
- **Seletor**: opções pai exibem pai; opções filho exibem filho; escolha retorna `{categoryId, subcategoryId|null}` e não uma string ou um emoji.
- **Gráficos**: `hue` dessa identidade define a cor de categoria (faixa, barra, dot, chips), mas `positive/negative/warning` continuam semântica financeira **separada**.

### Cores canônicas

- Dark: `hsl(${hue} 62% 60%)`. Light: `hsl(${hue} 62% 37%)`. Fundos discretos usando mesmo hue; seguir tokens CSS reais quando houver conflito.
- Exemplos verificados: `cat:moradia` `house` hue 264; `cat:alimentacao` `utensils` hue 26; `cat:assinaturas` `repeat-2` hue 282; `sub:assinaturas/streaming` `tv` hue 270.
- Usar **IDs**, não emoji Unicode ou texto de merchant, como cache key. Recalcular ao alterar categorização e invalidar caches para evitar ícones antigos.
- O conjunto de categorias customizadas também precisa de identidade persistente e validada, sem autoeditar dados pessoais. Não fazer migração em massa apenas para corrigir apresentação.

## Testes de contrato obrigatórios

| Teste | Resultado esperado |
|---|---|
| Assinaturas (pai) em B01, B02, D05 | mesmo `repeat-2` e hue 282 |
| Transação streaming em Últimas, Movimentações, detalhe e revisão | mesmo `tv` hue 270 |
| Transação sem subcategoria | mesmo pai em todas as vistas transacionais |
| `subcategoryId` de outro pai | rejeição/controlado; nunca exibir filho incorreto |
| Categoria personalizada | identidade estável inclusive após reinício e edição |
| Nome de merchant com string "Netflix" mas sem subcategoria | não inferir identidade de streaming |
| Categoria inexistente | fallback SVG determinístico, rótulo original preservado |
| Dark/Light | mesmo hue, contraste apropriado |
| Atualização categoria por usuário | ícone atualizado em todas as views após sucesso confirmado, sem gravação adicional |
| `income`, `expense`, `transfer`, `ignore`, PENDING/POSTED | natureza/status separados, nunca usados para substituir visual da categoria |

## Gate global

Não considerar B01/B02 concluídas em código se só foram substituídos emojis nesses dois componentes e o resto do app continua divergente. O critério de consistência deve ser coberto em **Visão Geral, Orçamentos, Últimas Movimentações, Movimentações completas, Detalhes, seletor, Planejamento, revisões da IA e PWA quando disponível**. Componentes fora de escopo podem receber helper no PR seguinte, mas o rollout e QA transversal precisam ser explicitamente rastreados.
