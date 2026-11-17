# D03 — Inteligência Hoje · Design aprovado V2 (polimento final)

**Estado do design:** `DESIGN_APPROVED / IMPLEMENTATION_READY` (somente design).  
**Aprovação explícita do proprietário:** 13/11/2026 — “Aprovo a D03 Inteligência Hoje V2, incluindo o design premium uniforme e a lógica de prioridades dinâmicas. Faça o polimento final, registre a aprovação visual e prepare o handoff para o Executor.”  
**Código de produção:** `NOT_IMPLEMENTED` neste pacote. **Não** há homologação Electron, PR de engenharia, build ou habilitação de escrita por IA.  
**Issue de design:** #61 · **Coordenação:** #49 · **Pacote documental PR Draft:** #57.  
**Protótipo canônico interativo:** [prototype.html](prototype.html) · [fixtures](D03_V2_APPROVED_FIXTURES.json) · [comportamento](BEHAVIOR_SPEC.md) · [aceite](ACCEPTANCE.md) · [Executor](HANDOFF.md).

## 1. Composição completa e congelada

1. **Sidebar**: mesma navegação, proporções e hierarquia do Meu Financeiro aprovado; aba Inteligência ativa. Não é uma interface de desenvolvedor.
2. **Topo**: título “Inteligência”, data do contexto, ação “Ajustar previsão”, alternância dark/light e “Conversar”.
3. **Hero contextual**: título, explicação e indicador **dependentes da projeção**. Quando há folga, mostrar a folga **acima da margem**; no aperto, mostrar projeção **após pagamentos**; sem saldo confiável, não mostrar valores fictícios.
4. **Coluna principal**: até três sinais priorizados, todos renderizados pela **mesma primitiva visual** `SignalCard`. A 3ª carta esmeralda da V1 é a fonte da direção artística aprovada: plano esmeralda sutil, borda de contraste leve, raio 17 px, mesmo padding e hover; só semântica do valor/ícone muda. **Não** recriar cartões vermelho/cinza de estilos incompatíveis.
5. **Coluna lateral**: agenda com próximos compromissos autorizados, valores, status e data; bloco de proposta de categoria em fase de revisão.
6. **Exploração contextual**: drawer à direita, sob clique. Não ocupa espaço fixo no panorama. Contém análise, simulação de reserva, revisão de limites, agenda, preview de regra ou conversa contextual.
7. **Rodapé contextual discreto**: oportunidade de conversar, sem substituir a D02.

**Proibido:** abas persistentes `Hoje / Conversar / Plano de ação` no workspace; metadados internos como `UI-03`, “Dados de teste” em chips no cabeçalho, 8 cards com peso idêntico, prompts estáticos repetidos, análise de outra pessoa, valores da IA não comprovados, aplicação de categoria sem reconfirmação.

## 2. Tokens visuais (herdar D01/D02)

| Token | Escuro | Claro |
|---|---|---|
| Canvas | `#141414` | `#f4f4f6` |
| Surface | `#1a1a1a` | `#ffffff` |
| Raised | `#202328` | `#f4f4f5` |
| Hover | `#2b2d32` | `#ebebed` |
| Border | `#303034` | `#e5e5e8` |
| Texto principal | `#fafafa` | `#171717` |
| Texto secundário | `#b1b1ba` | `#64646e` |
| Positivo | `#53d896` | `#087e49` |
| Desfavorável | `#ff7a88` | `#c92a3c` |
| Alerta | `#f5bc63` | `#975b00` |
| Superfície esmeralda | `#173329` | `#e8f8ef` |

`SignalCard`: background = `linear-gradient(115deg, color-mix(in srgb, var(--green) 11%, var(--surface)), var(--surface) 81%)`; borda = `color-mix(in srgb, var(--green) 24%, var(--border))`; raio 17px, padding 18px. **As três prioridades usam exatamente essa estrutura**, sem converter alertas em cards vermelhos opacos. Ícone e numeral podem ser vermelhos/âmbar/verdes conforme sinal. Título sempre explicitamente `--text`.

Dinheiro: tabular nums, sem truncar valores. Barra possui trilho em elemento isolado; não sobrepor texto. Heat scale vermelho→amarelo por aumento comparável vale apenas em ranking de crescimento, **não** no painel geral de prioridades.

## 3. Conteúdo e evidência

Prioridades são **derivadas dos dados** (não rótulos rígidos): insuficiência projetada, margem abaixo do mínimo, folga para reserva hipotética, limite ultrapassado e aumento comparável. Exibir de zero a três recomendações **válidas**, com título e CTA específicos, explicação curta e valor cujo tipo esteja claro. Agenda/revisão só aparecem quando há informação real autorizada; não manter os R$ 443 e R$ 177,50 fixos na produção.

A fonte de `FinancialSnapshot` é controlada por leitura autorizada e validação de cobertura; a IA pode redigir leitura **sobre fatos fornecidos pelo resolver**. O LLM não pode fornecer valor, id, total ou data de compromisso como única fonte de verdade. Detalhes em [BEHAVIOR_SPEC.md](BEHAVIOR_SPEC.md).

## 4. Polimento final após aprovação

- Alto contraste: o problema da V1 de texto invisível no dark foi eliminado com cor principal explícita para títulos, valores e botões.
- Estado `margem muito próxima` priorizado antes do alerta secundário de gastos, sem prometer economia; mantém todas as famílias no mesmo desenho.
- Drawer com Escape, botão de fechar, retorno de foco e ciclo básico de Tab; QA profundo de tecnologias assistivas depende de testes Electron.
- Microinterações 150ms hover, 200–240ms entrada/reordenamento; `prefers-reduced-motion` anula movimento. Não animar valor antes de resolver a fonte.
- `prototype.html` reproduz a tela completa e controles sintéticos; **não reivindicar pixel-perfect entre o inline V2 do chat e o arquivo final**.
- Footer de contexto da demonstração fica em disclosure; o usuário do aplicativo real não deve ver metadados técnicos.

## 5. Aprovação e limite dela

**Concluído:** direção visual D03 V2 aprovada pelo proprietário; protótipo HTML canônico e contrato de integração documentados, cenários determinísticos verificados em JS.  
**Pendente:** screenshot/QA real Electron, corretude de seletores no produto, camada local de resolução de dados, consentimentos, layout real em dispositivos, avaliação por leitor de tela. **Não** interpretar `IMPLEMENTATION_READY` como `IMPLEMENTED`.

**Próxima tela para Designer:** D04 — Central de Revisão. A implementação da D03 será realizada separadamente pelo Executor sob coordenação do Arquiteto.
