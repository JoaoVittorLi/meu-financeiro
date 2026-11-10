# Meu Financeiro — Inteligência E4.1: Contexto Financeiro Fictício e Determinístico

**Base:** `feat/inteligencia-e3-contexto-memoria-uso`, commit `557ebf140b160439e7a9623ef9cd5bd654205f09`.
**Branch:** `feat/inteligencia-e4-contexto-financeiro-sintetico`.
**Versão candidata:** `0.9.5-beta.3` (Windows e PWA).
**Estado:** implementação submetida ao GitHub; validação integral CircleCI e instalação Windows **pendentes**.

## Objetivo e limite

E4.1 é o primeiro estágio de E4. Desenvolver um contexto financeiro resumido, fonte-específico, explicável e reutilizável pelas duas plataformas, **sem acessar registros financeiros reais nem chamar o GPT**. A E4.1 *não* implementa análise de extratos reais, autorização de leitura pela IA, conversa livre, sincronização de memórias ou cutover da nuvem. Todos esses passos ficam subordinados à homologação de identidade/cutover da frente Cloudflare.

## Implementação

- `shared/ai-financial-context.mjs`: **mesmo motor financeiro** `aggregateFinancePeriod` e `budgetProgress` de `shared/finance-period-ledger.mjs`. Não cria nova fórmula contábil.
- Cenário estático e explicitamente fictício de novembro/2026, com dados de banco ou manuais **selecionados separadamente**. Rejeita `both`, `real`, dados externos e parâmetros não autorizados.
- Banco fictício: receitas R$ 3.000,00; despesas R$ 1.850,00; diferença R$ 1.150,00 (**não é saldo**); 4 lançamentos incluídos, uma transferência própria e um lançamento pendente excluídos.
- Manual fictício: receitas R$ 2.700,00; despesas R$ 1.500,00; diferença R$ 1.200,00 (**não é saldo**). Nunca misturar com banco.
- Orçamentos fictícios: Moradia R$ 1.100,00 de R$ 1.000,00 (110%); Alimentação R$ 600,00 de R$ 500,00 (120%) no exemplo bancário; Transporte R$ 150,00 de R$ 300,00 (50%).
- Compromissos fictícios: R$ 950,00 a pagar confirmados; R$ 280,00 de entrada futura confirmada; R$ 700,00 de receita futura **incerta**; compromissos cancelados/quitados excluídos. Entradas futuras não entram em receitas já recebidas e não se calcula saldo disponível.
- Retorno contém agregações em **centavos inteiros**, quantidade de linhas consideradas/excluídas, cobertura de categorias, avisos de integridade e um `contextText` compacto para inspeção. **Não** contém contas, IDs, transações individuais, descrições bancárias ou qualquer segredo.
- Metadados sempre deixam `realFinancialDataIncluded:false`, `bankDataIncluded:false`, `inferenceCalled:false`, `changesApplied:false`, `financialSyncEnabled:false`, `cloudCutoverAllowed:false`, `balanceVerified:false`, `forecastVerified:false`.
- Windows Electron: IPC `ai:financial-context-demo` aceita somente fonte `bank` ou `manual`, sempre verifica `requireAppSender`, não toca `db`, `planner` ou tokens. Renderer lê por `aiFinancialContextDemo` e exibe resultados apenas após clique.
- PWA Cloudflare Preview: `GET /api/ai/financial-context-demo?source=bank|manual` exige **sessão existente, `personalQuarantineAllowed` e `authorizeAccess`**. Sem permissões, responde 401/403; apenas conteúdo fictício é retornado.
- O PWA usa `textContent` para exibir valores/contexto, nunca `innerHTML` ou HTML do modelo.

## Segurança e escopo não negociáveis

1. Não liberar acesso ao SQLite real a partir do assistente. O código novo não consulta dados bancários.
2. Não enviar dados financeiros reais, memórias ou prompts livres à OpenAI nesta entrega; GPT-6.1 Sol continua reservado aos três casos fictícios E2/E3 aprovados pelo usuário.
3. Não habilitar `FINANCE_SYNC_ENABLED`, `FINANCIAL_SCHEMA_ACTIVE`, migração ou escrita remota; não alterar nem destruir dados financeiros locais.
4. Não inferir saldo disponível, cobertura integral de extrato, capacidade de pagar, rentabilidade ou datas de saldo a partir da diferença de entradas/saídas.
5. Não somar bancos e manuais por padrão. Receitas futuras incertas não são dinheiro realizado.
6. Não instalar por cima sem backup testado; versão candidata só é homologada após suíte completa e revisão dos dados originais.
7. O PWA não recebe tokens OAuth de ChatGPT nem executa inferência.
8. Não transformar resumos de demonstração em sugestões aplicadas às finanças.

## Testes adicionados

- `tests/ai-e4.test.cjs` (4 grupos): período/sources, exclusões, orçamento, compromissos, privacidade, determinismo, IPC e dependência no motor compartilhado.
- `mobile-push/test/ai-financial-context.test.js` (3 grupos): mesma prévia, proibição sem sessão/Access, cliente PWA sem segredos nem OpenAI.
- Revisar **todas** as regressões já presentes: E1 Windows × Cloudflare, fluxo de planejamento, contratos de compilação, memória E3 e motor de orçamento.

## CircleCI: bloqueio de segurança de build

`.circleci/config.yml` mantém parâmetro `run_windows_build` com padrão `false`. Ao ativá-lo manualmente, executa primeiro o job **`preflight_linux`**:

1. Instalar dependências sem baixar binário Electron desnecessário;
2. `npm run test:types` (TypeScript);
3. `npm run test:db` (suite desktop, incluindo E1/E3/E4);
4. `cd mobile-push && npm install && npm test`;
5. `npx wrangler deploy --dry-run` (apenas compilação do Worker, **sem deploy**).

O job **`build_windows`** só começa se o preflight estiver verde. Compilará o instalador e portátil NSIS/Windows. Esperados:
- `MeuFinanceiro-Instalador-0.9.5-beta.3-x64.exe`
- `MeuFinanceiro-Portable-0.9.5-beta.3-x64.exe`
- `SHA256.txt`.

**Não existe instalador confirmado dessa versão no momento da escrita.**

## Homologação manual

- [ ] Confirmar `preflight_linux` verde, seguido por `build_windows` verde, ambos no **mesmo commit**.
- [ ] Fazer backup de SQLite e manter o instalador anterior guardado.
- [ ] Instalar Windows e abrir **Inteligência → Conversar → Entrega 4.1**.
- [ ] Gerar prévia **Banco fictício**: receitas R$ 3.000,00, despesas R$ 1.850,00, diferença R$ 1.150,00.
- [ ] Selecionar **Manual fictício**: receitas R$ 2.700,00, despesas R$ 1.500,00.
- [ ] Conferir orçamentos, compromissos futuros, avisos, e `Inspecionar contexto (não enviado)`.
- [ ] Confirmar que o contador de tokens E3 não mudou ao clicar nas prévias.
- [ ] Confirmar que Movimentações, Planejamento, Orçamentos, Minhas contas e auditoria E1 mantiveram os registros originais.
- [ ] No PWA protegido, conferir a mesma demonstração, se o Preview estiver homologado; **não** fazer deploy Cloudflare Production só para essa verificação.
- [ ] Não anunciar envio de finanças reais ao Sol.

## Próximas etapas dependentes

E4.2: integrar dados financeiros verdadeiros **somente após** identidade única e reconciliação Cloudflare certificadas, inicialmente em prévia somente leitura com consentimento explícito, sem chamada ao GPT e sem cópias independentes.
E5: verificar fonte financeira única Windows/Android com hashes, contagens, revisões, CAS, backups e rollback.
E6: perguntas livres com contexto real minimizado/consentido e explicações verificáveis pelo Sol, sem execução de ações financeiras.
E7: inferência segura no PWA somente mediante credenciais e fluxo remoto homologados, nunca copiando OAuth desktop para JS do navegador.

**Importante para o próximo chat:** a E4.1 é um módulo de contexto fictício, não uma alegação de conclusão da migração financeira.
