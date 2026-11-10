# MF2-01 / B2 — Proposta de transporte autenticado e conciliação protegida

**Status:** B2-A PROTÓTIPO OFFLINE SINTÉTICO IMPLEMENTADO E TESTADO; B2-B/C COM TRANSPORTE REAL APENAS DESENHO, NÃO AUTORIZADOS. **Origem:** B1.1 PR #20 no SHA `530ba91d0913e6b8857dc4db922141b84cb00893`. **Branch B2:** `feat/mf2-01-b2-protected-transport`, autorizada pelo proprietário para exclusivamente fixtures/read-only. **Argon necessário? AUDITORIA** dirigida **antes** de qualquer canal remoto de dados sensíveis/escrita. **G0/G1: NAO_HOMOLOGADOS**.

## B2-B0 — contrato HTTP sintético implementado no PR #21

**Status:** protótipo `Request`/`Response`/fetch **injetável**, executado localmente com Node v22.16.0 e fixtures inventadas; **nenhum endpoint Worker registrado, nenhuma conexão de rede real**. B2-B1 continua condicionado à autorização. `Argon necessário? NÃO` para B0 sintética; **AUDITORIA** para B2-B1 Preview, antes de conectar dados.

**Implementação:**
- `shared/mf2-b2-http-transport.cjs` cria `createSyntheticHttpHandler({server,enabled})` e `createSyntheticHttpClient({fetchImpl,session,origin,timeoutMs,enabled})`. Ambos `enabled=false` por padrão. O cliente **exige** `fetchImpl` injetado; não tem fallback para `globalThis.fetch`. URL fixa `https://mf2-b2-synthetic.invalid/__mf2_synthetic__/reconcile/v1`; qualquer origem real é recusada. Loopback em memória com `createInjectedLoopbackFetch`.
- `POST` obrigatório, `Authorization: Synthetic <mock-token>`, Origin e `x-mf2-test-mode: synthetic-only` validados; sessão fake HMAC/expiração/owner e anti-replay delegados ao motor B2-A. Corpo JSON sem sessão/credencial, sem chaves extras; no-store e nosniff.
- Cliente usa `redirect:'manual'`, `credentials:'omit'`, `AbortController`, limite de timeout 1–30.000 ms, rejeição de status 3xx, URL/redirecionamento estranho, MIME inválido, corpos truncados/malformados/maiores que 256 KiB; valida o envelope de resposta, código/status de erro e digest B2-A. O SHA256 **não autentica** a origem.
- `scripts/mf2-b2-http-demo.cjs` injeta o motor B1 real e duas fixtures inventadas (1×2, POSTED/PENDING); `tests/mf2-b2-http-b1-integration.test.cjs` cobre determinismo, contagens, fluxo e ausência de dados brutos. Somente demonstrar PASS no checkout Node após executar os dois.

**Status de testes:** 19/19 testes HTTP PASS no Node v22.16.0 local, em conjunto 38/38 com os 19 testes B2-A; **integração B1 por HTTP ainda não executada no Node oficial**. O motor B1 real foi executado isoladamente em V8 sobre as fixtures reais do demo (1×2, uma diferença, POSTED/PENDING, sem escrita); isto não equivale a teste integrado HTTP.

**Fase B2-B1 proposta, NÃO AUTORIZADA:** implementar sandbox Preview **com linhas exclusivamente sintéticas** e feature-flag default-OFF, somente após decisão do Arquiteto e auditoria Argon direcionada. Gates: Access + sessão dupla ligadas ao owner; proteção contra BOLA/IDOR; origem/redirect/CSRF/CORS; rate limit/replay durável; limites contra DoS; versionamento e auditoria sem PII; provedor de fixtures 100% inventadas sem acesso a staging do usuário; nenhum segredo ou bank ID em resposta/log; CI e smoke sob sessão autorizada; rollback via flag-off e confirmação de que não houve escrita. **Não** reutilizar sessões fake no Preview, nem montar handler B0 como endpoint real sem nova implementação/autorização.

## Protótipo B2-A já publicado — código, não endpoint

- `shared/mf2-b2-synthetic-transport.cjs`: cliente/servidor em memória, sessão **mock** HMAC temporizada, owner fictício e escopo `synthetic:diagnose`, nonce requestId, anti-replay em `Set` efêmero, validadores de versão/payload/fixture sintética, proteção contra resultado com ID bruto, digest SHA256 não autenticador, flags fail-closed. Nenhum `fetch`, HTTP, SQL, Pluggy ou Cloudflare real. Sessão mock **não** é Cloudflare Access.
- `tests/mf2-b2-synthetic-transport.test.cjs`: `node --test` **19/19 PASS** em Node **v22.16.0 local**. `tests/mf2-b2-b1-integration.test.cjs`: dois testes adicionais usando B1 real no repo, **pendentes de execução** em checkout completo. `scripts/mf2-b2-synthetic-demo.cjs` executa a conciliação B1 real com transações 100% inventadas, **sem execução comprovada nesta sessão**.
- [Log B2-A](logs/2026-11-10-MF2-01-B2-synthetic-prototype.md) detalha comandos, limites e pendências. **O código B2-A não é um endpoint Preview nem uma implementação de autenticação de dispositivos em produção**.

**Escopo ainda reservado:** as fases B2-B/C abaixo exigem autorização distinta, desenho de segurança, auditoria Argon e teste no CircleCI antes de qualquer dado real ou transporte de detalhes financeiros.

## 1. Objetivo, limites e ativos existentes

Confrontar o SQLite Windows com registros do Cloudflare Preview **sem migrar, copiar para renderer ou promover** cloud canônica; preservar a capacidade de explicar divergências por identidade, centavos, status POSTED/PENDING, categorias, natureza, revisão, referências manuais e cobertura histórica.

Reutilizar os blocos comprovados por código:
- `electron/cloud-preview-identity.cjs` (origem Preview fixa, sessão autenticada com cookies Chromium, `credentials:include`, `redirect:manual`, sem token exposto a renderer).
- `electron/cloud-system-browser.cjs` (pareamento explícito pelo browser, sessão privada e Access).
- `electron/cloud-bank-parity.cjs`, `electron/cloud-e1-audit.cjs` e `shared/e1-*.mjs` (GETs somente resumos/digests já existentes, inclusive 48 meses).
- `mobile-push/src/worker.js` (gates atuais: `mf_push_session` + `authorizeAccess`, escopo owner).
- `mobile-push/src/finance-personal-edits.js` (overlays revisionados, baseRevision CAS, mutation_id; **não** autoriza transferir/escrever dados B2).
- `shared/mf2-reconciliation.mjs` (comparador puro B1.1), `electron/cloud-reconciliation-read.cjs` e `mobile-push/src/finance-reconciliation-read.js` (SELECT-only; hoje não existe transporte bruto entre processos).
- `E1_CONCILIATION_REPORT.md`: diferença histórica 630/632 NÃO implica perda nem duplicidade.

Não reescrever os componentes anteriores. Não alterar `main`, PR #19, Cloudflare Production, Pluggy, dados financeiros pessoais nem `FINANCE_SYNC_ENABLED`/`FINANCIAL_SCHEMA_ACTIVE`.

## 2. Modelo de confiança

O **processo Electron main privilegiado**, e nunca renderer/IPC genérico/PWA pública, é o cliente autorizado de comparação. O servidor cloud responde somente quando **ambos** (a) a sessão privada assinada e (b) a identidade Cloudflare Access forem verificadas e vinculadas ao proprietário. Controles efetivos devem ser comprovados contra o código de middleware, não declarados por documentação.

- HTTPS + origem **literalmente fixada** (`PREVIEW_ORIGIN`), `GET`/métodos explicitamente aprovados e `redirect:'manual'`; rejeitar 301/302/307/308, HTML e respostas de tamanho inesperado.
- Segredos, cookies, JWTs e Pluggy permanecem no gerenciador protegido/sessão autorizada; **nunca** em URL, query, localStorage, renderer, log, crash report, diagnóstico exportado ou GitHub.
- Todas as respostas com `Cache-Control: no-store` e `Content-Type: application/json`; limite de tamanho/campos/tempo; não fazer `console.log` de payload. Implementação deve ser fail-closed em sessão ausente/expirada, conta não autorizada, configuração Access ausente, origem distinta ou revisão inconsistente.
- Impedir BOLA/IDOR: `account_id` fornecido por cliente **não** autoriza leitura de outra conta; a identidade owner deriva da sessão validada e escopo de DO, não de parâmetro da URL.
- As rotas E1 existentes retornam agregados/digests; isso não equivale a exportação de dados detalhados. Não introduzir endpoint de extratos detalhados sem parecer Argon **e** autorização específica.

## 3. Fases pequenas e reversíveis

| Fase | Objetivo | Mudança permitida | Gate |
| --- | --- | --- | --- |
| **B2-A — design/contratos** | Fixar ameaça, identidade, cobertura, disponibilidade e saída de diagnóstico | Documentação, fixtures sintéticas e testes unitários | Arquiteto aprova contrato e Argon audita se houver canal sensível |
| **B2-B — sandbox isolado read-only** | Provar handshake autenticado com fixture falsa | Endpoint **somente** em worker local de teste/Preview isolado e com feature flag **default OFF**, sem tocar staging pessoal | 401/403/redirect/replay/corpo inválido e ausência de escrita comprovados |
| **B2-C — conciliação protegida** | Reutilizar evidências E1 e comparador B1.1 sobre snapshots coerentes | Apenas leitura autorizada e agregados/diferenças minimizados; qualquer linha financeira detalhada exige autorização separada | SHA + testes de auth, privacidade, snapshots, contas, centavos |
| **B2-D — revisão de conflito** | Contrato futuro CAS/idempotência/backups sem ativação de escrita | Simulação sintética; eventos e mutações apenas em memória | Argon P0/P1 resolvido, backups/restore ensaiados |
| **Futuro (fora de B2 atual)** | Escrita financeira real e decisão de cloud canônica | Somente novo escopo proprietário + gates e migração reversível | G1 homologado separadamente |

**Sem ativação automática**, mesmo com testes verdes. Erros de P0/P1 bloqueiam fases sensíveis; P2/P3 entram no backlog com responsável.

## 4. Contratos propostos para sandbox (não são endpoints implantados)

### 4.1 Desafio read-only

`GET /api/reconcile/v1/capabilities` — **nome reservado apenas no desenho**:

```json
{
  "contract": "mf2-reconcile-capabilities-v1",
  "ok": true,
  "stage": "protected_preview_read_only",
  "supportedModes": ["summary_only", "synthetic_fixture"],
  "schemaRevision": "v1",
  "financialSyncEnabled": false,
  "cloudCutoverAllowed": false
}
```

Não aceitar `accountId` ou chave financeira em parâmetros de rota. Identidade owner vinculada ao middleware, não retornada ao cliente.

### 4.2 Envelope de auditoria sem extratos brutos

Reutilizar `bankParityManifest`/`bankMonthlyEvidence` (`mf-bank-parity-v1`, `mf-e1-months-v1`) em vez de criar segundo algoritmo de digest. Proposta de envelope **somente da sessão autenticada**:

```json
{
  "contract": "mf2-reconcile-envelope-v1",
  "requestId": "synthetic-request-id",
  "source": "cloud_staging",
  "window": {"from": "2026-01", "through": "2026-11", "complete": null},
  "sourceSnapshot": {"consistent": null, "sourceAsOf": null, "revision": null},
  "totals": {"bank": 632, "posted": 630, "pending": 2, "statusUnknown": 0},
  "monthly": {"contract": "mf-e1-months-v1", "months": []},
  "limitations": ["history_window_unverified", "bank_balance_as_of_unknown"],
  "financialSyncEnabled": false,
  "cloudCutoverAllowed": false
}
```

Todos os valores acima são **ilustrativos fictícios**. A ausência de revisão/instante é `null`, não `0` nem `now`. A soma de POSTED/PENDING/unknown deve ser coerente com o escopo declarado; estados externos não homologados permanecem desconhecidos. O envelope não fornece identidades bancárias. B2 deverá reutilizar os digests reais já disponíveis, com validação estrita de schema e limites de respostas, sem assumir que `monthly.months=[]` corresponde a uma prova de cobertura.

### 4.3 Detalhamento por item — ainda NÃO AUTORIZADO

O motor B1 aceita snapshots detalhados em processo privilegiado, mas retornar hashes identificáveis por registro pode permitir correlação/enumeração; HMAC com chave enviada ao cliente também pode vazar a chave. A opção de transportar linhas financeiras sensíveis deve passar por revisão de ameaça, autorização explícita do proprietário, consentimento por sessão e critérios de descarte/limpeza de memória. **Não** prometer hash per-transaction seguro apenas por usar SHA256. Antes disso, somente confrontar hashes agregados por janela, contagens e cobertura, mantendo a análise detalhada local/offline com fixtures.

## 5. Snapshots consistentes e versões

- **Windows:** capturar todas as tabelas pertinentes **numa única transação SQLite de leitura** (snapshot de leitura, sem alterações), em conexão gerenciada pelo Electron main e sem abrir outro perfil do usuário inadvertidamente. Detectar arquivos em WAL e validar o comportamento do backup; nunca `VACUUM`, `DELETE` nem migração no diagnóstico.
- **Cloud DO:** uma chamada a uma transação de leitura coordenada no mesmo DO, sem `ensure...` (que usa DDL); confirmar na implementação se `storage.transactionSync` preserva atomicidade de leituras antes de prometer `consistent=true`. Não marcar consistência se a API suportar apenas leituras sem snapshot garantido.
- **Proveniência:** exigir `snapshotId` opaco, `sourceKind`, `observedAt` de consulta local e `sourceAsOf` do provedor quando autenticado; são campos diferentes. `lastFetched` não certifica histórico nem `sourceAsOf`.
- **Cobertura:** período por conta, status dos dados/consentimento, quantidade preservada, `lastFetched` vs total staging; rotular histórico incompleto sem suposição de perda.
- **Revisões:** contadores locais e remotos **só são comparáveis se compartilharem uma linhagem/versionamento acordado**. `bank_custom_titles` cloud usa revision, mas import original Windows não possui a mesma sequência. Diferença de números de revisão pode ser inconclusiva, não conflito de conteúdo confirmado.

## 6. Conflitos/CAS/idempotência — desenho sem escrita

| Cenário | Resposta/decisão futura | Bloqueio |
| --- | --- | --- |
| Mesmo `account_id+external_id`, valores/datas diferentes | `financial_difference`, revisão humana, nenhuma fusão automática | Sem prova de origem/período |
| Status POSTED↔PENDING | `status_difference`, fluxo confirmado separado do pendente | Nunca somar PENDING como lançado |
| Categoria original vs overlay manual | Diagnóstico em camadas; não sobrescrever edição | Sem consentimento da alteração |
| Remessa duplicada/replay | `requestId` para correlação e idempotency-key **numa futura mutação**; tratar replays sem duplicação | Nenhum mutation_id no diagnóstico |
| Edição concorrente | Contrato CAS: `baseRevision` + `newRevision`; 409 com revisão atual e **sem** aplicar patch | Nunca last-write-wins silencioso |
| Desligamento/timeout entre escrita e resposta | Retry idempotente apenas com mesmo `mutationId` e payload; resultado original auditável | Testar antes de ativar escrita |
| Saldo nulo ou as-of ausente | `balance_unknown` / `balance_timestamp_unverified` | Não converter nulo em zero |
| Transferência própria / link manual | Preservar associação sem contabilizar novamente | Não confirmar liquidação por heurística |

## 7. Backup, restauração e rollback

Pré-condições de qualquer escrita futura: snapshot consistente e backup **verificado** do SQLite Windows, teste de restauração em perfil fictício, export/manifesto protegido do DO, hashes, linhar de eventos, plano de rollback por etapa, testes de interrupção de rede e autorização do usuário por fase. Nada da B1.1 cria backup de dados reais ou executa restore.

Rollback de uma operação futura deve usar `expectedRevision`/CAS, nunca sobrescrever edições posteriores. Registro de auditoria: tipo de ação, instante, revisão, status, resultado e pseudônimo efêmero de conta, **sem** valor monetário, credencial ou extrato.

## 8. Testes mínimos para B2 e aceite

| Grupo | Testes exclusivamente sintéticos, antes de dados reais |
| --- | --- |
| Auth | Sessão ausente/expirada, Access ausente/fora do owner, CSRF em futuras mutações, origem fixa, redirect, CORS e replay |
| Integridade | Chaves `[account_id,external_id]`, ordem estável, centavos negativos/positivos, 0 vs null, datas impossíveis, 630×632 por janela |
| Cobertura | Staging preservado > último fetch, histórico parcial, consentimento expirada, saldo sem as-of, sidecar ausente |
| Snapshot | Duas leituras concorrentes, tx aberta/WAL, DO reads entre alterações, revisão mudando no meio |
| Conflitos | POSTED↔PENDING, revisão desigual, categoria manual, transfer, splits, órfãos e duplicação heurística |
| Privacidade | Nenhum token, ID bancário bruto, saldo, categoria/descrição pessoal no renderer, resposta pública, logs e exceções |
| Repeatability | 100× same fixture ⇒ JSON idêntico, nenhuma mutação de SQLite/DO nem ETag/version increment |
| Recoverability | Backup e restore de perfil sintético, hash anterior/posterior, falha/interrupção simulada |

`node --test` oficial, regressões de app inteiro, Worker tests, `wrangler deploy --dry-run` e CircleCI Linux no SHA são provas exigidas antes de aceitar código real. Erro de auth ou privacidade em P0/P1 impede canal remoto.

## 9. Entregas e decisões exigidas do Arquiteto

1. Aprovar escopo **B2-A apenas desenho/fixtures**; B2-B sandbox e B2-C integração protegida serão autorizações distintas se houver tráfego de dados.
2. Confirmar a estratégia de identidade do owner, scope DO e revisão no código de autenticação, sem coletar credenciais.
3. Solicitar ao Argon auditoria direcionada do diff do transporte futuro (vide [política Argon](ARGON_COLLABORATION_POLICY.md)).
4. Definir prova de consistência e cobertura histórica, CAS e restore antes de avançar escrita.
5. Manter PR #20 draft e B2 em branch nova somente após autorização; sem deploy Production, cutover ou migração.

**O protótipo B2-A foi implementado em arquivos de código citados acima; este documento, entretanto, não cria endpoint, chamada remota real, persistência ou sincronização.**
