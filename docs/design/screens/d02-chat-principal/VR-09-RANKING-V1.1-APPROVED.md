# VR-09 — Ranking de Variações V1.1 — DESIGN_APPROVED

**Data:** 13/11/2026.  
**Aprovação explícita e condicional do proprietário:** “O protótipo da V1.1 não carregou. Se estiver idêntico à captura real após os ajustes, está aprovado.”

## Condição verificada

O mesmo arquivo HTML autônomo `VR-09-RANKING-V1.1-PROTOTYPE.html` foi renderizado novamente em Chromium headless em **1260 × 709**. Captura gerada nessa rodada foi comparada pixel a pixel com `VR09-V1.1-Real-Preview-16x9.png` já mostrada ao proprietário. Resultado: **MAE = 0, pixels idênticos = 100%**, sem pageerror. Logo, condição atendida e status passa a `DESIGN_APPROVED`.

A comparação comprova **a captura da superfície inicial e a correspondência do artefato**, não cobertura visual de todos os estados, nem validação do Electron. A aprovação de design não representa implementação.

## Contrato visual congelado

- Design e comportamento do protótipo de [VR-09 V1.1](VR-09-RANKING-V1.1-PROTOTYPE.html), com contraste forte no dark/light e todos os controles com feedback.
- Ranking alterna impacto absoluto em reais × crescimento percentual e ordena corretamente; Alimentação lidera impacto (+R$ 280); Saúde lidera crescimento (+107,3%).
- Filtros Todas, Aumentos, Reduções (estado vazio explicativo) e Sem mudança (Moradia), seleção de categoria e barra, detalhe, lista por mês, comparação.
- Modos Principal/Análise/Lateral/Mobile, revisão dos contrastes e minimização de poluição visual.
- Totais sintéticos: outubro R$ 2.100, novembro R$ 2.727, aumento R$ 627. Atribuição de contribuição não significa causalidade da compra.

## Evidência

- [HTML protótipo V1.1](VR-09-RANKING-V1.1-PROTOTYPE.html)
- [V1.1 smoke e correções](VR-09-RANKING-V1.1-REVIEW.md)
- Captura real aprovada exibida na conversa anterior e artefato local `/mnt/data/VR09-V1.1-Real-Preview-16x9.png`, **não versionado no GitHub**.
- Rechecagem local: screenshot atual 1260×709, MAE=0, identical pixels=100%.

## Gates pendentes para engenharia

Componente React/Electron, testes de clique e de acessibilidade no app, atualização integrada a dados reais, fontes e qualidade de dados, smoke multi-resolução, autorização de eventuais ações financeiras. `IMPLEMENTATION_NOT_STARTED` no catálogo. Não modificar D01 V4.5, VR-07 V2 nem VR-08 V1.

**Próximo item:** VR-10 Investigação/Drill-down V1, sob revisão individual. VR-11 somente após aprovação explícita de VR-10.
