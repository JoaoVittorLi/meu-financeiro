# Meu Financeiro 2.0 — Roadmap de produto em linguagem clara

**Edição:** 11 de novembro de 2026 · **Responsável:** Arquiteto Principal · **Referência de código na criação:** PR #39 (`310f374605d562f5163209c0a703efc3bc6de578`).  
**Situação deste documento:** proposta de priorização e experiência, **não é declaração de homologação**. O código e os resultados de testes permanecem sendo conferidos no GitHub.

> **Como ler este roadmap:** cada entrega responde a quatro perguntas: o que incomoda hoje, o que será diferente, por que isso importa e como saberemos se ficou bom. Os nomes antigos (V1.1, U5.3, F1, I2-A etc.) aparecem somente como referência interna, não são os nomes das entregas para o usuário.

## O que vamos entregar primeiro

**Objetivo imediato: Meu Financeiro Windows — Prévia completa.** Instalar uma versão única com Movimentações, Planejamento, Simulador, Visão Geral Premium e nova aba Inteligência, após corrigir sobreposições e verificar os dados financeiros. Não é necessário aguardar IA que conversa livremente, Radar real, nova marca MF nem paridade PWA para realizar essa prévia.

**Antes de gerar:** teste completo no código final, conferência de edição/vínculos/categorias/simulação, oito áreas sem cortes no Electron real, temas claro/escuro, backup e histórico de conversa; aprovação do proprietário para executar o Windows build. Não confundir testes de fixture Chromium/V8 com instalação real no Windows.

**Legenda de status:** **Código publicado; falta validar** = implementação detectada, ainda sem aceitação completa · **Parcial** = alguma função existe, melhorias ainda planejadas · **Planejado** = backlog, não codificado · **Adiado** = decisão explícita do proprietário.

## Linha do tempo em seis etapas

| Ordem | Etapa | Resultado percebido |
|---|---|---|
| 1 | **PRÉVIA COMPLETA** | A primeira entrega que vale instalar deve ser coerente, sem números enganosos e sem cards se atropelando. |
| 2 | **ROTINA MAIS SIMPLES** | Registrar, encontrar, revisar e organizar dinheiro com menos cliques e menos dúvida. |
| 3 | **DECISÕES MELHORES** | Transformar o histórico em decisões práticas e projeções confiáveis. |
| 4 | **INTELIGÊNCIA DE VERDADE** | Sair dos exemplos conceituais para análises verificáveis, perguntas sobre seus dados e ações somente autorizadas. |
| 5 | **DESIGN E SEGURANÇA** | Eliminar o legado visual sem sacrificar preferências pessoais, segurança ou familiaridade. |
| 6 | **MULTIPLATAFORMA / 1.0** | Conectar o desktop ao celular com segurança, sem anunciar paridade antes de testá-la. |


## 1. Etapa 1 — Deixar a versão atual pronta para você experimentar

A primeira entrega que vale instalar deve ser coerente, sem números enganosos e sem cards se atropelando.

### 1. Cartões com um destaque que faz sentido

**Situação:** Código publicado; conferir no Electron · **Responsável:** Executor 3

**O que resolve:** Hoje os indicadores mudam de destaque de forma inconsistente quando o mouse passa sobre eles.

**O que muda no app:** No estado normal, apenas a linha superior fica colorida. Ao passar o mouse, o cartão se aproxima discretamente e essa mesma cor percorre toda a borda; o interior continua escuro. Receitas em verde, despesas em vermelho, resultado conforme positivo/negativo/neutro.

**Como vamos perceber a melhoria:** Você percebe imediatamente qual cartão está destacado, sem cores inesperadas, sem saltos exagerados e sem um card cobrir o outro.

<details><summary>Referências do projeto</summary>

V1.1; PR #39

</details>

### 2. Telas alinhadas, sem sobreposições

**Situação:** Pendente de validação e correção · **Responsável:** Executor 3 / QA

**O que resolve:** Na Visão Geral alguns cartões não se alinham; na Inteligência, cards, botões e avisos se encostam ou parecem se sobrepor.

**O que muda no app:** Ajustar espaçamentos e distribuição de conteúdo nas oito áreas, começando pela Visão Geral e pela aba Hoje da Inteligência. Testar telas compactas, grandes, temas e escala do Windows.

**Como vamos perceber a melhoria:** Nenhum texto, botão, banner ou cartão invade o espaço de outro. A interface mantém a hierarquia mesmo sem movimentações ou com textos longos.

<details><summary>Referências do projeto</summary>

V1.2; screenshots do proprietário

</details>

### 3. Dinheiro correto e alterações protegidas

**Situação:** Código publicado; testes completos pendentes · **Responsável:** Executor 3 / Arquiteto

**O que resolve:** Uma data, valor ou categoria incorretos podem afetar saldo, calendário e confiança no aplicativo. Registros vinculados ao banco exigem cuidado extra.

**O que muda no app:** Conferir e preservar as proteções de edição/exclusão, valores em centavos, categorias, transferências, histórico bancário parcial, simulações desatualizadas e conciliação. Não contar duas vezes a mesma movimentação.

**Como vamos perceber a melhoria:** Ao editar ou planejar, o app nunca apresenta valores antigos como atuais nem altera silenciosamente dados bancários ou vínculos.

<details><summary>Referências do projeto</summary>

D1.5.1 + U5.1.1 + U5.2.1 + INT1

</details>

### 4. Verificação completa da versão integrada

**Situação:** Preflight novo pendente; QA Electron pendente · **Responsável:** Executor 3 / QA

**O que resolve:** As entregas existem em código, mas os testes anteriores do conjunto falharam e várias correções ainda não passaram na verificação oficial do HEAD atual.

**O que muda no app:** Executar os testes de todos os módulos, verificar entrada e saída, backup, atualização, histórico da Inteligência e falhas de armazenamento; depois percorrer as oito áreas no aplicativo Windows com dados fictícios.

**Como vamos perceber a melhoria:** Relatório por teste com aprovado/reprovado; capturas reais no aplicativo; problemas críticos resolvidos antes do instalador.

<details><summary>Referências do projeto</summary>

INT1.2/INT1.3; PR #39

</details>

### 5. Meu Financeiro Windows — Prévia completa

**Situação:** Próximo marco; aguardando autorização · **Responsável:** Arquiteto / Executor / QA

**O que resolve:** Você ainda não consegue experimentar num único programa as melhorias Premium, Movimentações, Planejamento e nova Inteligência.

**O que muda no app:** Reunir as funcionalidades aprovadas em instalador e versão portátil para Windows, conferir abertura e persistência de dados, publicar links e informar claramente o que a IA já faz e ainda não faz.

**Como vamos perceber a melhoria:** Você instala uma única versão, testa seus fluxos e consegue relatar problemas com referência exata da versão. Nada é anunciado como pronto sem artefato verificado.

<details><summary>Referências do projeto</summary>

Antigo R1; após gates e permissão do proprietário

</details>


## 2. Etapa 2 — Fazer a rotina financeira exigir menos esforço

Registrar, encontrar, revisar e organizar dinheiro com menos cliques e menos dúvida.

### 6. Movimentações fáceis de encontrar e corrigir

**Situação:** Parte importante já codificada; refinamentos pendentes · **Responsável:** Executor

**O que resolve:** Corrigir uma compra ou localizar uma transação pode demandar muitos cliques; alterações em lançamentos vinculados precisam de proteção.

**O que muda no app:** Consolidar edição completa de lançamentos manuais, exclusão confirmada, categorização diretamente na lista, filtros combináveis, revisão mais rápida, pesquisa e correção em lote somente com prévia segura.

**Como vamos perceber a melhoria:** Uma movimentação é encontrada e classificada sem sair da lista; erros manuais podem ser corrigidos; nenhuma exclusão acidental ou alteração do extrato original.

<details><summary>Referências do projeto</summary>

U5.1.1 + BUG-01 + proposta Revisão em cinco minutos

</details>

### 7. Orçamentos que avisam antes de estourar

**Situação:** Planejado · **Responsável:** Executor

**O que resolve:** Ver o limite depois de gastar não ajuda a decidir a tempo; categorias estouradas ou esquecidas exigem conferência manual.

**O que muda no app:** Mostrar ritmo de gastos versus o que seria esperado no momento do mês, tendências, categorias em risco e redistribuição assistida de valores entre orçamentos, com revisão antes de salvar.

**Como vamos perceber a melhoria:** Você identifica o risco cedo, entende de onde tirar dinheiro sem mascarar o total e pode ajustar seu orçamento sem planilhas auxiliares.

<details><summary>Referências do projeto</summary>

U5.3 + auditoria Orçamentos/Pace Engine

</details>

### 8. Minhas contas, dívidas e patrimônio em um só lugar

**Situação:** Planejado · **Responsável:** Executor

**O que resolve:** Saldo de conta, dinheiro disponível, dívidas e patrimônio são coisas diferentes; misturá-los cria falsa sensação de segurança.

**O que muda no app:** Separar contas e saldos, obrigações a pagar, patrimônio líquido, liquidez e faturas; mostrar data da última atualização e quando um valor não está disponível.

**Como vamos perceber a melhoria:** Você entende quanto possui, quanto deve e quanta informação está faltando, sem tratar dívida como saldo disponível.

<details><summary>Referências do projeto</summary>

U5.4 + auditoria Minhas Contas

</details>

### 9. Configurações simples, com privacidade explicada

**Situação:** Planejado · **Responsável:** Executor + Argon (visual)

**O que resolve:** Telas de configuração expõem termos técnicos, excesso de opções e catálogos de emojis/cores pouco coerentes.

**O que muda no app:** Organizar aparência, categorias, regras, notificações, backup, sincronização e IA em linguagem direta. Mostrar escolhas avançadas só quando necessárias, com explicação de seus efeitos.

**Como vamos perceber a melhoria:** Você encontra rapidamente o que deseja mudar, entende quais dados serão guardados e não perde preferências antigas sem aviso.

<details><summary>Referências do projeto</summary>

U5.3 + auditoria Configurações

</details>


## 3. Etapa 3 — Ajudar a decidir antes de gastar

Transformar o histórico em decisões práticas e projeções confiáveis.

### 10. Quanto posso gastar com segurança?

**Situação:** Planejado · **Responsável:** Executor + Arquiteto

**O que resolve:** Ter saldo positivo não significa ter dinheiro livre: ainda existem contas, compromissos e dados que podem estar desatualizados.

**O que muda no app:** Um indicador explicável de dinheiro potencialmente livre até o próximo recebimento, descontando compromissos identificados e informando o que não foi considerado.

**Como vamos perceber a melhoria:** Em vez de confiar no saldo bruto, você recebe uma visão útil para decidir — e um aviso claro quando faltarem informações para calcular.

<details><summary>Referências do projeto</summary>

F1 + IDEA-01/IDEA-07

</details>

### 11. Planejamento que mostra o que vem pela frente

**Situação:** Calendário melhorado; nova camada de decisões planejada · **Responsável:** Executor

**O que resolve:** É difícil descobrir de antemão quando o dinheiro ficará apertado ou qual conta ameaça o mês.

**O que muda no app:** Aprimorar a linha do tempo de compromissos, próximo recebimento, períodos de maior pressão, valores confirmados e estimados, alertas de pior dia e explicação da origem de cada número.

**Como vamos perceber a melhoria:** Você antecipa dias complicados e ajusta gastos antes de faltar dinheiro; projeção nunca é apresentada como saldo garantido.

<details><summary>Referências do projeto</summary>

U5.2.1 + F1 + auditoria Planejamento

</details>

### 12. À vista, parcelado ou antecipar?

**Situação:** Comparador existente; expansão planejada · **Responsável:** Executor

**O que resolve:** Comparar desconto no Pix, parcelamento, juros e rendimento de dinheiro guardado exige várias contas e premissas.

**O que muda no app:** Ampliar a simulação A/B para descontos à vista, parcelas, antecipação e CDI/Selic hipotéticos com impostos e taxas explicitados. Mostrar impacto no caixa por data.

**Como vamos perceber a melhoria:** Você entende a alternativa mais adequada às premissas inseridas, sem receber rendimento futuro tratado como promessa.

<details><summary>Referências do projeto</summary>

F2 + auditoria Simular Compra

</details>

### 13. Metas e reservas com progresso real

**Situação:** Planejado · **Responsável:** Executor

**O que resolve:** Guardar dinheiro para uma emergência ou compra futura é difícil sem saber o que já está comprometido.

**O que muda no app:** Metas com valor e prazo, progresso, aportes planejados, reserva de emergência e cenários de impacto no dinheiro livre.

**Como vamos perceber a melhoria:** Você acompanha quanto falta, quando pode alcançar a meta e se os aportes pressionarão seus próximos pagamentos.

<details><summary>Referências do projeto</summary>

F2 + propostas de metas/patrimônio

</details>


## 4. Etapa 4 — Fazer a Inteligência ser realmente útil

Sair dos exemplos conceituais para análises verificáveis, perguntas sobre seus dados e ações somente autorizadas.

### 14. Radar Financeiro: o que merece atenção hoje?

**Situação:** Planejado; exemplos atuais são fictícios e rotulados · **Responsável:** Argon

**O que resolve:** A aba Hoje ainda mostra assuntos genéricos; não avisa de fato sobre o que está acontecendo nas finanças do usuário.

**O que muda no app:** Substituir exemplos por alertas reais e explicáveis: compromissos próximos, orçamento em risco, recorrências, mudanças relevantes e dados faltantes. Limitar o excesso de alertas.

**Como vamos perceber a melhoria:** Você abre a Inteligência e encontra poucos avisos úteis, cada um mostrando período, fonte, motivo e o que conferir.

<details><summary>Referências do projeto</summary>

I1-C + IDEA-02/IDEA-05 + BUG-05

</details>

### 15. Converse com seu dinheiro

**Situação:** Interface de conversa pronta; motor real pendente · **Responsável:** Argon

**O que resolve:** Ter um chat bonito que não responde a perguntas financeiras reais não entrega a principal promessa da Inteligência.

**O que muda no app:** Permitir perguntas como 'por que gastei mais neste mês?' e 'o que compromete meu próximo salário?', usando somente dados autorizados, com explicações de cálculos e aviso de ausência de informação.

**Como vamos perceber a melhoria:** Você consegue perguntar e receber respostas fundamentadas nos seus dados permitidos. Conexão e custo de IA são informados, sem presumir API incluída no plano ChatGPT.

<details><summary>Referências do projeto</summary>

I2-A

</details>

### 16. Peça uma alteração à IA e decida se permite

**Situação:** Prévia sem gravação já existe; aplicação real pendente · **Responsável:** Argon + Executor (permissões)

**O que resolve:** Mudar categorias e organizar finanças pelo chat seria prático, mas executar comandos sem conferir pode ser perigoso.

**O que muda no app:** A IA localiza a movimentação correta, mostra antes/depois, solicita Permitir ou Negar e altera somente o que foi explicitamente aprovado; recusa quando houver dúvida ou dados alterados.

**Como vamos perceber a melhoria:** Negar não muda nada; permitir modifica apenas o item escolhido; uma confirmação retorna com resultado verificável e registro do que ocorreu.

<details><summary>Referências do projeto</summary>

I2-B + IDEA-14

</details>

### 17. Assistente que acompanha sem incomodar

**Situação:** Planejado · **Responsável:** Argon + Executor

**O que resolve:** Relatórios esquecidos e repetição manual de consultas reduzem a utilidade do aplicativo.

**O que muda no app:** Sugestões contextuais de orçamento/metas, resumo de revisão do período, alertas opcionais e controles claros de frequência, privacidade e custo.

**Como vamos perceber a melhoria:** Você recebe poucas sugestões úteis, pode desativá-las, revê o que foi recomendado e nunca sofre mudanças silenciosas no dinheiro.

<details><summary>Referências do projeto</summary>

I2-C/I3 + IDEA-04/IDEA-12

</details>


## 5. Etapa 5 — Aparência consistente, marca própria e confiança

Eliminar o legado visual sem sacrificar preferências pessoais, segurança ou familiaridade.

### 18. Um visual coerente nas oito áreas

**Situação:** Parcialmente modernizado; inventário legado pendente · **Responsável:** Argon (design) + Executor (integração)

**O que resolve:** Ainda existem cores roxas antigas, emojis decorativos e variações de componentes que parecem pertencer a versões diferentes.

**O que muda no app:** Uniformizar tipografia, ícones vetoriais, espaçamento, modo claro/escuro, contraste, cards, botões, drawers e estados vazios; respeitar cores personalizadas e significado de receitas/despesas.

**Como vamos perceber a melhoria:** A experiência parece um único produto, todas as telas são legíveis e nenhum ajuste estético muda o sentido de indicadores financeiros.

<details><summary>Referências do projeto</summary>

A-D7 + auditoria Complemento A1 + BUG-02/03/04

</details>

### 19. Identidade oficial Meu Financeiro

**Situação:** Adiada por decisão do proprietário · **Responsável:** Argon (marca) + Executor (aplicação)

**O que resolve:** A experiência Premium ainda usa marca/ícones provisórios e pode variar entre janela, atalhos e celular.

**O que muda no app:** Aplicar o monograma MF aprovado, versões claras e escuras, ícone do programa, atalhos e símbolos da PWA, com legibilidade em tamanhos pequenos.

**Como vamos perceber a melhoria:** Você reconhece o Meu Financeiro em qualquer dispositivo sem trocar a marca ou esconder preferências antes de aprovar os arquivos finais.

<details><summary>Referências do projeto</summary>

ID1; retomar somente após o Windows Preview

</details>

### 20. Dados protegidos e recuperáveis

**Situação:** Existem backups/proteções; revisão ampliada pendente · **Responsável:** Executor + Arquiteto

**O que resolve:** Perder histórico, misturar dados de demonstração com reais ou restaurar cópia incompleta prejudica a confiança.

**O que muda no app:** Fortalecer backup/recuperação, tratamento de erros, privacidade do histórico de IA, registros de autorização e comunicação de quais dados ficam apenas no computador.

**Como vamos perceber a melhoria:** Você sabe como recuperar suas informações e quando algo não foi salvo. Dados privados não são usados em testes nem exibidos por acidente.

<details><summary>Referências do projeto</summary>

Confiabilidade + risco residual I1-B

</details>


## 6. Etapa 6 — Seu financeiro em qualquer tela e a versão estável

Conectar o desktop ao celular com segurança, sem anunciar paridade antes de testá-la.

### 21. Windows e celular com as mesmas informações

**Situação:** Integração parcial já demonstrada; paridade completa pendente · **Responsável:** Executor + Arquiteto

**O que resolve:** Hoje a experiência e as funções disponíveis no computador e na PWA não são necessariamente equivalentes.

**O que muda no app:** Evoluir sincronização em ambas as direções, conflitos de edição, categorias, orçamentos, compromissos, contas, histórico e informação de última atualização, com comunicação de falhas.

**Como vamos perceber a melhoria:** Você usa PC e celular sem encontrar dados duplicados ou perdidos e sabe quando uma sincronização ainda não terminou.

<details><summary>Referências do projeto</summary>

Paridade Windows/PWA + Pluggy/Cloudflare

</details>

### 22. Meu Financeiro 1.0 — versão estável

**Situação:** Futuro; depende de validação do produto · **Responsável:** Arquiteto + Executor + QA

**O que resolve:** Uma prévia útil ainda não equivale a uma versão final confiável para uso cotidiano.

**O que muda no app:** Fechar os bugs de maior risco, medir estabilidade, testar instalação/atualização e restauração, finalizar design e documentação, validar equivalência das funções anunciadas.

**Como vamos perceber a melhoria:** Você recebe uma versão com histórico de testes, atualizações reproduzíveis e limitações documentadas; sem funções fictícias anunciadas como prontas.

<details><summary>Referências do projeto</summary>

Marco de qualidade pós-Premium Preview

</details>

## Critérios que valem para todas as entregas

- **Confiança acima de aparência:** qualquer valor exibido deve ter origem identificável; ausência de saldo não vira R$ 0,00 automaticamente; jamais duplicar despesas ou confundir transferência própria com renda.
- **O que for pessoal, só com autorização:** a Inteligência pode explicar e sugerir, mas só modifica algo após confirmação explícita, com alvo e efeito demonstrados. Conexão da conta não prova que conversação por IA funciona.
- **Comparar o antes com o depois:** usar tarefas e capturas reais por área, dados de demonstração, modo claro e escuro e janelas pequenas/grandes. Metas de redução de tempo/cliques são hipóteses até medirmos.
- **Não esconder o que falta:** separar código pronto, teste isolado, suíte oficial aprovada e instalador verificado. Não usar um resultado verde da beta.8 como aprovação automática de um novo commit.
- **Uma entrega por resultado útil:** não abrir uma nova aba quando o conteúdo couber numa área existente; não refazer tela já corrigida sem evidência de problema; preservar personalizações existentes.

## Histórico da auditoria Argon / Antigravity que permanece vinculado

A auditoria original da beta.8 analisou **8 áreas**, catalogou **88 componentes/cards**, produziu **85 screenshots**, relacionou **16 bugs/dívidas (BUG-01 a BUG-16)**, priorizou **24 iniciativas em quatro ondas**, especificou **10 inovações** e estimou avanço de nota global **7,48/10 para 9,46/10**. Essa nota futura é uma **projeção histórica da auditoria, não resultado medido na versão nova**. O contexto resumido foi preservado; o conteúdo integral do relatório de bugs/iniciativas não está todo transcrito no repositório consultado nesta edição. **Não inventar os IDs ausentes nem marcar como corrigido somente pela entrega de código.**

| Achado original identificado | Relação com o roadmap | Situação que pode ser afirmada |
|---|---|---|
| **BUG-01** — edição/exclusão de lançamentos manuais incompleta | Movimentações fáceis de encontrar e corrigir | Ações de editar e excluir estão no código atual; falta aprovação no Electron e regressões |
| **BUG-02** — drawer com contraste ruim no tema claro | Telas sem sobreposições / Um visual coerente | Revalidar no Electron real; não marcar encerrado |
| **BUG-03** — roxo neon no gráfico de Planejamento | Um visual coerente | Código do gráfico foi modernizado; confirmar visualmente, inclusive tema claro |
| **BUG-04** — roxo legado de categorias/gráficos | Um visual coerente | Padrões de cores modernizados; verificar registros antigos e personalizações |
| **BUG-05** — sugestões fictícias apresentadas como reais na Inteligência | Radar Financeiro | Exemplos da I1-B agora identificados como fictícios; **insights reais ainda pendentes** |
| **BUG-07** — compatibilidade histórica com TypeScript 6/F08 | Verificação completa | Projeto usa TypeScript 5.8.3; dívida de compatibilidade, conferir somente em upgrade planejado |
| **BUG-06, BUG-08 a BUG-16** | Inventário original da auditoria | **Detalhamento/estado ainda não recuperado; permanece PENDENTE DE RECONCILIAÇÃO**, não significa resolvido ou irrelevante |

### Compromisso com o inventário de 88 cards e as 24 iniciativas

Não substituir o diagnóstico original por ideias novas. Para cada item do pacote Antigravity, a próxima reconciliação deve preservar **ID, página, problema observado, gravidade original, entrega amigável relacionada, status da implementação, evidência e decisão**. Ler, quando disponíveis, especialmente `04-INVENTARIO-E-AVALIACAO-DE-CARDS.md`, `09-RELATORIO-DE-TESTES-E-BUGS.md`, `11-PRIORIZACAO-E-ROADMAP.md` e `AUDITORIA-DESIGN-LEGADO.md`. Não afirmar que os 16 itens estão concluídos sem esses relatórios e testes.

**Direção de produto preservada:** UI Premium discreta; contas/controle via dados confiáveis; Planejamento como antecipação; Simulador auditável; Inteligência com leitura, depois ações consentidas; funcionalidades brasileiras; PWA/Windows com paridade testada. O Laboratório de Inovação e o Registro de Ideias continuam como fontes de propostas, não aprovações automáticas.

## Atualizações e responsabilidades

- **Executor:** código financeiro, correções, testes oficiais, QA da interface, empaquetamento autorizado.
- **Argon:** experiência visual e módulos de Inteligência, sem modificar os mesmos arquivos do Executor em paralelo.
- **Arquiteto:** gate/integração, priorização, escopo, verificação de riscos e roadmap.
- **Proprietário:** aprovar o marco Windows Preview, ajustes de produto e marca quando chegar a hora.

**Política de atualização:** qualquer entrega deve indicar qual experiência melhorou, seu estado verificável e o link do PR/teste/captura; atualizar este documento e `docs/ROADMAP_MF2.md` sem transformar suposições em funcionalidades prontas.

**Documentos complementares:** [roadmap técnico e registro de estados](ROADMAP_MF2.md) · [blueprints de produto](ai-context/PRODUCT_BLUEPRINT.md) · [registro de ideias](ai-context/IDEA_REGISTER.md).
