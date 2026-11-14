# QA-GATE-01 — P1 autorização e preparo de IC2-READ-QUERY (13/11/2026)

**Status:** PATCH_PUBLISHED / GATES_A_B_C_NOT_RUN / NOT_HOMOLOGATED  
**Base do patch:** PR #63 `0fa05f005d316a815e207eb4b4e043036f783828`; não faz merge em main.  
**Fontes:** issue #65, PRs #60/#63/#64, contrato proposto na documentação I2-A do PR #64.

## Correção concreta P1: cartão V3 não ressuscita entre grants

- `mfV3BindGrant` vincula cartão a **instância do grant**, token e assinatura do escopo em `WeakMap` efêmero.
- `mfV3Live` exige a mesma instância, token, assinatura, fonte, perfil, mês e prazo futuro.
- Nenhum token ou assinatura de autorização é gravado no objeto `MfV3Card`, copiado a JSON ou inserido em logs.
- Cartão de uma sessão restaurada/clonada sem a identidade em memória torna-se `state-stale`. Isso é intencional e fail-closed.
- `localFinancialSubmit` vincula somente cartões gerados depois de completar a consulta sob o grant original; os guards de request/assinatura existentes permanecem.
- `tests/int-design-v3.test.cjs` contém os cenários versionados grant A→B com mesmo escopo, token igual em objeto novo, cópia/restore sem binding e contextos concorrentes.
- **Não houve execução oficial Node/SQLite/TS ou Electron**, portanto a correção permanece não homologada.

## Revisão dirigida do contrato do PR #64

O backend isolado declara `contract='I2-A/D02-V3'`, `version=2`, `readOnly=true`, `changesApplied=false`, `modelCalled=false` e respostas com `facts[]`, `blocks[]`, `evidence[]`, `alerts[]` e `followUps[]`. Implementa nove ferramentas read-only: summary, compare, categories, merchants, transactions, budgets, commitments, simulate, quality. O mock do planejador é desligado por padrão.

**Pontos que impedem conectar diretamente ao renderer #63:**

1. `mfV3FromOperational()` aceita apenas `IC-v1/I-P0.2-read-only` e um formato `facts` de ledger; a I2-A usa `I2-A/D02-V3`, `facts[]` tipados e `blocks[].factRef`. Não mudar apenas a string `contract` nem forçar um objeto incompatível.
2. `factRef` do I2-A identifica fatos por hash de proprietário/fonte/perfil/mês/ferramenta/filtros/asOf, **não é identidade de grant**: a identidade de autorização precisa ser verificada separadamente. Nunca expor token ou titular da conta no HTML.
3. A resposta expõe `source`, `profile`, `period`, `asOf`, `coverage`, `status`, `kind` e `density`; ainda não fornece um campo estável explicitamente verificado de validade/geração do grant no envelope destinado ao IPC. A ligação à concessão precisa acontecer no processo autorizado, sem inferir autorização apenas dos filtros.
4. A taxonomia `kind` não significa serviço homologado: `recurring`/commitments, `whatif`/simulate, `rank`/compare devem ser tratados como capacidades parciais ou bloqueadas conforme os fatos; não renderizar números inventados em `sankey`, `approval`, `debt`, `portfolio` ou simulações de compra.
5. Os `actions:[]` e `followUps[]` não autorizam escrita. Banco/conta individual não está no escopo de IC-READ, logo `accountId` deve falhar explicitamente. Resultado mensal não é saldo disponível.

**Contrato a aceitar antes do IPC:** envelope versionado e validado, contendo `contract/version`, `status`, `readOnly/changesApplied/modelCalled`, `factRef` resolvível apenas dentro de escopo autorizado, período com fonte/perfil, cobertura/qualidade/horário, `kind/density`, fallbacks claros e permissões de ações somente leitura. O adaptador deve verificar dono/concessão vigente/TTL/escopo e referência dos fatos; o renderer só recebe dados autorizados, nunca token ou SQL. Não duplicar agregação; ler o ledger canônico.

**Decisão:** contrato **PROPOSTO, NÃO ACEITO PARA IPC** até Gates A/B e suíte oficial I2-A. Preservar totalmente a branch #64; integração visual futura em branch separada. Não implementar D03.

## Bloqueio de execução constatado neste ambiente

- O terminal local retorna `fatal: unable to access 'https://github.com/...': Could not resolve host: github.com` no `git ls-remote`; não há checkout do repositório montado em `/mnt/data`.
- Node disponível: `v22.16.0` (exigido `22.23.4`). npm disponível: `10.9.2` (exigido `10.9.9`).
- `typescript` global existe; módulos `electron`, `@electron/asar` e `better-sqlite3` não estão disponíveis neste runtime. O lockfile não foi instalado.
- Não foram executados `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `npm run test:asar`, F08, proveniência, smoke Electron, QA visual ou testes do PR #64.
- Não existem capturas de Electron deste SHA, hashes de PNG, hashes de ASAR, manifesto F08 ou logs de suites oficiais para compartilhar.
- Checks GitHub Actions para HEADs #60/#63/#64: sem execuções observadas; não se acionou CI pago nem Windows.

## Sequência para Integrador em ambiente habilitado

1. Gate A: checkout HEAD #60; Node/npm fixos; `npm ci`; `npm run test:types`; `npm run test:db`; `npm run compile`; `npm run provenance:create` + `npm run provenance:verify`; `npm run test:asar`; Electron sintético + screenshots 1366×768/1920×1080, dark/light. Corrigir falhas no #60 sem alterar a main.
2. Gate B: reconciliar os fixes A com #63, mantendo 26 renderers, depois incorporar a correção P1 desta branch sem rebase cego; reexecutar os mesmos gates e cenários de grants A/B/restore/contextos; telas, teclado, reduced motion e QA financeiro no SHA final.
3. Gate C: testar #64 isoladamente com `node --test tests/intelligence-i2a.test.cjs` sobre checkout completo, reconciliar `IC2-READ-QUERY` no issue #49, e só então integrar os módulos I2-A por IPC/adaptador sem sobrescrever `src/` e CSS.
4. Reexecutar TUDO no HEAD da candidata integrada. Guardar comando, exit code, versão de runtime, SHA de código, checksum de bundle, capturas reais e hashes, atribuindo PASS/FAIL/NOT_RUN por gate. Até então **NOT_HOMOLOGATED**.

**Não realizado/autorizado:** merge na main, EXE, CI Windows pago, Cloudflare Production, API paga, dados pessoais em modelo externo, IA com escrita financeira, D03.
