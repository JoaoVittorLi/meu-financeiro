# MF2 — D1.4 Hotfix | Contratos de screenshots 16 → 32

**Data:** 10/11/2026 · **Branch:** `feat/mf2-beta8-premium-staging-20261110` · **PR:** #31 draft · **HEAD anterior:** `022b2cef08089b00d50df645e5674387ef3dad15` · **Commit do hotfix:** `eb705603600b821a59a5950c56b4e12c2769bfa9`. Documentação posterior avança HEAD. **Não houve CI, build, release, deploy nem merge main nesta correção.**

## Problema reproduzível no código

D1.3 elevou corretamente as capturas sintéticas para **32 imagens**, com 8 módulos e quatro combinações de viewport/tema/movimento, mas `tests/d1-2-visual-matrix.test.cjs` ainda exigia 16 nos contadores e manifesto, além de apenas 4 módulos. `tests/d1-2-electron-contract.test.cjs` exigia a string `Count -ne 16` no script PowerShell, incompatível com o gate atual `$expectedScreenshots = 32`. São **expectativas obsoletas dos testes**, não defeitos do gerador do smoke.

## Correção exata

- `tests/d1-2-visual-matrix.test.cjs`: exige `SMOKE_VIEWS.length * SMOKE_PRESETS.length === 32`; valida retorno da função real `visualMatrix` com CDP simulado, número de navegações/capturas/PNG/manifesto, nomes PNG exclusivos, concordância arquivos/manifesto, dimensões 1366×768/1920×1080, temas, reduced motion e todas as oito áreas. Preservados casos negativos que reprovam overflow horizontal e PNG corrompido.
- `tests/d1-2-electron-contract.test.cjs`: substitui regex de 16 por contratos precisos de `$expectedScreenshots = 32`, contagem de registros `$matrix.Count`, arquivos `$images.Count` e nomes únicos `$uniqueScreenshots.Count`, mantendo a separação de artifacts e os outros gates.
- **Não alterados:** `scripts/d1-electron-smoke.cjs`, `.circleci/build-windows.ps1`, estilos Argon, SQLite/financeiro ou CI workflow. O escopo foi intencionalmente restrito a testes.

## Evidência e limites

- **Executado:** parse V8 dos dois arquivos após o patch; 4/4 testes do arquivo de contrato Electron com callbacks reais executados em V8, simulando `fs.readFileSync`/paths e `node:test`, sobre conteúdo exato do commit publicado. **4/4 PASS em harness V8**, mas não é o Node Test Runner oficial.
- **Pendente:** `node --test tests/d1-2-visual-matrix.test.cjs tests/d1-2-electron-contract.test.cjs` no checkout com Node, `npm run test:db`, TypeScript, F08, ASAR, Electron real, teste da matriz 32 PNGs e CircleCI Windows. Neste ambiente só há Node global, sem checkout privado/dependências baixadas. Não declarar SUITE PASS nem Windows homologado.

## Próximo passo

Reconsultar HEAD, então acionar uma única pipeline CircleCI `windows_on_demand` na branch `feat/mf2-beta8-premium-staging-20261110` (Config/Checkout Branch idênticos, `run_preflight=false`, `run_windows_build=true`). O Linux reprovará novos testes falhos; Windows precisa realmente produzir 32 PNGs, manifesto, dois EXEs e hashes. Se surgir uma falha adicional, diagnosticar e corrigir na branch, sem reduzir cobertura para 16. Não distribuir instalador até verificações reais e artefatos.
