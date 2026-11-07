# Meu Financeiro — migração financeira: ensaio isolado com dados fictícios

## Estado (2026-11-07)

A autenticação Cloudflare Access e a sincronização da frase `test_notes` foram validadas pelo proprietário no PC e no celular. Isso **não** significa que as transações, contas ou despesas reais tenham sido migradas.

Este ciclo acrescentou **um ensaio executável, não uma importação de dados reais**.

### O que o botão faz

No ambiente Preview em `/sync.html`, o botão **Executar teste financeiro fictício** chama `POST /api/migration/dry-run`. A rota só permite acesso a usuários com:
- sessão privada válida do piloto;
- Cloudflare Access configurado no Worker;
- JWT Access assinado verificado e e-mail autorizado.

A requisição não recebe nem utiliza lançamentos enviados pelo cliente. O código ignora qualquer corpo fornecido: todos os dados são fictícios, embutidos no servidor.

A base SQLite do Durable Object cria 22 tabelas **separadas**, prefixadas `mf_stage_`, mais uma tabela de versão. As 22 tabelas espelham o esquema local v0.9.4 para testar preservação de relações. Não alteram `sync_documents`, `sync_events`, as assinaturas Web Push ou o banco de dados local do Windows.

As verificações do ensaio incluem:
- contagem de três transações fictícias e valores inteiros em centavos;
- total de caixa fictício com transação manual conciliada sem dupla contagem;
- uma despesa dividida em duas partes, com soma igual ao lançamento original;
- um compromisso vinculado a uma transação bancária fictícia e sem saldo pendente;
- título personalizado separado da descrição original do extrato;
- execução repetida sem duplicação dos registros.

Se qualquer verificação divergir, o teste falha e a transação do ensaio é revertida.

### O que o botão NÃO faz

- Não exporta, importa nem compara dados bancários reais.
- Não abre, apaga nem substitui o SQLite original do Electron.
- Não migra credenciais `Pluggy`, dados pessoais ou segredos.
- Não habilita `FINANCE_SYNC_ENABLED`; a trava `FINANCIAL_SCHEMA_ACTIVE=false` permanece ativa.
- Não transforma o PWA em cliente financeiro completo.
- Não substitui o planejamento, categorias, orçamentos ou simulações existentes.

### Próximas fases obrigatórias

1. Conferir o ensaio **real no Preview Cloudflare** e em dois dispositivos; observar 22 tabelas e nenhuma importação real.
2. Criar contratos de importação com validação rigorosa de centavos, datas, IDs externos e relacionamentos de todas as tabelas.
3. Criar exportação local de leitura, com backup obrigatório e relatório de contagens/somas; não enviar banco nem credenciais ao chat.
4. Criar importação idempotente, reversível, autenticada, com transação atômica ou lotes checados, e recuperar após falha.
5. Conferir saldos, categorias, divisões, vínculos e projeções entre SQLite original e cloud; só então substituir a fonte de verdade do Windows.
6. Adaptar as seis seções à interface única Windows/Android. Implementar eventos financeiros reais somente após integridade confirmada.

### Segurança e arquitetura

O Durable Object SQLite oferece transações síncronas e isolamento por Preview. Para versionar o esquema, usamos tabela de versão própria — não `PRAGMA user_version`, que não é suportado no Durable Objects SQLite. O ensaio só armazena dados fictícios e não é uma cópia do banco financeiro do usuário.

**Checkpoint:** até o usuário observar o resultado do botão no Preview real, considerar a etapa `em validação`, nunca `migração concluída`.
