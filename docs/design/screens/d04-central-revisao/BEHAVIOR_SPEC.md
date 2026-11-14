# D04 — Contrato comportamental e autorização V1.1

**Status:** normativo do `DESIGN_APPROVED`, **não** API implementada.  
**Precedências:** D01 V4.5 `BEHAVIOR_SPEC.md`, D02 biblioteca V3, `docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md`, contratos IC-READ / IC-REVIEW / IC-CATS / IC-RULES / IC-MOVE.  
**Não elevar privilégios.** O perfil pessoal não ganha escrita automática por IA devido à aprovação da D04.

## 1. Tipos de dados e fluxo

```ts
type ReviewStatus =
  | 'suggested' | 'editing' | 'preview_ready' | 'stale'
  | 'awaiting_reconfirmation' | 'applying' | 'applied'
  | 'denied' | 'deferred' | 'error' | 'conflict' | 'expired';
type ReviewProposal = {
  id: string; kind: 'category_rule'|'category_change'|'budget_change';
  source: 'bank'|'manual'|'planning'|'synthetic';
  profileId: string; grantId?: string; capability:
    'available_read_only'|'synthetic_only'|'manual_only'|'unavailable';
  revision: number; previewVersion: string; asOf: string;
  coverage: 'complete_local'|'partial_local'|'unknown';
  current: unknown; proposed: unknown;
  affected: Array<{transactionId:string;amountCents:number;sourceId:string;date:string}>;
  excludedTransactionIds: string[];
  scopes?: {past:boolean; future:boolean};
  status: ReviewStatus;
};
```

**Contrato de interpretação:** `ReviewProposal` é desenho de dados, não classe exportada existente. Não copiar mocks diretamente no app. Derivar de serviços autorizados, IDs estáveis, fonte/perfil/escopo, cobertura e versão. Valores em centavos inteiros e moeda consistente. LLM não pode gerar lista de itens ou montante como prova.

## 2. Máquina de estados

`suggested → preview_ready → editing → preview_ready → awaiting_reconfirmation → applying → applied` **somente se** serviço autorizado; `denied`, `deferred`, `stale`, `error`, `expired`, `conflict` são caminhos explícitos. Em perfil pessoal com `IC-REVIEW` indisponível, finalizar somente uma proposta/rascunho demonstrativo, sem `applying` real. Os fluxos manuais `IC-CATS`, `IC-RULES`, `IC-MOVE` continuam distintos.

- **Seleção:** `Pendentes` / `Histórico` / `Todas`, busca e seleção devem usar o **mesmo conjunto filtrado**. Se o item selecionado sumir, selecionar o primeiro elegível ou mostrar empty state; nunca detalhe de proposta escondida pelo filtro.
- **Editor isolado:** editar nome, cor, termos, categoria alvo ou limite num draft; manter texto digitado ao trocar cor/filtro/item; `Cancelar` descarta somente o draft. `Salvar` incrementa `revision`, invalida previewVersion/consentimento e reavalia impactos. Nunca sobrescrever uma exclusão manual por causa de uma troca de cor.
- **Correspondências:** computar IDs no backend conforme critérios, escopo, overrides manuais e precedência de regras. Exclusões manuais persistem por ID enquanto ele continuar elegível; IDs que deixam de corresponder saem da prévia. Selecionar/desselecionar um item recalcula soma e contagem.
- **Escopos independentes:** `past=false` implica valor histórico afetado zero, mesmo que `future=true`. `future=true` não implica promessa de quantidade/valor futuro. Ambos falsos bloqueiam avanço; passado ligado sem itens e futuro desligado também bloqueia.
- **Limites:** `budget_change` não cria caixa, não representa economia e nunca atualiza o `spentCents` de origem. Teto igual ao anterior bloqueia proposta sem efeito.
- **Ambiguidade:** se descrições/perfis/fontes/IDs forem inconsistentes, bloquear e solicitar seleção específica, sem escolher a compra arbitrariamente.

## 3. Reconfirmação forte

1. `Prepare` retorna `previewVersion` e `revisionId` ligados a perfil, grant, fonte, conta, período, filtros, critérios, lista de IDs, exclusões, escopo e versão de escrita.
2. Modal mostra exatamente antes/depois, contagem, valor, escopo passado/futuro, fonte e efeitos possíveis. Checkbox **sempre começa desmarcada**, inclusive quando o usuário volta ao modal.
3. Mudar qualquer vínculo (filtros, conta, perfil, seleção, termos, regra, categoria, limite, grant expirado, data/snapshot) invalida autorização anterior e exige refazer prévia. A `confirm` captura deve ser rejeitada em qualquer mismatch.
4. Antes do apply, revalidar no serviço **de destino** o conjunto de afetados, o previewVersion e elegibilidade; em `stale/conflict`, parar e pedir nova confirmação.
5. A autorização é **por ato**, não autorização global para o LLM escrever. `IC-READ` jamais dá capacidade de escrever.
6. Categoria + regra + histórico têm etapas independentes. Mostrar sucesso parcial com detalhes reais ou rollback auditável; não declarar sucesso total quando parte falha.
7. Recibo verdadeiro só após resposta do backend, com operationId, data, fonte, contagem, IDs afetados, hashes/versões, status e elegibilidade de desfazer. Undo só se serviço validar; não inventar botão desfazer.
8. O `prototype.html` simula **somente** o estado de decisão revisada; não possui capability de write nem operaçãoId e portanto não exibe recibo real.

## 4. UI e estados

- Estado sem propostas: `Nenhuma revisão pendente` e acesso ao histórico, sem fila fictícia.
- `loading`: skeleton breve; `partial`: expor cobertura reduzida e bloquear conclusão que exija totalidade; `stale/expired`: nova prévia; `denied`: explicar sem pedir permissão desnecessária; `offline/error`: retry real.
- `deferred` significa **decisão local adiada**, não lembrete efetivamente agendado. Agendar no sistema só com integração que confirme o agendamento.
- `rejected` registra recusa, sem alterar dados financeiros. `reviewed` (no mock) representa apenas estado demonstrativo; não mapear para `applied` no banco real.
- Foco/teclado: botão fechar, Escape, foco inicial em modal, Tab contido, volta do foco ao disparador. No mobile modal pode preencher a tela.
- Tema dark/light, texto com contraste AA, ícones e valores legíveis, layouts responsivos e `prefers-reduced-motion`. Não exibir metadados internos na UX de cliente.

## 5. Proibições concretas

Sem chamada de `categoryReviewConfirm` no perfil pessoal se `status.available` é falso; sem transição `reviewed→applied` em resposta local; sem ativar `categorySave`, `ruleSave`, `bankCategorize` ou `bankBatch` por interpretação indireta da IA sem confirmação e política próprias. Não fazer merge na main ou EXE por aprovação visual. Não alegar que os cinco lançamentos de exemplo existem na conta real.

## 6. Testes exigidos

Ver [ACCEPTANCE.md](ACCEPTANCE.md) e [HANDOFF.md](HANDOFF.md). No pacote design foram testadas funções de seleção/validação em JS com fixtures sintéticos e estrutura do protótipo; **Electron e integrações reais ainda não foram testados**.
