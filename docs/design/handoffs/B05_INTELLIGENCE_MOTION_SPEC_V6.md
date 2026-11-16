# B05 — Motion & Interaction Contract V6

**DESIGN_APPROVED — 16/11/2026.** Animações aprovadas por finalidade, não por decoração. Composição: **Hoje V6** + **Conversar/Plano V5**. Documento pai [HANDOFF](./QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md), fixture [JSON](./B05_INTELLIGENCE_FIXTURES_V6.json).

## 1. Vocabulário de movimento

O movimento traduz **causa → efeito → nova condição financeira**:
- **O foco muda:** transição de perspectiva entre uma decisão e outra.
- **O dinheiro se redistribui:** progressões do mesmo snapshot, sem números inventados.
- **O tempo avança:** cursor de data e gráfico em degraus mudam juntos.
- **A conversa cresce:** a mensagem surge sem retirar o controle do usuário.
- **A revisão mantém contexto:** drawer abre sobre a área anterior, sem quebrar a navegação.

**Rejeitado:** glow verde permanente em todos os cards, pulsos incessantes, rotação contínua de dinheiro, cascata que exige esperar para ler valor, animação que sugere uma operação bancária realmente executada. Logo discreto pode ter micro-movimento ambiente, porém prioridade é imóvel em estado ocioso.

## 2. Matriz canônica de transições

| Componente | Gatilho | Propriedades animadas | Duração alvo | Easing | Estado reduzido |
| --- | --- | --- | --- | --- | --- |
| Navegação `Hoje/Conversar/Plano` | Clique ou tecla | opacity + translateY(6–10px) da região principal; manter foco | 180–260ms | `cubic-bezier(.22,1,.36,1)` | troca instantânea |
| Cards selecionáveis | Hover/foco | translateY(−2..−3px), border/box-shadow discreta | 150–200ms | ease-out | apenas borda/contraste |
| **Hoje: cursor da timeline** | Escolher marco | x da guia/ponto/halo em conjunto; y alinhado ao valor de `projectedAt(t)` | 600–800ms | spring suave sem overshoot financeiro | posição instantânea |
| **Hoje: anel segmentado** | Seleção de data, override | startAngle/span de todas as fatias da **mesma decomposição**, incluindo legenda e centro | 650–900ms | cubic-bezier(.22,1,.36,1) | atualização imediata |
| **Hoje: valores centrais** | Resolver novo snapshot | interpolação visual entre centavos *já calculados*, 0.4–0.6s | 450–600ms | ease-out | texto final imediato |
| **Hoje: card do marco** | Selecionar data | content fade/translate curto (não desmontar anel) | 140–220ms | ease-out | conteúdo instantâneo |
| **Hoje: sinal inferior** | Hover / abrir | elevação suave; drawer overlay | 150ms / 240ms | ease-out | sem deslocamento |
| **Plano: fluxo vivo** | Slider reserva | repartição das fatias compromisso/margem/reserva/ainda livre | 550–850ms | ease-out | valores e larguras imediatas |
| **Plano: anel orçamento** | Slider limite | stroke progress, percentual, rótulo e estado | 550–850ms | ease-out | sem rotação/interpolação |
| **Plano: barras comparativas** | Slider redução | largura somente da barra hipotética; original imutável | 550–850ms | ease-out | atualização imediata |
| **Plano: Entender/Simular/Revisar** | Mudança de etapa | opacidade/translate da etapa (8–10px), indicador ativo | 180–300ms | ease-out | instantânea |
| **Plano: trocar oportunidade** | Card secundário | hero/visual substituídos e contexto reenquadrado | 220–320ms | ease-out | instantâneo |
| **Conversar: nova mensagem** | Mensagem criada/recebida | opacity+translateY(6px) | 180–280ms | ease-out | insert sem animation |
| **Conversar: sugestões** | Nova resposta validada | crossfade/reorder pequeno, sem replay das antigas | 140–230ms | ease-out | troca instantânea |
| **Drawer** | Clique em análise/revisão/histórico | scrim opacity; painel translateX(20–30px) | 220–280ms | ease-out | painel instantâneo |
| **Close drawer** | X, Esc, scrim | inverso da abertura, restaurar foco após fechamento | 160–240ms | ease-in/out | instantâneo |

As durações são alvos, não uma obrigação de aguardar para finalizar uma decisão. Não usar temporizador para atrasar a confirmação ou o valor real.

## 3. Sincronismo obrigatório

Ao selecionar uma data `t`, o resolver entrega um snapshot puro `TimelinePoint(t)` com:
- `projectedCents` e `consideredCommitmentsCents`;
- `protectedCents` e `headroomCents`;
- estado de cobertura, source refs, datas/IDs e `snapshotVersion`;
- indicadores `canRenderSegments` e `isFutureProjection`.

O renderer deve atualizar num **único commit de estado**:
1. seleção e `aria-pressed` do marco;
2. cursor/guia/ponto no gráfico;
3. anel (todas fatias);
4. legenda;
5. saldo central;
6. ficha lateral do marco e o rótulo `projetado`;
7. sinais dependentes da mesma janela.

**Não** manipular 7 estados soltos com timeouts independentes. A animação visual interpola *entre* dois estados financeiros já resolvidos. Uma interação mais nova cancela a anterior imediatamente.

### Regras de números animados

- Valor financeiro **sempre calculado em integer cents**, nunca derivar resultado de frame interpolado.
- Durante interpolação, `Math.round(startCents + (targetCents-startCents)*ease)` somente na camada de apresentação, formatado `pt-BR`; ao terminar, renderizar exatamente `targetCents`.
- Quando `snapshotVersion` ou `grantVersion` muda, invalidar transições e qualquer valor `cached` não autorizado; preferir estado de carregamento ao animar um saldo de fonte antiga.
- Interpolação numérica em `requestAnimationFrame` cancelável e com checagem de montagem do componente; no unmount limpar animation handles. Em background/offscreen, não realizar trabalho pesado de animação.
- Em corte de sessão ou período, **sem interpolação entre perfis**; trocar imediatamente para `loading/denied` e mostrar dados novos somente depois da resolução.
- Animação de gráfico nunca representa `payment posted`. Numa data futura o evento é **previsto**.

### Anel / geometria

- O anel mostra proporções **não negativas** e reconciliadas no domínio; a soma visual de segmentos deve bater com o denominador rotulado.
- A proposta B05 V6 combina `considered commitments`, `protected margin` e `free above buffer` **apenas para o baseline sem renda adicional, outras despesas e saldo suficiente**.
- Para déficit, entrada futura ou margem indefinida, muda a decomposição antes de animar: cenário alternativo com déficit explícito/insuficiência ou estado incompleto. **Não reduzir visualmente o déficit a um arco de valor zero como se estivesse tudo fechado**.
- O anel e suas legendas devem manter **mesma ordem e cor** em cada atualização; color coding semântica/patterns/aria, não só contraste.
- Para web/SVG, animar `stroke-dasharray`/`stroke-dashoffset` e cursor via atributo/SVG transform conforme suporte real do Chromium/Electron. O protótipo inline não prova que transições de atributos `cx/cy` são suportadas pelo CSS de produção: testar e usar `requestAnimationFrame`/Web Animations apenas quando necessário.

### Timeline

- Não usar coordenadas fixas da fixture (16/21/23/28/30) em produção. Escala x e marcos de data devem derivar do período real, ordenados e estáveis.
- Eventos na mesma data podem agregar valor visualmente, preservando IDs e detalhe por registro. Se existir valor líquido que aumenta o saldo, representar explicitamente a subida em vez de disfarçar como descida.
- Se não houver compromissos, mostrar linha plana somente se houver saldo verificado; caso contrário, estado parcial. Quando soma de compromissos ultrapassa saldo, o eixo e estado devem contemplar projeção negativa.
- `aria-live` não deve anunciar 40 valores intermediários de animação: anunciar apenas estado final e data escolhida, evitando verbosidade de leitor de tela.

## 4. Acessibilidade e ergonomia

- Respeitar `@media (prefers-reduced-motion: reduce)` **e** preferência in-app; a opção mais restritiva prevalece.
- Teclado: a timeline oferece alvos de botões, estado selecionado e foco visível; setas entre marcos são melhoria possível, sem remover Tab.
- Sliders: exposição de valor atual + unidade + contexto (por exemplo, `Reserva hipotética — R$ 128,50`), mudança por teclado sem atualizar banco.
- Drawer modal: `aria-modal`, focus trap, Escape, clicar backdrop, restaurar foco ao gatilho; quando anexo à sidebar do chat, não deslocar o chat permanentemente.
- Não animar `height:auto` de grandes regiões que causem layout shift; proteger composer persistente e scroll do transcript.
- Contraste: tema dark/light, sem rótulos cinza invisíveis; cores positivas/negativas e de categoria D05 não substituem texto indicador.
- Layout com zoom 125%, 150%, 200% e viewport estreito mantém espaço suficiente para leitura; motion reduced não perde contexto da decisão.

## 5. Performance e medição

Para o Executor:
- Validar 1366×768 e 1920×1080 em Electron Windows x64 real; máquina limitada, GPU/aceleração possivelmente desativada.
- Testar 20 interações rápidas alternando datas e sliders: **último estado vence**, sem dessincronização do anel ou valores na legenda.
- Verificar latência perceptível, recálculo O(n) de compromissos, atualização eficiente sem rerenderizar todo o app.
- Garantir que `requestAnimationFrame` não sobrevive após desmontagem e não roda em loop quando UI está parada.
- Capturar vídeo curto comparando movimento normal/reduzido e screenshots dos valores finais; sem “performance aprovada” sem evidência.
- Nenhuma dependência nova de motion/renderização sem autorização do Integrador e confirmação de bundler/ASAR.

## 6. Changelog dos movimentos

- **V3:** cards neutros e visual distinto por insight.
- **V4:** Conversar com histórico oculto e Plano com foco/etapas.
- **V5:** **Fluxo Vivo**, números e perspectiva animados; interações motivadas por alteração de dados; reduced motion.
- **V6:** Hoje ganha **anel segmentado + timeline selecionável + projeção coordenada + diagnósticos**, mantendo V5 nas outras áreas.

Este registro é um **contrato visual e funcional aprovado**, NÃO testes de performance ou QA Windows executados.
