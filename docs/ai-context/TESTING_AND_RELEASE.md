# Plano verificável de testes, builds e releases

Este arquivo especifica comandos **presentes no repo** e a diferença entre evidência de código, de CI e de uso real. Não afirma que foram executados durante a criação da documentação.

## Desktop — Node 22 / TypeScript 5.8.3

Na raiz do projeto, ambiente de desenvolvimento controlado:

1. npm install --no-audit --no-fund --package-lock=false  (CI atual; depende da rede, sem lockfile)
2. npm run test:types
3. npm run test:db
4. npm run compile
5. node scripts/renderer-provenance.cjs check-bundle
6. npm run test:asar
7. npm run dist:windows  (somente Windows/ambiente suportado; compila/testa/empacota)

**Atenção:** npm run test:db cobre testes Node; npm run test:asar verifica ASAR; checagem visual real exige navegador/Electron. Não confundir contagem relatada com execução atual. A falta de lockfile é lacuna de reprodutibilidade a corrigir controladamente.

## Worker/PWA

Em mobile-push/:

1. npm install --no-audit --no-fund --package-lock=false
2. npm test
3. npx wrangler deploy --dry-run --outdir /tmp/mf-e4-preview  (não publicar)

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
