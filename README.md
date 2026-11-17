# Meu Financeiro — preparação do lançamento 1.0.0

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 19 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Nova frente bloqueante:** [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) desenvolve categorização automática D05/I2-E com opt-in por conta, permanência/revogação e correção humana, **ainda não integrada nem homologada**. A versão 1.0.0 só será lançada com essa capacidade realmente aprovada no Electron Windows. Não confundir com outras escritas pessoais pela IA, que continuam desligadas.


> **PR de preparação documental; 1.0.0 NÃO LANÇADA.** O código candidato continua em **`0.9.5-beta.8`**. O PR [#96](https://github.com/JoaoVittorLi/meu-financeiro/pull/96), HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`, contém a correção RC-ALL-02.3, mas seus gates oficiais no SHA final ainda estão **NOT_RUN**. Não instale esta candidata sobre seu perfil financeiro pessoal. A decisão de release pertence à [issue #71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71).

Aplicativo de finanças pessoais para **Windows x64**: Electron 45, interface React 16/TypeScript 5.8, persistência local SQLite, lançamento manual e consulta bancária Pluggy quando autorizada e habilitada. O projeto reúne Visão Geral, Movimentações, Orçamentos, Planejamento, Simulações, Contas e uma Central de Inteligência que prioriza **fatos verificáveis e consentimento explícito**. Recursos em uma branch ou em um protótipo **não equivalem a um instalador estável homologado**.

## Situação e documentos oficiais

| Entrada | Para que serve |
|---|---|
| [STATUS_ATUAL](docs/mf2/STATUS_ATUAL.md) | Fotografia do SHA, riscos, resultados PASS/FAIL/NOT_RUN e decisão NO-GO |
| [MATRIZ_FUNCIONAL_1_0_0](docs/mf2/MATRIZ_FUNCIONAL_1_0_0.md) | CODE_PRESENT, UI_CONNECTED, TESTED, AVAILABLE e limites, recurso por recurso |
| [PLANO_DE_RELEASE](docs/mf2/PLANO_DE_RELEASE.md) | Gates, responsáveis, aprovação humana, rollback e SemVer |
| [MATRIZ_QA_1_0_0](docs/mf2/MATRIZ_QA_1_0_0.md) | Procedimentos de validação no SHA exato |
| [GUIA_DE_NAVEGACAO](docs/mf2/GUIA_DE_NAVEGACAO.md) | Índice de PRs/issues, documentos vigentes e histórico |
| [ARQUITETURA](docs/mf2/ARQUITETURA.md) | Caminho dos dados e fronteiras Electron/SQLite/IA/Cloudflare |
| [DADOS_MIGRACAO](docs/mf2/DADOS_MIGRACAO.md) | Perfis estável/experimental, backup, SQLite/WAL, Pluggy e recuperação |
| [CHANGELOG](CHANGELOG.md) · [Notas 1.0](docs/mf2/RELEASE_NOTES_1_0_0.md) | Histórico e notas de uma **versão ainda não publicada** |
| [ROADMAP_POS_1_0](docs/mf2/ROADMAP_POS_1_0.md) | Propostas futuras, sem promessa de data ou inclusão automática no release |

O [README original da v0.9.4](docs/mf2/HISTORICO_README_v0_9_4.md) permanece preservado, sem confundi-lo com o produto candidato. O acervo do [PR documental #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82) é histórico; esta árvore reaproveita seu índice e seu [arquivo de issues](docs/mf2/HISTORICO_ISSUES_20261114.md), com referências atualizadas.

## Escopo de código integrado, não de produto lançado

- **Financeiro:** lançamentos manuais/bancários, revisão, conciliação local, categorias e subcategorias hierárquicas, filtros, splits, regras, orçamentos por natureza e simulações com confirmação antes de planejar.
- **D01–D05 e B01–B05:** interfaces integradas na candidata. D05 inclui catálogo 14 categorias/61 subcategorias/67 SVGs, mas o QA final Windows e visual segue pendente.
- **Inteligência:** I2-A/B/C/D/E e investigação I3-01 em leitura pessoal autorizada, com camadas de evidência e revisão. B05 Hoje V6, Conversar V5 e Plano V5 usam dados verificáveis ou estados indisponíveis; projeção de caixa real do Pulso não deve ser inventada.
- **Contas/Pluggy:** o canal experimental é isolado e offline; a continuidade do perfil estável e do cofre só pode ser afirmada após QA em Electron Windows com dados **sintéticos**. Escrita financeira por IA pessoal permanece **bloqueada**.
- **Cloudflare/PWA:** código e testes próprios existem no repositório; migração/cutover pessoal e paridade final não estão aprovados como funcionalidade Windows 1.0.0.

Para estados exatos, use a [matriz funcional](docs/mf2/MATRIZ_FUNCIONAL_1_0_0.md), não este resumo.

## Desenvolvimento reproduzível (sem instalar a versão pessoal)

Requer **Node 22.23.4**, **npm 10.9.9**, Windows x64 para o teste GUI nativo e dependências instaláveis do lockfile. Para testes de código em ambiente **descartável**, na raiz do checkout correspondente ao SHA em validação:

```bash
node --version
npm --version
npm ci --no-audit --no-fund
npm run test:types
npm run test:db
node scripts/build-preload.cjs check
npm run test:asar
npm run provenance:create
npm run provenance:verify
```

`npm run compile` compila renderer/preload; `npm start` abre o Electron de desenvolvimento **somente** em ambiente isolado. O comando `npm run test:electron-smoke` requer ambiente gráfico isolado e grava evidências sintéticas. Nenhum comando de empacotamento está autorizado por este README.

**Empacotamento:** `dist:windows` é **experimental**, com appId e perfil segregados; `dist:windows:stable` é um fluxo separado, protegido por autorização e ainda **não homologado**. Não confundir os executáveis nem migrar dados pessoais entre perfis manualmente.

## Privacidade e segurança

O SQLite local e seus backups contêm dados financeiros **não criptografados em repouso pela aplicação**; use proteção do SO e cópias seguras. `pluggy-credentials.enc` usa proteção do Windows e **não é copiado** para o backup SQLite; dados bancários podem estar incompletos ou defasados. Leitura local exige grants e escopo, e a escrita supervisionada da IA em banco pessoal está desativada. Não suba extratos, tokens, bancos ou prints pessoais no GitHub, CI ou testes. Consulte o [guia seguro de dados](docs/mf2/DADOS_MIGRACAO.md).

**Instalação/atualização:** nenhuma atualização da versão pessoal para 1.0.0 deve ocorrer antes de QA Windows real, backup/restauração sintéticos, aprovação explícita e artefatos com hashes. O [plano de release](docs/mf2/PLANO_DE_RELEASE.md) descreve a sequência.
