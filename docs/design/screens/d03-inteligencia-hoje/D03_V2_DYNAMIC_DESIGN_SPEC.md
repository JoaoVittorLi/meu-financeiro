# D03 — Inteligência Hoje · V2 dinâmica (em revisão)

**Histórico:** esta é a especificação V2 original, antes da aprovação. A D03 V2 foi **DESIGN_APPROVED** em 13/11/2026; consulte a [especificação final](DESIGN_SPEC_APPROVED.md), o [protótipo reproduzível](prototype.html), o [handoff](HANDOFF.md) e o [aceite](ACCEPTANCE.md). O Electron ainda não foi implementado/homologado nesta entrega.

## Feedback do proprietário e resposta

**Problema visual:** dois primeiros cards da V1 têm aparência distinta do terceiro (oportunidade), com contraste ilegível de alguns títulos.  
**Decisão:** **uma única primitiva visual** `SignalCard` para todos os cards de prioridades: mesmo background escuro/verde sutil, borda/raio/padding, tipografia, ícones e CTAs; apenas acento semântico, números e conteúdo mudam. Títulos e valores têm cores explícitas em dark/light; barras não sobrepõem rótulos. Aplicar gradiente vermelho→amarelo somente para **magnitude do aumento comparável de gastos**, não a toda UI.

**Problema funcional:** prioridades fixadas no HTML sem relação com o estado financeiro atual.  
**Decisão:** usar `FinancialSnapshot` validado e um motor determinístico local `deriveTodaySignals` para classificar por tipo de situação, elegibilidade e materialidade; não usar textos repetidos, contagens inventadas ou agendamento falso.

## Contrato de fonte

```ts
type Snapshot = {
  asOf: string;
  currency: 'BRL';
  balanceCents: number | null;  // saldo disponível autoritativo; null = desconhecido
  expectedIncomeCents: number; // entradas previstas, identificadas, não recebidas
  scheduledUnpaidCents: number; // soma dos compromissos futuros ainda não pagos
  extraExpectedOutflowCents: number; // despesa extra informada pelo usuário na simulação
  safetyBufferCents: number; // margem mínima informada pelo usuário
  expenseHistoryAuthorized: boolean;
  categorySpendCents?: number; categoryBudgetCents?: number; // período e escopo equivalentes
  deliveryPreviousCents?: number; deliveryCurrentCents?: number; // janelas equivalentes
  coverage: 'verified'|'partial'|'stale'|'denied'|'none';
}
```

Valores em centavos inteiros; separar `POSTED` de `PENDING`; excluir transferências internas de E/S; **saldo já disponível não deve subtrair despesas que já ocorreram**.

## Regras de classificação para casos demonstrativos

1. Se `balanceCents === null` ou `coverage` não permite projeção, **não** fazer conselho de reserva/insuficiência baseado em saldo fictício. Mostrar orientação de acesso/revisão das fontes.
2. `projectedCents = balanceCents + expectedIncomeCents - scheduledUnpaidCents - extraExpectedOutflowCents`.
3. `headroomCents = projectedCents - safetyBufferCents`.
4. Se `projectedCents < 0`: prioridade crítica de insuficiência; explicar que é **previsão**, não saldo bancário negativo; CTA rever compromissos ou organizar fluxo.
5. Se `0 <= projectedCents < safetyBufferCents`: baixa margem; **sugerir rever limites de gastos flexíveis** e compromissos, sem afirmar que aumentar limite cria dinheiro.
6. Se `0 <= headroomCents < R$ 150`: sinalizar margem reduzida; sem recomendação forte de investimento ou reserva.
7. Se `headroomCents >= R$ 150`: sugerir reservar **até 50% da folga acima da margem mínima**, explicitando que é uma simulação sujeita a outros gastos; não salvar meta nem iniciar transferência.
8. Se `categorySpendCents > categoryBudgetCents > 0` e há evidência: alerta de limite ultrapassado baseado na diferença, com CTA para investigar/revisar. Limite zero não gera percentual infinito.
9. Se `deliveryCurrentCents > deliveryPreviousCents` e intervalos comparáveis: sinal de aumento com impacto em reais, sem atribuir causalidade; CTA investigação e simulação.
10. Se nenhuma prioridade verificável: estado calmo (sem gerar incidentes artificiais), com próximos compromissos autorizados e CTA de análise.
11. Ranqueamento material: insuficiência > baixa margem > reserva de folga > limite ultrapassado > aumento de delivery > compromissos agendados. Exibir de 1 a 3 sinais válidos, não quantidade fixa.
12. Follow-ups vêm dos `signalIds`, de seus `factRefs` e da conversa; sugestões já utilizadas desaparecem; sem perguntas fixas por aba.

## Exemplo isolado

- Saldo disponível ilustrativo: **R$ 1.700**; compromissos futuros confirmados na fixture: Energia R$ 220, Internet R$ 119, Academia R$ 104 (**R$ 443**). Entradas futuras: R$ 0; extras: R$ 0; margem desejada: R$ 1.000.
- `projected = 1700 - 443 = R$ 1.257`; folga acima da margem = **R$ 257**; sugestão de separar 50% = **R$ 128,50**, como hipótese.
- Ao ajustar o saldo previsto para **R$ 1.150**, `projected = R$ 707`; faltam R$ 293 para a margem desejada → sugestão de revisão de limites.
- Ao ajustar para **R$ 350**, `projected = -R$ 93` → aviso de possível insuficiência na projeção.
- Alimentação R$ 760 / orçamento R$ 700 → ultrapassagem R$ 60 (108,6%).
- Delivery R$ 150 → R$ 340 (em janelas de mesmo tamanho) → Δ R$ 190. Sem afirmar que aumento se repetirá.
- Sem permissão/cobertura suficiente, omitir alertas dependentes da fonte e usar empty/partial/stale.

## Interação/UX

- Um único layout D03 inteiro, sem aba persistente `Hoje / Conversar / Plano de Ação`.
- Botão de cliente `Ajustar previsão` abre drawer de simulação com saldo, entradas, extras, margem e permissões de fontes; ao confirmar localmente, os **3 cards são recalculados e reordenados**, título principal, projeção e sugestão contextual mudam.
- Cards compartilham `SignalCard` com fundo esmeralda discreto como a terceira carta V1; CTA de cada tipo abre drawer contextual e não uma tela de microdesign.
- Agenda e prévia de revisão usam componentes compactos, contraste dark/light, sem labels internos UI-*.
- Animações 150–240 ms apenas em transições do estado confirmado; reduced motion respeitado; sem contadores que fabricam dinâmica.
- Todas as operações são **leitura/rascunho**. A Central D04 revisará e reconfirmará antes de qualquer escrita real, segundo D01 V4.5.

## Critérios de aceitação antes de handoff

- O proprietário aprova visualmente **a tela inteira V2**.
- Interação previsão muda estado de **folga → aperto → possível insuficiência**, e retorno sem recarregar.
- Se fonte não está disponível, cards que exigem evidência somem; não simular dados como reais.
- Nenhum card com contraste invisível, click inerte ou métricas não conciliadas; dark/light e mobile sem overlap.
- Não declarar teste Electron/Playwright sem ter executado; protótipo em chat não é implementação.

**Referências:** [D03 issue #61](https://github.com/JoaoVittorLi/meu-financeiro/issues/61); [Design System V3](../d02-chat-principal/VISUAL_LIBRARY_CONSOLIDATED_V3.md), [D01 V4.5 aprovado](../d01-chat-lateral/).
