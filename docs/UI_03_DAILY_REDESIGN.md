# Entrega 03 — Redesign do cotidiano (UI-03 / B05 + B07 parcial)

**Candidata de compilação Windows:** `0.9.5-beta.5`.
**Base imutável utilizada:** `feat/transaction-category-edit-b02` (PR #10), commit `342d54a08cd487a5d5dfff7ffd905e8a37c06757`.
**Branch isolada:** `feat/ui-daily-redesign-b07`.
**Status:** implementação de fonte preparada para revisão e preflight; não existe EXE homologado para esta candidata.

## Objetivo

Reduzir o tempo entre abrir o aplicativo, entender o saldo/compromissos e realizar a ação necessária, preservando as fontes originais e sem reescrever cálculos, banco de dados ou APIs.

## Escopo por tela

| Tela | Alterações realizadas | Critério de aceitação |
| --- | --- | --- |
| Visão geral | Fonte e período acima dos valores; valores acima do atalho do Planejamento; gráfico com eixo monetário adaptativo e tabela legível; donut agrupa Outras e permite ver todas categorias; conta resumida aparece abaixo dos gráficos | R$ 29,90 não renderiza cinco `0k`; dados da tabela e categorias somam os centavos do motor; balance de referência não é confundido com resultado do período |
| Movimentações | Microcopy compacta, tabela mais densa e interações B02 preservadas | Edição direta da categoria, filtros, histórico e split ainda funcionam, incluindo bancos com externalId igual e accountId diferente |
| Planejamento | Próximos sete dias acima do resumo; agenda completa antes do gráfico; hero reduzido; receitas incertas ainda excluídas por padrão | Compromissos vencendo dentro de sete dias aparecem com valores restantes; histórico e projeção não são contabilizados duas vezes |
| Orçamentos | Lista compacta em lugar de grade de cards, priorizando categoria/gasto/limite; texto esclarece o alcance por categoria | Não prometer limite mensal exclusivo enquanto `Data.budgets` for mapa global; zero explícito distinto de ausência |
| Simular compra | Cabeçalho e vazio compactados; mensagens de risco menos categóricas; premissas/resultados existentes preservados | Simular não cria obrigação; parcelas, juros e cenário continuam iguais aos do motor |
| Minhas contas | Saldos por conta primeiro, com última consulta; conexão técnica e métricas abaixo; saldo geral parcial identificado | Falta de saldo não vira R$0 confirmado; conta/código/credenciais não mudam |
| Inteligência | Identificar demonstração com texto curto; laboratório OAuth/memórias/testes e contexto sintético fica em `<details>`, fechado por padrão | Abrir laboratório não envia prompt; nenhuma proposta ilustrativa altera registros |
| Configurações | Tamanho/densidade reduzidos, cópia SQLite completa diferenciada de exportação manual, privacidade sem promessa absoluta de armazenamento somente local | Botões de backup, restore, nuvem e configurações continuam alcançáveis e com mesmas funções |

## Contratos de design system

Novos tokens semânticos em `app/style.css`: canvas `#0D0C12`, base `#17151F`, raised `#211D2C`, texto primário `#F4F1FA`, secundário `#BEB5CD`, muted legível `#9A90AA`, acento `#A981FF`, botão `#7540C8`, positivo `#67DCB3`, negativo `#FFA0B5`. Fonte do sistema Segoe UI, sem carregar fonte remota.

**Contrastes matemáticos calculados para pares principais (sem afirmar conformidade global):**
- Primário/base: 16,17:1;
- Secundário/base: 9,18:1;
- Muted/base: 5,97:1;
- Acento/base: 6,25:1;
- Branco/botão sólido: 6,32:1.

O teste `tests/ui-daily-redesign.test.cjs` calcula dinamicamente essas relações e impede regressões nesses tokens. Cores legadas, componentes não alterados, estados de foco e leitor de tela ainda exigem revisão assistiva separada. A meta WCAG 2.2 AA **não** é declarada concluída.

## Limites técnicos

- Não altera `electron/*`, `shared/*`, `mobile-push/*`, schemas, banco SQLite, sync/Cloudflare, Pluggy, autenticação, IA paga, feature flags, CircleCI ou `main`.
- B00/B01/B02 são pré-requisitos desta branch; não mesclar diretamente na `main` enquanto as dependências estiverem em draft.
- A nova apresentação usa os métodos e números existentes do ledger; não promete saldo disponível certificado quando fonte bancária está incompleta.
- `StyledSelect`, DatePicker, PeriodPicker e seus contratos avançados de ARIA continuam no backlog B03/B04. Estilos compartilhados aqui não equivalem à homologação de acessibilidade final.
- No planejamento, o bloco de sete dias é derivado de compromissos já cadastrados; não é novo motor de previsão e não inclui despesas não cadastradas.
- O contrato atual de orçamento por categoria tem alcance global; mensalização real exige migração e ticket próprio.

## Testes e aceite antes do próximo EXE

1. `npm run test:types`, `npm run test:db` e `npm run compile` (toda suíte de Node + E1/E2/E3/E4 e casos UI-03);
2. `cd mobile-push && npm test && npx wrangler deploy --dry-run` (não publicar);
3. Inspecionar diff e rodar smoke com fixtures sem SQLite pessoal, sem chamadas pagas, sem Pluggy e sem Cloudflare Production;
4. Conferir todas as oito rotas, overlays, menu de categoria, teclado, zoom 150/200% em 1366×768, janela estreita e `prefers-reduced-motion`;
5. Verificar dados extremos para gráfico: sem entradas, centavos, R$29,90, milhões; donut com mais de cinco categorias; saldos nulos/parciais;
6. Testar Planejamento com vencimentos dentro e fora dos sete dias, mês seguinte, pagamentos vinculados e receita incerta;
7. Conferir orçamento zero/ausente, compra parcelada, falha de persistência, recuperação, dados incompletos e texto correto de backup;
8. **Somente mediante decisão do usuário:** CircleCI manual na branch `feat/ui-daily-redesign-b07`, parâmetro `run_windows_build=true`, `preflight_linux` verde antes do runner Windows;
9. Conferir `verify-asar`, instalador e portátil `0.9.5-beta.5` + `SHA256.txt` do mesmo commit; instalar primeiro com `userData` isolado e banco descartável, após conferir backup;
10. Homologação real do Windows é gate separado; não publicar release, não ativar cloud ou integrar com `main` por consequência do build.

**Não alegar testes Node/Windows/Chromium executados até haver logs reais.** O documento define implementação e verificações esperadas, não validação do instalador.
