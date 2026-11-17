# D04 — Central de Revisão V1.1 · Matriz de aceite

**Status:** `DESIGN_APPROVED / IMPLEMENTATION_READY`; Electron `NOT_IMPLEMENTED` neste PR.  
**Referência aprovada:** direção V1 explicitamente aceita em 13/11/2026, com V1.1 polida por solicitação do proprietário.

## 1. Evidência executada no pacote de Design

**Método real:** leitura de `prototype.html` publicado no GitHub, parse JS embutido e execução isolada das funções de modelo de seleção, elegibilidade e filtragem com fixtures sintéticos. Nenhum navegador/Playwright/Electron foi executado. **12 checks funcionais passaram**:

| Cenário | Resultado observado |
|---|---|
| Assinaturas cinco candidatas | PASS — 5 itens, R$177,50 |
| Excluir Spotify de R$21,90 | PASS — 4 itens, R$155,60 |
| Mudar critérios para somente Spotify mantendo exclusão | PASS — zero item selecionado |
| Retirar exclusão | PASS — 1 item, R$21,90 |
| Desativar histórico mantendo futuras | PASS — zero valor histórico, regra futura elegível |
| Desativar os dois escopos | PASS — não permite confirmar |
| Recategorizar compra sem item | PASS — bloqueia |
| Recategorizar compra com item | PASS — elegível |
| Propor limite igual ao atual | PASS — bloqueia |
| Propor R$800 após R$700 | PASS — elegível |
| Filtrar Histórico sem itens históricos | PASS — seleção oculta limpa; não mostra detalhe de pendente |
| Presença estrutural de modal acessível e reduced motion | PASS — marcação/CSS presentes, **não** teste de leitor de tela |

**Revisões posteriores aplicadas:** trocar cor não perde nome/termos; draft digitado acompanha troca de fila; `prototype.html` reparseado sem erro. Essas correções **não** tiveram execução end-to-end de eventos DOM em Chromium, portanto não chamar de "botões 100% testados".

## 2. Gate visual (Design congelado)

- [x] Proprietário aprovou a direção artística, a fila à esquerda e o detalhe à direita.
- [x] Polimento uniforme D01/D02/D03: background esmeralda discreto em seleção/diff/preview, títulos explícitos claros, mesmas cores em dark/light.
- [x] Reconfirmação premium com resumo e checkbox inicialmente desmarcada, no HTML.
- [x] Recibo verdadeiro não é falsificado; conclusão da demonstração é identificada como **local**.
- [x] Lista de afetados e scope independentemente representados.
- [x] Sem UI técnica ou indicadores de desenvolvedor na parte principal.
- [x] `prefers-reduced-motion` definido e responsividade na folha CSS.
- [ ] QA de screenshots reais Chromium/Electron, contrast checker e screenreader **NÃO EXECUTADOS**.

## 3. Gates de Engenharia — OBRIGATÓRIOS E PENDENTES

- [ ] Capturas reais Electron 1366×768 e 1920×1080, dark/light, com SHA e comandos/testes.
- [ ] Alinhamento da fila, breadcrumb, cards, diff, somas e modais sem sobreposição no dark/light.
- [ ] Testar todas ações de `Pendentes/Histórico/Todas`, busca incluindo resultados zero, troca de seleção e rascunho persistente.
- [ ] Editor: cor/nome/termos/valor, descartar rascunho, salvar e revalidar lista, conflito de regra, nomes vazios, valores inválidos, exclusões manuais persistentes.
- [ ] Checkbox de escopo histórico desligado implica impacto histórico R$0. Verificar futuro separado e ambos falsos bloqueados.
- [ ] Nomes, valores e contagens derivados do mesmo conjunto de IDs; não usar contagem visível de página como total canônico.
- [ ] Reconferência: checkbox reinicia desmarcada em cada abertura; mudar critérios/seleção/conta/grant invalida versão anterior.
- [ ] Backend exige validação de `previewVersion`/grant/profile/IDs sob concorrência antes de aplicar; conflito devolve nova prévia.
- [ ] `IC-REVIEW` sintético e pessoal separados; escrita pessoal por IA bloqueada se não autorizada; caminhos manuais IC-CATS/IC-RULES/IC-MOVE preservados.
- [ ] Rejeitar/ad iar no mock e no app conforme capability; não inventar agendamento de reminder.
- [ ] Receipt real apenas se servidor confirmar idempotência, operação e undo elegível; falhas parciais não são recibo de sucesso total.
- [ ] Keyboard, Escape, focus trap, focus restore, reader, contraste WCAG AA; mobile drawer/modal responsivo, reduced-motion, zoom 200%.
- [ ] Suite TypeScript/SQLite/Node, F08/ASAR, Electron sintético e smoke oficial; todos PASS/FAIL/NOT_RUN relatados honestamente.
- [ ] Sem regressão dos fluxos originais da Central, planejamento, movimentações e chat lateral/principal.

## 4. Critérios de falha bloqueante

- Conteúdo invisível em dark ou texto sobreposto; botão visível sem handler.
- Rascunho perdido ao trocar cor/filtro ou ao voltar para proposta.
- Contagem/soma não coincidem com IDs, exclusão reaparece sem motivo.
- Escopo futuro aplicado como alteração histórica automática.
- Confirmação reutilizada após mudança, grant expirado ou preview stale.
- Aplicação no perfil real sem autorização explícita válida.
- Mensagem "aplicado" ou "desfeito" sem retorno real de serviço.

## 5. Status correto

Aprovação **visual e de interação conceitual**, não código Electron homologado. **Nenhum merge, build Windows, EXE ou gravação pessoal da IA** foi produzido por este pacote de Design.
