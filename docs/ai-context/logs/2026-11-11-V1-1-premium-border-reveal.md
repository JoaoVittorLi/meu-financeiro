# V1.1 — Hover Premium / Border Reveal + Scale-Up

**Missão:** V1.1, correção visual Premium dirigida. **Branch:** `feat/mf2-int1-ai-workbench-integration-20261111`. **PR:** #39. **HEAD inicial:** `19d15bb9303e98bac5147f376d1461f86fcaee25`. Data: 11/11/2026.

## Implementado

- `app/premium-interactions.css`: somente `.u1-shell .u1-overview > .stats-grid > :is(.u1-balance,.u1-metric)`. Mantida a linha de 3px no topo, a superfície e a tipografia existentes. Pseudoelemento `::after` com anel de 2px, `conic-gradient` progressivo de 0° a 360° com `@property` e máscara `content-box` / `mask-composite: exclude`. **Não pinta o fundo**. Hover/foco: `translate3d(0,-2px,0) scale(1.022)`, duração 230–235ms, sombra existente da Visão Geral. A animação de entrada passa a liberar `transform` após revelar o card (`animation-fill-mode: backwards`), eliminando interferência com o hover. Saída retorna pela mesma transição.
- **Cor por indicador:** saldo teal `--u1-accent`, receitas `--green`, despesas `--red`, resultado positivo `--green`, negativo `--red`, neutro `--u1-accent`. Fora disso, nenhuma alteração de dados ou cálculos.
- `src/app.ts`: apenas grupos KPI (`role=group`, `tabIndex=0`) e classes de apresentação do resultado conforme sinal do valor já calculado. Os controles internos do saldo também recebem sinalização `:focus-within`. `:focus-visible` e `prefers-reduced-motion: reduce` preservam borda e removem escala/animação.
- `tests/v1-1-overview-border-reveal.test.cjs`: seis testes de contrato para seletor localizado, cor, fundo intacto, máscara/reveal, escala, entrada, navegação por teclado, movimento reduzido e ordenação do CSS. `app/overview.css` (grid/estilos-base) e `app/intelligence.css` não foram alterados, preservando D1.5.1/U5.1.1/U5.2.1/I1-B.1.

## Evidência de execução (não confundir com Electron)

1. **17/17 PASS (0 FAIL)** de testes de contrato em harness V8 que executou os dois arquivos versionados `tests/v1-1-overview-border-reveal.test.cjs` (6/6) e `tests/d1-5-interactions.test.cjs` (11/11) contra as fontes obtidas do GitHub. Isso confirma compatibilidade com os contratos D1.5 no nível estático, **mas não equivale ao runner Node nem ao preflight do repositório**.
2. **8/8 PASS** de prepublish checks CSS e **4/4 PASS** de verificações de alteração dirigida do código TS.
3. **Chromium 144 headless real**, página sintética HTML/CSS com os seletores da implementação: sete cenários normal/hover em tema escuro/claro, 1366×768 e 1920×1080, zeros, valor longo e reduced-motion, além de quatro hovers semânticos e respectivas saídas, resultado negativo, resultado neutro e foco por teclado. Total **24 PNGs** e **29 snapshots de estilos computados** registrados no manifesto JSON de QA, disponibilizados como anexos da resposta ao proprietário (não anexados ao GitHub).
4. No caso escuro 1366×768, card Despesas: computed background RGB(23,28,34) idêntico em normal e hover; width 281.48px → 287.68px, matriz de transform = scale(1.022) + translateY(-2px), progresso da borda 0deg → 360deg, sem sobreposição de bounding boxes. Em `reduced-motion`, transform = none e a borda continua revelada. No mouseout retorna a 0deg e transform none.
5. Comparativos antigos/novos reais do **Chromium em fixture sintética**; **NÃO** são screenshots da aplicação instalada. Importante: este Chromium gerenciado anuncia `hover:none/pointer:none`; o harness injetou exclusivamente a mesma regra de hover de desktop fora da media query para simular ponteiro fino. A produção mantém a media query para mouse e não afeta touch.

## Pendências e decisão

- **Homologação real Electron Windows/Linux com GUI, incluindo capturas autênticas do aplicativo**: **NÃO EXECUTADA** (não há checkout Electron nem ambiente gráfico com o app neste executor). Consequentemente, alinhamento V1-02 e possíveis colisões com o chat lateral I1-B.1 (V1-03) **não estão visualmente certificados na aplicação inteira**. Não houve mudança especulativa na aba Inteligência; a alteração CSS é estritamente escopada aos quatro KPIs.
- Gates oficiais Node/SQLite/TypeScript/F08/ASAR e CI após o HEAD desta missão: **NÃO EXECUTADOS / PENDENTES**. Os testes isolados e Chromium não substituem preflight.
- **Status V1.1: código e regressões publicados, teste visual sintético realizado, homologação visual Electron pendente. Não liberar Windows Preview, não gerar EXE, não fazer merge.**
