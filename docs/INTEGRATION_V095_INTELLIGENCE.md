# Integração de branches — Meu Financeiro 0.9.5-beta.1 + Inteligência E1/E2

## Origens preservadas
- Cloudflare/PWA e auditoria financeira E1: `safety/cloud-migration-preflight-20261107`, snapshot `7d2048e12c3161a94d1273fb861f8596fcdd3c94`.
- Inteligência e CircleCI: `ci/circleci-inteligencia-e1-e2`, snapshot `3eaca803ca6fb3d3c7f6c13df86f12ab090cca1f`.
- Base comum: `20a5aa03de3ecdb8bf1f867469eb07579a3e868d`.

## Estratégia
A nova branch foi criada a partir do snapshot Cloudflare, com adição seletiva dos módulos IA e do pipeline CircleCI. Não foi realizado merge na `main` e nenhuma branch existente foi sobrescrita.

Arquivos compartilhados (Electron main/preload, app.ts, Worker e PWA) foram integrados por alterações relativas à base comum. Dois conflitos de linha em `src/app.ts` foram conciliados manualmente: ambos os campos `cloudE1Report` e `intelligence*` no State e no constructor são mantidos. A auditoria E1 do cloud e os handlers de IA coexistem.

A versão do `package.json`, `appId`, artefatos NSIS e Portátil e a base financeira permanecem as da Cloudflare: **0.9.5-beta.1**. Não reutilizar o executável 0.9.4 como versão unificada.

## Inclusões
- `shared/ai-policy.mjs`: contrato único de IA Low/Medium para Windows e Worker.
- `electron/ai-*.cjs`: OAuth PKCE, cofre criptografado e três cenários fictícios no cliente Sol; sem fallback pago.
- `src/intelligence-*.ts`: interface e painel contextual no Electron.
- `mobile-push/public/finance-ai.js`, alterações em Worker/PWA e testes: contrato de capacidades acessível ao PWA autenticado; **sem inferência remota**.
- `.circleci/config.yml` e `.circleci/build-windows.ps1`: build manual Windows 2022 + verificação dos testes + dois EXE e SHA256.

## Exclusões deliberadas
Não foram substituídos por versões antigas da IA: `package.json`, `mobile-push/package.json`, `.github/workflows/unified-preview-gate.yml`, `LOCAL_DEVELOPMENT_NO_ACTIONS.md` e os módulos E1/Cloudflare já existentes na branch cloud. Os arquivos antigos para Codespaces não são necessários ao processo CircleCI e não foram importados.

## Segurança
Não ativar `FINANCE_SYNC_ENABLED`, `FINANCIAL_SCHEMA_ACTIVE` ou cutover sem os gates do projeto cloud. Não incluir segredos, tokens OAuth ou SQLite em artifacts. Ao integrar contas reais, usar autorização, backup, dry-run e reconciliação de IDs/valores antes de considerar concluído.

## Critérios de homologação (ainda pendentes)
1. Passar `npm run test:types`, `npm run dist:windows`, suíte Cloudflare/PWA e auditoria E1.
2. CircleCI verde e exatamente dois EXE + SHA256 como Artifacts.
3. Instalar no Windows e revisar todas as telas, auditoria E1 e Inteligência.
4. Conferir dados SQLite locais e não ativar migração financeira.
5. Validar PWA no ambiente protegido sem enviar credenciais ChatGPT.
6. Validar o OAuth/streaming GPT apenas com dados fictícios e limite de créditos adicionais desativado.

**Importante:** o código da branch é uma *integração candidata*, não uma release homologada. Outros commits enviados futuramente para as branches de origem não entram automaticamente aqui. Antes de nova release, comparar as cabeças novamente.
