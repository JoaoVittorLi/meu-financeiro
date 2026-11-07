# Meu Financeiro — piloto privado de notificações

Este projeto é **isolado** do aplicativo financeiro para testar Web Push verdadeiro com o PWA fechado. Nenhum dado bancário é enviado; o payload de teste é propositalmente vazio, e o service worker mostra uma mensagem genérica.

## Publicação sem instalar nada no PC

1. Crie uma conta gratuita em https://dash.cloudflare.com/sign-up, se necessário.
2. Em https://dash.cloudflare.com/ entre em **Workers & Pages → Create application → GitHub**. Conecte o repositório `JoaoVittorLi/meu-financeiro`, selecione a branch `main` e configure **Root directory**: `mobile-push`.
3. Nome do Worker: `meu-financeiro-push` (igual ao `wrangler.toml`). Build: nenhum (se a UI exigir, `npm install`). Deploy: `npx wrangler deploy`. Salve e implante. O domínio gratuito será `https://meu-financeiro-push.<sua-subconta>.workers.dev`.
4. **Antes de acessar o piloto no celular**, abra o Worker na Cloudflare → **Settings → Variables and Secrets → Add → Secret**. Nome exato: `APP_ACCESS_TOKEN`. Escolha um código privado forte com pelo menos **18 caracteres** (recomendado 24+). Guarde-o em gerenciador de senhas; **não o envie para o ChatGPT nem coloque no GitHub**. Clique em Deploy/Save.
5. Abra o endereço `workers.dev` no seu telefone e informe o código privado. No iPhone, primeiro use Safari → Compartilhar → **Adicionar à Tela de Início**, e abra pelo novo ícone. No Android, Chrome → menu → **Instalar aplicativo**.
6. Toque **Ativar notificações**, permita o acesso, depois **Enviar notificação agora**. Para provar funcionamento com o PWA fechado, selecione **Agendar teste em 2 minutos**, feche o app e confirme a entrega.

## Segurança e limitações

- Não copie para cá seu código privado, tokens da Cloudflare, segredos Pluggy ou prints dos segredos.
- O Worker só aceita cadastros de destinos push de serviços conhecidos, protege APIs com sessão `HttpOnly`, exige origem correta e limita cinco aparelhos.
- A chave VAPID é criada e armazenada no próprio Durable Object; não há chave privada em código ou chat.
- Este piloto mostra somente notificações de **teste**, sem integração financeira, e não promete entrega em 100% dos aparelhos.
- O envio `accepted` confirma aceitação pelo serviço de push, **não necessariamente exibição no aparelho**. Confira a tela bloqueada e histórico do sistema.
- A janela silenciosa 22h–8h adia avisos agendados, que continuam registrados em storage até o horário permitido. Os testes imediatos são ações explícitas e não passam pela fila.
- O piloto não acessa seu banco SQLite nem faz sincronização PC ↔ celular. Essas são etapas futuras, após validar a entrega de push.
- Backup da chave VAPID será tratado antes de migrarmos para produção; se o Durable Object for apagado, os dispositivos precisam se cadastrar novamente.

## Desenvolvimento local

`npm install`, `npm test`, `npm run deploy`. Nunca coloque `.dev.vars` ou segredos em commits.

## Sincronização: primeira etapa (sem dados reais)

O piloto ganhou `/sync.html`, uma prova de sincronização versionada com o mesmo SQLite-backed Durable Object do push. Abra a mesma página no PC e no celular, entre com o acesso privado e altere uma frase fictícia. O outro aparelho consulta o servidor periodicamente; não há armazenamento financeiro local. Conflitos de edição retornam HTTP 409, em vez de sobrescrever silenciosamente.

O endpoint de sincronização aceita **somente a coleção `test_notes`** enquanto `FINANCE_SYNC_ENABLED` não for explicitamente configurado com `true` na Cloudflare. **Não habilite dados financeiros antes de proteger o Worker com Cloudflare Access, exigir identidade individual e testar uma migração com dados fictícios.** A migração do SQLite financeiro, a paridade funcional das telas e a substituição do banco desktop ainda NÃO foram implementadas. Não considere o PWA atual como substituto do aplicativo Windows.

As interfaces de API dessa etapa são: `GET /api/sync/health`, `GET /api/sync/snapshot`, `GET /api/sync/changes?since=0`, `POST /api/sync/apply` com controle por revisão. Exige sessão privada existente. Não suba extratos bancários nem segredos para testar.
