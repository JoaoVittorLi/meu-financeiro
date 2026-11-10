# Arquitetura conhecida e arquitetura-alvo

**Escopo da verificação:** código e documentos disponíveis na branch design/despezzas-d1-d4, SHA c535cb0. Separar **existente** de **alvo**.

## Camadas existentes (mapa de arquivos)

| Camada | Arquivos reais | Papel |
| --- | --- | --- |
| Renderer Windows | src/app.ts, src/plan-view.ts, src/intelligence-view.ts, app/app.js, app/*.css | Navegação e UI React/TypeScript compilada |
| Ponte Electron | electron/main.cjs, preload.cjs | IPC e interface desktop |
| SQLite Windows | electron/db.cjs, planning.cjs, recovery.cjs | Registros locais, planejamento, backup/restore |
| Pluggy Windows | electron/pluggy.cjs, pluggy-vault.cjs | Integração bancária read-only e credenciais protegidas |
| Auditoria cloud | electron/cloud-*.cjs | Paridade, identidade, transferência e onboarding |
| Compartilhado | shared/bank-parity.mjs, finance-period-ledger.mjs, finance-installment-quote.mjs, e1-*.mjs | Regras e contratos já extraídos |
| IA desktop | electron/ai-auth.cjs, ai-vault.cjs, ai-client.cjs, ai-personal.cjs | Fluxos experimentais de autenticação, cliente e memória |
| IA compartilhada | shared/ai-policy.mjs, ai-context.mjs, ai-financial-context.mjs | Contrato de tarefas, limites e contexto fictício |
| PWA | mobile-push/public/finance*.js/css/html | Interface financeira web e piloto push |
| Cloudflare | mobile-push/src/worker.js, finance-*.js, cloud-sync.js, access-auth.js | Worker/DO SQLite, sessão protegida, staging e APIs |
| CI | .circleci/config.yml, .circleci/build-windows.ps1, scripts/renderer-provenance.cjs | Preflight, build Windows, proveniência/ASAR |

**Observação:** README.md e mobile-push/README.md contêm descrições históricas do piloto 0.9.4; verificar contrato e revisão atual antes de tratá-los como documentação de produção completa.

## Fluxo existente e limites

- Windows usa SQLite local; Cloudflare Preview recebeu staging bancário e pacotes pessoais, mas **cutover não autorizado**.
- Pluggy read-only alimenta extratos; títulos/categorias personalizados são overlays e não justificam mutar lançamentos brutos do banco.
- PWA já possui leitura e algumas edições protegidas, porém não recebe automaticamente as U1–U3 desktop.
- Prova PC↔Android de texto via Durable Objects não equivale a sincronização financeira.
- Diagnóstico E1 de 630→632 registros é evidência parcial de staging, não paridade atual.
- IA E1–E4.1 oferece UI/demo, memória/contexto e testes; shared/ai-policy.mjs indica financialDataEnabled=false e pwaInferenceEnabled=false.

## Alvo 2.0 — contratos, não substituição impulsiva do stack

1. **Dados/integrações**: staging e fonte canônica homologada, cache local claramente identificado, Pluggy e uploads manuais.
2. **Núcleo financeiro compartilhado**: regras de centavos/datas, naturezas, splits, orçamento, recorrências, planejamento, dívidas e patrimônio.
3. **Serviços**: consultas + comandos validados por schema, revisão e autorização; idempotência e auditoria.
4. **UI Windows/PWA**: mesmas definições de indicadores e estados; componentes compartilhados onde adequado; layouts nativos de cada superfície.
5. **IA**: ferramentas permitidas que chamam os serviços, não acesso irrestrito ao SQLite/DO.

## Invariantes que não podem regredir

- Dinheiro: inteiros de centavos ou decimal exato, nunca float autoritativo.
- Transação bancária: identidade composta por conta+ID externo; posted versus pending; revisão explícita.
- Fonte: banco e manual separadas; vincular sem duplicar; transferências próprias não são receita/despesa.
- Saldo: conhecido, parcial, sem referência ou desatualizado não podem aparecer como zero ou saldo atualizado.
- Planejamento: quitações parciais, datas, receitas incertas, parcelas e saldo mínimo com base explicitada.
- Orçamento: zero explícito versus limite ausente; margem não é dinheiro disponível.
- Simulação: não escreve compromisso até confirmação/editor.
- Escrita concorrente: revisão/CAS, idempotência, 409/conflito e auditoria.
- IA: sugestões não são fatos; prévia/confirmar/escrever, recusa com dado desatualizado e rollback condicionado; nunca pagar ou negociar ativos.
- Recuperação: backup/teste de restore antes de migração, rollback e preservação do banco local.

## Migração controlada

Não habilitar FINANCE_SYNC_ENABLED / FINANCIAL_SCHEMA_ACTIVE ou usar Preview como fonte definitiva antes de:
- conciliação de identidades/centavos/datas/saldos/categorias e referências das 17 tabelas;
- demonstração de restauração segura e cópia local preservada;
- prova de conflitos PC↔Android e reenvio idempotente;
- autorização separada de cutover e checklist Production.

Nenhum novo agente deverá "corrigir" o problema substituindo a base ou reimportando transações sem diagnóstico de causa. Consultar E1_CONCILIATION_REPORT.md e mobile-push/PARITY_AND_UNIFIED_RELEASE.md.
