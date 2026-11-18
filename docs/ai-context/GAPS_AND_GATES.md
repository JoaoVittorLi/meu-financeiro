# Registro de lacunas, bloqueios e gates

**Atualizado em 18/11/2026 (Consolidação Marco 1 — PR #105 & Diretriz Permanente NSIS).** Cada item associa problema, marco, evidência exigida e status real (`PASS`, `FAIL`, `PENDENTE`, `NAO_HOMOLOGADO`).

## Estado dos Gates — Marco 1 (PR #105) e Diretriz Permanente

| Gate / ID | Descrição | Estado Atual | Evidência / Condição de Fechamento |
| --- | --- | --- | --- |
| **G0** | Freeze de inventário, SHA único PR #105, limpeza NSIS-only (sem Portable) e higiene sem caminhos locais | `PASS (M1-BASELINE / M1.1)` | Branch `feat/mf1-cat-p0-consolidation-20261117`; `M1-BASELINE` (`fe2b3186`, `0.9.5-beta.8`) preservado intacto e `M1.1` (`f60f319f`, `0.9.5-beta.9`) validado em NSIS-only com `provenance:verify` e `verify-asar` PASS. |
| **G1 / Nível A** | Toolchain `Node 22.23.4` / `npm 10.9.9`, `test:types`, `compile`, `build-preload`, `check-bundle`, `test:asar`, `test:db`, `mobile-push` | `PASS (f60f319f)` | **`1002/1002`** `test:db`, **`133/133`** `mobile-push`, **`1/1`** `test:asar`, `test:types`, `compile`, `build-preload check`, `check-bundle` (`31` entradas) PASS após patch `M1.1` na Visão Geral. |
| **G2** | Integridade SQLite WAL, centavos inteiros, backups com `integrity_check`, limpeza `-wal`/`-shm`/`.d05-before-v7.sqlite`, isolamento Win32 SFN/`realpath` | `PASS` | Verificado em `test:db` (`1002/1002`), Nível B (`14/14`) e Nível C `M1.1` (`PRAGMA integrity_check = ok`, `min=2450`/`max=850000`, `HOST_FOLDERS_UNTOUCHED: true`). |
| **G3 / G4 / Nível B** | Electron real (`MF_QA_SYNTHETIC=1`): `test:electron-smoke` (`32/32` PNGs) + `nivel-b-interactive-qa.cjs` (`14/14` jornadas `PJ-01..09`, `NJ-01..05`) + comparação visual `M1.1` antes/depois | `PASS (f60f319f)` | **`32/32` PNGs** (`verify-visual-matrix` PASS), **`14/14`** jornadas interativas PASS (`FAIL: 0`, `RuntimeIssues: 0`) e comparativo Visão Geral antes/depois em `1920x1080`, `1366x768` e `1024x720` (claro/escuro). |
| **G5 / Nível C** | **Aplicativo NSIS Windows x64 realmente instalado** (`M1-BASELINE` aprovado + `M1.1` `0.9.5-beta.9`), isolamento Windows 11 Home, jornadas interativas pós-instalação, persistência e Google Drive privado | `PASS (M1.1 + M1-BASELINE)` | `M1-BASELINE` (`0.9.5-beta.8`, `e96e0604...6110`) preservado intacto; `M1.1` (`0.9.5-beta.9`, `SHA f60f319f`, SHA-256 `934690ca...3a47`, `115.740.284` bytes) instalado em `C:\Dev\mf-nsis-test-install`, `scripts/nivel-c-nsis-qa.cjs` **`14/14` PASS (`FAIL: 0`, `RuntimeIssues: 0`)**, D05 `14/61/67` em `app.asar`, `HOST_FOLDERS_UNTOUCHED: true`, upload privado verificado (`DRIVE_HASH_MATCH: True`). |
| **G6** | Calibração `CAT-P0` / `cat01` (`UNVERIFIED_RECEIVER`) + `cat02-classifier.cjs` (`5 correções / 3 datas`, não-Premium, `NEW-01..23`, invariantes Wave 8–14 / Iteração 15 e preservação `LEG-01..15` + `DONA CORA`/`5ML` + `w12/w13/w14-leg`), `approvedForPersonal() === false` | `PASS (APPROVE)` | `G6-01`..`G6-18` em `test:db` (`1000/1000`) + parecer `VEREDITO: APPROVE` (`c4d9fbd9`) sobre `d220426` (`88/88` focal, `0` falhas Wave 14 / 76 PSPs, `40/40+4` legítimos BR, `approvedForPersonal: () => false`). |
| **C11** | Lockfiles e reprodutibilidade de build (`package-lock.json` + `mobile-push/package-lock.json`) | `FECHADO` | Lockfiles versionados e toolchain `22.23.4` / `10.9.9` verificada localmente e usada no build NSIS. |
| **Marco 2 (`I3-00` / `F1–F5`)** | Copiloto Financeiro (Detetive, Economia, Recorrências, Simulador, Conversa Contextual, Design Adaptativo, Linguagem Permanente) + NSIS cumulativo | `AGUARDANDO_DECISAO_POS_M1` | **Não iniciar automaticamente pós-M1**; aguarda aceite final do M1 e decisão explícita do proprietário. |
| **C03 / C04 / C05** | Paridade desktop ↔ PWA (`U4`), cutover Cloudflare, Pix/reconciliação avançada | `FORA_DO_M1 (M4)` | Bloqueado até autorização posterior; `FINANCE_SYNC_ENABLED` permanece desativado. |
| **Escrita Pessoal IA** | `D05PersonalWriteGateway.approvedForPersonal()` e escrita assistida multiárea | `BLOQUEADO (M5)` | Proibido liberar genericamente sem gate específico e autorização do proprietário. |

---

## Quadro Histórico Inicial (09/11/2026)

**Status inicial apurado em 09/11/2026; mantido abaixo como referência histórica.** Cada item associa problema, entrega e evidência de saída.

| ID | Lacuna | Marco | Evidência para encerrar |
| --- | --- | --- | --- |
| C01 | main 0.9.4 e desenvolvimento distribuído em 16 PRs draft | MF2-00 | Plano de integração + baseline identificado, sem perda |
| C02 | EXE U3 não testado no Windows | MF2-00 | CircleCI SHA exato, 2 EXEs+SHA256, smoke instalado |
| C03 | U1–U3 desktop ≠ PWA | MF2-03 | E2E de paridade das jornadas e dados |
| C04 | SQLite e Cloudflare sem cutover homologado | MF2-01 | Comparadores completos, restore, permissão de cutover |
| C05 | Regras financeiras só parcialmente compartilhadas | MF2-02 | Golden tests Windows/PWA e fontes únicas |
| C06 | IA demo, sem operações financeiras reais autorizadas | MF2-09 | Ferramentas auditadas e fluxo de confirmação |
| C07 | Limites orçamentários atuais não são envelope/rollover | MF2-07 | Persistência e testes de alocação/rollover |
| C08 | Projeções sem modelo completo de saldo seguro | MF2-06 | Previsão determinística com cobertura visível |
| C09 | PRs encadeados, conflitos possíveis com Work paralelo | MF2-00 | Inventário e decisão por PR, single-writer |
| C10 | Release Windows/PWA coordenada não homologada | MF2-10 | Mesmo contrato/SHA, teste de atualização/rollback |
| C11 | CI depende de instalações sem lockfile no runner | MF2-00 | Estratégia de dependências/reprodutibilidade revisada |
| C12 | Design premium ainda não unificado com personalização | MF2-04 | Layouts responsivos e configurações persistidas |
| C13 | Diferenciais: classificação, recorrências, anomalias | MF2-05 | Regras e provas de não sobrescrita |
| C14 | Metas/dívidas e carteira patrimonial completas | MF2-07/08 | Modelos, testes e relatórios conciliados |
| C15 | Work ativo pode conter código não publicado | MF2-00 | Checkpoint de branch/sha/uncommitted e ownership |

## Significado de gate

- **G0** baseline, preflight+Windows build e smoke, gestão de PRs.
- **G1** conciliação cloud, controle de conflito, backup/restore e autorização.
- **G2** motor financeiro compartilhado e golden tests.
- **G3** paridade funcional/visual Windows-PWA (U4).
- **G4** dashboard modular premium, sem cálculo fictício.
- **G5** classificação/regras/recorrências íntegras.
- **G6** previsão/caixa/saldo seguro e laboratório testados.
- **G7** orçamentos, metas e dívidas rastreáveis.
- **G8** patrimônio, investimentos básicos e relatórios.
- **G9** IA operacional com consentimento e auditoria.
- **G10** release final seguro e coordenado.

**Estado de todos os gates:** não homologados neste processo de documentação. A existência de implementação parcial não destrava gates financeiros.

## Evidência mínima para aprovar item

Identidade da revisão; comando e ambiente; resultado e link; teste integrado quando relevante; screenshot real ou limitação explicada; implicação para dados; eventual rollback; aprovação do integrador. Se algum requisito crítico não for observável, registrar **NÃO HOMOLOGADO**, nunca assumir sucesso.
