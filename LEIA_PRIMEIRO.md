# Meu Financeiro v0.9.3 — Atualização

1. Abra sua versão instalada e escolha **Configurações → Salvar cópia completa**.
2. Feche totalmente o aplicativo antes de executar `MeuFinanceiro-Instalador-0.9.2-x64.exe`.
3. Após instalar, confira saldos, categorias, compromissos e movimentações existentes. Sua conexão bancária anterior deve ser mantida.
4. Abra **Movimentações**: há abas para **Histórico**, **A revisar** e **Categorias e regras**. A revisão rápida marca uma movimentação como conferida sem abrir o painel lateral.
5. Na Visão geral, selecione **Mês passado** ou outro período e depois abra Movimentações: o intervalo deverá continuar selecionado. Em Orçamentos, a fonte e o mês serão exibidos explicitamente.
6. Em Simular compra, use **Planejar esta compra**. O compromisso só será criado depois de confirmar no formulário; o aplicativo não realiza pagamentos.
7. Na página Minhas contas, abra o histórico de uma conta pelo atalho **Ver movimentações desta conta**.

**Sem alteração destrutiva de banco:** a atualização concentra-se em navegação e interface. Seus dados pessoais seguem no SQLite local.

**Atenção:** dados bancários podem estar desatualizados; projeções e simulações não garantem saldo nem capacidade de pagamento. Faça backup antes de atualizar.

### Classificação inicial de movimentos
1. Abra Movimentações → Categorias e regras.
2. Clique em **Importar sugestões** e escolha `MeuFinanceiro_v0.9.3_Sugestoes_Inteligentes.json` baixado da conversa.
3. Confira a mensagem de sucesso. Uma cópia de segurança será criada automaticamente.
4. Os Pix genéricos passam à categoria Transferências, mas continuarão contabilizados como entradas/saídas até você alterar explicitamente sua natureza.
5. Verifique os lançamentos ambíguos no relatório CSV, sem presumir que são contas próprias, salário ou reembolso.
