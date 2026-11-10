# MF2-00 / B2 — Resultado posterior do preflight CircleCI no SHA congelado

**Data da comprovação:** 10/11/2026 · **Marco:** MF2-00 / C2a · **G0:** **NAO_HOMOLOGADO**.
**Escopo:** leitura da evidência oficial de commit status no GitHub após execução manual relatada pelo proprietário. Esta documentação não afirma que o agente disparou ou entrou no job.
**Continuação do [log de checkpoint B2](2026-11-10-MF2-B2-checkpoint-e-preflight-linux.md):** naquele momento não havia pipeline; **este registro posterior substitui a conclusão “não executado” para o job Linux**, sem reescrever a cronologia.

## 1. Identidade e evidência CI

- **Branch técnica:** `integration/mf2-baseline-candidate-20261109`.
- **HEAD remoto confirmado após execução:** `7a01f1cc344e88188bc5eeea59bf2324335a051e` (**não houve movimento da candidata**).
- **SHA exato associado ao status CircleCI no GitHub:** `7a01f1cc344e88188bc5eeea59bf2324335a051e`.
- **Contexto oficial de commit:** `ci/circleci: preflight_linux`.
- **Resultado oficial:** `success`, descrição “Your tests passed on CircleCI!”.
- **Horários registrados pelo GitHub:** pending em `2026-11-10T11:54:14Z`, success em `2026-11-10T11:55:21Z` (08:55:21 America/Sao_Paulo).
- **Link oficial de job/workflow:** [preflight_linux — CircleCI](https://app.circleci.com/workflow/4a8c3a15-4101-4333-95c7-8351fd2f37a4/job/32ffc3e0-4838-4994-befe-a50069d2d993).
- **Ação de disparo:** realizada fora das ferramentas desta sessão, comunicada pelo usuário; os valores escolhidos na UI de trigger não foram capturados pelo agente. O GitHub vincula inequivocamente o job ao commit congelado, mas **não permite validar separadamente qual branch foi escolhida em cada seletor Config/Checkout**. Para prova mais estrita, consultar job/metadata autenticado.
- O check `Workers Builds: meu-financeiro-push` é independente e **não** foi usado para aprovar C2a.
- **Nenhum job `build_windows` novo foi encontrado nos status do SHA**; não houve acionamento Windows por esta conversa.

## 2. Matriz de verificações com fronteiras de evidência

A configuração de `.circleci/config.yml` **no SHA candidato** exige os comandos abaixo sequencialmente no job `preflight_linux`; a conclusão verde é **evidência CI agregada de aprovação do job**, mas não foi possível acessar stdout individual do CircleCI via esta integração.

| Item | Evidência real nesta missão | Classificação |
| --- | --- | --- |
| Job CircleCI `preflight_linux` | Status oficial `success` em SHA exato, link acima | **APROVADO — JOB** |
| `npm run test:types` | Declarado no primeiro step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; log individual não auditado** |
| `npm run test:db` — SQLite/Node | Declarado no primeiro step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; contagem individual não verificada** |
| `npm run compile` — renderer | Declarado no primeiro step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; log individual não auditado** |
| `scripts/renderer-provenance.cjs check-bundle` | Declarado no primeiro step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; hashes individuais não auditados** |
| `npm run test:asar` | Declarado no primeiro step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; detalhe de ASAR não auditado** |
| `mobile-push/npm test` | Declarado no segundo step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; contagem individual não verificada** |
| Wrangler `deploy --dry-run --outdir /tmp/mf-e4-preview` | Declarado no segundo step do job concluído com sucesso | **ABRANGIDO PELO JOB VERDE; saída não auditada; não há evidência de deploy Production** |
| CircleCI Config vs Checkout selecionados | SHA final vinculado ao job, porém parâmetros/seletores não inspecionados no CircleCI | **NÃO VERIFICADO INDEPENDENTEMENTE** |
| Windows NSIS/portable/checksums/instalação/smoke | Fora do escopo desta rodada | **NÃO EXECUTADO / G0 ainda pendente** |

**Nota sobre inferência:** o fluxo do job não usa `continue-on-error` nos steps listados e os comandos estão encadeados; sucesso do job é indício forte de que terminaram com exit code zero. **Não alegar visualização das saídas, contagens de testes ou sucesso dos cenários reais** sem logs do CircleCI.

## 3. Limitações persistentes

- **Checkpoint Work anterior:** indisponível; não foi recuperado checkout local nem código não commitado da sessão “Meu Financeiro - Definitivo”. U4/21 ferramentas de IA não foram presumidas.
- **Reprodutibilidade C11:** tag Linux `node:22-bookworm` móvel, Windows `latest-v22.x`, nenhum `package-lock.json` (raiz ou `mobile-push/`), `npm install --package-lock=false`, `wrangler:^4.102.0`. Job verde hoje **não garante** binários/árvore iguais amanhã.
- **Nenhuma mudança no app, tests, CI, flags, dados pessoais, Cloudflare, main, branch candidata ou PRs históricos**. Atualização documental feita no PR #18.

## 4. Ordem de decisão e próxima etapa

**C2a concluído em nível de resultado oficial de CI:** `preflight_linux=SUCCESS` no SHA candidato. **Próxima ação técnica antes de Windows:** revisar e decidir formalmente C11 com o integrador; **recomendação**: preparar PR separado de pin de Node patch/digest + lockfiles raiz/PWA com `npm ci` e reexecutar o mesmo preflight no **novo SHA candidato**. Essa é uma proposta, não alteração autorizada nesta missão. Caso o integrador aceite o risco e opte por build diagnóstico ainda no SHA atual, documentar aceite explícito; isso **não substitui** a solução C11 exigida antes de G0.

**Após decisão C11 e preflight correspondente aprovado:** solicitar autorização **específica de nova missão C2b** para `run_windows_build=true`, sem produção/release, com NSIS+portable, hashes de EXEs/ASAR e posterior smoke Windows isolado. Não executar build Windows nesta rodada. Só integrador pode promover G0.
