# MEU FINANCEIRO 2.0 — B05 / Inteligência Geral — HANDOFF FINAL DE DESIGN

> **DESIGN_APPROVED / IMPLEMENTATION_HANDOFF_READY** — aprovação explícita do proprietário em **16/11/2026**: "Melhorou bastante, vou aprovar. lembre de deixar bem documentado as alterações e os caminhos para o integrador/executor nao gerar erros quando for implementar o design".
>
> **O DESIGN APROVADO É COMPOSTO:** **HOJE = Pulso Financeiro V6**, **CONVERSAR = Intelligence Alive V5**, **PLANO DE AÇÃO = Intelligence Alive V5**. Navegação, cores e motion V5 são compartilhados. **A V6 apresentada em chat simplificou as outras duas abas como suporte para demonstrar Hoje: NÃO copiar essas simplificações para Conversar/Plano.**
>
> **Estado técnico NÃO VERIFICADO:** nenhuma alteração de UI produtiva, build Windows, smoke Electron, merge, release, gravação de dados pessoais ou homologação realizada por esta entrega. Não marcar IMPLEMENTED/QA_PASS com base apenas nestes documentos.

**Projeto:** JoaoVittorLi/meu-financeiro, privado. **Issue-mãe QA:** #84. **Integração:** PR #76. **Coordenação:** #49. **Pacote de design:** PR #57, branch `design/mf2-screen-by-screen-20261113`. **Base real lida para mapeamento:** PR #76 HEAD `1bc1b89bf5bdefc0196b0851e690a99f825ca85a` (confirmar HEAD antes de iniciar; não assumir SHA eterna). **Antes de mudar o código:** ler [MAPA_DE_IMPLEMENTACAO](./B05_INTELLIGENCE_IMPLEMENTATION_MAP_V6.md), [MOTION_SPEC](./B05_INTELLIGENCE_MOTION_SPEC_V6.md), [ACCEPTANCE](./B05_INTELLIGENCE_ACCEPTANCE_V6.md), [FIXTURE](./B05_INTELLIGENCE_FIXTURES_V6.json).

## 0. Fonte canônica / qual versão respeitar

| Superfície | Versão fonte | Estado do design | Elementos aprovados |
| --- | --- | --- | --- |
| Hoje | **B05 V6 — Pulso Financeiro** | **APROVADO** | Hero editorial, anel clicável com três componentes, linha do tempo selecionável, drawer de pagamentos/margem/folga, sinais com mini visuais e interação |
| Conversar | **B05 V5 — Intelligence Alive** (base V4) | **APROVADO como composição B05** | Chat **100% protagonista**, histórico **oculto por padrão** em drawer, composer persistente, conversas, sugestões contextuais, respostas ricas e motion discreto |
| Plano de Ação | **B05 V5 — Intelligence Alive** (base V4) | **APROVADO como composição B05** | Insight/decisão protagonista, fluxo de dinheiro vivo, alternativas em cards, etapas **Entender → Simular → Revisar**, preview/consentimento supervisionado, drawers |
| Sistema compartilhado | **B05 V5** | **APROVADO** | Sidebar MF2, navegação Hoje / Conversar / Plano de Ação **visível**, tema dark/light, microinterações, controle de movimento |
| D03 Hoje V2 anterior | D03 V2 issue #61 | Aprovado anteriormente | **Reutilizar motor e regras de dados.** Para a área B05, composição visual de Hoje é **substituída** pela B05 V6, não pelos mocks da V1 |
| D04 Central de Revisão | D04 V1.1 issue #67 | Aprovado anteriormente | Não recriar nem substituir. Navegar para a Central com proposta e capability reais, nunca gravar de forma implícita |

**Referências de protótipo aprovadas na conversa do proprietário:** widget interativo `AppBlock id="mf-hoje-pulso-v6"`, raiz `#mf-pulso` (Hoje), e `AppBlock id="mf-b05-alive-v5"`, raiz `#mfAlive` (Conversar/Plano). **Atenção:** AppBlock é referência interativa na conversa e **NÃO é, por si só, arquivo HTML exportado para o repositório**. Este conjunto de arquivos do GitHub documenta estrutura, comportamento, números, CSS e testes. Não alegar que um novo renderizador é pixel-perfect sem comparar visualmente com a referência aprovada pelo proprietário.

## 1. Mudança exata — hierarquia da tela

**Antes:** `src/intelligence-view.ts` mostra cabeçalho técnico, `Permissões de consulta`, botão permanente `Central de revisão`, e os modos Hoje/Conversar/Plano escondidos sob `Mais ferramentas`. Histórico lateral já é condicionado a `intelligenceHistoryOpen`, mas o chat não domina a página como solicitado.

**Depois (B05):**
1. Cabeçalho compacto `Inteligência`, data/período do contexto, 3 destinos de primeira linha `Hoje | Conversar | Plano de Ação`; modo selecionado com estado/foco acessível. É **um único nível de navegação B05**, não duplicar tab strips internas. O produto aprovado B05 substitui a proibição de abas permanentes contida no D03 V2 de 13/11 para o **container B05**, preservando o D03 como contrato de conteúdo/dados.
2. Conteúdo inicia imediatamente com a experiência correspondente. Na vista Hoje, alto valor de informação na primeira dobra; Conversar ocupa a largura; Plano fornece foco e cenários.
3. Permissão de leitura aparece como status compacto e CTA contextual quando `denied/expired/partial/stale`. Não esconder controles necessários para conceder/revogar/renovar.
4. `Central de revisão` aparece somente como pendência/ação vinculada a dados e capability reais; não mostrar barra vazia permanente.
5. Laboratório, OAuth, memória e controles técnicos têm saída para `Configurações > Inteligência/Avançado`, preservando funções e sem colocá-los na tela inicial.
6. Nenhuma tela apresenta ID técnico `UI-01`, `OAuth`, `I2-*`, `D03` etc. ao usuário; essas strings são somente para QA e engenharia.

## 2. Hoje — especificação final visual B05 V6

### 2.1 Estrutura e hierarquia

- Sidebar: **a mesma sidebar real** do Electron (não criar outra). Na parte superior do workspace, navegação compacta B05.
- Intro: sobrelinha `16 NOVEMBRO / seu panorama` derivada do `asOf` e timezone, não fixa, título editorial de 1–2 linhas (`O mês ainda está em movimento.`) e subtítulo útil. Se os fatos suportarem outro período, adaptar texto e título.
- **Hero principal**: card neutro (nunca fundo verde sólido), borda sutil, filete esmeralda único no topo, raio ~22px, padding ~22px. Coluna editorial (~50%) com contexto, headline e oportunidade/alerta derivado. Coluna visual (~50%) com **anel segmentado**.
- **Anel**: fundo carvão/neutral; fatias **compromissos considerados** cinza azulado `#727c89`, **margem protegida** neutro claro, **folga** esmeralda. Centro: **saldo projetado até a data selecionada** + diferença frente à margem. Legenda com valores reais e alvos de clique. A cor esmeralda não colore todo card. **Sem bolinha opcional solta no anel** (o marcador pertence à composição técnica do gráfico de Hoje, não ao B02 aprovado e não deve criar uma quarta cor).
- **Rota dos próximos dias**: cartão de gráfico em degraus com 5 marcos ilustrativos 16, 21, 23, 28, 30/11/2026. A implementação deve gerar marcos a partir de fatos válidos de `asOf`, vencimentos e fim de período, nunca hard-code datas do mock. O gráfico tem linha, área discreta, indicador vertical e ponto que caminham até o dia escolhido; os botões de datas são alvos reais acessíveis, com `aria-pressed`.
- **Ficha do marco selecionado**: à direita do gráfico (ou abaixo no breakpoint), exibe evento, descrição, saldo projetado e link para os compromissos; mesma seleção do gráfico e do anel. Na referência aprovada a data inicial selecionada é **30/11** para mostrar fechamento, enquanto `Hoje` real é **16/11** — comunicar diferença, jamais marcar evento futuro como pago.
- **Sinais inferiores**: dois diagnósticos não duplicados: Alimentação (anel B02 mini, cor da categoria D05 separada do vermelho semântico da ultrapassagem) e Delivery (duas colunas de valores verificados; âmbar apenas no aumento). Cards neutros, com ícone D05 por ID, contexto, variação e drawer lateral.
- **Fechamento**: convite compacto à conversa e ao Plano de Ação, sem repetir grandes cards. Evitar metadata desenvolvedor.

### 2.2 Comportamentos e eventos

| Gatilho | Reação correta | Invariante |
| --- | --- | --- |
| Abrir Hoje com cobertura verificada | Resolver sinais; mostrar hero, anel e marcos reais | Sem valores hard-coded |
| Clicar em marco | Atualizar **juntos** ponto/guia, saldo central, fatias, legenda e ficha | Não altera saldo real nem status do pagamento |
| Clicar em fatia ou legenda | Drawer contextual à direita: compromissos considerados, margem ou folga, com evidência | Mesma data/conta/período em todos os valores |
| `Ajustar cenário` | Drawer de parâmetros simulados `saldo disponível` e `margem de segurança`, controles reais da UI | Overrides locais separados de fonte bancária; restauráveis |
| Alterar slider | Recalcular em centavos; atualizar visual e números sincronizados | Debounce apenas visual, sem criar centavos extras |
| Clicar sinal inferior | Abrir detalhe/evidência; CTA direciona para Plano B05 na decisão correlata | Sem “aplicado” sem recibo |
| Abrir Conversar a partir de Hoje | Preservar `scope`/`period`/foco de análise; composer do chat | Não criar conversa duplicada |
| Voltar ao Hoje | Conservar seleção enquanto `asOf`/grant/periodo válidos, senão revalidar | Nunca exibir cache pessoal após revogação |

### 2.3 Fórmulas (CENTAVOS, NÃO FLOAT)

A referência sintética V6 usa um baseline verificado do dia 16 com 3 compromissos futuros únicos, saldos constantes e zero novas entradas/despesas não listadas. Portanto, por data `t`:

- `committedThrough(t) = SUM(amountCents)` de compromissos **scheduled_unpaid, futuros a partir de asOf**, únicos por ID, vencimento `<= t`.
- `projectedAt(t) = availableBalanceCents + verifiedFutureIncomeThrough(t) - committedThrough(t) - otherPlannedOutflowsThrough(t)`.
- `protectedAt(t) = MIN(bufferCents, MAX(0, projectedAt(t)))`, **somente** quando buffer explicitamente definido.
- `headroomAt(t) = projectedAt(t) - bufferCents`, sinalizado mesmo quando negativo.
- `freeAt(t) = MAX(0, headroomAt(t))`. **Não** confundir com previsão de caixa total nem saldo bancário presente.
- `reserveSuggestion = MIN(freeAt(endOfWindow) / 2 arredondado com regra estável, cap configurado)`: sugestão limitada a até 50% da folga, **não transferência**.
- No anel de decomposição do **saldo inicial**, representar partes: `committedThrough(t) + protectedAt(t) + freeAt(t) = availableBalanceCents` **somente** no fixture sem outras entradas/saídas e com `projectedAt(t)>=0`. Se houver renda futura, despesas adicionais, insuficiência ou fonte parcial, **não usar esse anel triplo sem reconciliar entradas/saídas**: usar gráfico com componentes corretos (incluindo entrada/saída) ou estado parcial/insuficiência com valor de falta destacado; **nunca “fechar” visualmente a conta por clipping**.
- `computedEventCents` na ficha é **saldo projetado após compromissos até o marco**, não valor do boleto e não “saldo realizado”. O valor do boleto fica em campo secundário quando conhecido.
- Gráfico em **degraus** para vencimentos; se a data não tiver evento, segmento horizontal. Datas são ordenadas timezone `America/Sao_Paulo` no exemplo, mas em produção usar timezone/período da fonte apropriada. Eventos realizados não devem reaparecer como futuros.

**Acessibilidade e semântica:** chamar setor cinza `Compromissos considerados até [data]`, **não “Pagos”**. Datas futuras são projeções. Estado com saldo insuficiente, sem margem e sem eventos deve ser distinto de `R$ 0` verificado. O saldo disponível não se soma a saldo de outras fontes não reconciliadas.

### 2.4 Fixture de homologação dos números

No fixture canônico [JSON](./B05_INTELLIGENCE_FIXTURES_V6.json): `availableBalance=170000` centavos, `buffer=100000`, compromissos `11900+14500+17900=44300`.  
No dia 16: projected 170000, folga 70000 (se margem preservada).  
Dia 21: projected 158100; dia 23: 143600; dia 28 e 30: 125700.  
Fim: `headroom=25700`, reserva sugerida `12850`.  
Alimentação `76000/70000=108.5714%`, excesso `6000`; delivery `34000-23000=11000`, variação `47.826...%`. Formatar em pt-BR somente no renderer. Os valores são **dados fictícios de teste** e não podem entrar no perfil pessoal.

## 3. Conversar — manter V5 completa

1. **Chat protagonista**: largura máxima útil para mensagens e composer, sem painel permanente de histórico; topbar com botões **Histórico** e **Nova conversa**. Composer visível, rolando apenas transcript quando possível; renderer D02 com cards/diagramas/respostas ricos preservado.
2. Histórico abre em drawer por demanda, **recolhido por padrão**; reutilizar `intelligenceHistoryOpen` e os serviços de ``intelligenceSelectThread`, `intelligenceCreateThread`, `intelligenceDeleteThread`, `intelligenceClearHistory`` existentes. Não criar segundo armazenamento.
3. Contexto compartilhado com chat lateral D01: `intelligenceDraftScope`, `intelligenceContextSnapshot`, perfil, fonte, período, mensagens e histórico. Histórico arquivado NÃO é consulta pessoal ativa: respostas financeiras anteriores devem indicar `stale/unavailable` se grant não está mais válido.
4. Sugestões progressivas por IDs de fatos/sinais elegíveis, retiradas após uso ou substituídas por follow-ups contextuais; não apenas repetir quatro perguntas estáticas para todas as sessões. Não disparar chamada ao LLM ao mudar visual ou navegar.
5. Respostas com estado de streaming/loading/erro e visualização tipada da biblioteca D02 (26 famílias especificadas; respeitar as famílias realmente aprovadas/homologadas). Se IA externa indisponível, fallback honesto e resposta local verificada quando possível; **não dizer “IA respondeu” ao mostrar fixture**.
6. Entrada de mensagens com 200–280ms e interrupção por movimento reduzido. Novos itens só anunciam texto resolvido, não “digitam números” antes da validação; não mover transcript enquanto pessoa lê uma resposta antiga. Enter envia; Shift+Enter quebra linha; IME/composição preservada.

## 4. Plano de Ação — manter V5 completa

- **Um foco protagonista**, não 3 faixas numeradas iguais. Ex.: reserva, orçamento e aumento comparável; cada caso usa visual próprio: **Fluxo Vivo** (partição de saldo), **anel de orçamento**, **barras comparativas**. A composição neutra, bordas discretas e feedback de seleção são parte da aprovação.
- **Fila de alternativas** em cards secundários; clicar substitui o foco, revalida o contexto e reinicia a etapa relevante. Foco não altera orçamento nem aplica regra.
- **Etapas Entender → Simular → Revisar** controladas pelo estado local, com transição contextual. Em Simular, slider atualiza dinheiro/legenda/fatia sem recarregar tela inteira; no modo de categoria, o limite simulado não altera gasto realizado; no modo delivery, redução é hipótese, não economia observada.
- **Revisar** mostra antes/depois, escopo, origem, afetados e versão quando existir proposta real. Checkbox desmarcado. Prévia desatualizada ou capacidade indisponível bloqueia aplicar. O controle demonstrativo **Concluir prévia** NÃO é Apply real.
- Ações pessoais somente por serviço autorizado, com revalidação/receipt; D04 é autoridade de revisão de classificação/regras e D01 reconfirma. O plano não inventa capability de escrita nem dá “sucesso” sem retorno real.
- **Sem dados**: estado leve explicativo e navegação para Conversar/Permissões; não deixar 3 oportunidades estáticas.

## 5. Identidade visual e motion (não negociar)

- Usar tokens canônicos MF2 dark/light; [especificação D03 V2](../screens/d03-inteligencia-hoje/DESIGN_SPEC_APPROVED.md). Dark: `#141414` canvas, `#1a1a1a` surface, `#202328` raised, `#303034` borda, `#fafafa` texto, `#b1b1ba` secundário, positivo `#53d896`, desfavorável `#ff7a88`, alerta `#f5bc63`. Light: `#f4f4f6` / `#fff` / `#f4f4f5` / `#e5e5e8` / `#171717` / `#64646e`, positivo `#087e49`, desfavorável `#c92a3c`.
- Cards em **superfície neutra**. Evitar green wash ou usar cor verde como fundo opaco de todos os sinais.
- O ícone e a cor de **categoria** vêm **juntos** do descriptor global [D05](./GLOBAL_CATEGORY_VISUAL_IDENTITY_CONTRACT.md). Sinal financeiro `positive/negative/warning` é uma dimensão diferente: ícone de Alimentação usa `cat:alimentacao` hue 26, mas excesso de orçamento usa vermelho semântico; Delivery usa descriptor da subcategoria real quando disponível.
- Proporção V6 no desktop: Hero 2 colunas ~1:0.95 (22px padding), anel até 225px, rota 1.45:0.65, dois sinais lado a lado; no estreito passa a uma coluna e ficha do marco vai abaixo do gráfico. Breakpoints guiados por content width, sem duplicar sidebar.
- Motion: **animação por mudança de dados**, não brilho decorativo contínuo. Dinheiro e gráfico atualizam do **mesmo snapshot** no mesmo frame lógico. Ciclo financeiro de 550–900ms, easing `cubic-bezier(.22,1,.36,1)`; hover ~150–200ms; drawer ~220–280ms. Respeitar `prefers-reduced-motion` e ajuste de movimento do usuário. Sem barras, números ou eventos “vivos” enquanto ninguém interage.
- Ao alterar saldo no cenário, não animar o número de `R$ 0` se a nova fonte ainda está carregando; mostrar loading/stale até resolução. Usar `transform/opacity` quando possível, evitar reflow caro, cancelar animação anterior se evento seguinte chegar, usar chave `snapshotVersion + selectedDate + overrideVersion`.
- Ver [MOTION_SPEC](./B05_INTELLIGENCE_MOTION_SPEC_V6.md) para gatilhos, durações, sincronismo e fallback.

## 6. Segurança/integração (bloqueio)

A implementação deve usar o [contrato IC](../../ai-context/INTELLIGENCE_UI_CONTRACT_V1.md) e [comportamento D03](../screens/d03-inteligencia-hoje/BEHAVIOR_SPEC.md). **Isso não é um projeto novo de backend.**
- `IC-READ`: leitura só com autorização válida vinculada a perfil, fonte, janela e cobertura; `IC-REVIEW` permanece sintético se capability real assim indicar; `IC-PLAN` permite simulação e escrita manual distinta da IA; `IC-LLM` não tem permissão automática para alterar dados pessoais.
- Se `denied/none/partial/stale/expired/error`, só renderizar sinais suportados por fatos com cobertura suficiente; retirar previsão, reserva, prazos ou valor de saldo que não tenham base. Nenhum cache de grant anterior pode reaparecer como atual.
- Guardar overrides da UI em **estado de simulação** separado. Navegação não aplica. Revisar não aplica. Consentimento não é inferido do clique em card. Em produção não renderizar mensagens fake como se fossem IA real.
- Adicionar/alterar contrato somente pelo protocolo **CONTRACT-CHANGE PROPOSED** na issue #49; executor e Integrador definem versão/owner. Não sobrescrever `src/app.ts` / `src/intelligence-view.ts` de forma concorrente com outros PRs.
- QA financeiro e de renderer separados; **não desbloquear build, merge ou release** por aprovação do design.

## 7. Matriz de aceite

Testes detalhados em [B05_INTELLIGENCE_ACCEPTANCE_V6.md](./B05_INTELLIGENCE_ACCEPTANCE_V6.md). Gating mínimo: clicar datas e conciliar anel, ajustar saldo/margem, tratar saldo negativo/ausência de margem/zero budget, histórico recolhido, follow-up evolutivo, simular/revisar sem escrita, dados parciais/revogação, dark/light, teclado, Escape, 1366×768 e 1920×1080, zoom 125/150%, viewport mobile, animação reduzida e QA real Electron com capturas.

## 8. Declaração de conclusão do designer / handoff

**Aprovado:** desenho de todas as três áreas B05 (Hoje V6 + Conversar/Plano V5), identidade e motion, revisado pelo proprietário.  
**Publicado:** pacote de handoff, mapa de código, contrato de motion, fixture e critérios de aceite.  
**Não realizado nesta missão:** código produtivo, testes Windows, integração PR #76, compilação, evidências comparativas reais e alteração de dados.

**Ao Integrador:** abrir os links acima e registrar ownership do executor, base SHA atual, conflitos e ordem das fatias de implementação. A primeira entrega deve colocar os 3 modos na navegação sem regressão, depois Hoje V6, Conversar V5, Plano V5 e QA transversal. Não aceitar apenas CSS decorativo ou screenshots de mock como conclusão.
