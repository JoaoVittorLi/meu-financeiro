# MF2-00 — B2 / C0 e C2a: checkpoint e tentativa de acionamento de preflight Linux

**Data de inspeção:** 10/11/2026 (America/Sao_Paulo). **Responsável:** auditoria documental com GitHub conectado, sem acesso à sessão gráfica Work/CircleCI autenticado. **PR de trabalho:** [#18](https://github.com/JoaoVittorLi/meu-financeiro/pull/18), branch `docs/mf2-b1-baseline-audit-20261109`, cuja **base permanece a candidata congelada**.
**Parecer do integrador lido:** comentário no [PR #18](https://github.com/JoaoVittorLi/meu-financeiro/pull/18), “APROVADO COM PENDÊNCIAS”, autorizando apenas C0+C2a. **G0 NÃO HOMOLOGADO**.

## 1. Identidade, versões e modificações (consulta GitHub)

- **Branch técnica congelada:** `integration/mf2-baseline-candidate-20261109`.
- **SHA alvo/HEAD remoto conferido:** `7a01f1cc344e88188bc5eeea59bf2324335a051e`. **Sem movimento da branch** desde o checkpoint anterior; esta revisão não adiciona commits nela.
- **SHA efetivamente executado no CircleCI por esta missão:** **NENHUM**, pois o disparo não estava acessível. O SHA citado é alvo auditado, **NÃO** um SHA testado.
- **PRs #2/#3/#4/#5/#15/#16/#17/#18:** HEADs consultados permanecem iguais aos do [relatório B1](../reviews/2026-11-09-MF2-B1-BRANCH-AUDIT.md); #18 HEAD documental antes desta atualização `067a046dca0b2b7cf60257676e6b9bd3facc2b90`. Não foram observados novos commits nesses PRs até esta consulta.
- O commit candidato tem **0 contextos de status CircleCI** no endpoint de commit status e **0 GitHub Actions workflow runs** na consulta. A API de checks mostrou **1 check “Workers Builds: meu-financeiro-push” = SUCCESS**, link [GitHub Workers Build](https://github.com/JoaoVittorLi/meu-financeiro/runs/129442162336), que é **outro provedor/fluxo**, NÃO `preflight_linux` do CircleCI. O PR #18 também recebeu comentário automatizado de Cloudflare Preview para SHA documental `067a046`; isso não valida staging financeiro, Windows, dados reais nem o preflight.
- **Link de pipeline CircleCI B2:** **NÃO EXISTE link de uma execução criada/verificada nesta missão**. Checks antigos #15: [CircleCI preflight #20](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/20) e [Windows #21](https://circleci.com/gh/JoaoVittorLi/meu-financeiro/21), **SHA diferente** `44fb1b0`; não aprovam B2.

## 2. C0 — Work anterior

Foi feita busca do histórico disponível da sessão **“Meu Financeiro - Definitivo”**. Existem relatos prévios de U1–U3, intenção de U4 e novas funções de Inteligência, mas **não foi recuperado checkout local, branch local, `git status`, diff não publicado, arquivo de workspace, commit local nem checkpoint técnico válido**. O código remoto no GitHub não substitui esse checkpoint e não comprova alterações não publicadas.

**Classificação:** `WORK_LOCAL_INDISPONIVEL`. **Nenhuma recuperação de arquivo foi realizada.** Não sobrescrever, reconstruir por relatos ou presumir que houve U4/21 operações prontas. Caso o Work antigo fique acessível, solicitar branch/SHA, `git status --porcelain=v1`, `git log -5 --oneline`, diffs locais, arquivos em posse, testes e estado de U4/IA e salvar mudanças úteis em branch nova antes de integrar. Não usar dados financeiros para isso.

## 3. C2a — CircleCI: resultado e impedimento real

A configuração da **candidata congelada** em `.circleci/config.yml` foi lida e confere estaticamente com o pedido:

- `run_preflight=true` + `run_windows_build=false` seleciona workflow `preflight_on_demand` → job `preflight_linux`, **sem job Windows**.
- Configuração do preflight: `node:22-bookworm`, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, `npm install --no-audit --no-fund --package-lock=false`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`; depois `mobile-push/` com `npm install`, `npm test` e `npx wrangler deploy --dry-run --outdir /tmp/mf-e4-preview` (não publica).
- **Acesso:** ferramenta GitHub conectada permite verificar código e checks, mas não possui operação para disparar CircleCI. Não há conector CircleCI instalado/disponível nesta sessão; acesso por navegador Work não foi concedido nesta conversa. **Nenhum trigger foi enviado**.
- **Branch Config verificada em pipeline:** NÃO VERIFICADA (nenhuma pipeline disparada). **Branch Checkout verificada em pipeline:** NÃO VERIFICADA. Configuração de repositório aponta para a candidata, mas somente a UI do CircleCI/job pode provar que ambos são a mesma branch e que o checkout foi no SHA alvo.
- **Falha de teste / primeiro erro de stack:** **não se aplica**, pois não houve execução. **Impedimento inicial:** ausência de ferramenta/sessão autenticada com permissão de disparar e ler jobs CircleCI. Não chamar isso de falha TypeScript, ASAR, PWA ou Wrangler e não propor correção de testes sem log.

| Etapa | Resultado B2 | Evidência exigida para sair de “não executado” |
| --- | --- | --- |
| Trigger CircleCI, branch config/checkout, SHA | **NÃO EXECUTADO / NÃO VERIFICADO** | Link do pipeline com config/checkout = candidata e SHA exato |
| TypeScript `test:types` | **NÃO EXECUTADO** | Job `preflight_linux`, step/exit code |
| SQLite/Node `test:db` | **NÃO EXECUTADO** | Job, contagem PASS/FAIL |
| Renderer `compile` + provenance `check-bundle` | **NÃO EXECUTADO** | Job, output e hashes |
| ASAR `test:asar` | **NÃO EXECUTADO** | Job, arquivo físico testado e resultado |
| Worker/PWA `npm test` | **NÃO EXECUTADO** | Job, contagem PASS/FAIL |
| Wrangler `deploy --dry-run` | **NÃO EXECUTADO** | Job, confirmação somente dry-run, sem deploy |
| Windows/NSIS/portable/smoke | **PROIBIDO NESTA RODADA, NÃO EXECUTADO** | Missão futura separada |

**Como executar sem mudar o SHA:** pessoa/integrador com acesso CircleCI abre Pipelines → Trigger Pipeline no projeto `JoaoVittorLi/meu-financeiro`, escolhe **`integration/mf2-baseline-candidate-20261109` em Config e Checkout**, quando existirem ambas opções, define os parâmetros **Boolean** `run_preflight=true` e `run_windows_build=false`, dispara e registra URL do pipeline, número do workflow/job, `git rev-parse HEAD`/SHA de checkout e saída das duas etapas Linux. O job não deve disparar Windows. Se checkout divergir, parar; se o preflight falhar, registrar **primeiro erro relevante** e somente propor correção mínima em branch separada, sem desativar teste. **Não marcar sucesso por ter aberto o link.**

## 4. C11 — Reprodutibilidade (análise, nenhuma alteração)

**Fatos verificados no commit candidato:** árvore tem **0 lockfiles** `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` ou `pnpm-lock.yaml`; nenhum `.nvmrc`, `.node-version` ou `.npmrc`. Desktop declara Electron 45.2.3, TS 5.8.3, electron-builder 26.0.0 e @electron/asar 4.3.1. Worker declara `wrangler: ^4.102.0` (range mutável). O Linux `node:22-bookworm` é tag móvel; Windows `.circleci/build-windows.ps1` baixa `https://nodejs.org/dist/latest-v22.x/` e valida o ZIP contra os hashes do **dia**, o que prova integridade do download, **não reprodutibilidade da versão**. `npm install --package-lock=false` admite versões transitivas diferentes em cada runner.

**Solução de menor risco proposta — em PR próprio, após decisão do integrador, NÃO nesta missão:**
1. Registrar a versão exata do Node 22 **patch** efetivamente aprovada (idêntica em Linux/Windows, escolhida de versão suportada e verificada), pin Linux por digest `node:22.x.y-bookworm@sha256:...` (obter digest confiável na implementação) e alterar a URL Windows para `node-v22.x.y-win-x64.zip`, conferindo o SHA256 oficial; registrar também versão npm e imagem Windows usada no job. Evitar inventar digest/patch sem validação.
2. Gerar e revisar `package-lock.json` **em raiz e mobile-push/** com npm da toolchain pinada, sem tocar dados pessoais. Substituir `npm install --package-lock=false` por `npm ci --no-audit --no-fund` nos jobs; garantir que o Electron/ASAR nativo e dependências opcionais funcionem no Linux e no Windows. O `wrangler` deve resolver da instalação lockada.
3. Rodar preflight Linux e Windows de compatibilidade com fixtures; qualquer mudança de CI/lock altera SHA, gera uma nova **candidata de teste**, e todos os testes precisam ser repetidos no novo SHA. **Não fixar dependências removendo casos de teste nem desativar validações**.
4. Não confundir resultado atual de testes (ainda inexistente) com o risco teórico de instalação não determinística. C11 é **risco de estabilidade/repetição**, não falha CI comprovada.

## 5. Próxima ação exata / gates

**Próximo passo imediato:** disparar **apenas** `preflight_on_demand` no CircleCI no SHA `7a01f1cc344e88188bc5eeea59bf2324335a051e`, com Config=Checkout=`integration/mf2-baseline-candidate-20261109`, `run_preflight=true`, `run_windows_build=false`. Anexar URL da execução, SHA de checkout e saída real. Se o painel permitir selecionar apenas branch, conferir o SHA no job; enquanto ela estiver congelada, será o SHA alvo.

**Depois de um preflight verificadamente verde:** avaliar/decidir C11. Se for feita correção de pin/lock, retestar **novo SHA** antes de liberar Windows. Então **pedir autorização específica** para próxima missão de build Windows (parâmetro `run_windows_build=true`), com preflight obrigatório, instalador+portable+hashes, sem release nem instalação na base pessoal. **C2b não está autorizado para execução nesta missão**.

**Status B2:** `C0=WORK_LOCAL_INDISPONIVEL`; `C2a=IMPEDIDO_ACIONAMENTO_SEM_CIRCLECI`; `C11=AVALIADO_SEM_ALTERAR`; `G0=NAO_HOMOLOGADO`. Não houve mudança em main, branch candidata, PRs históricos, app, cloud/finance, flag, CI, secret, release ou build Windows. Apenas este log e célula de evidência do MF2-00 no PR documental #18.
