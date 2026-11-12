# MF2 — Brief criativo de Redesign Premium, conectado à Inteligência

**Missão:** elevar radicalmente a qualidade percebida do Meu Financeiro, preservando correção financeira e tornando o assistente protagonista de tarefas reais. Referências são de **direção**, não templates para copiar. Pode propor soluções originais superiores. A validação é feita no Electron real e sempre com contratos IC v1.

## Referências e aprendizado pretendido

| Referência | Inspirar-se em | Evitar |
| --- | --- | --- |
| **Despezzas** | Superfícies limpas, dark/white premium, densidade equilibrada | Reprodução literal da identidade, componentes ou assets |
| **Copilot Money** | Gráficos e visão de gastos com drill-down, sensação de produto refinado | Cards sem dados autoritativos |
| **Monarch Money** | Informação modular, filtros, colaboração entre diagnóstico e ação | Confundir categorias e fontes; excesso de cards |
| **Origin** | Organização de informações financeiras complexas com clareza | Representar previsão como saldo confirmado |
| **Linear** | Microinterações, navegação, tipografia, foco e velocidade de interface | Complexidade visual que esconda prioridades |
| **Actual Budget / Lunch Money** | Regras práticas, revisão, transparência dos dados | UI de tabela genérica e botões sem resposta |

Explore outras referências contemporâneas quando ajudarem, anotando o que foi observado e como foi adaptado sem copiar. O foco do produto é **controle que vira decisão**, não quantidade de gráficos.

## Nova experiência desejada

- **Inteligência Hoje**: topo com 1–2 decisões úteis, Radar real, acesso à revisão e sugestões; fonte/período e limites de cobertura claramente visíveis; cards conduzem a uma ação.
- **Conversar**: chat fluido, leitura fácil, resposta com números rastreáveis, cards interativos, contexto de página, proposta prévia e recibo. Drawer e tela inteira oferecem continuidade.
- **Movimentações**: lista moderna com categoria acessível, seleção rápida, filtros claros, abertura da revisão e opção contextual **+ Nova categoria** sem perder dados do lançamento.
- **Visão Geral**: quatro conceitos separados (saldo conhecido, receitas, despesas, resultado), tendências com dados confiáveis, próximos compromissos, pontos de atenção e cliques que abrem o detalhe correspondente.
- **Orçamentos**: preservar cálculos e semântica do velocímetro B3; testar geometria alternativa e apresentar comparação antes de substituir.

## Diretrizes de qualidade

- Dois temas igualmente tratados; contraste suficiente, legibilidade e foco visível.
- Cores semânticas preservadas: vermelho para despesa/perigo, verde para positivo, âmbar para atenção, neutro para desconhecido. **Hover não transforma despesas vermelhas em verdes**, não desenha bordas duplicadas, nem escala exageradamente.
- Tipografia e espaçamento com hierarquia consistente; não criar layout com aparência de formulário padrão do Windows. Ícones do mesmo sistema, dropdown alinhado, cantos e sombras coerentes.
- Motion sutil e rápido como feedback funcional: entrada contextual, clique, loading, confirmação, transição de dados; respeitar prefers-reduced-motion; não animar cálculo como se fosse estável quando está atualizando.
- Na ausência de fonte, card mostra estado vazio/proteger CTA — **nunca gerar números fictícios para preencher o layout pessoal**.
- Preservar informações importantes, acessibilidade de teclado, leitores de tela e responsividade; 1366x768 e 1920x1080 como checks visuais prioritários, com dimensões reais comprovadas (não viewport emulado).
- Componentes premium devem reduzir esforço: CTA claro, filtros/estado preservados, retorno natural, navegação coerente e conferência fácil dos registros afetados.

## Liberdade criativa com fronteiras

**Pode** inventar formatos originais de radar, listas, preview, gráficos e layout; testar novas composições; substituir componentes visuais sem preservar geometria antiga por apego. **Não pode** inventar funcionalidades, valores, scores, fontes, alertas, callbacks ou contratos inexistentes. Prototipagem visual pode usar dados sintéticos **explicitamente sinalizados**, mas não é aceite da feature até consumir o serviço real.

## Definição de pronto de cada componente

1. Card contém ID de contrato UI-xx e fonte de dado do IC v1.
2. Dados carregam por serviço real (ou fica claramente desativado).
3. Botão executa ação demonstrável, ou é desabilitado com motivo.
4. Há carregando, vazio, sem permissão, erro, stale e sucesso conforme aplicável.
5. Tema claro/escuro, 1366/1920, foco e reduced-motion verificados de forma proporcional ao escopo.
6. Screenshot Electron de antes/depois com commit e dimensão real + teste de interação + log curto no PR.

**Antipadrão a rejeitar:** redesenhar uma tela inteira com 20 cards visuais antes de haver 3 cards funcionais de ponta a ponta. Priorizar um trio excepcional e expandir.