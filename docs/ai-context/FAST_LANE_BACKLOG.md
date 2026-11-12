# MF2 Fast Lane — backlog por fatias verticais, não por camadas incompletas

**Aprovado como direção e prioridade pelo proprietário:** Redesign Premium + Inteligência funcional, no Windows desktop primeiro. **Situação inicial:** execução das novas frentes ainda não começada; PR #48 não homologado. Coordenar no issue #49. IDs abaixo são trabalhos a executar, não funcionalidades entregues.

## Ordem de trabalho curta e paralela

| Fase | Executor R — Redesign | Executor I — Inteligência | Critério de aceite integrado |
| --- | --- | --- | --- |
| **P0.1 — Hoje** | Nova aba Inteligência Hoje Premium: cartões de prioridade, fila/regras/radar, clareza de capability e estados reais; visual desktop claro/escuro | Adaptadores tipados para IC-READ e IC-REVIEW; payloads, contagens/coverage, permissão/status e navegação funcional | No Electron, cada card recebe fonte real/escopo e CTA útil ou claramente indisponível |
| **P0.2 — Conversar** | Chat principal + drawer premium coesos, cards interativos, contexto, prévias/recibos, loading/erro e continuidade | Orquestração de intenções financeiras read-only existente, router seguro e sugestões preparadas; ações sintéticas via IC-REVIEW | Pergunta → leitura autorizada → resposta com fonte → proposta/previsão real quando aplicável → confirmação sintética |
| **P0.3 — Revisar + Categorias** | Central visual para lote, confiança, ações Aceitar/Editar/Negar, mini-workflow "+ Nova categoria" contextual sem perder lançamento | Reforçar padrões/contratos de revisão, fonte e resultados; categorySave existente reutilizado; sem novo motor de regras | Regra sugerida → prévia → confirmação sintética → persistência/undo; criar categoria manual funciona pelo botão real |
| **P1.1 — Movimentações** | Novo histórico, filtros/organização, pesquisa, classificação rápida, massa, estados premium | Evidências, agrupamentos e priorização de pendências com cobertura correta | Revisão rápida, filtro por conta, sem seleção stale ou alteração silenciosa |
| **P1.2 — Visão Geral** | Redesign expressivo do dashboard; indicadores relevantes, insights conectados, interações e animações leves | Agregados confiáveis e explanação determinística, motor financeiro compartilhado | Todo número clicável revela período/fonte/limite; nunca "saldo seguro" inventado |
| **P2 — Expansão** | Orçamentos/Planejamento/Metas UI premium sobre fluxos existentes | Novas propostas de escrita supervisionada sintética: orçamento/planejamento/metas; base para LLM configurável | Nova ação com preview, confirmação, recibo, testes; ativação pessoal separada |

### Primeiro checkpoint obrigatório de cada frente

- **R-P0:** entregar uma **tela Inteligência Hoje visualmente transformada e conectada**, não apenas CSS de hover. Screenshot antes/depois real no Electron, dark/light, click-through de cada card. Não precisa terminar as oito áreas para publicar valor.
- **I-P0:** entregar um **adaptador/contrato real de capacidades + uma jornada completa** de consulta autorizada → resposta evidenciada → sugestão/revisão (escrita apenas em sintético); testes do domínio e mapeamento de UI-01..UI-08. Não perder tempo reconstruindo SQLite/categorização.
- **Integração P0:** compilar as duas branches em candidata própria; QA do fluxo completo. Um recurso só é marcado como feito se UI e serviço se encontrarem no Electron.

### Política de velocidade e qualidade

1. Cada PR deve entregar **1 resultado visível ou 1 jornada integrada completa**, em fatias pequenas. Evitar dezenas de microcorreções isoladas que não entreguem algo perceptível.
2. Reaproveitar IC-READ, IC-REVIEW, IC-CATS, FinanceDB, shared/finance-period-ledger e os hooks de UI atuais.
3. Fazer QA focal de cenários alterados, testes Node/SQLite/TypeScript, F08/ASAR quando o bundle for alterado; Electron visual do Executor R e integração, sem falsos atestados do Executor I sem ambiente.
4. Não bloquear redesign por ausência de IA paga: renderizar consultas determinísticas reais, estados de indisponibilidade e propostas sintéticas supervisionadas. API generativa só após permissão/custo/modelo configurado.
5. Regressão financeira P0 bloqueia integração; melhorias cosméticas P1 não devem atrasar primeira entrega do chat e da nova tela.
6. Criatividade está autorizada dentro das jornadas, design system e contratos: sugerir e implementar soluções originais que reduzam cliques, clarifiquem decisões e sejam elegantes. Mudanças grandes de semântica/novo serviço entram como "CONTRACT-CHANGE PROPOSED" no issue.
7. Todo botão de card operacional apresenta teste ou ação visível verificável; não aceitar "em breve" disfarçado de executável.

### Portões que continuam vigentes

Sem escrita pessoal por IA, sem gasto de API, sem merge main, sem CircleCI Windows pago, sem EXE/instalar, sem produção. Perfil sintético separado e SQLite pessoal preservado. Gate de homologação Windows continua específico; PRs Draft não representam release.