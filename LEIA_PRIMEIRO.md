# Meu Financeiro v0.9.0 — orientações para atualização

1. **Faça backup completo SQLite** na versão instalada antes de atualizar.
2. Feche completamente o aplicativo antigo.
3. Instale o arquivo `MeuFinanceiro-Instalador-0.9.0-x64.exe` da Release privada no GitHub, ou use a versão portátil.
4. Confira o histórico bancário, categorias, compromissos, vínculos e backup em Configurações.
5. Abra **Movimentações** e veja as abas **Todas as movimentações** e **A revisar**.
6. Abra **Simular compra**. O comparativo usa o planejamento realmente cadastrado, mas **não é garantia** de capacidade de pagamento.

**O que não muda:** conexão pessoal com Meu Pluggy, dados do Itaú, extratos originais, categorias e planejamentos anteriores. O novo detector de duplicatas mostra alertas para sua conferência, mas não apaga dados.

**Limitações:** saldo bancário pode estar atrasado em relação ao banco; extrato em tela limitado às 2.500 linhas mais recentes; histórico completo armazenado continua consultado nos indicadores. Simulador não cria dívidas reais; recorrências cadastradas têm horizonte finito; não há criptografia adicional no arquivo SQLite. Se algum cálculo parecer estranho, confira a data de atualização do banco e os pagamentos planejados antes de tomar uma decisão.
