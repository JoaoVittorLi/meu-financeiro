# Checkpoint arquitetural D1.5 — Revisão PR #36 e liberação para homologação

**Data:** 2026-11-11 · **Natureza:** revisão de código + planejamento/handoff, **sem aprovação de release**.  
**Branch do Executor:** `fix/mf2-d1-5-premium-interactions-20261111` · PR #36 draft · HEAD revisado: `71eb60d141a9346a9bf9d4744ab05d132101701d`.  
**Base:** staging beta.8 PR #31 HEAD `d513c2be3f9b0cd018aed0b71f46ce8747a6556c`, CI Linux/Windows bem-sucedido **apenas nesse SHA pai**.

## 1. Decisão do Arquiteto

**NECESSITA DUAS CORREÇÕES DIRIGIDAS ANTES DA HOMOLOGAÇÃO E DO PRÓXIMO EXE.** Implementação visual e fluxo de edição são coerentes; não refazer a D1.5 nem fazer nova auditoria geral. `compare_commits`: 5 commits à frente, 0 atrás, 12 arquivos modificados. O PR #36 não apresentou statuses do CI em seu HEAD no momento da revisão.

### Avaliação da implementação
- **D1.5-A:** `app/premium-interactions.css` isolado e carregado ao final de `app/index.html`; elevação/transição, foco e `prefers-reduced-motion` por seletor. Aparência real no Windows **não testada**.
- **D1.5-B:** drawer com tokens de tema; `src/plan-view.ts` sem sete hex roxos do SVG; paleta de categorias alterada apenas nos defaults/novos swatches, preservando personalizações existentes. É necessário teste visual real de contraste e resolução.
- **D1.5-C:** `src/app.ts` habilita edição e exclusão do lançamento manual e persiste antes de fechar drawer; fluxo de vínculo com banco é guardado pela UI, mas precisa reforço no SQLite. Faltam os testes oficiais Node/SQLite/Electron.
- **Provas atuais do Executor:** 24/24 testes V8 com Node simulado, renderer sintético. **Não** são `npm test`, compilação TS, F08/ASAR, smoke real nem validade do instalador.

## 2. Correções P1 exigidas

### P1-01 — Precisão de valor digitado
- `src/app.ts` `parseMoney()` (linha ~132) utiliza `Math.round(x*100)`; `saveManualDetail()` (~658–681) aceita como centavos valores que tinham >2 casas após separador decimal, arredondando sem aviso.
- Exigir formato BRL válido, no máximo 2 casas decimais, rejeitar expoentes, ambiguidades e intervalo fora de `Number.isSafeInteger`. Aceitar `10,99` e `1.234,56`, recusar `10,999`; testar inteiros, 0 e negativos. Evitar divergência entre o editor e o cadastro `saveEntry()` (~962), se possível aplicar mesma validação a ambos, com testes. Não modificar a interpretação legítima de importação CSV sem regressão apropriada.

### P1-02 — Vínculo bancário deve ser protegido no backend
- `src/app.ts` `isManualLinked()` (~655) lê `this.state.bank.data.transactions`, que pode estar desatualizado.
- `electron/db.cjs` `save()` (~303–331) regrava `transactions` e chama `pruneInvalidManualLinks()` (~556–565). Se uma alteração de lançamento cruzar o vínculo real sem a UI conhecer o link, o `prune` pode silenciosamente removê-lo.
- Criar operação backend segura ou guarda transacional compatível com as operações existentes; a tentativa de modificar data/valor ou excluir manual vinculado deve falhar atomicamente com mensagem clara, **mesmo se o snapshot do renderer omitir o link**. Descrição/categoria editáveis se permitido, sem mexer no extrato bruto. Garantir comportamento explícito de restauração/importação que pode exigir limpeza legítima de links; não causar falha silenciosa ou regressão de backup.
- Testes com SQLite real e perfil descartável: vínculo somente no DB, edição valor/data/exclusão bloqueadas; categoria/descrição permitidas; rollback; restauração e reabertura; extratos originais preservados.

## 3. Missão de execução — D1.5.1

**Owner:** Executor 2. **Branch:** manter `fix/mf2-d1-5-premium-interactions-20261111` / PR #36 (não criar PR redundante). Conferir HEAD antes de editar.

1. Corrigir P1-01 e P1-02; criar novos testes dirigidos que inicialmente reproduzam a falha e depois passem.
2. Rodar na toolchain oficial do checkout: `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`. Documentar ambiente e logs. Não relaxar testes.
3. Confirmar: drawer e campos (manual/banco) claro/escuro; hover antes/durante/depois, foco, movimento reduzido; gráfico `pTimeline`; 1366×768 e 1920×1080; reabrir e conferir persistência e backup/restore real em banco sintético. Não confundir contrato CSS estático com imagem real.
4. Só após correções e validação local possível, disparar **uma** pipeline CircleCI `run_windows_build=true`, que contém preflight Linux seguido do job Windows. Não disparar preflight isolado redundante. Se não houver ambiente local para executar, pode usar esta pipeline como primeira prova oficial no SHA corrigido, registrando a limitação e corrigindo somente falhas reais.
5. Artifacts NSIS/Portable/`SHA256.txt` devem corresponder ao mesmo SHA do código/testes. Verificar presença, hashes, instalar em perfil isolado e fornecer links de download **reais**. D1.5 aprovada para teste do proprietário quando não houver P0/P1 ativo.
6. Atualizar `docs/ROADMAP_MF2.md`, `docs/ai-context/EXECUTOR_HANDOFF.md`, log D1.5.1 no **mesmo PR** de código, com passos realmente executados e evidências. Sem merge em `main`, PWA Production, migrar dados reais ou publicar release estável.

**Gate de homologação:** `NÃO HOMOLOGADO` até os resultados acima. Não assumir que Linux/Windows verde da beta.8 pai valide PR #36.

## 4. Divisão de responsabilidades e próximos marcos

| Ordem | Marco | Responsável | Condição / não bloqueia D1.5 |
|---|---|---|---|
| 0 | D1.5.1 correções + regressões e Windows EXE | Executor 2 | **Bloqueia distribuição do EXE D1.5** |
| 1 | Homologação de instalação no PC e retorno visual do proprietário | Arquiteto + Antigravity QA Windows | Determina melhorias antes do release, não exige nova identidade |
| 2 | ID1 marca geométrica MF, `.ico`, PWA manifest/Preview, app shell | Argon direção/asset SVG; Executor integração posterior | **Não bloqueia este EXE**; pronto para próxima versão |
| 3 | A-D7 resíduos roxos/emojis, afinação hover e CSS | Argon UX; Executor após encerramento D1.5 | Não interferir no CSS do PR #36 até gate |
| 4 | I1 pesquisa profunda e protótipos IA + radar local determinístico | Argon arquitetura visual; Executor próximo ciclo | Alta prioridade de produto, mas não atrasar instalador |
| 5 | U5 melhorias operacionais e novos cards financeiros filtrados | Executor | Precisa dados confiáveis, testes de UX e regressão |
| 6 | I2/I3 chat contextual e ações auditáveis | Executor + Arquiteto | Depende I1 e contratos de permissão |
| 7 | P1-PWA paridade segura e sincronização | Equipe cloud em frente isolada | Sem deploy implícito / sem alteração de produção |

**Argon agora:** preparar ativos originais e conceitos da marca MF e a especificação visual da Inteligência, somente em branch/worktree próprios; inventariar ajustes A-D7 sem escrever nos mesmos arquivos do Executor. **Arquiteto:** revisar provas da D1.5.1, confirmar hashes e links, deliberar sobre integração apenas na staging.

## 5. Referência de review no PR #36

GitHub review de arquiteto, evento `COMMENT` (revisão formal `REQUEST_CHANGES` foi recusada pelo GitHub porque a conta que comenta é também autora do PR). A restrição de API não reduz a obrigatoriedade das correções aqui descritas.

**Documento aprovado para direcionamento operacional; PR #36 ainda não aprovado para release.**
