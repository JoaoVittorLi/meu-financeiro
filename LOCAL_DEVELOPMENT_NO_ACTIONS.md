# Meu Financeiro — desenvolvimento sem GitHub Actions

## Estado de 07/11/2026

A franquia de GitHub-hosted Actions foi atingida. Na PR #1, branch safety/cloud-migration-preflight-20261107, os workflows automáticos de testes e preview foram alterados para acionamento manual, para não iniciar novos jobs a cada commit. Foram pausados somente na branch: unified-preview-gate.yml, test-mobile-push.yml, test-cloud-migration.yml e diagnose-access-certs.yml. O workflow do Windows de main e os segredos Cloudflare não foram alterados.

É possível continuar fazendo commits e recebendo deployments de Cloudflare Preview pelo sistema próprio da Cloudflare, sujeito aos limites desse serviço. READY no painel de Cloudflare NÃO certifica os testes que não puderam executar no GitHub.

## Compilar e testar no seu Windows — zero minutos GitHub-hosted

Pré-requisitos: checkout local da branch da PR #1, Node.js 22+, Git, npm. Para publicar o EXE, também GitHub CLI (gh.exe), autenticado no próprio PC por gh auth login. Não envie tokens ao chat.

1. Atualizar a branch PR #1 no PC Windows.
2. Abrir PowerShell na raiz do repositório e executar:

    powershell -ExecutionPolicy Bypass -File .\scripts\preview-windows-local.ps1

3. O script executa testes SQLite Windows, teste TypeScript, compilação, testes Node Worker/PWA, validação Wrangler sem publicar e empacotamento EXE portátil. Confere o EXE e grava hash SHA256 em release/PREVIEW-SHA256.txt.
4. Testar o executável com cuidado e fazer backup dos dados locais antes de instalá-lo.
5. Somente depois de testar e aprovar, executar:

    powershell -ExecutionPolicy Bypass -File .\scripts\preview-windows-local.ps1 -PublishOnly

6. O script confere branch, commit original, hash SHA256 e ausência de alterações de código pendentes; então publica no GitHub Releases uma PRÉVIA privada com tag preview-SHA. Não substitui nenhuma release existente. O terminal imprime o URL DIRETO do EXE após upload concluído.

O arquivo app/app.js é gerado pelo TypeScript e rastreado no Git; a compilação pode deixá-lo modificado. O script permite somente essa alteração gerada na etapa PublishOnly, mas não aceita outras mudanças não commitadas. Os diretórios release/ e release-preview-worker-dry-run/ são temporários e ignorados pelo Git.

## Testes rápidos de desenvolvimento

Desktop na raiz:
- npm run test:db
- npm run test:types
- npm run compile

Worker/PWA, dentro de mobile-push:
- npm test
- npx wrangler deploy --dry-run

A prévia continua isolada e protegida por Cloudflare Access e sessão privada.

## Paridade entregue até este commit

- Extrato bancário real Pluggy no Cloudflare Preview, consulta de 630 transações.
- 17 tabelas e 93 personalizações no checkpoint de migração verificada, sem cutover.
- PWA com seis abas navegáveis; gráficos de fluxo, categoria e orçamento provisórios.
- Edição via PWA de campos seguros em planejamentos existentes e limites existentes, com revisões CAS/idempotência. O Windows possui sincronizador dos mesmos campos, dependendo da sessão e execução local.
- Novo simulador PWA de parcelas e juros, com fórmula compartilhada baseada no PlanningStore desktop e calendário completo. Não cria compras e não calcula risco sobre saldo bancário ainda não conciliado.
- Comparação de identidades bancárias por hashes entre Windows e Cloudflare disponível na prévia Windows anterior, ainda aguardando homologação com os dados reais.

## Pendências que não devem ser ocultadas

A compilação Windows da nova etapa NÃO foi executada no GitHub devido à cota; não há novo EXE validado nem um novo link de Release correspondente. A validação local completa ainda precisa ser executada no Windows. É inadequado dizer que as seis áreas já têm equivalência total. A UI React comum, criação/edição financeira completa, orçamento definitivo, pagamento/vínculos, simulação de risco financeiro, conciliação real de todas as contas e cutover único continuam pendentes.

Nunca modificar main/Production, descartar SQLite, reimportar os dados pessoais ou liberar liquidação automática somente por coincidência de valor/data. Acompanhar resultados do Preview e versões diretas em GitHub Releases.

## Verificação sem Actions realizada nesta etapa

Foi realizada uma verificação independente das fórmulas reais de parcelamento: o método PlanningStore.simulatePurchase extraído do código desktop foi executado em um harness sintético com projeção substituída por stub (sem dados pessoais), e comparado com shared/finance-installment-quote.mjs em quatro cenários, incluindo divisão de centavos, juros e vencimentos. Os quatro resultados concordaram exatamente em parcela, total, juros e calendário. Também passaram as verificações de sintaxe dos scripts PWA e Worker e os IDs da interface. Isso NÃO substitui a suíte Node/TypeScript nem o empacotamento e smoke test Windows, que continuam pendentes no checkout local.
