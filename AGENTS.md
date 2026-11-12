# AGENTS.md — Meu Financeiro 2.0

> **ATUALIZAÇÃO VINCULANTE — FAST LANE 12/11/2026:** para as duas frentes **já autorizadas** (Redesign Premium e Inteligência Operacional), execute diretamente a Rodada B após checagem focal da baseline e leitura de [FAST_LANE_20261112](docs/ai-context/FAST_LANE_20261112.md) + [contrato IC v1](docs/ai-context/INTELLIGENCE_UI_CONTRACT_V1.md) + [issue #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49). A Rodada A geral abaixo é histórica e NÃO deve ser repetida nesta missão. Segurança, isolamento, testes e documentação continuam obrigatórios. Não iniciar outras frentes sem autorização.


**Instruções obrigatórias para qualquer agente/IA com acesso ao repositório.**

## Antes de trabalhar

1. Ler [docs/ai-context/README.md](docs/ai-context/README.md) e [docs/ai-context/CURRENT_STATE.md](docs/ai-context/CURRENT_STATE.md).
2. Consultar [docs/ai-context/ACTIVE_WORK.md](docs/ai-context/ACTIVE_WORK.md) para identificar PRs e ownership; conferir branch e SHA atuais.
3. Ler [docs/ROADMAP_MF2.md](docs/ROADMAP_MF2.md), [docs/ai-context/ARCHITECTURE.md](docs/ai-context/ARCHITECTURE.md) e [docs/ai-context/GAPS_AND_GATES.md](docs/ai-context/GAPS_AND_GATES.md).
4. **Rodada A é ANÁLISE**: seguir [docs/ai-context/ANALYSIS_PLAYBOOK.md](docs/ai-context/ANALYSIS_PLAYBOOK.md), inspecionar, pesquisar, propor e documentar; **não iniciar implementação por conta própria**.
5. **Rodada B é EXECUÇÃO**: só após autorização de escopo, seguir gates e prompts delimitados. Ver [docs/ai-context/WORK_PROMPT.md](docs/ai-context/WORK_PROMPT.md).

## Regra inegociável de documentação

**Todo PR com mudança de código/UX/contratos/testes/status deve atualizar [docs/ROADMAP_MF2.md](docs/ROADMAP_MF2.md) e adicionar log em [docs/ai-context/logs/](docs/ai-context/logs/) no mesmo PR.** Na Rodada A, atualizar status analítico e registrar reviews/ideias, sem marcar execução. Consultar [docs/ai-context/ROADMAP_UPDATE_RULES.md](docs/ai-context/ROADMAP_UPDATE_RULES.md).

O agente de feature propõe progresso na própria branch; **somente o integrador** atualiza CURRENT_STATE e confirma gates globais após evidências de integração. Reportar SHA, PR, testes executados/não executados e artefatos reais.

## Segurança

- Não acessar/expor/exfiltrar tokens, extratos, bancos locais ou segredos em commits/logs.
- Não habilitar flags de migração financeira, não apagar SQLite, não fazer cutover ou Cloudflare Production sem autorização explícita.
- Não introduzir custo de IA, inferência bancária ou operações financeiras de escrita sem contrato, consentimento e testes.
- Não usar git reset --hard, force push, merge de main ou mudanças destrutivas para "resolver" uma tarefa.
- Uma pessoa/IA por arquivo compartilhado ao mesmo tempo; coordenar com ACTIVE_WORK.
- A edição da documentação não equivale a testes do app; não declarar homologação por inferência.

## Continuidade

Se o Work anterior não estiver acessível, **dizer que não está acessível** e reconstruir o que se pode provar no GitHub, sem refazer o trabalho supostamente realizado. Para trocar de agente, seguir [docs/ai-context/HANDOFF_NEXT_AGENT.md](docs/ai-context/HANDOFF_NEXT_AGENT.md).
