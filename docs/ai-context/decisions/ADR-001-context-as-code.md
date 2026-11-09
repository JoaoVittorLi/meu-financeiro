# ADR-001 — Contexto versionado e uma fonte de verdade operacional

**Data:** 09/11/2026  
**Status:** adotado para novas entregas documentadas; integração da estrutura ao branch de desenvolvimento pendente de revisão.

## Contexto

Múltiplos chats e Work desenvolvem frentes diferentes; memória de conversa não é compartilhável integralmente, PRs empilhados geram confusão e alterações locais podem não ter sido publicadas. Havia documentação dispersa e relatos de testes sem um ponto de entrada inequívoco.

## Decisão

- Criar docs/ai-context/README.md, CURRENT_STATE.md, ACTIVE_WORK.md, HANDOFF_NEXT_AGENT.md, OPERATING_PROTOCOL.md, GAPS_AND_GATES.md, índice de fontes, ADRs e logs cronológicos.
- Roadmap canônico em docs/ROADMAP_MF2.md; não duplicar versões concorrentes.
- Todo código relevante modificado exige log Markdown na mesma branch/PR.
- Somente integrador atualiza estado global aprovado; cada frente mantém log de sua tarefa.
- Cada afirmação de sucesso deve apresentar evidência por SHA/ambiente, separando código, CI, instalação e publicação.
- Não editar em paralelo o mesmo arquivo de integração sem reserva de ownership.

## Alternativas rejeitadas

Somente memória de chat, arquivo único gigante de transcript, documentos independentes em cada branch sem links e status global escrito por todos os agentes.

## Consequências

Mais rastreabilidade e onboarding simples; pequena disciplina adicional por PR. Estado global pode atrasar até a integração e isso é **intencional**, para não confundir feature draft com release.
