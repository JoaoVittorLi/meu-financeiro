# Inteligência financeira local — candidata para revisão

Base: PR #43, bc5ccb4f28c2e224614100dff41e03d0c1034fca, reconfirmado em 12/11/2026. Branch feat/mf2-local-financial-intelligence-20261112. Clone separado; instalação pessoal e dados financeiros não abertos.

## Implementação

Serviço de leitura no processo principal e IPC restrito ao renderer do aplicativo. Concessão explícita por fonte/perfil, vinculada ao sender, revogável e válida por 15 minutos; Planejamento exige opção separada. Sem SQL de escrita, LLM, rede ou credenciais. Não implementa um segundo motor: despesas/splits usam shared/finance-period-ledger.mjs e compromissos usam PlanningStore.remaining.

Oito famílias: gastos por categoria (incluindo Alimentação/Assinaturas), maiores despesas, limites excedidos, compromissos confirmados do próximo mês, comparação de categorias, revisão bancária e informações faltantes para compra. Radar mostra limites excedidos/próximos. Não infere disponibilidade pelo resultado mensal. Consultas limitadas aos registros locais; avisa quando o banco retorna 2.500 linhas. Nunca soma fontes manual/banco. Recorrências inferidas e gráficos novos permanecem pendentes.

Chat principal e lateral usam os mesmos threads e cards estruturados existentes. Fonte e mês explícitos, sem herdar filtros da tabela. Respostas obsoletas após troca de mês/permissão são recusadas. Ações não são executadas. O staging do #41 e contratos de propostas fictícias foram preservados.

## Privacidade

Consultas novas vivem na memória; autorização não persiste. Durante a sessão, hidratação, gravação e exclusão do histórico legado em localStorage são suspensas. Ao encerrar, respostas novas são descartadas e referências ao histórico anterior são restauradas. Nenhuma migração/exclusão automática de histórico pessoal. O armazenamento legado segue sem promessa de criptografia; retenção/proteção desktop ainda requer solução e testes próprios. Não criar PR de armazenamento vazio.

## Verificação

Windows local, Node 22.23.4/npm 10.9.9. Baseline 448/448; suíte modificada 459/459; 27/27 dirigidos (11 novos + 16 do resumo). TypeScript, compilação com build-finance-ledger, F08 e probe de splits passam. ASAR passou após resolver dependência ESM com cópia local dos nove pacotes já presentes no lockfile; tentativa inicial sem resolução local falhou ERR_MODULE_NOT_FOUND. npm ci do novo clone falhou EPERM; não foi descrito como instalação limpa aprovada. Dependências foram reutilizadas do checkout de testes, com lockfile idêntico e sem alterar o checkout de origem.

Fixtures SQLite reais descartáveis: R$100 dividido em R$60 Alimentação/R$40 Transporte; pergunta de alimentação devolve R$60. Fonte manual independente responde R$99,99 e, após atualizar fixture, R$84; demo R$15. Compra não promete dinheiro livre. total_changes() permanece igual nas oito consultas. Testes também cobrem expiração, owner errado, revogação, POSTED/PENDING, transfer/ignore, limite parcial 2501/2500, compromisso parcialmente pago, continuidade de chat e ausência de chamadas ao localStorage.

Logs nesta pasta; proveniência verificada no HEAD publicado. Não há aprovação gráfica. Electron Windows anteriormente saiu 0x80000003 antes de CDP; política sandbox_approval:false impede execução fora da restrição. Não repetir o mesmo método. QA Windows separado prepara runner sem instalador, desligado por padrão e dependente de autorização específica.

## Integração e reversão

Draft destinado à branch do #43, nunca main. Revisar permissões/privacidade e homologar no Electron sintético antes de integrar. Integrar QA separado no topo desta candidata para gerar evidências desta capacidade, não somente do #43. Reverter este commit restaura a experiência anterior sem migração SQLite. Nenhum instalador, CircleCI, inferência externa ou escrita financeira foi acionado.
