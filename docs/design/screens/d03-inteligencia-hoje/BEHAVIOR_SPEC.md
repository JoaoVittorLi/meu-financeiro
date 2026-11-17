# D03 V2 — Contrato de comportamento dinâmico, dados e ações

**Status:** complemento normativo do design aprovado; implementação por Executor. **D03 não habilita escrita financeira pessoal.**

## 1. Entrada tipada

```ts
type Coverage = 'verified' | 'partial' | 'stale' | 'denied' | 'none';
type Fact<T> = {
  value: T | null; sourceId: string; asOf: string;
  coverage: Coverage; period?: {from:string;to:string};
};
type FinancialSnapshot = {
  asOf: string; currency: 'BRL';
  availableBalance: Fact<number>; // centavos; sem duplicar saldo consolidado de múltiplas contas
  expectedIncome: Fact<number>; // entradas futuras válidas, sem duplicar posted
  unpaidFutureCommitments: Fact<Array<{id:string;due:string;amountCents:number;status:'scheduled_unpaid';sourceId:string}>>;
  plannedOtherOutflow: Fact<number>; // opcional; usuário pode adicionar simulação
  safetyBufferCents: number | null; // decisão explícita do usuário; ausência não implica zero
  expenses: Fact<Array<{id:string;categoryId:string;postedCents:number;periodStart:string;periodEnd:string}>>;
  budgets: Fact<Array<{categoryId:string;limitCents:number;periodStart:string;periodEnd:string}>>;
  reviewProposals: Fact<Array<{proposalId:string;version:string;affectedIds:string[];eligible:boolean}>>;
  comparison?: {periodA:{from:string;to:string};periodB:{from:string;to:string};equalDays:boolean};
};
type Signal = {
 id: string; kind:'deficit'|'tight'|'steady'|'save'|'budget'|'trend'|'agenda'|'unknown';
 priority: number; title: string; explanation:string; moneyCents?:number;
 moneyMeaning:'projected_shortfall'|'below_buffer'|'above_buffer'|'simulated_reserve'|'budget_excess'|'delta'|'scheduled_total'|'unknown';
 factRefs:string[]; action:{kind:string;enabled:boolean;reason?:string}; proof:{asOf:string;coverage:Coverage};
};
```

- Saldo `availableBalance` é o que está disponível **agora** e deve ser verificado no contexto da fonte; despesas já pagas já refletem esse saldo. **Nunca subtrair compras pagas novamente.**
- Compromissos futuros devem estar **não pagos**, únicos por ID e devidos na janela usada; não duplicar lançamentos bancários pending/posted; pagamentos futuros já embutidos em saldos reservados devem ser reconciliados para evitar dupla contagem.
- Entradas esperadas são *previsões*, nunca receita recebida; mostrar a condição/qualidade caso componham o total.
- Todas as contas e parcelas em centavos inteiros, por moeda, timezone e escopo idênticos; com base bancária parcial, a projeção deve degradar em parcial/indisponível em vez de usar números inventados.
- Para comparar aumentos de gastos, usar janelas equivalentes e apenas categorias com autorização. Não confundir crescimento (%) com contribuição em reais; `base zero` não produz percentual.

## 2. Projeção financeira, com gates de confiança

```ts
function projectedCents(s: FinancialSnapshot): number | null {
  // Pseudocódigo: implementar apenas se TODOS os fatos críticos forem confiáveis.
  if (s.availableBalance.coverage !== 'verified' ||
      s.unpaidFutureCommitments.coverage !== 'verified' ||
      s.expectedIncome.coverage !== 'verified' ||
      s.plannedOtherOutflow.coverage !== 'verified') return null;
  return s.availableBalance.value!
    + s.expectedIncome.value!
    - sumUniqueUnpaid(s.unpaidFutureCommitments.value!)
    - s.plannedOtherOutflow.value!;
}
```

**Observação:** renda esperada e outras despesas futuras podem ter valor verificado de `0` para o escopo. Um campo ausente não deve ser presumido `0`.

`headroom = projectedCents - safetyBufferCents` somente se usuário estabeleceu margem. Caso não haja margem explícita, oferecer “Definir uma margem de segurança” (sem inferir reserva recomendada). Renderizar `projected` como **previsão**, não saldo após o dia nem saldo disponível em conta.

## 3. Motor de decisão determinístico

**A IA não decide qual sinal é elegível a partir de texto solto**. O resolver local monta fatos e elegibilidades; o motor ordena os sinais. O LLM pode melhorar redação, com validação do conteúdo final e sem mudar número/CTA/fato.

| Gatilho baseado em fatos | Prioridade visual | Mensagem/ação |
|---|---|---|
| `projected < 0` | Crítica 110 | Avisar possível insuficiência futura e abrir revisão de pagamentos |
| `0 ≤ projected < buffer` | Alta 105 | Mostrar valor abaixo da margem; revisar limites *flexíveis* e fluxo |
| `0 ≤ headroom < R$ 150` | Atenção 95 | Manter margem e acompanhar compromissos |
| `headroom ≥ R$ 150` | Oportunidade 92 | Simular reservar **até 50% da folga**, sem transferir |
| `postedSpend > budget > 0` | Orçamento 84 | Diferença entre gasto/limite, com prova de período e categoria |
| `deliveryCurrent > previous` e comparável | Tendência 64 | Variação em R$ e evidência; investigar/hipótese de economia |
| Sem saldo/ cobertura insuficiente | Informacional 100* | Não sugerir reserva/insuficiência; CTA solicitar fonte |
| Agenda autorizada sem outro evento | Baixa 45 | Próximos pagamentos verificados |

`*` O estado informacional não deve se tornar aviso financeiro alarmista. Quando as informações são parciais, recomputa-se somente famílias elegíveis e exibe-se transparência de fonte.

**Seleção:** evitar duplicidade de causa (p. ex., limite de Alimentação e Delivery podem ser relacionados, mas mostrados como investigações diferentes se ambos tiverem evidência). Exibir **máximo 3 cartões relevantes**, ordenados por prioridade e materialidade. Se nenhum sinal elegível, mostrar estado calmo sem fingir alerta. O número exibido é a quantidade real de sinais, não constante.

## 4. Contrato de experiência

```
Snapshot verificado
   ↓ derivação determinística
Signal[] + factRefs + qualidade
   ↓ renderizador uniforme
D03 Hero + 0–3 SignalCard + agenda/revisão elegíveis
   ↓ clicar em sinal
Drawer contextual read-only (com mesmo scope, IDs e período)
   ↓ sugerir ação supervisionada
Proposta → Central de Revisão D04 → reconfirmação D01 V4.5
   ↓ resposta real de serviço (futuro, sob autorização)
Recibo verdadeiro / erro; nunca simular sucesso bancário
```

- Troca de saldo, renda esperada, despesas previstas, margem ou limite no **protótipo** muda a UI local sem gravação. No Electron, mudanças reais/planejadas devem separar `simulatedOverrides` de dados bancários persistidos, com botão de Restaurar.
- Conteúdo que depende de histórico (budget, delivery) sai quando o histórico é desautorizado, parcial ou desatualizado. Não reaproveitar conteúdo no cache como se tivesse acesso atual.
- `delivery` é exemplo do fixture, não regra especial hard-coded em produção; detectar `spendingTrend` por contribuição material e fonte comparável. A nova família de sinal precisa reutilizar as 26 famílias D02.
- Follow-ups do chat são gerados por `signalIds`, não por aba; depois de usados, devem sumir ou evoluir. Ao mudar a fonte/snapshot, revalidar elegibilidade e descartar sugestões sem suporte. Histórico permanece.
- Agenda preserva status `scheduled_unpaid`, vencimento real, fornecedor, valor e timezone; sem dados, empty state; nada de datas fictícias.
- Revisão de categoria exige mostrar contagem, valor, afetados e préviaVersion; excluir item recalcula total. Ação nesta tela só abre D04, não aplica.
- Drawer: overlay com retorno de foco, Escape, tabulação, ARIA e fechamento visível; no mobile, tela inteira. Todos os controles com handler efetivo ou desabilitados.
- Motion: 150–240ms em estados verificados; reduced-motion desliga transições; sem números animados que pareçam eventos reais.

## 5. Segurança de dados / política

- `IC-READ`: leitura apenas quando autorizada e vinculada ao objetivo/período. Estará proibido sugerir saldo/pagamentos pessoais se `denied`/ `none`.
- `IC-REVIEW`: edição de prévia em modo isolado ou rascunho, sem mutar registros reais.
- `IC-CATS`: só operações explícitas, fora do modo demonstrativo e com confirmação adicional; não interpretar o clique na D03 como consentimento de escrita.
- `IC-LLM`: texto explicativo após guardrails. Se a IA falhar, a experiência local continua utilizável e não fica em loop de loading.
- Logs e fixtures não podem incluir nome de banco, ID ou dado pessoal real sem autorização.

## 6. QA e evidências

Veja [ACCEPTANCE.md](ACCEPTANCE.md) para testes. O protótipo `prototype.html` foi validado em sintaxe e cenários determinísticos, **não** foi homologado no Electron.

## 7. Prioridades futuras

Se houver lacunas do backend (saldo confiável, compromissos não pagos, buffers explícitos, IDs de regras), não preencher com dados sintéticos; registrar pendências por contrato na issue de implementação. **Não bloquear o avanço do design para D04 esperando essa integração.**
