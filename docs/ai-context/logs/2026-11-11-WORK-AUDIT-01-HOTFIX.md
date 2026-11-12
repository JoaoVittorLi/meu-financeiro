# WORK-AUDIT-01 — hotfix do resumo e tentativa de QA Windows

Base confirmada: PR #39, `ce8dd04669a474957dc2d6c1107bc91d862031fc`.
Branch própria: `fix/mf2-ai-summary-splits-20261112`.
PR #41 confirmado em `496d8bf344b86e4c5f1d016061145d83b794e45b`; não modificado.
Autorização: missão dirigida do proprietário para corrigir WORK-AUDIT-01 e testar a experiência. Não há merge, release, produção, PWA ou escrita financeira real.

## Correção

`intelligenceBuildStructuredSummaryCard` adapta os registros carregados e chama **o mesmo** `aggregateFinancePeriod` de `shared/finance-period-ledger.mjs`. O módulo canônico não foi alterado. `scripts/build-finance-ledger.cjs` transpila o ESM e o inclui no bundle após o tsc; não mantém outra fórmula. F08 verifica a emissão completa e inclui os hashes do módulo e do gerador no sourceProof. Teste rejeita modificação da fonte canônica após compilação.

Cada registro é agregado numa janela de sua própria data, para preservar o escopo histórico dos registros carregados sem impor a janela máxima de 730 dias do motor. O resumo reduz os resultados do motor por categoria e conta cada movimento uma única vez, mesmo com duas partes na mesma categoria. Não utiliza dailyTotals de todo o histórico; mantém os avisos de cache parcial/linhas carregadas e a seleção de uma única origem. Não converte pendência, transferência ou ignorado em E/S. Valores inválidos são excluídos, sem arredondamento silencioso. Divisão inconsistente cai na categoria original conforme a regra canônica; splitOutdated é descartado no adaptador. Se o motor não estiver disponível, mostra resumo indisponível em vez de totais zero.

O harness I1-B agora recebe o motor canônico e três fixtures ganharam datas válidas, pois o motor valida datas. As asserções existentes foram preservadas.

## Prova do defeito e do resultado

`node scripts/verify-ai-summary.cjs` executa a função do commit base via `git show` e a corrigida com a mesma fixture inventada. Antes: Compras R$ 100. Depois: Alimentação R$ 60, Transporte R$ 40. Total permanece R$ 100. [before-after.json](../evidence/2026-11-11-summary-hotfix/before-after.json).

16 testes novos: divisão 60/40, ausente/vazia, soma divergente, fração de centavo, zero, negativo, string, parte nula, resto de 1 centavo, categorias repetidas, split desatualizado, fonte/origem, POSTED/PENDING/transfer/ignore, histórico multianual, imutabilidade, equivalência do bundle e F08.

## Testes e ambiente

**CONFIRMADO EM TESTE LOCAL — Windows JOÃOVITOR, Node 22.23.4/npm 10.9.9 isolados.** Clone novo `mf2-summary-hotfix`; checkout antigo e instalação preservados. Node oficial conferido por SHA-256. `npm ci` PASS; dependências oficiais do lockfile.

| Comando | Resultado |
| --- | --- |
| `node --test tests/ai-summary-splits.test.cjs tests/ai-ui.test.cjs` | 31/31 PASS na primeira rodada; depois foi acrescentado o teste de F08 |
| `npm run test:db` final | **436/436 PASS**, inclui SQLite real e os 16 testes novos |
| `npm run test:types` | PASS |
| `npm run compile` | PASS |
| `node scripts/renderer-provenance.cjs check-bundle` | PASS, 8 entradas de proveniência |
| `npm run test:asar` | **1/1 PASS** |
| `provenance:create` / `provenance:verify` | Registro após commit limpo, abaixo |
| CircleCI Linux | NÃO EXECUTADO; nenhuma integração CircleCI disponível nesta sessão |
| Windows CI / instalador | NÃO EXECUTADOS |

A primeira execução integral teve 421 PASS/14 FAIL por EPERM em renomeações de cofres/backups sintéticos na pasta temporária virtualizada do Work. Reexecução com TEMP/TMP de processo em `C:\Users\joaov\AppData\Local\Temp\mf2-work-tests` passou 435/435; teste adicional F08 levou ao resultado final 436/436. Não houve alteração de testes para esconder EPERM. Log inicial e final anexados.

## QA Electron do PR #41

**BLOQUEADO, sem screenshots.** Foi baixado clone separado exato do PR #41, compilado e executado `scripts/d1-electron-smoke.cjs` com Node fixado e Electron **45.2.3 oficial**, perfil descartável em Temp e fixture criada pelo script. A cópia parcial de dependências do QA falhou por EPERM; para o smoke usou-se `NODE_PATH` apontando apenas às dependências idênticas e já instaladas do hotfix, sem alterar o lockfile. O binário Electron foi baixado usando cache e temporário próprios, fora do cache virtualizado que inicialmente rejeitava rename.

Inspeção prévia confirmou: `isolateSmokeProfile` só aceita desenvolvimento, pasta temporária real e prefixo mf-d1-electron; seta userData antes do lock/FinanceDB/cofres. O SQLite e backups usam userData. Em modo smoke, HTTP/HTTPS do aplicativo ficam bloqueados. Nenhum perfil financeiro pessoal foi aberto.

O processo Electron encerrou **antes de abrir CDP**, código `2147483651` / `0x80000003`, sem saída diagnóstica do renderer. Solicitação de execução fora do sandbox foi **rejeitada automaticamente** pela política (`sandbox_approval: false`); não foi apresentada nova aprovação utilizável ao usuário. Não removemos sandbox, lock, validação de perfil ou controles do aplicativo para prosseguir.

Portanto Hoje/chat/histórico/drawer/expansão/Permitir/Negar/stale, temas, foco, movimento reduzido, responsividade e console do renderer **não estão visualmente homologados**. Não há captura sintética apresentada como aplicação real. O teste foi uma tentativa no Windows local; não uma homologação concluída.

## Privacidade e UX pendentes

- Histórico I1-B continua em localStorage, sem a proteção do cofre Electron; texto de segurança/retentiva merece revisão separada.
- Conversas do protótipo #41 são temporárias e rotuladas; o hotfix não altera esse comportamento.
- Validar visualmente valores longos, distribuição por categoria, foco do drawer, restauração de foco ao expandir e estado stale.
- 125% Windows real e screenshots 1366x768/1920x1080 claros/escuros permanecem NÃO EXECUTADOS.

## Integração proposta — sem executar merge

1. Revisar este PR contra #39; V1.1/V1.2/V1.3/B3, CSS e motor canônico preservados.
2. Após aprovação, aplicar o hotfix à integração. Em seguida atualizar a base do PR #41 e recompilar pelo **novo `npm run compile`**, que inclui o motor. Não compilar #41 só com `tsc` depois da integração.
3. Reconciliar apenas documentação/roadmap e bundle emitido. Os componentes staging de #41 não são substituídos.
4. Adaptar `scripts/work-audit-probes.cjs` do #41: fornecer `FinancePeriodLedger` ao harness ou usar `scripts/verify-ai-summary.cjs`. O probe antigo não conhece a nova dependência síncrona e não deve ser usado sem atualização.
5. Executar a suíte integrada (esperado 447 testes se nenhuma outra alteração: 436 + 11 do #41; este número é previsão, NÃO resultado executado). Validar F08, ASAR e proveniência no SHA integrado.
6. Em sessão Windows com permissão de processos GUI, executar smoke e as interações específicas do #41. Não executar Windows CI/installer sem autorização.

Reversão: reverter o commit do hotfix e recompilar; não há esquema de SQLite nem registros para reverter. Risco principal: o pipeline precisa incluir a etapa geradora; F08 detecta emissão incompleta. Nenhum gate de produção ou GUI é promovido.

## Próxima missão pronta

> Confira os HEADs do PR do hotfix, #39 e #41. Leia este log e as evidências. Revise o adaptador para o motor canônico e a prova 60/40. Não refaça o design. Após autorização de integração, combine o hotfix e #41 num checkout separado e atualize o probe conforme acima. Execute `npm ci`, tipos, `npm run test:db`, F08, ASAR e proveniência. O Windows local anterior bloqueou Electron com 0x80000003 e rejeitou execução fora do sandbox: use uma sessão que permita executar GUI sem reduzir proteções. Antes de abrir, valide perfil temporário/userData/SQLite e rede bloqueada. Execute o smoke oficial e os fluxos Hoje/chat/histórico/drawer/expansão/Permitir/Negar/stale/temas/teclado/reduced-motion; salve capturas reais com SHA/tema/resolução/estado. Registre PASS/FAIL por cenário e erros de console. Não use a instalação real nem dados bancários pessoais. Sem merge automático, PWA, custos de IA, Windows CI ou produção.

## Proveniência do commit funcional

`30be299`: `provenance:create` e `provenance:verify` PASS no checkout limpo Windows. Manifesto e logs anexados; commit posterior só registra estas provas. O SHA publicado poderá diferir por publicação via conector; comparar árvore e blobs com o commit local.
