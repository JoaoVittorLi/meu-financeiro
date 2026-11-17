# MEU FINANCEIRO 2.0 — RC-ALL-02.3 / BACKUP E MIGRAÇÃO P1

Data: 2026-11-17. Continuação do PR #96 (`fix/mf2-rc-all-02-2-pluggy-continuity-b05-20261116`) sobre a base do PR #94. Sem novas funcionalidades, sem alteração de dados financeiros pessoais e sem geração de EXE.

## Lacuna tratada

O backup pré-migração anterior usava o nome único `pre-upgrade-<versão>.sqlite`. Quando o usuário continuava usando a mesma versão e o SQLite mudava, a próxima inicialização aceitava o backup antigo como suficiente, sem refletir os registros atualizados.

## Contrato implementado

- O perfil **stable** continua selecionando o diretório reconhecido antes do lock e do SQLite; a RC e o smoke continuam isolados.
- Antes de `new FinanceDB`, `stablePreMigrationBackup` verifica o arquivo original (`PRAGMA integrity_check` e tabela `profiles`) em modo somente leitura e captura **novo snapshot online** com `node:sqlite.backup`, incluindo registros no WAL ainda não checkpointados.
- O snapshot temporário `pre-upgrade-<versão>.sqlite.partial` é verificado, depois é comparado por SHA-256 com **todos** os backups válidos e reconhecidos da mesma versão.
- Se a cópia nova é idêntica, o temporário é excluído e a cópia imutável anterior é reutilizada; uma inicialização sem mudanças não gera uma pilha de cópias.
- Se houver novos registros, um arquivo **diferente** `pre-upgrade-<versão>-<UUID>.sqlite` é criado. O backup original de nome simples e os snapshots UUID anteriores não são sobrescritos. A regra vale tanto para diferentes versões quanto para várias mudanças na mesma versão.
- Integridade, symlink ou formato inválido de qualquer cópia reconhecida impedem a inicialização, mesmo quando outra cópia tem SHA-256 coincidente. Uma `.partial` de execução anterior exige conferência; não se apaga silenciosamente. Erro na criação/validação bloqueia a migração antes da abertura do banco da aplicação.
- Não são exportadas nem copiadas credenciais `pluggy-credentials.enc`; o cofre permanece no perfil estável original.
- Observação: a comparação por SHA-256 identifica equivalência **binária** entre capturas SQLite verificadas. Mudanças de metadados SQLite podem resultar em snapshots adicionais; essa decisão é segura e conservadora. Espaço em disco deve ser conferido antes da atualização do perfil real.

## Regressões versionadas

`tests/rc-all-02-3-backup.test.cjs` — **cinco casos Node com SQLite real, 100% sintéticos**, incluidos em `npm run test:db` por `tests/*.test.cjs`:
1. Inicialização repetida, mesma versão e sem alteração: reutiliza o backup íntegro.
2. **600 transações sintéticas**, orçamento de zero, plano e marcador no **WAL aberto**: mudança na mesma versão gera nova cópia, mantém a antiga imutável, inclui a linha ainda no WAL, evita duplicata em execução idêntica e mantém cofre fictício intacto.
3. Snapshot anterior corrompido: falha fechada, fonte íntegra.
4. Snapshot UUID anterior como symlink: falha fechada mesmo havendo backup primário legítimo.
5. `.partial` da inicialização anterior: falha fechada, preservando o estado.

`tests/rc-all-02-2-continuity.test.cjs` (12 testes anteriores) também segue no glob oficial, incluindo a fixture integrada `FinanceDB`/Pluggy de 600 lançamentos.

## Gates pendentes de QA oficial

No checkout da branch do PR #96, **Node 22.23.4** e npm **10.9.9**, somente com fixtures sintéticas e sem servidor pessoal:

```bash
git status --short
git switch fix/mf2-rc-all-02-2-pluggy-continuity-b05-20261116
git pull --ff-only
git rev-parse HEAD
npm ci --no-audit --no-fund
node --test tests/rc-all-02-3-backup.test.cjs
npm run test:types
npm run test:db
node scripts/build-preload.cjs check
npm run test:asar
npm run provenance:create
npm run provenance:verify
```

Apenas após QA Node: revisão visual B05 e inspeção no Electron Windows/ASAR da identidade `stable` e da continuidade com banco + cofre fictícios, além do log da falha antiga do build Windows. Não gerar pacote pessoal, não executar CircleCI pago e não permitir operações supervisionadas de escrita.

## Estado do PR / ownership

- PR #96 permanece **Draft**, integrador #94 preservado, `main` não modificado.
- Esta missão altera exclusivamente a rotina de backup, sua suíte de regressão e documentação.
- Até que os gates sejam **de fato executados no HEAD final**, marcar `QA_OFFICIAL_NOT_RUN / EXE_NO_GO`. Testes versionados não significam testes executados.
