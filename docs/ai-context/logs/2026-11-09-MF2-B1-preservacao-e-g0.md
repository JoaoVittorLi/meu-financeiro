# Log — B1/MF2-00: inspeção de branches históricas e preparação do G0

**Data:** 09/11/2026 · **Tipo:** revisão documental por API GitHub, **sem implementação**.
**Candidata (preservada):** `integration/mf2-baseline-candidate-20261109` / SHA `7a01f1cc344e88188bc5eeea59bf2324335a051e`.
**Trabalho nesta branch documental:** `docs/mf2-b1-baseline-audit-20261109`, derivada do SHA candidato; PR draft direcionado à candidata. Não modifica o código compilável nem a branch de integração.

## Ações realizadas e evidências
1. Lidos `BRANCH_CONSOLIDATION_PLAN.md`, `MARKET_FEATURES_DEEP_DIVE.md`, `ROADMAP_MF2.md`, `ACTIVE_WORK.md` e instruções de testes.
2. Confirmado por compare GitHub: candidata está 13 commits à frente de #16 e **0 atrás**; 29 arquivos alterados, somente documentação/governança; seu runtime é o mesmo de `c535cb0` (#16).
3. Lidos SHA/PRs e comparados árvores de blobs e conteúdo funcional dos PRs #2 `25bf7269`, #3 `10c9a1fa`, #4 `ebae60e7`, #5 `3eaca803` contra a candidata. IA UI, auth/vault, políticas e CI estão presentes/evoluídos, mas cinco arquivos exclusivos eram documentação/atalhos Codespaces; publicação de GitHub prerelease antiga não foi portada. Relatório traz classificação com ressalvas.
4. Histórico de CI: #5 `3eaca803` build_windows verde job 4, #15 `44fb1b0` preflight e Windows verdes jobs 20/21; nenhum check encontrado no SHA `7a01f1c`. Não confundir status ausente com falha.
5. Verificadas políticas de CI em `.circleci/config.yml` e `.circleci/build-windows.ps1`: Linux preflight exigido antes de Windows; NSIS/portable/hashes e ASAR. **Preparado**, não acionado.
6. Publicado [relatório B1](../reviews/2026-11-09-MF2-B1-BRANCH-AUDIT.md) e atualizada apenas a **evidência de MF2-00** + checkpoint em [ROADMAP](../../ROADMAP_MF2.md). Sem mudança nos valores Rodada B ou Gate.

## Não foi feito / limitações
- Não foi possível acessar diretório local, diffs não commitados, logs e artefatos do Work “Meu Financeiro - Definitivo”. Não houve recuperação de dados locais; o responsável pelo workspace deve obter o checkpoint antes de qualquer merge.
- Nenhum `npm install`, `npm test`, `npm run compile`, CircleCI job, Electron Windows, navegador PWA autenticado, verificação de SQLite pessoal, hash de EXE real, smoke, deploy, release ou custo de IA foi executado por esta revisão.
- Não houve merge de #2–#5, force push, mudança de `main`, Cloudflare Production, ativação de flags financeiras, teste com dados bancários ou alteração de credenciais.
- PRs #2–#5 **não foram encerrados**: classificados apenas como potencialmente substituíveis após revisão, CI, smoke e decisão do integrador.
- Build sem lockfile e dependências Node 22 obtidas de versão mais recente ainda ameaçam reprodutibilidade; registrar em C11 antes de considerar G0.

## Ordem exata a seguir
**C0** recuperar checkpoint Work/single writer → **C1** aprovar matriz e decidir a capacidade histórica de publicação de pré-releases → **C2a** CircleCI preflight na branch candidata e SHA alvo com `run_preflight=true`, `run_windows_build=false` → **C2b** build Windows com autorização `run_windows_build=true` → **C2c** baixar 2 EXEs+SHA256, validar hashes/ASAR e executar smoke em perfil sintético isolado → **C3** análise integrador, logs/roadmap, decisão sobre fechar PRs substituídos → **C4** somente após prova homologar G0.

**Status:** CHECKPOINT DE PRESERVAÇÃO DOCUMENTADO / C0 PENDENTE / C2 NÃO EXECUTADO / G0 **NAO_HOMOLOGADO**.
