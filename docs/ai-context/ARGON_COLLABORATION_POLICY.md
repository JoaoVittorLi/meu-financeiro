# Política permanente — Argon (Gemini Pro) e Chat Arquiteto

**Origem:** decisão do proprietário e [parecer B1.1 do Chat Arquiteto](https://github.com/JoaoVittorLi/meu-financeiro/pull/20#issuecomment-6774981743), 10/11/2026. **Status:** política de colaboração e propostas, não homologação nem autorização de deploy/escrita. G0 e G1 continuam `NAO_HOMOLOGADO`.

## Obrigação em cada subentrega

Em cada novo item de entrega no `docs/ROADMAP_MF2.md` e respectivo log, declarar exatamente:

**`Argon necessário? NÃO / AUDITORIA / PARALELO`**

- **NÃO:** não acionar o Argon por rotina; justificativa de escopo simples/teste oficial suficiente.
- **AUDITORIA:** revisão independente, direcionada, **sem alteração de código** até aval do Arquiteto. Entregar riscos P0–P3 com arquivo/linha, cenário reproduzível, impacto, mitigação mínima e evidência. Sem relatório genérico de 360°.
- **PARALELO:** produzir código somente em **branch exclusiva** com arquivos delimitados, sem acessar ou sobrescrever área sob ownership do Executor; PR próprio e testes próprios. Integração decidida exclusivamente pelo Chat Arquiteto + proprietário.

P0/P1 impedem **operações arriscadas** até correção/decisão explícita. P2/P3 viram backlog, salvo se violarem critérios de aceite da missão. Não executar buscas/auditorias repetitivas sem fatos novos.

### Matriz operacional e prompts prontos

Cada ficha inclui **objetivo, momento, branch/arquivos, dependências, aceite, riscos e prompt**.

#### MF2-01 / B1.1 — Argon necessário? NÃO

- **Objetivo:** homologar tecnicamente testes de regressão e classificação POSTED/PENDING/unknown, sem mudança de fluxo financeiro.
- **Momento/branch:** agora, `feat/mf2-01-b1-cloud-reconciliation`, PR #20.
- **Dependência/aceite:** Node 22.23.4/npm 10.9.9 com `node --test`, test:db, test:types, compile, testes Worker, Wrangler dry-run e CI Linux no SHA final. Bloqueios de infraestrutura não viram PASS.
- **Risco:** tratar harness V8 como CI oficial, ou considerar PENDING como receita/despesa confirmada.
- **Prompt Argon:** não aplicável.

#### MF2-01 / B2 — Argon necessário? AUDITORIA

- **Objetivo:** auditar contrato de transporte privado Windows↔Cloudflare sem exportar extratos brutos a frontend, cobrir autenticação/identidade, integridade, cobertura, consistência, concorrência/CAS, idempotência, minimização e backup/rollback.
- **Momento:** após proposta de contrato técnico e antes de qualquer endpoint com dados detalhados, operação de escrita, troca de fonte canônica ou autorização Production. Não repetir a auditoria B4.
- **Branch/ownership:** Executor propõe `feat/mf2-01-b2-protected-transport` (ainda não criada); arquivos sob revisão `electron/cloud-*.cjs`, `mobile-push/src/finance-*.js`, `shared/mf2-reconciliation.mjs`, contrato B2; **Argon somente comenta**, não edita. Escopo exato determinado pelo diff futuro.
- **Dependências:** B1.1 oficial executada e decisões de transporte assinadas pelo Arquiteto; Access + identidade privada existente; snapshots SQL e controle de revisão documentados.
- **Critérios de aceite:** ameaças e paths P0–P3; teste de BOLA/IDOR, sessão expirada, replay, 409/CAS, snapshots divergentes, vazamento em logs, rollback e integridade; proposta mínima sem comprometer E1; nenhuma credencial exposta.
- **Riscos:** exfiltração, MITM/session fixation, falso snapshot consistente, race, exposição de IDs, sobreposição manual/bancária e cutover prematuro.
- **Prompt recomendado ao Argon:**
  > Revise EXCLUSIVAMENTE o contrato MF2-01/B2 e o diff da branch de transporte que eu fornecer. Leia AGENTS.md, o contrato de conciliação B1, o desenho B2 e as rotas existentes de autenticação/Access. Atue como auditor independente READ-ONLY. Procure BOLA/IDOR, autenticação/identidade, snapshot as-of e cobertura, proteção de chaves/IDs, minimização de campos, conflitos CAS, reenvio/idempotência, backup/rollback e logs sem PII. Entregue apenas P0–P3 com arquivo/linha, evidência e teste reproduzível, mitigação mínima e decisão go/no-go para **sandbox**, não Production. Não altere código ou segredos, não faça deploy nem teste com dados pessoais.

#### MF2-02 — Argon necessário? AUDITORIA

- **Objetivo:** revisão especializada dos cálculos financeiros compartilhados de centavos, datas, natureza, transferências, splits, planejamento, saldos, dívida e patrimônio.
- **Momento:** após golden tests Windows/PWA em branch MF2-02 própria e antes de declarar núcleo compartilhado estável.
- **Branch/arquivos:** `feat/mf2-02-finance-core` (proposta, não criada), `shared/finance-*.mjs`, golden tests novos; Argon sem permissão de editar os mesmos arquivos.
- **Dependências:** B2 protegida, contrato de fontes/saldos e cobertura, decisões de arredondamento, snapshots sintéticos.
- **Aceite:** casos extremos, centavos, múltiplos splits, transferências sem receita, saldo desconhecido, recorrências e período; P0/P1 resolvidos antes de ações de escrita.
- **Riscos:** dupla contagem, arredondamento, balance as-of, descompasso Windows/PWA.
- **Prompt Argon:**
  > Audite somente a engine financeira compartilhada MF2-02 e seus golden tests, nos caminhos/commits informados. Priorize operações em centavos, datas/fuso, split, saldo desconhecido, transferências próprias, pendências, receitas incertas, parcelas, juros e diferenças Windows/PWA. Produza falhas P0–P3 com exemplos sintéticos reproduzíveis e correções mínimas; não altere os arquivos, não acesse finanças reais e não declare gate homologado.

#### MF2-03 (U4/PWA) — Argon necessário? PARALELO (condicional)

- **Objetivo:** desenvolver **componentes de interface PWA autônomos** para paridade visual/jornadas U1–U3, nunca conciliação nem dados financeiros base.
- **Momento:** somente após Arquiteto autorizar fatia de UI independente e definir ownership/contratos; enquanto o Executor trabalha em serviço financeiro sem tocar os mesmos arquivos.
- **Branch/arquivos:** Argon em `feat/mf2-03-u4-argon-ui` (proposta, não criada). Permissão de escrita **apenas** em componentes de UI novos sob `mobile-push/public/` ou pasta de componentes criada para U4 **listados antes da execução**. Vedados `shared/mf2-*`, `electron/cloud-*`, `mobile-push/src/finance-*`, auth, CI e docs globais compartilhados. Se houver conflito, Argon não inicia.
- **Dependências:** APIs/contratos UI fixados, baselines testadas, ownership confirmado.
- **Aceite:** visual premium responsivo, estados offline/erro, acessibilidade, navegação, testes UI próprios, sem cálculo financeiro duplicado, PR separado; nenhum deploy Production.
- **Riscos:** regressão visual, dados mockados como reais, divergência de contratos, escrita concorrente.
- **Prompt Argon:**
  > Você é desenvolvedor paralelo de **UI U4/PWA**. Parta somente da branch/base SHA informada pelo Arquiteto. Edite exclusivamente a lista de novos componentes UI autorizados sob mobile-push/public; crie branch feat/mf2-03-u4-argon-ui e PR draft próprio. Não toque nos arquivos sob ownership do Executor (shared/mf2-*, electron/cloud-*, mobile-push/src/finance-*), nem em auth, CI ou infraestrutura. Reuse os contratos existentes, não crie cálculos financeiros duplicados, não exiba dados simulados como reais, execute os testes pertinentes e anexe evidências visuais. Aguarde revisão antes de integrar.

#### MF2-04 — Argon necessário? AUDITORIA

- **Objetivo:** revisão UX/visual dirigida do dashboard e design system; estados de cobertura, telas estreitas, acessibilidade, qualidade dos indicadores fixos/variáveis.
- **Momento:** após o redesenho já implementado estar em Preview isolado e antes de aceite UX; não refazer benchmark amplo.
- **Branch/arquivos:** branch MF2-04 a definir; `src/app.ts`, `app/*.css`, `mobile-push/public/finance*.js` apenas sob leitura; proprietário dos arquivos mantém edição.
- **Dependências:** capturas reais 320/390/768/1366/1920, métricas fundamentadas por fonte.
- **Aceite:** findings P0–P3 focados, evidências de responsividade/teclado/contraste e correções específicas.
- **Riscos:** regressão, visual sem informação confiável, sugestão de UX desalinhada com produto.
- **Prompt Argon:**
  > Avalie exclusivamente as telas de Visão Geral e design system MF2-04 nas capturas e branch indicadas. Priorize hierarquia visual, acessibilidade, uso mobile/desktop e indicadores fixos/variáveis com origem explícita; não proponha refazer todo o produto. Relate P0–P3 com screenshot/arquivo e critérios objetivos, sem editar código ou tocar em Production.

#### MF2-09 — Argon necessário? AUDITORIA

- **Objetivo:** segurança e controle das ferramentas de IA com acesso a funções de leitura/escrita: prévia Antes→Depois, confirmação explícita, permissões, auditoria, rollback condicionado e proibição de pagamentos.
- **Momento:** antes de habilitar ferramentas sobre dados financeiros reais e antes de API paga em produção.
- **Branch/arquivos:** branch MF2-09 a definir; `electron/ai-*.cjs`, `shared/ai-*.mjs` e handlers backend, read-only para Argon.
- **Dependências:** contratos de escrita do domínio, política de consentimento, testes de revogação/replay/role.
- **Aceite:** negativa segura para P0/P1, provas de consentimento e rollback condicionado; todos os comandos tipados testados com cenários falsos.
- **Riscos:** prompt injection, excesso de privilégio, escrita silenciosa, inferência falsa, custo IA não consentido.
- **Prompt Argon:**
  > Audite apenas permissões e ferramentas IA MF2-09 nas branches/commits que eu anexar. Modele abuso por prompt injection, acesso indevido a conta, mutações sem confirmação, alterações concorrentes, replay, logs financeiros e rollback; valide o fluxo Antes→Depois e proibição de pagamentos. Entregue vulnerabilidades P0–P3 com testes sintéticos, sem executar transações, usar credenciais reais ou modificar Production.

#### MF2-10 — Argon necessário? AUDITORIA

- **Objetivo:** auditoria final independente de produto, segurança e regressão Windows/PWA antes de qualquer release estável.
- **Momento:** após evidências dos gates G0–G9, smoke e pacote de release candidato; não antes nem substituindo CI.
- **Branch/arquivos:** branch release candidate a definir, revisão de commits/artefatos e checklists; nenhuma edição concorrente pelo Argon.
- **Dependências:** hashes/links EXE/PWA, backup+restore, testes de segurança, consentimento e regressão.
- **Aceite:** P0/P1 resolvidos, matriz de regressões e release go/no-go com limites provados, sem dados bancários pessoais em relatórios.
- **Riscos:** distribuição defeituosa, perda de dados, vazamento, rollback impossível.
- **Prompt Argon:**
  > Realize auditoria final de segurança/produto MF2-10 na release candidate informada, usando os testes, hashes, artefatos e evidências existentes. Não repita auditorias anteriores sem um risco novo. Classifique P0–P3, proponha testes mínimos e go/no-go fundamentado por SHA. Sem acesso a segredos, dinheiro real, deploy ou alterações de código.

### Marcos sem Argon por padrão

- **MF2-05:** Argon necessário? NÃO — classificação/recorrência testada primeiro com golden fixtures e revisão do Arquiteto. Elevar para AUDITORIA se surgirem ferramentas de escrita automática/alto impacto.
- **MF2-06:** Argon necessário? NÃO — cálculos dependem da engine MF2-02 auditada; testes de cenários devem acompanhar Livre para Gastar/Pix×parcelamento. Elevar se alterar contabilização.
- **MF2-07:** Argon necessário? NÃO — metas/dívidas em escopo funcional com testes; revisão de cálculos herdada de MF2-02; reavaliar se surgir regra financeira complexa inédita.
- **MF2-08:** Argon necessário? NÃO — patrimônio e relatórios exigem evidências próprias; auditoria se houver recomendação de investimento com execução.
- **MF2-00 / B4:** encerrada com ressalva; não pedir auditoria Argon retroativa só por padrão.

**Nunca entregar a duas IAs controle de `docs/ROADMAP_MF2.md` ou `docs/ai-context/CURRENT_STATE.md` simultaneamente.** Toda ideia aprovada continua passando pelo Arquiteto e entra no `IDEA_REGISTER.md` antes de escopo vinculante.
