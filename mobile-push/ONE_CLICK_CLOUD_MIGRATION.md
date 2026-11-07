# Meu Financeiro — ativação integrada da sincronização (fluxo definitivo)

## Objetivo aprovado pelo proprietário (07/11/2026)

O proprietário rejeitou executar auditoria separada e realizar upload manual
de arquivos SQLite. **A experiência final deve ser:**

**Meu Financeiro no Windows → Configurações → Ativar sincronização**.

No primeiro uso, o aplicativo executa verificações e backup automaticamente,
autentica o proprietário no Cloudflare Access, migra suas personalizações e
histórico financeiro preservável, reconcilia os lançamentos que serão
atualizados pelo Pluggy e confirma a mudança da fonte de verdade para a
Cloudflare. Após ativada, edições no Windows e Android refletem na mesma base
de forma automática. O usuário não administra CSV/JSON/SQLite nem escreve
credenciais em campos técnicos.

## Por que não devemos subir o SQLite inteiro como forma definitiva

- Extrato e saldos atuais são responsabilidade do Pluggy no **servidor**.
- Dados pessoais que não estão no Pluggy precisam ser importados uma vez e
  sincronizados continuamente: categorias, regras, títulos, observações,
  revisões, splits, lançamentos manuais, orçamentos, recorrências, planos,
  pagamentos vinculados e decisões de reconciliação.
- As linhas bancárias originais do SQLite ainda são a prova de histórico e
  links existentes. Repetições são evitadas por `account_id + external_id`.
  **Não apagar o histórico antigo só porque o Pluggy retorna um período
  menor.** Executar backfill protegido dos registros não recuperados ou manter
  o banco local até equivalência comprovada.
- Credenciais Pluggy ficam exclusivamente no servidor (Cloudflare Secrets),
  jamais no PWA, em exportações, no GitHub, nem no estado sincronizado.

## Fases técnicas e estado

### Fase A — protegida por testes, concluída

- Cloudflare Access: login do proprietário aprovado em PC e Android.
- Sincronização de frase `test_notes` entre os dispositivos.
- Prova de 22 tabelas SQLite e 3 registros fictícios no Durable Object.
- Nenhuma operação financeira real habilitada.

### Fase B — preparação integrada no Windows, **código implementado**

- `electron/cloud-onboarding.cjs` faz backup SQLite automaticamente e
  confere 22 tabelas, integridade, chaves estrangeiras e hash de comparação
  ao pressionar uma opção na tela Configurações.
- `cloud:prepare-migration` no processo principal Electron impede execução
  simultânea com restauração e não abre seletor de arquivos.
- `cloud:migration-status` informa o checkpoint local e nunca afirma que a
  sincronização já está ativa.
- Interface no desktop: **Preparar sincronização (backup automático)**.
  É uma etapa segura, não o botão definitivo de ativação.
- O antigo executável isolado de auditoria e seu workflow foram removidos da
  PR. A auditoria interna permanece, invisível para o usuário.
- Testes com SQLite real em memória/arquivo confirmam backup, integridade,
  idempotência do checkpoint e nenhum dado enviado.

### Fase C — encaminhamento dos dados, **código de contrato implementado**

- `electron/cloud-data-routing.cjs`: cobertura das 22 tabelas, sem
  descartar nenhuma. 17 tabelas de personalizações, 4 ligadas ao Pluggy
  e 1 de metadados locais.
- `mobile-push/src/finance-bank-reconcile.js`: função sem efeitos colaterais
  que atualiza registros bancários por chave estável, mantém históricos não
  presentes na consulta recente e recusa duplicidades/centavos inválidos.
- `mobile-push/src/pluggy-readonly.js`: cliente **somente servidor** para autenticar
  via `POST /auth` e consultar contas/extratos com paginação por
  `X-API-KEY`, sem publicar credenciais, URLs arbitrárias ou aceitar importação
  bancária parcial. Testado com respostas fictícias; nenhuma credencial real
  foi configurada.
- Esses módulos são fundamento do serviço de importação; **ainda não há
  exportação financeira pela rede nem ingestão Pluggy em produção**.

### Fase D — autenticação e migração real, **pendente**

1. Construir o login Cloudflare Access dentro do desktop, sem expor JWT ao
   renderer, e vincular a mesma identidade do celular ao processo principal.
2. Construir API de importação no Worker: esquema financeiro completo,
   validação de cada tabela e referências, lotes idempotentes, isolamento por
   proprietário, backup e rollback restaurável.
3. Transportar as 17 tabelas personalizadas do Windows usando canal protegido.
   Reconciliar identificadores e vínculos antes de disponibilizar o histórico.
4. Configurar Pluggy no Worker somente via secrets de servidor, importar
   contas/extrato atuais e preservar o histórico local não recuperável.
5. Verificar contagens, hashes, saldos, categorias, parcelas, revisões,
   títulos, splits e pagamentos contra o backup original. Se divergir,
   **abortar sem remover o SQLite local**.
6. Após aceite, ativar a base Cloudflare como fonte de verdade e implementar
   leitura/gravação automática nos seis módulos Windows e Android.

## Requisitos de segurança

- Código de financeiro real segue bloqueado por
  `FINANCIAL_SCHEMA_ACTIVE=false` até validação e revisão completas.
- A Cloudflare Production não foi atualizada por esta PR.
- Não pedir para o proprietário enviar seu backup SQLite, relatório JSON,
  Client Secret Pluggy ou tokens pelo chat.
- O desktop v0.9.4 já instalado **não contém** ainda as melhorias da PR.
- Não liberar botão de “Ativar” nem declarar sincronização financeira ativa
  enquanto a implantação e reconciliação real estiverem pendentes.

## Fonte de autoridade

Documentação Pluggy: https://docs.pluggy.ai/en/reference — `POST /auth` e
API key são exclusivamente server-side. Dados bancários devem ser
reconciliados por identificador externo.

Documentação Cloudflare: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
— uso transacional de SQLite Durable Objects para importação atômica e
sincronização posterior.


## Progresso técnico adicional — pipeline real preparado (ainda sem transferência)

### Pacote de personalizações Windows, *somente em memória*

- \`electron/cloud-personal-snapshot.cjs\` lê o backup consistente localmente, valida a estrutura e gera representação fiel das **17 tabelas pessoais** (categorias/regras, títulos, divisões, orçamentos, planejamentos, notas e vínculos).
- Gera SHA-256 e contagem por tabela, rejeita valores numéricos inseguros, BLOBs, alterações estruturais e payloads grandes; não inclui quatro tabelas bancárias do Pluggy nem \`app_meta\`.
- O botão de preparação já executa essa serialização em memória, mas descarta os registros ao concluir a conferência. O renderer recebe apenas contagens agregadas e a confirmação de **zero registros enviados**.
- A janela de login \`electron/cloud-preview-identity.cjs\` usa sessão Chromium separada \`persist:mf-cloud-preview\`, autenticação Cloudflare no domínio conhecido e consulta somente-leitura a \`/api/sync/health\`. Tokens, cookies e credenciais não são retornados ao renderer.
- O botão na tela Configurações inicia **preparação + autenticação** em um fluxo, não mais duas tarefas manuais. O destino é exclusivamente o preview protegido, nunca Production.
- Esses recursos foram testados automaticamente, mas **a janela de login integrada ao Electron ainda não foi testada pelo proprietário em Windows** e não existe instalador com a nova função disponível.

### Validação e quarentena Cloudflare

- \`mobile-push/src/finance-personal-validate.js\` valida em Node/Workers todas as 17 tabelas, tipos, colunas, inteiros em centavos, chaves, hashes e integridade referencial possível antes da leitura dos dados Pluggy.
- Os vínculos com extrato bancário (manual/real, categorizações, splits e planejamentos) continuam explicitamente **pendentes de reconciliação com identificadores recuperados do Pluggy**.
- \`mobile-push/src/finance-personal-quarantine.js\` implementa persistência atômica e idempotente de pacotes de até 2.500 registros, com rejeição de conflitos e descarte/rollback integral.
- A quarentena usa tabelas separadas \`mf_import_*\` e **não atualiza \`sync_documents\`, o banco financeiro principal ou \`mf_stage_*\`**.
- **Não existe rota HTTP pública/privada para importar dados reais**. As funções estão isoladas e foram testadas com bancos fictícios; isso é uma barreira proposital até concluirmos o emparelhamento desktop, lotes grandes, revalidação, importação financeira completa e rollback final.

### Próximos bloqueios explícitos

1. Testar login do Electron no Windows, incluindo o fluxo do PIN por e-mail, cookies persistentes e expiração da sessão.
2. Implementar lotes com verificação de checksum e limite de CPU para os backups com mais de 2.500 registros pessoais; manter o isolamento dos dados antes do cutover.
3. Expor API de importação **apenas após** autenticação Access verificada no servidor + sessão vinculada ao usuário + proteção contra repetições e dispositivos não autorizados.
4. Integrar dados Pluggy por \`account_id + external_id\`, incluindo backfill quando faltarem transações históricas que sustentam vínculos.
5. Comparar hashes, contagens, saldos e vínculo por vínculo. Depois de equivalência total, habilitar gravação na nuvem e implementar o cliente completo Windows/Android. Até lá, SQLite local segue sendo o banco principal.

### Segurança do checkpoint

**Não dizer "migração concluída" e não pedir backup/relatórios/segredos.** Nenhum dado financeiro real foi enviado nesta etapa. Produção e aplicativo Windows instalado permanecem intactos.
