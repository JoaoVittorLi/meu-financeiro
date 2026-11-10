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


## B3.2 — bootstrap temporário de lockfiles no CircleCI Linux (configuração publicada)

**Referência inicial confirmada:** branch `fix/mf2-c11-reproducible-build-20261110`, HEAD antes de editar `98bc5f01a2fa543bf187a92f1d00e5e1ace57c34`; base candidata original `7a01f1cc344e88188bc5eeea59bf2324335a051e` mantida. **Commit da alteração em `.circleci/config.yml`:** `7ff410670ccf6a81662c25ecc207cad207931733`. O HEAD do PR continuará avançando somente com esta documentação; para disparo, usar **HEAD atual** mostrado no PR #19 e conferir `CIRCLE_SHA1`.

**Implementação somente CI:** foi criado parâmetro booleano `run_lockfile_bootstrap` com padrão `false`, job `lockfile_bootstrap`, workflow `lockfile_bootstrap_on_demand`, preservando `preflight_on_demand` e `windows_on_demand`. Os dois workflows antigos recebem guarda `not: run_lockfile_bootstrap` para evitar simultaneidade; o novo somente roda se `run_lockfile_bootstrap=true`, `run_preflight=false`, `run_windows_build=false`. Nenhum `build_windows` faz parte do workflow bootstrap.

**Ambiente e execução esperada:** mesma imagem Linux digest pinada do preflight `node:22.23.4-bookworm@sha256:e273cf2a19c7334c03f52e2ca933ecdfc3fbfaad49db7b8bc8c3edd9ac34e9c7`; o job verifica `node --version=v22.23.4`, `npm --version=10.9.9`, `CIRCLE_BRANCH` e `git rev-parse HEAD=CIRCLE_SHA1`, e usa somente `https://registry.npmjs.org/`. Executa, separadamente, o comando `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org/` na raiz e em `mobile-push/`. Não roda pós-instalação, testes, Wrangler, deploy, Electron nem Windows. Reprova se alterar os manifestos `package.json`.

**Validação embarcada dos dois locks:** JSON `lockfileVersion=3`, nome e versão consistentes com os manifests e o nó raiz, dependências diretas `dependencies/devDependencies/optionalDependencies` idênticas às de cada manifesto, árvore não vazia e entradas de pacotes de registry (fora links/bundled) com `version`, `resolved` HTTPS em `registry.npmjs.org` e `integrity` em formato SRI; registra quantas entradas usam SHA1 para auditoria posterior. Falha de validação impede a preparação dos artefatos.

**Artefatos esperados, ainda NÃO GERADOS por execução comprovada:**
- `MF2-B3-Lockfile-Bootstrap/desktop-package-lock.json` — oriundo da raiz do projeto;
- `MF2-B3-Lockfile-Bootstrap/mobile-push-package-lock.json` — oriundo de `mobile-push/`;
- `MF2-B3-Lockfile-Bootstrap/SHA256SUMS.txt` — SHA256 dos dois arquivos;
- `MF2-B3-Lockfile-Bootstrap/METADATA.txt` — repositório, branch, commit, Node, npm e URL do registry.

O step `store_artifacts` publica somente a pasta `circleci-artifacts/lockfile-bootstrap`. Ele não commita os arquivos nem aciona outros jobs. **Artefatos só são confiáveis após job `success` e conferência dos hashes.**

### Validação estática realizada

A configuração publicada foi analisada por parser **PyYAML 6.0.3** em cópia temporária; verificados: três parâmetros com `default=false`, três jobs, três workflows, imagem fixada idêntica, dois comandos de geração, `checkout/run/store_artifacts`, exclusividade do workflow bootstrap, preservação do preflight e Windows. Extraído o script `run.command` e aplicado `bash -n`, e extraído o heredoc Node e aplicado `node --check`: **PASS**. **Não foi executado `circleci config validate` via CLI autenticada, nem o job real**, portanto a validação de schema CircleCI e a conclusão operacional permanecem pendentes; confirmar na UI antes da execução. O YAML foi comparado com a versão publicada após o commit.

### Disparo manual exato e inspeção

1. Abrir [CircleCI Pipelines](https://app.circleci.com/) no projeto **`JoaoVittorLi/meu-financeiro`**, selecionar **Trigger Pipeline**.
2. Selecionar **Config branch** = `fix/mf2-c11-reproducible-build-20261110` e **Checkout branch** = **a mesma branch**; confirmar o SHA atual do PR #19. Não selecionar `main` nem a candidata original.
3. Informar **`run_lockfile_bootstrap=true`**, **`run_preflight=false`** e **`run_windows_build=false`**.
4. Conferir que aparece **somente** `lockfile_bootstrap_on_demand` → `lockfile_bootstrap`; se aparecer job Windows ou preflight, não prosseguir e revisar seleção de parâmetros.
5. Abrir o job, confirmar `CIRCLE_BRANCH`, commit `CIRCLE_SHA1` e impressão de validação de ambos os locks; baixar os quatro arquivos da aba **Artifacts**; verificar `sha256sum --check SHA256SUMS.txt` na pasta dos arquivos baixados, comparar `METADATA.txt` ao SHA do job.
6. Se o job falhar, registrar URL, primeira mensagem relevante e corrigir a causa mínima em PR #19 (sem contornar validação). Se o job passar, anexar URL/commit/artefatos no PR #19 para permitir a integração.

**Após obter os artefatos autênticos:** revisar integridades, dependências transitivas e eventuais SHA1/avisos, copiar para `package-lock.json` e `mobile-push/package-lock.json` (nomes originais), migrar instalações Linux/Windows para `npm ci` e provar em executor com rede que os dois `npm ci`, TypeScript, SQLite, renderer, ASAR, Worker/PWA e Wrangler dry-run passam. Gerar SHA novo, executar **somente preflight Linux** nesse SHA com `run_preflight=true`, `run_windows_build=false`, `run_lockfile_bootstrap=false`. Depois remover bootstrap temporário, ou justificar/documentar explicitamente se desabilitado, mantendo `default=false`. Nenhuma validação do SHA antigo substitui o novo.

**Resultado atual:** B3.2 **CONFIG PUBLICADA / EXECUÇÃO CIRCLECI E LOCKFILES PENDENTES**. Ferramentas conectadas nesta sessão não permitem disparar CircleCI nem ler artefatos privados do job; não há pipeline ou lockfiles desta missão para reportar. B3 permanece `EM_TESTE`, `G0=NAO_HOMOLOGADO`. Nenhum build Windows, release, merge, Cloudflare Production ou migração financeira executado.


## B3.2.1 — correção do erro de compilação da pipeline #182 (10/11/2026)

**Evidência:** screenshot do usuário com CircleCI pipeline #182, mensagem `Configuration error: Error calling workflow: 'lockfile_bootstrap_on_demand'` e `No workflows for this pipeline`. Esse erro acontece **antes de entrar no executor**, portanto não é falha do npm nem prova de incompatibilidade de Node. O erro completo em detalhes da pipeline não foi consultado diretamente, pois não há conector CircleCI autenticado.

**Causa técnica provável e específica:** o trecho de shell `node <<'NODE'` dentro de `.circleci/config.yml` usava `<<` sem escape. Em config 2.1, o compilador CircleCI interpreta `<<` como delimitador de parâmetros. A documentação oficial do fornecedor exige escrever `\<<` em heredocs: https://circleci.com/docs/guides/orchestrate/config-templating/ e https://support.circleci.com/en/articles/36469244864539-How-to-solve-the-escaping-character-error. A revisão mudou **somente** `node <<'NODE'` → `node \<<'NODE'` (escape para o compilador); o shell continua recebendo um heredoc válido após processamento.

**Controles:** mantidos os três parâmetros com `default=false`, workflow bootstrap isolado, job Linux, artefatos, SHA256, verificaçōes dos manifestos, e preflight/Windows existentes. Nenhum lockfile gerado, teste npm/Windows executado, deploy Production ou merge. Atualizado roadmap MF2-00 no mesmo PR. **G0 permanece NAO_HOMOLOGADO**.

**Próxima prova:** disparar novo pipeline apenas na branch B3 do PR #19 com `run_lockfile_bootstrap=true`, `run_preflight=false`, `run_windows_build=false`; validar que o job inicia, Node/npm corretos e os arquivos aparecem em Artifacts. **Se houver novo erro**, recolher mensagem completa de Config Error e corrigir pela primeira causa real; não declarar sucesso antes do job.


## B3.2.2 — correção do validador de origem Git do `@electron/node-gyp` (10/11/2026)

**Erro verificado:** `ci/circleci: lockfile_bootstrap = failure` no SHA **`ae6dc27f3aaf49da99cda6ac95644e1f8aa333ef`**: [job CircleCI](https://app.circleci.com/workflow/8c4702d8-1de2-4791-a86b-287f65dc1720/job/05d35d08-43fd-43fa-a164-8e35e89571f6). O usuário informou erro específico do validador exigindo `https:` para `@electron/node-gyp` cujo `resolved` é `git+ssh:`. A regra anterior foi confirmada em `.circleci/config.yml`: todos os entries sem exceção tinham `assert.equal(new URL(entry.resolved).protocol,'https:')` e SRI obrigatória. Documentação oficial do npm confirma que lockfile pode apontar a Git URL com SHA de commit fixado, e `integrity` de Git pode ser diferente de SRI de tarball ou não existir.

**Correção mínima publicada no próprio PR #19:** commit **`aed2e3464addd2af5b01052b07535491fa03120f`**, apenas `.circleci/config.yml`. O validador agora separa **tarballs do npm registry** e **Git**:
- Tarballs continuam obrigados a **HTTPS no host `registry.npmjs.org`**, com `integrity` SRI `sha1/256/384/512`; nenhum allowlist genérico foi criado.
- A única exceção de Git permitida é **`node_modules/@electron/node-gyp`** no repositório **`github.com/electron/node-gyp`**, nas formas `git+ssh` ou `git+https`, com **commit hexadecimal completo de 40 caracteres** no fragmento `#`. Falha se apontar para branch/tag mutável, outro host ou outro repositório; se `integrity` estiver preenchida, deve ser uma referência válida de commit coincidente ou SRI válida.
- `gitPinned` é reportado separadamente de `tarballs`, preservando a auditoria; `--ignore-scripts`, branch+SHA, Node/npm, registro npm, artefatos SHA256 e guardas Windows permanecem inalterados.
- Nenhum `package.json` ou dependência direta alterado, nenhum lockfile modificado/gerado localmente; não executar `git config --global` nem introduzir credenciais SSH ou dependência Git nova.

**Validação executada aqui, sem rede:** sintaxe do script JavaScript extraído da config publicada: **PASS**. Rodado o próprio validador sobre fixtures JSON sintéticas com manifestos/locks em memória (sem dados pessoais ou arquivos reais): **9/9 casos PASS**: aceitou Git SSH/HTTPS do repo oficial com commit completo; rejeitou SHA ausente/branch mutável, repositório imitador, host não confiável, `git://`; rejeitou tarball HTTP, tarball externo e ausência de SRI. Isso é somente teste de lógica do validador, **não** substitui pipeline real, `npm ci`, contagem de transitivas ou teste da infraestrutura.

**Resultado:** `B3.2` segue **EM_TESTE**, pendente de novo acionamento CircleCI; **nenhum job verde, lockfile autenticado ou artefato validado na revisão corrigida foi apresentado**. O sucesso/falha futura poderá revelar outro pacote legítimo ou risco novo; não afrouxar validação indiscriminadamente. Se `npm ci` posteriormente falhar por acesso SSH, diagnosticar transporte e preferir remediação pontual para HTTPS, sem reescrever lockfiles às cegas.

**Próxima ação manual:** disparar `lockfile_bootstrap_on_demand` no **HEAD atual do PR #19**, com Config=Checkout=`fix/mf2-c11-reproducible-build-20261110`, `run_lockfile_bootstrap=true`, `run_preflight=false`, `run_windows_build=false`. Obter e conferir [job/artifacts], `METADATA.txt`, `SHA256SUMS.txt` e os dois lockfiles; só então incorporá-los, mudar instalações para `npm ci`, testar Linux em novo SHA, remover bootstrap temporário e submeter auditoria B3. **Não iniciar build Windows, merge, release ou Production. G0 NAO_HOMOLOGADO.**
