## Sprint Premium #54 — 12/11/2026 (novo checkpoint)

Base #53/779cd31 preservada. Branch `feat/mf2-premium-productivity-sprint-20261112`, Draft [#54](https://github.com/JoaoVittorLi/meu-financeiro/pull/54) contra `integration/mf2-q1-operational-premium-20261112`. Código validado `e897140f3b93a9705bfdb7f44bb95112fff7a156`; commits seguintes contêm somente evidências/handoff. R3 Central, R2 Chat e R4 Movimentações têm jornadas funcionais verificadas; R5 começou com briefing e drilldowns, não foi declarado redesign completo.

542/542 Node/SQLite; TypeScript, compilação canônica, F08, proveniência, teste ASAR e ASAR real da candidata em TEMP, IPC Electron PASS. Electron sintético real com Computer Use, claro/escuro e 1366×768/1920×1080. [Evidências e limitações](evidence/2026-11-12-premium-sprint/README.md), [log](logs/2026-11-12-PREMIUM-PRODUCTIVITY-SPRINT.md).

Continuar pela branch do sprint, sem reaplicar #48/#51/#52/#53. Serviços I intactos. Revisar o diff e dependências futuras de Inteligência pelo #49 antes de integrar qualquer novo serviço. Próxima fatia visual pode expandir R5, preservando ledger e sem inventar saldos, inferência ou escrita pessoal. Não iniciar outro módulo completo por inferência. Nenhum merge main, build Windows pago, EXE, instalação ou dado pessoal alterado. Rollback de código: usar a base #53; confirmações sintéticas têm recibo/undo no perfil temporário. Para qualquer build futuro, renovar gates/proveniência no SHA aprovado; autorização do proprietário continua necessária.

# Handoff operacional — IA que vai assumir o Work "Meu Financeiro - Definitivo"

## Entrega Q1 — 12/11/2026 (prevalece sobre o histórico abaixo)

PR Draft [#48](https://github.com/JoaoVittorLi/meu-financeiro/pull/48), branch `qa/mf2-q1-integrated-windows-20261112`, base #47/d52df2a, já contém #46. Último código `9e4b1a8aa03ade64b9e5259d3834417d69bb0936`; HEAD posterior inclui documentação/evidências. Conferir SHA remoto antes de retomar. Checkout isolado `mf2-q1-windows-qa`; sem agentes concorrentes ou merge. U3 e banco pessoal preservados.

506/506 Node/SQLite PASS; TypeScript, compilação, F08, ASAR, proveniência e IPC Electron real PASS. QA nativo com Computer Use: oito áreas, claro/escuro,1366×768 e1920×1080, operações/recibos/SQLite e reinícios. Corrigidos filtro stale, alcance da edição de regras, expansão do chat, recorte da marca, semântica do simulador e serviços presos ao SQLite fechado após restore. Backups antes das confirmações somente sintéticos. Limites: restore completo por contrato automatizado, diálogo GUI cancelado; Pluggy real, perfil pessoal e pacote instalado não homologados nesta missão.

[Candidata e parâmetros CircleCI](Q1_WINDOWS_CANDIDATE.md) · [gates de escrita pessoal](Q1_PERSONAL_WRITE_GATES.md) · [evidências e antes/depois](evidence/2026-11-12-q1/README.md) · [log](logs/2026-11-12-Q1-INTEGRATED-QA.md).

Próxima ação depende da decisão do proprietário: revisar #48 e autorizar um build Windows na branch indicada. Não acionar job pago, gerar/instalar EXE, migrar banco pessoal, liberar escrita pessoal, fazer merge ou deploy por inferência desta entrega. O override de perfil sintético não funciona em binário empacotado; primeiro smoke instalado exige VM/conta Windows separada.

## Situação

Uma sessão Work anterior desenvolve o Meu Financeiro, mas sua área de trabalho e alterações ainda não publicadas **não foram inspecionadas diretamente por este Chat**. O GitHub é a única base verificada. Esta documentação é preparada especificamente para **outra IA assumir sem duplicar ou apagar o trabalho anterior**.

**Primeira tarefa não é escrever código: é reconciliar o estado do Work com o repositório.**

## Sequência obrigatória (executar nesta ordem)

1. Leia [README](README.md), [CURRENT_STATE](CURRENT_STATE.md), [ACTIVE_WORK](ACTIVE_WORK.md), [ROADMAP](../ROADMAP_MF2.md), [ARCHITECTURE](ARCHITECTURE.md).
2. Verifique a branch e SHA locais, status de alterações não commitadas, HEAD remoto, PRs e eventuais forks/ambientes. Não execute git reset --hard, checkout destrutivo, force push nem cherry-picks cegos.
3. Compare o estado local com design/despezzas-d1-d4, SHA c535cb01403689480d01560de3daa1cae71780d2, PR #16. Se U4 ou IA multiárea já estiverem implementadas em outro lugar, documente **onde**, **em que SHA** e **o que foi testado**.
4. Leia os documentos específicos da entrega; não repita funcionalidades que já existem. Verifique PRs empilhados (#1–#16), em especial bases diferentes.
5. Identifique o gate atual. **Primeiro execute a Rodada A de análise global e criativa**, seguindo ANALYSIS_PLAYBOOK.md e PRODUCT_BLUEPRINT.md. Não alterar código nesta primeira etapa. Na falta de evidências novas, **MF2-00** continua o primeiro gate de implementação posterior.
6. Após a análise receber aprovação, divida correções em escopo fechado; escolha arquivos sem colisão de outros agentes; preserve contratos, fixtures e contexto.
7. Execute testes e empacotamento apropriados, registrando **resultados reais no SHA exato**. Testes já relatados em docs não contam como nova execução.
8. Publique implementação **e log de contexto + atualização do ROADMAP_MF2.md no mesmo PR**. Atualize ACTIVE_WORK; apenas integrador atualiza CURRENT_STATE após homologação.
9. Prepare relatório compacto com SHA, PR, alterações, testes, evidências, limitações e próximo gate. Solicite revisão do Chat arquiteto para alterações financeiras, autenticação, IA operacional e release.

## Checkpoint obrigatório antes de retomar o trabalho anterior

Se possuir acesso à sessão/ambiente antigo, reúna:
- tarefa efetivamente aberta e progresso; branch/commit; arquivos alterados sem push;
- resultados de testes e capturas; builds instaláveis ou não; artefatos e respectivos hashes;
- U4 e IA 21 operações: verificar existência em código, escopo, confirmação, replay, rollback e logs;
- risco de sobreposição entre alterações locais e branches GitHub;
- próximo passo mínimo sem recomeçar o projeto.

Se o ambiente anterior não for acessível: **declare-o indisponível**, não invente o estado e continue da revisão publicada mais recente.

## Primeira solicitação ao agente: analisar, não implementar

Preparar diagnóstico de estado e UX em docs/ai-context/reviews/, registrar propostas em IDEA_REGISTER.md, atualizar **somente Rodada A do ROADMAP_MF2.md**, e solicitar decisão do proprietário/Chat arquiteto. A rodada B não começa até haver missão expressamente autorizada. Usar Work Médio por módulos ou Alto para arquitetura ampla; reduzir gastos de sessão com entregáveis precisos.

## MF2-00: primeiro trabalho executável se nada mais novo aparecer

- Branch-base conhecida: design/despezzas-d1-d4; PR #16; versão 0.9.5-beta.6.
- Na .circleci/config.yml, run_preflight e run_windows_build usam default false.
- Para somente preflight: run_preflight=true; run_windows_build=false.
- Para Windows: run_windows_build=true; o workflow exige preflight_linux antes do build_windows.
- Confirmar no CircleCI que Config/Checkout usam a mesma revisão e que SHA coincide com os testes.
- Baixar NSIS, portátil e SHA256.txt apenas quando os jobs passarem; registrar origem do artifact.
- Instalar em ambiente isolado e verificar Visão Geral, Movimentações, Planejamento, Orçamentos, Contas, Simulador, Inteligência, Configurações, temas, 1366×768, campos extensos, foco e teclado. Rodapé U3 na revisão original.
- Criar matriz de PRs a integrar, identificando commits já ancestrais e impedindo duplicação. Não integrar sem aprovação.

## Segredos / limites não negociáveis

- Não enviar SQLite real, extratos, cookies Cloudflare, tokens Pluggy/GPT, credenciais ou screenshots sensíveis ao GitHub.
- Não usar dados reais para testes não autorizados; usar fixtures sintéticas.
- Não ativar FINANCIAL_SCHEMA_ACTIVE ou FINANCE_SYNC_ENABLED; não publicar Cloudflare Production; não apagar o SQLite nem reimportar dados pessoais.
- Não ativar fallback pago da IA sem autorização.
- Não mesclar na main, criar release estável ou fazer cutover por inferência de que "está pronto".

## Resultado esperado do primeiro retorno

Na primeira resposta, checkpoint factual em até duas páginas: estado do repositório, estado local, diferenças, riscos e trabalhos não publicados. Em seguida apresentar o plano da Rodada A e o que será examinado, **sem executar a Rodada B**. Depois seguir o [protocolo](OPERATING_PROTOCOL.md).
