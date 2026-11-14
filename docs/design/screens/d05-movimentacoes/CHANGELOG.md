# D05 — CHANGELOG DO DESIGN

| Data | Revisão | Decisão |
|---|---|---|
| 13/11/2026 | V1 inicial | Tela completa iniciada; identificado contraste ruim de despesas/títulos e emojis do SO. Protótipo inicial não aprovado. |
| 13/11/2026 | Taxonomia V1.2 | Proprietário aprovou integralmente 14 categorias principais, 61 subcategorias, 67 SVGs, fundos tonais e relações pai/filho. |
| 13/11/2026 | V1.3 ajustes | Solicitados seleção não-Windows, picker acionado no ícone, hierarquia pai/filho e estados de revisão separados; rodadas intermediárias não aprovadas. |
| 13/11/2026 | Refinamentos V1.4–V1.5 | Remover N registros solto por dia, popover mais compacto, merchant prioritário, valor isolado e contraste forte. |
| 13/11/2026 | Refinamento V1.6 | Substituir Revisar solto por ponto azul clicável junto ao merchant, switch Agrupar por dia, seleção circular; card A conferir como atalho. |
| **13/11/2026** | **V1.3 FINAL CONSOLIDADA** | **Tela completa explicitamente aprovada pelo proprietário. DESIGN_APPROVED / IMPLEMENTATION_READY.** Os refinamentos acima são absorvidos sem reiniciar a linguagem visual. |

**Artefatos finais**: prototype.html, DESIGN_SPEC_APPROVED.md, BEHAVIOR_SPEC.md, TOKENS.json, FIXTURES.json, ACCEPTANCE.md, HANDOFF.md. Os catálogos 14×61 e os 67 SVGs anteriores continuam aprovados e intocados.

**Estado de engenharia:** NOT_IMPLEMENTED na branch de design; sem QA Electron, sem CI, sem EXE. A implementação real precisa ser validada nos checkpoints E1/E2/E3 da issue #74. Nenhum merge main é autorizado por esta aprovação.
