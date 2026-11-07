# Meu Financeiro v0.8.0 — Central de Planejamento 💜

Aplicativo pessoal para Windows (Electron + React/TypeScript + SQLite), com sincronização somente leitura das contas autorizadas e planejamento financeiro local.

## Novidades v0.8

- **Planejamento**: nova central que reúne compromissos futuros, movimentações bancárias confirmadas e lançamentos manuais existentes.
- **Linha do tempo diária**: selecione um dia do mês corrente ou dos próximos 12 meses e acompanhe saldo inicial, entradas, saídas e saldo final estimado.
- **Lançamentos planejados**: receitas, despesas, datas, valores, categorias, notas, conta associada e grau de certeza.
- **Recorrências**: semanais, mensais ou anuais; cada ocorrência pode ser editada separadamente, preservando as demais.
- **Parcelas**: valor total dividido exatamente em centavos, até 36 parcelas mensais.
- **Conciliação**: sugestões por data, valor e descrição com confirmação manual; também é possível procurar e vincular um pagamento específico, ignorar sugestões e desfazer vínculos.
- **Pagamentos parciais**: um compromisso aceita múltiplos pagamentos confirmados até atingir o valor planejado. Se o valor pago for diferente, ajuste explicitamente o valor do compromisso; não é modificado automaticamente.
- **Nome personalizado**: título independente da descrição bancária original (que permanece inalterada).
- **Alertas**: saldo projetado negativo, vencidos e dados bancários desatualizados.
- **Cenários**: receitas estimadas ficam fora da projeção conservadora até o usuário optar por incluí-las.
- **Histórico de mudanças**: registros de criação, edição, conciliação, cancelamento e reativação.
- **Preservação**: migração aditiva, sem substituir tabelas de transações da v0.7.

## Regra de projeção

O saldo bancário mais recente recebido é a referência quando existe saldo disponível; caso contrário o saldo manual é usado separadamente. Movimentos bancários já refletidos no saldo não são somados novamente. Apenas o **valor restante de compromissos futuros ou vencidos** altera a projeção. Receitas incertas são excluídas por padrão; despesas previstas, inclusive estimadas, entram de forma conservadora.

Um pagamento marcado manualmente como quitado **deve já estar refletido no saldo atual**, pois não pode ser confirmado tecnicamente sem vínculo bancário. Um pagamento bancário importado não é ligado automaticamente: sugestões exigem aprovação.

**Importante:** esta é uma estimativa e não garante disponibilidade real, pois os bancos podem atualizar dados com atraso, e movimentações não importadas não são conhecidas. Projeções históricas anteriores à data atual não são calculadas. A lista visual do banco segue o limite de 2.500 movimentações da versão anterior; as sugestões de conciliação consultam o banco SQLite diretamente.

## Instalação

Baixe o instalador ou executável portátil na [Release v0.8.0](https://github.com/JoaoVittorLi/meu-financeiro/releases/tag/v0.8.0). Repositório privado: acesso com sua conta GitHub. Não exige instalar Python nem Node no computador.

Faça uma **cópia completa** em Configurações na versão anterior antes de atualizar. As credenciais da conexão bancária continuam protegidas separadamente pelo Windows; não são publicadas nem entram no backup SQLite.

## Desenvolvimento e testes

```powershell
npm install
npm run test
npm start
```

O `npm run test` executa a compilação TypeScript e testes de SQLite, categorias, segurança, recuperação, conciliação e projeção diária. O GitHub Actions compila os executáveis em Windows x64. A instalação e persistência no Windows real ainda precisam ser conferidas após a distribuição.
