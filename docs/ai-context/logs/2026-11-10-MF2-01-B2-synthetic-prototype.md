# MF2-01 / B2-A — Protótipo sintético executável (sem endpoint)

**Data:** 10/11/2026 · **Argon necessário? AUDITORIA antes de qualquer B2 com transporte real** · **Status:** PROTÓTIPO PUBLICADO, TESTES UNITÁRIOS LOCAIS PASS, INTEGRAÇÃO B1/CI PENDENTES · **G0/G1:** NAO_HOMOLOGADOS.

**Branch exclusiva B2:** `feat/mf2-01-b2-protected-transport`, criada a partir de `530ba91d0913e6b8857dc4db922141b84cb00893` (B1.1 PR #20). PR #19, #20, candidata e arquivos de U4/Argon não foram alterados. **Não houve Cloudflare, Pluggy, SQLite pessoal, conexão real, HTTP, migração, deploy, build Windows, merge nem release.**

## Código entregue

- `shared/mf2-b2-synthetic-transport.cjs`: protocolo **exclusivamente em memória**, implementado em Node CJS; contrato `mf2-b2-synthetic-transport-v1`/versão 1; sessão **mock** HMAC-SHA256 temporizada por relógio injetado, dono sintético e escopo `synthetic:diagnose`; IDs de request `syn-...`, anti-replay em `Set` efêmero com limite fail-closed, rejeição de versões/mode/estruturas inválidas e de fixtures que não tenham IDs `SYNTH-...` e descrições `SYNTHETIC:`; snapshots copiados; máximo de 2.000 registros por coleção e 256 KiB por corpo; saída somente diagnóstico anonimizado + digest SHA256 vinculado ao `requestId`; validação de flags de não-escrita e recusa de IDs/descrições brutos no relatório; falhas retornam códigos estáveis sem mensagem financeira.
- `tests/mf2-b2-synthetic-transport.test.cjs`: **19 testes executados com `node --test` REAL** no ambiente local Node **v22.16.0**. Mock de comparador usado nos testes unitários, pois o clone completo privado não está montado localmente.
- `scripts/mf2-b2-synthetic-demo.cjs`: **demo offline invocável** `node scripts/mf2-b2-synthetic-demo.cjs`, usando o verdadeiro `reconcileSnapshots` B1 herdado da branch, com 1 vs 2 transações inventadas e status POSTED/PENDING. Não abre banco nem executa rede.
- `tests/mf2-b2-b1-integration.test.cjs`: **2 testes adicionais** do demo com motor B1 real, incluídos automaticamente no `npm run test:db` do repositório. **Ainda não executados** por falta de checkout local do código B1 completo; esperam Node 22.23.4/CI.

## Testes realmente executados

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| `node --check shared/mf2-b2-synthetic-transport.cjs` | PASS | Node v22.16.0 neste executor |
| `node --test tests/mf2-b2-synthetic-transport.test.cjs` | **PASS 19/19** | Node Test Runner real v22.16.0; execução offline; ~211 ms |
| Autenticação mock HMAC/tamper e identidade incorreta | PASS | Unit tests |
| Sessão expirada, token inválido ou ausência de credencial | PASS | Unit tests |
| Replay simples, concorrente e capacidade limitada | PASS | Unit tests |
| Versões incompatíveis, campos extras, modo write recusado | PASS | Unit tests |
| Payload inválido, não sintético e >256 KiB | PASS | Unit tests |
| Erro de rede, digest adulterado e requestId trocado | PASS | Unit tests |
| Diagnóstico que tenta habilitar escrita/cutover ou expor ID | PASS | Unit tests |
| Imutabilidade dos snapshots e saída determinística | PASS | Unit tests |
| Igualdade exata dos 2 arquivos testados × blobs GitHub | PASS | SHA1 do objeto Git conferido depois do push |
| `node scripts/mf2-b2-synthetic-demo.cjs` com B1 real | **NÃO EXECUTADO** | Checkout B1 completo indisponível localmente |
| `node --test tests/mf2-b2-b1-integration.test.cjs` | **NÃO EXECUTADO** | Mesmo motivo |
| `node --test`/CI com Node 22.23.4, `npm run test:db`, types, compile, Worker/Wrangler | **NÃO EXECUTADOS no SHA B2** | Dependem de checkout/preflight no CircleCI ou ambiente oficial |
| CircleCI B1.2, SHA 530ba91d | **PENDENTE** | Não há integração CircleCI com permissão de disparar; usuário recebeu procedimento manual |
| Deploy Production / Windows / escrita financeira | **NÃO EXECUTADOS** | Fora do escopo, proibidos |

**Falha corrigida durante teste:** primeiro caso de payload “grande” era menor que 256 KiB, então falhou pela expectativa incorreta; o fixture foi ampliado para 300.000 caracteres e a suíte final passou. Endurecimento aditivo posterior: comparador com flags falsas/IDs brutos é rejeitado, testado e publicado.

**Limites e segurança:**

1. A sessão `synth.v1...` é **somente mock**, com segredo fixo fictício no arquivo de testes/demo. Ela **não** substitui Cloudflare Access, pilot session ou OAuth. Não usar em endpoint, app distribuído ou dados reais.
2. Digest SHA256 **não é autenticação da resposta**: detecta corrupção/alteração acidental, mas um agente malicioso poderia recalculá-lo; segurança efetiva de rede exigirá transporte autenticado e TLS/origem fixa.
3. Anti-replay `Set` é efêmero, por processo, sem armazenamento durável; não serve para API multiinstância. Para serviço real exigir revisão e controle persistente.
4. `metadata.snapshotKind='synthetic'`, prefixo de IDs e texto `SYNTHETIC:` são barreiras de teste, **não prova criptográfica de ausência de PII**. Proibido conectar a adaptadores Windows/DO com registros reais.
5. O demo separado injeta o comparador B1 real; testes unitários injetam fake intencionalmente, e os 2 testes de integração B1 só estarão validados após execução no checkout oficial.
6. Nenhuma rota pública, ligação à UI/IPC/worker, configuração de Cloudflare, segredo real, automação nem transação financeira foi introduzida.

## Ações seguintes / aceite antes de B2 sensível

- Executar no CircleCI **B1.2** no SHA original `530ba91d0913e6b8857dc4db922141b84cb00893`: Config Branch = Checkout Branch = `feat/mf2-01-b1-cloud-reconciliation`, `run_preflight=true`, `run_windows_build=false`. O Workflow esperado `preflight_on_demand` inclui testes B1 explícitos. Não acionar Windows.
- Após a B1.2, testar **B2** na branch B2 com `node --test tests/mf2-b2-synthetic-transport.test.cjs`, `node --test tests/mf2-b2-b1-integration.test.cjs`, `node scripts/mf2-b2-synthetic-demo.cjs`, `npm run test:db`, `npm run test:types`, `npm run compile`, Worker tests e Wrangler dry-run, vinculando evidências ao SHA final.
- Antes de endpoint real ou transporte sensível: Argon **AUDITORIA** dirigida ao diff/autenticação, cobertura, leaks, snapshots, CAS, idempotência e rollback. P0/P1 bloqueiam risco, P2/P3 em backlog.
- O Chat Arquiteto decidirá nova missão. **B2-B/C com transporte autenticado de dados pessoais NÃO autorizadas nesta entrega.** G0/G1 não homologados.
