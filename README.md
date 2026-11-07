# Meu Financeiro — v0.7.0 💜

Aplicativo de finanças pessoais para Windows (Electron + React/TypeScript + SQLite), com sincronização bancária opcional de somente leitura e processamento local das análises.

## Novidades da v0.7.0

- **Revisar movimentações:** caixa de entrada para registros bancários ainda não conferidos, com marcação individual ou em lote.
- **Detalhes laterais:** consultar descrição original, valor, status, data e conta; adicionar notas, nome amigável do estabelecimento e classificar o tipo da movimentação.
- **Dividir compras:** atribuir partes de uma despesa a diferentes categorias. A soma em centavos deve ser idêntica ao valor original; as divisões alimentam gráficos e orçamentos.
- **Estabelecimentos personalizados:** criar padrões de texto para mostrar nomes organizados e criar regras de categorização a partir dos detalhes.
- **Conciliação manual:** vincular um registro bancário confirmado a um lançamento pessoal com valor/tipo iguais e datas próximas (até 3 dias). Nada é conciliado sem aprovação.
- **Transferências próprias:** sugestões conservadoras entre contas conectadas, com confirmação explícita, e opção de desconsiderar movimentações das estatísticas.
- **Operações em lote:** aplicar categoria ou marcar revisadas até 100 movimentações por operação.
- **Migração aditiva:** edições, divisões e conciliações permanecem em tabelas separadas, sem alterar o extrato bruto do banco.

## Instalar

Baixe o instalador na [Release v0.7.0](https://github.com/JoaoVittorLi/meu-financeiro/releases/tag/v0.7.0) (repositório privado). O aplicativo não requer Python nem Node instalado no PC.

Antes de atualizar: **Configurações → Salvar cópia completa**. Feche a versão antiga e instale a nova. Não remova a pasta de dados pessoais.

## Testes e desenvolvimento

```powershell
npm install
npm run test
npm start
```

A compilação Windows é feita pelo GitHub Actions, com instalador, executável portátil e arquivo SHA-256.

## Privacidade e limitações

Os lançamentos importados da instituição nunca são sobrescritos por edições pessoais. Divisões, natureza, anotações e correções ficam em tabelas separadas. Credenciais ficam fora do SQLite e são protegidas pelo Windows. Não compartilhe segredos ou arquivos SQLite contendo dados financeiros.

Esta v0.7.0 **não possui conciliação automática** nem unifica duas fontes por padrão; a associação exige sua confirmação. O dashboard bancário ainda usa as movimentações mais recentes expostas para a interface, limitada a 2.500 registros (o app alerta em caso de corte); pesquisas históricas completas virão em versão posterior. As classificações gerenciais não movem dinheiro, não alteram o saldo fornecido pelo banco e não fazem pagamentos.
