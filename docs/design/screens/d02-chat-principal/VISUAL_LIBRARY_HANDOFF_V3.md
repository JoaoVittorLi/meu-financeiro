# D02 — Biblioteca Visual V3 · HANDOFF UNIFICADO PARA O EXECUTOR

**Estado:** `DESIGN_HANDOFF_CANDIDATE` em 13/11/2026. **Não é release, nem autorização de merge ou escrita por IA.**  
**Issue design:** #58 · **Arquiteto/coordenação:** #49 · **roadmap:** #55 · **D01 referência:** #56.  
**Próxima tela de design:** D03 Inteligência Hoje.

## Escopo fechado desta entrega

Não haverá mais checkpoints de protótipo por microcomponente. Os 26 modelos visuais da IA agora usam **um único Design System**, conforme `VISUAL_LIBRARY_CONSOLIDATED_V3.md` e `VISUAL_LIBRARY_TOKENS_V3.json`. O arquivo `VISUAL_LIBRARY_PREMIUM_V3.css` oferece estilos de referência (não está plugado no Electron). `VISUAL_GALLERY_STAGE2.html` é **histórico**, anterior às correções VR-07/08/09/10 e não é prova de implementação V3.

### Implementações reais vs especificação

- `VR-07 V2`, `VR-08 V1`, `VR-09 V1.1` têm aprovação visual individual registrada.
- `VR-10 V2` foi recebido positivamente e usado como direção global de gradiente e investigação; o HTML interativo daquela mensagem **não foi commitado**. Recriar/validar renderer a partir da especificação, não inventar screenshot canônica.
- As demais 22 famílias passaram a `DESIGN_SPECIFIED_BY_INHERITANCE`, sem fingir aprovação visual individual. O proprietário encerrou o rito de aprovação por microtela e autorizou uma entrega consolidada.
- O próprio Chat Principal D02 (workspace sob demanda) mantém seu conceito V4 aceito; a versão Electron e toda a integração permanecem de responsabilidade de Engenharia.
- Não alterar `main`, não ativar CI pago sem autorização, não gerar EXE, não escrever dados financeiros pessoais pela IA.

## Contrato de componentes e integração

1. Criar `VisualResponseRenderer` único por resposta tipada do contrato `VISUAL_RENDER_CONTRACT.md`, com um registry por `kind` e variantes `compact/standard/analysis/mobile`.
2. Resolver todos os valores de `factRef` a partir de agregadores confiáveis; cálculos em centavos inteiros, com IDs e filtros reproduzíveis. O LLM jamais injeta HTML nem totais sem evidências.
3. Separar `VisualDataResolver`, `VisualPolicyGate`, `VisualRendererRegistry`, `VisualActionDispatcher`. Intenção da IA ≠ consentimento do usuário ≠ autorização do backend.
4. Implementar um único conjunto de tokens, ícones, spacing, contrastes e grade responsiva para as 26 famílias; **não clonar o Chat Lateral no principal**.
5. Heat scale VR-10: somente em ranking por magnitude de **aumento de despesas**. Usar 5 cores ordenadas; normalizar barras por maior variação positiva no escopo, não sobrepor labels. Para demais visualizações, seguir cores semânticas de dado/status.
6. Para `rank/drilldown/table`: selecionar categoria → grupo → registro, breadcrumb, busca/ordenar/filtro com atualização coerente e sem perda de escopo; em layout mobile, empilhar painéis e oferecer touch targets 44px.
7. Para `treemap/sankey`: geometria proporcional de verdade e total conciliado; desenho ilustrativo com medidas arbitrárias é rejeitado. Reutilizar decisões aprovadas VR-07/08.
8. Para `proposal/approval`: importar comportamento D01 V4.5; preview de afetados, exceções, última confirmação, invalidação por mudança, recibo idempotente e undo somente suportado; sem escrita pessoal habilitada por este pacote.
9. Estados gerais `ready/loading/empty/partial/stale/denied/offline/error/conflict/expired/applied/undo unavailable` devem estar no dispatcher. Nenhum botão decorativo inerte nem cor ilegível no dark.
10. Motion somente em mudanças auditáveis e semanticamente seguras: 150ms interação, 200ms entrada, 240ms painel; respeitar reduced motion; se gráfico não tiver pontos reais, não animar “dados”.

## Entrega recomendada da implementação (poucos checkpoints)

**C1 — Fundação+respostas de leitura:** registry, tokens, tipos, fontes e regras, layouts D01/D02 e `VR-01–11` (inclui referências aprovadas). E2E: renderizar 4 superfícies, dados sintetizados e modos com estados adversos.

**C2 — Planejamento+ação supervisionada:** `VR-12–26` e orquestração entre resultados, simulação, proposta e aprovação, mantendo escrita pessoal DESABILITADA. E2E: fontes, previsões, relógio, categorias/regra em modo sintético, recibo, invalidação, rollback demonstrativo; regressão de visual e foco.

> Checkpoints de Engenharia sugeridos, **não código desenvolvido aqui**. Não bloquear a próxima tela de design D03 esperando a implementação dessas entregas.

## Validação de entrega pelo Executor

- Testes unitários de soma/denominador/estado, snapshot de cada renderer + comparação de dark/light. Ver `VISUAL_LIBRARY_ACCEPTANCE_V3.md`.
- Playwright/Electron real nas larguras 1366, 1920, mobile PWA quando houver, e contraste/foco/teclado com reduced motion.
- Registrar capturas **reais do Electron**, PR, branch, SHA, testes passados/falhos, problemas conhecidos e proteção de dados. Não declarar aprovado só por mock HTML.
- Não afirmar portabilidade mobile sem testes; não afirmar autorização financeira por interface.

## Dependências explícitas

- Contratos de leitura e autorização IC-READ; estados de revisão categórica e IC-CATS/IC-RULES; não criar endpoints ou permissões sem aprovação do integrador.
- Fluxo de dados atual de `src/intelligence-view.ts`, histórico e chat compartilhado, estilos de `app/intelligence.css` e `app/design-system.css` devem ser inspeccionados no HEAD real antes da integração.
- Se PR #54/branches dos executores avançaram desde o baseline, consultar HEAD e conflitos antes de alterar qualquer arquivo.

## Encaminhamento

Encerrar o ciclo de protótipos micro de D02. Continuar design macro em **D03 Inteligência Hoje**, respeitando a decisão prévia: não voltar a criar três abas permanentes `Hoje / Conversar / Plano de ação` no chat principal. Preparar D03 para informar e antecipar oportunidades úteis, sem uma dashboard carregada e sem depender de dados não validados.
