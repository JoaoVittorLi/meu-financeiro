# D03 — Inteligência Hoje V2 · Aceite e QA

**Design:** `DESIGN_APPROVED / IMPLEMENTATION_READY` pelo proprietário em 13/11/2026.  
**Implementação Electron:** `NOT_STARTED` neste pacote.  
**Documento de comportamento:** [BEHAVIOR_SPEC.md](BEHAVIOR_SPEC.md), **protótipo** [prototype.html](prototype.html).

## 1. Evidência efetivamente executada nesta entrega

**Método:** validação de código JS do protótipo recuperado do GitHub (parser JS) e execução isolada do resolver determinístico em ambiente JS, usando os fixtures sintéticos do pacote. **Não** são testes de navegador/Playwright, nem smoke do app Electron. O arquivo HTML foi publicado e lido novamente por seu SHA, sem diferença de conteúdo.

| Verificação | Resultado |
|---|---|
| HTML canônico e JS embutido publicados e lidos de volta | PASS |
| Compilação de sintaxe do script do protótipo | PASS |
| Cenário folga: saldo R$1.700 − R$443 = R$1.257 → cartão reserva | PASS |
| Cenário margem curta: saldo R$1.450 − R$443 = R$1.007 → acompanhamento | PASS |
| Cenário aperto: saldo R$1.150 − R$443 = R$707 → revisar margens | PASS |
| Cenário insuficiência: saldo R$350 − R$443 = −R$93 → possível insuficiência | PASS |
| Saldo indisponível: sem recomendação de reserva ou falta baseada em saldo | PASS |
| Histórico indisponível: não exibe sinais de orçamento nem delivery | PASS |
| Limite zerado: não calcula percentual inválido nem gera alerta de excesso | PASS |
| Cobertura parcial: não emite sinais que dependem de dados confirmados | PASS |
| Gasto igual ao limite: não dispara orçamento ultrapassado | PASS |
| Componentes estruturais de drawer, tema, proposta, previsão, chat e reduced motion presentes no HTML | PASS (verificação estática) |

**Ajuste de polimento encontrado nesses testes:** a condição `margem curta` inicialmente ficava atrás do cartão de orçamento por prioridade numérica. O motor foi ajustado para colocar a segurança da margem em primeiro lugar; cenário reexecutado e passou.

## 2. Checklist de aprovação do design

- [x] Aprovação explícita da D03 V2 pelo proprietário.
- [x] Todos os cards prioritários utilizam a estética esmeralda premium do 3º cartão V1.
- [x] Títulos/valores legíveis nos tokens oficiais dark/light (especificação e CSS).
- [x] Recomendações contextuais, derivadas de `Snapshot`; não fixas.
- [x] Se sobra dinheiro acima da margem, sugerir reserva **simulada**.
- [x] Se margem insuficiente, sugerir revisar gastos ajustáveis e compromissos, sem afirmar que mexer em orçamento cria dinheiro.
- [x] Se previsão negativa, diferenciar projeção de saldo bancário negativo.
- [x] Estados sem autorização não fabricam dados.
- [x] D03 é uma tela completa, sem o trio de abas permanentes.
- [x] Prévia de regra não aplica escrita financeira.

## 3. Gates obrigatórios de implementação (AINDA NÃO EXECUTADOS)

- [ ] Renderizar no Electron 1366×768 escuro e claro, e 1920×1080; produzir screenshots reais com IDs e SHA do build.
- [ ] Confirmar contraste WCAG AA (texto 4,5:1, controles/ícones 3:1) e legibilidade dos títulos, valores, breadcrumbs e CTAs; nenhum texto invisível.
- [ ] Confirmar responsividade 390×844 quando PWA for retomada; drawer ocupa tela e não encobre controles.
- [ ] Testar clique, teclado e foco de **cada botão visível**, fechamento por Escape, ciclo de Tab e restauração de foco após drawer; evitar controles inertes.
- [ ] Comparar visualmente os três cartões de prioridade: exatamente mesma primitiva, padding, border-radius, fundo, borda e CTA; somente valores/ícones semânticos variam.
- [ ] Validar `prefers-reduced-motion` e ausência de motion que anuncie um valor financeiro antes de ser consolidado.
- [ ] Integrar fonte real autorizada e contratos de snapshot; evitar duplicidade PENDING/POSTED, transferência interna e pagamentos futuros já contabilizados.
- [ ] Verificar situações de falta de dado, parcialmente preenchido, desatualizado, offline, negado, erro e zero sem inventar números.
- [ ] Recalcular cards/hero ao atualizar saldo, entradas, margem, compromissos ou limites; o resultado deve coincidir com as transações financeiras reais do período.
- [ ] Assegurar que card de Alimentação só aparece se houver orçamento explícito e gasto verificado; evitar divisão por zero.
- [ ] Assegurar que sugestões de comparação só apareçam em janelas equivalentes, sem falsa causalidade.
- [ ] Agenda mostra apenas pagamentos futuros não pagos, sem duplicidade de IDs; abre detalhe contextual correto.
- [ ] Chat sugestiona com base nos sinais atuais e não repete perguntas consumidas; mantém histórico entre D01/D02/D03.
- [ ] Seleção/revisão de categoria recalcula contagem e valor; mudar prévia invalida autorização prévia; nenhuma escrita real pela D03.
- [ ] Proteções D01 V4.5, fontes IC-READ, IC-REVIEW, IC-CATS e escrita desativada preservadas.
- [ ] Regressões dos oito cards legados no `renderIntelligencePremiumToday` não quebram dashboards e contratos existentes ao remover metadados de interface.
- [ ] Testes Electron/TypeScript/unitários/SQLite e gates CI oficiais executados; reportar falhas reais sem “passar” por mock.

## 4. Matriz de cenários canônica (synthetic, centavos)

| Cenário | Saldo disponível | Compromissos pendentes | Projetado | Sinal principal |
|---|---:|---:|---:|---|
| Folga | R$1.700,00 | R$443,00 | R$1.257,00 | Reserva hipotética R$128,50, após margem R$1.000 |
| Margem curta | R$1.450,00 | R$443,00 | R$1.007,00 | Preservar R$7,00 de folga acima da margem |
| Apertado | R$1.150,00 | R$443,00 | R$707,00 | Revisar R$293,00 abaixo da margem |
| Insuficiente | R$350,00 | R$443,00 | −R$93,00 | Risco de insuficiência (previsão) |
| Sem saldo | não autorizado | R$443,00 | indisponível | Pedir fonte, sem recomendação de reserva |
| Sem gastos | R$1.700,00 | R$443,00 | R$1.257,00 | Reserva, sem orçamento/delivery |
| Limite 0 | R$1.700,00 | R$443,00 | R$1.257,00 | Sem % de orçamento |
| Coverage parcial | dado parcial | parcial | indisponível | Sem conclusões financeiramente precisas |

## 5. Falhas bloqueantes

- Cards com aparência distinta do terceiro aprovado ou texto invisível.
- Valores não conciliados, saldo/receita/compromissos confundidos, orçamento criado sem base.
- Botão presente sem ação/estado/feedback.
- Recomendação falsa ou repetida, ou abandono do contexto após retornar do drawer.
- Tentar salvar categoria, regra, pagamento ou orçamento real diretamente via IA neste fluxo.
- Considerar aprovação de design como se já houvesse implementação ou QA Electron aprovado.

**Próxima homologação:** somente após PR de engenharia, capturas e suíte real. A aprovação visual desta entrega não elimina esses gates.
