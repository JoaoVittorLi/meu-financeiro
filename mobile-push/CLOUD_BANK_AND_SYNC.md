# Meu Financeiro — Pluggy no servidor e sincronização de alterações

## Checkpoint atual — 07/11/2026

**Evidência do proprietário:** importação real Windows → Preview Cloudflare concluída com **93 registros em 17 tabelas**; página `/finance.html` validada no celular com categorias, orçamentos e planejamentos.

**PR:** https://github.com/JoaoVittorLi/meu-financeiro/pull/1
**Preview protegido:** `https://safety-cloud-migration-preflight-20261107-meu-financeiro-push.joaov-despezzas.workers.dev`.
**Produção/main e SQLite local:** intocados. Não migrar banco real por fora do fluxo aprovado.

## 1. Banco atualizado diretamente pelo servidor — implementado em código

- `mobile-push/src/pluggy-readonly.js`: Pluggy somente leitura no Worker; autenticação server-side, `GET /items/{id}` (status/consentimento), `GET /accounts` com paginação, `GET /v2/transactions` com cursor opaco e limites de páginas. Nunca enviar chave ou segredo à interface.
- `mobile-push/src/finance-bank-ingestion.js`: valida contas BRL e valores em centavos, verifica identidade do item, recebe todos os lotes e só depois faz **upsert atômico** em `mf_bank_staging_accounts` e `mf_bank_staging_transactions`. Identidade de movimento: `(account_id,external_id)`.
- Se uma atualização falhar, se a autorização estiver expirada ou se o retorno histórico for incompleto, o armazenamento anterior é **preservado integralmente**. Nunca apagar lançamentos ausentes no retorno, liquidar planejamentos ou alterar categorias bancárias por coincidência de valores.
- O Durable Object em Preview suporta `/bank/refresh` internamente, `POST /api/bank/refresh` (assinatura Access + sessão privada + consentimento explícito) e `GET /api/bank/status` (status seguro, sem transações nem segredos).
- **Autonomia:** após o primeiro refresh consentido, o DO registra `bank_next_sync` e mantém alarmes persistentes a cada **3 horas**, com tentativa após **30 minutos** em caso de falha. Usa a mesma fila de alarmes dos lembretes Push sem conflito. O desktop não é necessário para essas leituras.
- Os alarmes consultam os dados disponíveis na Pluggy. A disponibilidade de novos dados da instituição depende da sincronização/consentimento do item na Pluggy. Não executar `PATCH /items/{id}` em massa, não prometer atualização do banco se o próprio conector estiver parado.
- **Cloudflare Preview Cron Trigger não agenda execuções.** Usamos Durable Object alarms precisamente para conservar o isolamento (fonte: https://developers.cloudflare.com/workers/previews/resources/).

### Variáveis necessárias no Preview (ainda NÃO configuradas por este código)

**Segredos — somente Preview da branch, não Production:**

- `PLUGGY_CLIENT_ID` — Client ID do aplicativo Pluggy já utilizado no Windows.
- `PLUGGY_CLIENT_SECRET` — Client Secret da mesma aplicação.
- `PLUGGY_ITEM_IDS` — itemId(s) do Meu Pluggy autorizados, separados por vírgula, sem espaços extras.

**Variável de ativação — somente Preview:**

- `PLUGGY_SERVER_ENABLED=true`.

Não colocar nenhum desses valores em GitHub, arquivos `.md`, logs, mensagens do ChatGPT, JavaScript de navegador ou capturas públicas. Não ativar Production sem revisão posterior. Depois de configurar e publicar o Preview, no app mobile protegido clicar **“Autorizar atualização bancária neste servidor”** e conferir que `/api/bank/status` mostra os dados importados em quarentena. A autorização afeta apenas o armazenamento bancário em staging e não realiza cutover.

## 2. Sincronização pessoal — implementado em código (subconjunto seguro)

- `mobile-push/src/finance-personal-edits.js`: editor de revisões por registro, CAS (compare-and-swap), mutações idempotentes, feed de eventos paginado com cursor, e overlay separado das 17 tabelas originalmente importadas. Nenhum registro de origem é modificado. Edições simultâneas criam conflito em vez de perda silenciosa.
- Rotas autenticas: `GET /api/personal/baseline` (snapshot original de campos seguros), `GET /api/personal/changes?since=...` e `POST /api/personal/apply`. Somente owner Access + sessão privada, e o POST exige `X-MF-Personal-Edit: optimistic-v1`.
- Os campos liberados nesta etapa são **título, notas, data, categoria e certeza de planejamentos existentes**, **valor do orçamento cadastrado**, **cor/emoji de categorias existentes** e **títulos personalizados já vinculados**. Não permite criar/excluir transações ou liquidar/desvincular pagamentos.
- `electron/cloud-personal-safe-sync.cjs`: cliente Windows com baseline conferido contra a importação original, mirror de revisões em SQLite, download de alterações a cada minuto e upload de edições locais desses campos. Se duas telas alterarem a mesma informação, preserva o dado local e registra conflito; não força atualização por cima. Novos registros locais ainda precisam de um contrato de criação separado.
- `electron/main.cjs` só inicia após a migração previamente aprovada e a sessão Cloudflare estar válida; o renderer recebe apenas notificações resumidas e recarrega visualizações afetadas.
- `mobile-push/public/finance.js` atualiza a leitura protegida ao recuperar o foco e a cada 60 segundos (em primeiro plano). Não guarda outra base financeira no navegador.

## 3. Restrições não negociáveis

- `FINANCIAL_SCHEMA_ACTIVE=false`, `cloudCutoverAllowed=false`. Não tornar a nuvem a fonte financeira principal antes de conferir histórico, saldos, contagens, identidades e rollback.
- Pluggy continua sendo **origem bancária**, Cloudflare retém cópia somente de leitura da origem, e as personalizações ficam em estrutura separada com revisões.
- Nenhuma importação bancária real foi executada por esta versão antes de configurar credenciais e o proprietário tocar no botão de consentimento.
- O Android ainda possui uma prévia funcional, **não as seis interfaces completas** do Windows. Não dizer que sincronização de todas as funcionalidades está pronta; somente os campos seguros mencionados estão no novo fluxo bidirecional.
- `main`, instalador Windows estável, Production e o backup do proprietário não foram alterados.

## 4. Próximas entregas para integração TOTAL

1. **Credenciais uma única vez no Preview**; testar a atualização bancária real sem usar o Windows, com consulta a itens, consentimentos, contas e transações; verificar que os IDs se mantêm.
2. Comparar o extrato Pluggy com o backup local original. Resolver histórico não fornecido, mudança de item/accountId/externalId e vínculos pendentes sem associações automáticas.
3. Ampliar a API de mudanças para criação/exclusão de planejamentos, regras, transações manuais, vínculos e categorização bancária com validação e rollback.
4. Reproduzir progressivamente as **seis áreas financeiras desktop** na interface mobile responsiva, preservando nomes canônicos/originais, planejamento, filtros, categorias, orçamentos e histórico.
5. Testes reais Windows ↔ Android em simultâneo, offline/reconexão, conflito, saldo/paridade e recuperação, depois revisão para ativação do banco único.

## Fonte técnica

- Pluggy v2/transactions: https://v2.docs.pluggy.ai/pt/reference/transaction/transactions-list-by-cursor
- Meu Pluggy expiração: https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use
- Cloudflare Cron previews: https://developers.cloudflare.com/workers/previews/resources/
