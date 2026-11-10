# MF2-01 / B2-B0 — Transporte HTTP simulado executável

**Data:** 10/11/2026. **PR:** [#21](https://github.com/JoaoVittorLi/meu-financeiro/pull/21) draft. **Branch:** `feat/mf2-01-b2-protected-transport`. **SHA técnico anterior:** `02a56c6382211b6feb224050223b1505ffffd100` (CircleCI Linux SUCCESS [job](https://app.circleci.com/workflow/532a1f5a-b7a4-478b-8e54-9318fa30bd54/job/5e5bb972-3b9a-4bad-b7cc-02222c781ce6)). **Status B2-B0:** IMPLEMENTADA/EM TESTE, CI novo SHA pendente. **G0/G1: NAO_HOMOLOGADOS.** **Argon necessário? NÃO para B0; AUDITORIA para Preview B1 antes de transporte sensível.**

## Mudança funcional publicada (não apenas documentação)

- `shared/mf2-b2-http-transport.cjs`: Request/Response e `fetchImpl` injetável, `https://mf2-b2-synthetic.invalid` fixa, path dedicado sem registro em Worker, `enabled=false` por padrão, POST/JSON/origin/test-mode/Authorization fake, timeout, abort, redirects manuais recusados, 256 KiB, sessão/owner/replay do B2-A e saída minimizada.
- `tests/mf2-b2-http-transport.test.cjs`: 19 novos casos HTTP com dados fabricados; covers flags-off, origem, auth expirada/ausente/owner errado, replay/concorrência/capacidade, 426 versão, payload não-sintético/grande, método/path/MIME, redirecionamento, timeout, rede indisponível, erro sem vazamento, resposta adulterada e ausência de escrita.
- `scripts/mf2-b2-http-demo.cjs` e `tests/mf2-b2-http-b1-integration.test.cjs`: fluxo de demonstração e teste com o motor real B1 (publicados para Node oficial; não executados localmente por falta de checkout completo).
- `docs/ROADMAP_MF2.md`, desenho B2 e este log atualizados no mesmo PR.

## Evidências objetivas

| Teste | Resultado | Limite |
| --- | --- | --- |
| `node --check shared/mf2-b2-http-transport.cjs` | PASS | Node v22.16.0 local |
| `node --test tests/mf2-b2-http-transport.test.cjs` | **19/19 PASS** | Runner Node real v22.16.0; testes HTTP loopback |
| `node --test tests/mf2-b2-http-transport.test.cjs tests/mf2-b2-synthetic-transport.test.cjs` | **38/38 PASS** | Node real v22.16.0, duração 393 ms; nenhum dado real |
| Integridade de 4 blobs Git de arquivos locais testados/publicados | PASS | `shared/mf2-b2-http-transport.cjs` `c3c41defe03d6103897e0c3eab3b21397161cbc9`, `tests/mf2-b2-http-transport.test.cjs` `3ea1cbadd8236f7525ff2c6d28a56b7a7ece3f84`; CLI/teste B1 publicados byte a byte |
| Motor B1 real com fixtures 1×2 do demo | PASS em V8 | `only_one_source=1`, fluxo POSTED/PENDING e flags false; **não é HTTP integrado Node** |
| `node --test tests/mf2-b2-http-b1-integration.test.cjs` | NÃO EXECUTADO | Depende do checkout completo da branch B1 |
| `node scripts/mf2-b2-http-demo.cjs` | NÃO EXECUTADO | Mesmo motivo |
| `npm run test:db`, `npm run test:types`, `npm run compile`, Worker/PWA e Wrangler dry-run no novo SHA | NÃO EXECUTADOS | CircleCI novo SHA pendente |
| `preflight_linux` CircleCI novo SHA | NÃO EXECUTADO | Sem ferramenta autenticada CircleCI para disparo; não confundir SHA B2-A verde com B2-B0 |
| Build Windows / Cloudflare Production / sync real / migração / IA paga | NÃO EXECUTADOS | Proibidos nesta missão |

**Falhas P2 tratadas:** JSON sem campos arbitrários, limite de resposta/corpo, redirecionamento rejeitado, headers sem credenciais em logs, status/código correlacionados, flags bloqueando a superfície de teste e abuso por replay. A sessão HMAC é **somente mock**; `Set` anti-replay não é persistente, digest SHA256 não autentica origem. Em B2-B1 devem ser substituídos por Access/sessão real apenas mediante gate/Argon.

**Pipeline final exigida:** CircleCI → Trigger Pipeline, Config Branch = Checkout Branch = `feat/mf2-01-b2-protected-transport`, `run_preflight=true`, `run_windows_build=false`. `preflight_on_demand` → `preflight_linux`. Conferir `CIRCLE_SHA1` igual ao HEAD publicado e logs das etapas B1 explícita, `npm run test:db` (inclui novos testes B2-B0), TypeScript, compile, ASAR, Worker e Wrangler dry-run. **Nenhum build Windows**.

**Próxima decisão:** avaliar resultados do SHA final do PR #21; em seguida, se P0/P1 ausentes, autorizar **B2-B1 Preview protegido com fixtures exclusivamente sintéticas** após auditoria Argon dirigida. Sem merge, release, migração, fonte cloud canônica ou G1 homologado.
