# D02 — Etapa 2 · Estados, acessibilidade e QA visual

**Status:** `DESIGN_SPECIFIED`, aguardando revisão. Nem QA Electron nem integração de serviços foram realizados.

## Contrato transversal de estados

| Estado | Mensagem visual | Controle permitido | Proibição |
|---|---|---|---|
| loading | skeleton sem números inventados, progressivo | cancelar quando possível | mostrar dados fictícios de placeholder como resultado |
| ready | valor e evidência confiáveis | explorações permitidas | ocultar período material |
| empty | sem dados no período | alterar filtros / conectar fonte | desenhar gráfico vazio |
| partial | cobertura incompleta + quantia confirmada | detalhar faltantes | comparar como total completo |
| stale | timestamp e aviso contextual | atualizar/refazer consulta | chamar valor de “agora” |
| denied | sem autorização | solicitar permissão com contexto | inferir valores privados |
| offline | último dado conhecido, marcado como histórico | consulta local quando disponível | executar chamadas como se online |
| error | falha + ação reproduzível | tentar novamente | dizer que salvou |
| conflict | operações concorrentes mudaram prévia | revisar nova diferença | aplicar consentimento antigo |
| expired | consentimento/snapshot expirou | repetir conferência | autorização automática |
| applied | recibo após sucesso real | ver detalhes e desfazer elegível | sucesso antecipado |
| undo unavailable | razão e histórico | revisão manual | exibir botão funcional falso |

## Contraste e teclado
- WCAG AA: texto regular 4,5:1, texto grande e ícones essenciais 3:1.
- Todas as ações em botões nativos; foco visível; sem interação exclusiva por hover.
- Cards informativos sem `role=button` falso; charts com `aria-label` e alternativa tabular com números reais.
- Diálogos têm foco inicial, Escape e retorno do foco; ação de confirmação é controlada por revisão do usuário.
- Não depender de cor isolada para variação; usar sinal, direção e rótulo favorável/desfavorável.
- Skeleton respeita `prefers-reduced-motion`; não usar shimmer contínuo nesse modo.
- Formatação br: `R$ 0,00`, negativos contextualizados, separadores e datas localizados.

## QA por família e formato

26 famílias × 4 contextos × 2 temas × 5 estados prioritários (**ready, loading, empty, partial, stale**) = **1.040 combinações planejadas**, além de variações operacionais nos 12 estados completos. Esse número é matriz de cobertura, **não são 1.040 testes executados**.

### Gates mínimos
- Evidência: soma do gráfico = soma dos registros; duplicados, splits, transferências e PENDING/POSTED tratados corretamente.
- Fallback: valor zero, base zero, moeda mista, período faltante, operações indisponíveis, valores negativos, tipo inesperado, volume grande.
- Layout: 390×844 mobile PWA, 1366×768 e 1920×1080 Electron, zoom 125/150/200%, ausência de overflow horizontal.
- Motion: 140–260 ms suave, reduced motion, sem movimento visual que sugira sucesso de operação antes de retorno.
- Contrato de escrita: consentimento por operação, previewVersion, expirado/revalidação, recibo auditável e undo sem sobrescrever mudanças posteriores.
- Usabilidade: ações com rótulos claros para cliente; sem menu técnico persistente; histórico acessível e conservado.
- **Aprovação real:** checklist visual e QA são pendentes após implementação Electron.
