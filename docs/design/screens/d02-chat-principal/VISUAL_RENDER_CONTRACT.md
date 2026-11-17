# D02 — Contrato de renderização visual (proposta para integrador)

**Status:** PROPOSTO / NOT APPROVED / NOT IMPLEMENTED. Nenhuma escrita financeira habilitada.

## Fluxo seguro

1. Identificar intenção da pergunta e preservar o histórico (sem repetir follow-ups consumidos).
2. Resolver fatos por serviço autorizado, com IDs transacionais, período, contas, cobertura e última atualização.
3. Validar agregações em centavos (sem floats monetários), filtros, naturezas e conciliação.
4. IA descreve objetivo, explicação e possíveis renderers; NÃO escreve números calculados em payload visual.
5. Router seleciona um renderer aprovado do inventário a partir dos fatos (máximo 1 primário e 2 complementares).
6. Card no chat com ação Explorar para o Espaço de Análise sob demanda.
7. Operação de escrita inicia proposta read-only → revisão detalhada → reconfirmação expirada por mudança → backend autorizado → recibo e undo quando viável.

## Contrato TypeScript (ilustrativo)

```ts
type VisualReply = {
  id: string;
  schemaVersion: '1';
  narrative: string;
  blocks: Array<{
    id: string;
    kind: 'summary'|'kpi'|'compare'|'trend'|'bar'|'donut'|'treemap'|'sankey'|'rank'|'drilldown'|'table'|'recurring'|'budget'|'cashflow'|'whatif'|'scenario'|'goal'|'debt'|'portfolio'|'insight'|'plan'|'proposal'|'approval'|'report'|'quality'|'state';
    factRef: string;
    density: 'compact'|'standard'|'analysis';
    filterRef?: string;
    actionRefs?: string[];
  }>;
  evidence: { queryId: string; sourceIds: string[]; period: {start: string;end: string;timezone: string}; asOf?: string; quality: 'verified'|'partial'|'stale'|'unavailable'; missing?: string[] };
  followUps: Array<{intent: string; label: string; requiredFacts?: string[]}>;
};
```

## Regras de decisão do router

- Quanto → KPI; comparações → antes/depois; tendência → linha quando pontos reais suficientes; distribuição → barra ou rosca com valores positivos e totais conferidos.
- Por que → ranking das variações; não confundir contribuição aritmética com causalidade; a investigação permite drill-down.
- Fluxos → Sankey apenas quando origens e destinos reconciliados; caso contrário, tabela/estado parcial.
- E se → cálculo determinístico com parâmetros editáveis, baseline e premissas; sem afirmar economia garantida.
- Crie/altere/exclua → preview e duas confirmações quando necessário; IA nunca trata seu próprio texto como permissão.
- Falta de evidências → explicitamente empty/partial/stale, não imagens ou números inventados.

## Implementação

- Integrar com IC-READ/IC-CATS/IC-RULES/IC-MOVE e proteção do integrador; permissões de leitura não autorizam escrita.
- Todas as variações têm versões compacta, chat, workspace e mobile; acessibilidade e alternativa tabular.
- Quantidade/valor do gráfico = exatamente a soma da lista filtrada por IDs. Excluir duplicados e transferências conforme contrato vigente.
- Fatos monetários em centavos inteiros; cálculo temporal coerente com timezone e defasagem da sincronização.
- Sem gráficos fabricados com pontos interpolados para sugerir fatos inexistentes.
- PreviewVersion/expiração/revalidação/rollback e recibo auditável antes de liberar ações reais.
- Regressão de estados: loading, ready, partial, stale, empty, denied, offline, error, conflict, expired, saved e undo indisponível.

## Matriz de QA visual

Cada família: temas dark/light, 1366 e 1920 no Electron, largura 390 no mobile futuro, densidade compact/standard/analysis, dados vazios/nulos, grandes volumes, valores negativos, clipping, teclado e reduced-motion. QA Electron somente após implementação, nunca inferido de screenshot do mock.
