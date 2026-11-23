---
name: electron-nivel-b-c-qa
description: Real interactive Electron UI QA (Nível B) and NSIS-installed Windows app validation (Nível C) skill.
---

# Skill — QA Electron Nível B & Nível C NSIS Instalado

## Quando ativar
Para validação visual e funcional real no Electron em desenvolvimento (Nível B) e no aplicativo Windows realmente instalado por NSIS x64 (Nível C).

## Procedimento Nível B (Electron em desenvolvimento — `MF_QA_SYNTHETIC=1`)
1. Garantir ausência de `MF_REAL_PROFILE` e `PLUGGY_*`.
2. Executar `npm run test:electron-smoke` e `node scripts/verify-visual-matrix.cjs` (32 PNGs em 8 áreas × 4 presets: `1366×768`/`1920×1080`, `light`/`dark`, `reduced-motion`).
3. Executar `node scripts/nivel-b-interactive-qa.cjs` cobrindo todas as jornadas positivas (`PJ-01..09`) e negativas (`NJ-01..05`) com cliques reais, formulários, diálogos nativos, fechamento e reabertura no mesmo `userData` temporário e verificação cruzada na UI DOM e no SQLite em disco.

## Procedimento Nível C (NSIS x64 instalado — somente pós-autorização)
1. Confirmar presença da autorização do proprietário e isolamento pré-instalação no Windows 11 (identificadores `appId`, registro de desinstalação, backup preventivo do binário experimental anterior se existir, timestamps intactos da instalação estável `Meu Financeiro` e de `%APPDATA%\meu-financeiro-desktop`).
2. Gerar exclusivamente o instalador NSIS x64 (`npx electron-builder --win nsis --x64 --publish never` ou equivalente autorizado), registrar SHA-256 e preservar artefato baseline em `C:\Dev\releases\`.
3. Instalar em diretório dedicado (`C:\Dev\mf-nsis-test-install`) e iniciar o `.exe` realmente instalado com `MEU_FINANCEIRO_EXPERIMENTAL_USER_DATA_DIR=C:\Dev\mf-nsis-test-userdata` e `MF_QA_SYNTHETIC=1`.
4. Comprovar processo ativo do executável instalado (`app.isPackaged === true`, caminho SQLite isolado), executar matriz interativa completa pela interface (incluindo fechar/reabrir), testar bloqueio de override para perfis protegidos, conferir assets/SVGs e verificar que instalação e dados estáveis permaneceram intocados.
