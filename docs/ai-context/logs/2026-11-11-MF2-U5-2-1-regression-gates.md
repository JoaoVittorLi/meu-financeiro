# MF2 — U5.2.1 / regressões dirigidas e gates oficiais

**Data:** 2026-11-11. **PR:** [#38](https://github.com/JoaoVittorLi/meu-financeiro/pull/38), draft. **Branch:** `feat/mf2-u5-2-planning-simulator-20261111`. **Base:** PR #37 HEAD `5a4963133795182e5d73344c1ad6df0a78fa0bfb`; preserva D1.5.1 PR #36. **Commit funcional:** `d2032bd305aee0203c491c49c0d644d3ac1c696e`.

## P1 — Bloqueio de conversão de simulação antiga
**Causa reproduzida em código:** `setSimulation` preservava `outcome` com stale visual, mas `planSimulatedPurchase` não verificava a correspondência das premissas no momento da criação do compromisso. `renderResult` apenas bloqueava parcelas acima de 36.

**Correção:** função `canPlanSimulatedPurchase` única para UI e ação, exige modo real, bridge desktop, resultado de planejamento válido, input calculado existente e idêntico a `state.sim`, `isSimulationStale()===false`, ausência de erro e de request em andamento. Mesmo acionamento direto do método é rejeitado antes da janela `confirm`; exibe motivo/solicitação de recálculo, não apaga resultado anterior. Parcela, `out.firstDueDate`, `out.total` em centavos, confirmação e formatação do formulário de plano mantidas após recálculo válido.

## P2 — Natureza bancária efetiva no Planejamento
**Causa:** `pFilterTransactions` usava sinal `amount>0`; resto do aplicativo usava `effectiveNature(t)`, que respeita override de natureza.

**Correção:** linhas bancárias refletem `income/expense/transfer/ignore` da fonte comum; transferências entre contas e ignoradas mostram label neutro fora do fluxo. O calendário soma apenas income/expense e mantém `excluded` separadamente; não trata exclusão como pagamento realizado/esperado. Extrato original, nature persistida, ID composto `accountId|externalId` e motor financeiro intactos.

## Arquivos modificados
`src/app.ts`, `src/plan-view.ts`, `app/planning-productivity.css`, `tests/u5-2-simulator.test.cjs`, `tests/u5-2-planning.test.cjs`, `tests/decisions-u3.test.cjs`. Nenhum arquivo da Inteligência/Argon, Cloudflare/PWA, banco SQLite, migração, CI, main ou dados do usuário.

## Testes — evidência estrita
**Executados:** 8/8 cenários sobre os métodos reais `canPlanSimulatedPurchase/planSimulatedPurchase` em V8 com TS apagado no harness, e 10/10 sobre `pFilterTransactions/pCalendarDayInfo` em V8 sintético. Testaram bloqueio stale/snapshot ausente/busy/erro, recusa e aceite de confirmação, conversão de centavos/parcelas/data, override de sinal, transfer/ignore entre duas contas, ausência de mutação e somas diárias. Não representam a suite oficial.

**Adicionados ao GitHub, NÃO EXECUTADOS:** sete casos no runner `tests/u5-2-simulator.test.cjs`, dois em `tests/u5-2-planning.test.cjs` e um renderer VM em `tests/decisions-u3.test.cjs`, além da adaptação de fixture `excluded`. Exigem TypeScript e checkout.

**Gates oficiais NÃO EXECUTADOS:** `npm ci --no-audit --no-fund`, `npm run test:types`, `npm run test:db` (D1.5.1/U5.1/U5.1.1/U5.2), `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, Electron com perfil temporário, screenshots em 1366×768/1920×1080 e dois temas. **Bloqueios comprovados:** não há checkout do repositório privado neste runtime e sua instalação local possui Node 22.16.0/npm 10.9.2, diferentes do pin do projeto Node 22.23.4/npm 10.9.9. Nenhuma homologação, CI Windows, merge, instalador ou deploy.

## Próximas ações e restrições
Arquiteto revisar PR #38, executar gates oficiais em ambiente pinado e corrigir falhas reais. Ordem recomendada após `npm ci`: `test:types`, `compile`, `test:db` (testes VM leem bundle), proveniência F08, ASAR, QA Electron. Não iniciar U5.3/F1, não tocar Inteligência, main, Cloudflare ou banco financeiro pessoal; não acionar CircleCI Windows.
