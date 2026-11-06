# Meu Financeiro — Desktop v0.4 💜

Aplicativo privado para Windows com interface escura em React/TypeScript, Electron e SQLite local. Motor de cálculos independente de IA e modo de demonstração com dados fictícios separados do perfil pessoal.

## Como obter o executável sem Python

O workflow `.github/workflows/build-windows.yml` é executado após um push na branch `main` ou manualmente na aba **Actions**. Ele instala as dependências em um runner **Windows**, executa os testes e publica dois arquivos `.exe` como artefatos:

- `MeuFinanceiro-Portable-0.4.0-x64.exe` — aplicativo portátil.
- `MeuFinanceiro-Instalador-0.4.0-x64.exe` — instalador Windows.

Os nomes serão confirmados pelo próprio workflow. Um manifesto SHA256 também é incluído.

## Desenvolvimento

```powershell
npm install
npm run test
npm start
```

O código principal está em `src/app.ts`, `electron/main.cjs`, `electron/preload.cjs` e `electron/db.cjs`. Consulte `LEIA_PRIMEIRO.md` para instruções sobre dados, backups, segurança e limitações.

**Status:** implementação validada por testes locais de lógica e banco; o `.exe` final precisa ser compilado e testado em Windows. Não cadastre dados bancários sensíveis nesta versão experimental.
