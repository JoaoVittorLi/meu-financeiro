# Regra — Isolamento de Workspaces, Worktrees e Memória Permanente no GitHub

## 1. Workspaces e Worktrees

- **Workspace de engenharia oficial:** `C:\Dev\meu-financeiro` (fora do OneDrive).
- **Workspace original do proprietário no OneDrive (`Carbon Meu Financeiro`):** **INTOCÁVEL** — nunca mover, editar ou excluir arquivos nele.
- Utilize branches dedicadas e worktrees isoladas em `C:\Dev\meu-financeiro-worktrees\<frente>` para isolar frentes concorrentes quando necessário.
- **Regra de escritor único (*single-writer*):** apenas um executor por vez pode alterar arquivos compartilhados de integração (`src/app.ts`, `app/app.js`, `electron/main.cjs`, `electron/preload.cjs`, `electron/db.cjs`, `shared/*`, `docs/ai-context/CURRENT_STATE.md`).

## 2. GitHub como Fonte Oficial da Memória do Projeto

- Decisões, requisitos, roadmap, entregas, resultados reais de testes (com SHA), estado e próximas tarefas devem ser **registrados continuamente no repositório Git** (não apenas no final da sessão).
- **Sem duplicação documental:** prefira atualizar os documentos canônicos existentes (`docs/ROADMAP_MF2.md`, `docs/ai-context/CURRENT_STATE.md`, `ACTIVE_WORK.md`, `GAPS_AND_GATES.md`, `TESTING_AND_RELEASE.md`, `MARKET_FEATURES_DEEP_DIVE.md`, `IDEA_REGISTER.md`, `OPERATING_PROTOCOL.md`, `WORK_PROMPT.md`) e adicionar um log cronológico por entrega em `docs/ai-context/logs/YYYY-MM-DD-*.md`.
- Publicação na branch autorizada via `git -c credential.helper= -c credential.helper=wincred push origin <branch>`.
- **Operações proibidas sem autorização explícita:** `git reset --hard`, `git push --force`, `git clean -fd` destrutivo, merge na `main` ou criação de tags/releases.
