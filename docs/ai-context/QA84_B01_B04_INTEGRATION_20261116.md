# QA-84 B01–B04 — integração controlada 2026-11-16

Base PR #76 `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`; B01 V3/B02 V7 PR #85 `155911e58766be25d622ef7e979a00af1f944c24`; B03 V2/B04 V2 canônico PR #86 `5fbe45c73dc0b101774749fe769c35133dbf7c7b`. Nenhuma alteração em main.

## Decisão #86 vs #87

O #86 foi escolhido por incluir o mesmo seletor D05 para lista/gaveta, prévia pessoal somente-leitura, reconfirmação manual em demo, fingerprints e verificação de snapshot em lote. O #87 permanece alternativa, sem merge duplo. Aproveitadas duas melhorias de interação do #87: não descartar o overlay por scroll e reservar Escape/Tab ao overlay acima do drawer.

## Resolução dos conflitos

Aplicação por edições de linha sobre a base comum, não substituição integral: em `src/app.ts`, todas as mudanças de #85 e #86 eram disjuntas; em `src/d05-movements.ts`, retida a chamada `resolveCategoryVisualIdentity` e `CategoryVisualGlyph` de #85 e adicionados fluxos B03/B04 de #86; em `tsconfig.json`, preservados Overview/Budgets e adicionado bridge antes do App. Bridge modificado para chamar o resolvedor canônico direto, sem fallback paralelo. CSS, teste Node e handoff de #86 incorporados. Todos os componentes/arquivos de #85 permanecem.

## GATE

`CODE_INTEGRATED / CI_NOT_RUN / WINDOWS_QA_NOT_RUN / NOT_HOMOLOGATED`. O ambiente desta integração acessa GitHub pelo conector, sem checkout completo nem Node22.23.4 oficial; não foi executado `npm ci`, `test:types`, `test:db`, `test:asar`, F08, smoke Electron ou CircleCI. Executar testes antes de qualquer versão beta. Preservados MAIN/preload/SQLite/finance engine/Electron45 da base, sem liberação de escrita pessoal `approvedForPersonal:()=>false`. #74 e #84 abertas. Sem permissão para CircleCI pago, merge na main, dados pessoais ou EXE.

## Próxima validação

Node22.23.4/npm10.9.9: `npm ci --no-audit --no-fund`, `npm run test:types`, `npm run test:db`, `npm run test:asar`, `npm run provenance:create`, `npm run provenance:verify`, `node scripts/build-preload.cjs check`, `node --test tests/qa84-b01-b02.test.cjs tests/qa84-b03-b04.test.cjs`, seguidos de QA Electron 1366×768/1920×1080 dark/light/zoom 125%/150%. A execução e correção de falhas são bloqueantes antes de homologação.
