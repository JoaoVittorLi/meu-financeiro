# Meu Financeiro 2.0 — Rodada B03/B04 · Design em revisão
**Estado:** DESIGN_IN_REVIEW / NOT_APPROVED / CODE_NOT_STARTED · 16/11/2026
**Dependências:** [Handoff B01/B02 aprovado](./QA_EXE_B01_B02_APPROVED_20261116.md), [identidade visual global D05](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md), issue #84, D05 V1.3 #70/PR #57, integrador PR #76.

## B03 — Identidade única ao navegar entre movimentações
- Layout deve continuar **tela D05 completa**, com métricas, filtros e histórico no painel principal. Lista usa ícone/hue por categoryId/subcategoryId, jamais por kind; descrição, data, categoria, subcategoria, valor e status preservados.
- **Detalhe real abre em GAVETA LATERAL DIREITA (overlay)**, jamais em coluna fixa, card abaixo do histórico ou página separada. O detalhe repete o MESMO descriptor (ícone, cor, pai/filho) da lista, sem exibir emoji alternativo. Fechar via X/Escape e voltar à lista no mesmo scroll/filtro.
- Categoria agregada mostra pai; transação com filho mostra filho; sem subcategoria usa pai; legado/unknown tem fallback estável sem mutação.
- **Clique diretamente no ícone da linha abre B04** (atalho principal já existente em `src/d05-movements.ts` `.d05-row-icon` → `openPicker(e,r)`); clicar no NOME/corpo abre o detalhe lateral (`host.openBankDetail` / `host.openManualDetail`). Os alvos são distintos, sem propagação equivocada. O ícone na gaveta também pode abrir a mesma classificação. Alterar classificação usa IDs e prévia supervisionada antes da confirmação. Status POSTED/PENDING, manual/banco, natureza e revisão são dimensões distintas de identidade.
- Evidência necessária: Netflix sub:assinaturas/streaming = tv hue270 em toda vista; Spotify music = headphones hue277; pai Assinaturas = repeat-2 hue282. Re-render somente após sucesso real.

## B04 — Seletor D05 que aproveita o desktop
- **Seletor abre ANCORADO no clique do ícone quando houver espaço**, de forma leve e contextual; pode se transformar em modal flutuante central em viewport estreito ou quando prévia exigir espaço. Não substituir o detalhe lateral por seletor. Evoluir portal 355px para layout adaptativo até ~720px, 4 colunas de pais em desktop, 3 no intermediário, 2 no mobile; 14 pais visíveis sem scroll interno normal.
- Pesquisa de nome em pais E filhos (accent-insensitive), resultado filho identificado por nome do pai. Etapa pai → subcategoria (opção somente pai) → prévia Antes/Depois → confirmação quando contrato permitir.
- Usar resolver global dos 67 SVGs, não emojis isolados; 61 filhos preservados e nenhum novo catálogo.
- Responsividade e foco/teclado/Escape/restauração de foco, modal com limite 90vh e scroll apenas quando necessário. Preservar gestão de foco existente no D05 e validação do serviço.
- Classificação em lote: previewVersion, escopo, linhas afetadas e reconfirmação. Sem gravar dados pessoais por UI demo.

## Registro de feedback corretivo 16/11/2026
- Protótipo B03/B04 anterior foi rejeitado: colocou detalhes em coluna fixa/abaixo, divergindo do drawer lateral real, e omitiu a edição pelo próprio ícone.
- A solução visual deve reproduzir os caminhos existentes: **ícone = classificar**, **linha/estabelecimento = detalhes na direita**, **drawer = leitura/revisão com mesmo ícone**.
- O protótipo corrigido continua `DESIGN_IN_REVIEW`, sem execução no Electron.

## Aprovação e QA
- Protótipos B03/B04 demonstrativos aguardam feedback do proprietário; B01 V3/B02 V7 permanecem congeladas.
- QA futuro obrigatório: Electron 1366x768 e 1920x1080 dark/light, 390px mobile futuro, nomes longos, valores grandes, missing IDs, stale preview, POSTED/PENDING, keyboard, reduced-motion.
- Nenhuma alteração em produção, CircleCI, build Windows, merge ou escrita pessoal autorizada por esta proposta.
