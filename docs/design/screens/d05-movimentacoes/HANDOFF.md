# D05 V1.3 — HANDOFF FINAL PARA O NOVO EXECUTOR

**Decisão: DESIGN_APPROVED / IMPLEMENTATION_READY em 13/11/2026.** Obrigatória no primeiro EXE Windows experimental. Implementação e QA continuam pendentes; issue #74 ABERTA e bloqueante.

## Referências canônicas, em ordem
1. [Protótipo aprovado de tela inteira](prototype.html) — fonte visual e interativa.
2. [Design Spec](DESIGN_SPEC_APPROVED.md), [Behavior Spec](BEHAVIOR_SPEC.md), [Tokens](TOKENS.json), [Fixtures](FIXTURES.json) e [Acceptance](ACCEPTANCE.md).
3. [Taxonomia 14×61](SUBCATEGORY_TAXONOMY_V1.json) e [67 SVGs](SUBCATEGORY_SVG_REGISTRY_V1.json): **CONGELADOS**, não redesenhar. [Contrato SQLite/IPC](SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md) e [relatório de bugs/riscos](BUG_REPORT_AND_IMPLEMENTATION_GATES.md).
4. [PR #76, RC de integração](https://github.com/JoaoVittorLi/meu-financeiro/pull/76); [coordenação #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49); [D05 engenharia #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74).

**Branch candidata de integração consultada:** integration/mf2-rc-all-01-i2a-20261113, HEAD histórico 545ac5e00199ad4969c69b76e433f17f242ad44e. **Conferir HEAD ATUAL antes de começar** e obter ownership do Integrador. A base da PR documental #57 é anterior e NÃO é base de implementação de código.

## Arquivos reais consultados na RC
- src/app.ts: renderMovements() e renderTransactions(), além de renderer de categorias; reconciliar com UI já presente, sem reintroduzir outro aplicativo/iframe.
- app/operations.css, app/movements-productivity.css e app/design-system.css: aplicar tokens premium aprovados e corrigir contraste.
- electron/db.cjs: category_rules, bank_category_overrides, bank_transaction_splits e schema legado referenciando categoria por nome; migrations com cuidado com FK/renomeação.
- electron/main.cjs, electron/preload.cjs: IPCs existentes categories:save, bank:categorize, bank:batch; estender APIs tipadas e MAIN seguro, sem SQL no renderer.
- Integração com D01–D04, I2-A/B/C e permissões: coordenar src/intelligence* e electron/category-review.cjs; não sobrescrever contratos recentes.
- package.json na PR #76: npm run compile, npm run test:types, npm run test:db, npm run test:asar, npm run test:electron-smoke, npm run provenance:create e provenance:verify. Não executar dist:windows sem autorização.

## Execução obrigatória em checkpoints
**E1 — SQLite / persistência:** primeiro backup verificável; migration aditiva transacional e idempotente; IDs de pais e filhos e FK; filho null para cada registro legado; vínculos bancos/manual/splits/regras/planning, preservando orçamento pai sem duplicar. Renomear pai/filho preserva ID; reclassificar histórico legado automaticamente é proibido. Testar sobre >=630 registros sintéticos com dois perfis, backup/rollback/restart/restore.

**E2 — Serviços / contratos:** CRUD categoria e filhos com validações no MAIN; category target tipado com categoryId e subcategoryId opcional; banco override sem modificar fonte Pluggy; revisão por ID+revision com POSTED gate; transações em lote atômicas com IDs/fingerprint/version. Regras e IA propõem alterações apenas mediante escopo, prévia exata dos afetados e reconfirmação; nenhuma escrita pessoal automática.

**E3 — Interface premium:** reproduzir o protótipo aprovado em componentes reais do Electron, inclusive quatro métricas, filtros, título forte do merchant, cor correta, selection circle, switch Agrupar por dia, clique no próprio ícone SVG para picker pai→filho, ponto azul de conferência e popover, PENDING clock, detalhes, manual/import, confirmação de categoria e lote. Sem checkbox de SO, sem texto Revisar nas linhas, sem Confirmada+A conferir empilhados, sem contador por dia. Dark/light, foco, Escape, scroll, 1366×768 e 1920×1080.

## Invariantes de finanças e autorização
- Somar somente registros no escopo, excluir PENDING e transferências/ignorados de E/S, não chamar resultado de saldo bancário.
- A fila A conferir só inclui banco POSTED não revisado; PENDING é independente e não pode gerar falso sucesso de revisão.
- Sempre manter parentId consistente com subcategoryId; filho ausente é null, não criar filho fictício.
- Lote requer affected IDs + antes/depois + segundo aceite, revalidação e commit atômico; never allow stale selection to silently apply.
- IA pessoal com IC-READ não autoriza escrita; mudanças em regra exigem consentimento e reconfirmação e recibo somente após commit real.

## Entrega final ao Integrador
Novo PR Draft de código com branch e HEAD SHA reais. Informar separadamente: E1 PASS/FAIL/NOT_RUN, E2, E3; CODE_PRESENT, UI_CONNECTED, TESTED, PERSONAL_WRITE_DISABLED; migração/backup/restore, fixture 630+, screenshots Electron dark/light, TypeScript, Node/SQLite, F08/ASAR, pendências e tradeoffs. Integrador decide entrada na candidata #76 e ordem dos gates; proprietário executa CircleCI. Não fechar #74 apenas com documentação ou mock.

**Não fazer merge em main nem build instalador por conta própria.**
