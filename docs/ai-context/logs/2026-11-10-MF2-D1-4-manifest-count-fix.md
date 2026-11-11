# MEU FINANCEIRO 2.0 — D1.4.3 | Manifesto visual 32 PNGs/1 registro no PowerShell

**Data:** 10/11/2026. **Repositório:** `JoaoVittorLi/meu-financeiro`. **Branch:** `feat/mf2-beta8-premium-staging-20261110`; **PR:** #31 draft. **HEAD inicial:** `b61f0cd63c3d0d8b3b5691308aaab4a47d5d4c84`. **Código commitado em:** `ecc08b5fed9bcfed50966fad3135899247fcf293` e `c29ce3578708cf38c0b96595a058efb2e7f69365`. Um commit documental posterior avança o HEAD; conferir a branch antes de novas alterações.

## Falha e diagnóstico causal

O CI retornou `Smoke Electron: esperadas 32 capturas e entradas no manifesto; encontrados 32 PNGs e 1 registros.` Em `.circleci/build-windows.ps1`, a atribuição `$matrix = @(Get-Content -LiteralPath $matrixFile -Raw | ConvertFrom-Json)` podia encapsular o array JSON inteiro em um único objeto de pipeline (`$matrix.Count=1`), comportamento do Windows PowerShell 5.1. O arquivo `scripts/d1-electron-smoke.cjs` faz `rows.push()` para cada captura e `fs.writeFileSync(... JSON.stringify(rows,null,2))` uma vez após todas as capturas: o erro observado **não sustenta a hipótese de gravação parcial, overwrite por captura ou race condition**.

## Correção técnica, sem relaxar critérios

- **`.circleci/build-windows.ps1`**: removeu a leitura/contagem JSON com `ConvertFrom-Json` e `@(...)`; mantém a conferência de existência do manifesto, invoca `& $nodeExecutable scripts/verify-visual-matrix.cjs $env:MF_SMOKE_OUTPUT_DIR` e exige `Assert-Success 'Matriz Electron de 32 capturas e manifesto JSON'`. JSON não é mais interpretado pelo PowerShell. Não altera instalação Node, compile, smoke real, `npm run dist:windows`, ASAR, NSIS/Portable ou SHA.
- **`scripts/verify-visual-matrix.cjs` novo**: usa `JSON.parse` sobre o array do manifesto, gera expectativa determinística a partir de `SMOKE_VIEWS` e `SMOKE_PRESETS`, exige 32 registros e 32 arquivos PNG físicos, nomes únicos, correspondência exata aos slugs/temas/resoluções, tipos dos metadados, valores reais de viewport e ausência de overflow. Para cada PNG verifica bytes de assinatura, chunk IHDR e dimensões codificadas no cabeçalho. Retorna exit code 1 quando falha; não finge decodificar/validar CRC da imagem inteira.
- **Testes:** contratos em `tests/d1-2-electron-contract.test.cjs` e `tests/d1-3-smoke-matrix.test.cjs` mudaram da contagem PowerShell antiga para exigir a chamada Node. Novo `tests/d1-4-visual-matrix-manifest.test.cjs` com 15 cenários isolados, inclusive linha de comando e saída 0/1. Nenhuma alteração de domínio financeiro ou CSS Premium.

## Evidências efetivamente executadas

1. **Node v22.16.0:** `node --test tests/d1-4-visual-matrix-manifest.test.cjs` executado em pasta isolada `/tmp/mf2_manifest_check`, com **15/15 PASS**. Conteúdo do verificador e da suíte confirmado **byte a byte** por `git hash-object` vs blobs do GitHub: `c85af625de4bc2f57dc8a8615f1759dacea6a0ed` e `eb89dcfc0ed50bdd7f8dd8c63cef3d49ddb9aa7c`; as constantes do smoke foram reproduzidas no fixture e conferidas na fonte GitHub. Isso é teste real Node da lógica isolada, **não** suíte completa do checkout beta.8 e não é Electron real.
2. Casos: baseline 32×32, JSON array aninhado (equivalente à contagem aparente 1), JSON objeto, duplicata, linha/arquivo ausente, arquivo extra, assinatura PNG, dimensões IHDR, rótulo de área, viewport, overflow, JSON malformado, CLI code 0 e code 1.
3. **8/8 callbacks existentes** de `tests/d1-2-electron-contract.test.cjs` e `tests/d1-3-smoke-matrix.test.cjs` executados em V8 com leitura de arquivos simulada sobre os textos reais publicados em `c29ce3578708cf38c0b96595a058efb2e7f69365`, PASS. Não são execução real de `node --test` dessas suítes.
4. **NÃO executados neste HEAD:** `npm run test:db` completo, `npm run test:types`, `npm run compile`, F08, testes ASAR, PowerShell Windows 5.1, GUI Electron real, backups/restauração pelo app, 32 PNGs físicos Windows, build NSIS/Portable, CI/artefatos/hashes. Não existe um checkout privado completo nesta sessão, e o executável PowerShell não está instalado no container Linux.

## Próximos gates

Antes de declarar beta.8 homologada, executar uma única pipeline CircleCI em Config+Checkout Branch `feat/mf2-beta8-premium-staging-20261110` com `run_preflight=false` e `run_windows_build=true`. O `preflight_linux` executará `npm ci`, `test:types`, `test:db` (incluindo 15 novos testes), compile, F08 e ASAR. Se passar, `build_windows` executará o Electron real e o novo verificador físico. Reprovar se faltar arquivo/entry/dimensão; só depois gerar dois EXEs e `SHA256.txt`. Sem merge `main`, deploy Cloudflare/PWA ou release durante este hotfix.
