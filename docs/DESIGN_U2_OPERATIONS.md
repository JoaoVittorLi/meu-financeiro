# U2 — Movimentações e Planejamento

Implementação de 09/11/2026. Continuação da U1 na branch `design/despezzas-d1-d4`, PR #16. Identificação visual: rodapé **Interface U2**, versão do aplicativo 0.9.5-beta.6.

## Composição e conteúdo

A linguagem visual segue a base já mapeada do Despezzas: superfícies neutras, bordas discretas, hierarquia compacta e cores semânticas restritas a receitas, despesas e estados. `app/operations.css`, carregado após os estilos anteriores, limita as alterações às duas áreas. Os temas claro e escuro usam os tokens compartilhados. Layout adaptável, navegação por botões nativos e estados selecionados acessíveis.

### Movimentações

- Cards de entradas confirmadas, saídas confirmadas, resultado dos registros e pendências bancárias. O resultado é explicitamente diferente de saldo disponível.
- Valores calculados sobre os registros carregados que atendem aos filtros de período, conta, origem e busca, antes do limite de 500 linhas da tabela.
- Resumos de banco e manual permanecem separados. Quando as duas origens aparecem, é possível escolher a origem do resumo. Um lançamento manual vinculado não é somado novamente ao resumo bancário.
- Somente transações POSTED compõem entradas/saídas do banco; naturezas transferência/desconsiderada ficam fora dos valores. Revisão é uma dimensão independente do processamento bancário.
- A caixa de revisão considera todos os períodos carregados e informa esse escopo; o contador da tabela considera os filtros. Histórico parcial e limite de exibição têm avisos explícitos.
- Tabela preserva edição de categoria, divisões, nome original, detalhes, revisão em lote e identificação por conta + ID externo. Alterar conta/origem limpa a seleção em lote.

### Planejamento

- Agenda agrupada por dia em ordem cronológica; alternância entre Agenda, Calendário e Projeção diária.
- Cards do mês selecionado: despesas a pagar, receitas confirmadas a receber, despesas vencidas e despesas dos próximos sete dias que pertencem ao mês.
- Cards usam `remaining`, respeitando quitações parciais. Excluem itens pagos/cancelados e receitas incertas do total confirmado. Uma agenda não carregada é distinta de uma agenda carregada e vazia.
- A faixa superior dos próximos sete dias conserva seu intervalo explícito, independentemente do mês selecionado. O calendário mostra contagens e abre os registros do dia, sem misturar previsões e pagamentos em um total financeiro.
- Pagamentos bancários já vinculados a um plano aparecem sob o compromisso na agenda consolidada. O modo Banco permite consultar o registro original. Um vínculo bancário ainda PENDING não oculta o lançamento manual.
- Projeção usa o cenário canônico completo; busca e filtro da agenda não modificam seu cálculo. Receita incerta é uma opção do cenário. Alertas de saldo desatualizado/incompleto e dias negativos permanecem visíveis.
- Limite de 350 registros é aplicado apenas à lista exibida, com aviso; calendário e contagens usam todos os resultados filtrados.

## Verificação executada

- TypeScript 5.8.3: compilação e tipos aprovados.
- F08: bundle recompilado virtualmente coincide com as seis entradas do compilador.
- Desktop: **214/214 testes aprovados**, incluindo seis novos testes de escopo, liquidação/revisão, origens, limite de linhas, vínculos por conta, pagamentos parciais, calendário, alternância de apresentação e ausência de gravações durante a renderização.
- Worker/PWA: **129/129 testes aprovados**.
- Regressão de arquivo ASAR real: **1/1 aprovada**.
- Inspeção de composição por renderização estática dos componentes compilados com dados fictícios em tema claro/escuro. O renderizador de impressão requer adaptações de layout e não equivale ao Chromium/Electron; essa inspeção não certifica fidelidade de pixels ou interação no app.

## Limitações e próxima revisão

Nenhum instalador Windows foi gerado ou executado nesta entrega. Este ambiente Linux não dispõe de runner Windows/Wine; o navegador local também não inicia neste ambiente. As execuções recentes consultadas na branch pelo GitHub não disponibilizaram um build Windows desta entrega. Não houve acesso ao PC, banco de dados pessoal ou app instalado do usuário.

O EXE deve ser produzido pelo pipeline Windows existente, com `run_windows_build=true`, mantendo os testes e a prova de correspondência do ASAR. Revisar depois no Windows: 1366×768 e telas amplas; temas claro/escuro; foco/teclado e dropdowns; tabela com nomes extensos; calendário nas bordas do mês; alertas e projeção; abertura dos detalhes e seleção em lote. Esta pendência impede declarar homologação visual final ou release instalável.

Próxima implementação: **U3 — Orçamentos, Contas e Simulador**, seguida pela adaptação da composição no PWA (U4). A U2 altera o renderer desktop; os 129 testes aprovados da PWA verificam regressões, não significam que sua UI recebeu estas mudanças. Integração de IA em paralelo permanece fora do escopo desta entrega.
