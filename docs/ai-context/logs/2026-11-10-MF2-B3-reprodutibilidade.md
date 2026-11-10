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


## B3.2.3 — bootstrap CircleCI SUCCESS no SHA corrigido, aguardando artefatos (10/11/2026)

**Evidência oficial posterior à falha anterior:** o GitHub registra `ci/circleci: lockfile_bootstrap` com **state=success** e descrição `Your tests passed on CircleCI!` no SHA exato **`ff51444538e4c745d064f4820f680ec8b617719c`**. Status `pending` às **2026-11-10T15:19:08Z** e `success` às **2026-11-10T15:19:26Z**. [Job CircleCI — SUCCESS](https://app.circleci.com/workflow/5251af99-07fb-44a7-93ea-f25be9a4bf1d/job/bdd7f7cd-1a9c-4a09-9647-6fd19b7f3ced). O HEAD remoto desse branch correspondia ao SHA executado no momento da conferência; a candidata original continua congelada em `7a01f1cc344e88188bc5eeea59bf2324335a051e`.

**O que o job verde comprova:** a configuração no SHA citado seleciona o workflow Linux `lockfile_bootstrap_on_demand`; o step verifica Node **22.23.4**, npm **10.9.9**, checkout/branch e gera, no registry oficial, os dois arquivos npm `--package-lock-only --ignore-scripts`. O comando do job verifica estrutura `lockfileVersion=3`, dependências declaradas, integridade de tarballs e a exceção Git estrita para `@electron/node-gyp`; copia ambos, produz `SHA256SUMS.txt`, verifica hashes localmente e prepara `METADATA.txt` com SHA/branch. O job contém `store_artifacts`; o status de sucesso corrobora a execução desses passos, mas **não substitui a inspeção/download independente dos arquivos efetivamente publicados**.

**Limite de acesso:** a página autenticada de Artifacts do CircleCI não está disponível através dos conectores desta sessão; tentativa de abrir o job externamente não permitiu recuperar os arquivos. **Nenhum dos quatro artefatos foi baixado nem conferido fora do runner**, portanto ainda não há lockfiles disponíveis para commit. Não atribuir `npm ci` aprovado ou conteúdo/hash determinado sem obter seus bytes. O [PR #19](https://github.com/JoaoVittorLi/meu-financeiro/pull/19) ainda **não contém** `package-lock.json` raiz ou `mobile-push/package-lock.json`; os três pontos de instalação continuam em `npm install --package-lock=false`.

**Artefatos que o usuário deve baixar em [Artifacts do job](https://app.circleci.com/workflow/5251af99-07fb-44a7-93ea-f25be9a4bf1d/job/bdd7f7cd-1a9c-4a09-9647-6fd19b7f3ced):**
1. `MF2-B3-Lockfile-Bootstrap/desktop-package-lock.json`;
2. `MF2-B3-Lockfile-Bootstrap/mobile-push-package-lock.json`;
3. `MF2-B3-Lockfile-Bootstrap/SHA256SUMS.txt`;
4. `MF2-B3-Lockfile-Bootstrap/METADATA.txt`.

**Próxima ação exata:** disponibilizar nesta conversa os quatro arquivos ou seu ZIP fiel, sem renomeações, para conferir SHA256 e `METADATA` (commit `ff51444538e4c745d064f4820f680ec8b617719c`, branch exata) e revisar conteúdo/URLs/integrity. Em seguida, incorporar os dois locks autênticos no PR #19 em seus caminhos originais, mudar as instalações Linux e Windows para `npm ci`, executar os testes de desktop/SQLite/renderer/ASAR e Worker/PWA/Wrangler dry-run, rodar **somente preflight Linux** no novo SHA e finalmente remover bootstrap temporário (ou deixar desativado com decisão explícita). Nova auditoria antes de B4.

**Status desta verificação:** `bootstrap Linux=SUCCESS`, **`artefatos externamente verificados=NÃO`**, `lockfiles versionados=NÃO`, `npm ci=PENDENTE`, `preflight B3 novo SHA=PENDENTE`, `G0=NAO_HOMOLOGADO`. Não houve Windows, merge, release, Cloudflare Production nem migração financeira.


## B3.3 — incorporação verificável dos dois lockfiles recebidos (10/11/2026)

**Fonte e proveniência:** job [CircleCI `lockfile_bootstrap=success`](https://app.circleci.com/workflow/5251af99-07fb-44a7-93ea-f25be9a4bf1d/job/bdd7f7cd-1a9c-4a09-9647-6fd19b7f3ced), commit de origem `ff51444538e4c745d064f4820f680ec8b617719c`. O proprietário forneceu `METADATA.txt` e `SHA256SUMS.txt` em texto e os dois conteúdos JSON completos como arquivos Markdown colados. Dados declarados: repositório `JoaoVittorLi/meu-financeiro`, branch `fix/mf2-c11-reproducible-build-20261110`, Node `22.23.4`, npm `10.9.9`, registry `https://registry.npmjs.org/`. O SHA da origem **não equivale ao SHA novo do PR**.

**Reconstrução sem inventar conteúdo:** foram removidas **apenas** as cercas Markdown (`\`\`\``) dos dois anexos e preservada a quebra de linha terminal do JSON. Hashes SHA256 reais do JSON reconstruído, calculados no container, são **iguais** aos fornecidos pelo proprietário:
- `package-lock.json` (raiz): **`a918d30636f86f11aadb48265f276f40fba03e25b30ade04c2e3c6dab4cdee96`**, 176657 bytes, `lockfileVersion=3`, 382 entradas de dependências.
- `mobile-push/package-lock.json`: **`f558ca340c22520e1b1859a8ad0cbc6bb432914207618df078b2c9e7de65df3d`**, 49785 bytes, `lockfileVersion=3`, 91 entradas de dependências.
- **Prova de publicação íntegra:** após commits no GitHub, os blobs do Git correspondem exatamente aos bytes de entrada: desktop `f0b0da96d54f4258578e02d520d96866b7f817bc` (commit `7ad26ef8978b57a8d4049883059f8236035988e2`); Worker `4bb3fddfea111ec3da334e8d20508afc4692e1f1` (commit `c6f22d285543e6f494c4eb2cbd7d70e61284c580`). Os blobs foram buscados e comparados aos SHA1 de blob Git calculados localmente; nenhum `resolved`, `integrity` ou pacote foi reescrito.

**Auditoria estrutural local (não é `npm audit`):** nomes, versões, `engines` e quatro devDependencies diretas desktop conferem com `package.json`; Worker mantém `wrangler:^4.102.0`, resolvido a **4.160.0** no lock. Desktop: **381** resolved HTTPS `registry.npmjs.org` + uma exceção `@electron/node-gyp` `git+ssh://git@github.com/electron/node-gyp.git#06b29aafb7708acef8b3669835c8a7857ebc92d2` com `integrity` SHA512; Worker: **91** resolved HTTPS do mesmo registry. Nas entradas inspecionadas não houve `resolved` ou `integrity` ausente/inválido, host inesperado nem outra fonte Git. O desktop apresenta **12 entradas de depreciação**, sobretudo `glob` antigo, além de `tar`, `inflight`, `rimraf` e `@npmcli/move-file`; registrar como risco de manutenção e revisar vulnerabilidades em missão apropriada, sem upgrades diretos fora de escopo. Não houve instalação nem consulta de advisory.

**Transição implementada na mesma branch (não executada):**
- `.circleci/config.yml`: nos **dois steps preflight Linux**, `npm install --package-lock=false` foi substituído por `npm ci --no-audit --no-fund` (commit `00764f020963287d5e71e6dadceda7280b28c044`). Permanecem `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, `npm run test:types`, `npm run test:db`, `npm run compile`, `renderer-provenance check-bundle`, `npm run test:asar`, Worker `npm test` e `npx --no-install wrangler deploy --dry-run`.
- `.circleci/build-windows.ps1`: substituído `npm install --package-lock=false` por `npm ci --no-audit --no-fund` (commit `748a7fce73fbe6192261644a76b55f50b179962e`). **Não se executou Windows**; mantidas SHA256 do Node e dos EXEs, manifest/ASAR/provenance, `dist:windows` e sem publicação de releases.
- O bootstrap temporário `run_lockfile_bootstrap` continua com **default=false**, e workflows preflight/Windows protegidos por `not`; será removido **depois de validar `npm ci` e preflight do novo SHA**, ou mantido desativado mediante decisão explícita. Não executar mais bootstrap para instalar dependências.

**Ponto de atenção para o primeiro `npm ci`:** o `@electron/node-gyp` está validamente fixado a commit por Git SSH no lockfile; alguns runners sem chaves SSH podem não conseguir baixar essa dependência. Não foi demonstrada falha de `npm ci`. Se aparecer `Permission denied (publickey)` ou falha equivalente, preferir **redirecionamento temporário e restrito a essa origem Electron GitHub para transporte HTTPS via Git config do job**, sem apagar ou fabricar o lockfile, sem dependências novas ou chaves no CI. Não mudar origem sem erro e sem teste.

**Testes e limites:** `npm ci` **NÃO EXECUTADO** neste executor sem dependências/registry disponível; testes TypeScript/SQLite/renderer/ASAR e Worker/PWA/Wrangler **NÃO EXECUTADOS NO SHA NOVO**; nenhum resultado CircleCI Linux neste SHA foi conferido. Portanto `B3=EM_TESTE`; `G0=NAO_HOMOLOGADO`; PR #19 continua draft, sem autorização para B4.

**Próxima ação exata:** na UI CircleCI usar **Config branch = Checkout branch = `fix/mf2-c11-reproducible-build-20261110`**, `run_preflight=true`, `run_windows_build=false`, `run_lockfile_bootstrap=false`. Conferir `CIRCLE_SHA1` e commit em checkout contra o **HEAD final do PR #19 após esta documentação**; coletar URL, first error se falhar, stdout separado de TypeScript/SQLite/provenance/ASAR/Worker/Wrangler e concluir apenas se todos os passos passarem. Após CI verde, inspecionar aviso de depreciações e artefatos e decidir retirada do bootstrap, registrando novo SHA/reteste se a configuração mudar. Nenhum merge, produção, migração ou build Windows foi autorizado.
