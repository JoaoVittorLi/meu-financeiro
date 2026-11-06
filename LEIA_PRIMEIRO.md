# Meu Financeiro v0.4 — Electron + SQLite (código implementado)

## O que está implementado

Esta versão **não é mais o launcher Edge**. O projeto usa Electron 45.2.3 com uma interface React/TypeScript e um banco **SQLite nativo no processo principal**, sem backend em nuvem e sem API de IA.

- Dashboard, lançamentos, importação CSV, orçamentos, simulações de compra, configurações.
- Dados reais e de demonstração isolados em tabelas SQLite pelo campo `profile`.
- Valores armazenados como inteiros em centavos para evitar erros de arredondamento nas transações.
- Gravação atômica: alterações são validadas e confirmadas numa transação SQL; erros preservam o estado anterior.
- Backup JSON (exportar/restaurar pelo app) e backup nativo `.sqlite` usando a função de backup online.
- Proteções Electron: `contextIsolation`, `sandbox`, `nodeIntegration=false`, IPC por métodos restritos, navegação e novas janelas bloqueadas, conteúdo local sem rede.

**Status:** código e integração de persistência implementados e testados em Node.js. A interface React foi compilada e pode ser testada no navegador. **Ainda não há um `.exe` Electron validado em Windows**: o ambiente de compilação atual não acessa o registro npm para baixar Electron / electron-builder. Não substitua a v0.3 até validar o novo aplicativo.

## Como gerar o executável real, sem Python

### Opção 1: GitHub Actions (gera executável na nuvem)

1. Crie um repositório privado no GitHub e envie o conteúdo desta pasta para a raiz.
2. Na aba **Actions**, escolha `Compilar Meu Financeiro Electron (Windows)` e clique em **Run workflow**.
3. Aguarde a execução na página do GitHub; baixe o artefato **MeuFinanceiro-v0.4-Windows**.
4. Extraia o ZIP gerado pelo GitHub: ele conterá um executável portátil e um instalador NSIS.
5. O aplicativo final **não precisa de Python nem Node.js instalado**; a compilação usa Node apenas no GitHub.

### Opção 2: compilar no Windows

Se você já possui Node.js 22+, execute `GERAR_EXE_WINDOWS.bat`. Ele instala dependências e gera os EXEs em `release/`.

### Opção 3: desenvolvimento

```powershell
npm install
npm run test
npm start
```

O Electron usa o Chromium incluído no próprio Electron. Não depende de Edge.

## Banco de dados

No Windows, o Electron armazena o banco em `%APPDATA%\Meu Financeiro\meu-financeiro.sqlite` (o caminho exato depende do nome de perfil escolhido pelo Electron). Para saber onde está, use **Configurações → Abrir pasta do banco**. Não abra nem altere o arquivo enquanto o aplicativo estiver em uso.

As tabelas são `profiles`, `transactions`, `budgets`, `financial_settings`, `app_meta`. O SQLite usa modo WAL para recuperação após encerramentos inesperados.

A UI da v0.3 gravava em um perfil exclusivo do Edge, **não em SQLite**. Portanto, os dados **não migram automaticamente**. Para transferi-los:

1. Abra a v0.3, volte para **Meus dados** e entre em **Configurações → Exportar backup JSON**.
2. Abra a v0.4 compilada e entre em **Configurações → Restaurar backup JSON**.
3. Confirme a substituição *no perfil pessoal*, depois verifique lançamentos e totais.
4. Faça um backup SQLite. **Não apague o banco ou a v0.3 até conferir os dados.**

Os dados de demonstração são fictícios e não devem ser importados como dados pessoais.

## Privacidade e limitações

O banco **não é criptografado por senha**; é protegido pelos controles de acesso do seu Windows. Não conecte bancos nem registre dados financeiros sensíveis até validar execução, backup, restauração e estabilidade no seu PC. Não há Open Finance, Pluggy, MCP ou IA nesta versão.

O simulador usa uma projeção **simplificada mensal**. Ele não considera vencimentos por dia, taxas bancárias variáveis, despesas duplicadas ou alterações de renda futura e não substitui uma análise financeira individual.

## Arquivos do projeto

- `app/`: interface escura da v0.3 revisada, CSS e React já distribuído no projeto anterior.
- `src/app.ts`: lógica da UI e ponte de dados Electron.
- `electron/main.cjs`: processo principal e segurança Electron.
- `electron/preload.cjs`: IPC de funções restritas.
- `electron/db.cjs`: esquema, validação, persistência, integridade e backup SQLite.
- `tests/sqlite.test.cjs`: testes do banco.
- `.github/workflows/build-windows.yml`: compilação Windows via GitHub Actions.
- `GERAR_EXE_WINDOWS.bat`: compilação local Windows opcional.

## O que fica para a próxima versão

Testar pacote em Windows real; melhorar CRUD para edição de lançamentos; reconciliar importações bancárias, registrar recorrências e parcelas por vencimento; opcionalmente criptografar dados sensíveis e conectar Open Finance/MCP após aprovação.
