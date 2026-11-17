# Dados, backup, perfis e migração segura — Windows 1.0.0

**Estado:** guia preventivo para uma release **não lançada**. Não autoriza migrar dados pessoais, alterar o SQLite ou copiar arquivos criptografados. Código: `electron/release-channel.cjs`, `electron/main.cjs`, `electron/db.cjs`. Handoff: [RC-ALL-02.3](../ai-context/RC_ALL_02_3_BACKUP_GATE_20261117.md).

## 1. Perfis Windows

| Canal | Identidade/seleção | Dados e rede |
|---|---|---|
| Desenvolvimento | `app.isPackaged=false` | Somente ambiente de desenvolvimento descartável; não usar como teste destrutivo pessoal |
| Smoke Electron | `isolateSmokeProfile` com pasta temporária | **Isolado**, sem banco real, sem rede pessoal |
| Experimental RC | `Meu Financeiro RC Experimental`, `appId=app.local.meufinanceiro.rcall01` | `appData/MeuFinanceiro-RC-ALL-01-Experimental`; **não** lê o perfil estável, Pluggy/cloud/LLM externos OFF |
| Estável FUTURO | Marker empacotado `mfDistributionChannel=stable` + `app.getName()=Meu Financeiro`, `appId=app.local.meufinanceiro` | Procura **somente** `appData/Meu Financeiro` ou `appData/meu-financeiro-desktop` com SQLite reconhecido; se ambos presentes, bloqueia |

No Windows, `appData` costuma corresponder à árvore `%APPDATA%`, mas **confirmar via Electron real no QA**, sem pressupor pasta/usuário. Se não houver nenhum banco candidato, criar estado `new`, sem alegar recuperação. Symlink de perfil e SQLite é recusado. Não copiar automaticamente dados RC ou credenciais entre perfis.

## 2. Integridade e snapshot pré-migração

Antes da inicialização estável de `FinanceDB`, o código: verifica `PRAGMA integrity_check` com abertura read-only; exige tabela `profiles`; confere caminhos; captura **backup online de SQLite incluindo WAL**; verifica o arquivo temporário. Falhas interrompem a abertura/migração antes de gravar mudanças.

Na RC-ALL-02.3:
1. A primeira captura para a versão gera `copias-de-seguranca/pre-upgrade-<versão>.sqlite`.
2. Uma nova inicialização captura o estado **atual** e compara SHA-256 com backups reconhecidos e **íntegros** daquela versão.
3. Mesmo conteúdo ⇒ reutiliza arquivo antigo. Banco alterado na mesma versão ⇒ gera **novo** `pre-upgrade-<versão>-<UUID>.sqlite`, imutável.
4. `.partial` de execução anterior, cópia corrompida, cópia-symlink ou caminho inacessível ⇒ **fail closed**, sem migração.
5. Nenhuma credencial `pluggy-credentials.enc` é incluída nos backups SQLite.

**Atenção:** podem surgir várias cópias grandes; conferência de espaço livre é parte do QA. SHA-256 detecta equivalência binária do snapshot, não é uma senha/assinatura de integridade externa contra atacante com acesso ao disco.

## 3. Recuperação e rollback

- **Antes de atualizar perfil real (só após GO):** fechar todas as instâncias, produzir cópia externa protegida do SQLite com mecanismo SQLite consistente/WAL, verificar integridade e guardar data/versão/compatibilidade; testar restauração em VM **sintética** antes de operações pessoais.
- **Ao falhar:** parar; registrar erro redigido sem extratos/segredos; não apagar `.partial`, não renomear `*.sqlite`, não copiar cofre Pluggy, não insistir com instalação stable repetidamente.
- **Recuperação técnica controlada:** escolher snapshot cuja integridade e esquema são conhecidos, restaurar para diretório **descartável** primeiro, conferir saldos/centavos/contas/IDs/categorias/planejamento e abrir na versão correspondente. Só propor operação no perfil real após instrução, revisão e autorização específicas.
- **Coexistência de versões:** um banco migrado a schema v7 pode não ser reaberto com binário antigo; rollback pode exigir restaurar snapshot **da versão antiga**, não apenas reinstalar EXE.
- **Testes obrigatórios:** 3 contas/600 lançamentos sintéticos, budgets (incluindo zero), planejamentos, PENDING/POSTED, overrides/splits, integridade/FK, WAL aberto, mesmo versionamento com alterações, reinício, snapshots imutáveis e safeStorage fictício.

## 4. Pluggy e segurança

O SQLite com histórico bancário pode ser consultável offline mesmo quando o cofre falha. A credencial `pluggy-credentials.enc` depende do `safeStorage` Windows **no mesmo perfil do usuário**; não é portável por copiar o arquivo. Se perder decrypt, mostrar erro e permitir leitura histórica; reconectar com autorização específica, sem logar `clientSecret`. No canal RC experimental, qualquer conexão/sincronização pessoal é desativada; nunca testar com credenciais reais.

O SQLite e backups **não recebem criptografia adicional da aplicação**: proteger permissões, disco/backup e acesso à máquina. Não publicar em GitHub/CircleCI/Cloudflare cópia pessoal, log financeiro ou vault.

## 5. Limites cloud e decisão de lançamento

Cloudflare e migração entre dispositivos têm contratos/código próprios, mas a transferência pessoal/cutover v7 (incluindo subcategorias) **não está liberada**. Não sugerir upload real por conveniência. A escrita pessoal IA permanece bloqueada, inclusive se a migração de dados passar. Isso é decisão independente do GO da release. [Plano e owners](PLANO_DE_RELEASE.md).
