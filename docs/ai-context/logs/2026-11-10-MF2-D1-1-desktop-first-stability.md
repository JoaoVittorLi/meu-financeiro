# MF2-00 / D1.1 — Desktop First: integridade de backup SQLite

**Data:** 10/11/2026 · **Branch:** `feat/mf2-desktop-first-20261110` · **PR draft:** [#22](https://github.com/JoaoVittorLi/meu-financeiro/pull/22) · **Base de recuperação D0:** `a4d88ced28c59b21520f4d67a51373cd71bdc8a2` · **Estado:** CÓDIGO PUBLICADO / CI OFICIAL PENDENTE · **G0:** NAO_HOMOLOGADO · **Argon necessário? NÃO** (somente `electron/recovery.cjs`, testes e documentação; zero alterações em UI).

## Bloqueio comprovado, não hipótese

No build beta.6, `automaticBackup()` (em `electron/recovery.cjs`) retornava `{created:false}` quando o nome diário já existia, sem conferir se o arquivo era um SQLite restaurável. Ao criar cópia nova, também renomeava o arquivo parcial para `meu-financeiro-YYYY-MM-DD.sqlite` e só depois eliminava backups antigos, sem validar o conteúdo escrito. Isso podia causar um **falso senso de backup** ou deixar um arquivo danificado com nome final.

**Reprodução real em Node v22.16.0**, usando função extraída da revisão D0, pastas temporárias e bytes fictícios: (1) arquivo inválido pré-existente foi aceito com `created:false`; (2) `backupTo` simulado produzindo `NOT A VALID SQLITE FILE` teve o arquivo inválido promovido a backup diário. Ambos os testes de reprodução confirmaram o comportamento original. **Não foram usadas bases pessoais.**

## Mudanças de código publicadas

1. `electron/recovery.cjs`: antes de retornar `created:false` para a cópia do dia, executar `validateBackupFile` (magic SQLite, `PRAGMA quick_check`, tabelas obrigatórias e `app_meta.schema_version`); se houver erro, falhar sem substituir o arquivo suspeito. Após `db.backupTo(partial.sqlite)`, validar o staging **antes** de `renameSync` e da retenção de sete dias; falha remove só o parcial e preserva cópias anteriores. Cache interno baseado em `size`, `mtimeMs` e `ino` evita reexecutar `PRAGMA quick_check` a cada hora se o backup do dia não mudou; qualquer alteração desses metadados força nova validação.
2. `tests/recovery.test.cjs`: **3 casos aditivos** com SQLite sintético/temporário: arquivo diário inválido existente preservado; saída parcial inválida não publicada, mantendo a cópia anterior; arquivo previamente validado adulterado deve falhar na revalidação.
3. `tests/desktop-d1-daily-smoke.test.cjs`: teste **novo** em SQLite temporário de perfis `real`/`demo` isolados, lançamento manual, conta/transação bancária inventada, categoria editada, orçamento zero vs definido, compromisso de Planejamento, fechamento/reabertura, backup/restore e `PRAGMA integrity_check`. Sem Electron UI, sem Pluggy, Cloudflare ou dados pessoais. **A execução integral desse novo teste depende do checkout oficial.**
4. Roadmap deste mesmo PR atualizado, sem promover G0 nem publicar release.

## Matriz de evidências, sem inferências

| Ação | Resultado | Ambiente e limite |
| --- | --- | --- |
| Confirmar base D0 + CI Linux/Windows + hashes já verificados | PASS por status GitHub e registros do PR #19 | Mesmo SHA `a4d88ced`, não é CI da D1.1 |
| Reproduzir dois defeitos do backup antigo | **PASS 2/2** | Node real v22.16.0; função `automaticBackup` extraída do repositório; arquivos sintéticos |
| Exercitar backup válido, arquivo inválido existente, parcial inválido e alteração pós-cache | **PASS 4/4** | Node real v22.16.0 + `node:sqlite` real, **rotinas de validação/backup espelhadas**, base sintética em `tmpdir`; não representa execução da suíte da branch completa |
| `node --test tests/recovery.test.cjs tests/desktop-d1-daily-smoke.test.cjs` | **NÃO EXECUTADO** | Sem checkout privado e dependências completas no runtime local |
| `npm run test:db` (inclui Planejamento, Orçamentos, U1–U3, contas e novos casos) | **NÃO EXECUTADO** | Executar no CircleCI Linux em Node 22.23.4 |
| `npm run test:types`, `npm run compile`, `npm run test:asar` | **NÃO EXECUTADOS** | Preflight pendente |
| Worker/PWA `npm test`, Wrangler dry-run | **NÃO EXECUTADOS** | Preflight previsto, sem alterar Worker |
| Smoke Electron NSIS/Portable com usuário Windows isolado | **NÃO EXECUTADO** | Gate após novo build x64 |
| Novo EXE e SHA256 D1.1 | **NÃO GERADOS** | Não publicar até passar Linux/Windows no mesmo SHA |

**Limitação funcional conhecida:** uma cópia diária já corrompida agora gera erro e é preservada para investigação; a rotina não tenta apagar ou substituir o arquivo automaticamente, evitando perda de possível evidência. A interface existente ainda não exibe um alerta específico desse erro: o processo principal registra a falha sem incluir conteúdos financeiros. UX e alertas são trabalho separado para aprovação do Arquiteto/ownership Argon.

## Fluxos e riscos residuais

- A suíte existente `tests/planning.test.cjs` cobre criação, vencimentos, estado, vínculos, recorrência, persistência; `tests/budgets-v094.test.cjs` cobre limites zero/ausente, categorias e transações; `tests/operations-u2.test.cjs` e `tests/decisions-u3.test.cjs` cobrem contratos de UI. **Essas suítes não foram reexecutadas aqui; preflight oficial exigido**.
- Não foi alterado `electron/main.cjs`, código U4/Argon, componentes visuais, `mobile-push/**`, conexão Pluggy, planejamento financeiro, mutações bancárias ou dados reais. **Exceção pontual do hotfix:** apenas 3 rótulos de versão em `src/app.ts` e as 3 strings equivalentes do renderer compilado `app/app.js` foram trocadas para beta.7, sem mudança de layout, estado ou fluxo.
- O cache de integridade considera metadados de arquivo: corrupção externa com todos os metadados preservados exige nova inicialização para garantir rechecagem. Não equivale a garantia criptográfica.
- Backups do perfil real devem ser testados apenas pelo usuário após cópia de segurança prévia, nunca em CI; os testes usam `os.tmpdir()`.

**Versionamento para entrega segura:** Desktop Windows e Worker/PWA metadados `0.9.5-beta.7` (somente `version` nos dois `package.json` e respectivos lockfiles; nenhum componente PWA alterado), para que os novos artefatos Windows não reutilizem os nomes da beta.6 de recuperação. O build beta.7 NÃO EXISTE ainda e os lockfiles requerem `npm ci` oficial no novo SHA. `tests/e1-build-contract.test.cjs` já exige que as duas versões sejam idênticas. Sem deploy PWA.

## Preflight com falha e hotfix direcionado — 10/11/2026

**CI anterior FAILURE:** [job `preflight_linux`](https://app.circleci.com/workflow/deedfb3d-ad88-49a8-a077-84cb28727e21/job/51ed38aa-fb31-4da0-b15b-0e24f539416d) no SHA `14cb66fffaea1b6c1a5a3b1bd7b520051ea0959c`. O proprietário trouxe o resumo dos **4 testes quebrados**:

- 3 verificações de rótulo de versão comparavam `v0.9.5-beta.7` com `v0.9.5-beta.6`. O teste roda **antes de `npm run compile`** na configuração CircleCI, então apenas compilar ao final não corrigia o teste no checkout. Código fonte `src/app.ts` e JS compilado versionado `app/app.js` tinham três rótulos antigos em cada. Foram alinhados com a versão já definida nos dois manifestos, alterando **somente estas strings**, sem mudar U4 ou visual.
- 1 falha `tests/recovery.test.cjs` linha 99: `fs.readdirSync(...).some(name=>name.includes('.partial-'))` retornou `true`, apesar de `automaticBackup` já rejeitar corretamente um arquivo parcial inválido. **Causa concreta:** ao abrir staging SQLite com `PRAGMA quick_check` em modo WAL, Node `DatabaseSync` cria arquivos auxiliares temporários `-wal` e `-shm`; o `finally` original removia somente `.partial-UUID.sqlite`, deixando os auxiliares. Correção mínima em `electron/recovery.cjs`: limpar os 3 caminhos com `fs.rmSync(...,{force:true})` no `finally`. A política de validação/restauração e backups anteriores permanece intacta. Adicionada uma 4ª regressão específica para backup WAL íntegro sem arquivo auxiliar parcial residual.

**Reprodução Node real v22.16.0, `node:sqlite` e fixtures sintéticas em `tmpdir`:** rotina original em modo WAL falhou **3 PASS / 1 FAIL** com exatamente `true !== false`; após o patch, **5/5 PASS**, incluindo a regressão extra para sidecars. Arquivo de evidência `/mnt/data/mf2-d1-repro/after-wal-hotfix-5-tests.tap` no ambiente desta sessão. Essas são **rotinas espelhadas**, não `npm run test:db` do repo. Verificação do GitHub: rótulos beta.7 em `src/app.ts` 3/3 e `app/app.js` 3/3, sem beta.6 remanescente; `package.json` e `mobile-push/package.json` beta.7. Os testes oficiais da branch após hotfix **ainda não foram executados**; não afirmar CI verde até novo workflow.

### Uma única pipeline para beta.7 (regra permanente)

Quando esta versão candidata estiver pronta, no CircleCI → Trigger Pipeline, selecionar **Config Branch = Checkout Branch = `feat/mf2-desktop-first-20261110`**, `run_preflight=false`, `run_windows_build=true`. O workflow `windows_on_demand` executa **`preflight_linux` → `build_windows`** automaticamente. Não disparar preflight separado antes do Windows e não remover testes, ASAR/proveniência, Worker/PWA/Wrangler dry-run nem manifestos SHA256. Conferir `CIRCLE_SHA1` no SHA **final desta branch** e registrar resultados/artefatos.

Caso CI falhe, corrigir problema comprovado no PR #22 e gerar nova candidata — **sem instalar beta.7 falha**. Se CI verde, baixar e conferir instalador, portátil e `SHA256.txt` e realizar smoke Windows em usuário isolado; beta.6 de recuperação preservada. Sem merge, release nem deploy Production.

**Conclusão:** defeitos do preflight com causas reproduzidas e hotfixes publicados; execução Node WAL isolada 5/5 PASS após correção; novo CI oficial Linux+Windows PENDENTE. D1.1 não homologada, beta.6 de recuperação preservada. D1.1 não homologada, versão beta.6 de recuperação preservada.
