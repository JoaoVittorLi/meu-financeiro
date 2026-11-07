# Meu Financeiro — paridade Windows/PWA e release único

## Estado de continuidade (Preview privado, sem cutover)
- Proprietário validou que a primeira prévia financeira lista o extrato de 630 transações, mesma quantidade informada para o Windows. Isso NÃO prova igualdade por ID, centavos, nome, datas ou saldo.
- O desktop Windows v0.9.4 permanece usando SQLite local como fonte. O Preview Cloudflare tem a cópia pessoal previamente conferida (93 objetos em 17 tabelas) e a importação Pluggy em staging.
- PR #1 é somente Preview protegido por Cloudflare Access. Não efetuar merge na main, lançar Production ou abandonar o SQLite até homologação, backup/restore e aceite.

## Auditoria da paridade por área

| Área | Operações existentes no desktop (código) | Cloud/PWA atual | Falta para paridade |
| --- | --- | --- | --- |
| Visão geral | Períodos compartilhados, gráfico diário, receitas/despesas, natureza financeira, categorias, leitura de saldo | Contagem e cartões iniciais | Leitura de saldo bancário com datas de origem, agregados sobre todo o histórico, gráficos, períodos, naturezas e splits |
| Movimentações | Banco + manual, busca, período, filtros, revisão, detalhe, categoria e regras, merchant alias, custom title, nature, split, link manual, operação em lote e duplicatas | Banco paginado read-only com filtro por descrição/sinal | Dados manuais, identidades para edição autorizada, overlays, visual de categorias e regras, filtros, drawer, todas as operações CAS |
| Planejamento | plan:overview, simulate, create, edit, status, link, unlink, reject, rename e history; recorrências, parcelas, parcial, proj. diária | Leitura parcial de planejamentos e edição segura restrita de alguns campos via overlay | Motor compartilhado, criação/edição, pagamento, vínculos, ocorrências, projeção e calendário |
| Orçamentos | Limite ausente distinto de zero, modo Gastos/Receitas, categorias, acompanhamento mensal e sugestões | Valores cadastrados em leitura e edição de valor existente via overlay | Cálculo de consumo, gráficos, mudança de mês, criação/exclusão e regras |
| Simular compra | Simulação de parcelas, juros, primeira data, cenários base vs compra, reserva e compromissos futuros | Apenas estrutura de página, sem cálculo | Extrair o mesmo motor determinístico e reproduzir a experiência com dados conciliados |
| Minhas contas | Configurar/consultar/desconectar conta, data/qualidade de saldo, contas Itaú | Consulta read-only de Pluggy server com 1 conta e 630 transações confirmadas pelo usuário | Saldo e timestamps da instituição, validação de consentimento/reconexão, gestão de IDs |
| Configurações | Backup/restore SQLite, preferências, regras, importações e migração | Acesso protegido e push piloto; botão de migração integrado no Windows | Backup/restore cloud, configurações centralizadas, alertas financeiros, gestão de perfil |
| Motor contábil | Distinção categoria/natureza/origem, saldo projetado e simulação, exclusão de transferências próprias | Estágio bancário separado do pessoal, ainda sem motor único | Compartilhar lógica, golden tests em centavos e datas, impedir duplicações e associações automáticas |

Fontes inspecionadas: src/app.ts, electron/db.cjs, electron/planning.cjs, electron/preload.cjs, electron/main.cjs e os módulos mobile-push/src.

## Checkpoint implementado: comparar banco Windows com Cloudflare sem reenviar extrato

- Contrato cross-platform: shared/bank-parity.mjs. A serialização ordena por account_id/external_id e valida chaves, datas e centavos.
- Cloudflare: GET /api/bank/parity protegido pela sessão privada e JWT de Cloudflare Access no Preview. Retorna contagem, período mínimo/máximo e três SHA-256: identidades; identidades+datas+centavos; identidades+descrição+status. Nunca envia os registros.
- Windows: botão Comparar histórico Windows × Cloudflare em Configurações chama IPC do processo principal e compara localmente os hashes com os recebidos via canal autenticado. Não envia linhas bancárias, SQLite, IDs brutos nem dinheiro para o servidor.
- Resultado mostra coincidências/divergências e não autoriza cutover, mesmo quando tudo coincide. Ainda não compara saldos, categoria de origem Pluggy, preferências, vínculos e split.
- Para validar com dados reais, utilizar o executável portátil Windows mais recente da PR e o Preview protegido correspondente. Não repetir a cópia das 93 personalizações.

## Ordem de implementação para paridade completa

1. **Identidades e integridade**: executar comparador local/nuvem com a base pessoal, sanar divergências de identidade, datas/centavos, verificar completude histórica e conciliar referências bancárias das 17 tabelas.
2. **Modelo de leitura completo**: preservar no estágio cloud os campos bancários originais ainda ausentes (ex.: categoria do provedor) e criar read-model com títulos, overrides, regras, revisões, splits, manual e planejamentos, sempre resolvidos por account_id+external_id e com labels de proveniência.
3. **Motor determinístico único**: transportar fórmulas existentes do desktop para módulos compartilhados ou um serviço central, com testes de equivalência e invariante sobre receita/despesa, transferências, parcela, reserva, pagamentos parciais, orçamento e simulação.
4. **Interface paritária**: reaproveitar a UI e os componentes do app Windows em um frontend responsivo único ou camada de componentes realmente compartilhada, com seis áreas completas + Configurações, gráficos, filtros, drawers, controles acessíveis e Web Push preservado.
5. **Escrita e conciliação**: implementar mudanças com validação server-side, revisões CAS, idempotência, auditoria, conflito explícito e rollback; nunca liquidar/vincular pagamentos automaticamente por coincidência de valores.
6. **Cutover e homologação**: testar backup/restore cloud, offline/reconexão, duas edições simultâneas e PC↔Android, segurança Production, retenção e custos antes de desativar gravação local.

## Release único Windows + PWA

Política final desejada: uma única tag e SHA de origem, mesmo contrato de API e mesmo motor; publicar ambos somente depois que a suíte de paridade passar. Evitar lançar interface divergente quando atualizar qualquer plataforma.

**Implementado agora para Preview:** workflow .github/workflows/unified-preview-gate.yml testa SQLite Windows, TypeScript, Worker/PWA, empacotamento Cloudflare dry-run e constrói portátil Windows do MESMO commit. O Preview Cloudflare continua sob a integração GitHub existente e precisa de confirmação separada de deployment Ready. A pipeline não publica Production, não altera main e não habilita FINANCIAL_SCHEMA_ACTIVE.

**Pendente antes de Production:** tags semânticas compartilhadas, metadados de versão do backend, compatibilidade API N/N-1, migrações aditivas com dry-run, aprovação humana, publicação coordenada, monitoramento, backup/rollback real e método de atualização do instalador Windows. Não é correto afirmar que atualização Production simultânea já funciona.

**Segurança:** o histórico local continua protegido; nunca expor segredos Pluggy, cookies, JWT, banco ou logs financeiros no GitHub. Garantir que PWA instalado não persista extrato em um segundo banco financeiro offline e que o Worker exija identidade e sessão do proprietário em todas as rotas financeiras.

## Continuidade — indicadores financeiros e categorias (07/11/2026)

Implementações adicionais na PR #1:
- Shared: shared/finance-period-ledger.mjs agrega valores em centavos por data sem misturar banco com lançamentos manuais. Banco considera somente POSTED e exclui transferências próprias e itens ignorados quando a natureza foi explicitamente marcada. Splits validamente fechados são distribuídos por categoria.
- GET /api/finance/period-summary (start/end/source=bank ou manual) exige sessão privada e Cloudflare Access, apenas no Preview, limita 730 dias, não transmite IDs, descrições ou saldo. Mostra receitas, despesas, resultado, categorias, gráfico e consumo mensal de limites, todos sinalizados como provisórios.
- Visão geral do PWA: período, alternância banco/manual, cards, gráfico SVG de fluxo de caixa e categorias. Orçamentos: barras de consumo do mês. Nem orçamento nem resultado indicam dinheiro disponível enquanto a conciliação não estiver homologada.
- Categoria original Pluggy armazenada numa tabela lateral aditiva mf_bank_staging_categories. Nenhuma alteração destrutiva na tabela de extrato, nas 630 transações, nos 93 registros pessoais ou no SQLite original. Os metadados originais só surgem após uma nova consulta que os receba.
- Prioridade de classificação conforme o desktop: override manual > regra habilitada > categoria do provedor > pendência. Ainda é necessário validar a equivalência real.
- Testes sintéticos de fonte separada, POSTED, transfer/ignore, splits, categorias, limites zero, intervalos, segurança da API, idempotência da categoria e golden test com FinanceDB.bankOverview() do Windows.

Validação do proprietário (ordem):
1. Confirmar deployment Preview como Ready e abrir PWA protegido.
2. Testar Visão geral nas duas fontes; verificar gráfico e orçamento com a ressalva de conferência.
3. Quando necessário, autorizar refresh do Pluggy para que categorias sejam capturadas na tabela lateral, sem repetir migração pessoal.
4. Abrir o portátil Windows gerado na mesma revisão e usar Configurações → Comparar histórico Windows × Cloudflare. Checar hashes de identidade, datas/centavos e descrição/status, mas NÃO concluir cutover.
5. Comparar categorias originais, naturezas, overrides, regras, splits, 17 tabelas, vínculos, saldos e período de cobertura com os dados locais antes de exibir valores como definitivos.
6. Só depois implementar gradualmente as mutações seguras e a paridade de todas as funções, incluindo Planejamento, Simular compra, Configurações e alertas financeiros.

Uma atualização para todos: o workflow de Preview já testa o Worker/PWA e constrói o portátil Windows do mesmo commit, mas não faz lançamento simultâneo em Production. Ainda são necessários versão única, API compatível N/N-1, testes e promoção controlada com backup/rollback antes da distribuição estável.
