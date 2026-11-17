> **ATUALIZAÇÃO 16/11/2026 — DESIGN APROVADO.** Este arquivo registra o **histórico V1, superado pelas iterações V2–V6**. A versão aprovada é **Hoje V6 + Conversar V5 + Plano de Ação V5**; consultar o [handoff final](./QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md), o [mapa de implementação](./B05_INTELLIGENCE_IMPLEMENTATION_MAP_V6.md), os [testes de aceite](./B05_INTELLIGENCE_ACCEPTANCE_V6.md) e o [contrato de motion](./B05_INTELLIGENCE_MOTION_SPEC_V6.md). **Aprovação visual não comprova implementação ou QA Electron.**

# Meu Financeiro 2.0 — B05: Inteligência Geral · Histórico V1 (substituído)

**Status original da V1 (histórico):** `DESIGN_IN_REVIEW / NOT_APPROVED / CODE_NOT_STARTED`. **Data:** 16/11/2026.  
**Escopo:** QA do primeiro EXE, issue #84, integração PR #76. **Base lida:** `src/intelligence-view.ts` 370–550 no HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`; refazer leitura de HEAD antes de implementar.

## Problema objetivo

Em `renderIntelligenceView`, `Hoje/Conversar/Plano de ação` já existem como `intelligenceMainMode: today/chat/actions`, mas o usuário os encontra como botões em `<details className="mf-ai-v3-tools">` sob **Mais ferramentas**. Antes da atividade principal existem hero genérico, disclosure de permissões, botão permanente Central de revisão e outros controles; no final da mesma tela há `mf-ai-lab-disclosure` com OAuth/memória/contexto sintético. Isso causa excesso de técnica e hierarquia invertida. O chat inicial ainda tem quatro starter questions estáticas; `renderIntelligenceFollowups` também usa candidatos predeterminados, embora evite repetição literal.

## Direção V1 para apreciação do proprietário

1. **Navegação primária limpa na Inteligência:** Hoje | Conversar | Plano de Ação, com underline sutil e acesso a 1 clique, mantendo estado e histórico compartilhado. NÃO criar segunda linha de tabs dentro de D03/Chat/D04.
2. **Hoje** herda a composição aprovada D03 V2, não um novo design genérico: hero contextual, 0–3 `SignalCard` de primitiva esmeralda única, agenda autorizada e pendências de revisão discretas, detalhe em drawer sob demanda. Sem UI-* e sem número inventado.
3. **Conversar** herda D02 e D01: histórico simples recolhível, mensagem de boas-vindas compacta, composer visível, rich visual answer, follow-ups derivados de sinais verificados, variação progressiva após responder, não repetir perguntas. Perguntas dependem de fatos resolvidos autorizados e contexto/período/filtros.
4. **Plano de ação** lista apenas propostas verdadeiras da sessão/pendentes do serviço, cada uma com dado de origem, impacto e próximo passo; ações de escrita seguem revisão D04 e reconfirmação D01. Na ausência, estado leve e opção `Preparar análise`, sem falsa promessa de ação.
5. **Permissões**: estado de consentimento compacto e claro; em `denied`, `partial`, `stale` ou `expired`, manter CTA de autorizar/renovar e bloqueio de valores que exigem cobertura verificada; não transformar consentimento em invisível.
6. **Central de Revisão**: mostrar quando `categoryReviewPreview` ou propostas elegíveis reais aguardam ação; não manter barra vazia permanente.
7. **Configuração** de OAuth/memória/laboratório só em Configurações > Inteligência/Avançado com acesso explícito; não remover controle real nem atravessar contexto de autorização.
8. **UI** tokens exatos MF2, sidebar real, fluxo com contraste, cards discretos, 1366×768 e 1920×1080, mobile posterior; sem decoração excessiva, sem termos de implementação no corpo.

## Fixture V1 e interações de protótipo

O protótipo em chat apresenta cenários *fictícios* `verificado`, `sem autorização`, `parcial`. Em cenário verificado, saldo disponível 1.700, compromissos futuros não pagos únicos 443, entradas futuras verificadas 0, gastos planejados adicionais 0, margem de segurança definida 1.000 → projeção 1.257 e folga 257; a reserva sugerida é **simulação** de até metade (128,50), sem movimentar dinheiro. Alimentação 760/700 = excesso 60; delivery 340 vs 230 em janelas iguais = +110. Os três sinais decorrem desses dados. Não carregar fixtures em contas pessoais.

Exemplos de controles: navegar tabs, escolher cenário, ajustar saldo/margem em rascunho da UI, abrir drawer de evidências e compromissos, chat com follow-ups progressivos, gerar proposta em `Plano de Ação` para prévia somente, dark/light, revisões contextuais. Se sem dados não renderizar R$ presumidos e não insistir em perguntas pessoais.

## Contratos obrigatórios

- [D03 V2 design](../screens/d03-inteligencia-hoje/DESIGN_SPEC_APPROVED.md), [contrato de derivação](../screens/d03-inteligencia-hoje/BEHAVIOR_SPEC.md)
- [D04 V1.1 design](../screens/d04-central-revisao/DESIGN_SPEC_APPROVED.md)
- D01 V4.5, D02 conversas/histórico e biblioteca visual
- `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`: `IC-READ` autorizada, `IC-REVIEW` ainda sintético isolado, `IC-CATS` e `IC-LLM` sem promessas de APPLY pessoal.
- Visão Geral e orçamento usam identidade [D05 global](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md).

## Aceite pendente

- Aprovação visual explícita sobre protótipo V1 (ou refinamento V2).
- Verificar cenários sem acesso/parcial, navegação, responsive, qualidade da evidência, atos de revisão, uso de contexto, auditoria de não-repetição.
- Somente após aprovação registrar `DESIGN_APPROVED`, publicar handoff de código; QA real Electron e integração/CI são outro gate.
