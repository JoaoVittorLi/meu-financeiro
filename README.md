# Meu Financeiro v0.9.3 — Linha do tempo e categorias inteligentes 💜

Aplicativo financeiro pessoal para Windows x64, com Electron, React/TypeScript e SQLite local. Integração bancária somente leitura por meio de uma conta pessoal do Meu Pluggy.

## Atualização v0.9.3

- **Gráfico interativo**: a própria bolinha é o controle; arraste com mouse/touch ou use setas/Home/End no teclado. Sem barra slider duplicada.
- **Eixo vertical consistente**: se todos os saldos forem não negativos, o gráfico não mostrará um valor mínimo negativo artificial.
- **Novas categorias**: Transferências, Rendimentos e Reembolsos (com emojis). Categoria não altera automaticamente a natureza: Pix para terceiros continua despesa/receita até revisão.
- **Classificação assistida, local e opcional**: em Movimentações → Organização, use “Importar sugestões” com arquivo JSON preparado a partir do histórico. O aplicativo cria backup, aplica regras editáveis, verifica correspondências e não sobrescreve correções individuais.
- **Privacidade**: o pacote com classificações do extrato particular não é incluído no GitHub e deve ser guardado privadamente.

## Funcionalidades mantidas

- Menu principal com **seis áreas**: Visão geral, Movimentações, Planejamento, Orçamentos, Simular compra e Minhas contas. Configurações permanece no rodapé.
- **Movimentações** reúne Histórico, A revisar e Categorias e regras. As categorias não foram excluídas; mudaram de lugar.
- **Revisão rápida** com um clique na linha, além do painel de detalhes completo. Alterações só atingem classificações locais; movimentações originais do banco permanecem intactas.
- **Período compartilhado:** a Visão geral e o histórico de Movimentações preservam o intervalo selecionado. Orçamentos usa o mês correspondente e sempre indica claramente o mês e a fonte ativa.
- **Fonte explícita nos Orçamentos** e na Visão geral: dados bancários confirmados ou registros manuais. As duas fontes não são somadas automaticamente.
- **Simular compra → Planejamento:** o botão “Planejar esta compra” pede confirmação e abre um formulário preenchido com o valor total com juros, número de parcelas e vencimento. Nenhuma obrigação é registrada até o usuário clicar em Salvar. O cadastro de planejamento aceita até 36 parcelas.
- **Minhas contas** foca em contas, saldos e sincronização. O extrato completo fica na página Movimentações; cada conta possui acesso direto ao seu histórico filtrado.
- Botão global **Adicionar**, seletor de emojis compacto e atalho **Esc** para sair dos principais formulários.
- Evolução financeira preservada da v0.9.1: gráfico de saldo por mês com slider e variação diária, histórico estimado (não confirmado), motor de projeção e conciliação manual.

## Fluxos sugeridos

1. Na **Visão geral**, selecione o período desejado. Clique em **Movimentações** para investigar o mesmo intervalo.
2. Para conferir uma compra, abra **Movimentações → A revisar** e use **✓ Revisar** ou abra os detalhes para classificar e vincular.
3. Para personalizar categorias, use **Movimentações → Categorias e regras**. A paleta inicial tem os emojis principais; **Explorar todos os emojis** abre a coleção completa.
4. Em **Simular compra**, analise os cenários e, se desejar, escolha **Planejar esta compra**. Confira o formulário e salve somente se decidir registrar a previsão.
5. Em **Minhas contas**, utilize **Ver movimentações desta conta** para abrir o extrato com o filtro correspondente.

## Desenvolvimento e testes

```powershell
npm install
npm run compile
npm run test:db
npm start
```

O GitHub Actions gera o instalador e o executável portátil Windows. As verificações automáticas cobrem os testes do banco, a compilação TypeScript e o empacotamento. Testes de experiência em Chromium podem ser executados com o Playwright e Python em ambiente de desenvolvimento; isso não é necessário para usar o aplicativo.

## Segurança e limitações

- O banco SQLite e suas cópias completas contêm dados financeiros sem criptografia adicional. Proteja o computador e guarde os backups em local seguro. As credenciais da integração são protegidas separadamente pelo Windows.
- Saldos e extratos fornecidos pelas instituições podem chegar com atraso. O aplicativo apresenta estimativas e não garante capacidade de pagamento.
- O histórico de contas pode ser parcial; agregados por período utilizam os registros disponíveis localmente, não um extrato bancário de cobertura necessariamente completa.
- A lista bancária carrega até 2.500 movimentações recentes; agregações por período consultam todo o histórico local salvo.
- O planejamento aceita até 36 parcelas; o simulador é uma avaliação que pode examinar mais meses. A conversão para compromisso exige confirmação.
- Recorrências cadastradas são finitas. Vinculações, classificações e conciliações devem ser verificadas pelo usuário. Não há transferências reais nem pagamentos automatizados.
- **Antes de atualizar, salve uma cópia completa do SQLite e feche a versão anterior.**
