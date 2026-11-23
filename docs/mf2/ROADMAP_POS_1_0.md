# Roadmap pós-1.0 — propostas versionadas, sem compromisso de entrega

> **DECISÃO P0/OPÇÃO A (17/11/2026):** o proprietário tornou a **categorização automática pessoal por conta** obrigatória para v1.0.0. Código em [PR #100](https://github.com/JoaoVittorLi/meu-financeiro/pull/100) **Draft sobre #96**; consentimento persistente e revogável, D05 14×61, I2-E, backups, recibos e reversão. **Não homologada:** 18 regressões sintéticas versionadas, Node oficial/SQLite integral/TypeScript/Electron Windows/QA visual **NOT_RUN**; v1.0.0 NO-GO. A escrita pessoal da IA para outras ações permanece desativada.

**Nota de escopo:** R05 fica listado apenas para rastreabilidade da decisão, mas é **gate de release 1.0**, não incremento pós-1.0. Outras ações IA pessoais (criação automática de regras abrangentes, pagamentos, alterações de orçamento) permanecem BACKLOG e bloqueadas.


**Estado inicial 17/11/2026.** A 1.0.0 ainda não foi lançada. Itens abaixo **não entram automaticamente no escopo do primeiro release** e não concedem autorização a codificar, gastar CI pago, usar credenciais reais ou escrever dados pessoais.

**Estados válidos:** `BACKLOG` (sem decisão), `PROPOSED` (opção identificada), `APPROVED` (proprietário autorizou implementação), `IN_PROGRESS` (código em elaboração), `DONE` (entregue **e** aceito no escopo indicado). **Nenhuma data/versão de entrega prometida**. Prioridades P0 (pré-requisito de segurança), P1 (alta utilidade), P2 (aperfeiçoamento).

| ID | Evolução | Prioridade | Estado | Dependência | Responsável proposto | Risco e critério de aceite |
|---|---|---|---|---|---|---|
| R01 | IC-READ composto: saldo disponível e compromissos futuros datados, cobertura e origem | P0 | PROPOSED | Geração verificável por conta/fonte, sem dupla contagem | Arquitetura IA + Integrador | Falso saldo; contrato versionado, QA zerocaso/ausente/parcial, jamais inventar R$ |
| R02 | Pulso B05 com projeção pessoal real | P1 | BACKLOG | R01, consentimento e reconciliação | Designer + Inteligência | Projeções enganosas; ring/timeline reconciliam centavos e exibem limitações |
| R03 | Inteligência Financeira I3 após investigação I3-01: explicações de tendência e continuidade | P1 | PROPOSED | IC2/grants e matriz de evidências I3-01 | Inteligência | Interpretação sem base; comparação reproduzível, dados parciais e nonce respeitados |
| R04 | Capacidade conversacional contextual com melhor resumo e fontes | P1 | BACKLOG | R03, qualidade e privacidade | Inteligência | Dado bancário fora de escopo; respostas citam fatos e não guardam dados revogados |
| R05 | **Categorização automática bancária pessoal — OBRIGATÓRIA ANTES DA 1.0** | P0 | IN_PROGRESS | PR #100 + D05/I2-E; QA Node/SQLite/Windows, calibração, consentimento MAIN | Integrador + Executor D05/IA | Escopo por conta, regra/manual > auto; cópias e recibos; **não é melhoria pós-1.0** |
| R06 | Cobertura bancária/Pluggy, tratamento de falhas e logs redigidos | P1 | BACKLOG | Continuidade stable e Windows QA 1.0 | Integrador | Cofre/consentimento, sem secrets em logs, histórico offline permanece |
| R07 | Backups, migrações v7+ e recuperação automatizada mais robusta | P1 | PROPOSED | RC-ALL-02.3 e política de retenção aprovada | Backend | Excesso de snapshots/permissões; fail-closed, teste WAL/rollback sem perda |
| R08 | Compatibilidade Cloudflare/Android e paridade v7 com subcategorias | P1 | BACKLOG | E1 paridade, esquema 17 tabelas + filhos, autorização/cutover | Cloud/Integrador | Dados incompletos; prova account/month/hash, rollback, sem upload automático |
| R09 | Diagnóstico de CI Windows e observabilidade pós-release | P0 | PROPOSED | Log concreto `build_windows=error`, Node/npm e runner | QA/Integrador | Falha ignorada; root cause e execução reproduzível antes do GO |
| R10 | Performance (listagem 2500+, renderer, SQLite indexes e latência) | P2 | BACKLOG | Benchmarks sintéticos por perfil | Performance | Mudança contábil acidental; métricas antes/depois e regressões em centavos |
| R11 | Acessibilidade: contraste, foco/teclado, reduced-motion e zoom | P1 | BACKLOG | QA visual B01–B05 no Electron | Designer/QA | Navegação impossível; screenshots e testes com teclado/sem mouse |
| R12 | UX: remoção de duplicidades visuais sem redesign das telas aprovadas | P2 | BACKLOG | Avaliação real do proprietário pós-1.0 | Designer | Regressão de ações; compatibilidade com design e atalhos |
| R13 | Qualidade contínua: baseline de testes por SHA, provenance/ASAR e gates automáticos | P1 | PROPOSED | Release G0–G7 e definição de orçamento CI | QA | PASS herdado; logs, hashes e report estruturado com revalid. |
| R14 | I3-00 visão arquitetural / próximos módulos exploratórios | P2 | BACKLOG | Escopo priorizado pelo proprietário | Arquiteto | Ideia ≠ implementação; ADR, contrato, threat model e aprovação |
| R15 | D01–D05 e B01–B05 já implementados na candidata | P0 | IN_PROGRESS | QA oficial do SHA #96 e aceite visual/Windows | Integrador/QA | Código entregue ≠ DONE; mudar para DONE somente após GO documentado |

## Política de avanço

1. **R05 já está aprovado como gate P0**, não é opcional no roadmap pós-1.0. R01 e demais melhorias precisam aprovação separada; a 1.0 não autoriza novas features. O release 1.0 não vira autorização genérica de feature.
2. Registrar no item: PR, issue, dono, estado, contratos, dados sintéticos, testes e SHA. R05 tem **Opção A decidida**: a 1.0 fica bloqueada até categorização automática bancária homologada; não adiar para roadmap.
3. Prioridades não são cronograma nem orçamento. `DONE` só após aceite técnico/humano e integração no ramo-alvo; sugestões I3 futuras não têm promessa de capacidade do modelo nem de data.
4. Manter #71 focada no GO da 1.0 e #49 em ownership; itens futuros podem ganhar issues próprias **após** autorização, sem congestionamento das pendências bloqueantes.
