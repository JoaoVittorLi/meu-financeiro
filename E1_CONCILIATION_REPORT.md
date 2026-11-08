# E1 — Conciliação e integridade da base financeira

**Ambiente:** PR #1 safety/cloud-migration-preflight-20261107, Cloudflare Preview protegido  
**Estado:** EM EXECUÇÃO — não homologada  
**Contrato:** mf-e1-audit-v1

## Checkpoint confirmado antes da E1

- O proprietário confirmou que o Pluggy Cloudflare recebeu 1 conta / 630 transações, mesma contagem do desktop.
- A transferência original de 17 tabelas/93 registros pessoais foi verificada em quarentena.
- Essas contagens NÃO constituem comparação de identidades, datas, centavos, saldos, categorias e vínculos; ainda não há resultado real dos novos comandos E1.
- Windows permanece no SQLite original; staging no Cloudflare, sem cutover. O GitHub Actions atingiu o limite, e não há novo EXE homologado com o E1 até build local.

## Componentes entregues nesta etapa

| Componente | Função e segurança |
| --- | --- |
| GET /api/bank/e1-evidence | Protegido por sessão privada e Access, somente Preview; contas, hashes de identidades, saldo numérico SEM data, cobertura de categoria, manifesto das 17 tabelas e referência bancária apenas por contagens |
| GET /api/bank/parity | SHA256 de IDs bancários, datas/centavos, textos/status sem remeter extratos locais |
| GET /api/bank/reference-audit | Identifica vínculos ausentes por tabela sem enviar contas/IDs ao PWA |
| electron/cloud-e1-audit.cjs | Compara localmente os dados Windows com os resumos protegidos. O desktop faz GETs; NÃO envia linhas financeiras nem hashes locais ao servidor |
| shared/e1-integrity-verdict.mjs | 15 checkpoints classificados: verificado, divergente ou pendente; nunca habilita automaticamente o cutover |
| PWA | Minhas contas: diagnóstico E1 SOMENTE dos dados cloud |
| Windows | Configurações: auditoria E1 Windows × Cloudflare após instalar EXE atualizado e conectar sessão Access |

## Matriz de aceitação — ainda sem evidência real

| Frente | Comprovação obrigatória | Estado |
| --- | --- | --- |
| Histórico | PK account_id/external_id, data, centavos, descrição, status | PENDENTE do comparador Windows real |
| Identidade de contas | Mesmos pares conta/item Pluggy | PENDENTE |
| Saldos numéricos | Valor por conta, admitindo divergência por instantes diferentes | PENDENTE |
| Data do saldo | Instante informado pela instituição, não o momento da requisição ao servidor | PENDENTE de metadado confiável |
| Categorias Pluggy | Metadados presentes e confronto com categoria original do SQLite | PENDENTE de comparação; sidecar pode precisar refresh |
| Importação pessoal | Marcador local igual ao hash do manifesto original verified, 17 tabelas | PENDENTE da comparação real |
| Dados atuais | Contagens das 17 tabelas, edições seguras, revisões e conflitos | PENDENTE |
| Vínculos | Zero referências bancárias/contas planejadas ausentes não explicadas; duplicatas revisadas | PENDENTE |
| Histórico completo | Mesma janela comprovada e identificação de lançamentos anteriores não obtidos na consulta Pluggy | PENDENTE de fonte histórica |
| Backup/rollback | Validação de recuperação do SQLite e da nuvem | GATE E07; E1 não libera migração |

## Atenções de equivalência

- Desktop armazena categoria padrão "Outros" se Pluggy não retornar categoria. O comparador E1 considera esse default quando a tabela lateral de categorias existe, e marca pendência se os metadados ainda não estiverem completos.
- O desktop pode truncar descrições em 180 caracteres; o staging do Worker pode preservar textos maiores. Uma divergência textual pode ser diferença de normalização, não necessariamente perda de lançamentos. Investigar sem alterar históricos.
- O staging conserva registros históricos ausentes de refresh recentes, logo o total de linhas armazenadas pode diferir de "lastFetched" sem significar falha.
- Hashes iguais não provam saldo as-of nem cobertura histórica. Pacote pessoal original verificado não prova equivalência de edições atuais.

## Execução sem GitHub Actions

1. Confirmar deployment Preview Ready e abrir PWA protegido > Minhas contas > Executar diagnóstico E1 na nuvem. Não há escrita financeira nessa consulta.
2. Fazer backup do SQLite local. Preparar o novo Windows com o script scripts/preview-windows-local.ps1, conforme LOCAL_DEVELOPMENT_NO_ACTIONS.md (Node.js 22+, Git, npm). O script testa antes de empacotar.
3. Após teste e EXE Windows novo: Configurações > Executar auditoria E1 · Windows × Cloudflare; a sessão de Access precisa estar conectada.
4. Anotar APENAS contagens e estados (Verificado, Divergente, Pendente), sem copiar dados bancários, tokens ou logs. Comparar os checkpoints e investigar qualquer divergência.
5. Resolver divergências com migrações aditivas e reversíveis; validar janela e instante de saldos antes de declarar E1 homologada.
6. Atualizar este relatório com evidência real. Só então passar ao motor financeiro único da E02.

## Restrições mandatórias

Não usar o Preview como fonte financeira definitiva, não habilitar FINANCIAL_SCHEMA_ACTIVE, não dar merge na main, não reimportar registros sem causa/backup, não alterar vínculos automaticamente, não apagar SQLite. cloudCutoverAllowed e financialSyncEnabled continuam false.

A tela Inteligência é desenvolvida em paralelo. A E1 não altera esses arquivos; o contrato INTELLIGENCE_PARALLEL_INTEGRATION.md permanece.

## Evidência real do proprietário (capturas de tela do Preview)

Em 07/11/2026, o diagnóstico protegido retornou **632 transações em staging**, **1 conta**, **93 registros pessoais**, manifesto das **17 tabelas verificado** e **7 de 7 referências bancárias distintas encontradas**, com **0 referências não localizadas**. A categoria foi informada para 631 das 632 transações pelo diagnóstico anterior. Isso atesta apenas o estado do staging: **não** comprova equivalência atual com o Windows.

### Investigação da diferença de duas transações e da categoria pendente

A consulta Pluggy preserva no staging registros antigos não retornados na atualização seguinte. O antigo indicador de "categoria identificada" não separava: (a) registro auxiliar de categoria ausente, (b) registro existente com categoria original nula. Em seu cálculo, os valores nulos eram normalizados como "Outros", logo 631 de 632 significa que pelo menos uma transação não possui linha auxiliar; não significa que o Itaú necessariamente omitiu sua categoria.

**Correção aditiva implementada, ainda aguardando inspeção no Preview:**
- O diagnóstico E1 agora distingue cobertura das linhas auxiliares, categoria original explícita, categoria nula do Pluggy e metadados sem registro.
- Exibe os meses das lacunas de metadados e a diferença entre o total retornado pelo último refresh e o total histórico preservado. Não revela IDs, valores ou descrições no PWA.
- Contrato mensal compartilhado `shared/e1-monthly-evidence.mjs` calcula hashes SHA256 de identidades, datas/centavos e descrição/status por mês, sem transferir o histórico local. Os últimos **até 48 meses** podem ser confrontados no Windows, e a UI mostra até 12 meses divergentes com quantidades de cada lado.
- O mecanismo destaca se as 2 transações adicionais estão no mês corrente, meses anteriores, ou se houve mudança de identidade, centavos ou texto. Não presume que as 2 transações são novas até o relatório Windows confirmar.
- Não há exclusão, reimportação automática, backfill sem autorização nem ajuste silencioso de categoria. O indicador de migração financeira continua `false`.

**Próxima evidência obrigatória:** após o deployment Ready, executar novamente o diagnóstico E1 na nuvem e registrar o mês com metadados ausentes e `lastFetched`. Compilar a revisão Windows localmente, executar a auditoria E1 e verificar o relatório mensal de divergências. Só corrigir as divergências comprovadas.

O GitHub Actions continua indisponível por limite de minutos; nenhum .exe Windows desta nova revisão foi publicado no Releases. A versão v0.9.4 disponível é anterior ao novo E1 e não deve ser apresentada como se o executasse.


## 07/11/2026 — tentativa de build Windows/PWA 0.9.5-beta.1

- Corrigida a declaração TypeScript `DesktopBridge.cloudE1Audit`, mantendo a implementação Electron IPC existente.
- Os manifestos `package.json` Windows e `mobile-push/package.json` foram alinhados em `0.9.5-beta.1`, sem lançamento em produção.
- Workflow `.github/workflows/unified-preview-gate.yml` preparado para gatilho pontual por alteração exclusiva de `.ci/request-preview-build.txt` e, depois dos testes (Node/SQLite/TypeScript/Worker), empacotamento de EXE portátil e instalador Windows, checksums SHA256 e pré-release privado com links diretos dos dois EXEs.
- Uma única tentativa de disparo foi feita no commit `cd5e25f46d951e6d31a781a7c607894604918237`, execução Actions [42432442097](https://github.com/JoaoVittorLi/meu-financeiro/actions/runs/42432442097). **Falhou ANTES de executar qualquer step**: `parity-and-security` failure, `preview-windows` skipped, nenhuma etapa de testes executada, nenhuma build/artifact/release publicada. Logs retornam BlobNotFound; GitHub indica duas anotações na verificação, mas seu texto não foi recuperado.
- Causa exata não comprovada; compatível com bloqueio de cota/billing ou runner. NÃO chamar o código de validado, NÃO dizer que o exe foi gerado. Não disparar novamente até verificar a anotação do GitHub e a franquia/billing.
- Após o desbloqueio, preferir reexecução do mesmo workflow/run se suportada. Se houver mudanças de código, um único novo gatilho aprovado do marcador após todos os commits consolidados. **Nunca** reabilitar disparos automáticos por cada commit.
- A PR #1 continua draft e isolada da `main`; a tela Inteligência fica nas branches próprias. E1 ainda exige comparação efetiva com SQLite real e não autoriza cutover.
