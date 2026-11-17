# CAT-03 — Prévia histórica paginada | Handoff do Integrador

**Estado:** serviço de prévia real com consultas SQLite, ainda sem IPC/React integrados e sem homologação Node/Electron. Base: PR #99 CAT-01/02.

## Entrega
- `electron/cat03-history-preview.cjs`: `Cat03PreviewService` mantém análise em memória por grant MAIN; paginador keyset por `(account_id,external_id)`, limite 250/página, até 100.000 registros/ciclo, contas autorizadas, progresso por conta, pausa/retomada/cancelamento, manifest SHA-256 de classificação segura. Não depende das 2.500 movimentações visíveis em bankOverview().
- `tests/cat03-history-preview.test.cjs`: 9 testes Node/SQLite incluindo 3 contas × 210 transações, 0 labels manuais, splits, transferências, concorrência, revogação e cursor.

## Responsabilidades do Integrador
1. Adicionar IPC de leitura versionado/allowlist, vinculado a `requireAppSender`, `owner` e grant MAIN, SEM aceitar `scope.readGrantId` fornecido pelo renderer como autorização. MAIN cria `readGrantId` e o vincula a perfil/contas; `authorizeRead` revalida o grant antes de todas as páginas.
2. Adicionar configuração no Electron com escolhas iniciais sugeridas: histórico ligado, novas transações ligadas, baixa confiança → revisão; **nenhum checkbox representa consentimento**. A confirmação inicial exige diálogo nativo e backup antes da escrita CAT-05.
3. `historyFor` deve ler exclusivamente labels comprovadamente humanas, nunca classificações automáticas/simuladas; `approvedRulesFor` deve exigir aprovação humana registrada. Na ausência de labels, o motor funciona com sinais externos concordantes ou envia para revisão.
4. Não mostrar `manifest.items` no IPC sem filtragem; a lista completa só pode ser lida pelo executor CAT-05 após autorização pessoal específica. A UI recebe `status()` com contagens e amostras limitadas.
5. Em alteração de DB ou account grants durante a prévia, invalidar job e exigir nova leitura antes de aceitar confirmação. Ativar recurso na Movimentações e Central de Revisão, preservar design B01–B05.

## QA
- Sintaxe V8 do módulo **PASS**. **NOT_RUN**: 9 casos Node/SQLite reais, TypeScript, ipc-preload, QA B05/Movimentações, Windows; no checkout nesta sessão.
- O serviço não aplica nada no SQLite pessoal. O release continua NO-GO até CAT-04/05 e integração/QA.
