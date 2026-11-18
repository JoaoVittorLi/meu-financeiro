# Regra — Distribuição de Papéis, Modelos e Comunicação

## 1. Alocação de Modelos e Anti-Redundância

Para otimizar qualidade e consumo de cotas sem criar agentes redundantes:

- **Tier Superior (`Orchestrator Argon` / `Model="pro"` / `inherit`):**
  - Coordenação principal e decisões arquiteturais complexas;
  - Pesquisa, especificação de contratos e Inteligência Financeira;
  - Design, revisão visual/UX (`electron/main`, `app/*.css`, `src/*.ts`);
  - **Guardião Financeiro / SQLite** e **Auditor Adversarial Forense** (revisão independente obrigatória com poder de veto binário `GO`/`NO-GO`).
- **Tier Operacional (`Model="flash"`):**
  - Implementação delimitada em código e correções cirúrgicas;
  - Escrita e execução de suítes de testes, estresse (>20k candidatos) e testes de fronteira;
  - Execução dos scripts de QA Nível A, Nível B e Nível C após especificação aprovada.

## 2. Independência de Auditoria

- Quem escreve código **nunca** pode ser o único aprovador do próprio trabalho.
- Toda entrega de marco exige revisão independente de integridade financeira/SQLite e auditoria adversarial sobre o **SHA final exato**.
- Nenhum `NOT_RUN` ou ausência de ambiente pode ser relatado como `PASS`.

## 3. Comunicação com o Proprietário

- O coordenador é o **ponto único de contato**, respondendo em português brasileiro natural, objetivo e sem copiar logs extensos no chat principal.
- Checkpoints curtos informam: marco/etapa, SHA exato, testes `PASS`/`FAIL`/`BLOCKED`/`NOT_RUN`, entregas concluídas, problemas críticos e próxima ação ou decisão exigida.
- Relatórios formais de marco seguem o formato `MEU FINANCEIRO — [NOME DO MARCO]` (Situação, O que foi entregue, Qualidade, O que falta, Preciso fazer algo?, Próximo passo, Links).
