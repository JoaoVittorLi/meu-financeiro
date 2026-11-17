# D06 V3 — Critérios de Aceite / QA

**DESIGN_APPROVED em 17/11/2026. Todos os testes abaixo: NOT_RUN nesta entrega documental.** Não inferir que o protótipo web validou Electron, Windows, animação GPU ou integração.

**Documentos:** [Handoff](./D06_PANORAMA_VIVO_APPROVED_V3_20261117.md) · [Motion](./D06_PANORAMA_VIVO_MOTION_SPEC_V3.md) · [Map](./D06_PANORAMA_VIVO_IMPLEMENTATION_MAP_V3.md) · [Fixture](./D06_PANORAMA_VIVO_FIXTURES_V3.json).

| ID | Ação / cenário | Resultado esperado | Status |
| --- | --- | --- | --- |
| D06-01 | Abrir Visão Geral | D06 V3 é protagonista, quatro KPIs separados e filtros fonte/período/privacidade mantidos | NOT_RUN |
| D06-02 | Banco nov fixture | R$ 3.200 receitas, R$ 2.727 despesas, R$ 473 resultado; saldo banco R$ 4.560,80 separado | NOT_RUN |
| D06-03 | Banco out fixture | R$ 2.960 entradas, R$ 2.310 saídas, resultado R$ 650; saldo referência não retroage | NOT_RUN |
| D06-04 | Banco week fixture | Receita zero, despesa R$ 980; déficit R$ 980 e Fluxo baseado em despesas, sem origem financeira fictícia | NOT_RUN |
| D06-05 | Manual nov | R$ 2.000 receita, R$ 1.674 despesa, resultado R$ 326 e saldo manual R$ 1.938,50 separado do banco | NOT_RUN |
| D06-06 | Trocar fonte repetidamente | Não soma/deduplica indevidamente banco + manual; não exibe valores antigos na lente | NOT_RUN |
| D06-07 | Trocar período | Receitas/despesas/Fluxo/Ritmo/categorias seguem filtro; referência de saldo bancário permanece independente | NOT_RUN |
| D06-08 | Fluxo entrada positiva | Categorias R$ 2.727 + resultado R$ 473 = receita R$ 3.200, sem perda nas faixas | NOT_RUN |
| D06-09 | Fluxo com renda inferior | Despesas como base, déficit em separado; sem desenho matematicamente falso | NOT_RUN |
| D06-10 | Fluxo com zero em ambos | Estado vazio verdadeiro, sem arco/fatia inventada e sem divisão por zero | NOT_RUN |
| D06-11 | Categoria Outras | Top5 + Outras conciliam total real e não deixam transações sem categoria desaparecer | NOT_RUN |
| D06-12 | Fluxo foco por clique/teclado | Rota selecionada acende; demais ficam secundárias; foco da lente e B01 é o mesmo categoryId | NOT_RUN |
| D06-13 | Fluxo pulso de entrada | Animação de entrada apenas uma vez por mount; nenhum loop ocioso; valores imutáveis | NOT_RUN |
| D06-14 | Selecionar rota e reproduzir | Pulso percorre curva correta; outro clique cancela anterior; nenhuma transação criada | NOT_RUN |
| D06-15 | Playback 20× rapidamente | Última seleção vence, rAF/particles descartados; sem travar Electron | NOT_RUN |
| D06-16 | Trocar Fluxo ↔ Ritmo | Transição curta, valores/período/fonte preservados e nova modalidade com estado coerente | NOT_RUN |
| D06-17 | Ritmo daily test | Somatório de dias = despesa total em centavos; acumulado final fecha, inclusive dias sem gasto | NOT_RUN |
| D06-18 | Ritmo slider e teclado | Guia, ponto, data, dia e acumulado mudam no mesmo estado; slider não desmonta sob arrasto | NOT_RUN |
| D06-19 | Ritmo comparativo | Mostrar anterior somente com janelas equivalentes e cobertura, nunca em outubro fixture | NOT_RUN |
| D06-20 | Histórico truncado | Marcar parcial e remover comparação enganosa | NOT_RUN |
| D06-21 | B01 íntegra | Faixa segmentada **e** lista com hue, ícone SVG D05, percentual de total e barra normalizada ao maior; não omitir faixa apesar de mock | NOT_RUN |
| D06-22 | Assinaturas e subcategoria | IDs canônicos preservam repeat-2 hue282 (pai) e tv hue270 (filho) entre D06, B01/B02 e D05 | NOT_RUN |
| D06-23 | Categoria desconhecida/custom | Fallback determinístico, mantém rótulo, nunca palette[index] | NOT_RUN |
| D06-24 | B02 anel 360° | Resumo sem bolinha temporal, >100 mostra excesso, limite=0 e null diferentes, sem cálculo inválido | NOT_RUN |
| D06-25 | Janela semana vs orçamento mês | Orçamento usa mês correto, não muda de limite para sete dias por acidente | NOT_RUN |
| D06-26 | Alimentação bancária | R$760/700 = R$60 de excesso; hue da categoria distinto de vermelho de alerta | NOT_RUN |
| D06-27 | Agenda | Vencidos/hoje/próximos sete dias derivados de planejamento; nenhuma cobrança prevista torna-se POSTED | NOT_RUN |
| D06-28 | Movimentações bancárias | Somente POSTED e naturezas elegíveis, amostra visual distinta dos totais do período | NOT_RUN |
| D06-29 | Detalhes por clique | Drawer real/navegação D05/D04/Planejamento, sem implementação de editor duplicado ou escrita inadvertida | NOT_RUN |
| D06-30 | Valores ocultos | Todas UI/SVG/tooltips/aria/drawers/legendas/espessuras sensíveis mascaradas | NOT_RUN |
| D06-31 | Saldo parcial | Exibir contas conhecidas x ausentes e idade de atualização, não somar indisponíveis como zero verificado | NOT_RUN |
| D06-32 | Grant denied/stale/expired | Sem dados pessoais fictícios após revogação, aviso contextual, sem interpolar entre perfis | NOT_RUN |
| D06-33 | Dados demo | Marcados como sintéticos; não persistir em perfil real | NOT_RUN |
| D06-34 | Dark/light | Neutro premium em ambos, sem wash verde, contraste de textos; cores por descriptor D05 | NOT_RUN |
| D06-35 | Reduced motion | Sem pulso, sem navegação animada, mesmo conteúdo/ações/foco | NOT_RUN |
| D06-36 | Teclado e acessibilidade | Foco visível, SVG fallback control, slider, Enter/Space/Escape, focus trap/restore e leitor de tela | NOT_RUN |
| D06-37 | 1366×768,1920×1080 | Fluxo/gráfico/lente/categorias sem sobreposições, texto BRL não truncado | NOT_RUN |
| D06-38 | Zoom125/150/200 e viewport estreito | Empilhar lens, navegação e cards mantendo leitura sem clipping financeiro | NOT_RUN |
| D06-39 | GPU limitada | Sem uso contínuo de requestAnimationFrame, baixo consumo idle, fallback rendering | NOT_RUN |
| D06-40 | Regressão integração | D01–D05, B01–B05, CI/TS/SQLite/permissões/ASAR/Windows verificados sem quebra | NOT_RUN |
| D06-41 | Fidelidade visual | Capturas Electron comparadas com AppBlock V3 na conversa; diferenças registradas | NOT_RUN |
| D06-42 | PR de código | SHA/branch/owner, status PASS FAIL NOT_RUN e logs reais; EXE só com autorização | NOT_RUN |

## Evidência de implementação exigida

- Screenshots Electron Windows x64 **1366×768 e 1920×1080**, dark/light, saldo visível/oculto.
- Vídeo de 15–30s mostrando **primeira revelação do Fluxo**, seleção de Alimentação e Moradia, foco cruzado com B01, pulso sob demanda, botão Reproduzir e alternância Ritmo.
- Vídeo do slider Ritmo movido por mouse e teclado com ponto/guia/lente em sincronia; repetir em reduced motion e confirmar mesmos valores finais.
- Screenshot de fluxo com receita menor que despesas, histórico parcial/sem acesso, 0 orçamentos, limite zero, fonte manual sem conta bancária e lista B01 faixa proporcional.
- Logs de testes determinísticos em centavos do fixture, isolamento de fonte, comparações seguras e duplicidade financeira.
- Matriz PASS/FAIL/NOT_RUN **preenchida pelo Executor**. Se algum teste não puder executar, deixar NOT_RUN com motivo específico. Não marcar como PASS por inferência a partir da aprovação do design.
- Links para PR, HEAD, arquivos alterados, testes reais, scripts CI, screenshots Electron e regressões B01/B02/D05.

**Gate:** DESIGN_APPROVED ≠ IMPLEMENTATION_READY (protótipo standalone ainda não exportado) ≠ IMPLEMENTED ≠ VISUAL_QA ≠ HOMOLOGATED. O proprietário autorizou o **design** ao responder “Autorizado”; não autorizou implicitamente escrita IA, merge, CI pago ou geração de EXE.
