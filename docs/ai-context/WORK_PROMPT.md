# Padrão de prompts para Work e continuidade entre chats

## Política de esforço do Work (priorizar economia de sessões)

- **Leve**: ler status, confirmar SHA/PR, alterar texto ou estilo isolado, registrar log, executar check pontual conhecido.
- **Médio (padrão)**: implementar componente/fluxo delimitado, corrigir CI conhecido, escrever testes e documentação, fazer paridade visual de área.
- **Alto**: migrar dados, conciliar fontes, resolver conflitos de schema/arquitetura, autenticação, IA com autorização de escrita, release com risco financeiro.

Escolher **o menor nível adequado**; não escalar automaticamente por uma falha. Níveis aqui são recomendações operacionais do agente Work, não o parâmetro low/medium do shared/ai-policy.mjs do aplicativo.

## Prompt inicial — copiar para outro Work/Chat executante

Você assumirá o desenvolvimento do projeto privado Meu Financeiro em JoaoVittorLi/meu-financeiro. Antes de alterar qualquer código, leia docs/ai-context/README.md na branch **docs/mf2-multi-agent-context-20261109** (ou na branch em que esse PR tenha sido integrado). Em seguida leia CURRENT_STATE.md, ACTIVE_WORK.md, HANDOFF_NEXT_AGENT.md, ROADMAP_MF2.md, ARCHITECTURE.md e GAPS_AND_GATES.md.

A prioridade é **preservar o código existente e descobrir o estado real** do Work "Meu Financeiro - Definitivo", que pode ter alterações locais não publicadas. Não assuma que U4, IA 21 operações ou instalação U3 estejam concluídas. Confirme branch/SHA/PR e eventuais mudanças não commitadas, compare com design/despezzas-d1-d4 SHA c535cb0, identifique a próxima entrega desbloqueada e informe os riscos.

Não modifique dados reais, flags de migração, Cloudflare Production, custos de IA, releases ou main sem autorização. Nunca declare testes que não executou. Toda mudança futura deve incluir um log técnico Markdown em docs/ai-context/logs no mesmo PR.

**Nesta primeira resposta**, envie somente: estado factual, progresso do Work recuperável, pendências, risco de colisão e uma próxima missão concreta com critérios de aceite; não reimplemente o que já estiver pronto.

## Prompt de execução — template para Chat arquiteto

**Missão:** MF2-XX / título e resultado observável.
**Esforço recomendado:** Leve, Médio ou Alto.
**Branch e SHA base:** inspecionados, não presumidos.
**Dependências:** gates anteriores e contratos.
**Arquivos no escopo:** concretos.
**Arquivos/ações proibidos:** concretos, especialmente dados/Production.
**Implementar:** requisitos numerados e comportamento desejado.
**Validar:** comandos/testes, e2e, visual, segurança, paridade se relevante.
**Documentar:** log Markdown, evidências, ADR se decisão arquitetural.
**Concluir:** branch, SHA, PR, testes executados/não executados, screenshots reais quando disponíveis, blocker e próxima ação.

Nunca solicitar "continue tudo até terminar" sem marcos; usar missões fechadas e retomar do último SHA verificado.
