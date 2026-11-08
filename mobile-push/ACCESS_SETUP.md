# Meu Financeiro — proteção de identidade Cloudflare Access (pré-v1.0)

> Esta é uma preparação de código, não autorização para armazenar dados financeiros.
> Até auditoria, migração simulada e validação em produção, NÃO ativar
> `FINANCE_SYNC_ENABLED` e não importar extratos, saldos ou segredos.

## Por que verificar o JWT no Worker

O Worker também usa Cloudflare Static Assets (`[assets]` no `wrangler.toml`).
Segundo a documentação da Cloudflare, o roteador de Static Assets pode não
propagar `ctx.access` para o Worker do usuário. Por isso
`src/access-auth.js` valida criptograficamente
`Cf-Access-Jwt-Assertion` usando WebCrypto, `kid` e as chaves públicas
rotativas em `https://<equipe>.cloudflareaccess.com/cdn-cgi/access/certs`.
Valida algoritmo RS256, assinatura, `iss`, `aud`, `exp`, `nbf`,
`iat` e o e-mail do proprietário. Nunca confiar apenas no e-mail em
um header simples ou em um JWT decodificado sem assinatura.

Documentação: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
e https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

## Estado de integração no código

- Sem variáveis Access: `/api/sync/*` funciona **somente para test_notes**
  mediante o antigo cookie de sessão do piloto, e nenhuma entidade financeira
  é aceita por causa da trava `FINANCIAL_SCHEMA_ACTIVE=false`.
- Com qualquer variável Access configurada, mas configuração incompleta:
  a API `/api/sync/*` recusa acesso (503), sem liberar dados.
- Com configuração completa: além da sessão privada do piloto, a API
  `/api/sync/*` exige token Cloudflare Access assinado e com e-mail autorizado.
- `/api/login` e os recursos de push de teste permanecem com o comportamento
  anterior. O Access na borda também pode restringir o acesso a essas páginas.
- **Nunca** declarar migração concluída com base no health-check ou em frases
  fictícias sincronizadas no PWA.

## Configuração na Cloudflare — executar somente na etapa de homologação

1. Acesse https://dash.cloudflare.com/ e selecione o Worker
   `meu-financeiro-push`, em Workers & Pages.
2. Abra a aba **Access** do Worker e escolha **Protect this Worker behind Access**.
   Escolha **All traffic** e uma política **Allow** limitada à sua
   identidade verificada (não usar apenas o domínio genérico de e-mail e
   não permitir `Everyone`). O domínio `workers.dev` também fica coberto
   pela proteção do Worker.
3. Em Zero Trust → Access → Applications, localize a aplicação e obtenha
   seu **Application Audience (AUD) Tag**. Não usar o nome visível da aplicação
   como AUD.
4. Nas variáveis privadas do Worker, configure:
   - `TEAM_DOMAIN`: origem HTTPS completa da sua equipe, por exemplo
     `https://minha-equipe.cloudflareaccess.com` (**exemplo fictício**).
   - `POLICY_AUD`: AUD Tag da aplicação Access correspondente.
   - `ACCESS_ALLOWED_EMAIL`: apenas o e-mail da sua identidade aprovada.
   Salve como Secrets sempre que disponível; não publicar valores em GitHub,
   arquivos do projeto, screenshots ou chat.
5. **Conserve `APP_ACCESS_TOKEN`** por enquanto. O código exige os dois
   mecanismos para a API de sincronização nesta fase. O novo login no
   Cloudflare Access não substitui a sessão privada do piloto imediatamente.
6. Verifique acesso negado com sessão sem JWT; acesso autorizado com
   identidade correta; outra identidade recusada; expiração/revogação;
   acesso pelo Windows e pelo PWA Android; registros fictícios iguais
   em ambos dispositivos.
7. Faça rollout/rollback com cautela: o Worker segue ligado a dispositivos
   reais de teste Web Push. Uma alteração do Access pode exigir novo login
   e afetar acesso às páginas do PWA, mesmo sem alterar o service worker.

## Cuidados antes de migrar finanças

- `FINANCIAL_SCHEMA_ACTIVE` permanece `false` no código. Mesmo ativando
  `FINANCE_SYNC_ENABLED`, o Worker só atende `test_notes`.
- O contrato de tabelas `electron/cloud-migration-contract.cjs` é um inventário
  de integridade relacional da v0.9.4, não um exportador de dados.
- Concluir validação de cada tipo financeiro, isolamento de perfis,
  autorização específica das mutações, idempotência, relações entre registros,
  backups/restauração Cloudflare e dry-run com dados fictícios.
- Credenciais Pluggy: manter fora do app web e fora do contrato de importação.
- Não remover nem sobrescrever o SQLite do Windows até conferir integridade
  e equivalência financeira de ponta a ponta.

**Estado de publicação:** esta documentação não confirma que o Access foi
configurado no painel real. A integração Cloudflare administrativa ainda
precisa de verificação e a PR não deve ativar finance sem homologação.
