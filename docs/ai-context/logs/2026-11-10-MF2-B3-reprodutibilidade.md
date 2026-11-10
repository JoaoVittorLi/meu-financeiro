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
