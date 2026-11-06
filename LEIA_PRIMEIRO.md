# Meu Financeiro v0.5 — Guia rápido

**Instale sobre a v0.4 preservando a pasta de dados.** A v0.5 adiciona tabelas ao banco SQLite existente, sem apagar transações e orçamentos.

1. Faça backup SQLite na v0.4 antes da atualização: **Configurações → Salvar cópia do SQLite**.
2. Instale a v0.5 e abra a tela **Open Finance**.
3. Digite os dados de API recebidos da Pluggy no próprio app; o `Client Secret` não é exibido novamente.
4. Clique em **Salvar proteção** e depois em **Sincronizar agora**.
5. Verifique se aparecem suas contas e histórico; dados bancários permanecem em tabelas próprias.
6. Feche e reabra o programa para conferir o histórico offline.

**Nunca compartilhe credenciais no chat, prints ou GitHub.** Não envie o banco SQLite contendo extratos para suporte sem antes eliminar dados pessoais.

## Se der erro

- `401/403`: confira a aplicação e seu Client Secret no Dashboard Pluggy.
- `LOGIN_ERROR` ou autorização expirada: reconecte o `MeuPluggy` no portal oficial e confira se o `itemId` mudou.
- Nenhuma conta: verifique o consentimento no portal; o aplicativo mantém os dados anteriores.
- Sem internet: o histórico já sincronizado continua local; apenas novas consultas falharão.
- Proteção indisponível: esta versão bloqueia salvar segredos sem criptografia do Windows.

## Escopo desta versão

Consulta online somente quando solicitada, dados em SQLite e acesso somente leitura. Sem transações enviadas à Pluggy, sem execução de Pix, sem cartão de crédito e sem conciliação automática com entradas manuais. Sem dependência do ChatGPT.

O código-fonte e o fluxo de build estão no [GitHub privado](https://github.com/JoaoVittorLi/meu-financeiro). A opção **Configurações → Salvar cópia do SQLite** permite criar backup local dos dados manuais e bancários.
