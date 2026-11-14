# I2-D — Inteligência Proativa de Organização Financeira

**Base:** I2-C PR Draft #78 `42456554af7311bd85a925fe4633f10e715b6d82`. **PR I2-D:** Draft empilhado exclusivamente sobre #78. **Status:** CODE_DELIVERED / BACKEND_ISOLATED / PERSONAL_WRITES_DISABLED / NODE_SQLITE_NOT_RUN / NOT_HOMOLOGATED.

## Implementado

### D1 — Investigações baseadas em fatos

`electron/intelligence-category-opportunities.cjs` implementa `ProactiveCategoryAdvisor` somente leitura. Ele usa a autorização IC-READ da I2-B (`CategoryProposalService.authorize`) em **cada** entrada e reutiliza `FinanceDB.listCategories()`, `FinanceDB.bankOverview()` e `matchRule()` canônico. Não há ledger alternativo, gravação, SQL livre, modelo externo ou segundo cadastro de categoria.

1. **Nomes similares:** comparação normalizada sem acentos/caixa e distância de edição máxima de 2 para nomes com comprimento mínimo. Resultado `normalized_equal` ou `spelling_similar`. Nunca assume equivalência semântica, fusão ou exclusão.
2. **Sem referências explícitas:** usa o catálogo/uso real da I2-B; o resultado recebe `review_only`, sem exclusão automática. Classificação implícita, itens não carregados e outras dependências podem existir.
3. **Inconsistências de tipo:** `classificationIssues` detecta incompatibilidade documentada entre `income/expense` e tipo `income/expense/both` da categoria, nos registros locais e no mês autorizado. Para banco utiliza somente override manual explícito; para fonte manual é análise de anomalia, **não treinamento** de preferência. IDs e centavos são factuais.
4. **Padrões bancários:** somente descrições exatas após normalização e contas/naturezas separadas. `specific()` do `CategoryReviewService` rejeita descrições genéricas; `Outros` não é rótulo de treinamento. Âncoras: pelo menos 2 classificações manuais explícitas, consistentes, POSTED, sem split, vínculo manual, status transfer/ignore ou revisão desatualizada. A tabela existente `category_review_applied_labels` é consultada para **excluir rótulos aplicados pela própria revisão supervisionada**; o identificador accountId/externalId é uma tupla não ambígua. Ninguém aprende com categoria automática/provider ou com o próprio resultado anterior como se fosse correção humana.
5. **Confiança:** `medium` = 2 evidências manuais concordantes; `high` = 3 ou mais; conflito de rótulos gera `manual_review_required` e **não** escolhe arbitrariamente. Confiança é consistência da amostra, não percentual probabilístico calibrado.
6. **Candidatas históricas:** banco `categorySource=bank`, POSTED, mesma conta/natureza/descrição/período, sem split/link/revisão stale. Valores em centavos e IDs reais accountId:externalId. Proposta por B1 usa `transaction.categorize` com **IDs explícitos**, máximo 100 e somente se `bankOverview.truncated=false` e sem conflito de precedência; não executa.
7. **Regras futuras:** permite **proposta** por B1 `rule.create` com `matchMode=exact`, `accountId`, `nature`, `futureOnly:true`, `scope=bank`, sem tocar histórico. Usa `matchRule` para revelar regras existentes e precedência; em conflito bloqueia, sem mudar regras. No banco pessoal sem o mecanismo sintético de constraints, B1 pode retornar `blocked` honestamente.
8. **Staleness:** IDs das oportunidades são hashes vinculados a owner/grant/fonte/perfil/mês e fingerprint das evidências + IDs + regras. Refaz a investigação antes de preparar uma proposta; qualquer mudança de evidência, status, conta, regra, seleção, concessão ou escopo invalida o ID. Horário de leitura `asOf` não integra identidade para evitar falso stale.
9. **Cobertura:** `bankOverview()` carrega até 2.500 registros; quando `truncated`, reporta `partial_local` e bloqueia propostas de reclassificação em massa baseadas nessa lista. Não interpreta número carregado como total histórico certificado.

### D2 — Conversa e ponte para D01/D04

`electron/intelligence-category-advisor-bridge.cjs` contém `ProactiveCategoryConversation` e `ProactiveCategoryBridge`, ambos sem registro de IPC. Reutiliza `ConversationContextStore` da I2-A, o serviço de propostas B1 e `IntelligenceCategoryBridge` da I2-C.

Comandos permitidos: `advisorCapabilities`, `discover`, `inspectOpportunity`, `draftOpportunity`, `advice` e delegação controlada dos comandos já autorizados pela I2-C. Follow-ups lembram os IDs da última investigação, como “regra futura para a primeira sugestão” ou “reclassifique a primeira sugestão”. Se há várias sugestões e não há ID/ordinal, pede esclarecimento em vez de escolher.

`draftOpportunity` exige que `trustedHostContext.activeAccountId` coincida com a conta factual do padrão. `advice` exige a mesma condição antes de armar qualquer proposta sintética; não aceita owner ou gesto fornecido pela LLM. Para testes sintéticos, uma proposta pronta só é armada pelo `AtomicSyntheticCategoryExecutor` da I2-C. O adaptador não executa operações: confirmação e recibos continuam nos mecanismos C1/C2.

**Contratos:** `I2-D/CATEGORY-OPPORTUNITIES-V1`, `I2-D/ADVISORY-PROPOSAL-V1`, `I2-D/ADVISORY-CHAT-V1`, `I2-D/ADVISORY-BRIDGE-V1`. Campos relevantes: `opportunityId`, `source`, `profile`, `month`, `accountId`, `nature`, `pattern`, `category`, `confidence`, `manualExamples`, `candidateExamples`, `loadedCandidateCount`, `loadedCandidateAmountCents`, `precedence.matchedRules`, `coverage`, `expiresAt`, `changesApplied:false`, `modelCalled:false`, além do envelope da I2-C.

### D05 — extensão sem antecipar SQL

Conforme issue #74 e comentário #49, **o catálogo visual das 14 categorias e 61 subcategorias está DESIGN_APPROVED**, mas a persistência, FK, IDs e IPC de E1/E2/E3 ainda não foram implementados. `advisorCapabilities` explicita esse estado, `subcategoryWrites:false`, `schemaVersion:null`. Alvos `{categoryId,subcategoryId}` são bloqueados pelo `taxonomyGate()` da I2-C, inclusive `subcategoryId:null`. Não houve migração, reclassificação automática para filhos, inventário definitivo de IDs no SQLite nem alteração em `electron/db.cjs`.

## Segurança e limitações explícitas

- Nenhum write pessoal autorizado, apesar de existirem métodos manuais FinanceDB; nenhuma chamada direta a IPC, `main.cjs`, `preload.cjs`, renderer, CSS, Worker/Cloudflare ou API paga.
- IDs de oportunidade não são autorização. Toda proposta é revalidada via IC-READ e B1; execução exige serviço sintético C1 com confirmação humana independente.
- Um padrão de estabelecimento exige **mesma descrição normalizada exata**; apelidos/nomes heterogêneos ainda não são unificados sem revisão. Não criar regras genéricas Pix/TED.
- Similaridade textual não comprova categoria redundante, sem uso não comprova elegibilidade para exclusão e consistência das correções não comprova causalidade.
- Follow-ups conversacionais são roteamento conservador, sem modelo generativo; pedidos compostos avançados permanecem sob validação/etapas B1-C2. Nada é executado em segundo plano.
- Na fonte manual, não há flag de origem de correção suficiente para treinar sugestões bancárias; somente catálogo e incompatibilidades são apresentados.

## Testes e QA

**25 testes Node/SQLite versionados** em `tests/intelligence-i2d.test.cjs`, cobrindo evidência manual, contas, conflitos, regras, comparação de nomes, sem uso, anomalias de tipo, exclusão de PENDING/transfer/splits, mudanças e token/owner/mês, histórico parcial, continuidade conversacional, bridge, limitação D05, rejeição de Outros e asOf estável. **NOT_RUN no runner oficial**; `npm run test:db` inclui o novo arquivo pelo glob `tests/*.test.cjs`.

**Smoke V8 isolado com módulos I2-D reais e dublês para DB/IC-READ:** 8/8 verificações PASS (padrão, dois anchors, contagem em centavos, nomes similares, proposta histórica, proposta futura, stale após dados alterados, conflito de regras). Este smoke não executa FinanceDB real. **Parser CJS** dos três novos arquivos PASS, incl. testes. **NOT_RUN:** npm ci, test:types, test:db/Node SQLite, compile, F08/proveniência, ASAR, Electron, Windows.

## Sequência, ownership e continuidade

1. **PR #75 congelado** no SHA `4dc638650671712cbc1290f5814341edc8fea5b2` aguarda preflight Linux do proprietário. Se falhar, corrigir no #75 e reempilhar a cadeia na ordem.
2. **PR #78** permanece Draft no SHA base `42456554af7311bd85a925fe4633f10e715b6d82`. O preflight I2-C vem após estabilização I2-B.
3. **I2-D** ganha PR Draft próprio sobre #78; somente módulos backend novos, testes e docs. Preflight Linux para esta branch somente após sincronização de bases e autorização do proprietário.
4. **Integrador #65/#71** deve revisar contrato com D01/D04 e admitir adaptador de leitura separadamente; não incluir escrita I2-B/C/D ou novas subcategorias no EXE RC-ALL-01 sem homologação e liberação específica.
5. **Próxima frente proposta I2-E:** qualidade de evidência, regras concorrentes e explicabilidade de sugestões com fixtures grandes/cross-profile e integridade de previsão. Não mudar UI/IPC/SQL compartilhado até coordenação #49. D05 IA depende da implementação de schema E1/E2 real pela frente responsável.

**Não disparar preflight CircleCI, Windows build/QA, merge ou produção por este executor.**