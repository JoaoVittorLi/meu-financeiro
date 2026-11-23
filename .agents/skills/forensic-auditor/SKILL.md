---
name: forensic-auditor
description: Independent adversarial and release gate auditor skill verifying SHA parity, provenance, isolation, and binary GO/NO-GO (recommended model: pro).
---

# Skill — Auditor Adversarial & Guardião de Release (`pro`)

## Quando ativar
Antes de promover qualquer SHA como candidato homologado, antes de solicitar/executar build NSIS Nível C e antes de declarar qualquer marco concluído.

## Checklist obrigatório
1. **Paridade de SHA & Proveniência:** confirmar `git status --short` limpo, `git rev-parse HEAD`, `npm run test:types`, `node scripts/build-preload.cjs check`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run provenance:verify` e `npm run test:asar` no **mesmo SHA** testado.
2. **Segurança e Isolamento Win32:** auditar `electron/release-channel.cjs` (rejeição de SFN 8.3, trailing dot/space, dispositivos reservados `CONIN$`/`CONOUT$`, NTFS ADS, junctions/symlinks, e ignorância incondicional de overrides em `stablePackaged`).
3. **Superfície Adversarial de Classificação e IA:** testar empiricamente possíveis bypasses em `electron/cat02-classifier.cjs` (subadquirentes, PIX, caracteres invisíveis, truncamentos), guardas anti-injeção e separação determinística do Copiloto.
4. **Regra Anti-Falso-PASS:** verificar que nenhum `NOT_RUN` ou `BLOCKED` foi mascarado como `PASS`, que o workspace OneDrive (`Carbon Meu Financeiro`) e os perfis pessoais permanecem intactos, e que Nível A + Nível B + Nível C foram verificados de forma independente.
5. **Veredito binário:** emitir **`GO`** ou **`NO-GO`** fundamentado exclusivamente em evidências reproduzíveis.
