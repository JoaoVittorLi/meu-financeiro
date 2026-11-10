# Plano verificável de testes, builds e releases

Este arquivo especifica comandos **presentes no repo** e a diferença entre evidência de código, de CI e de uso real. Não afirma que foram executados durante a criação da documentação.

## Desktop — Node 22 / TypeScript 5.8.3

Na raiz do projeto, ambiente de desenvolvimento controlado:

1. npm ci --no-audit --no-fund  (branch B3 do PR #19: arquivos package-lock.json versionados; CI verde nesta revisão ainda pendente)
2. npm run test:types
3. npm run test:db
4. npm run compile
5. node scripts/renderer-provenance.cjs check-bundle
6. npm run test:asar
7. npm run dist:windows  (somente Windows/ambiente suportado; compila/testa/empacota)

**Atenção:** npm run test:db cobre testes Node; npm run test:asar verifica ASAR; checagem visual real exige navegador/Electron. Não confundir contagem relatada com execução atual. Os dois lockfiles foram publicados no PR #19 na B3.3, mas a reprodutibilidade continua pendente até validar instalações npm ci e preflight Linux no SHA novo.

## Worker/PWA

Em mobile-push/:

1. npm ci --no-audit --no-fund  (branch B3 do PR #19; ainda requer execução/validação no SHA novo)
2. npm test
3. npx --no-install wrangler deploy --dry-run --outdir /tmp/mf-e4-preview  (não publicar; usar CLI fixada no lock)

Os 129 testes PWA reportados na PR #16 são regressões. Não demonstram a U4 completa nem login financeiro verdadeiro.

## CircleCI: fluxo obrigatório

Arquivo .circleci/config.yml:
- run_preflight=true e run_windows_build=false → workflow preflight_on_demand, job preflight_linux.
- run_windows_build=true → workflow windows_on_demand, preflight_linux **e só depois** build_windows.
- default de ambos é false. Não disparar runners desnecessariamente.
- Windows Server 2022; script .circleci/build-windows.ps1; package version nas duas áreas 0.9.5-beta.6 para o SHA U3.
- artifacts esperados: instalador NSIS x64, portátil x64, SHA256.txt. Confirmar nomes, arquivos e origem no job.
- Este pipeline não executa deploy Cloudflare nem GitHub Release.
- Preflight e build_windows verdes do PR #15 SHA 44fb1b0 **não validam** PR #16 SHA c535cb0.

## Smoke de instalação Windows

Requer instância isolada, backup dos dados pessoais antes de qualquer atualização, sem migrar cloud:
- instalação/abertura, telas e rota de cada seção;
- temas claro/escuro; 1366×768 + janela ampla; texto/valor extenso;
- U1: período, fonte, gráfico+tabela, saldo desconhecido, privacidade visual;
- U2: revisão, categorias, filtros, seleção em lote, Planejamento calendário/projeção;
- U3: limites 0/ausente, contas e data de saldo, simulador A/B, primeira data, planejar compra→editor;
- Inteligência: interface demo, sem afirmar inferência bancária real;
- fechamento/reabertura e persistência sem corrupção;
- SHA e hash ASAR correspondem à fonte compilada.

## Paridade e segurança antes do cloud cutover

- Revisão da sessão do proprietário e Cloudflare Access em todas as rotas protegidas;
- contas e identidades, datas, centavos, naturezas, categoria, saldos as-of, vínculos, split;
- backup/restore real em base descartável; idempotência, edições concorrentes, conflito 409;
- PC↔Android, offline/reconnect; rejeição de escrita não autorizada;
- não enviar dados financeiros brutos para logs, CI ou IA;
- ver E1_CONCILIATION_REPORT.md e PARITY_AND_UNIFIED_RELEASE.md.

## Release definitivo 2.0

Uma única revisão de origem/contrato validado para Windows e PWA; versão semântica coordenada, checksums, changelog e rastreabilidade, gate humano para Production, monitoramento e rollback. Publicar 2.0.0 só após G10. Uma versão beta não é o instalador estável.

## Matriz de evidência

Relatar separadamente: comando executado, SHA, ambiente, status e link; artifact encontrado, hash confirmado; Windows instalado/testado; PWA em Preview autenticado/testado; Cloudflare Production publicado; migração real autorizada. Para qualquer coluna não verificada, usar **NÃO VERIFICADO**, sem inferência.

## B3 — Registro histórico parcial (10/11/2026; atualizar conforme B3.3 abaixo)

O preflight Linux da **candidata original** `7a01f1c` foi observado como `success` no [CircleCI](https://app.circleci.com/workflow/4a8c3a15-4101-4333-95c7-8351fd2f37a4/job/32ffc3e0-4838-4994-befe-a50069d2d993), **antes** da B3. Essa execução não valida as mudanças da B3.

A branch B3 fixa Node `22.23.4`, npm `10.9.9`, Linux Docker `node:22.23.4-bookworm@sha256:e273cf2a19c7334c03f52e2ca933ecdfc3fbfaad49db7b8bc8c3edd9ac34e9c7` (índice da imagem oficial) e Windows `https://nodejs.org/dist/v22.23.4/` com SHASUMS256 e verificação de versão. Wrangler dry-run usa `npx --no-install` para não buscar CLI substituta.

**Importante: C11 ainda não foi resolvido nesta branch.** O ambiente de autoria não possui acesso ao registry npm, logo **não foi possível gerar ou verificar** `package-lock.json` da raiz e `mobile-push/package-lock.json`. Por isso **não foi feito o switch prematuro para `npm ci`**, que falharia imediatamente. O CI ainda usa instalação sem lockfile. A etapa final deve ser feita por um executor com rede, preferencialmente Work, na mesma branch após inspecionar HEAD e ownership:

1. Com Node 22.23.4/npm 10.9.9, gerar lockfiles sem modificar as versões diretas: na raiz `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`; em `mobile-push/`, repetir. Registrar resoluções e alertas; não copiar lockfiles de outras branches sem verificar.
2. Com ambas as dependências fixadas, trocar **ambos** `npm install --package-lock=false` do Linux e o Windows para `npm ci --no-audit --no-fund` (Linux com `ELECTRON_SKIP_BINARY_DOWNLOAD=1`); preservar etapa Windows que baixa Electron. Não executar instalador Windows nesta missão.
3. Executar `npm ci` em ambas, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, PWA `npm test` e `npx --no-install wrangler deploy --dry-run --outdir /tmp/mf-e4-preview`.
4. Fazer push, verificar SHA e executar CircleCI preflight na branch B3 (`run_preflight=true`, `run_windows_build=false`) **sem Windows**. Só após sucesso considerar B3 concluída e autorizar B4. Documentar resultados em ROADMAP+log, não publicar em main.

**Rollback:** reverter o(s) commit(s) da B3 na branch de trabalho ou voltar à candidata original `7a01f1c` sem mover o ref da candidata; validar preflight original; nenhum dado financeiro é migrado. Não apagar lockfiles após serem homologados.


## B3.3 — Lockfiles autênticos incorporados, preflight do novo SHA pendente (10/11/2026)

O bootstrap Linux `lockfile_bootstrap` do PR #19 [passou no CircleCI](https://app.circleci.com/workflow/5251af99-07fb-44a7-93ea-f25be9a4bf1d/job/bdd7f7cd-1a9c-4a09-9647-6fd19b7f3ced) no SHA `ff51444538e4c745d064f4820f680ec8b617719c`. O proprietário forneceu os dois arquivos JSON completos, a metadata e hashes de SHA256; os bytes dos dois arquivos reconstruídos do conteúdo fornecido foram verificados localmente e publicados intactos em `package-lock.json` e `mobile-push/package-lock.json`. A prova inclui conferência de hashes de blob Git após commit. [Log e SHA256 completos](logs/2026-11-10-MF2-B3-reprodutibilidade.md).

Neste PR, as **duas instalações Linux e a instalação Windows** usam agora `npm ci --no-audit --no-fund` com lockfiles reais. O script Windows preserva os testes, SHA256 e ASAR/provenance. O Worker usa `npx --no-install wrangler`; a resolução travada foi `wrangler 4.160.0`, enquanto o pacote direto permanece `^4.102.0`. Há uma dependência Git `@electron/node-gyp` com SHA fixado: se houver falha SSH real, diagnosticar e corrigir **somente transporte para o repositório oficial via HTTPS no runner**, sem alterar o SHA ou o lockfile às cegas.

**Estado de prova:** instalações `npm ci` e suíte completa **não executadas aqui** por falta de ambiente com dependências/rede; preflight CircleCI no SHA novo **não acionado/comprovado**. O bootstrap antigo **não valida** a integração `npm ci`. Para próxima execução CircleCI, selecionar Config/Checkout `fix/mf2-c11-reproducible-build-20261110` e `run_preflight=true`, `run_windows_build=false`, `run_lockfile_bootstrap=false`, conferir SHA e registrar a saída individual do job. **Não executar Windows**. O bootstrap temporário permanece inativo (`default=false`) até confirmar o preflight, quando deverá ser removido ou mantido com justificativa explícita. G0 permanece `NAO_HOMOLOGADO`.
