# Meu Financeiro — Compilação Windows manual pelo CircleCI

Status: configuração adicionada ao GitHub; **a primeira compilação CircleCI ainda precisa ser executada e homologada**.

## Qual branch selecionar?

- **Para instalar as Entregas 1 e 2 da Inteligência:** `ci/circleci-inteligencia-e1-e2`. Baseada na branch `feat/inteligencia-e2-chatgpt-shared`, inclui os recursos de IA em desenvolvimento. **Esta é a opção recomendada para o teste atual.**
- **Para compilar a versão estável atual do aplicativo:** `ci/circleci-windows-manual`. Baseada na `main` v0.9.4, ainda sem Inteligência.

Ambas contêm os mesmos arquivos `.circleci/config.yml` e `.circleci/build-windows.ps1`, sem alterações na lógica financeira.

O código foi separado para não modificar a `main`, a branch de migração Cloudflare nem as versões instaladas.

## Primeira configuração do projeto CircleCI (pela interface)

1. Acesse [CircleCI](https://app.circleci.com/projects) e abra `JoaoVittorLi/meu-financeiro`.
2. Na etapa **Select your config.yml file**, escolha **Use existing config.yml** (configuração existente no repositório).
3. No seletor de branch do arquivo de configuração, selecione **`ci/circleci-inteligencia-e1-e2`**.
4. Confirme o caminho **`.circleci/config.yml`**. Não é necessário copiar YAML nem configurar Node no computador.
5. Se existir um campo separado para **Checkout source branch** (integração GitHub App), selecione também **`ci/circleci-inteligencia-e1-e2`**. Se não existir, a integração GitHub OAuth utiliza a branch do config/checkout.
6. Conclua o cadastro do projeto. Uma pipeline inicial sem job Windows **é esperada**, pois a execução do build permanece desativada por padrão.

## Gerar os executáveis manualmente

1. Em CircleCI, abra **Pipelines → Trigger Pipeline** (ou Run Pipeline).
2. Escolha o projeto e a branch **`ci/circleci-inteligencia-e1-e2`** tanto para Config quanto para Checkout, quando aparecerem campos separados.
3. Em **Add Parameters (+)**, crie:
   - **Name:** `run_windows_build`
   - **Type:** Boolean
   - **Value:** `true`
4. Clique em **Run/Trigger Pipeline**.
5. Abra o job **build_windows**. O executor é **Windows Server 2022 x64, windows.medium**.
6. Quando o job terminar com status **Success**, abra a aba **Artifacts**. Na pasta **MeuFinanceiro-Windows**, estarão:
   - `MeuFinanceiro-Instalador-[versão]-x64.exe`
   - `MeuFinanceiro-Portable-[versão]-x64.exe`
   - `SHA256.txt`
7. Clique no instalador para baixar. O **SHA256.txt** identifica a branch, commit, versão e hashes; use-o para conferir que o arquivo pertence à versão desejada.

Não há publicação automática em GitHub Releases. Os arquivos só ficam disponíveis como Artifacts do CircleCI, com acesso condicionado à sua conta e às permissões do projeto.

## Segurança e economia de créditos

- `run_windows_build` tem padrão `false`: pushes normais não disparam **o workflow Windows**, mesmo que o CircleCI crie uma pipeline sem jobs.
- Para eliminar também eventos automáticos de pipeline, desative triggers de push em **Project Settings → Triggers**, caso a integração permita. Isso é opcional para impedir consumo do runner Windows.
- A configuração não cria schedules, reexecuções automáticas nem artefatos financeiros.
- O processo usa o executor Windows Server 2022 `windows.medium`, baixa o ZIP oficial do Node 22, verifica seu SHA256, instala dependências e executa `npm run test:types` e `npm run dist:windows`.
- Se qualquer teste falhar, a build é interrompida: **não se publica um EXE com testes reprovados**.
- Somente os dois EXEs e SHA256.txt são copiados à pasta publicada; nenhum SQLite, .env ou credencial entra nos artifacts.
- O workflow GitHub Actions `.github/workflows/build-windows.yml` foi mantido intacto.
- Recursos Windows e armazenamento de artifacts consomem créditos conforme as regras do seu plano CircleCI. Confira a franquia antes de executar.

## Limites e cuidados

- O `package.json` da versão atual permanece em **0.9.4** nas duas branches. Isso NÃO significa que os arquivos sejam equivalentes: o instalador da branch Inteligência inclui mudanças não presentes na release oficial 0.9.4. Verifique o **commit** registrado em SHA256.txt.
- A compilação testa criação dos executáveis e parte do código; **não garante comportamento visual ou autorização real do ChatGPT**. Antes de substituir uma instalação, faça backup e realize teste no Windows.
- A branch Inteligência deriva de um checkpoint anterior da migração Cloudflare, não substitui o trabalho de paridade/produção que segue em paralelo.
- Branches futuras precisam conter a configuração CircleCI ou, em projetos GitHub App, usar uma config source branch separada e checkout source branch compatível (incluindo o script `.circleci/build-windows.ps1`). Não é garantido que todas as branches existentes possam ser compiladas sem levar a configuração.
- Se o pipeline retornar erro, abra o job CircleCI e envie a etapa/primeira mensagem de erro, sem expor credenciais. Não consigo acessar automaticamente o painel privado CircleCI com as ferramentas conectadas nesta conversa.

## Critérios para considerar concluído

1. YAML reconhecido pelo CircleCI no projeto conectado.
2. Pipeline manual com `run_windows_build=true` executada em `windows.medium`.
3. Testes TypeScript, Node/SQLite e empacotamento aprovados.
4. Aba Artifacts apresenta **exatamente 2 EXEs + SHA256.txt**.
5. Instalador testado no Windows, com dados preservados.

Até cumprir os cinco critérios, a integração está **preparada, não homologada**.
