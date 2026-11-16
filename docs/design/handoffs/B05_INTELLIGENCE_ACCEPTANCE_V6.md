# B05 — ACEITE VISUAL E QA DE ENGENHARIA V6

**Estado do design: APPROVED pelo proprietário em 16/11/2026.**  
**Estado dos testes de código/Electron/Windows neste handoff: NOT_RUN.**  
**Fonte:** [Handoff](./QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md), [Fixture](./B05_INTELLIGENCE_FIXTURES_V6.json), [Motion](./B05_INTELLIGENCE_MOTION_SPEC_V6.md), [Mapa](./B05_INTELLIGENCE_IMPLEMENTATION_MAP_V6.md).

> Não marcar PASS sem execução real. DESIGN_APPROVED ≠ IMPLEMENTED ≠ VISUAL_QA ≠ HOMOLOGATED.

## 1. Matriz obrigatória para o Executor

| ID | Cenário | Resultado esperado | Status neste handoff |
| --- | --- | --- | --- |
| B05-01 | Abrir Inteligência | Três áreas **Hoje, Conversar e Plano de Ação** no topo, 1 clique, sem `Mais ferramentas` duplicado; permissões acessíveis | NOT_RUN |
| B05-02 | Contexto pessoal com grants válidos | Valores obtidos de fatos com `sourceId/period/asOf/coverage`, nunca de fixture | NOT_RUN |
| B05-03 | Fixture verified `asOf 16/11`, marco `16/11` | Considerados R$0; projeção R$1700; margem R$1000; folga R$700 | NOT_RUN |
| B05-04 | Marco 21/11 | Considerados R$119; projeção R$1581; folga R$581; três áreas sincronizadas (gráfico, anel, ficha) | NOT_RUN |
| B05-05 | Marco 23/11 | Considerados R$264; projeção R$1436; folga R$436 | NOT_RUN |
| B05-06 | Marco 28/11 | Considerados R$443; projeção R$1257; folga R$257 | NOT_RUN |
| B05-07 | Marco 30/11 | Valores de 28/11 mantidos, sem despesa inventada; reserva 50% da folga = R$128,50 | NOT_RUN |
| B05-08 | Navegar repetidamente datas 16→30→21→28 | Última seleção vence; legenda/centro/ficha/cursor concordam; nenhuma fatia mantém valor anterior | NOT_RUN |
| B05-09 | Clicar fatia ou legenda | Drawer lateral abre explicação e origem da parte selecionada; fechar X/Esc/backdrop devolve foco | NOT_RUN |
| B05-10 | Ajustar saldo/margem | Recalcular centavos de projeção/anél/folga; atualizar UI no mesmo snapshot; NÃO alterar conta/SQLite | NOT_RUN |
| B05-11 | Saldo baixo: fixture deficit | Projetado −R$143; alertar insuficiência, **não fingir que anel triplo fecha** | NOT_RUN |
| B05-12 | Falta de margem explícita | Projeção somente se verificada; CTA definir margem; nenhuma fatia “margem R$0” presumida nem sugestão de reserva | NOT_RUN |
| B05-13 | Compromissos repetidos pelo mesmo ID | Contabilizar uma vez, preservar evidência e vencimento | NOT_RUN |
| B05-14 | Status `PENDING/POSTED` e despesas já pagas | Nunca subtrair novamente despesas já embutidas no saldo; vencimento futuro é previsão e não `pago` | NOT_RUN |
| B05-15 | Renda prevista/saída adicional | Renderizar componentes conciliados/alternativa de UI; não aplicar anel de 3 fatias incompatível | NOT_RUN |
| B05-16 | Despesa orçamento `760/700` | Excesso R$60 e uso ~109%; ícone Alimentação da D05 hue26, vermelho semântico do excesso independente | NOT_RUN |
| B05-17 | Orçamento `760/0` | Não dividir por zero; nenhum percentual falso, mostrar estado sem limite | NOT_RUN |
| B05-18 | Delivery `340−230`, períodos equivalentes | Aumento R$110, variação ~47,8%; gráfico de 2 valores sem curva inventada | NOT_RUN |
| B05-19 | Comparação anterior 0 ou janelas desiguais | Não renderizar crescimento percentual indevido ou afirmação de comparabilidade falsa | NOT_RUN |
| B05-20 | Perfil parcial | Apenas sinais com fatos verificáveis; **sem** saldo ou reserva futura inventados | NOT_RUN |
| B05-21 | Perfil denied / none / expired / stale | Valores pessoais removidos/invalidados; CTA de consulta/renovação contextual, sem reutilizar cache | NOT_RUN |
| B05-22 | Conversar V5 | Chat ocupa espaço principal, histórico fechado por padrão, composer acessível, sem coluna fixa | NOT_RUN |
| B05-23 | Histórico e Nova conversa | Abre drawer por clique, preserva threads reais por perfil, escopo compartilhado D01, sem storage duplicado | NOT_RUN |
| B05-24 | Resposta chat com grant revogado | Conteúdo antigo marcado indisponível/stale; resposta tardia não injeta dados de nova sessão | NOT_RUN |
| B05-25 | Followups após resposta sobre Alimentação | Perguntas derivadas de sinais/pistas atuais, não repetem quatro prompts estáticos; contexto muda corretamente | NOT_RUN |
| B05-26 | Plano V5 / escolher reserva | Foco protagonista, alternativas secundárias, Fluxo Vivo animado, sem 3 filas textuais idênticas | NOT_RUN |
| B05-27 | Plano / Entender→Simular→Revisar | Etapas e before/after condizentes, mudanças apenas em rascunho, não aplicam no clique visual | NOT_RUN |
| B05-28 | Plano / limite / delivery | Ajuste de limite não altera gasto realizado; redução de delivery é hipótese, não economia garantida | NOT_RUN |
| B05-29 | Revisão real D04 | Preview com versão, afetados, valores e consentimento; sem capability real de escrita mostra bloqueio adequado | NOT_RUN |
| B05-30 | Mudar fonte, conta, período e token em meio à prévia | Invalidar `previewVersion`/simulação e reapresentar dados novos antes de confirmar | NOT_RUN |
| B05-31 | Navegação Hoje→Conversar→Plano→Hoje | Não perde mensagens/histórico nem reexecuta IA por render; revalida apenas fatos que mudaram | NOT_RUN |
| B05-32 | Dark e light | Contraste legível, cards neutros, cores D05 íntegras, sinais/valores claros, sem glow verde chapado | NOT_RUN |
| B05-33 | 1366×768 e 1920×1080 | Navegação, hero, anel, timeline, drawer e valores sem overflow/truncamento crítico | NOT_RUN |
| B05-34 | Zoom 125/150/200% e viewport pequeno | Layout empilha corretamente; controle por teclado e sem scroll horizontal indevido | NOT_RUN |
| B05-35 | Reduced motion do sistema ou app | Informação/ação idêntica sem transições; nenhum reflow ou valor perdido | NOT_RUN |
| B05-36 | Interações rápidas (20 mudanças) | Cancelar animações anteriores; último marco/slider vence; nunca visual e números em estados diferentes | NOT_RUN |
| B05-37 | Acessibilidade | Tabs/controles com nome acessível; rótulos de datas, status, teclado, Escape, focus trap/return, aria-live final apenas | NOT_RUN |
| B05-38 | Recuperação: IA offline/erro/timeout | Degradação clara, sem sucesso falso, chat permanece operacional com fallback autorizado | NOT_RUN |
| B05-39 | Regressão B01–B04 e D01–D05 | Identidades, gavetas, B02 circular, categoria por ícone e Central D04 continuam válidos | NOT_RUN |
| B05-40 | QA de pacote | TypeScript, tests, ASAR/sandbox, smoke Electron, capturas Windows e evidências de dark/light | NOT_RUN |

## 2. Capturas / gravações que devem acompanhar o PR de implementação

1. `B05-TODAY-1366-DARK.png` — Hoje V6, data selecionada 30/11, anel e timeline visíveis.
2. `B05-TODAY-1920-LIGHT.png` — tema claro, legibilidade dos três segmentos e leitura dos sinais.
3. `B05-TODAY-MILESTONE-21.png` e `B05-TODAY-MILESTONE-28.png` — duas seleções comprovando mudança dos mesmos valores.
4. `B05-TODAY-DRAWER-ADJUST.png` — slider + projeção, com ênfase em **simulação**.
5. `B05-TODAY-PARTIAL.png` e `B05-TODAY-NONE.png` — degradação sem saldos falsos.
6. `B05-CHAT-V5-WIDE.png` — conversa protagonista e composer; histórico fechado.
7. `B05-CHAT-HISTORY-DRAWER.png` — histórico sob demanda.
8. `B05-ACTIONS-V5-FLOW.png` — Fluxo Vivo e uma alternativa secundária.
9. `B05-ACTIONS-V5-REVIEW.png` — preview, sem sucesso bancário.
10. `B05-REDUCED-MOTION.mp4` ou GIF teste curto (sem áudio) e `B05-MOTION-NORMAL.mp4` — mesmo fluxo, estados finais idênticos.

**Todos são nomes recomendados de evidência futura**, não arquivos já existentes. Capturas devem vir do **Electron real**, não de navegador HTML de mock.

## 3. Gate de entrega para o Integrador

O Executor não deve informar `DONE` sem:
- **HEAD e base** de onde o trabalho partiu; PR próprio de código e revisão de ownership.
- Lista dos arquivos alterados, o motivo e o contrato que preservaram.
- Testes por ID com `PASS/FAIL/NOT_RUN` e evidências rastreáveis.
- Comparação com os protótipos aprovados por área (`Hoje V6`, `Conversar V5`, `Plano V5`), indicando diferenças e razão.
- Declaração explícita de ausência de gravação IA pessoal indevida, não-duplicação de saldo/pagamentos e comportamento de autorizações.
- Screenshots reais e release/EXE **somente** quando o proprietário/Integrador autorizar o gate apropriado.

**Bloqueantes:** B05-03 a B05-15 (corretude), B05-20 a 24 (autorizações/histórico), B05-26 a 30 (ações supervisionadas), B05-32 a 36 (visual/motion), B05-39 a 40 (integração).
