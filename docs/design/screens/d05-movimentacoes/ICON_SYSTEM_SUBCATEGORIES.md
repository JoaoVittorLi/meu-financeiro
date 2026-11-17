> **Aprovação do proprietário (13/11/2026):** “Muito bem! [...] categorias e subcategorias [...] 100% aprovadas.” Congeladas as **14 categorias-pai, 61 subcategorias, pictogramas SVG e cores**. **Isso NÃO significa código funcional implementado**. Executor deve concluir issue #74 com SQLite/IPC/IA, migração e QA. [Relatório dos problemas identificados](BUG_REPORT_AND_IMPLEMENTATION_GATES.md).

# D05-SUBCAT · Sistema de ícones premium — Categoria / Subcategoria

**Estado:** `DESIGN_APPROVED / ENGINEERING_REQUIRED`. Requisito de implementação real: [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74). Design D05: [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70). Catálogo: [SUBCATEGORY_TAXONOMY_V1.json](SUBCATEGORY_TAXONOMY_V1.json).

## Origem da solicitação e problemas confirmados

Captura fornecida pelo proprietário: valor `Saídas confirmadas` aparece escuro sobre o dark, e vários textos perdem contraste. `src/app.ts` guarda `EMOJI_OPTIONS` e `BUILTIN_EMOJIS` como Unicode; no Windows eles variam por fonte/emoji renderer e não têm mesma linguagem visual.

Feedback já incorporado na D05 V1.1: despesas vermelhas, receitas verdes; fontes principais sempre tokens `--text`; ícones vetoriais em quadrados arredondados e tonalidade específica. O novo pedido é expandir a **família por categoria-mãe**, criando ícones específicos para cada **subcategoria** e exigindo modelo real no código.

## Hierarquia visual

- **Categoria-mãe:** identidade ampla + cor-base; ícone em 24px, container 44×44, raio 13px.
- **Subcategoria:** símbolo mais específico + variante de matiz dentro da família; ícone 19–21px em container 36–40px com raio 11–12px. **Cada subcategoria possui uma cor própria**; ainda se reconhece que pertence ao pai.
- **Linha de movimentação:** ícone da subcategoria se preenchida; caso contrário, ícone da categoria-mãe e label `Sem subcategoria` opcional. Texto da linha mostra `Categoria › Subcategoria` quando útil, sem poluir o extrato.
- **Picker hierárquico:** coluna de categorias à esquerda/primeira etapa → filhos à direita; item de topo `Sem subcategoria` representa `null`, não entidade persistida. Busca por ambos, foco/teclado, empty-state e opção `Criar subcategoria` habilitada só com permissão manual.
- **Editor:** categoria principal selecionada, nome filho, ícone e cor separados; prévia instantânea. Mudar pai exige confirmação e validação de associação dos registros.
- **Resposta IA D02/D03:** componentes VR / insights podem mostrar ambos os níveis usando mesmos `iconKey`, não desenhos especiais duplicados.

## Palette — 14 cores-mãe

Todas as identidades são **apenas taxonomia** e não denotam renda/despesa. A base de matiz do JSON deve ser tratada como tokens; a subcategoria deriva cor própria de `hue` armazenado.

| Categoria | Matiz HSL sugerida | Família |
|---|---:|---|
| Moradia | 264° | violeta |
| Alimentação | 26° | laranja |
| Transporte | 205° | azul |
| Saúde | 166° | turquesa |
| Lazer | 332° | rosa |
| Educação | 231° | índigo |
| Assinaturas | 282° | lilás |
| Compras | 37° | dourado |
| Contas | 193° | ciano |
| Outros | 215° | cinza-azulado |
| Salário | 151° | esmeralda |
| Transferências | 203° | azul-neutro |
| Rendimentos | 135° | verde |
| Reembolsos | 174° | verde-água |

**Derivação visual de protótipo** (ajustar na implementação para WCAG AA):

```css
/* Hue e iconKey vêm do registro de categoria/subcategoria, nunca do valor financeiro. */
.mf-category-icon {
  --hue: 26;
  --icon-color: hsl(var(--hue) 77% 72%);
  display:inline-grid;place-items:center;
  width:40px;height:40px;border-radius:12px;
  color:var(--icon-color);
  border:1px solid color-mix(in srgb,var(--icon-color) 25%,var(--border));
  background:color-mix(in srgb,var(--icon-color) 15%,var(--surface2));
}
[data-theme="light"] .mf-category-icon { --icon-color:hsl(var(--hue) 65% 37%); }
.mf-category-icon svg { width:21px;height:21px;fill:none;
  stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round; }
.mf-money-out { color:var(--red)!important; }
.mf-money-in { color:var(--green)!important; }
.mf-money-transfer { color:var(--muted)!important; }
.mf-text-primary { color:var(--text)!important; }
@media(prefers-reduced-motion:reduce){.mf-category-icon{transition:none}}
```

**Regra inegociável:** categoria-mãe Alimentação pode ser laranja mesmo com entrada/estorno; o valor da operação usa verde/vermelho pelo `nature`/status. Não usar `accent` para dizer se foi despesa. Ícones e fundos nunca carregam o único sinal de significado: sempre rótulo textual legível.

## Registro dos pictogramas

O catálogo define `iconKey` por item, não `emoji`. Cada chave deve resolver para SVG local de traço consistente (24×24 viewBox, stroke 1.75, sem emoji de sistema, sem asset remoto). Um mesmo símbolo pode ser reutilizado em contexto diferente, mas o filho mantém **chave e cor próprias**.

```ts
type IconKey = string; // validar contra registro local fechado no produto
type CategoryIconProps = {
  categoryId: string;
  subcategoryId?: string | null;
  size?: 'sm'|'md'|'lg';
  accessibleLabel?: string;
};
// Icon Key → SVG (preferir registry TS local, com fallback único).
// Zero URLs externas e zero fontes personalizadas obrigatórias.
```

**Observação sobre stack real:** o `package.json` da branch PR#54 tem Electron 45, TypeScript 5.8, node:sqlite e **não tem `lucide` nas dependências**. O Executor deve criar biblioteca SVG local (pictogramas próprios ou biblioteca open-source licenciada incorporada e auditada), não assumir que a dependência Lucide existe. Sem fonte de emoji, sem CDN, sem emoji Unicode como UI final. Mantém `emoji` antigo em banco durante migração e fallback, sem apagar preferências.

## Acessibilidade / estados / animações

- Contraste texto normal mínimo 4.5:1, ícone e borda interativos 3:1 no fundo real; validar laranja, amarelo, rosa, ciano nos temas escuro/claro. Tamanho de alvo >=40px, foco visível, nomes por ARIA.
- Não depender só da cor para diferenciar Supermercado, Delivery e Restaurante.
- Estado selecionado usa borda + check; hover sutil 120–170ms, expansão painel 180–240ms; reduced-motion desliga.
- Tokens `--bg, --surface, --surface2, --text, --muted, --green, --red, --border` vindos de `app/design-system.css`, sem paleta roxa antiga de branding.
- Caso `iconKey` de categoria custom desconhecida, renderizar SVG fallback neutro (shapes/tag); nunca uma caixa vazia ou símbolo invisível.
- Icons não são decoração da lista inteira: o símbolo de subcategoria pode substituir o pai no extrato, e o pai continua distinguível no breadcrumb/tooltip.

## Catálogo alvo

**14 pais / 61 filhos propostos**, detalhados com IDs, nomes, iconKeys e hue no JSON. Inclui Moradia (Aluguel, Condomínio, Energia, Água, Internet, Manutenção), Alimentação (Supermercados, Delivery, Restaurantes, Cafeterias, Feiras), Transporte (Combustível, App, Público, Estacionamento, Manutenção), Saúde, Lazer, Educação, Assinaturas, Compras, Contas, Outros, Salário, Transferências, Rendimentos, Reembolsos.

`Sem subcategoria` não é filho persistente: é filtro para `subcategory_id IS NULL`. Usuário pode criar filhos próprios com glyphs do registry e tonalidades da família ou personalizadas, respeitando contraste.

## Escopo de engenharia inadiável

Ícones no catálogo não bastam. A implementação D05 só estará pronta quando `subcategoryId` estiver persistido na transação, disponível em API/IPC, filtável, agregado corretamente, mapeado por regras e revisões de IA, seguro em backup/restore e renderizado nas telas D01–D05 e Planejamento/Orçamentos.

Ver checklist bloqueante em [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) e [SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md](SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md). **Não declarar o visual como implementação concluída.**
