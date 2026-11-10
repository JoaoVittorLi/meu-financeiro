# MF2-00 / Rodada B1 — auditoria de preservação de branches divergentes e preparação de G0

**Data:** 09/11/2026 · **Resultado:** CANDIDATA FUNCIONALMENTE PROMISSORA, **NÃO HOMOLOGADA** · **Escopo:** inspeção remota GitHub e plano de testes, sem alterações no app ou execução de pipeline.
**Candidata-alvo CONGELADA para esta revisão:** `integration/mf2-baseline-candidate-20261109` — SHA `7a01f1cc344e88188bc5eeea59bf2324335a051e`.
**Branch/PR de documentação desta auditoria:** `docs/mf2-b1-baseline-audit-20261109` → PR draft com base na candidata (não modifica seu código ou seu SHA).
**Referências:** [Plano de consolidação](../BRANCH_CONSOLIDATION_PLAN.md), [Benchmark](../MARKET_FEATURES_DEEP_DIVE.md), [Roadmap](../../ROADMAP_MF2.md), [Frentes ativas](../ACTIVE_WORK.md), [Testes/releases](../TESTING_AND_RELEASE.md).

> **Condição essencial:** código no GitHub e equivalência estática **não provam funcionamento**. Nenhum teste npm, CircleCI, Windows, Electron, PWA autenticado, deploy, banco pessoal, release ou custo de API foi executado nesta auditoria. Nenhum ramo foi mesclado ou descartado.

## 1. Inventário e integridade da candidata

| Item | Evidência e julgamento |
| --- | --- |
| `main` | `e0d5131ebeda855a792614d9986f40e5bb94af5e`, v0.9.4, ancestral da candidata |
| PR #16 | `design/despezzas-d1-d4`, `c535cb01403689480d01560de3daa1cae71780d2`, U1–U3 renderer desktop (testes relatados, sem instalação homologada) |
| PR #17 | `docs/mf2-multi-agent-context-20261109`, `b3a53eaef9544cf8a86dee01d3565d8414c476d3`, ancestral da candidata |
| Candidata | `7a01f1cc344e88188bc5eeea59bf2324335a051e`; compare #16→candidata = `ahead 13, behind 0`, **29 arquivos mudados, todos de documentação/governança** (`docs/**`, `AGENTS.md`, template PR). **Nenhum arquivo de runtime, testes ou CI mudou** nessa derivação. Logo, o código executável é o mesmo do #16, ainda sem nova execução. |
| Antigos #1/#6–#16 | ancestrais da linhagem, não reintroduzir commits por cherry-pick ou merge indiscriminado |
| PRs #2/#3/#4/#5 | **divergentes no histórico**, não necessariamente ausentes em comportamento. Comparados via API GitHub compare e árvores SHA por arquivo |
| CI candidato | endpoint de status de `7a01f1c` retornou **0 checks**, não “pipeline falhou”. #15 `44fb1b0` teve `preflight_linux` e `build_windows` verdes (jobs 20/21); #5 `3eaca80` teve `build_windows` verde (job 4). Nenhum desses aprova a candidata |
| Work anterior | **ambiente, git status e alterações locais NÃO ACESSÍVEIS**. Relatos sobre U4 ou operadores de IA com múltiplas ações **não são prova de código enviado ao GitHub**. É bloqueio C0 até checkpoint |

**Comparação de árvores (blob SHA, igualdade exata):**
- #2: 68 arquivos históricos, **42 idênticos**, **25 modificados**, **1 ausente** na candidata (`docs/INTELLIGENCE_UI_DELIVERY_1.md`).
- #3: 179 arquivos, **149 idênticos**, **26 modificados**, **4 ausentes** (`.devcontainer/devcontainer.json`, `docs/BUILD_SEM_INSTALAR_NADA.md`, `scripts/codespaces-build-publish.sh`, `scripts/preview-intelligence-windows-local.ps1`).
- #4: 67 arquivos, **42 idênticos**, **25 modificados**, **0 ausentes**.
- #5: 182 arquivos, **150 idênticos**, **28 modificados**, **4 ausentes** (os mesmos de #3).
- A contagem de “modificado” inclui evolução posterior normal do app; **não é uma lista de perdas**, e arquivos duplicados entre PRs não são somados.

## 2. C1 — matriz de equivalência funcional com evidência por arquivo

**Classificação:** INCORPORADA = arquivo/contrato preservado; SUBSTITUÍDA = comportamento revisado em implementação posterior; PENDENTE = capacidade não transportada ou não testada; CONFLITANTE = importar versão antiga pode regredir; DESNECESSÁRIA = histórico/ferramenta sem valor obrigatório para G0. “Pendente” não é “bug reproduzido”.

| Origem | Componente / arquivo antigo → candidata | Evidência comportamental e classificação | Próximo passo |
| --- | --- | --- | --- |
| **#2** | `src/intelligence-view.ts`, `src/app.ts`, `app/intelligence.css` | **INCORPORADA/SUBSTITUÍDA:** ambas possuem rota Inteligência, abas **Hoje/Conversar/Plano de ação**, rascunhos, painel contextual e demo explícita; candidata adicionou navegação por teclado/escopo, interfaces e contrato E2–E4.1. Avisos antigos “prévia offline” mudaram porque a conexão experimental passou a existir. O código antigo é **CONFLITANTE** se mesclado integralmente. | Preservar candidata; smoke de navegação, drawer, simular compra e nunca alegar finanças reais |
| **#2** | `tests/ai-ui.test.cjs` | **INCORPORADA/SUBSTITUÍDA:** cinco cenários antigos ainda têm teste equivalente de rota/3 abas, demo sem banco e painel nas seis áreas originais; teste de Configurações agora valida ausência de **segredos no renderer**, em vez de frase histórica “nenhuma credencial solicitada”. | Executar teste no SHA congelado, verificar semântica de OAuth/privacidade |
| **#2** | `docs/INTELLIGENCE_UI_DELIVERY_1.md` | **PENDENTE DOCUMENTAL, sem perda de execução:** único arquivo histórico ausente; descreve protótipo UI offline E1 e checklist manual. [PR #2](https://github.com/JoaoVittorLi/meu-financeiro/pull/2) preserva proveniência. Não importar instruções defasadas sobre conexão desligada. | Arquivar via link/índice se exigido pelo integrador; não condicionar G0 a portar texto obsoleto |
| **#3** | `electron/ai-auth.cjs`, `electron/ai-vault.cjs` | **INCORPORADA COM PROVA DE BLOB IGUAL:** os arquivos são byte-a-byte os mesmos entre #3 e a candidata; fluxo OAuth/PKCE, vault e permissão existentes em código. **Não significa login real aprovado**. | Testes de auth, expiração, falhas, vault e consentimento; não enviar credencial |
| **#3** | `shared/ai-policy.mjs`, `mobile-push/public/finance-ai.js`, `mobile-push/test/ai-policy.test.js` | **SUBSTITUÍDA/AMPLIADA:** política `publicCapabilities` v2→v3 acrescenta limites/memória local; demo PWA ganhou prévia de contexto sintético. `pwaInferenceEnabled=false`, `financialDataEnabled=false`, sem fallback pago. Não ativar IA real por inferência. | Regressões de contrato compartilhado, demo apenas com fixtures e prevenção de segredos no navegador |
| **#3** | `electron/ai-client.cjs`, `tests/ai-signin.test.cjs` | **SUBSTITUÍDA INTENCIONALMENTE; CHECK REGRESSIVO PENDENTE:** E2 antigo obrigava GET `/v1/models` antes do POST; candidata usa POST `/v1/responses` sem GET obrigatório, mantém `modelAvailable()` opcional, adiciona classificação de erros de rede sem retry de POST e testes para falta de confirmação, `ENOTFOUND`/`ECONNRESET` e contexto. Reintroduzir o fluxo antigo poderia devolver falha de conexão e duplicar verificação. | Executar testes de sign-in, rede, limite, permissão, modelo realmente disponível no ambiente autorizado; não testar com contas financeiras reais |
| **#3** | `src/intelligence-integration.ts`, `src/intelligence-view.ts`, `electron/main.cjs`, `preload.cjs` | **INCORPORADA/AMPLIADA:** handlers de conectar/desconectar/teste demo permanecem; candidata acrescentou contexto/memória local e interface. **Nunca declarar 21 comandos reais preservados**, pois não há evidência publicada. | Testar fluxo demo e checar eventual Work não publicado antes de implementar qualquer ação |
| **#3 e #5** | `.devcontainer/devcontainer.json`, `scripts/codespaces-build-publish.sh` | **PENDENTE COMO CAPACIDADE DE DISTRIBUIÇÃO, DESNECESSÁRIA AO G0:** branch antiga podia construir via Wine em Codespaces e **publicar automaticamente GitHub prerelease** com `gh release create`. Candidata usa CircleCI com artifacts, **não publica GitHub Releases**. O script antigo está amarrado a `feat/inteligencia-e2-chatgpt-shared` e publica prévia; importá-lo hoje, sem adaptar/gate, seria **CONFLITANTE** com release controlada. | **Decisão posterior ao smoke:** arquivar fluxo legado e, se desejado, projetar publicação GitHub de artefatos já verificados em missão separada; não copiar/rodar script antigo |
| **#3 e #5** | `scripts/preview-intelligence-windows-local.ps1`, `docs/BUILD_SEM_INSTALAR_NADA.md` | **PARCIALMENTE SUBSTITUÍDA/PENDENTE:** antigo script gera instalador+portátil e pode publicá-los após check, mas exige branch #3; documento ensina Codespaces da branch #3. Candidata traz `scripts/preview-windows-local.ps1` (também preso à branch #1) e pipeline CircleCI para ambos EXEs. **A rota de publicação após homologação não está pronta na candidata.** | Não executar nenhum script local amarrado a branch antiga na candidata; usar CircleCI para build controlado e criar fluxo de release futuro com verificação |
| **#4** | `.circleci/config.yml` | **INCORPORADA/AMPLIADA:** antigo só aceitava `run_windows_build=true` e rodava Windows direto; candidata tem `run_preflight` opcional e exige `preflight_linux` aprovado antes do job Windows. Parâmetros default `false`. **CONFLITANTE** substituir arquivo atual pela versão antiga. | Executar preflight separado no mesmo SHA e depois Windows autorizado |
| **#4** | `.circleci/build-windows.ps1`, `docs/CIRCLECI_WINDOWS_MANUAL.md` | **INCORPORADA/AMPLIADA:** manteve Node 22 oficial com hash, dois executáveis NSIS/portable e `SHA256.txt`; acrescentou verificação `renderer-provenance.cjs verify`, `verify-asar`, hashes do manifest/ASAR e recusa caso app.asar não seja encontrado. Documento antigo cita branch/versão beta.1, não é instrução atual. | Usar [TESTING_AND_RELEASE](../TESTING_AND_RELEASE.md) e este relatório, não a branch antiga |
| **#5** | `.circleci/config.yml`, `.circleci/build-windows.ps1` | **SUBSTITUÍDA** por versão reforçada do #15; a configuração #5 coincide com a linha antiga #4. CircleCI **job 4 success** em #5 prova apenas seu SHA antigo. | Não importar CI antigo; exigir preflight+Windows verdes no commit `7a01f1c` |
| **#5** | `electron/ai-auth.cjs`, `ai-vault.cjs`, `tests/ai-signin.test.cjs` | **INCORPORADA/EVOLUÍDA:** auth, vault e teste de sign-in da #5 têm blob igual na candidata; E3/E4 adicionam testes de contexto. Outros arquivos de UI/Worker evoluíram sem evidência estática de perda intencional. | Testar regressões demo e integração PWA/Worker; não assumir OAuth funcional só porque arquivo é idêntico |

### Possíveis conflitos com Work anterior
- Sessão “Meu Financeiro - Definitivo” **não disponível para leitura de git status/arquivos locais**. Informações anteriores descrevem U4 em andamento e intenção de 21 operações de Inteligência; **nenhum SHA publicado ou PR novo foi localizado** nesta reconciliação para certificar esse progresso. Sem inventar recuperação.
- **Bloqueio C0:** o integrador que tiver o workspace antigo deve registrar branch/SHA, `git status --porcelain=v1`, últimos commits, diffs e arquivos locais, testes, U4, IA e ownership; salvar trabalho útil primeiro em branch própria (sem force push) antes de aplicar qualquer mudança sobre a candidata.
- Caso a sessão não exista mais, declarar **não recuperável por esta via**, preservar PRs históricos e prosseguir da candidata **com ressalva explícita**, não dizer que os 21 operadores foram integrados.

## 3. Conclusão de preservação — o que podemos e não podemos garantir

**Prova estática favorável:** código U1–U3/Cloud/IA da linhagem principal íntegro; classes e contratos centrais do protótipo IA #2 e conexão #3 aparecem na candidata; auth/vault byte-a-byte idênticos; scripts CI #4/#5 substituídos por pipeline com mais gates; arquivos faltantes são documentos ou fluxos auxiliares de build/release, **nenhum módulo financeiro ou UI em runtime ausente** foi identificado na comparação de árvores.

**Exceções que impedem declarar “nenhuma perda” sem ressalvas:**
1. **Fluxo opcional de publicar pré-release automaticamente a partir do Codespaces** não foi portado. Isso é capacidade histórica de distribuição, não funcionalidade financeira. Precisamos decidir **substituir por release manual aprovada após G0** ou desenhar automação nova com controle.
2. **Work não publicado não inspecionado**; U4/IA supostamente avançados podem estar apenas localmente.
3. **Sem executar regressões** não se prova equivalência efetiva de UI, OAuth/PKCE, ASAR ou Windows. Não confundir “ausência de novo status” com falha CI.
4. **Pipeline sem lockfile** (`npm install --package-lock=false`) e bootstrap via `latest-v22.x`: builds futuros podem não ser bit-a-bit reproduzíveis. Tratar como risco C11 antes de homologar baseline final.
5. Scripts `scripts/preview-windows-local.ps1` (branch #1) e auxiliares da #3 têm validação de nome de branch e **não devem ser utilizados fora de seu contexto**.

**Parecer:** **UMA CANDIDATA recomendada** `integration/mf2-baseline-candidate-20261109` no SHA `7a01f1c`, mantida intacta até teste. **Nenhum merge técnico necessário foi identificado** para #2–#5. Sua adoção como baseline só após C0–C4 e aceite do integrador, não agora.

## 4. Preparação exata de CI, Windows e homologação — sequência G0

**C0 — Checkpoint de ownership e preservação (bloqueante):**
1. Verificar SHA remoto da candidata ainda `7a01f1c`, PRs e CI; verificar se Work anterior tem checkout/commits pendentes, salvar em branch distinta.
2. Confirmar que ninguém edita `src/app.ts`, `src/intelligence-*`, `electron/ai-*`, `.circleci/*` ou `shared/*` simultaneamente. Não mesclar, não habilitar flags cloud, não alterar main.
3. Registrar uma checklist de lacunas: **Work local**, **distribuição GitHub Releases**, **reprodutibilidade do npm**, **build/ASAR/Windows**.

**C1 — Aprovar matriz e SHA de execução:**
4. Integrador revisa esta tabela e valida as capacidades que aceita arquivar (Codespaces, scripts de preview presos a branches antigas). Se identificar função única, abrir issue/fatia própria e adiar substituição do PR correspondente.

**C2a — Preflight CircleCI (SEM Windows):**
5. Em CircleCI → Pipelines → Trigger Pipeline, selecionar **`integration/mf2-baseline-candidate-20261109` para Config e Checkout**, quando separados.
6. Configurar parâmetros Boolean: `run_preflight=true`, `run_windows_build=false`. O workflow `preflight_on_demand` executará `preflight_linux` (Node 22).
7. Conferir os comandos executados no SHA **`7a01f1cc344e88188bc5eeea59bf2324335a051e`**, não apenas branch: `npm install --no-audit --no-fund --package-lock=false`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`; em `mobile-push/`: `npm test` e `npx wrangler deploy --dry-run --outdir /tmp/mf-e4-preview` (sem publicar).
8. Se houver erro, **parar**: identificar primeiro erro e SHA, não remover testes para “ficar verde”. Se houver correção, novo SHA = nova candidata que deve ser reavaliada/documentada.

**C2b — Windows CircleCI (somente após preflight aprovado e autorização para runner):**
9. Trigger Pipeline na **mesma branch/commit** com `run_windows_build=true`. O workflow dispara novo `preflight_linux` como pré-requisito antes de `build_windows`; não é simplesmente reaproveitar o preflight anterior.
10. Validar Windows Server 2022, Node 22 verificado por SHA256, TypeScript/testes, `dist:windows`, `renderer-provenance verify`, `verify-asar`; conferir no job **2 EXEs x64** `MeuFinanceiro-Instalador-0.9.5-beta.6-x64.exe`, `MeuFinanceiro-Portable-0.9.5-beta.6-x64.exe` + `SHA256.txt` com SHA do commit e hashes do renderer/ASAR/EXEs; guardar URLs dos artifacts.
11. Se o checkout de CircleCI estiver em outro SHA, **não** herdar aprovação. Não criar GitHub Release nem publicar Cloudflare/Production.

**C2c — Smoke Windows REAL, com perfil descartável e dados sintéticos:**
12. Verificar EXE e hash baixados; instalar em Windows isolado, **sem substituir o SQLite pessoal**, sem conexão financeira/AI real. Abrir, reiniciar, salvar e reabrir, testar menu/navegação, telas Visão Geral/Movimentações/Planejamento/Orçamentos/Contas/Simulador/Inteligência/Configurações em temas claro/escuro.
13. Verificar U1: saldos conhecidos/zero/parciais/indisponíveis, período/origem, ranking, privacidade; U2: revisão, filtros, categorias, vínculos, calendário/projeção; U3: limite zero vs ausência, saldo as-of, simulação A/B/parcelas e botão editor sem gravação automática; IA: demo fictícia, sem consultar dados reais.
14. Layout/foco/teclado: largura equivalente 320/390/768/1366/1920px quando aplicável, zoom 150/200%, popovers/calendários, Escape e NVDA se disponível. Capturas reais somente com fixtures.
15. Smoke de restauração em perfil descartável; nenhuma migração/cutover; guardar hash de `app.asar` e verificação de proveniência no log.

**C3 — Parecer do integrador e estratégia de PRs:**
16. Publicar comandos, SHA, URLs de jobs, checksums e evidência visual; atualizar roadmap e log **no mesmo PR** da execução; só integrador pode confirmar CURRENT_STATE. Se todos os gates de G0 estiverem atendidos, pedir autorização para declarar candidata como baseline técnica.
17. **Não fechar** #2/#3/#4/#5 por ora. Se testes/Work confirmarem nenhuma capacidade única essencial, rotular como **potencialmente substituídos** com referência à baseline, encerrar PRs apenas em decisão explícita do integrador (sem apagar branch). Se publicação automática for requisito, manter dívida/issue separada antes de considerar #3/#5 totalmente substituídos.
18. A aprovação de G0 **não** libera cutover cloud ou IA bancária: MF2-01/G1 e MF2-09/G9 continuam com autorização e gates independentes.

## 5. Tabela de encerramento condicional de PRs

| PR | Classificação proposta agora | Condição mínima para “substituído” |
| --- | --- | --- |
| [#2](https://github.com/JoaoVittorLi/meu-financeiro/pull/2) | **POTENCIALMENTE SUBSTITUÍDO** — E1 UI e testes preservados/evoluídos; doc histórica ausente, mas PR prova origem | Smoke UI/teclado/rota e demo, review de alterações Work, guardar link de origem |
| [#3](https://github.com/JoaoVittorLi/meu-financeiro/pull/3) | **POTENCIALMENTE SUBSTITUÍDO COM PENDÊNCIA DE RELEASE** — auth/vault idênticos, E2 e testes evoluídos; scripts Codespaces não portados | Regressões sign-in, prova dos contratos e decisão explícita arquivar/substituir Codespaces/prerelease |
| [#4](https://github.com/JoaoVittorLi/meu-financeiro/pull/4) | **POTENCIALMENTE SUBSTITUÍDO** — CI atual mais forte | Preflight e build Windows aprovados no **SHA candidato**, hashes/ASAR preservados |
| [#5](https://github.com/JoaoVittorLi/meu-financeiro/pull/5) | **POTENCIALMENTE SUBSTITUÍDO COM PENDÊNCIA DE RELEASE** — CI e auth presentes, job histórico verde não valida candidato | Mesmas condições #3 + #4; garantir preservação dos caminhos de instalação desejados |

**Não encerrar outras PRs automaticamente:** #1/#6–#16 são ancestrais e podem ter dependências de revisão; #17 continua documental/draft; preservar proveniência. “Superseded” não significa “merged” nem deve marcar itens concluídos no GitHub sem observação.

## 6. Status editorial final deste checkpoint
**C0:** PENDENTE (Work local inacessível). **C1:** ANÁLISE ESTÁTICA PUBLICADA, AGUARDANDO DECISÃO. **C2a/b/c:** NÃO EXECUTADOS; nenhuma pipeline nesse SHA observada. **C3:** PENDENTE. **C4/G0:** **NAO_HOMOLOGADO**. Esta auditoria não altera fonte, build, runtime, testes, segurança, schema, data-plane, release ou produção.
