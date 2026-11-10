# MF2-00 / B3 — Reprodutibilidade: checkpoint parcial

**Data:** 2026-11-10
**Origem:** `integration/mf2-baseline-candidate-20261109` SHA `7a01f1cc344e88188bc5eeea59bf2324335a051e`.
**Branch:** `fix/mf2-c11-reproducible-build-20261110` (PR draft).
**Status:** PARCIAL / BLOQUEADA NA ETAPA DE LOCKFILES, **não homologado**.

## Constatações

- B2 original: `ci/circleci: preflight_linux` [success](https://app.circleci.com/workflow/4a8c3a15-4101-4333-95c7-8351fd2f37a4/job/32ffc3e0-4838-4994-befe-a50069d2d993), no SHA original.
- Nenhum `package-lock.json` versionado na raiz nem em `mobile-push`. A versão direta do desktop é exata para Electron 45.2.3, Electron Builder 26.0.0, TypeScript 5.8.3 e @electron/asar 4.3.1; `wrangler` usa `^4.102.0`.
- Node.js 22.23.4 com npm 10.9.9 verificado no arquivo oficial de versões Node (https://nodejs.org/en/download/archive/v22); imagem oficial Docker index digest registrada em https://hub.docker.com/layers/library/node/22.23.4-bookworm/images/sha256-539d4d5b9c0df96bb9d1229264d358dc816e8592cb8867828a580b527e7ad0fa.
- O container local disponibiliza Node 22.16.0/npm 10.9.2/TypeScript 5.8.3, mas **não consegue resolver registry.npmjs.org**; por isso não permite gerar lockfiles autênticos nem executar `npm ci` e testes de integração usando as dependências exigidas.
- A conexão GitHub permite mudanças em branch/PR, mas não há nesta sessão um executor CircleCI habilitado para disparar pipelines; não foi disparado job Windows nem Linux para esta branch B3.

## Mudanças implementadas nesta branch

- Node/npm fixados para 22.23.4/10.9.9 em ambos os `package.json` (engines), imagem CircleCI pinada por digest e `.nvmrc`.
- Windows passa a baixar `v22.23.4` de nodejs.org, exige ZIP com nome exato e confere SHA256 e npm version.
- CI valida versões antes dos testes; Wrangler dry-run não faz download implícito de uma CLI diferente.
- **Intencionalmente não substituímos `npm install` por `npm ci` sem lockfile**, para não criar uma branch imediatamente quebrada.
- ROADMAP e este log atualizados; nenhum arquivo de regra financeira, app, autenticação, banco ou Cloudflare Production alterado.

## Testes

| Item | Resultado | Razão |
| --- | --- | --- |
| Verificação estática de mudanças de strings do CI/PowerShell | INSPECIONADO | Não é teste executado de CI/Windows |
| `npm ci` raiz/Worker | NÃO EXECUTADO | Registry npm indisponível; lockfiles não gerados |
| TypeScript/SQLite/provenance/ASAR | NÃO EXECUTADOS NO NOVO SHA | Dependências indisponíveis nesta sessão |
| Worker/PWA/Wrangler dry-run | NÃO EXECUTADOS NO NOVO SHA | Dependências indisponíveis |
| CircleCI Linux no novo SHA | NÃO EXECUTADO | Falta lockfile e ferramenta para disparar pipeline |
| Build Windows | NÃO EXECUTADO | Expressamente proibido na missão |

## Próximo passo / rollback

Terminar geração e revisão dos dois lockfiles num Work com rede, converter as instalações para `npm ci`, rodar testes e CircleCI preflight Linux no novo SHA. Após sucesso e revisão, avaliar substituição de candidata; G0 permanece `NAO_HOMOLOGADO`. Rollback: reverter commits da branch B3, preservando o ref do SHA original e todo o histórico Git. Ver `TESTING_AND_RELEASE.md`.


## B3.1 — tentativa de conclusão em 10/11/2026, com impedimento reproduzido

**Missão recebida:** concluir o PR #19 na branch exclusiva sem repetir a implementação inicial. **HEAD de código no início da inspeção:** `754731329acb76858a40f003c233339cbada1e52`; PR aberto/draft com base na candidata congelada `7a01f1cc344e88188bc5eeea59bf2324335a051e`. O diff do PR #19 foi lido; contém `.nvmrc`, `engines`, pin de imagem CircleCI, versão fixa e SHA256 do Node Windows, verificação npm e bloqueio de download implícito do Wrangler. **Nenhum lockfile** foi encontrado na árvore do commit inicial (272 blobs; `package-lock.json` raiz e `mobile-push/package-lock.json` ausentes).

**Prova da limitação de ambiente:** execução local de `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=4000 --registry=https://registry.npmjs.org` em uma **fixture mínima descartável** (`typescript@5.8.3`, sem o aplicativo e sem dados financeiros), terminou com **exit code 1**: `npm error code EAI_AGAIN`, `request to https://registry.npmjs.org/typescript failed, reason: getaddrinfo EAI_AGAIN`. A tentativa HTTPS com IP explícito também foi recusada; `git ls-remote` para GitHub falhou por resolução de DNS. `npm cache ls` encontrou 0 entradas. **Nenhum lockfile foi gerado ou copiado**, porque não seria autêntico/íntegro. Executor local disponibiliza Node `v22.16.0` e npm `10.9.2`, **diferentes** da toolchain requerida `22.23.4/10.9.9`.

**O que foi verificado no GitHub:** `.circleci/config.yml` da B3.1 ainda usa `npm install --package-lock=false` na raiz e em `mobile-push/`, e `.circleci/build-windows.ps1` ainda usa `npm install --package-lock=false`. A conversão antecipada para `npm ci` quebraria ambos os fluxos sem locks, portanto **não foi realizada**. Dependências diretas de desktop continuam com versões explícitas; `wrangler ^4.102.0` permanece com range e só será congelado quando o lockfile legítimo for gerado. Não foi possível inspecionar a árvore de transitivas, hashes de integrity, vulnerabilidades npm audit ou compatibilidade executada.

| Critério B3.1 | Resultado da inspeção |
| --- | --- |
| Node 22.23.4/npm 10.9.9 declarados no PR #19 | **PRESENTE EM CÓDIGO**, não executado neste container |
| `package-lock.json` da raiz versionado | **AUSENTE / BLOQUEADO POR REGISTRY** |
| `mobile-push/package-lock.json` versionado | **AUSENTE / BLOQUEADO POR REGISTRY** |
| `npm ci` Linux/Windows | **NÃO IMPLEMENTADO**, seria inválido sem lockfiles |
| `npm ci` real raiz/PWA | **NÃO EXECUTADO**, deps/versões exatas indisponíveis |
| Desktop TypeScript/SQLite/renderer/ASAR/provenance | **NÃO EXECUTADO NO SHA B3** |
| Worker/PWA testes e Wrangler `--dry-run` | **NÃO EXECUTADO NO SHA B3** |
| Preflight CircleCI B3 `preflight_linux` | **NÃO EXECUTADO**; nenhum status CircleCI no SHA inicial e sem ferramenta de trigger |
| Build Windows, release, merge, produção e migração | **NÃO EXECUTADOS** |

**Primeiro erro efetivo desta missão:** `EAI_AGAIN` no resolvedor de DNS de `registry.npmjs.org` ao solicitar `typescript` numa fixture, e **não** falha de testes do aplicativo. A correção mínima está fora dos arquivos do projeto: usar executor com acesso legítimo ao registry npm. Não mudar dependências diretas, não forjar `resolved`/`integrity` e não desativar testes.

**Ação exata para destravar:** em ambiente Linux de rede e toolchain Node `22.23.4`/npm `10.9.9`, checkout **do mesmo branch PR #19** e conferir HEAD atual; em raiz e `mobile-push/` rodar `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, inspecionar `lockfileVersion`, dependências, `resolved` e `integrity`; então trocar três instalações do pipeline (`npm ci --no-audit --no-fund`), testar `npm ci` de ambos e suíte integral, **commitar no PR #19**. Disparar **somente Linux** em CircleCI com Config=Checkout=`fix/mf2-c11-reproducible-build-20261110`, `run_preflight=true`, `run_windows_build=false`, comprovar status no SHA novo. Aguardar auditoria; **não iniciar B4**.

**Rastreabilidade:** esta seção e alteração correspondente no ROADMAP são **documentação de bloqueio, não implementação da B3.1**. Qualquer novo commit documental incrementa HEAD do PR, mas não representa lockfiles concluídos/testes verdes. **B3 permanece PARCIAL / G0 NAO_HOMOLOGADO**.
