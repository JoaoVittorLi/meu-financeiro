# RODADA A — protocolo de análise ampla, crítica e criativa

> **Esta é a próxima atividade de produto pedida pelo proprietário.** A primeira rodada é **análise**, depois haverá uma rodada separada de **execução**. A IA pode propor soluções ousadas e questionar decisões anteriores, mas deve distinguir **ideias** de **alterações aprovadas** e evitar ações destrutivas.

## Objetivo

Entregar diagnóstico técnico + UX + produto, avaliar o que já existe em 0.9.4/U1–U3/Preview/IA, aprofundar benchmark e desenhar o melhor produto financeiramente confiável para o lançamento 2.0.

### Entradas obrigatórias

1. README.md, CURRENT_STATE.md, ACTIVE_WORK.md, HANDOFF_NEXT_AGENT.md, ROADMAP_MF2.md.
2. PRODUCT_BLUEPRINT.md, IDEA_REGISTER.md, GAPS_AND_GATES.md e ARCHITECTURE.md.
3. U1/U2/U3 docs, D1–D4, E1_CONCILIATION_REPORT.md, PARITY_AND_UNIFIED_RELEASE.md, INTELLIGENCE_PARALLEL_INTEGRATION.md.
4. Código e testes relevantes do SHA real; CI PR #15 e PR #16, PRs dependentes e commits não publicados da sessão Work se acessíveis.
5. Quando possível, telas reais Windows/PWA em ambiente autorizado com **dados sintéticos**.

## Método da análise (A0 a A7)

### A0 — Reconciliação do estado real
Conferir SHA local/remoto, branches, PRs, últimos commits, arquivos não publicados, builds/artefatos/release. Se "Meu Financeiro - Definitivo" não estiver acessível, declarar o limite. Criar mapa **EXISTE / TESTADO / INTEGRADO / PUBLICADO / NÃO OBSERVADO** por tela e por plataforma.

**Resultado:** atualizações propostas a CURRENT_STATE e ACTIVE_WORK, sem sobrescrever integrador; diferença GitHub × Work documentada.

### A1 — Auditoria da experiência 1.0/U1–U3
Analisar cada área pela jornada real; fluxo de cliques, valores, estados, erros, acessibilidade, tamanho da tela, ruído, velocidade. Comparar interface atual com proposta. Separar bugs comprovados de problemas de preferência.

**Resultado:** tabela problema → causa → risco → solução → tela afetada → prioridade; capturas e links quando disponíveis.

### A2 — Auditoria financeira/tecnológica
Verificar origem/saldos/centavos, cobertura de extrato, datas, bank/manual, splits, plano, orçamento, vínculo, parcelamento, concorrência, backup, auth, custos. Classificar consequências de qualquer mudança no modelo canônico.

**Resultado:** invariantes, lacunas de teste, serviços existentes para reutilizar, migrações necessárias e gates.

### A3 — Benchmark atual e pesquisa
Revalidar padrões publicamente documentados de Copilot, Monarch, YNAB, Rocket Money, PocketGuard, Simplifi, Origin, Cleo, Actual, Mobills, Organizze, Kinvo e outros justificadamente relevantes. Citar páginas e datas; distinguir design observado de marketing, protótipos pagos inacessíveis e recursos incertos.

**Resultado:** decisões reproduzíveis, sem cópia de componentes proprietários.

### A4 — Ideação ampla (liberdade criativa)
Propor alternativas concretas **na mesma jornada**; pelo menos uma melhoria incremental, uma experiência visual ousada mas aplicável e uma simplificação por área relevante. Considerar IA, automação, radar, visualização, fluxo futuro, aprendizado de categorias, investimentos básicos.

**Resultado:** ideias descritas com fluxo antes/depois, origem de dados, benefício, risco, custo relativo, dependência e testes. Não promover todas ao escopo.

### A5 — Priorização e trade-offs
Para cada ideia, avaliar de 0 a 3: impacto na decisão do usuário, frequência de uso, confiabilidade/segurança, reutilização entre áreas e esforço relativo (quanto menor melhor). Considerar dependências e capacidade do Work; risco alto implica gate de autorização. **Não somar números como verdade científica**; usar pontuação apenas para comparação acompanhada de justificativa.

Classificar:
- **P0 Bloqueante:** corrigir integridade, dados, segurança, builds e paridade essencial;
- **P1 Essencial 2.0:** melhora efetiva da gestão e da experiência, no roadmap;
- **P2 Opcional/2.1:** bom recurso sem dependência obrigatória;
- **Descartar:** alto custo para ganho baixo, duplicação ou fonte não confiável.

**Resultado:** ADOTAR / MODIFICAR / SUBSTITUIR / ADIAR / REJEITAR, decisão proposta não executada.

### A6 — Plano de execução em fatias verticais
Para cada marco: ordem, arquivos, contratos, endpoints, componentes, persistência, migração, riscos, testes (unit/integração/e2e/visual) e critério de aceite. Definir separação de trabalho Chat/Work, nível Leve/Médio/Alto e dono de arquivos para evitar colisões. **Não** pedir execução de todos os marcos em uma única sessão.

**Resultado:** primeira fatia MF2-00 ou outra se descoberta evidência mais recente já a concluiu; até três próximas missões, com dependências claras.

### A7 — Relatório e checkpoint de decisão
Publicar em docs/ai-context/reviews/YYYY-MM-DD-MF2-ANALYSIS.md no PR documental apropriado, com links e evidências. Atualizar ROADMAP_MF2.md **somente** com status de análise, recomendações identificadas e trade-offs; **não** marcar execução como concluída. Atualizar IDEA_REGISTER.md e log de análise. Entregar um sumário para o proprietário revisar e decidir.

## Template obrigatório do relatório da Rodada A

1. Resumo executivo: top 5 riscos e top 5 oportunidades, com evidências.
2. Baseline: branch, SHA, PRs, versões, diferenças com Work, o que não foi observado.
3. Diagnóstico por tela: Windows/PWA, existente, falha, prova, oportunidade, prioridade.
4. Diagnóstico financeiro/cloud/IA: invariantes e riscos.
5. Benchmark fundamentado: referência, padrão, fonte, adaptação e ressalva.
6. Ideias priorizadas: problema, fluxo proposto, objetivo, dependência, custo, risco, impacto.
7. Arquitetura/opções: MANTER versus SUBSTITUIR, custo de migração e contrato.
8. Roadmap revisado: o que permanece, muda, sai, entra como candidato e por quê.
9. Plano de execução: 1–3 missões concretas, com testes, prompts e gates.
10. Pendências de decisão do usuário: apenas as que alteram risco, custo, direção ou escopo.

## Restrições da primeira rodada

- **Não** fazer merge, rebase destrutivo, force push, migração/cutover, deploy Production, pagamento de API, leitura de banco real ou alteração no aplicativo.
- Análise pode criar **somente documentação/fixtures isoladas quando necessário**, identificando o que foi efetivamente escrito.
- Se uma análise exigir custo, permissão ou credenciais privadas, registrar a limitação e alternativa segura.
- Não transformar uma sugestão criativa em requisito sem registro de aprovação.
- Não fingir screenshots reais se navegador não abrir; descrever a limitação e verificação alternativa.

## Separação explícita da Rodada B

**Rodada B exige comando de execução posterior, específico e autorizado**, de preferência a partir do prompt aprovado. Ela usa ROADMAP_MF2 como contrato e atualiza o status + log após cada mudança. O aprendizado de cada execução alimenta a próxima rodada de revisão, mas não recria o roadmap todo.

## Recomendações de esforço (Work Plus)

- **Leve**: checkpoint/PR/CI, inspeção de documentação, revisão pontual de status.
- **Médio**: auditoria por módulo, inspeção funcional/visual de uma ou duas áreas, plano de componente.
- **Alto**: análise global de arquitetura financeira, sincronização, segurança e IA; usar com objetivo bem definido e evidência esperada.

O Chat arquiteto pode fazer benchmarks e preparação de prompts fora do Work; use Work para acesso a software/computador, testes e código. Tarefas que exijam Alto podem ser separadas por domínio para reduzir custo de sessão.
