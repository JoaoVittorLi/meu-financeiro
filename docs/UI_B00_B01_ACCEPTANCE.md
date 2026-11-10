# Meu Financeiro — UI-01: B00 (proveniência) + B01 (seletor)
**Origem:** `feat/inteligencia-e4-contexto-financeiro-sintetico` no commit `80362a75daf2cd9a3e4b223b3e174c2d29a0034d`.
**Branch isolada:** `fix/category-overlay-b00-b01`.
**Versão candidata:** `0.9.5-beta.3`. Não é um novo instalador homologado.
**Fora do escopo:** B02 (categoria clicável na tabela), redesign, calendário, PWA/cloud, migração SQLite, Inteligência financeira real.

## B01 — Correção
A auditoria complementar demonstrou que o menu do `StyledSelect` fica em portal sob `document.body` com camada 150, mas o drawer possui camada 450 e o backdrop da Inteligência 500. A categoria não recebe o ponteiro.

Mudanças:
- `app/style.css`: token semântico `--mf-z-select-portal:600`, acima do drawer e do assistente contextual, sem alterar os calendários e sem elevar todos os overlays.
- `src/app.ts`: o Escape é consumido somente quando o seletor está aberto e devolve foco ao gatilho; Escape seguinte permanece disponível para fechar o drawer. O menu recebe `onKeyDown`, mesmo quando uma opção está focada.
- Scroll no dono do seletor reposiciona o portal, em vez de fechá-lo imediatamente; scroll não relacionado fecha. Hover repetido na opção já focada não provoca renderização desnecessária.
- Lógica financeira de categorias, SQL, callbacks de gravação e contratos de split **não foram alterados**.

### Evidência de teste local — não equivale ao EXE Windows
- TypeScript `5.8.3`, `--noEmit` e compilação do renderer: aprovados numa cópia exata da fonte editada.
- 8 testes unitários B00/B01 aprovados em Node 22; o conjunto da branch contém mais um caso de scroll em `tests/category-overlay.test.cjs`.
- Chromium Linux isolado, dados 100% fictícios e ponte Electron substituída por mocks: **manual, banco e split** com 14 opções, popup z600 sobre drawer z450, hit-test verdadeiro, clique de mouse permitido e Escape em duas etapas. Modal de lançamento testado sem fechar o pai.
- Nenhum banco pessoal, Pluggy, Cloudflare ou GPT foi usado. Nenhuma chamada paga ou rede externa.
- **Pendentes:** homologação no Electron Windows com perfil isolado, foco/NVDA, efeitos de persistência real em banco descartável, múltiplos tamanhos/zoom, suíte total e compilação CircleCI.

## B00 — Verificação de proveniência
1. `npm run test` compila `app/app.js` com o TypeScript fixado e executa toda a suíte Node.
2. `npm run provenance:create` gera `app/renderer-provenance.json`: SHA git do checkout, versão, Node/TypeScript/Electron e SHA-256 de todos os assets do renderer (exceto o próprio manifesto).
3. `npm run provenance:verify` valida os hashes e recusa bundle antigo, arquivos ausentes ou alterações não correspondentes.
4. O `dist:windows` só empacota depois desses gates. O manifesto gerado é incluído no `app.asar`; não deve ser versionado.
5. No CircleCI, após empacotar, `scripts/renderer-provenance.cjs verify-asar` compara o manifesto e **cada arquivo do ASAR** com a fonte compilada. O script falha se houver divergência e registra hashes do renderer, manifesto e ASAR no `SHA256.txt` existente, sem criar quarto artifact.
6. O registro SHA/EXE do CircleCI continua sendo feito pelos procedimentos originais e a publicação permanece manual, protegida por `run_windows_build=true`.

Os testes B00 exercitam também casos negativos (versão, SHA, CSS, assets extras, bundle antigo e ASAR corrompido), com dados artificiais. A verificação de ASAR com a biblioteca real `@electron/asar` ocorrerá somente no empacotamento Windows.

## Aceite antes da distribuição
- [ ] Revisar diff: somente `src/app.ts`, `app/style.css`, `package.json`, `.gitignore`, `.circleci/build-windows.ps1`, `scripts/renderer-provenance.cjs`, testes e este documento.
- [ ] Executar `npm run test:types`, `npm run test:db`, `npm test` do PWA e Wrangler dry-run. **Não pular falhas**.
- [ ] Confirmar `preflight_linux` verde antes de gastar minutos de `build_windows`.
- [ ] Confirmar `verify-asar` verde, EXEs e hashes do mesmo commit.
- [ ] Validar menu, Escape, scroll, mouse e teclado nos drawers manual, banco e split; testar modal e zoom com um perfil **descartável** no Electron Windows.
- [ ] Validar que selecionar categoria de banco usa `accountId` e `externalId` corretos e não altera outra conta. Confirmar erro de gravação sem anúncio falso de sucesso.
- [ ] Fazer backup SQLite antes de instalar em perfil pessoal, somente após aprovação do pacote.
- [ ] Manter o B02 como entrega separada — a categoria na linha da tabela continua sem edição direta.
- [ ] Conferir que nenhum arquivo real, flag de Cloudflare, OAuth, PWA ou base de dados foi alterado.

**Status:** implementação B00/B01 pronta para revisão e CI, **não é instalação homologada nem release**. Não iniciar Actions, deploy ou cutover.
