# Prompts oficiais para múltiplos chats e Work — Meu Financeiro 2.0

> **Missões atualizadas, 12/11/2026:** para os executores de Redesign Premium e Inteligência Operacional, NÃO utilizar os prompts antigos de auditoria como primeira etapa. Ler [Fast Lane](FAST_LANE_20261112.md), [contrato IC v1](INTELLIGENCE_UI_CONTRACT_V1.md), [backlog](FAST_LANE_BACKLOG.md) e acompanhar [issue #49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49). Esta alteração autoriza código em escopos R/I aprovados, não release nem escrita pessoal pela IA.


O proprietário utiliza ChatGPT Plus e prefere usar Work com eficiência. **Chat arquiteto** prepara roadmap, pesquisa, especificação e auditoria; **Work** executa inspeção em software, código, testes, alterações e PR. Não gastar sessão Work com discussão que pode ser feita no Chat. Estas recomendações são operacionais: limites e consumo variam; não há economia porcentual garantida.

## 1. Política de esforço do Work

| Esforço | Quando selecionar | Exemplo concreto |
| --- | --- | --- |
| **Leve** | Checkpoint, consulta curta de GitHub/CI, correção isolada, documentação e inspeção de um arquivo | Confirmar HEAD, checar job de preflight, corrigir rótulo |
| **Médio — padrão** | Auditoria de uma área, componente frontend isolado, paridade de um fluxo no PWA, testes e build já roteirizados | Planejamento calendário / corrigir bugs conhecidos / rodar suite |
| **Alto** | Auditoria global, arquitetura de sync/centavos, migrações, conflitos de PRs complexos, permissão/ações de IA, segurança e rollback | Conciliação SQLite×Cloudflare / modelo transacional de IA |

**Não confundir** esforço Leve/Médio/Alto do Work com o esforço low/medium descrito no shared/ai-policy.mjs do aplicativo. Preferir dividir missões Alto por contrato e domínio quando for viável. Se duas tentativas falharem, diagnosticar causa com log e revisar o prompt, em vez de repetir sem mudança.

## 2. Prompt 0 — recuperar checkpoint do Work anterior (Leve)

> Você assumirá o projeto privado JoaoVittorLi/meu-financeiro, anteriormente desenvolvido no Work "Meu Financeiro - Definitivo". **Não escreva código nesta etapa.** Leia AGENTS.md e docs/ai-context/README.md na branch docs/mf2-multi-agent-context-20261109 (ou branch/commit de integração posterior). Verifique branch, HEAD, alterações locais não publicadas, PRs ativos, últimos commits e testes comprovados; compare com PR #16 SHA c535cb0. Informe U1–U4, E1–E4.1, cloud, build e possíveis alterações de IA não publicadas com status EXISTE/TESTADO/INTEGRADO/PUBLICADO/NÃO OBSERVADO. Não invente estado da sessão anterior se inacessível. Entregue checkpoint compacto com riscos de colisão, documentos e primeira missão de ANÁLISE, sem alterações.

## 3. Prompt 1 — RODADA A, análise criativa profunda (Alto para visão global; Médio por domínio)

Copie o bloco abaixo para o Work depois do checkpoint. Se a sessão estiver curta, executar A0+A1 em uma missão Médio, A2+A3 em outra e A4–A7 depois, preservando mesmo relatório e roadmap atualizado; não reduzir critérios só para concluir.

### Início do prompt

Você é o analista técnico e de produto responsável pela **RODADA A de diagnóstico/ideação do Meu Financeiro 2.0**.

**Antes de qualquer ação:** confira GitHub, branch e SHA reais; leia AGENTS.md, docs/ai-context/README.md, CURRENT_STATE.md, ACTIVE_WORK.md, docs/ROADMAP_MF2.md, ANALYSIS_PLAYBOOK.md, PRODUCT_BLUEPRINT.md, IDEA_REGISTER.md, GAPS_AND_GATES.md, ARCHITECTURE.md, SOURCE_INDEX.md e os arquivos relevantes da implementação.

**Objetivo:** realizar uma auditoria minuciosa do estado real da versão 0.9.4/0.9.5-beta.6, PRs e possíveis mudanças não publicadas do Work anterior; mapear tudo que o 2.0 precisa corrigir e as melhores ideias de mercado que podemos adaptar. A abordagem deve ser **criativa, crítica e ambiciosa**, não limitada a reformular os recursos já listados. Propor melhorias originais e alternativas de UX, dados e IA que realmente elevem a gestão financeira, sem adicionar funções desnecessárias.

**Método obrigatório:**
1. A0: estado real de código, PRs, versões, testes, Windows/PWA, serviços, Work anterior. Diferenciar evidência de relato.
2. A1: mapear UX de cada área, pontos fracos do 1.0, telas U1–U3 existentes, lacunas de paridade U4; se possível capturar telas reais com dados sintéticos.
3. A2: auditar arquitetura financeira, sincronização, segurança, cálculos, SQLite/cloud/Pluggy e IA experimental.
4. A3: revalidar benchmark de Copilot, Monarch, PocketGuard, Rocket Money, Simplifi, YNAB, Origin, Cleo, Actual, Despezzas, Mobills, Organizze, Kinvo e alternativas relevantes, com fontes e ressalvas.
5. A4: propor 2–3 alternativas de fluxo e pelo menos uma inovação plausível por área importante. Destacar substituições que simplifiquem o produto.
6. A5: classificar problemas P0/P1/P2; priorizar propostas por impacto, esforço, custo, riscos e dependências; recomendar ADOTAR/MODIFICAR/SUBSTITUIR/ADIAR/REJEITAR.
7. A6: formular execução em missões pequenas por marco MF2-00…MF2-10, cada uma com arquivos/contratos, teste de aceite, dependencies e esforço recomendado Leve/Médio/Alto.
8. A7: publicar **somente documentação**, incluindo review em docs/ai-context/reviews/, IDEA_REGISTER.md atualizado, log datado e status **de Rodada A** no docs/ROADMAP_MF2.md, no mesmo PR. Não marcar nada como executado/homologado/publicado sem prova.

**Restrições absolutas:** nenhuma implementação nesta etapa; não migrar ou escrever em dados reais; não fazer merge, force push, cloud Production, inferência paga, cutover ou release; não alterar execução de CI apenas para esconder falhas. Não copiar assets de terceiros. Preservar Work não publicado.

**Saída:** sumário executivo com top 5 problemas e oportunidades, matriz 1.0→2.0, diagnóstico por tela e plataforma, benchmark fundamentado, lista de melhorias criativas com benefício/risco, roadmap revisado com alternativas/decisões pendentes, evidências e até três primeiras missões para Rodada B. Diga claramente o que precisa de minha aprovação. Não inicie a Rodada B até nova instrução.

### Fim do prompt

## 4. Prompt 2 — RODADA B, implementação de uma fatia (Médio por padrão)

Preencher após análise e aprovação explícita, nunca antes.

> **Missão:** MF2-XX / subentrega identificada. **Esforço:** Leve/Médio/Alto conforme risco. **Objetivo:** resultado observável e delimitado. **Ponto de partida:** HEAD/branch/PR/arquivos comprovados após reconciliação. **Dependências:** gates aprovados e contratos existentes. **Escopo:** fluxos/campos/serviços que você pode mudar. **Proibido:** arquivos/frentes de outros agentes, dados pessoais, flags migratórias, Cloudflare Production e mudanças de escopo não autorizadas. **Implementar:** UI + domínio + persistência + interações (fatia vertical) e estados de erro. **Testar:** unitários, integração, equivalência de centavos/datas, regressões, visual Electron/PWA, segurança/rollback conforme o domínio; reportar testes impossíveis como NÃO EXECUTADOS. **Documentar:** registrar log Markdown datado e atualizar docs/ROADMAP_MF2.md **nesta mesma branch/PR**, indicando status, SHA, evidência, risco, próxima etapa; ADR se mudança arquitetural; CURRENT_STATE somente após integração homologada pelo integrador. **Entrega:** commit, PR, tests, screenshots reais se possível, issues, checklist de aceite e próximo prompt proposto. Não assumir que compilação é homologação ou que PR é release.

## 5. Prompt 3 — Auditoria do Chat após Work (Leve no Work, análise no Chat)

> Audite a entrega MF2-XX publicada no PR #N, SHA [SHA]. Compare requisitos aprovados, diffs, contratos e docs/ROADMAP_MF2.md; verifique testes comprovados, riscos, UX e paridade. Emita APROVADO, APROVADO_COM_PENDENCIAS, REPROVADO ou NAO_HOMOLOGADO_POR_FALTA_DE_EVIDENCIA. Se houver bloqueio, produza **um prompt de correção pontual**; se aprovado, recomende o próximo marco já desbloqueado. Apresente até três melhorias de produto: essencial, desejável e futura — sem incluí-las no escopo sem autorização.

## 6. Orçamento de contexto

- Os prompts devem apontar para paths e SHA ao invés de colar arquivos inteiros.
- Evitar logs enormes quando testes passam; enviar diagnóstico e primeiro erro quando falham.
- Não usar Work Alto para apenas conferir status ou editar textos.
- Não reiniciar análise de benchmarking a cada hotfix; reabrir apenas se surgirem novos fatos.
- Guardar decisões em ADR e progresso no roadmap; não depender do histórico de uma conversa.
- Uma sessão faz **uma** missão delimitada, ou uma rodada analítica com entregáveis claros; não pedir "termine o 2.0" em um único prompt.
- Nunca executar alteração de alto risco só porque o custo de sessão preocupa; se necessário, dividir e pedir confirmação.
