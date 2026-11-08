# Gerar o instalador Windows sem instalar ferramentas

**Entrega:** Inteligência E1 + E2, branch `feat/inteligencia-e2-chatgpt-shared`.

## Ação única: abrir GitHub Codespaces

[Abrir o compilador online do Meu Financeiro](https://codespaces.new/JoaoVittorLi/meu-financeiro/tree/feat/inteligencia-e2-chatgpt-shared)

1. Entre na sua conta GitHub, se solicitado.
2. Confirme que o repositório e a branch selecionados são os do link acima e clique em **Create codespace**.
3. A configuração `.devcontainer/devcontainer.json` inicia automaticamente `scripts/codespaces-build-publish.sh`: instala as dependências, executa testes, compila instalador/portátil para Windows e publica os arquivos no **GitHub Releases** somente após a validação.
4. O resultado aparece no arquivo **codespaces-release/RESULTADO.txt**, com link direto do instalador.
5. Você também pode abrir [GitHub Releases](https://github.com/JoaoVittorLi/meu-financeiro/releases) e selecionar a prévia com nome **Inteligência E1+E2**.

**Não precisa instalar Node, Git, Wine ou GitHub CLI no Windows.** Eles são configurados dentro do Codespaces. A instalação do aplicativo continua sendo feita clicando no EXE após sua publicação.

### Segurança, limites e custo

- A execução ocorre no repositório privado. O token temporário do Codespaces não deve ser enviado a ninguém.
- Nenhuma credencial Pluggy/ChatGPT nem dados financeiros locais entram no processo de compilação.
- Nenhum deploy Cloudflare Production nem migração financeira é realizado.
- GitHub Codespaces possui cota e cobrança **separadas** do Actions. Antes de criar, verifique em GitHub → Billing que existe franquia e configure um orçamento com **Stop usage when budget limit is reached** para evitar custo adicional.
- Se a compilação falhar, a release **não será criada**. Consulte a mensagem da janela Codespaces e não instale versões antigas como se contivessem as entregas.
- **O build Linux→Windows não substitui teste visual no Windows.** Instale como prévia após backup e verifique se o aplicativo abre e preserva sua base.
- A autenticação real Sign in with ChatGPT ainda não foi homologada; esta prévia permite testar o fluxo, sujeito às permissões da conta.

### Arquivos adicionados

- `.devcontainer/devcontainer.json`: ambiente Linux com Wine, Node 22 e GitHub CLI.
- `scripts/codespaces-build-publish.sh`: testes, compilação, SHA256 e publicação automática.

O usuário só precisa clicar no Codespaces e depois no instalador publicado. Não copie comandos no PowerShell.
