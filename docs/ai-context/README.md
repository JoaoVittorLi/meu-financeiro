# Meu Financeiro — entrada obrigatória para novas IAs

> **LEIA ESTE ARQUIVO PRIMEIRO.** Memória de projeto versionada no GitHub. Base de verificação: 09/11/2026, branch design/despezzas-d1-d4, SHA c535cb01403689480d01560de3daa1cae71780d2. Esta documentação foi preparada em branch separada e não implica que código, banco, EXE ou Production tenham sido alterados.

## Em cinco minutos

1. Confira o SHA atual e a branch onde você está; **não suponha que o Work de outra conversa tenha feito push**.
2. Leia [CURRENT_STATE](CURRENT_STATE.md) (o que é fato, o que é apenas relato e o que falta comprovar).
3. Leia [ACTIVE_WORK](ACTIVE_WORK.md) (frentes, responsáveis, PRs e conflitos potenciais).
4. Leia [ROADMAP_MF2](../ROADMAP_MF2.md) (escopo fechado e ordem de dependências).
5. Leia [ARCHITECTURE](ARCHITECTURE.md) e [GAPS_AND_GATES](GAPS_AND_GATES.md).
6. Para assumir a execução, siga [HANDOFF_NEXT_AGENT](HANDOFF_NEXT_AGENT.md), [TESTING_AND_RELEASE](TESTING_AND_RELEASE.md) e [WORK_PROMPT](WORK_PROMPT.md).
7. Consulte os [documentos-fonte](SOURCE_INDEX.md) correspondentes à tarefa e os [logs](logs/).
8. Após cada alteração, **publique código + log Markdown na mesma branch/PR**; atualize o estado global somente após integração validada.

## Hierarquia de verdade — não confundir

- **GitHub e SHA inspecionado**: evidencia arquivos e histórico de commits; presença de código não comprova que executa.
- **CI verificável no SHA**: prova os checks executados naquela revisão, não o uso real no dispositivo.
- **Teste Windows/PWA executado**: evidência de comportamento naquele ambiente.
- **Release e deployment identificados**: prova de distribuição, não de migração financeira homologada.
- **Relatório de outro chat ou Work**: pista a verificar, especialmente se houver alterações locais sem push.
- **CURRENT_STATE**: resumo derivado das fontes acima; pode ficar defasado e deve ser atualizado por evidência.

Uma entrega pode estar **implementada** e continuar **não homologada**. Um PR draft não equivale a código em main. Um Worker build não equivale a instalador Windows.

## Compromissos do produto

- Windows Electron + React/TypeScript + SQLite local; PWA Android/web em Cloudflare Worker e Durable Objects SQLite; Pluggy read-only.
- O objetivo é uma fonte financeira cloud canônica e um núcleo determinístico único **somente depois** de conciliação, backup/restore e gates.
- IA é uma camada de assistência; ela não é o motor contábil. Escritas futuras exigirão prévia, autorização e operação auditável.
- Regras: centavos/datas exatos, sem duplicação, saldo desconhecido ≠ zero, fontes banco/manual não somadas automaticamente, transferência própria não é receita/despesa.
- U1–U3 no renderer desktop não equivalem à U4 no PWA; funcionalidades de IA experimentais não equivalem à inferência financeira real.
- Nunca executar cutover, habilitar FINANCIAL_SCHEMA_ACTIVE ou FINANCE_SYNC_ENABLED, apagar SQLite ou publicar Production como consequência incidental de uma tarefa.

## Navegação

| Documento | Responsabilidade |
| --- | --- |
| [CURRENT_STATE](CURRENT_STATE.md) | Snapshot factual e pendências |
| [ACTIVE_WORK](ACTIVE_WORK.md) | Frentes paralelas, ownership e handoffs |
| [ROADMAP_MF2](../ROADMAP_MF2.md) | Produto, escopo e dependências MF2-00…10 |
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
