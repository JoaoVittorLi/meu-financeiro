# Regra Permanente — Homologação por Marco (NSIS Windows x64 Exclusivo)

**Status:** Vinculante para todos os marcos presentes e futuros (M1–M5+), conforme Diretriz Oficial de Homologação Real do Aplicativo Windows e Diretriz Permanente — Homologação por Marco (`2026-11-18`).

## 1. Formato Único de Distribuição

- O **único formato de distribuição** do Meu Financeiro é o **Instalador NSIS Windows x64** (`--win nsis --x64`, `MeuFinanceiro-Instalador-<versão>-x64.exe`).
- A versão **Portable** está **permanentemente fora de escopo** (proibida em `package.json`, `.github/workflows/build-windows.yml`, `scripts/build-stable-windows.cjs` e `scripts/preview-windows-local.ps1`).

## 2. Separação Obrigatória de Três Níveis de Verificação

Nenhum nível substitui o outro. Um teste que não pôde ser executado deve ser registrado como `NOT_RUN` ou `BLOCKED`, nunca como `PASS`.

- **Nível A — Testes técnicos:** `npm run test:types`, `npm run compile`, `node scripts/build-preload.cjs check`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, `npm run test:db`, `npm --prefix mobile-push test`, `npm run provenance:create`, `npm run provenance:verify`.
- **Nível B — Electron em desenvolvimento:** abertura real do Electron com `MF_QA_SYNTHETIC=1` e perfil temporário isolado (`npm run test:electron-smoke` + `node scripts/verify-visual-matrix.cjs` 32 PNGs + `node scripts/nivel-b-interactive-qa.cjs` jornadas interativas multi-módulo positivas e negativas, fechar/reabrir e conferência UI + SQLite).
- **Nível C — Aplicativo NSIS realmente instalado:** geração do instalador NSIS experimental (somente mediante autorização), registro de SHA-256, instalação em ambiente/diretório isolado com separação verificada de `userData`, execução do `.exe` realmente instalado, execução de jornadas funcionais pela interface real, fechamento/reabertura, persistência em SQLite isolado, auditoria visual e validação de isolamento sem interferência nos perfis estável/pessoal.

## 3. Ciclo Obrigatório de 7 Etapas por Marco

Todo marco que altere funcionalidades do Meu Financeiro só pode ser considerado concluído após cumprir todas as 7 etapas:

1. Desenvolver e integrar as funcionalidades aprovadas no escopo do marco.
2. Executar testes técnicos (Nível A), financeiros e visuais/interativos (Nível B) no SHA exato.
3. Corrigir regressões encontradas e repetir os testes no novo SHA (nenhum `PASS` é herdado de SHA anterior).
4. Solicitar autorização do proprietário (ou validar autorização condicional explícita) para gerar o instalador NSIS experimental, apresentando SHA exato, gates aprovados e verificação prévia de isolamento.
5. Após autorização, gerar o instalador NSIS x64, registrar SHA-256 e executar testes funcionais e visuais reais no aplicativo realmente instalado (Nível C: jornadas multi-módulo, persistência pós-restart, recuperação e verificação de recursos empacotados).
6. Corrigir eventuais falhas encontradas no Nível C, repetir os gates aplicáveis e atualizar a candidata autorizada.
7. Entregar o resultado final com instalador identificado (preservando a baseline homologada separada de novos experimentos), evidências reais e parecer independente `GO` / `NO-GO`.

## 4. Proibições Absolutas

- **Nunca** gerar novos instaladores automaticamente sem autorização explícita ou autorização condicional aprovada pelo proprietário.
- **Nunca** instalar versão experimental sobre a instalação estável (`%LOCALAPPDATA%\Programs\Meu Financeiro`) nem tocar os dados pessoais em `%APPDATA%\meu-financeiro-desktop` / `%APPDATA%\Meu Financeiro`.
- **Nunca** publicar release estável, fazer merge na `main`, criar tags de release ou acionar builds/serviços pagos (CircleCI Windows / GitHub Actions Windows) sem aprovação explícita.
