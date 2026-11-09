# Protocolo de desenvolvimento por múltiplos chats/Work

**Objetivo:** permitir concorrência produtiva sem duplicar trabalhos, alterar dados indevidamente ou perder decisões.

## Papéis

- **Chat arquiteto/auditor:** mantém escopo, define prompts e critérios, revisa PRs e evidências; não declara testes não executados.
- **Work executor:** código, infraestrutura de teste, build, smoke, documentação do que executou; usa branch e PR próprios.
- **Integrador:** único responsável pela atualização de CURRENT_STATE e conclusão dos gates após validação e merge apropriado.
- **Usuário:** autoriza operações sensíveis (custos, Production, cutover, publicação estável, migrações reais).

## Fluxo de mudanças

**Antes:** inspecionar GitHub e histórico de PRs, ler documentação, estabelecer SHA base, listar arquivos, consultar ACTIVE_WORK e reservar ownership; separar contratos.

**Durante:** trabalhar em branch dedicada, evitar sobreposição; alterações de schema aditivas; não contornar testes. Manter decisões complexas em ADR.

**Depois:** executar os testes realmente disponíveis; publicar código e doc no mesmo PR; log estruturado; informar SHA/testes e o que não foi verificado. Auditor avalia. Integrador registra integração aprovada.

## Regra de posse: um writer por arquivo compartilhado

Não editar simultaneamente src/app.ts, electron/main.cjs, electron/preload.cjs, shared/*, mobile-push/src/worker.js ou outras superfícies de integração por dois agentes sem acordo explícito. Se houver sobreposição, serializar mudanças ou introduzir uma branch de integração e resolver conflitos com testes.

**Documentação global:** somente integrador altera CURRENT_STATE e GAPS_AND_GATES; agentes de feature podem atualizar ACTIVE_WORK de forma coordenada e criar logs próprios. Revisar HEAD antes de escrever documentos globais.

## Log Markdown obrigatório

Cada trabalho que modifica código, dados de configuração, interface ou comportamento relevante cria um log em docs/ai-context/logs/YYYY-MM-DD-MF2-XX-resumo.md (se necessário, adicionar sufixo único). Incluir:

1. Título, ID, data, responsável e status.
2. Branch, SHA base, commit final e PR quando disponíveis.
3. Problema/objetivo e escopo explicitamente excluído.
4. Arquivos, contratos e mudanças realizadas.
5. Decisões e alternativas descartadas.
6. Testes executados (comando, ambiente, resultado, link); testes não executados.
7. Impacto sobre dados/sincronização/permissões, backup/rollback quando aplicável.
8. Evidências visuais e limitações.
9. Bloqueios, riscos, pendências, próximo passo dependente.

**Não** colar conversas, logs integrais, tokens, dumps SQLite ou dados bancários. Apontar links para commits, diffs, jobs e relatórios de teste.

## Estados válidos

NAO_INICIADO → EM_DESENVOLVIMENTO → EM_TESTE → VALIDADO → INTEGRADO → PUBLICADO. Pode haver BLOQUEADO em qualquer etapa.

- Implementado = código existe.
- Validado = critérios testados com evidência.
- Integrado = entrou na branch oficial de integração após revisão.
- Publicado = artefato/deploy identificado para usuários.
- Homologado = testes exigidos para gate aprovados no ambiente correspondente.
- Não observado = desconhecido; nunca converter em sucesso ou fracasso por palpite.

## Quando outra IA assumir

Seguir HANDOFF_NEXT_AGENT.md; comparar SHA remoto/local; procurar alterações inéditas e registrar estado. Não alterar roadmap arbitrariamente por erro operacional. Se surgir ideia nova, classificar correção bloqueante / melhoria da entrega / backlog 2.1.

## Revisão pelo Chat

- Correção menor: diff + teste focal.
- Nova tela: domínio, UX, estados, testes desktop/PWA.
- Motor financeiro/sync: invariantes, golden tests, conflito/rollback.
- IA/segurança: permissões, minimização, custo, autorização, execução auditada.
- Release: artifact hashes, smoke, backup, compatibilidade, checklist e aprovação.

Nunca alterar documentação para disfarçar teste ausente ou afirmar que o app foi instalado quando só compilou.
