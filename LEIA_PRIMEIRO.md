# Meu Financeiro v0.6.0 — Categorias e regras automáticas

O objetivo desta versão é personalizar a classificação dos lançamentos importados pelo Meu Pluggy e dos lançamentos manuais, com regras determinísticas (sem IA).

**Onde configurar:** seção **Categorias e regras** do aplicativo.

### Exemplo de uso

1. Crie a categoria `Delivery` com uma cor própria.
2. Crie uma regra `Descrição contém IFOOD → Delivery`, escopo `Bancos e novos manuais`, prioridade `100`.
3. Abra Transações: o histórico bancário já importado será exibido com `Delivery` (indicado como `Regra automática`).
4. Se uma transação específica for outra categoria, selecione a categoria desejada: a correção individual prevalece e persiste após futuras sincronizações.
5. Em uma linha corrigida, clique em `Auto` para voltar ao cálculo pelas regras.

Regras de menor número de prioridade vencem; empate preserva a regra criada primeiro. A busca ignora maiúsculas/minúsculas e acentos. Regras só alteram a visualização bancária e as categorias de **novos** lançamentos manuais; os registros brutos do banco nunca são modificados. Alterar categorias/rules no demo é desabilitado.

### Antes da atualização

**Salve uma cópia do SQLite pela versão anterior!** Os bancos v0.5.1 são migrados de forma aditiva ao abrir esta versão. Não desinstale excluindo os dados do aplicativo. As credenciais Pluggy não devem ser enviadas ou compartilhadas.

### Backup

O backup nativo `.sqlite` inclui transações, regras e categorias. O JSON manual antigo não contém essas entidades. As credenciais (Client Secret) ficam fora desses backups, protegidas pelo Windows.

### Testes

`npm run test`: testes Node/SQLite, regras, migração e validação TypeScript. Os executáveis são compilados no GitHub Actions em `windows-latest` com `npm run dist:windows`. A execução final deve ser verificada no seu Windows.
