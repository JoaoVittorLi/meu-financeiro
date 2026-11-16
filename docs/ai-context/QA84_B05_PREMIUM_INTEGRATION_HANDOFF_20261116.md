# QA-84 — B05 Intelligence Premium — handoff de implementação (16/11/2026)

**Status:** CODE_PUBLISHED / ISOLATED_CHECKS_PASS / OFFICIAL_QA_NOT_RUN / WINDOWS_NOT_HOMOLOGATED / NO_GO_EXE.

- **Branch exclusiva:** `feat/mf2-qa84-b05-intelligence-premium-20261116`
- **Base imutável observada:** PR #88, SHA `200aafb6f8000e7d6c1dad221a63482356ee4510`
- **Base de release preservada:** PR #76, SHA `1bc1b89bf5bdefc0196b0851e690a99f825ca85a`
- **Handoff canônico do Designer:** [B05 Aprovada](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/handoffs/QA_EXE_B05_INTELLIGENCE_APPROVED_V6_20261116.md)
- **Outros contratos:** [Mapa](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/handoffs/B05_INTELLIGENCE_IMPLEMENTATION_MAP_V6.md), [Motion](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/handoffs/B05_INTELLIGENCE_MOTION_SPEC_V6.md), [Aceite 40](https://github.com/JoaoVittorLi/meu-financeiro/blob/design/mf2-screen-by-screen-20261113/docs/design/handoffs/B05_INTELLIGENCE_ACCEPTANCE_V6.md).

## Entregas R1–R5

| Fatia | Código implantado | Restrição honesta |
|---|---|---|
| R1 — navegação | `mfB05Tabs` visível Hoje/Conversar/Plano; mount dedicado, Settings avançadas, permission CTA; mantém IDs `today/chat/actions`. | Smoke Electron e edição concorrente não verificados |
| R2 — Hoje V6 | Hero neutro, anel segmentado, timeline em degraus, seleção única, drawers com evidências, cenário local reversível, Alimentação e Delivery com D05; resolvedor puro em centavos. | O IPC atual `IC-v1/I-P0.1` **não fornece saldo disponível + futuros datados no mesmo escopo**; UI pessoal mostra estado indisponível em vez de projetar dados falsos. Projeção completa apenas com input sintético explicitamente verificado de QA |
| R3 — Conversar V5 | Chat protagonista, histórico recolhido em drawer, nova conversa, composer e D01/D02 preservados, prompts contextuais de sinais autorizados. | Persistência, streaming, IME, revoke e acessibilidade em Electron não homologados |
| R4 — Plano V5 | Foco a partir de `mfD03Signals` elegíveis, alternativas, Entender→Simular→Revisar, órbita de orçamento com slider local; propostas D04/I2 sem novo motor. | Fluxo Vivo de caixa real, reserva e redução Delivery dependem de fatos/capabilities ainda indisponíveis; nenhum Apply pessoal novo |
| R5 — Motion e QA | CSS isolado, durações de transições, tema claro/escuro, responsividade, media query reduced motion, 16 testes Node versionados e fixture oficial no PR. | Animação de valores numéricos, movimento sincronizado de 20 interações, preferência in-app, capturas do Electron e gates oficiais pendentes |

## Arquivos de produção e testes

- `src/intelligence-b05-finance.ts` — projeção pura, dedupe, cobertura, compromisso, orçamento e comparação em integer cents.
- `src/intelligence-b05-motion.ts` — tabs acessíveis, render principal B05, drawer keyboard, navegação sem recarregar app.
- `src/intelligence-b05-today.ts` — Pulso V6; apresentação real apenas de fatos autorizados; projeção composta quando fornecida fonte verificada compatível.
- `src/intelligence-b05-chat.ts` — layout V5 reusando as threads e o composer originais.
- `src/intelligence-b05-actions.ts` — Plano V5 supervisionado, orçamento hipotético sem gravação.
- `app/intelligence-b05.css`, `app/index.html` — CSS scoped e carregamento.
- `src/intelligence-view.ts` — roteamento B05 com compatibilidade legada, followups contextuais e controles técnicos em Configurações.
- `tsconfig.json` — módulo `none`, cinco arquivos adicionados depois de intelligence-view; nenhum motor financeiro substituído.
- `tests/qa84-b05.test.cjs` — **16 testes versionados, NOT_RUN sob Node**.
- `docs/design/handoffs/B05_INTELLIGENCE_FIXTURES_V6.json` — cópia exata da fixture sintética do Designer no PR.

**Arquivos deliberadamente preservados:** `src/app.ts`, `src/d05-movements.ts`, `electron/main.cjs`, `electron/preload.cjs`, `electron/db.cjs`, módulos IPC de IC-READ/REVIEW/LLM, SQLite/migrations, contratos B01–B04.

## Execução efetiva, não inferida

**PASS na verificação isolada V8:** 13 cenários codificados executados sobre o conteúdo versionado dos módulos, mais checagens posteriores de slider reversível Hoje e sinais Alimentação/Delivery. Parser JavaScript dos novos módulos e arquivo de testes: PASS (conforme verificação isolada). Não equivale a execução do `node --test`, `tsc` ou Electron.

**NOT_RUN:** `npm ci --no-audit --no-fund`, `npm run test:types`, `npm run test:db`, `npm run test:asar`, `npm run provenance:create`, `npm run provenance:verify`, `node scripts/build-preload.cjs check`, smoke Electron Windows e screenshots. Sem checkout integral e sem Node 22.23.4/npm 10.9.9 no ambiente desta etapa. **Não disparar CircleCI pago nem build Windows sem autorização.**

## Matriz B05-01…B05-40

A palavra PASS nesta matriz refere-se **somente** à lógica ou renderização executada em V8 isolado, identificada na evidência. **NÃO é PASS de aceite Windows nem homologação completa.** Para a homologação de cada cenário, repetir com Node/Electron conforme a coluna de evidência.

| ID | Estado parcial/isolado | Evidência ou pendência |
|---|---|---|
| B05-01 | PASS | V8: 3 tabs today/chat/actions; sem Electron |
| B05-02 | NOT_RUN | Nenhum adaptador de saldo/agenda composto IC-READ disponível |
| B05-03 | PASS | Fixture sintética: 170000 cents |
| B05-04 | PASS | Fixture sintética: 158100 cents |
| B05-05 | PASS | Fixture sintética: 143600 cents |
| B05-06 | PASS | Fixture sintética: 125700 cents |
| B05-07 | PASS | Fixture sintética: reserva 12850 cents |
| B05-08 | PASS | V8: seleção repetida e estado final coerente; sem animação real |
| B05-09 | NOT_RUN | Drawer abre em V8; focus trap/return/Escape em Electron não executados |
| B05-10 | PASS | V8: slider de cenário 1700→1800, saldo final 1357, restauração 1257; sem IPC |
| B05-11 | PASS | V8: −14300 cents; anel triplo bloqueado |
| B05-12 | PASS | V8: margem ausente não produz anel/termo reserva |
| B05-13 | PASS | V8: ID repetido deduplicado; IDs divergentes rejeitados |
| B05-14 | PASS | V8: POSTED excluído do abatimento futuro |
| B05-15 | PASS | V8: renda datada impede decomposição incompatível; renda sem datas rejeitada |
| B05-16 | PASS | V8: Alimentação 760/700, excesso 60 e visual de categoria ligado ao resolver; D05 real pendente |
| B05-17 | PASS | V8: limite 0 produz percentual indisponível; sem divisão por zero |
| B05-18 | PASS | V8: Delivery 340−230 = 110 / 47,8%, período equivalente e barras |
| B05-19 | PASS | V8: base anterior zero remove percentual; períodos desiguais bloqueados |
| B05-20 | NOT_RUN | Função pura bloqueia parcial; fluxo real grant parcial não homologado |
| B05-21 | NOT_RUN | Bloqueio lógico e ausência de projeção real; invalidação de todo cache ao revogar exige Electron |
| B05-22 | PASS | V8: chat protagonista, histórico fechado, composer existente |
| B05-23 | NOT_RUN | Drawer abre V8; persistência real/thread selection no Electron não executados |
| B05-24 | NOT_RUN | Regressão de mensagem assíncrona e grant revogado em Electron |
| B05-25 | NOT_RUN | Followups contextuais versionados, sem execução Node/serviço real |
| B05-26 | NOT_RUN | Foco/alternativas implementados para sinais reais; Fluxo Vivo caixa requer contrato composto |
| B05-27 | PASS | V8: etapas Entender→Simular→Revisar + slider sem ação bancária |
| B05-28 | NOT_RUN | Limite simulado não grava; redução de Delivery sem capability de simulação pessoal |
| B05-29 | NOT_RUN | Central D04 preservada, nenhuma escrita pessoal habilitada; fluxo real não testado |
| B05-30 | NOT_RUN | Assinatura de contexto em simulação, previewVersion D04 não revalidado no Electron |
| B05-31 | NOT_RUN | Navegação V8 aprovada; histórico, grant e IA real sem regressão operacional |
| B05-32 | NOT_RUN | CSS dark/light incluído; comparação visual não executada |
| B05-33 | NOT_RUN | Screenshots Electron 1366×768 e 1920×1080 não obtidos |
| B05-34 | NOT_RUN | Zoom 125/150/200% e responsividade Electron não verificados |
| B05-35 | NOT_RUN | CSS prefers-reduced-motion implementado; preferência in-app/QA não homologadas |
| B05-36 | NOT_RUN | Última seleção V8; 20 alterações sob animação Electron não executadas |
| B05-37 | NOT_RUN | Tabs, aria e trap versionados; leitor de tela/foco real não executados |
| B05-38 | NOT_RUN | Motor chat existente preservado; offline/timeout real não executado |
| B05-39 | NOT_RUN | PR #88 não sofreu edições B01–B04; smoke regressivo ainda pendente |
| B05-40 | NOT_RUN | npm/tsc/SQLite/ASAR/preload/proveniência/Electron/Windows ainda não executados |

## Segurança e fronteiras

1. Nenhum novo método de IPC, endpoint, grant, token ou consentimento.
2. Nenhum `bankCategorize`, `bankBatch`, `bankSplit`, `planEdit` ou `categoryReviewConfirm` foi conectado por B05 a ações pessoais.
3. Saldo líquido do período **nunca** é usado como caixa disponível.
4. POSTED não é abatido como compromisso futuro; IDs repetidos contam uma vez; renda exige data; ausência de buffer/insuficiência proíbe anel falsamente reconciliado.
5. Alterações de slider são estado de **simulação** e ficam vinculadas à assinatura de fonte/período. Não há escrita SQLite.
6. Ações D04 existentes permanecem no caminho supervisionado atual, sem alteração de sua autoridade.
7. A B05 **não** implementa as novas capacidades I3-00: enviar CONTRACT-CHANGE formal à issue #49 antes de qualquer integração IC nova.

## Bloqueios reais e sequência do Integrador

**B1 — Gate TypeScript:** checkout em Node 22.23.4/npm 10.9.9; rodar `npm ci`, `npm run test:types` e corrigir até PASS; o staging PR #88 ainda não foi homologado.

**B2 — Node finance/IC regressivo:** `npm run test:db`, `node --test tests/qa84-b05.test.cjs`, `npm run test:asar`, `provenance:create/verify` e preload. Nenhum status PASS deve ser herdado de outro SHA.

**B3 — Feature gap IC-READ:** criar proposta `CONTRACT-CHANGE PROPOSED` na #49 para um snapshot de saldo disponível/compromissos datados/renda/margem verificados antes de habilitar o anel e o Fluxo Vivo pessoais. Não inventar finance API no front-end.

**B4 — Electron visual/UX:** capturas `B05-TODAY-1366-DARK.png`, `B05-TODAY-1920-LIGHT.png`, marcos 21/28, sliders, partial/none, Conversar drawer, Plano/revisão, normal/reduced motion, 125/150/200% e teclado.

**B5 — Integração:** Integrador deve revisar B05 PR contra staging #88, corrigir TypeScript/QA real, e somente então considerar QA Windows e nova beta, com autorização prévia do proprietário. #74/#84 abertas, nenhuma merge na main.

**Conclusão:** B05 publicada para revisão técnica, **não concluída para homologação**. A lacuna de projeção pessoal e os gates reais são bloqueios explícitos, não dados sintéticos disfarçados.
