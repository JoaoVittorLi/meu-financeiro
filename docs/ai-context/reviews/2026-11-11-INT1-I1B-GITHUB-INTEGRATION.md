# INT1 — Integração da Inteligência I1-A.2 + I1-B.1 ao Windows Premium

**Data de referência:** 2026-11-11  
**Repositório:** `JoaoVittorLi/meu-financeiro`  
**Base confirmada:** PR #38, commit `b09302c33040672e6c01170ef6624d0fa4a6c706`, baseado no PR #37 → PR #36 → beta.8 PR #31.  
**Branch:** `feat/mf2-int1-ai-workbench-integration-20261111`. **Estado:** alterações de código-fonte publicadas; PR draft e execução oficial a validar.

## Artefatos incluídos

Este commit adiciona diretamente ao código-fonte os quatro arquivos finais recuperados do pacote de revisão do Arquiteto, construídos sequencialmente a partir dos patches I1-A.2 → I1-B → I1-B.1. O pacote foi comparado com a base beta.8 e os arquivos finais correspondem exatamente aos blobs abaixo.

| Arquivo | Git blob SHA |
|---|---|
| `src/intelligence-view.ts` | `f4eeb015c1d5dc13607a3f5f28012ed38aa0cbc7` |
| `src/intelligence-integration.ts` | `dbc73123b00ce362d52d3cb01b39b41d7d3674e6` |
| `app/intelligence.css` | `cb6717e26092a5049623f90fa55a8f703250bd80` |
| `tests/ai-ui.test.cjs` | `b6f3448ac6838f1f761f5228a1ddccb0e45e2163` |

**Nota:** os patches não precisam ser reaplicados. O código corrigido está **diretamente nos quatro arquivos desta branch**. Não copiar ZIP sobre o checkout ou executar `git apply` novamente.

**Correções I1-B.1 incluídas:** sanitização de metadados aninhados em propostas/cards persistidos, resumo sintético de uma origem por vez e apenas banco confirmado sem contar transferências/ignore, exclusão de conversas com confirmação de persistência (sem sucesso falso). O histórico renderer é local: não alegar criptografia de cofre. Preservados I1-A.2 (desambiguação e prévia sem escrita) e I1-B (workbench, drawer e threads).

## Escopo e limites de produto

- I1-A.2/I1-B.1 é interface funcional e conversa contextual determinística; **não existe conversação livre com IA aberta** nesta etapa (I2-A futura).
- "Confirmar prévia (sem gravar)" **não realiza escrita financeira**. Permitir/Negar com persistência no backend pertence à I2-B.
- Histórico está em `localStorage` separado real/demo, sujeito a limitações de privacidade e integridade; nunca armazenar tokens/segredos. Para produção, avaliar storage pelo processo principal, backup, proteção de perfil e isolamento.
- Não foram alterados `src/app.ts`, `src/plan-view.ts`, `electron/db.cjs`, migrations, Pluggy bruto, Cloudflare ou `main`. Não sobrescrever alterações do Executor.
- Não foi gerado `app/app.js` manualmente. Recompilar a partir do TS no gate de pré-homologação.

## Prova disponível vs pendente

**Anteriormente, em revisão dirigida e cenário sintético:** 11/11 testes comportamentais I1-A.2/I1-B.1 PASS com Node/TypeScript e ambiente auxiliar isolado; não equivalem à suíte completa. Os SHA dos blobs são os do pacote corrigido.

**PENDENTES:** `npm ci` na toolchain do projeto, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, `npm test` quando aplicável, Electron GUI em perfil 100% sintético (8 áreas, 1366×768 e 1920×1080, claro/escuro, persistência após reinício), suíte D1.5.1 + U5.1.1 + U5.2.1, integridade SQLite e screenshot manifest.

Qualquer falha reproduzida deve ser corrigida em commit adicional desta branch, com relatório de erro/causa/teste. Não mascarar erro mudando expectativas ou simulando sucesso.

## Próxima ação do Executor novo

1. Clonar diretamente o repositório com acesso GitHub, fazer checkout desta branch e **não pedir ZIP ao usuário**.
2. Conferir PR #38/HEAD e os quatro arquivos; os patches já estão aplicados.
3. Executar a suíte oficial pinada; priorizar P1, dados, regressões e compatibilidade com `src/app.ts` do PR #38.
4. Validar Electron e dados sintéticos, incluindo uso do chat lateral nas oito áreas e continuidade entre drawer/aba; repetir após reinício e troca real/demo.
5. Publicar evidência, commits de correção e decisão de gate; não fazer merge em `main` e não alterar PWA Production.
6. **Sem CircleCI Windows/EXE até autorização explícita do proprietário após homologação.** Proprietário quer uma versão Windows Preview com D1.5.1+U5.1.1+U5.2.1+I1-B.1, sem esperar I1-C/U5.3/ID1.

O novo executor deve entregar primeiro o checkpoint de pré-homologação, com comandos exatos executados e SHAs; somente após aprovação do proprietário preparar a execução Windows.
