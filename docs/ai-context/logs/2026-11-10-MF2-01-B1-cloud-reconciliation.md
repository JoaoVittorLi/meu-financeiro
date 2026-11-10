# MF2-01 / B1 — Conciliação Windows ↔ Cloudflare, implementação read-only

**Data:** 10/11/2026. **Status:** IMPLEMENTADA EM BRANCH / AGUARDANDO AUDITORIA DO ARQUITETO, testes Node/SQLite integrais pendentes. **Gate G1:** NAO_HOMOLOGADO. **Gate G0:** NAO_HOMOLOGADO, avanço excepcional de desenvolvimento autorizado. **Origem:** `fix/mf2-c11-reproducible-build-20261110` em `a4d88ced28c59b21520f4d67a51373cd71bdc8a2`; PR #19 e candidata `7a01f1cc344e88188bc5eeea59bf2324335a051e` preservados. [Parecer do Arquiteto](https://github.com/JoaoVittorLi/meu-financeiro/pull/19#issuecomment-6774156752).

## Entrega efetiva de código

1. `shared/mf2-reconciliation.mjs`: motor síncrono puro, determinístico, sem rede/SQL/gravação, com identidade `account_id+external_id`, fontes bancárias e manuais separadas, datas ISO reais, `amount_cents` inteiro, categorias, status, saldo nulo diferente de zero, naturezas/splits, vínculos, revisões, conflito, incompletude, presença unilateral, duplicidade exata, referências a contas ausentes, overlays órfãos e candidatos heurísticos somente para revisão. Relatório anônimo por referências locais `R000001`, sem valores/IDs de banco/descrições. Resumo do fluxo **não soma** lançamentos bancários e manuais.
2. `electron/cloud-reconciliation-read.cjs`: SELECT-only sobre `FinanceDB` já aberto; extrai `bank_accounts`, `bank_transactions`, `transactions WHERE profile='real'` e overlays locais de categorias, notas, links, títulos e splits. Não instancia nem abre SQLite ou altera dados.
3. `mobile-push/src/finance-reconciliation-read.js`: SELECT-only sobre Durable Objects SQL já fornecido por contexto seguro; usa `mf_bank_staging_*`, sidecar de `category_original` e, quando existente, `mf_transfer_rows` da última importação `verified` mais revisions de `bank_custom_titles`. Ausência de sidecar não é normalizada como categoria conhecida; importação pessoal verificada não é confundida com edição atual. **Não chama** `ensureBankStaging`/`ensurePersonalEdits`, não cria rota nem acessa rede.
4. `tests/mf2-reconciliation.test.cjs`: **22** testes autocontidos, inventados, sem banco pessoal, conectores, IA ou secrets. Cobrem identidades, centavos, datas, status, categoria/edições, revisões, duplicatas, transferências, ausência de metadados, manual versus banco, 630×632, imutabilidade, repetibilidade e ambos os adaptadores `SELECT`.
5. `scripts/mf2-reconciliation-fixture.cjs`: `node scripts/mf2-reconciliation-fixture.cjs` gera em memória um resultado 630×632 **inteiramente fictício**; saída esperada versionada em `2026-11-10-MF2-01-B1-synthetic-report.json`.
6. [Contrato completo](../MF2_01_B1_RECONCILIATION_CONTRACT.md): campos, origens, statuses, caveats, limites de 100.000 registros por coleção e máximo de 200 detalhes de divergência; causas/ações e dependências de B2.

## Resultado reproduzido exclusivamente com fixtures sintéticas

Cenário: 1 conta em cada lado, 630 transações bancárias Windows, 632 no staging, último fetch cloud ilustrativo de 630; 2 IDs bancários **fictícios** encontrados somente na cloud, 1 status divergente, 1 sidecar de categoria ausente, saldo de conta nulo (desconhecido).

**Relatório:** `contract=mf2-reconciliation-b1-v1`, `stage=read_only_dry_run`, `state=requires_manual_review`, `issues=5`, `byType={incomplete:2, only_one_source:2, status_difference:1}`, `bankCountDelta=+2`, `omittedIssues=0`; `cloudCutoverAllowed=false`, `databaseChanged=false`, `financialSyncEnabled=false`. Hipóteses explicitadas: janelas distintas, histórico preservado no staging e identidade/status a conferir. **Nenhuma afirmação de que as 2 transações reais de 2026 sejam estas duas fictícias.**

## Execuções e verificações (não inflar resultados)

| Teste / evidência | Resultado | Limite / método |
| --- | --- | --- |
| Inspeção dos módulos existentes E1 e SQLite/staging | PASS | Leitura GitHub na baseline; reutilizados contratos e sem sobrescrever E1 |
| 20 testes sintéticos sobre **código publicado e lido de volta do GitHub** | **PASS 22/22** | Rodados em executor isolado JavaScript V8, com `node:test` e `node:assert` substituídos por harness de asserções equivalente; fontes dos módulos/adaptadores são as da branch |
| Imutabilidade do input, determinismo, redaction, 630×632 | PASS | Verificações executadas no mesmo harness |
| Reproduzibilidade do relatório JSON vs gerador | PASS | Teste B1 compara estruturas profundas no harness |
| Compatibilidade de `require()` com módulo ESM sob Node local 22.16.0 | PASS pontual | Apenas probe de um pequeno módulo ESM local; **não** a suíte B1 com Node oficial |
| `node --test tests/mf2-reconciliation.test.cjs` | **NÃO EXECUTADO** | Ambiente conectado ao GitHub não possui runner Node com os arquivos montados; Node local não tem checkout privado |
| `npm run test:db`, `npm run test:types`, `npm run compile` | **NÃO EXECUTADOS na branch B1** | Exigem checkout e/ou dependências; não repetir tentativa conhecida de acesso npm indisponível |
| Worker `npm test`, Wrangler `--dry-run`, integração Cloudflare protegida | **NÃO EXECUTADOS na branch B1** | Não foi disparada pipeline nem deploy; não tratar PASS histórico B3 como prova da B1 |
| Leitura de SQLite real / contas Pluggy / Worker do usuário | **NÃO EXECUTADA** | Proibida nesta fatia; testes usam dados sintéticos |
| Testes de gravação, migração/restore, sincronização real e smoke Windows | **NÃO EXECUTADOS** | Fora de B1, aguardam B2 e gates posteriores |

## Limites e riscos honestos

- O motor compara **snapshots brutos em um mesmo contexto privilegiado**. Os adaptadores podem ler os respectivos esquemas com permissões preexistentes, mas **não há novo endpoint/transporte autenticado de registros entre Windows e Cloudflare**. A comparação live entre dispositivos depende da B2; E1 atual fornece somente hashes e contagens.
- O staging histórico cloud não é o mesmo que dados do último fetch; `lastFetched` é diagnóstico, não cobertura certificada. As tabelas pessoais `verified` são quarentena, não sobreposição em tempo real garantida.
- A leitura separada de tabelas não prova captura consistente `as-of` entre dispositivos nem balanço bancário com instante autenticado.
- Identificadores de divergência `R...` têm escopo **apenas do mesmo relatório**. Não persistir as chaves brutas nem publicá-las em UI/telemetria.
- A heurística de `possible_duplicate` agrega conjuntos suspeitos para revisão; nunca remove/registra/mescla.
- Eventos de escrita, resolução CAS e política de conflitos não foram ligados; ainda não há restore aprovado. Nenhum código faz pagamentos, IA paga, migrações, Cloudflare Production, alteração de `FINANCIAL_SCHEMA_ACTIVE` ou `FINANCE_SYNC_ENABLED`.
- Os 22 testes foram efetivamente executados no harness V8 sobre a revisão publicada. **Não confundir isso com prova do runner oficial `node --test`/CI**, ainda pendente antes de aceitar B1.

## Próximas ações para encerrar B1

1. Criar PR draft independente sobre `fix/mf2-c11-reproducible-build-20261110`; conferir diff isolado e SHA, testes B1 e dados protegidos ausentes.
2. Em ambiente Node 22.23.4/npm 10.9.9 com checkout, rodar `node --test tests/mf2-reconciliation.test.cjs`, `npm run test:db`, `npm run test:types` e `npm run compile` (e Worker dry-run se aplicável); registrar novos resultados por SHA.
3. Pedir auditoria ao Chat Arquiteto; não promover `G1` ou `G0` por teste sintético.
4. **B2 a propor:** fluxo autenticado Windows↔Preview que compare diferenças detalhadas sem exportar IDs/valores ao renderer, snapshots transacionalmente consistentes, revisão/CAS, idempotência e rastreio; segregar dados pessoais e dados bancários; preservar backup/restore e veto de cutover. A autorização de B1 não autoriza B2.

**Conclusão deste log:** B1 traz implementação funcional reusável e relatório offline verificável, com gate de CI Node/SQLite e transporte seguro live ainda pendentes. **G1=NAO_HOMOLOGADO; G0=NAO_HOMOLOGADO.**
