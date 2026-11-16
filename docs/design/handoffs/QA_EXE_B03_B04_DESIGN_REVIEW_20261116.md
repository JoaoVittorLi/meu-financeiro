# Meu Financeiro 2.0 — Rodada B03/B04 · Design em revisão
**Estado:** DESIGN_IN_REVIEW / NOT_APPROVED / CODE_NOT_STARTED · 16/11/2026
**Dependências:** [Handoff B01/B02 aprovado](./QA_EXE_B01_B02_APPROVED_20261116.md), [identidade visual global D05](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md), issue #84, D05 V1.3 #70/PR #57, integrador PR #76.

## B03 — Identidade única ao navegar entre movimentações
- Lista usa ícone/hue por categoryId/subcategoryId, jamais por kind; descrição, data, categoria, subcategoria, valor e status preservados.
- O detalhe repete o MESMO descriptor (ícone, cor, pai/filho) da lista, sem exibir emoji alternativo.
- Categoria agregada mostra pai; transação com filho mostra filho; sem subcategoria usa pai; legado/unknown tem fallback estável sem mutação.
- Alterar classificação abre B04 com IDs; prévia supervisionada antes da confirmação. Status POSTED/PENDING, manual/banco, natureza e revisão são dimensões distintas de identidade.
- Evidência necessária: Netflix sub:assinaturas/streaming = tv hue270 em toda vista; Spotify music = headphones hue277; pai Assinaturas = repeat-2 hue282. Re-render somente após sucesso real.

## B04 — Seletor D05 que aproveita o desktop
- Trocar portal 355px por layout adaptativo até ~720px; 4 colunas de pais em desktop, 3 no intermediário, 2 no mobile; 14 pais visíveis sem scroll interno normal.
- Pesquisa de nome em pais E filhos (accent-insensitive), resultado filho identificado por nome do pai. Etapa pai → subcategoria (opção somente pai) → prévia Antes/Depois → confirmação quando contrato permitir.
- Usar resolver global dos 67 SVGs, não emojis isolados; 61 filhos preservados e nenhum novo catálogo.
- Responsividade e foco/teclado/Escape/restauração de foco, modal com limite 90vh e scroll apenas quando necessário. Preservar gestão de foco existente no D05 e validação do serviço.
- Classificação em lote: previewVersion, escopo, linhas afetadas e reconfirmação. Sem gravar dados pessoais por UI demo.

## Aprovação e QA
- Protótipos B03/B04 demonstrativos aguardam feedback do proprietário; B01 V3/B02 V7 permanecem congeladas.
- QA futuro obrigatório: Electron 1366x768 e 1920x1080 dark/light, 390px mobile futuro, nomes longos, valores grandes, missing IDs, stale preview, POSTED/PENDING, keyboard, reduced-motion.
- Nenhuma alteração em produção, CircleCI, build Windows, merge ou escrita pessoal autorizada por esta proposta.
