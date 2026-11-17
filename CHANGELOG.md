# Changelog — Meu Financeiro

Formato cronológico com SemVer; `Unreleased` **não** indica versão homologada. Evidências e SHAs são identificados por PR, e não atribuídos à tag inexistente `v1.0.0`.

## [Unreleased] — preparação da 1.0.0 (17/11/2026)

**Estado:** DOCUMENTATION_PREPARATION / CODE_CANDIDATE_0.9.5-beta.8 / QA_NEWEST_SHA_NOT_RUN / **NO RELEASE**.

### Código presente na candidata empilhada #76 → #94 → #96
- Núcleo SQLite e dados manuais/bancários; planejamento, simulação, orçamentos, splits e fluxos de classificação.
- Telas D01–D05 e refinamentos B01–B05; identidade D05 14 pais, 61 subcategorias e 67 SVGs.
- I2-A/B/C/D/E, revisão/Quality Gate e I3-01 investigação read-only; B05 Hoje V6/Conversar V5/Plano V5.
- Electron 45 com preload bundled no sandbox e IPC controlado.
- RC-ALL-02.2: separação entre perfil RC experimental offline e perfil estável, leitura Pluggy offline no erro do cofre, compositor B05 corrigido, builder stable opt-in.
- RC-ALL-02.3: snapshot pré-migração SQLite/WAL a cada inicialização; mesma versão com estado alterado gera novo arquivo imutável `pre-upgrade-<versão>-<UUID>.sqlite`, sem sobrescrever o anterior; cinco regressões sintéticas adicionadas.

### Compatibilidade e limitações relevantes
- SQLite/D05 evoluíram para esquema v7; só migrar com proteção e regressões sintéticas aprovadas.
- A distribuição experimental **não compartilha** `userData` nem serviços online da estável. Nenhum import automático do banco RC para estável.
- O nome do pacote RC é **Meu Financeiro RC Experimental**, `appId=app.local.meufinanceiro.rcall01`; o empacotamento estável futuro exige **Meu Financeiro**, `appId=app.local.meufinanceiro` e metadado `mfDistributionChannel=stable`.
- Escrita pessoal por IA continua `approvedForPersonal:()=>false`. Recursos cloud pessoais e Pulso projetado por saldo/agenda não estão homologados.
- Sem prova QA/Windows no HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`, sem EXE 1.0, tag ou GitHub Release.

### Evidência (histórica, não transferível ao HEAD atual)
- PR #94 SHA `674108e961691d419700cbce7fe5f2c3ed3b962e`: proprietário relatou 901/901 Node/SQLite, TypeScript, ASAR e proveniência PASS; status CircleCI Linux `success`, Windows `error`; causa do erro Windows pendente.
- PR #96 SHA `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`: regressões de backup e checks V8 isolados publicados, mas os gates oficiais Node 22.23.4, Electron/Windows e ASAR/proveniência **NOT_RUN** nesse SHA.

## [0.9.5-beta.8] — linha de desenvolvimento / RC-ALL (não final estável)

- Consolidação incremental D01–D05, I2-A/B/C/D/E, migrações de catálogo e refinamentos visuais.
- RC-ALL-01 (#76), RC-ALL-02 (#94), correções de continuidade (#96).
- Evidências e falhas de etapas antigas preservadas nos PRs/issues; builds experimentais não equivalem à 1.0.0.

## [0.9.4] — última documentação histórica da linha antiga

- Linha do tempo interativa, gestão manual/bancária e categorias, orçamentos por natureza, simulador→Planejamento, revisão de lançamentos.
- Histórico integral do README original: [HISTORICO_README_v0_9_4.md](docs/mf2/HISTORICO_README_v0_9_4.md). A versão anterior não representa o HEAD MF2.

### Política de histórico

Não editar resultados `FAIL`/`NOT_RUN` para `PASS` por inferência. Novo QA, versão, build, migração ou correção deve informar **SHA + ambiente + comando + resultado + evidência**; somente após GO humano mover a seção [Unreleased] para `[1.0.0]`.
