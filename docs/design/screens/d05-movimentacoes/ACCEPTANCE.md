# D05 V1.3 — ACCEPTANCE / QA

**Decisão do proprietário (13/11/2026):** DESIGN_APPROVED / IMPLEMENTATION_READY. A implementação Electron e a homologação ainda não estão concluídas. D05 é obrigatória no primeiro EXE experimental; a issue #74 permanece bloqueante.

## Verificações realmente executadas ao publicar o pacote

| Gate | Status | Evidência |
|---|---|---|
| 14 pais, 61 filhos e 67 SVGs | PASS | Catálogo e registry originais no GitHub |
| iconKey de todos os pais e filhos existe no registry | PASS | Verificação de chaves JSON |
| Cada filho aponta para pai existente | PASS | Verificação das 61 relações |
| JavaScript do prototype.html com sintaxe válida | PASS | Parsing isolado do script embutido |
| Fixture: entradas R$3.180,00, saídas R$1.788,80, resultado R$1.391,20 | PASS | Soma dos centavos, sem PENDING/transfer |
| Fixture: cinco POSTED sem revisão | PASS | b1, b4, b5, b9, b12 |
| HTML contém círculo custom, switch e indicador azul | PASS | Inspeção estrutural, não teste de browser |
| Chromium real, cliques, tabulação e screenshots | NOT_RUN | Fora do teste estático |
| Electron, SQLite, IPC e integração real | NOT_RUN | Responsabilidade Executor E1/E2/E3 |
| CI, ASAR, instalador Windows | NOT_RUN | Autorização separada do proprietário |

## Testes visuais obrigatórios antes da homologação do produto
- [ ] Abrir prototype.html em navegador real dark e light; confirmar que os títulos e valores nunca ficam ilegíveis. Capturar e comparar desktop 1366×768 / 1920×1080.
- [ ] Nome do comerciante legível (iFood, Mercado Central, Supermercado Avenida), conta e categoria em segundo plano, valor isolado à direita; vermelho para saídas, verde para entradas e transferência neutra.
- [ ] Revisão individual: ponto azul ao lado de iFood abre prévia; Agora não não muda estado; Marcar revisada remove ponto e diminui fila. Corrigir categoria abre o picker.
- [ ] Uber PENDING com relógio, excluído das entradas/saídas confirmadas e da fila apta de revisão; no detalhe status bancário e revisão separados.
- [ ] Card A conferir abre a fila correspondente. Filtro Revisadas mostra apenas itens pertinentes e não repete Confirmada na linha.
- [ ] Seleção circular de 1, vários e 0 itens, sem aparência de checkbox Windows; barra em lote aparece só com seleção.
- [ ] Agrupar por dia liga/desliga com switch premium, nunca checkbox; cada dia mostra apenas data e divisória, sem N registros.
- [ ] Clicar diretamente no ícone da categoria abre picker pai→filho; pesquisa funciona, Sem subcategoria equivale a null, mudança de pai limpa filho incompatível; confirmação antes de gravar.
- [ ] Reclassificação em lote mostra IDs, valores, contagem e novo destino, exigindo segunda confirmação; cancelar preserva estado.
- [ ] Busca, origem, mês, conta, natureza, ordem, lançamento manual, importação e detalhes respondem de forma coerente.
- [ ] Escape, clique fora, teclado Tab/Enter/Space, retorno de foco, popover perto do rodapé e bordas, zoom 125/200, redução de movimento e contraste AA.
- [ ] Loading, empty, stale, partial/truncated, denied e error em serviços reais; sem números inventados.

## Gates de engenharia bloqueantes na #74
**E1:** backup; migration aditiva/idempotente/atômica; >=630 transações sintéticas legadas; IDs de pais/filhos, filho null preservado, FK; restart/restore, rules/splits/budgets/plan, dois perfis, rollback.

**E2:** IPC explícito e seguro; MAIN valida pares categoryId/subcategoryId e versão; override bancário não modifica a fonte Pluggy; revisão POSTED ≠ PENDING; propostas de regras devem expor todos os affected IDs, previewVersion e reconfirmação; IA não faz escrita pessoal sem consentimento/autorização.

**E3:** interface de produção e testes reais, scripts do package.json: npm run test:types, npm run test:db, npm run test:asar, npm run test:electron-smoke, além de F08/ASAR, screenshots Electron dark/light e regressões D01–D04. Relatar PASS/FAIL/NOT_RUN por gate. Somente proprietário inicia CI/build pago após orientação do Integrador.

Status DESIGN_APPROVED não significa CODE_PRESENT, UI_CONNECTED, TESTED, HOMOLOGATED nem EXE_READY.
