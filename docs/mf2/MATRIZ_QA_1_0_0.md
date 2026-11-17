# Matriz QA — gates da candidata 1.0.0

**QA target:** PR #96 HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`; **nenhum gate oficial foi executado neste HEAD nesta missão documental**. Evidência anterior do PR #94 `674108e...` é histórica. [Issue QA #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65).

| Gate / alvo | Comando ou procedimento | Evidência no SHA #96 | Aceite obrigatório |
|---|---|---|---|
| Source freeze | `git rev-parse HEAD`, diff branches #76/#94/#96; sem dirty renderer | NOT_RUN | SHA único registrado, sem novo commit funcional |
| Node/npm | `node --version`, `npm --version`, `npm ci --no-audit --no-fund` | NOT_RUN | 22.23.4 / 10.9.9, install exit 0 |
| TypeScript | `npm run test:types` | NOT_RUN | 0 erros/aviso não mascarado |
| Node/SQLite total | `npm run test:db` | NOT_RUN | Todos testes existentes e novos PASS; contagem real e 0 skip indevido |
| RC2.2 perfil/Pluggy | `node --test tests/rc-all-02-2-continuity.test.cjs` | NOT_RUN | 12 casos: 3 contas/600 sintéticos/cofre/erros/offline/RC |
| RC2.3 backup/migração | `node --test tests/rc-all-02-3-backup.test.cjs` | NOT_RUN | 5 casos: mesma versão, SHA, WAL ativo, imutável, corrupção/link/parcial |
| D05 SQLite v7 | `tests/d05-e1-hierarchy.test.cjs`, `d05-e2-category-service.test.cjs`, `d05-e3-renderer.test.cjs` | NOT_RUN | 14×61/67, FK, splits centavos, rollback, pai/filho, 600+ |
| I2-A/B/C/D/E | `tests/intelligence-i2*.test.cjs`, contratos de grants e quality gate | NOT_RUN | leitura escopada; stale/revoke; sem bypass nem personal writes |
| I3-01 | `node --test tests/i3-01-investigation.test.cjs` | NOT_RUN | períodos comparáveis, centavos, pendências, extrato parcial, follow-ups |
| B01–B05 | `tests/qa84-*.test.cjs`, visual real | NOT_RUN | conformidade com design aprovado sem side effect |
| Bundle/preload | `npm run compile`, `node scripts/build-preload.cjs check` | NOT_RUN | sandbox, 103 métodos públicos, invariantes IPC, sem Node no renderer |
| ASAR e F08 | `npm run test:asar`, `npm run provenance:create && npm run provenance:verify` | NOT_RUN | conteúdo e hashes correspondem ao SHA e source |
| Electron GUI/Windows | `npm run test:electron-smoke` sob perfil descartável | NOT_RUN | 32 PNG; 1366/1920; dark/light; 100/125/150%; navegação/foco |
| B05 composer e redução de movimento | Inspeção humana de Hoje/Conversar/Plano com filtros/grants e viewport baixo | NOT_RUN | uma borda, sem overlap, reduced-motion e fallback correto |
| Stable release channel ASAR | Inspecionar `app.asar/package.json` e `app.getName()` de binário autorizado | NOT_RUN | `mfDistributionChannel=stable`, appId/name estáveis; RC continua isolada |
| Pluggy offline e rollback Windows | Abrir perfil sintético, cofre fictício e SQLite/WAL, simular falha safeStorage, restaurar cópia | NOT_RUN | valores/IDs íntegros, sem segredo exposto ou alteração em perfil real |
| Worker/PWA | `cd mobile-push && npm ci && npm test && npx --no-install wrangler deploy --dry-run` | NOT_RUN | não publicar produção, dados pessoais fora do ambiente |
| Build Windows anterior #94 | GitHub status `ci/circleci: build_windows` | **ERROR no SHA #94**, não #96 | Obter log bruto do job; erro de infra/produto classificado |
| Publicação/tag | Decisão expressa [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | NOT_AUTHORIZED | Todos gates aplicáveis + aceite e rollback |

**Nota:** pacote RC normal é offline, enquanto pacote stable tem permissões diferentes; testar ambos com fixture para não confundir falha de integração com restrição deliberada. Nenhum teste de dados pessoais em CI. SHA muda ⇒ invalidar/reexecutar etapas afetadas, atualizar manifesto e não promover PASS herdado.

## Evidências anteriores a preservar

- **PASS histórico #94 SHA `674108e...`:** proprietário reportou TypeScript, 901/901 Node/SQLite, ASAR e F08; status CircleCI preflight_linux success.
- **FAIL/ERROR #94:** build_windows error, causa ainda não identificada em log.
- **SHA #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`:** 10/10 validações de fluxo em V8 com stubs; 5/5 prova isolada SQLite Node 22.16 (não suíte oficial); 17 testes RC2.2+RC2.3 versionados e não rodados no Node oficial.
- Qualquer PASS em código de teste sintético não implica UI real, perfil pessoal ou segurança pós-migração.

## Modelo para relatório oficial

```text
PR/branch:
SHA exato:
OS/Node/npm:
Comando:
Exit code:
PASS / FAIL / NOT_RUN:
Logs e jobs:
Arquivos/contagens:
Artefato ASAR/renderer/PNG + SHA256:
Dados: SOMENTE_SINTÉTICOS
Regressões/dependências:
Decisão: NO-GO / READY_FOR_NEXT_GATE / GO (apenas proprietário)
```

Registro canônico de gate na [issue #65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) e GO/NO-GO em [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71).
