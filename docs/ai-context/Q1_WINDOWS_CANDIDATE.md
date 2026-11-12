# Q1 — candidata para decisão de build Windows

PR Draft [#48](https://github.com/JoaoVittorLi/meu-financeiro/pull/48), empilhado sobre #47/d52df2adcef6d105dc92480714639dece7448985. Já contém #46; não reaplicar. Branch exata: **`qa/mf2-q1-integrated-windows-20261112`**. Versão **0.9.5-beta.8**. Último commit de código: **`9e4b1a8aa03ade64b9e5259d3834417d69bb0936`**. Commits posteriores desta entrega só documentam/publicam evidências; consultar HEAD do PR para checkout e fixar esse SHA na decisão de build.

## Resultado comprovado

- 506/506 testes Node/SQLite, incluindo categorização, contratos IPC, concorrência, rollback, backup/restore e invalidação de sessão após recuperação.
- TypeScript, compilação, F08, ASAR real e criação/verificação de proveniência PASS no código final.
- Electron45.2.3 real no Windows: IPC preload/main/SQLite PASS; aplicação futura, isolamento por conta/natureza, reimportação, precedência manual, pausa/reativação, lote/undo, dupla confirmação, stale e revogação.
- Computer Use: oito áreas; criação e persistência de lançamento/planejamento/limite; classificação individual, regra futura, lote de2, reversão, edição de regra, negar, adiar, revisar, cancelar, chat principal/lateral e expansão corrigida. Recibos e SQLite conferidos. Capturas nativas1366×768 e1920×1080 nos dois temas. [Evidências](evidence/2026-11-12-q1/README.md).
- Backup completo salvo pela interface e arquivo validado; diálogo de restore exercitado e cancelado. Restore completo testado por contrato de produção e SQLite sintético, não homologado por GUI na instalação pessoal.

## Decisão de build — ainda não executada

Após autorização específica do proprietário, usar **a mesma branch em Config e Checkout** do CircleCI e conferir o HEAD publicado do #48. Parâmetros: `run_preflight=false`, `run_windows_qa=false`, `run_windows_build=true`. O workflow `windows_on_demand` roda `preflight_linux` e exige seu sucesso antes de `build_windows`. Defaults permanecem false. Nenhum job pago acionado por esta missão.

Pipeline deve repetir `npm ci` com lockfile, Node22.23.4/npm10.9.9, testes, F08, ASAR, proveniência e smoke Electron antes dos dois instaláveis x64. Acrescentar o smoke de contrato `node scripts/q1-ipc-smoke.cjs` à conferência da candidata quando apropriado. O teste legado `test:electron-smoke` usa sua matriz de viewport; as imagens desta missão foram obtidas por Computer Use nativo e não derivam dela. Não confundir essas evidências.

Conferir manifests e SHA do ASAR, presença de `category-review.cjs`, `category-review-backup.cjs`, `intelligence-review.css` e marcadores do bundle atualizado. Registrar SHA256 de NSIS/portable e artifact de origem. Um job verde não comprova instalação ou escrita pessoal homologada.

## Instalação isolada e reversão

1. Primeiro testar o binário em VM ou conta Windows separada, com perfil novo e dados fictícios. **Portable em outra pasta não comprova isolamento do userData**. Não abrir sobre o perfil U3 atual.
2. O override `MF_DESKTOP_SMOKE_DIR` é exclusivo do Electron de desenvolvimento e é recusado por binários empacotados. Não contornar esse guard. A escrita supervisionada permanece indisponível no perfil pessoal/empacotado desta candidata.
3. Antes de qualquer futura migração pessoal, exigir autorização específica, backup completo fora do diretório de instalação, hash/integridade e ensaio de restore em cópia autorizada. Esta missão não acessou esse banco.
4. Para reverter a avaliação, encerrar a candidata isolada e manter a U3 atual. Não restaurar um SQLite migrado sobre uma versão anterior sem verificar compatibilidade em cópia. Preservar backups e não apagar o original.

Sem EXE/NSIS novo, instalação, build pago, merge, deploy ou migração pessoal nesta missão. Gates pessoais: [plano de liberação](Q1_PERSONAL_WRITE_GATES.md).
