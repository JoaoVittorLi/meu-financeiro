# Plano de release — Meu Financeiro 1.0.0 (CANDIDATA `v1.0.0-rc.1` PREPARADA — GO FINAL PENDENTE)

> **RECONCILIAÇÃO DE MARCOS E CANDIDATA `v1.0.0-rc.1` (19/11/2026):**
> - **Estados oficiais:** `M1_IMPLEMENTATION_COMPLETE` · `M1_TECHNICALLY_HOMOLOGATED` (experimental `0.9.5-beta.9`, Nível C `15/15` em `b7a3d8a` / `ffc70f2` no [PR #105](https://github.com/JoaoVittorLi/meu-financeiro/pull/105)) · `V1_STABLE_RELEASE_PENDING` · `M2_IN_PROGRESS`. **O Marco 2 não bloqueia a promoção do Marco 1 para `1.0.0`.**
> - **Candidata estável `1.0.0-rc.1`:** construída em `release/v1.0.0-rc.1-candidate-20261119` (`1a22181e6adcb52cca214922821b9f265b76c753`) sobre o `HEAD` `ffc70f2` do PR `#105`, com `package.json`, `package-lock.json`, `mobile-push` e runtime alinhados em `1.0.0-rc.1`, `provenance:verify` PASS (`23 arquivos`), `1006/1006` (`test:db`), `133/133` (`mobile-push`), `dist:windows:stable` (`verify-asar` + `asar-stable-verification.json`), EXE `MeuFinanceiro-Instalador-1.0.0-rc.1-x64.exe` (`115.734.512` bytes, `SHA-256`: `7dd641f3680ee38c34859593af31bb9d336d36793c7a0b320deeba18fb0e352e`) arquivado em `C:\Dev\releases\V1-STABLE-RC1\`.
> - **Gates restantes para `v1.0.0` definitiva:** (1) executar Nível C do pacote `stable` em Windows limpo / VM isolada (impedido neste host para proteger `%APPDATA%\meu-financeiro-desktop`); (2) aprovação expressa do proprietário na [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) antes de merge na `main`, tag `v1.0.0` ou GitHub Release. Trilha paralela do Marco 2: `feat/mf2-intelligence-3-0-copilot-20261118` (`e3c153cb00b3bc9c5bc4f7e8e53f296ba98214a6`).

---

## Snapshot histórico anterior à integração do PR #105 (17/11/2026 — preservado)

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 19 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Gate novo G2-A (P0):** PR #100 deve passar 19 regressões Node/SQLite e casos 600+, dedup/PENDING/POSTED, regra e correção manual, I2-E, conta+prazo, falha/rollback, recibo persistente, startup/restart; o MAIN só habilita contas com confirmação nativa, fora da RC. QA Windows em perfil **sintético** e prova de modelo/calibração são requisitos de GO; sem isso, nenhuma release.


> Reaproveita o plano do [PR #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82), substituindo a cadeia obsoleta #76-only pela candidata mais recente **#76 → #94 → #96**. Este plano não autoriza pipeline, instalador, migração pessoal, tag ou release. **Issue #71 é o marco equivalente v1.0.0 e decisão canônica de GO/NO-GO.**

## 1. Ownership, fronteiras e dependências

| Responsável | Entrega/controlador | Decisão e limite |
|---|---|---|
| **Integrador** | #76 base, #94 B01–B05/I3-01, #96 P0 continuidade | Congelar único HEAD funcional; não duplicar arquivos MAIN/preload nem integrar pela ordem errada |
| **Executor QA** | #65; suites `tests/*.test.cjs` e F08/ASAR | Reportar SHA/OS/Node/npm/comando/log PASS/FAIL/NOT_RUN; propor patch mínimo ao integrador |
| **Designer / QA visual** | #57, #74 e #84 | Verificar fidelidade D01–D05 e B01–B05 no Electron, sem redesign não autorizado |
| **Documentação** | PR de preparação 1.0; histórico #82 | Atualizar este conjunto único; não ajustar o conteúdo de provas anteriores |
| **Proprietário** | **#71** | Aprovar corte de escopo, escrita pessoal, QA pago, versão 1.0.0, builds, migração e publicação |

Cadeia atual: PR #76 (**integração anterior**) → #94 (**D01–D05/B01–B05 + I3-01**) → #96 (**RC-ALL-02.2/02.3**) → QA do SHA exato → decisão humana #71 → release. PR #82 é **acervo documental anterior**, não código a reintegrar.

## 2. Congelamento e SemVer

- **Atual:** `package.json` e `package-lock.json` declaram `0.9.5-beta.8`; não alterar aqui. `main` não é fonte de release 1.0 no estado atual.
- **Candidata futura:** após fechar o QA funcional inicial, o proprietário pode autorizar commit **separado e reproduzível** de `1.0.0-rc.1` ou outra etiqueta pré-release. Alinhar **ambos** package e lock, renderer provenance, build e hashes. Uma RC não é versão estável.
- **Definitiva:** versão `1.0.0`, tag anotada `v1.0.0` e GitHub Release exigem aprovação expressa após QA **na árvore exata**. Alterar versão/metadados/ASAR ou código após homologação exige refazer os gates aplicáveis. Não criar tag agora.
- **Identidade:** `dist:windows` = `app.local.meufinanceiro.rcall01`, produto `Meu Financeiro RC Experimental`, perfil isolado; `dist:windows:stable` = `app.local.meufinanceiro`, produto `Meu Financeiro`, marker `mfDistributionChannel=stable` — QA deve ler o **pacote gerado**, não confiar só no script. Nunca trocar identidades por variável de runtime.

## 3. Gates de homologação (todos bloqueantes)

| Ordem | Gate | Aceite exigido | Dono |
|---|---|---|---|
| G0 | Inventário e SHA | HEAD #96 e dependências congelados, escopo/versionamento/owners fixados, PRs Draft claros | Integrador |
| G1 | Node/npm | Node 22.23.4 npm 10.9.9; `npm ci --no-audit --no-fund`; `test:types`, `test:db` completos PASS no SHA | Executor QA |
| G2 | Segurança e dados | SQLite v7, integridade/FK, 600+ sintéticos, backups mesma versão/WAL, Pluggy cofre fictício, grants/nonce/IPC e rollback PASS | Executor QA + Integrador |
| G3 | Artefatos de código | `npm run compile`; preload check; `test:asar`; `provenance:create`/`verify`; hash/manifesto fiéis ao SHA | Executor QA |
| G4 | Electron real | Boot, 32 capturas, 1366/1920, dark/light, zoom 100/125/150, teclado/Escape/foco/reduced-motion, B01–B05/D05 | QA visual |
| G5 | Windows identidade | Smoke em máquina/VM descartável: instalador/portable sintéticos **somente após autorização de build**, identidade ASAR, `userData` correto, backup/restore, Pluggy offline; investigar erro anterior Windows | Integrador + Proprietário |
| G6 | Política IA e cloud | Leitura autorizada, qualidade I2-E, I3-01, Pulse unavailable sem saldo verificado; automação bancária pessoal P0 homologada após opt-in por conta; demais escritas IA OFF; sem cutover não aprovado | Proprietário |
| G7 | Release | Notas/checksums/rollback, aceite do proprietário, SemVer final, tag/release controlados, verificação de fonte e artefatos | Proprietário |

**Comandos no checkout exato** (não os execute em perfis pessoais):

```bash
git status --short
git rev-parse HEAD
node --version && npm --version
npm ci --no-audit --no-fund
node --test tests/rc-all-02-3-backup.test.cjs
npm run test:types
npm run test:db
node scripts/build-preload.cjs check
npm run test:asar
npm run provenance:create && npm run provenance:verify
```

`npm run test:db` inclui `tests/*.test.cjs` (12 casos RC2.2 + 5 RC2.3; novos cenários não equivalem a PASS). Para evidência completíssima, registrar no relatório: `command`, `SHA`, `Node/npm`, `exit code`, `PASS/FAIL/NOT_RUN`, log e artifact hash. `npm run test:electron-smoke` só em GUI/VM isolada; inspeção humana obrigatória.

## 4. CircleCI: **não disparar sem autorização separada**

`.circleci/config.yml` tem `run_preflight`, `run_windows_qa`, `run_windows_build`, `run_windows_stable_build` todos `false` por padrão, Windows QA/build dependem de preflight. Flags de build de RC e stable são mutuamente exclusivas. Ordem após GO parcial do proprietário: Linux → Windows QA sem instalador → autorização **nova** para build stable. Nenhum runner pago está autorizado por este documento.

O SHA #94 `674108e...` tem status `preflight_linux=success` e `build_windows=error`. Recuperar **logs concretos** do erro, etapa, saída e origem antes de retentar; não inferir causa. SHA #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`: zero status CI, não compartilhar PASS do #94.

## 5. Migração/rollback e distribuição

- **Antes de teste de upgrade:** VM Windows descartável e dados sintéticos com conta/600 lançamentos/budgets/planejamento + cofre fictício; abrir perfil antigo, gerar WAL, validar backup e perfis stable/RC; inspecionar ASAR e `app.getName()`.
- **Em eventual migração real:** exige autorização específica do proprietário e backup externo protegido, verificação de integridade, plano de recuperação e janela de execução. Não usar dados pessoais em CI/QA.
- **Falha de integridade/arquivo `.partial`, duas pastas estáveis, symlink, erro de cofre ou hash:** bloquear update; não mover/copy/importar um perfil RC automaticamente, não renomear SQLite nem credenciais manualmente.
- **Rollback:** impedir reinício da versão nova, preservar SQLite/WAL/cofre e os snapshots antigos imutáveis; restaurar somente backup **revalidado em cópia descartável**, garantindo compatibilidade de schema e fidelidade dos centavos; reabrir versão anterior no perfil correspondente após decisão controlada.
- **Pós-release:** regressão rápida de boot/contas, backup manual verificado, atendimento a falhas, hashes e notas; qualquer correção tem novo SHA e testes repetidos.

## 6. Decisões formais em aberto para #71

**D-1 DECIDIDA — OPÇÃO A:** a **categorização automática bancária pessoal** é P0 obrigatório da v1.0.0. Só pode agir nas contas/períodos autorizados pelo proprietário no MAIN, com consentimento SQLite persistente/revogável, evidência I2-E e D05, recibo/backup/reversão; não exige clique por transação quando critérios restritivos forem homologados. Código proposto em **PR #100 Draft** (base #96). **NO-GO até Node/SQLite, segurança e Electron/Windows no SHA integrado, calibração/aceite e autorização de release.** Outras escritas pessoais IA permanecem OFF e podem ir ao roadmap posterior; não liberar `approvedForPersonal` genericamente.

**D-2 objetivo cloud:** sem autorizar migração/cutover pessoal na 1.0 enquanto paridade e permissão não forem validadas.

**D-3 GO:** somente após G0–G7 e logs Windows classificados, aprovar commit de versão, build e tag em momentos distintos. Sem aprovação registrada, **NO-GO**.


## G-P0-CAT — Requisito bloqueante da 1.0.0 (aprovado em 17/11/2026)

Não iniciar `1.0.0-rc.1` nem GO da #71 até integrar e homologar CAT-01 a CAT-05 no **mesmo SHA final** da candidata. O objetivo é que o Meu Financeiro categoriza automaticamente movimentações bancárias autorizadas com segurança, após primeira prévia/aprovação nativa e com rotina local posterior.

**Gates adicionais obrigatórios:** (1) metadados Pluggy sem Premium, não fabricação de MCC/CNPJ e diagnóstico de cobertura; (2) migração SQLite de metadata, consents, jobs, assignments e receipts, backup completo/WAL/restore; (3) classificador D05 com regra aprovada, evidência corroborada, prioridade manual/splits, transferências/ignore/PENDING/estorno, pais/filhos 14×61; (4) primeira análise integral paginada sem limite visual de 2.500, prévia, confirmação nativa, progresso, pausa/cancelamento/reinício; (5) automação pós-sync e diária **somente enquanto aberto**, revogação por conta, idempotência e recibos/undo; (6) UI real Movimentações/Inteligência/Central de Revisão, light/dark, acessibilidade; (7) dados sintéticos 3 contas/600+, falhas/recovery; (8) Node 22.23.4/npm 10.9.9, SQLite, TS, ASAR, provenance e Electron Windows comprovados por logs.

**Sequência de código isolado:** PR #99 CAT-01/02, #101 CAT-03, #102 CAT-04/05, todos dependentes da #96; o Integrador da #49 retém MAIN/preload/migração/IPC/renderer e deve incorporar após revisão. O `approvedForPersonal:()=>false` geral permanece; concessão específica para CAT-05 deve usar gate distinto, consentimento nativo e backup, sem ativação automática por configurações padrão. Sem QA oficial, os três PRs são DRAFT/NOT_HOMOLOGATED.

**Proibido até nova autorização:** CircleCI pago, EXE, Cloudflare, tagging, merge main, dados pessoais e GitHub Release. Estes documentos apenas mudam o critério de aceite, não habilitam a automação.
