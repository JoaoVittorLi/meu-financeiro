# Meu Financeiro — Entrega 2: Sign in with ChatGPT / GPT-6.1 Sol

**Data de preparação:** 07/11/2026
**Branch:** `feat/inteligencia-e2-chatgpt-shared`
**Base:** `safety/cloud-migration-preflight-20261107` no commit `20a5aa0`
**Estado:** Código preparado em preview. Autorização real, suíte Windows e instalador ainda **não homologados**.

## Por que esta base

O PWA e a migração financeira já estão em desenvolvimento na PR #1; a interface Inteligência estava isolada na PR #2. Esta branch une a UI da Entrega 1 à base Windows/PWA e adiciona um contrato compartilhado, sem mesclar em main, Production ou desligar o SQLite original.

### Entrega Windows

- `src/intelligence-view.ts`: Hoje, Conversar, Plano de ação e assistente contextual portados da Entrega 1.
- `src/intelligence-integration.ts`: login, estado, logout local, seleção de três cenários fictícios, Low/Medium e resposta de teste.
- `electron/ai-auth.cjs`: OAuth oficial Sign in with ChatGPT, PKCE S256, estado, nonce, host ID persistente, loopback `127.0.0.1`, verificação OIDC/JWKS, scopes e refresh token.
- `electron/ai-vault.cjs`: tokens criptografados pelo `safeStorage` do Electron, não acessíveis pelo frontend.
- `electron/ai-client.cjs`: verifica catálogo da conta, fixa `gpt-6.1-sol`, usa apenas `reasoning.mode:standard` com `low` ou `medium`, `store:false`, `stream:true`, processa SSE até `response.completed` e rejeita erros de limite.
- `electron/main.cjs` e `electron/preload.cjs`: IPC explícito; sem acesso genérico ao processo principal, SQL, Pluggy ou banco pela IA.
- No máximo **3 testes fictícios por execução** do aplicativo; nenhum retry automático.
- Sem API key, sem fallback para serviço cobrado à parte.

### Entrega PWA

- `mobile-push/public/finance.html`, `finance-ai.js`, `finance-pwa.js` e `finance.css` adicionam a navegação e a área Inteligência em preview.
- `mobile-push/src/worker.js` expõe **GET /api/ai/capabilities** somente após as camadas de sessão e Cloudflare Access, em Preview.
- Essa resposta é gerada pelo **mesmo** `shared/ai-policy.mjs` usado pelo Electron. Inclui tarefas, modelos e exemplos, mas não IDs bancários, registros, tokens ou credenciais.
- Não há execução do modelo no PWA: a autenticação remota de aplicativos privados depende de autorização/elegibilidade específica. Não transmitir tokens locais do Windows para o navegador.

### Política compartilhada

`shared/ai-policy.mjs` é a fonte única para modelo, raciocínio, instruções de teste, casos e limites de contexto inicial. É um contrato de **IA**, não uma segunda fonte de dados financeiros. Não substitui o trabalho de unificação contábil, que continua na PR #1.

## Segurança e uso de assinatura

Para que os testes não consumam créditos adicionais:

1. No ChatGPT, abrir **Configurações → Uso**.
2. Verificar que a opção para aplicativos utilizarem créditos adicionais está **desativada**.
3. Depois de conectar o Meu Financeiro, definir o limite semanal **abaixo de 100%** (por exemplo, 25%). Pela documentação oficial, limites abaixo de 100% impedem que o aplicativo consuma créditos adicionais.
4. Confirmar essas condições no aplicativo antes do teste.

**Limitação:** o aplicativo não consegue verificar nem alterar remotamente essas preferências; a confirmação é manual. O uso da franquia e a disponibilidade do GPT-6.1 Sol dependem da conta e da autorização da OpenAI. Nenhuma requisição real foi executada nesta preparação.

## Testes

Código de teste incluído:

- `tests/ai-signin.test.cjs`: contrato, cenário fictício, armazenamento protegido simulado, JWT/nonce/issuer/aud, SSE e erros de franquia.
- `tests/ai-ui.test.cjs`: navegação, integração visual e ausência de acesso bancário pelo componente de preview.
- `mobile-push/test/ai-policy.test.js`: mesmo contrato para ambos, PWA sem credenciais nem rota de inferência.

Para executar no Windows (na branch):

```powershell
npm install
npm run test:types
npm run test:db
npm run compile
cd mobile-push
npm install
npm test
npx wrangler deploy --dry-run
```

### Homologação manual de OAuth

1. Fazer backup dos dados originais e abrir somente o preview desktop.
2. Visitar Inteligência → Conversar → **Continuar com ChatGPT**.
3. Autorizar pelo navegador do sistema, conferir o consentimento e a conta.
4. Voltar ao aplicativo; conferir status **Conectado** sem qualquer token aparecer na interface.
5. Em ChatGPT → Configurações → Uso, deixar créditos adicionais desativados e limite do app abaixo de 100%.
6. Executar um único teste de categorização fictícia em **Low**; verificar o evento `response.completed`, a resposta e os tokens informados.
7. Executar um único teste de planejamento fictício em **Medium**.
8. Conferir limite máximo de três testes por sessão e ausência de chamadas adicionais.
9. Desconectar o host local e, se desejar revogar consentimento remoto, remover a autorização no ChatGPT.
10. Testar no PWA que a seção Inteligência carrega capacidades do Worker mas não solicita login ou chama a OpenAI.

Se a conta ou o aplicativo privado não receber escopo `chatgpt.tokens.use.direct` ou o Sol não constar do catálogo, **interromper a integração** sem fallback pago.

## Distribuição de instalador

A branch inclui `scripts/preview-intelligence-windows-local.ps1`, baseado no procedimento da PR #1.

- Verifica commit/branch.
- Executa testes desktop e Worker e dry-run do Wrangler.
- Compila **portátil e instalador NSIS** Windows.
- Gera hashes SHA256.
- Após homologação local, `-PublishOnly` publica assets num GitHub Release por SHA e imprime links diretos do instalador e portátil.

**Ainda não existe novo EXE desta Entrega 2 publicado.** A conta GitHub Actions está com a cota esgotada e este ambiente não executa o empacotamento Windows nem o upload do binário. Não reutilizar o instalador v0.9.4 como se contivesse a IA.

## Não modificar nesta entrega

- `FINANCIAL_SCHEMA_ACTIVE`, `FINANCE_SYNC_ENABLED` ou estado do cutover.
- Segredos da Cloudflare e Pluggy.
- SQLite bancário original, hashes, vínculos, saldos e transações.
- Cloudflare Production.
- Aprovação e execução de ações financeiras.
- Configuração de crédito pago por API.

## Dependências para a Entrega 3

Após homologar OAuth e os testes com dados fictícios, evoluir o `AIContextBuilder`, memória e consultas financeiras somente leitura. Só integrar registros reais após a fonte cloud única estar validada, preservando os cálculos determinísticos compartilhados. 
