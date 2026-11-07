# Meu Financeiro v0.8.0 — Leia antes de instalar

1. Abra a v0.7 e faça **Configurações → Salvar cópia completa**. Guarde o arquivo `.sqlite` em pasta segura.
2. Feche o Meu Financeiro e instale a v0.8. A instalação não remove seus dados nem exige reconectar o banco.
3. Abra **Planejamento**. Crie uma despesa ou receita futura e confira como ela altera o saldo de cada dia.
4. Para contas recorrentes, selecione semanal, mensal ou anual e a quantidade de ocorrências (até 36). Para compras parceladas, informe **o valor total** e a quantidade de parcelas.
5. Quando um pagamento aparecer entre as movimentações bancárias confirmadas, aceite uma sugestão de conciliação ou procure a movimentação no painel do compromisso. Nada é vinculado automaticamente.
6. Caso confirme pagamento manual sem vínculo, certifique-se de que ele **já foi descontado/adicionado ao saldo atual**; do contrário sua projeção ficará imprecisa.

## Proteções e limites

- Valores bancários originais permanecem imutáveis. Nomes personalizados são armazenados em outra tabela.
- Um pagamento confirmado não pode ser associado simultaneamente a dois compromissos nem a um vínculo manual existente.
- Pagamentos parciais deixam apenas o valor restante na projeção; pagamento completo elimina essa previsão.
- Rejeitar uma sugestão impede que a mesma combinação seja oferecida novamente.
- Se o banco voltar a marcar uma movimentação como pendente ou alterar seu valor, o compromisso volta a apresentar o valor não quitado.
- Períodos futuros disponíveis: do dia atual até aproximadamente 12 meses à frente. Recorrências são geradas explicitamente até 36 ocorrências.
- Não há operações bancárias, pagamentos nem transferências pelo aplicativo.
- Projeções são estimativas sobre o último saldo informado; contas com saldo desatualizado podem produzir conclusões incorretas.
- O histórico bancário bruto e as categorias da versão anterior permanecem intactos.

Em caso de problema, mantenha o backup e não exclua a pasta de dados do aplicativo. Os testes automatizados são uma etapa de proteção, mas o comportamento do instalador precisa ser confirmado no seu Windows.
