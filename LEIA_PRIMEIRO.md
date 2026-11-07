# Primeiro acesso — Meu Financeiro v0.7.0

1. Na versão anterior, abra Configurações e **Salve uma cópia completa**. Guarde o arquivo SQLite em lugar seguro.
2. Instale a v0.7.0 sem excluir a pasta de dados. Abra o app e confirme que suas contas, categorias e lançamentos continuam presentes.
3. Abra **Revisar movimentações** na barra lateral. Escolha uma compra e clique nela para abrir os detalhes.
4. Ajuste o estabelecimento, a categoria, a natureza e as anotações. Marque **Conferi esta movimentação** e salve.
5. Para dividir uma compra, adicione duas ou mais partes e confira que a soma é exatamente igual ao valor total.
6. Para evitar dupla contagem manual, vincule um lançamento pessoal que corresponda em valor, direção e data próxima. O aplicativo não vincula nada automaticamente.
7. Para uma transferência entre suas contas, verifique os dois lançamentos sugeridos antes de selecionar **Marcar ambas**.

## Segurança

O extrato importado é preservado; suas preferências ficam em tabelas adicionais do SQLite. Uma alteração do banco em valor, descrição ou status devolve o item à revisão. Credenciais não fazem parte dos backups SQLite.

## Quando algo parecer errado

Abra Configurações → Salvar cópia completa e comunique o problema. Não apague a pasta do aplicativo. Uma prévia gerada em navegador de teste foi validada com dados fictícios, mas os cliques finais e a instalação precisam ser confirmados em seu Windows.
