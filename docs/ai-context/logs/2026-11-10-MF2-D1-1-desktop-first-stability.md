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
- Não foi alterado `electron/main.cjs`, `src/app.ts`, `app/**`, `mobile-push/**`, conexão Pluggy, planejamento financeiro, mutações bancárias ou dados reais.
- O cache de integridade considera metadados de arquivo: corrupção externa com todos os metadados preservados exige nova inicialização para garantir rechecagem. Não equivale a garantia criptográfica.
- Backups do perfil real devem ser testados apenas pelo usuário após cópia de segurança prévia, nunca em CI; os testes usam `os.tmpdir()`.

## Próximo gate operacional

1. CircleCI projeto `JoaoVittorLi/meu-financeiro` → Trigger Pipeline. **Config Branch = Checkout Branch = `feat/mf2-desktop-first-20261110`**, `run_preflight=true`, `run_windows_build=false`. Conferir `CIRCLE_SHA1` igual ao **HEAD final** deste PR, job `preflight_linux` e resultados por etapa.
2. Se falhar, corrigir no mesmo PR #22 e refazer preflight novo SHA; não desabilitar teste nem alterar finanças.
3. Se verde, na mesma branch/SHA executar `run_windows_build=true`, `run_preflight=false`; workflow `windows_on_demand` executa Linux e Windows. Baixar instalador, Portable e `SHA256.txt`, confirmar SHA/versão e checksums, sem substituir a beta.6 de recuperação até smoke seguro.
4. Smoke Windows em usuário isolado, com dados fictícios; só então aprovar utilização diária ou novo milestone. **Sem merge, release, Cloudflare Production, cutover, U4 ou escrita financeira pessoal.**

**Conclusão:** defeito real corrigido com testes publicados; execução Node isolada 4/4 PASS e validação integral oficial PENDENTE. D1.1 não homologada, versão beta.6 de recuperação preservada.
