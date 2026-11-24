# AGENTS.md — Meu Financeiro

> **GOVERNANÇA V2 — 23/11/2026 (decisão do proprietário):** leitura obrigatória do [protocolo canônico](docs/ai-context/OPERATING_PROTOCOL.md#governança-v2--decisão-do-proprietário-em-23112026) antes de atuar. ChatGPT coordena; Antigravity Neon é líder funcional e integrador único; Codex atua em design isolado e auditoria/QA independentes. M3/S0–S5 e 1.0.0 stable têm prioridade; redesign não bloqueia release. Stitch suspenso. Ver [ACTIVE_WORK](docs/ai-context/ACTIVE_WORK.md) para ownership. Regras de segurança, NSIS e autorizações existentes permanecem vinculantes. As descrições de papéis antigas são históricas quando conflitantes.


> **ATUALIZAÇÃO VINCULANTE — GOVERNANÇA ANTIGRAVITY & HOMOLOGAÇÃO NSIS (18/11/2026):**
> - **Toolchain oficial:** `Node v22.23.4`, `npm 10.9.9`, `Electron 45.2.3`, `TypeScript 5.8.3`, `Python >= 3.8`.
> - **Workspace oficial:** `C:\Dev\meu-financeiro` (worktrees em `C:\Dev\meu-financeiro-worktrees\*`). Preservar intacto o workspace OneDrive (`Carbon Meu Financeiro`) e os perfis pessoais/estáveis do Windows.
> - **Estrutura persistente Antigravity:** ler obrigatoriamente [.agents/rules/](.agents/rules/00-permanent-nsis-homologation.md), [.agents/skills/](.agents/skills/qa-guardian-sqlite/SKILL.md) e utilizar `python .agents/scripts/run_workflow.py` para o ciclo de 7 estágios (`Descoberta → Projeto → Implementação → Teste → Correção → Auditoria → Entrega`).
> - **Diretriz Permanente — Homologação por Marco:** o único formato de distribuição é **Instalador NSIS Windows x64** (`--win nsis --x64`). Versão **Portable** está permanentemente fora de escopo. Todo marco com mudança funcional só é concluído após **Nível A (técnico) + Nível B (Electron interativo real) + autorização + Nível C (aplicativo NSIS realmente instalado em ambiente isolado)** e revisão independente (`pro` para Arquitetura/Guardião SQLite/Auditor Forense; `flash` para execução/testes).
> - **Memória permanente no GitHub:** atualizar documentos canônicos existentes no mesmo PR sem duplicar documentação.

**Instruções obrigatórias para qualquer agente/IA com acesso ao repositório.**

## Antes de trabalhar

1. Ler [docs/ai-context/README.md](docs/ai-context/README.md), [docs/ai-context/CURRENT_STATE.md](docs/ai-context/CURRENT_STATE.md) e todas as regras em [.agents/rules/](.agents/rules/00-permanent-nsis-homologation.md).
2. Consultar [docs/ai-context/ACTIVE_WORK.md](docs/ai-context/ACTIVE_WORK.md) para identificar PRs e ownership; conferir branch e SHA atuais.
3. Ler [docs/ROADMAP_MF2.md](docs/ROADMAP_MF2.md), [docs/ai-context/ARCHITECTURE.md](docs/ai-context/ARCHITECTURE.md) e [docs/ai-context/GAPS_AND_GATES.md](docs/ai-context/GAPS_AND_GATES.md).
4. **Análise antes de execução em frentes não aprovadas:** inspecionar, pesquisar, propor e documentar; **não iniciar implementação de marcos futuros sem autorização explícita do proprietário**.
5. **Execução autorizada:** seguir gates, regras de escritor único e prompts delimitados. Ver [docs/ai-context/WORK_PROMPT.md](docs/ai-context/WORK_PROMPT.md).

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
