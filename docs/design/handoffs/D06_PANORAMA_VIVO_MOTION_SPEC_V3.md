# D06 V3 — Motion & Interaction Contract / Panorama Vivo

**Aprovado 17/11/2026** para a Visão Geral. Fonte interativa: `AppBlock id="mf-d06-motion-v3"`, raiz `#d06motion`. A V3 conserva a composição V2 e adiciona movimentos baseados em dados, não loops decorativos.

## 1. Linguagem aprovada

1. **Revelação das rotas** (`Fluxo`): caminhos surgem gradualmente após carregar snapshot verificado. SVG não altera espessura por interpolação de dinheiro antes da reconciliação. Caminhos espessos são proporcionais aos valores, dentro da mesma base e unidade.
2. **Pulso de conexão**: uma pequena partícula esmeralda/cor da categoria viaja **uma vez** ao longo da curva de origem para destino quando mapa é aberto ou botão `Reproduzir fluxo` é usado. Após selecionar categoria, pulso somente da seleção, com demais em baixa opacidade ~.14.
3. **Lente sincronizada**: categoria/resultado selecionado altera cor de foco, título, valor, participação, trilho e CTA no mesmo commit do estado. Seleção na lista B01 é **o mesmo ID** do mapa, e destaques se refletem mutuamente.
4. **Ritmo arrastável**: usar input range/keyboard e marcadores gráficos discretos; dia selecionado move guia vertical, ponto, data, gasto diário/acumulado e lente. Não somar valores interpolados visualmente como base de cálculo.
5. **Troca Fluxo ↔ Ritmo**: crossfade e translateY 6–9px, não desmontar estado de source/period/privacy. Conteúdo chega legível mesmo sem animação.
6. **Análise detalhada**: drawer aparece à direita sem deslocar contexto (focus trap, Esc, fundo, restauração de foco).
7. **Sistema**: neutro carvão; glows localizados e limitados ao ponteiro; nenhum efeito contínuo que concorra com leitura.

## 2. Tabela de movimento

| Interação | Efeito | Alvo (ms) | Redução de movimento |
| --- | --- | ---: | --- |
| Primeira montagem de panorama | opacity 0→1 + translateY(8px) | 300–450 | instantâneo |
| Revelar streams validados | path reveal do SVG (mask/clipPath ou stroke respeitando largura real) | 850–1150 | traçado completo |
| Pulso de caminho sob demanda | partícula pequena ao longo do SVG getPointAtLength/path geometry | 700–950 | não renderizar |
| Pulso de entradas múltiplas | stagger de 60–85 por conexão, uma passagem | 1000–1500 no total | não renderizar |
| Seleção de categoria | fluxo selecionado opacity 1, outros ~.14, glow local | 170–300 | mudanças de contraste imediatas |
| Atualizar lente e lista B01 | crossfade/translateY(6px), barras width | 230–450 / 550–750 | estado final imediato |
| Toggle Fluxo/Ritmo | crossfade de visual e lens, mesma viewport | 250–380 | troca imediata |
| Slider Ritmo | guia/ponto tween de t anterior→novo, valor animado do acumulado | 450–600 | posição/valor imediatos |
| Hover card/linha | translateY(−1..−2px), border/contraste | 150–220 | sem deslocamento |
| Drawer | scrim fade + translateX(25–35px) | 220–300 | abre instantaneamente |
| Reproduzir fluxo | reinicia stream reveal + pulso, **somente se solicitado** | 850–1500 | desenho estático |
| Alterar source, period, account, grant | invalidar UI anterior e resolver novo snapshot | não interpolar entre perfis | instantâneo, com skeleton se necessário |

Duração alvo ≠ tempo obrigatório de bloqueio. Nenhuma tarefa financeira pode depender da animação terminar.

## 3. Especificações de sincronização e performance

**Um estado único:** `{source,period,asOf,snapshotVersion,coverage,mode,selectedCategoryId,selectedDay,privacy,motion,drawer}`. Derivar `selectedModel` de uma única fonte de verdade; lentes, labels e barras são projeções desse modelo.

- Converter cálculos financeiros a **integer cents** antes de render. Interpolar *apenas números de apresentação* e ao fim mostrar centavos exatos. Sob nova seleção, cancelar RAF de números, guia/ponto, path pulses e divulgação anterior; última interação sempre vence.
- SVG stream geometry: stroke-width proporcional ao valor do **mesmo universo conciliado**; quando despesa excede receita, mudar base/labels e mostrar déficit fora da falsa distribuição. `getTotalLength`/`getPointAtLength` válidos somente no caminho montado, sob checagem de presença/transform; não manter loops rAF permanentemente.
- Ao aplicar nova seleção, não recriar o snapshot nem recarregar banco ou IA; atualizar somente derivação local e sinalizar estados carregando/sem dados. Não usar `setTimeout` para modificar contabilidade.
- Se saldo/categoria muda por autorização revogada, parar RAF imediatamente e limpar valores antigos. Sem interpolação de dados pessoais de um perfil em outro.
- Limitar partículas à duração curta, não criar DOM sem limpar ao fim/unmount; evitar sombras pesadas sobre todos os SVGs, especialmente GPU desabilitada.
- O modo Ritmo com saldo oculto **não** deve revelar valores em posições absolutas do gráfico nem tooltip/ARIA: renderizar estado mascarado em vez de manter escalas que expõem magnitudes.
- Se range move repetidamente (arrasto de ponteiro), aplicar cálculo rápido/último-estado-vence (pode usar coalescing pelo frame), nunca travar o thumb por remount do input.
- Não emitir `aria-live` a cada centavo intermediário. Anunciar valor final e data com texto conciso após completar a escolha.

## 4. Acessibilidade

- `prefers-reduced-motion: reduce` tem prioridade sobre configuração in-app. Mesmo modo reduzido, todas as rotas, categorias e dias devem continuar selecionáveis e os valores finais iguais.
- Caminho SVG clicável tem label semântico, `tabindex=0`, `role=button`/preferência a controles externos com Enter/Space, foco visível. **Não** depender só de hover ou cor.
- Slider de Ritmo informa dia, data do calendário, gasto diário e acumulado, com foco/teclado e sem leitura de transições intermediárias.
- Drawer trap de foco, Esc, backdrop, retorno ao gatilho. O app produtivo deve reutilizar abstrações já existentes quando possível.
- Privacidade oculta em todos os locais (textos, paths com valores por espessura também podem revelar magnitudes — **ocultar o mapa e ritmo em vez de deixá-los visíveis**); tecla de esconder valores não deve persistir informação legível num canvas anterior.
- Contraste dark/light, magnitudes BRL com tabular-nums, escalas/legenda textuais e símbolos independentes de cor.

## 5. Visuais, fallback e validação

**Tokens aproximados da V3**: dark `#141416` canvas, `#1b1c1f` card, `#222429` raised, `#32353a` border, `#f6f7f8` text; esmeralda `#55d69b`, vermelho `#fd7c88`, âmbar `#f2bb70`. São referências de acabamento e devem ser mapeadas aos tokens compartilhados reais. Cores de **categoria** sempre vêm de descriptor D05.

**States**: `loading` sem valores; `verified` render; `partial` apenas métricas elegíveis, sem reconstituir fluxo falso; `stale` mostrar consulta e limitação; `denied/expired/error` oferecer reconectar/retry; `empty` sem animação de zero fake; `privacy` texto/geometry mascarados; `negativeNet` origem relabel para gastos e déficit próprio.

Testar fisicamente 1366×768, 1920×1080, zoom 125/150%, Chromium do Electron 45, Windows com software rendering, CPU throttling e sequências de 20 cliques/slider. Precisam existir capturas/vídeo de normal/reduced-motion antes de `VISUAL_QA_PASS`. **Nenhum desses testes foi executado por este handoff documental.**
