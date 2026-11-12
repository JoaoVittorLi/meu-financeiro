# Meu Financeiro — entrada obrigatória para novas IAs

> **LEITURA PRIORITÁRIA DESDE 12/11/2026:** a missão de execução rápida aprovada supera as instruções históricas de repetir auditoria ampla **somente** nas frentes Redesign Premium e Inteligência. Comece por [FAST_LANE_20261112](FAST_LANE_20261112.md), [Contrato IC v1](INTELLIGENCE_UI_CONTRACT_V1.md), [Backlog enxuto](FAST_LANE_BACKLOG.md), [Design Premium](DESIGN_DIRECTION_PREMIUM.md) e [quadro #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49). Baseline Q1 PR #48 em Draft; nenhuma feature nova foi homologada por estes documentos. O estado de 09/11 abaixo é histórico.


> **LEIA ESTE ARQUIVO PRIMEIRO.** Memória de projeto versionada no GitHub. Base de verificação: 09/11/2026, branch design/despezzas-d1-d4, SHA c535cb01403689480d01560de3daa1cae71780d2. Esta documentação foi preparada em branch separada e não implica que código, banco, EXE ou Production tenham sido alterados.

## Em cinco minutos

1. Confira o SHA atual e a branch onde você está; **não suponha que o Work de outra conversa tenha feito push**.
2. Leia [CURRENT_STATE](CURRENT_STATE.md) (o que é fato, o que é apenas relato e o que falta comprovar).
3. Leia [ACTIVE_WORK](ACTIVE_WORK.md) (frentes, responsáveis, PRs e conflitos potenciais).
4. Leia [ROADMAP_MF2](../ROADMAP_MF2.md) (escopo fechado, estado de cada marco, Rodadas A/B e atualização obrigatória do progresso).
5. Leia [ARCHITECTURE](ARCHITECTURE.md) e [GAPS_AND_GATES](GAPS_AND_GATES.md).
6. **Antes de qualquer execução, realizar a Rodada A de análise** conforme [ANALYSIS_PLAYBOOK](ANALYSIS_PLAYBOOK.md): diagnóstico amplo, criatividade, sugestões e decisão; somente depois iniciar Rodada B autorizada.
7. Para assumir a execução, siga [HANDOFF_NEXT_AGENT](HANDOFF_NEXT_AGENT.md), [TESTING_AND_RELEASE](TESTING_AND_RELEASE.md) e [WORK_PROMPT](WORK_PROMPT.md).
8. Consulte os [documentos-fonte](SOURCE_INDEX.md) correspondentes à tarefa e os [logs](logs/).
9. Após **cada alteração**, publique **código + log Markdown + atualização do ROADMAP_MF2.md** na mesma branch/PR. Siga [ROADMAP_UPDATE_RULES](ROADMAP_UPDATE_RULES.md); o integrador confirma o estado global somente após integração validada.

## Hierarquia de verdade — não confundir

- **GitHub e SHA inspecionado**: evidencia arquivos e histórico de commits; presença de código não comprova que executa.
- **CI verificável no SHA**: prova os checks executados naquela revisão, não o uso real no dispositivo.
- **Teste Windows/PWA executado**: evidência de comportamento naquele ambiente.
- **Release e deployment identificados**: prova de distribuição, não de migração financeira homologada.
- **Relatório de outro chat ou Work**: pista a verificar, especialmente se houver alterações locais sem push.
- **CURRENT_STATE**: resumo derivado das fontes acima; pode ficar defasado e deve ser atualizado por evidência.

Uma entrega pode estar **implementada** e continuar **não homologada**. Um PR draft não equivale a código em main. Um Worker build não equivale a instalador Windows.

## Regra de operação em duas rodadas

**Rodada A = analisar, criticar, propor e recomendar**. Criatividade ampla é bem-vinda, mas não autoriza implementar nem promover ideias ao escopo sem decisão. **Rodada B = executar** somente fatias aprovadas com testes e logs. Uma nova IA deve começar pela Rodada A e verificar se Work anterior tem código local não publicado. Nunca usar um erro de CI como desculpa para alterar o produto fora da missão.

**Regra de sincronização contínua:** cada feature/fix atualiza ROADMAP_MF2.md **no PR da mudança**; log de entrega + teste; CURRENT_STATE.md apenas pelo integrador após aprovação. Se o roadmap ficar desatualizado, a entrega está incompleta. Ver [ROADMAP_UPDATE_RULES](ROADMAP_UPDATE_RULES.md).

## Compromissos do produto

- Windows Electron + React/TypeScript + SQLite local; PWA Android/web em Cloudflare Worker e Durable Objects SQLite; Pluggy read-only.
- O objetivo é uma fonte financeira cloud canônica e um núcleo determinístico único **somente depois** de conciliação, backup/restore e gates.
- IA é uma camada de assistência; ela não é o motor contábil. Escritas futuras exigirão prévia, autorização e operação auditável.
- Regras: centavos/datas exatos, sem duplicação, saldo desconhecido ≠ zero, fontes banco/manual não somadas automaticamente, transferência própria não é receita/despesa.
- U1–U3 no renderer desktop não equivalem à U4 no PWA; funcionalidades de IA experimentais não equivalem à inferência financeira real.
- Nunca executar cutover, habilitar FINANCIAL_SCHEMA_ACTIVE ou FINANCE_SYNC_ENABLED, apagar SQLite ou publicar Production como consequência incidental de uma tarefa.

## Navegação

- [AGENTS.md na raiz](../../AGENTS.md) — regras reconhecíveis por agentes de desenvolvimento.
- [.github/pull_request_template.md](../../.github/pull_request_template.md) — checklist obrigatório ao abrir PRs.
- [Templates de log e análise](templates/) — modelos para novas entregas e reviews.


| Documento | Responsabilidade |
| --- | --- |
| [CURRENT_STATE](CURRENT_STATE.md) | Snapshot factual e pendências |
| [ACTIVE_WORK](ACTIVE_WORK.md) | Frentes paralelas, ownership e handoffs |
| [ROADMAP_MF2](../ROADMAP_MF2.md) | Produto, escopo, detalhes MF2-00…10 e quadro de progresso obrigatório |
| [ANALYSIS_PLAYBOOK](ANALYSIS_PLAYBOOK.md) | Rodada A: auditoria ampla, benchmark e criatividade antes de executar |
| [PRODUCT_BLUEPRINT](PRODUCT_BLUEPRINT.md) | Fluxos e referências de experiência premium, com exemplos por área |
| [IDEA_REGISTER](IDEA_REGISTER.md) | Propostas criativas para avaliação, não escopo aprovado |
| [ROADMAP_UPDATE_RULES](ROADMAP_UPDATE_RULES.md) | Quando e como atualizar roadmap + logs + evidências |
| [reviews](reviews/) | Relatórios de análise antes de implementar |
| [ARCHITECTURE](ARCHITECTURE.md) | Sistemas existentes, módulos, invariantes e evolução |
| [GAPS_AND_GATES](GAPS_AND_GATES.md) | Problemas herdados, critérios de liberação |
| [HANDOFF_NEXT_AGENT](HANDOFF_NEXT_AGENT.md) | Instruções para substituir o Work atual com segurança |
| [OPERATING_PROTOCOL](OPERATING_PROTOCOL.md) | Regras para múltiplas IAs, PRs, decisões e logs |
| [TESTING_AND_RELEASE](TESTING_AND_RELEASE.md) | Comandos conhecidos, CI, smoke, releases |
| [SOURCE_INDEX](SOURCE_INDEX.md) | Fontes técnicas anteriores sem duplicação |
| [WORK_PROMPT](WORK_PROMPT.md) | Prompt de arranque e padrão Leve/Médio/Alto |
| [decisions](decisions/) | Decisões arquiteturais registradas |
| [logs](logs/) | Linha do tempo factual de entregas |

**Regra editorial:** não recriar versões paralelas desses documentos, não copiar logs gigantes, não guardar extratos/tokens/senhas. Documente sempre quem verificou o quê, em qual SHA e com qual limitação.
