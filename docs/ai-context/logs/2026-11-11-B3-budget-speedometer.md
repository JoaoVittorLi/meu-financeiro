# Meu Financeiro 2.0 — B3 | Velocímetro semicircular com cor progressiva

**Data:** 11/11/2026. **PR:** #39, branch `feat/mf2-int1-ai-workbench-integration-20261111`. **HEAD anterior:** `b764d523335bf86796c5a221b002b974aa9eeea1`. **Status:** código publicado + QA sintético; CI Linux oficial e Electron real ainda NÃO executados.

## Implementação técnica

**Escopo exato:** apenas `renderBudgets()`, nos cards de **Gastos** em categorias de despesas com `hasLimit && limit > 0`. Receitas, categorias sem limite, limite explicitamente zero, filtros, pesquisa, origem manual/bancária, meses, recorrência, fonte parcial, estados vazios e editor continuam com seus contratos de origem.

- `src/app.ts`: `budgetB3Color(percent)` interpola **uma única cor RGB** em pontos fixos (0/10 verde, 25 lima, 50 amarelo, 70 laranja, 90 coral, 99 vermelho-coral, 100 vermelho). A interpolação é feita pela porcentagem de uso, **não ao longo do comprimento do arco**. `budgetB3Visual(spentCents,limitCents)` calcula apenas parâmetros de exibição; retorna `null` para limite zero/inválido, mantém `percent=Math.round(raw)` sem limitar o rótulo e aplica `fill=Math.min(100,raw)` e cor vermelha saturada após 100%.
- No JSX do card, a barra horizontal de despesas com limite positivo foi substituída por SVG semicircular `M 14 96 A 86 86 0 0 1 186 96` com `pathLength=100`. São **um caminho de trilha neutra e um único caminho de preenchimento** sobre a MESMA geometria; nenhum segundo anel ou barra. Em 0% não há caminho de preenchimento; >100% preenche apenas 100% do arco, mantendo rótulos reais 106%, 150% etc. Mostra nome/ícone/situação, gasto, limite, restante/excesso e botão original `Editar limite`. O grupo tem rótulo ARIA com percentuais e valores em reais; SVG decorativo fica oculto do leitor de tela.
- `app/decisions.css`: layout B3 compacto e responsivo, cor via variável `--mf-budget-b3-color`, `stroke` sólido (sem gradiente espacial), transições suaves do `stroke-dasharray` e do tom em 380ms, `prefers-reduced-motion` desliga a transição. Sem nova moldura externa. Preserva V1.3 e as correções V1.2.
- **Limite R$ 0:** sem velocímetro, sem barra de progresso inventada, sem percentual financeiro fabricado mesmo quando o gasto é zero; mantém distinção entre limite zero e limite ausente.
- **Dados:** `getAmount()`, `summary`, cálculos de totais, `budgetPresentationOrder`, `u3BudgetSignals`, `suggestLimit`, callbacks originais de edição, tipos de fonte e contratos financeiros **inalterados**.

## Testes executados

1. **55/55 PASS, 0 FAIL em harness V8 isolado:** 22 testes B3 versionados (dinâmica das funções e `renderBudgets()` reais extraídos de `src/app.ts`; dez percentuais 0/10/25/50/70/90/99/100/106/150; limites zero/ausente; reais em centavos; sem arco extra; receitas; fonte manual/bancária parcial; botão Editar) + 33 contratos anteriores V1.3/V1.2/V1.1/D1.5. O harness usa removedor controlado de sintaxe TS para os blocos analisados; **não é a execução oficial `node --test` nem `tsc`**.
2. **Chromium headless real com HTML sintético (não Electron):** 4 matrizes de 10 cards cada, temas dark/light, 1366×768 e 1920×1080. Validado `getComputedStyle(path).stroke` para os RGB definidos; `stroke-dasharray` proporcional, número de caminhos (trilha+preenchimento ou apenas trilha em 0%), rótulo real acima de 100%, sem scroll horizontal, nem colisões entre cartões. Todas as 4 matrizes **PASS**.
3. Teste de animação em Chromium na fixture: atualização 10%→99%; após 180 ms `stroke-dasharray` estava entre os extremos (95.0457px vs inicial 10px e final 99px) e RGB intermediário `rgb(183,96,86)`; após 420 ms chegou a `rgb(224,72,79)`. Com reduced-motion, `transition-duration:0s`; **PASS**.
4. **8 capturas PNG**: quatro grades completas, antes/depois em 90%, comparação lado a lado e card 99% light. Imagens de `/mnt/data/b3_visual/` e manifesto/JSON entregues ao proprietário na conversa como `evidencias_b3_sinteticas.zip`. Antes usa reconstrução sintética da barra antiga, depois reproduz o markup/CSS do B3. **NÃO são capturas Electron real.**

## Pendências / bloqueio de liberação

- **Não executado:** CircleCI `preflight_on_demand` no HEAD final, compilação oficial TypeScript, Node/SQLite/financeiro completo, F08/proveniência, ASAR, smoke Electron 8 áreas e screenshots autênticas do aplicativo instalado. Terminal sem checkout do repositório, sem conexão GitHub de rede/CI com permissões CircleCI.
- Preflight **Linux apenas:** branch `feat/mf2-int1-ai-workbench-integration-20261111` com `run_preflight=true`, `run_windows_build=false`. Registrar SHA exato, URL, ID e logs; corrigir apenas falhas reais e repetir.
- Homologar o B3 no Electron instalado em 1366×768/1920×1080, temas, categorias com nomes longos, edições, fonte bancária parcial, limite zero e sem limite, acessibilidade; verificar geometria e ausência de colisões, capturas verdadeiras antes/depois. DPI Windows 125% só após autorização.
- **Decisão: BLOCKED para Windows Preview.** PR #39 segue Draft; não gerar instalador, não acionar runner Windows, não fazer merge nem deploy Cloudflare Production.

