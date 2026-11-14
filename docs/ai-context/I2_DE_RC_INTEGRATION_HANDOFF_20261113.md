# MF2 RC-ALL-01 — Handoff I2-D + I2-E (integração seletiva)

**Missão:** fechar o código existente, sem I2-F. **Responsável por aplicar à candidata:** Integrador (#71, PR #76). **Estado:** REVIEWED_STATICALLY / CONTRACT_SMOKE_PASS / NODE_SQLITE_NOT_RUN / NOT_HOMOLOGATED / NO_PERSONAL_WRITES.

## HEADs conferidos no GitHub
- **RC #76:** `integration/mf2-rc-all-01-i2a-20261113` / `545ac5e00199ad4969c69b76e433f17f242ad44e`.
- **I2-D #79:** `feat/mf2-i2d-proactive-category-advisor-20261113` / `fd5aca036ae96ca3aef99be752a2bfdeb9750688`.
- **I2-E #80:** `feat/mf2-i2e-category-reliability-20261113` / **ATUALIZAR A PARTIR DO HEAD DO PR ANTES DE IMPORTAR** (correções dirigidas publicadas nesta missão).
- **Design #57:** `09b8df8396529ea256445de5ee2108e1a0b2fbf2`. Taxonomia 14×61/67 SVGs aprovada, E1–E3 SQL/IPC/UI continuam pendentes na issue #74.

**Verificação concreta:** 11 blobs CJS compartilhados de I2-A/B/C em #76 e na árvore I2-E original têm SHA de conteúdo idêntico (entre outros `intelligence-context`, `intelligence-category-proposals/bridge/atomic/actions`, `intelligence-provider/orchestrator/tools`). Não copiar esses 11 módulos novamente.

## Importar somente as entregas exclusivas, sem merge cego #80→#76

**Runtime (exatamente 4 arquivos):**

| Origem | Arquivo |
|---|---|
| PR #79, SHA acima | `electron/intelligence-category-opportunities.cjs` |
| PR #79, SHA acima | `electron/intelligence-category-advisor-bridge.cjs` |
| PR #80, SHA final | `electron/intelligence-category-quality.cjs` |
| PR #80, SHA final | `electron/intelligence-category-quality-bridge.cjs` |

**Testes (exatamente 2 arquivos):**
`tests/intelligence-i2d.test.cjs` (#79, 25 testes) e `tests/intelligence-i2e.test.cjs` (#80, 23 testes após correções desta missão).

**Documentos opcionais:** `docs/ai-context/I2_D_PROACTIVE_CATEGORY_ADVISOR_20261113.md` (#79), `docs/ai-context/I2_E_EVIDENCE_QUALITY_20261113.md` (#80) e este handoff (#80).

Não importar/reescrever `electron/db.cjs`, `electron/financial-intelligence.cjs`, `electron/intelligence-category-rc.cjs` da árvore #80: a candidata #76 tem um gateway de RC próprio. Não alterar `src/*`, `app/*`, `electron/main.cjs` nem `electron/preload.cjs` pelo Executor de Inteligência.

## Montagem correta da cadeia em #76

A candidata já expõe `RCCategoryGateway.personal`, que é uma instância de `IntelligenceCategoryBridge` com `proposals: CategoryProposalService` e **SEM executor pessoal**. O Integrador deve compor **sobre essa mesma instância e a mesma conexão FinanceDB**:

```js
const base = rcCategoryGateway.personal;     // I2-C já existente na candidata
const proposals = base.proposals;             // único B1/IC-READ autorizado
const advisor = new ProactiveCategoryAdvisor({ proposals }); // I2-D
const advisory = new ProactiveCategoryBridge({ advisor, baseBridge: base });
const quality = new EvidenceQualityService({ advisor });     // I2-E
const safeBridge = new EvidenceQualityBridge({ quality, baseBridge: advisory });
rcCategoryGateway.personal = safeBridge;     // somente após revisão dos gates
```

**Atenção:** isso é contrato/handoff para o Integrador, não código já conectado. Uma nova instância de `CategoryProposalService` ou `LocalFinancialIntelligence` para D/E separaria grants e prévias e causaria inconsistências. O wrapper qualidade deve ser o único endpoint exposto para recomendações, e **não** um IPC paralelo que bypassa o Quality Gate.

**Mudanças exclusivas do Integrador necessárias na candidata:**

1. Ajustar allowlists fechadas de `RCCategoryGateway.PERSONAL` / `PERSONAL_FIELDS` e handlers `main/preload` para os cinco comandos: `qualityCapabilities`, `qualityScan`, `qualityDetail`, `qualityDraft`, `qualityCompose`. Novos campos estritos: `filters`, `qualityId`, `items`, `action` e `target` conforme o comando. Não permitir payload genérico/SQL.
2. `RCCategoryGateway.personalCall` atualmente chama a ponte com `{owner,environment:'personal',verifiedGesture:false}`, **sem `activeAccountId`**. O Integrador deve validar a conta selecionada no **MAIN** a partir da sessão autorizada e associar o ID bancário confiável ao host. Nunca obter `owner`, `activeAccountId`, ambiente ou confirmação diretamente do texto do modelo.
3. Conectar D01 conversação e D04 revisão com dados reais de `qualityScan`. Um `qualityDraft` só pode produzir **prévia B1**, não uma escrita. Exibir `status`, `reasons`, `qualityConfidence`, `coverage`, `anchorSummary`, `candidateSummary`, `duplicateWarnings`, `rulePrecedence`, `evidenceHash` e `advisoryProposal.proposal`. Mostrar `stale`, `review_required`, `denied`, `partial`, `unsupported` como estados próprios.
4. Não ligar as rotas I2-D não validadas diretamente ao renderer. **Defeito corrigido no PR #80:** `EvidenceQualityBridge` bloqueia `discover`, `inspectOpportunity`, `draftOpportunity` e `advice` legados que poderiam preparar propostas fora do Quality Gate. Usar `qualityScan/Detail/Draft/Compose` para o fluxo de recomendação; preservar B1 `propose` para pedidos explícitos independentes (ainda read-only), nunca para contornar sugestões I2-E.
5. `qualityCompose` devolve plano de até 3 prévias, **sem confirmação em cascata**. Respeitar dependências; confirmação e recibos verdadeiros só quando o Integrador implementar e homologar o novo gateway pessoal seguro.

## Contratos e segurança

- `I2-D/CATEGORY-OPPORTUNITIES-V1`, `I2-D/ADVISORY-PROPOSAL-V1`, `I2-D/ADVISORY-CHAT-V1`, `I2-D/ADVISORY-BRIDGE-V1`.
- `I2-E/EVIDENCE-QUALITY-V1`, `I2-E/QUALITY-DRAFT-V1`, `I2-E/COMPOSITE-PLAN-V1`, `I2-E/QUALITY-BRIDGE-V1`.
- Todos D/E são **read-only pessoal**; `qualityDraft` retorna `changesApplied:false`. Nunca forjar `confirmedBy` ou `receipt`.
- `qualityId` está ligado a owner/token/source/profile/month/conta, IDs e regras/evidências. A prévia recalcula os fatos antes de prosseguir. Em histórico parcial, PENDING, transfer/ignore, split, possíveis duplicatas, regra concorrente, ausência de dias independentes ou IDs stale: `review_required`/`stale`, sem proposta executável.
- As duas camadas tratam confidence como **heurística qualitativa** (não percentual probabilístico).
- A candidata #76 ainda nega `confirm` pessoal; esse bloqueio não pode ser removido por simples flag. A escrita pessoal requerida para o primeiro EXE depende do Integrador implementar **gateway específico e homologado**: autorização granular por owner/perfil/conta/período/ação, preview versão+IDs+valores+alvo D05, gesto humano nativo, revalidação transacional, COMMIT com recibo idempotente, rollback/recovery, backup/restore e testes SQLite real. O `AtomicSyntheticCategoryExecutor` não pode receber DB pessoal.

## D05 — bloqueios reais de compatibilidade

Contrato aprovado #74 usa `{categoryId, subcategoryId: string|null}`, pai/filho 14×61 e SVG com `iconKey`. B1/I2-D ainda falam `category` como nome plano; **"Delivery" é subcategoria de `cat:alimentacao` em D05**, não deve virar uma categoria-pai inventada ou ser inferida de texto do modelo.

**Defeito corrigido no PR #80:** se o banco tiver tabela `subcategories`, a I2-E detecta hierarquia ativa e bloqueia `draft/compose` legados até existir resolvedor/validador homologado de IDs pai/filho. Investigação pode continuar em `review_required`, mas não gerar ações com destino ambíguo. Isso evita corrupção sem antecipar a migração D05.

Após E1/E2 reais da issue #74, **Integrador/Executor D05** deve fornecer serviço canônico de resolução `categoryId + subcategoryId`, validação do vínculo pai-filho e escopo de perfil, migração/banco/backup e extensão da proposta B1/C2. Só então a camada I2-D/E poderá aceitar destino D05; nunca inferir filho por merchant nem converter registros legados automaticamente. **67 SVGs não fazem parte do backend I2-D/E**, sua incorporação na UI pertence à frente D05. A tela D05 inteira ainda requer aceite/QA próprio, distinto da taxonomia aprovada.

## Testes, evidências, ordem de CI

- **48 testes Node/SQLite versionados no total**: 25 I2-D e 23 I2-E (18 existentes + 5 novos de segurança/integração). **Ainda NÃO executados** no projeto completo/Node 22.23.4.
- **12/12 verificações V8 isoladas PASS após patches**, incluindo parser JS 3/3, bypass deny, owner, conta e D05. Isso não substitui SQLite/Electron.
- No CI do **SHA consolidado final publicado pelo Integrador**, executar `npm ci`, `npm run test:types`, `npm run test:db`, `npm run test:asar`, `npm run compile`, verificações F08/ASAR e QA Electron. `test:db` já varre `tests/*.test.cjs`; confirmar que as duas suítes foram coletadas.
- QA negativos obrigatórios na candidata: source/profile/grant/owner/conta/mês; sem exposições cross-account no catálogo; IDs duplicados ou ausentes; PENDING/POSTED, reversals, transfer/ignore, splits, 0 centavos/valor inválido, extrato de 2.500+; regras exact/starts/contains concorrentes; revalidação stale após mudança do SQLite, regra e status; duas alterações em sequência; D05 filho incompatível/missing/null; preview sem confirm; cancelamento da confirmação humana; falha entre mudança/recibo e recovery; nenhuma escrita pessoal sem autorização/homologação.
- Préflight **somente pelo proprietário no SHA consolidado informado pelo Integrador**, flags `run_preflight=true`, `run_windows_qa=false`, `run_windows_build=false`. Após Linux PASS e aprovação separada, Windows QA e build, mantendo o mesmo SHA; não usar automaticamente o HEAD isolado #80 como SHA de release.

## Entrega/ownership

I2-D/E foram preservadas e não há I2-F. As únicas correções desta missão foram **no PR #80**: bloquear rotas legadas sem Quality Gate, fail-closed quando detectar hierarquia D05 sem resolvedor e cinco testes negativos adicionais, além deste handoff. PR #79, PR #76, main, IPC, renderer, categorias e extratos pessoais não foram modificados.

**Ação seguinte do Integrador:** importar quatro módulos seletivamente, montar ponte de leitura usando os serviços B1/C2 já conectados, conciliar D05, implementar escrita pessoal somente mediante QA/contrato seguro e publicar um novo SHA candidato para CI do proprietário.
