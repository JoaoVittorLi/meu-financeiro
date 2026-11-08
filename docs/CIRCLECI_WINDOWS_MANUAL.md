# CircleCI — build manual Windows 0.9.5-beta.1 + Inteligência
**Branch para selecionar no CircleCI:** `integration/v0.9.5-beta.1-inteligencia-circleci`

1. Acesse https://app.circleci.com/ e abra `JoaoVittorLi/meu-financeiro`.
2. Em **Pipelines → Trigger Pipeline**, selecione **a branch acima** tanto para Config quanto para Checkout, se aparecerem duas seleções.
3. Acrescente o parâmetro **run_windows_build** com tipo **Boolean**, valor **true**.
4. Execute o job `build_windows` no Windows Server 2022.
5. Com status **Success**, abra **Artifacts → MeuFinanceiro-Windows** e baixe:
   - `MeuFinanceiro-Instalador-0.9.5-beta.1-x64.exe`
   - `MeuFinanceiro-Portable-0.9.5-beta.1-x64.exe`
   - `SHA256.txt`

O arquivo SHA256.txt contém branch e commit e permite verificar que instalou a versão unificada certa. Se a versão no `package.json` mudar, os nomes dos executáveis mudarão junto.

A compilação só roda com `run_windows_build=true`; por padrão é **false**. O CircleCI publica **Artifacts próprios**, não GitHub Releases. Não usa GitHub Actions e não realiza deploy Cloudflare.

**Antes de instalar:** preserve um backup do SQLite local e verifique a integridade dos dados. A compilação não equivale a validar migração cloud, Web Push, autenticação GPT ou paridade no PWA. O aplicativo Windows deve abrir normalmente e passar por testes visuais e funcionais. Se a pipeline falhar, envie a primeira mensagem de erro do job, sem expor tokens.

Este processo usa uma **branch de integração separada**, não altera `main`, nem as branches de origem. Não execute a migração real de finanças como consequência deste build.
