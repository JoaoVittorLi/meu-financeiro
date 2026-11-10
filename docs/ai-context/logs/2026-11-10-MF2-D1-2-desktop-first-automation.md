# MF2-00 · D1.2 — Automação Desktop First e preparação Premium

**Data:** 10/11/2026 · **Executor:** branch `feat/mf2-d1-2-functional-tests-20261110`, PR draft [#28](https://github.com/JoaoVittorLi/meu-financeiro/pull/28) · **Base congelada D1.1 beta.7:** `8734a34db8ec9b5592d666cc14fea9a5b8a826b4`.

## Ponto de partida comprovado
D0 beta.6: Linux/Windows PASS, instalador e portátil verificados, sem smoke físico. D1.1 beta.7: Linux e Windows SUCCESS na mesma pipeline ([Linux](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/4c64a3ed-2442-4295-8cd0-a89b01aaae87), [Windows](https://app.circleci.com/workflow/97d647b6-be40-416a-a69c-d6259f22f8c2/job/a9c7f44f-5094-4ef5-9c0e-355ab4948ebe)); **2/2 EXEs SHA256 calculados nos bytes e coincidentes com o manifesto** (comentário PR #22 id 6778657259). Sem homologação de execução Windows nem release. No PR #28 **não alterar** esses SHAs nem subir o versionamento antes da beta.8.

## Problemas reais e correções (código)
1. **Perda do orçamento zero pela exclusão da categoria** em `electron/db.cjs`: `deleteCategory()` fazia `SELECT 1 FROM budgets WHERE category=? AND amount_cents>0`. Como zero representa **limite explícito e não ausência de orçamento**, uma categoria personalizada com `R$ 0` podia ser excluída e a função apagava a linha de orçamento silenciosamente. **Correção mínima:** considerar `SELECT 1 FROM budgets WHERE category=? LIMIT 1`, exigindo remover o limite antes de excluir. Reprodução real SQL com `node:sqlite` e dados fictícios: filtro anterior retorna `undefined`; novo identifica a linha.
2. **Lock duplicado** em `electron/main.cjs`: havia duas chamadas a `app.requestSingleInstanceLock()` e dois listeners `second-instance`. Removido o bloco mais antigo, mantendo um único bloqueio após configuração do perfil e antes de `app.whenReady()`. O estado financeiro não foi alterado.

## Automação instalada para a próxima candidata
- `electron/smoke-profile.cjs`: redireciona `app.getPath('userData')` somente se `MF_DESKTOP_SMOKE_DIR` apontar a pasta existente sob `os.tmpdir()/mf-d1-electron-*`, **app não empacotado e `process.defaultApp===true`**. Usa `realpathSync` para impedir escape por symlinks. Nunca usa perfil pessoal.
- `electron/main.cjs`: no modo smoke, bloqueia acesso HTTP externo nas sessões Electron (incluindo a partição de Cloudflare). Sem modo smoke, preserva comportamento normal.
- `scripts/d1-electron-smoke.cjs`: sem mocks de React ou DB; cria perfil de teste, semeia FinanceDB/PlanningStore reais com IDs/valores inventados, inicia binário Electron do `npm ci`, aguarda `app/index.html` via CDP WebSocket localhost, exige preload + renderer prontos, clica nas abas e confere `aria-current` e breadcrumb, testa `financeDesktop` IPC de movimentações, saldo `null`, categoria, orçamento zero, vínculo e planejamento; fecha Electron, reinicia, compara persistência e valida arquivos SQLite automáticos. Falha não é ignorada e erro gera exit code diferente de zero. **UI:** navegação pelo DOM é real, mas edições usam IPC e não cliques nos formulários. Não confundir com teste completo da UX.
- `tests/d1-2-desktop-integration.test.cjs`: três integrações de FinanceDB+PlanningStore+recovery com perfis temporários: categoria zero, banco/manuais/vínculos após reinício, compromissos/parcelas e restauração com arquivo inválido.
- `tests/d1-2-smoke-profile.test.cjs`: testes de isolamento, fora do pacote e bloqueio de perfil arbitrário; `tests/d1-2-electron-contract.test.cjs`: exige um único lock e exige gate real no Windows CI.
- `package.json`: script `npm run test:electron-smoke`, **versão mantida beta.7**, sem alteração de dependências ou lockfile.
- `.circleci/build-windows.ps1`: para **próxima candidata**, após `npm ci` e `test:types`, compila e executa smoke Electron real como gate antes do `dist:windows`. Os testes gerais Node/SQLite, ASAR, proveniência, hashes NSIS/Portable permanecem intactos.

## Evidências de testes — declarar com precisão
| Ação | Resultado | Ambiente / ressalva |
| --- | --- | --- |
| Testes de isolamento do perfil (mesmo blob exato Git publicado, SHA `884892e8bb73738bf15dbe3c551ce8e5eceeae6c`) | **3/3 PASS** | Node v22.16.0, `node --test`, tmpdir real, fake Electron app |
| Reprodução orçamento zero no SQL antigo versus corrigido | **1/1 PASS** | Node v22.16.0, `node:sqlite` real, tabela e orçamento inventados |
| TAP conjunto dos quatro testes locais | **4/4 PASS** | `/mnt/data/d1-2-local-directed.tap` no runtime; testes isolados, não suíte repo completa |
| Script smoke Electron | **Parser V8 PASS, código no repo** | **Não executado:** Electron real/Windows GUI ausente do ambiente |
| `tests/d1-2-desktop-integration.test.cjs` (3 novos), `d1-2-electron-contract` (3) e teste estático single-instance | **PUBLICADOS, NÃO EXECUTADOS em checkout completo** | Validação obrigatória no próximo CI; não confundir com 4/4 local |
| `npm run test:db`, `test:types`, `compile`, `test:asar`, Worker/PWA no SHA D1.2 | **NÃO EXECUTADOS** | CI da beta.7 aprovada pertence apenas ao SHA anterior |
| Smoke Windows real e instalador beta.8 | **NÃO EXECUTADOS / NÃO GERADOS** | D1.2 em desenvolvimento, sem versão nova |

## Visual Premium / ownership
- A-D1 PR [#23](https://github.com/JoaoVittorLi/meu-financeiro/pull/23): `app/overview.css`, 18/18 testes relatados pelo Argon na base anterior, sem Electron visual.
- A-D2 PR [#25](https://github.com/JoaoVittorLi/meu-financeiro/pull/25): `app/operations.css`, 18/18 testes relatados pelo Argon na base anterior, sem Electron visual.
- PR draft [#27](https://github.com/JoaoVittorLi/meu-financeiro/pull/27) foi criado de forma independente sobre D1 beta.7 com **EXATAMENTE** os dois blobs CSS publicados, sem qualquer JS/TS, contrato financeiro, Worker/PWA ou CI. Sem integração na branch funcional.
- **A-D3** também mexerá em `app/operations.css`: integrar somente patch incremental sobre A-D2, sem sobrescrever o trabalho; aguardar código final e rodar testes U1/U2/U3 + telas reais no smoke, temas e reduced-motion. Nada de EXE dedicado só para CSS.

## Riscos e próximo gate
- Ainda sem evidência real de UI/editabilidade Windows executada, apesar do harness automatizado versionado. O fato de o script existir não prova que Electron real passe; poderá exigir ajuste quando Windows CI executá-lo.
- `--remote-debugging-port` e `--remote-allow-origins=*` são usados apenas no Electron de desenvolvimento com dados fictícios e perfil isolado, nunca em EXE distribuído.
- Não tocar em dados/segredos, Pluggy, Cloudflare Production, PRs #19/#22, branch B2, merge ou release.
- **Próximo estágio recomendado:** revisar/finalizar testes D1.2, obter A-D3 incremental, decidir integração visual, somente depois preparar beta.8 e executar **uma única** pipeline `run_preflight=false`, `run_windows_build=true`. Build Windows somente se Linux e smoke GUI passarem. Versionamento beta.8 reservado, NÃO aplicado.

**Estado:** D1.2 EM_DESENVOLVIMENTO · G0 NAO_HOMOLOGADO · beta.6/beta.7 recuperáveis.

## Checkpoint de consolidação automatizada — 10/11/2026

**Contribuição funcional desta rodada, sem alterar os dados ou CSS do Argon:**

1. `scripts/d1-electron-smoke.cjs`: acrescentada função `visualMatrix` executada depois da navegação, abrangendo **16 screenshots** (4 áreas: Visão Geral, Movimentações, Planejamento e Orçamentos; viewport 1366×768 ou 1920×1080; claro/escuro e `prefers-reduced-motion: reduce`/normal). O CDP deve confirmar aba ativa, breadcrumb, tema ativo, media query de movimento reduzido, largura do viewport, inexistência de overflow horizontal global e PNG não-vazio com assinatura válida. Falha real de qualquer contrato aborta o job com erro; manifesto JSON só existe após conclusão da matriz.
2. `tests/d1-2-visual-matrix.test.cjs`: 3 regressões publicadas, com CDP sintético: 16 capturas/manifesto, overflow bloqueado, PNG inválido bloqueado. **Não** são screenshots de Electron real.
3. `.circleci/build-windows.ps1`: no próximo build Windows **obrigar 16 PNGs e `visual-matrix.json`**; arquivos ficam em `circleci-smoke-artifacts`, separados dos arquivos `circleci-artifacts` com exatamente 2 executáveis e SHA256.txt. `.circleci/config.yml`: publicar matriz sintética em **Artifacts → MeuFinanceiro-Desktop-Smoke**, separada de **MeuFinanceiro-Windows**, sem remover qualquer teste ou gate de proveniência.
4. Verificação GitHub: A-D3 não localizada como PR ou branch com nome `ad3` nesta rodada, assim PR #27 CSS-only A-D1/A-D2 preservado; nenhum CSS alterado, nenhuma integração cega, não há novo EXE beta.8.

**Testes realmente executados nesta rodada:** 3/3 da função `visualMatrix` **exata** publicada no blob GitHub `e295401f1479969b0044ff6c5c3fd84a2c126db9`, extraída e executada no runtime V8 com `CDP`, `fs` e `Buffer` sintéticos: 16 capturas/16 navegações/manifesto gerados; overflow global rejeitado; imagem inválida rejeitada. Essa prova é **unidade de lógica com simulações**, não garante importação Node, GUI Electron ou teste no Windows. **Três testes do novo arquivo `tests/d1-2-visual-matrix.test.cjs` ainda não foram executados por Node no checkout completo.** Os 4/4 testes locais anteriores de isolamento de perfil/SQL com Node 22.16.0 permanecem como evidência específica anterior, sem reexecução nesta rodada. **Sem CircleCI da D1.2**; não promover para VALIDADO ou PUBLICADO.

**Próximo gate:** manter D1.2 como EM_DESENVOLVIMENTO enquanto A-D3 estiver indisponível e a suíte completa não tiver sido rodada; quando candidata beta.8 relevante estiver pronta, executar **uma única** pipeline `run_preflight=false` / `run_windows_build=true` no SHA final. O CI executará Linux → smoke Electron Windows → empacotamento com proveniência e hash. Conferir PNGs e erros visuais antes de declarar homologação. Preservar beta.6/beta.7. Sem operação com dados pessoais.

**Regressão de configuração adicional:** `tests/d1-2-electron-contract.test.cjs` ganhou contrato que garante 16 PNGs exigidos no Windows, manifesto da matriz, publicação dos screenshots separada dos instaladores, PNG válido, ambas as resoluções e preferência de movimento. Código publicado, **teste Node no checkout ainda não executado**; a bateria de lógica 3/3 V8 citada acima é distinta desse teste.
