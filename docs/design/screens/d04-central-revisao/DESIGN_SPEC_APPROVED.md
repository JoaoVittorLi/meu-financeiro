# D04 — Central de Revisão · Design final V1.1 aprovado

**Status:** `DESIGN_APPROVED / IMPLEMENTATION_READY` (**apenas design**).  
**Autorização do proprietário:** 13/11/2026 — “Aprovo a direção da D04 Central de Revisão V1. Faça o polimento visual final, revise as interações e prepare o handoff para o Executor.”  
**Polimento final:** V1.1, preservando composição/identidade/fluxo V1 aprovado. A V1.1 ainda precisa de QA Electron real pelo Executor; não alegar comparação pixel a pixel com a apresentação inline.  
**Issue:** #67 · **PR de documentação:** #57 · **Coordenação:** #49 · **Próxima tela de Design:** D05 Movimentações.

## Arquivos canônicos

- [prototype.html](prototype.html) — protótipo reproduzível e interativo da tela inteira, dados sintéticos isolados;
- [FIXTURES.json](FIXTURES.json) — três famílias de propostas e IDs de lançamentos;
- [BEHAVIOR_SPEC.md](BEHAVIOR_SPEC.md) — contratos de dados, segurança, estados e rascunho;
- [ACCEPTANCE.md](ACCEPTANCE.md) — o que foi validado e QA Electron pendente;
- [HANDOFF.md](HANDOFF.md) — instruções de execução C1/C2;
- [CHANGELOG.md](CHANGELOG.md) — versão aprovada, melhorias e limites.

## Design congelado

**Composição:** sidebar oficial Meu Financeiro; breadcrumb `Inteligência / Central de revisões`; hero discreto com pendências derivadas, sem cards inflados; **fila pesquisável à esquerda**; **detalhe à direita**; editor e reconfirmação modal sob demanda. Filtros `Pendentes / Histórico / Todas`. Não reintroduzir tabs pesadas do chat ou termos técnicos UI-*.

**Paleta herdada D01/D03:** background `#141414` (dark), `#f4f4f6` (light); superfície `#1a1a1a` dark / `#fff` light; texto `#fafafa` / `#171717`; verde `#53d896` / `#087e49`. Borda 1px discreta; cor esmeralda em item selecionado, prévia e reconfirmação. Vermelho usado somente como significado desfavorável/recusa; os cards não mudam de linguagem conforme severidade.

**Hierarquia:** primeiro `o que mudaria`, depois `itens/valor/escopo`, por fim `o que você decide`. Sem agrupamento excessivo de caixas ou lista de avisos técnicos.

**Editor:** campos nome e critérios de categoria (cor opcional), categoria alvo ou limite orçamentário. Rascunho isolado, sem alterações na proposta antes de `Salvar ajustes`. `Descartar` restaura valores; trocar cor, filtro ou item preserva rascunho. Após salvar, reconsultar correspondências/afetados na implementação real.

**Prévia:** antes/depois lado a lado; cada linha tem descrição, data, categoria atual, valor e checkbox. Contagem/soma recalculadas em centavos após exclusão; escopos `organizar anteriores` e `categorizar futuras` **independentes**. Alteração de critérios pode mudar correspondências, mas uma exclusão manual continua excluída se o item ainda corresponder.

**Conferência:** modal V1.1 com escopo, valor, versão e checkbox desmarcada ao entrar. `Concluir revisão` no protótipo altera **só o status local demonstrativo**; não é um apply real. No app, `Aplicar` somente se `capability` real e reconfirmação fresca. Com perfis pessoais sem autorização, CTA de escrita deve aparecer indisponível ou permanecer apenas em fluxo manual explícito separado.

**Concluídas:** estados `revisada, recusada, adiada` com mensagens e histórico claros; **não** inventar agendamento de notificação para `Adiar`.

**Animações:** interação 150–170ms; entrada contextual 180–220ms; `prefers-reduced-motion` elimina animações. Contraste explícito em ambos temas; modais com Escape, foco e tab order; mobile em uma coluna.

## O que foi efetivamente executado no design

- Sintaxe JavaScript de `prototype.html` compilada com êxito após correções.
- **12 testes isolados** das funções de estado: cinco itens R$177,50; exclusão R$21,90 → R$155,60; recálculo ao editar critérios; escopo futuro sem passado; ambos os escopos desligados; recategorização sem registros; orçamento inalterado; filtro de histórico sem pendentes; semântica do modal/reduced motion.
- Correções adicionais posteriores: preservação do nome/termos ao trocar cor e retenção de rascunho ao alternar fila; validadas por parse JS, **sem teste browser completo**.
- Nenhuma verificação Playwright, screenshot Electron, implementação TypeScript, integração SQLite, edição real, deploy ou EXE.

## Critério de encaminhamento

Esta versão é o **handoff fiel à direção V1 aprovada**, com polimento; sua aprovação é de design, não de produto instalado. Engenharia só pode declarar `IMPLEMENTED / HOMOLOGATED` após renderização real e QA em branch de integração.

**Próxima tela de design:** **D05 — Movimentações**. Design não deve ficar bloqueado pela implementação D04, mas o Arquiteto/Integrador precisa acompanhar os conflitos entre PRs e os contratos de leitura/escrita.
