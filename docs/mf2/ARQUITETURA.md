# Arquitetura do Meu Financeiro — estado candidato 1.0.0

**Base inspecionada:** PR #96 `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`; versão do código `0.9.5-beta.8`, **não homologada como 1.0.0**. Fontes primárias: `electron/main.cjs`, `electron/preload.cjs`, `electron/db.cjs`, `electron/release-channel.cjs`, `src/app.ts`, `src/intelligence-*.ts`, `app/index.html`, `mobile-push/`.

## Camadas e dados

```text
Renderer React/TypeScript (app/index.html; src/app.ts; D01–D05/B01–B05)
    | window.financeDesktop (API exposta pelo preload bundled)
    v
Electron 45: sandbox=true, contextIsolation=true, nodeIntegration=false
    | IPC com validação de origem/escopo no MAIN
    v
electron/main.cjs
    |-- FinanceDB (node:sqlite, WAL, foreign_keys, centavos)
    |-- PlanningStore / serviços D05 / regras de categoria e revisão
    |-- PluggyVault (safeStorage Windows; credenciais separadas do SQLite)
    |-- IC-READ / IC2 / Inteligência Local, Quality Gate I2-E / I3-01
    |-- Backups/migrações + seleção de perfil / release channel
    |-- Cloudflare/push: integrações condicionais; cutover pessoal não aprovado
```

Não há SQL arbitrária autorizada ao renderer; preload expõe métodos específicos. Os handlers verificam `event.sender`, gates e payloads. Segurança exige revisitar IPC no Electron empacotado em G2/G4; a presença destas opções no código **não é aprovação de QA Windows**.

## Dados financeiros

- `electron/db.cjs` contém `FinanceDB` com `node:sqlite`, `PRAGMA journal_mode=WAL`, `foreign_keys=ON` e registros monetários em centavos.
- Conjuntos: perfis real/demo, transações manuais, registros importados Pluggy e status `POSTED/PENDING`, categorias/regras/overrides/splits, orçamentos e planejamento; revisão e classificação alteram as **camadas locais** quando permitidas, sem alterar extrato original do banco.
- D05 ativa migração/esquema v7 e IDs `categoryId`/`subcategoryId|null`, 14 categorias, 61 filhos e 67 glyphs. O renderizador `src/d05-visual-assets.ts` resolve identidade de ícone por ID e fallback; sem inferir categoria por merchant.
- Importação/cópia legada e rollback são operações de risco; consultar [DADOS_MIGRACAO](DADOS_MIGRACAO.md) e QA sintético, nunca testar na base pessoal.

## Canais Electron e segurança do perfil

- Em `electron/main.cjs`, `isolateSmokeProfile` e `releaseChannel(app)` são avaliados **antes de adquirir o lock** e abrir `FinanceDB`.
- `experimental` (build normal `dist:windows`) usa nome/identidade própria e `MeuFinanceiro-RC-ALL-01-Experimental` sob `appData`; bloqueia Pluggy/cloud/IA externa. `smoke` também é isolado.
- `stable` só é reconhecido com metadado interno `mfDistributionChannel=stable`, nome `Meu Financeiro`, builder opt-in e seleção de perfil estável reconhecido. Nenhuma variável de runtime promove RC a stable.
- Antes da migração, `stablePreMigrationBackup` verifica SQLite e cria snapshot online com WAL; RC2.3 compara hash e não sobrescreve backups anteriores quando a mesma versão contém alterações. Validar função e as regressões no Node 22.23.4/Windows antes do GO.
- `PluggyVault` mantém o cofre criptografado no perfil original; erros de `safeStorage` não justificam apagar o histórico SQLite offline.

## Inteligência e limites verificáveis

| Módulo | Mecanismo no candidato | Limitação deliberada |
|---|---|---|
| I2-A / IC2 | Grants de leitura, query e revogação no MAIN; `electron/financial-intelligence.cjs` e adaptadores | Escopo fonte/perfil/período, sem inferir dado ausente |
| I2-B/C | Sugestão, revisão e atomicidade em sandbox; gateway pessoal protegido | **Escrita pessoal IA desativada** por `approvedForPersonal:()=>false` |
| I2-D/E | Assessoria proativa de categorias + qualidade/evidências `qualityScan/Detail/Draft/Compose` | Sem bypass de Quality Gate, recusas stale/partial |
| D01–D04 | Hoje, chat e revisão com rotas de evidência/consentimento | Design aprovado não substitui QA Windows |
| B05 | Hoje V6 Pulso, Conversar V5, Plano V5; `src/intelligence-b05-*.ts` | Pulso real exige IC-READ com caixa disponível, agenda e cobertura reconciliados; fallback honesto |
| I3-01 | `electron/intelligence-investigation.cjs` + orquestrador IC2; comparações em centavos e contexto por thread | Consulta read-only, fonte parcial, sync desatualizada, grant expirado ⇒ partial/denied; não há livre acesso a todos os bancos |

Nenhum prompt/modelo externo deve receber dados pessoais sem consentimento/rota autorizada. A funcionalidade de IA externa depende de cofre/provedor e permissões; o offline experimental não a habilita.

## Cloudflare / Android / Worker

`mobile-push/` e contratos Cloudflare existem como subprojeto/integração; **não** considerar sincronização multi-dispositivo, migração pessoal/cloud cutover, paridade v7 ou Android produção um requisito já homologado pela 1.0. Os checks Linux do Worker/PWA e segurança de E1 permanecem independentes. Consentimento e sem duplicações são obrigatórios.

## Build e validação

`npm run compile` compila TS (renderer/preload); `npm run test:db` roda testes Node/SQLite; `npm run test:asar` inspeciona staging ASAR; F08 atesta proveniência do renderer; `test:electron-smoke` requer Electron real com isolamento. A configuração CircleCI inclui Linux + Windows QA + build Windows experimental/stable **opt-in**. Não confundir o sucesso de preview Cloudflare com QA Windows.

Ver [MATRIZ_FUNCIONAL](MATRIZ_FUNCIONAL_1_0_0.md) e [MATRIZ_QA](MATRIZ_QA_1_0_0.md).
