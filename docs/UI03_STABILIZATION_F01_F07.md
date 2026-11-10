# Entrega corretiva UI-03 — auditoria independente F01–F07

**Candidata:** `0.9.5-beta.6`. **Base encadeada:** `feat/ui-daily-redesign-b07` / PR #11, commit `53ae436bc978acc902e63c0e804488a293538ecf`. **Branch:** `fix/ui03-audit-f01-f07`. Não mesclar diretamente em `main`. A beta.5 permanece intacta.

## Rastreabilidade ao parecer recebido

| Achado | Correção aplicada | Critério de qualidade |
|---|---|---|
| F01 P1 — saldo desconhecido como R$0 | `bankBalanceCoverage` distingue contas conhecidas, ausentes, saldo em centavos e total parcial; indicador de Visão geral usa `displayValue` e não mostra zero quando nenhum saldo foi informado. Resumo rápido usa o mesmo contrato | Sem contas conhecidas: “Saldo indisponível”; uma de duas: “Parcial”; zero conhecido: R$0,00; completas: soma exata |
| F02 P1 — versões/testes | Herdada a correção da PR #11; ambos `package.json` passam a beta.6 em conjunto; três labels iguais. Testes E1/B02/UI03 usam o contrato atual, não pins históricos | Paridade Windows/PWA e renderer explícita |
| F03 P2 — donut ilegível | Legenda empilhada sob o donut, nomes com quebra por palavras, valores e percentuais em linha secundária; mantém top 5 + Outras e lista completa | Sem quebra forçada de nomes comuns; valores preservados |
| F04 P1 — navegação reduzida sem nome | `navItem` tem `aria-label`, `aria-current`, `title` e botão tipado | Nome em todas as larguras/zoom |
| F05 P2 — Escape em calendários | `SingleDatePicker` e `PeriodPicker` consomem Escape quando abertos, devolvem foco ao gatilho e suportam setas/Home/End na grade de dias; datas escolhidas devolvem foco | Primeiro Escape fecha o popup, segundo fica com diálogo dono |
| F06 P2 — calendário maior que 320px | Geometria usa largura máxima do viewport (com 10px de margem), CSS `box-sizing:border-box`, popover acima do diálogo, grid e configurações sem `min-width` fixo em telas estreitas | Calendário cabe em 320px; restante requer smoke real |
| F07 P2 — respostas concorrentes | Lock síncrono por `accountId|externalId`, sinalização de pendência e controle desabilitado; fila ordena writes IPC entre contas, inclusive em respostas demoradas; erro libera o lock | Não há segundo save simultâneo para mesma transação; snapshots chegam em ordem e erro não prende o campo |

## Execução local real, sem dados pessoais

**Fontes:** snapshot de auditoria do PR #11 com SHA Git comparado a `src/app.ts` e `src/plan-view.ts`; testes anteriores de PR #11 reconciliados com os commits recentes de versão. TypeScript **5.8.3**, Node **22.16.0**, `NODE_PATH` apontado para TypeScript global da mesma versão. SQLite do Node em fixture temporária.

- `npm run test:types` — **PASS**, zero erros.
- `npm run compile` e `node --check app/app.js` — **PASS**.
- `npm run test:db` — **186 PASS / 0 FAIL** (180 testes anteriores + seis casos focados F01–F07).
- `cd mobile-push && node --test test/*.test.js` — **129 PASS / 0 FAIL**.
- Novo arquivo: `tests/ui03-stabilization.test.cjs`; valida valores nulos, parciais, zero conhecido, acessibilidade da navegação, geometria dos calendários, Escape, composição do donut, dupla intenção e fila IPC com duas contas e mesmo ID externo.
- Código `src/app.ts`, CSS e ambos manifestos do GitHub **conferidos por hash de objeto Git** iguais aos arquivos validados localmente.

**Não concluídos:** Chromium headless local excedeu timeout (não existe aprovação visual nova); smoke Electron/NVDA, `wrangler deploy --dry-run` (ferramenta ausente), `@electron/asar` real, CircleCI e instalação Windows. Em especial, o teste da fila usa IPC simulado, não uma validação do processo principal real. O gate ainda exige revisão visual em 320/683/910/1366px e zoom 150/200%.

## Limites e continuidade

- Não altera SQLite/schema, `shared/`, código do Worker, Pluggy, cloud cutover, credenciais ou motores financeiros. `mobile-push/package.json` muda **somente a versão**, sem deploy.
- Mantém F08 (proveniência independente contra bundle stale), F09 (integração completa) e F10 (acabamento tipográfico/vocabulário) na fila. A conclusão de B03/B04 requer testes assistivos e visuais reais.
- **Não solicitar build Windows pago** só pela existência deste PR. Primeiro validar os logs de preflight da branch com SHA exato, smoke e proveniência, e autorizar explicitamente o job.
- Não publicar release, instalar sobre SQLite pessoal ou mesclar enquanto os PRs encadeados estiverem em draft.

**Estado:** correções e testes automatizados locais implementados; homologação visual/Windows pendente.
