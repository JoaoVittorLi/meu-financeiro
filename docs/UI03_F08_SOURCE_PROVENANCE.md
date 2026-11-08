# F08 — Provando que o renderer corresponde às fontes TypeScript

- O manifesto agora é `mf-renderer-provenance-v2` e registra `sourceProof`: SHA256 de `tsconfig.json` e de todos os arquivos TS compilados, mais SHA256 da saída reproduzida pelo compilador 5.8.3.
- `makeManifest` e `validateManifest` conferem por compilação em memória que `app/app.js` é exatamente a saída do TypeScript do checkout atual; marcadores E3/E4.1 e versão correta isoladamente já não bastam.
- O preflight Linux chama `npm run compile` seguido de `node scripts/renderer-provenance.cjs check-bundle` antes de qualquer runner Windows.
- O build Windows continua verificando cada asset e o manifesto dentro do ASAR (`verify-asar`).
- Novo teste negativo: fonte TS alterada com bundle antigo que ainda inclui os marcadores; recompilação obriga manifesto novo.

**Limites:** o controle mede consistência da compilação, não aprova o visual nem dispensa o smoke do Electron/Windows; `@electron/asar` real e builds NSIS/portable não foram executados neste ambiente. Não há alteração de dados, SQLite, Pluggy, PWA ou Cloudflare.
