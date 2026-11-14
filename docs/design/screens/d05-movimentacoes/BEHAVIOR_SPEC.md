# D05 — BEHAVIOR SPEC / Contrato de UI e Finanças V1.3

**Design aprovado (13/11/2026).** Produção `NOT_IMPLEMENTED` nesta branch. Documento detalha **o comportamento requerido no Electron**, não garante backend existente.

## Estados e DTOs
```ts
type CategoryTarget={categoryId:string;subcategoryId:string|null};
type Movement={
 id:string; source:'bank'|'manual'; accountId:string; amountCents:number;
 date:string; kind:'income'|'expense'|'transfer'|'ignore';
 bankStatus:'POSTED'|'PENDING'|'MANUAL';
 reviewed:boolean; categoryId:string;subcategoryId:string|null;
 revision:number;
};
type ReviewPreview={movementId:string; revision:number; category:CategoryTarget; bankStatus:'POSTED'};
type BatchPreview={movementIds:string[]; revisions:Record<string,number>; target:CategoryTarget; affectedCount:number; beforeAfter:unknown};
```
Use IDs estáveis fornecidos pelo serviço. Um filho só pode pertencer ao pai selecionado; após trocar pai, limpar o filho antigo e pedir nova seleção. “Sem subcategoria” é `null`, nunca registro criado artificialmente.

## Tabela de estados
| Fonte | Banco | Revisada | Lista | Conferência |
|---|---|---|---|---|
| Banco | POSTED | sim | nenhum indicador | detalhe informativo |
| Banco | POSTED | não | ponto azul ao lado do nome | popover individual, aprovação explícita |
| Banco | PENDING | qualquer | relógio discreto | **não** entra na fila apta, não marcar automaticamente |
| Manual | MANUAL | sim/não | origem Manual nos metadados | revisão manual conforme contrato existente, sem fingir banco |

**Semântica:** `needsReview = source==='bank' && bankStatus==='POSTED' && !reviewed`. `PENDING` e `reviewed` não são a mesma dimensão. O status `Confirmada` fica no detalhe, não aparece como badge redundante na linha. Tratamento PENDING→POSTED deve reconciliar IDs sem criar movimento duplicado.

## Fluxos e eventos
**Revisão individual:** ponto azul → carregar snapshot e revisão → conferir dados no popover → `Marcar como revisada` explícito → `reviewMovement({id,expectedRevision})` → resposta commit → sumir ponto, atualizar fila/métrica. Se `STALE/NOT_FOUND/PENDING/ACCESS_DENIED`, impedir escrita, preservar tela e indicar correção/atualização. `Agora não` fecha sem mudar nada. `Corrigir categoria` entra no picker preservando a movimentação.

**Categoria individual:** clicar no **ícone vetorial** → lista de pais/busca → escolher pai → mostrar filhos daquele pai e `Somente pai` → prévia `antes → depois` → `Confirmar classificação` → MAIN valida `categoryId`, `subcategoryId`, perfil, movimento e versão; grava override local (banco) ou linha manual; refresh. Cancelar/Escape/clique fora descarta draft. Não usar nomes como chave, não sobrescrever fonte Pluggy.

**Lote:** selecionar vários por círculo (`aria-pressed`); barra contextual aparece; clicar Categorizar → escolher pai/filho → prévia de **IDs/nomes/valores/contagem/escopo/fingerprint** → **segundo clique de reconfirmação** → MAIN revalida cada versão e executa transação atômica/idempotente, ou aborta sem mudança parcial. Mudança de conta/período/filtro invalida seleção ou preview e exige nova conferência. Revisar em lote usa mesmo princípio, afetando só IDs `POSTED && !reviewed`; PENDING é ignorado com contagem explícita.

**Criação manual:** dados digitados validam valor positivo em centavos, data, tipo, conta, categoria pai e filho opcional. Inserir uma vez, persistir em perfil ativo e refletir nas métricas sem duplicação bancária. **Importação CSV**: arquivo validado, preview de duplicatas, escopo e origem, confirmação antes de commit, manter last-import fingerprint, nunca importar silenciosamente.

**Regras automáticas:** criação via UI ou IA exige listar previamente TODOS os registros que seriam afetados, seus valores, categorização antes/depois, escopo `histórico/futuro`, exclusões e contagem, versão/fingerprint, consentimento e reconfirmação. A IA **não tem autorização de escrita pessoal** apenas por ter permissão IC-READ.

**Navegação e filtros:** tabs `Todas / A conferir / Revisadas`; pesquisa por merchant/categoria; origem, conta, mês, natureza, ordem, agrupamento; mesma snapshot para card, contador e lista. Card `A conferir` abre fila. Data agrupada: somente data e linha; sem contador por dia. `Agrupar por dia` é switch premium 31×18 e não checkbox SO. Seleção múltipla com círculo custom e hit target >=38px.

**Totalizadores em centavos:** entradas = soma de `kind=income, bankStatus!=PENDING` no escopo; saídas = soma absoluta de `kind=expense, bankStatus!=PENDING`; `transfer`/`ignore` excluídos de ambos; resultado = entradas – saídas (**não saldo**). Produto deve explicitar quando há mistura de fontes bancária/manual ou cobertura incompleta (não somar duplicados implícitos). O exemplo sintético do HTML para Banco/Novembro/Todas deve ser **R$3.180,00 entradas; R$1.788,80 saídas; R$1.391,20 resultado; 5 revisões elegíveis**, com Uber PENDING excluído de E/S e da revisão.

## Erros / UX resiliente
- Sem dados → empty+limpar filtro; não inventar cards.
- Carregamento → skeleton, inputs desabilitados para writes; stale/denied → atualizar/explicar.
- Keyboard: Tab, Enter/Space, Escape, foco devolvido; popover ancorado e reposicionado ao viewport. `prefers-reduced-motion`.
- Ao alternar tema/filtro, não perder campos digitados de outro fluxo ativo sem aviso; não fechar sobreposição crítica enquanto confirmação pendente sem descartar explicitamente.
- A regra de revisão fica vinculada ao ledger, não ao LLM; D04 permanece a central de confirmações supervisionadas.
