# Meu Financeiro v0.5 — Electron + SQLite + Meu Pluggy

Aplicativo Windows pessoal com dashboard roxo/grafite e Open Finance via **Meu Pluggy**. A API Pluggy é consultada exclusivamente pelo processo principal do Electron. Seus dados manuais da versão 0.4 são preservados; os dados importados ficam em tabelas separadas.

## Obter o instalador

[Releases](https://github.com/JoaoVittorLi/meu-financeiro/releases) — escolha a versão 0.5.0 (prévia), baixe o `.exe` instalador ou portátil.

## Primeira conexão

1. Abra a v0.5 → **Open Finance** (menu lateral).
2. Informe `Client ID`, `Client Secret`, `itemId` (obtidos no Pluggy Dashboard). Não envie esses dados no chat/GitHub.
3. Clique em **Salvar proteção**. A chave é criptografada no Windows e armazenada separada do SQLite.
4. Clique em **Sincronizar agora**. O app lê as contas BANK em BRL, histórico paginado e status.
5. Confira saldos, transações, vencimento de consentimento e horário da última consulta.

A Pluggy disponibiliza informações já obtidas do banco, tipicamente atualizadas a cada 24 horas. O botão não força uma nova autorização nem uma atualização imediata da instituição. Para sincronizar novamente, basta clicar no botão.

## Segurança e limites importantes

- A API é **somente de consulta** e opera em `https://api.pluggy.ai`.
- `Client Secret` é criptografado com `safeStorage`/DPAPI e nunca é gravado no banco, nos backups ou no repositório.
- Sem fallback para plaintext se a criptografia do sistema não estiver disponível.
- Saldos e transações bancárias **não são automaticamente somados aos lançamentos manuais** para evitar duplicações. A conciliação contábil automática virá depois.
- Contas de cartão e investimentos ainda não são importadas nesta versão; apenas contas bancárias (`BANK`) em BRL.
- Transações são deduplicadas por `accountId+id`; IDs alterados pela instituição poderão exigir conciliação manual futura.
- O histórico de Open Finance é armazenado localmente, mas **o banco SQLite não é criptografado**. Proteja seu acesso ao Windows e backups.
- As credenciais criptografadas são vinculadas ao perfil Windows; se trocar de PC, precisará inserir novamente o segredo. Não é transferido em backups.
- O modo demonstração nunca acessa o banco; nenhuma credencial real acompanha o instalador.

## Desenvolvimento / testes

```bash
npm install
npm test
npm run dist:windows
```

O GitHub Actions usa `windows-latest` e disponibiliza a build em artefatos e em uma **pré-release**. Comportamento bancário real só poderá ser validado no computador autorizado pelo usuário.

Documentação oficial: https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use
