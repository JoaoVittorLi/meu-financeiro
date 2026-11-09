# Protocolo obrigatório — manter o roadmap sempre atualizado

**Fonte de verdade de escopo e progresso:** docs/ROADMAP_MF2.md. **Fonte factual de release integrado:** docs/ai-context/CURRENT_STATE.md. **Log de execução:** docs/ai-context/logs/*.md. **Ideias não aprovadas:** docs/ai-context/IDEA_REGISTER.md.

> A mudança de código que não atualiza o roadmap não está documentalmente concluída. Os agentes devem deixar o roadmap correto **na mesma branch e PR**, não prometer fazê-lo depois.

## Quando atualizar

| Evento | ROADMAP_MF2 | Log/review | ACTIVE_WORK | CURRENT_STATE |
| --- | --- | --- | --- | --- |
| Análise sem código | Coluna Rodada A, recomendações e pendências, sem alterar status de execução | Relatório em reviews/ + log de análise | Se houver nova frente | **Não** promover features |
| Novo PR de feature/fix | Linha do marco, Rodada B em desenvolvimento, SHA/PR/escopo | Log no mesmo PR | Dono, arquivos e conflito | **Não** até integração |
| Alteração de requisitos/UX | Explicitar o que mudou e por quê, com link de ADR | Log e decisão | Se afetar ownership | Apenas se integrado |
| Testes executados | Atualizar evidência, falhas, bloqueios/gate | Comandos, ambiente, links | Quando alterar cronograma | Apenas integrador |
| Merge validado | Estado integrado, gate conforme prova | Log de integração | Liberar ownership | **Sim**, pelo integrador |
| Build/release/publish | Associar artifact+SHA+versão, atualizar gate | Log de release | Encerrar frente | **Sim**, se realmente publicado |
| Descoberta de erro | Acrescentar bloqueio/risco sem apagar histórico | Log ou issue com reprodução | Se bloquear outro agente | Se afetar baseline |

## Quadro de progresso por marco — valores permitidos

- **Rodada A:** PENDENTE, EM_ANALISE, ANALISADO, AGUARDANDO_DECISAO, APROVADO_PARA_EXECUCAO. Um agente documental pode propor "ANALISADO" com evidência, mas não "APROVADO" sem decisão do responsável.
- **Rodada B:** NAO_INICIADO, BLOQUEADO_Gx, EM_DESENVOLVIMENTO, EM_TESTE, VALIDADO, INTEGRADO, PUBLICADO. **VALIDADO** requer evidência dos critérios definidos; **PUBLICADO** requer artifact/deploy verificado.
- **Gate:** NAO_HOMOLOGADO, HOMOLOGACAO_PARCIAL, HOMOLOGADO, BLOQUEADO. P0 crítico/financeiro exige validação específica e não é liberado por teste meramente estático.

Uma mudança em uma branch ainda draft pode alterar a célula para "EM_DESENVOLVIMENTO [PR #N]" no branch da feature, mas **o estado canônico de integração não deve ser promovido até merge/validação**. Manter base e SHA visíveis para não confundir leitores.

## Campos a registrar ao modificar cada linha

- Marco MF2-XX, subentrega ou ID de proposta.
- Estado anterior → novo estado, fase A ou B.
- Branch, PR, commit base/final (ou link a HEAD vivo) e data.
- Resultado implementado/inspecionado e arquivos relevantes.
- Evidência concreta: teste/CI, navegador/desktop, cenário e ambiente.
- Testes **não** executados (ex.: Windows físico, PWA autenticado).
- Riscos de dado, rollback e dependências.
- Próximo passo e responsável.

Exemplo de atualização correta:
\`MF2-03 | A: ANALISADO (#NN review) | B: EM_DESENVOLVIMENTO (PR #NN, SHA...) | G3: NAO_HOMOLOGADO | U4 naveg. mobile concluída; autenticação e paridade real pendentes; testes synthetics... | próximo: smoke PWA real\`

Exemplo **incorreto**: \`MF2-03 concluído\` porque o pacote compilou, sem verificar funcionalidade, dados e PWA.

## Algoritmo de atualização da IA (em toda tarefa)

1. No início, leia HEAD, ROADMAP_MF2, CURRENT_STATE, ACTIVE_WORK, último log/PR relacionado.
2. Faça diff do roadmap local e da versão-base; identifique se outra IA editou a mesma linha.
3. Confirme marco e dependências; nunca reescreva todo o plano por conveniência.
4. Execute análise ou implementação dentro do escopo.
5. Atualize **a linha correspondente no roadmap**, com prova e estado correto.
6. Adicione/atualize log, ADR e IDEA_REGISTER quando aplicável.
7. Inclua documentação no commit/PR com o código; se for análise, no PR documental.
8. Verifique diff: não perdeu status de outras frentes? Nenhuma ação proibida? Referências apontam para arquivos reais?
9. Entregue links e reporte o que ainda não é possível homologar.
10. Integrador decide aprovação e atualiza CURRENT_STATE após a integração.

## Mudança do produto e criatividade

A criatividade está liberada na **Rodada A**. Se uma IA imaginar nova função, registrar em IDEA_REGISTER como PROPOSTA com problema, cenário, hipótese de valor, custo, risco, dependências e teste. **Não** adicioná-la automaticamente aos gates nem aumentar o escopo 2.0. Recomendar ADOTAR / SUBSTITUIR / ADIAR / REJEITAR. Depois de aprovada, atualizar seção correspondente do roadmap e criar ADR de mudança de escopo com data.

## Limites com múltiplos agentes

- Somente integrador atualiza o estado global CURRENT_STATE e confirma gates.
- Outros agentes **sempre atualizam o roadmap em sua branch**. Em caso de conflito sobre o mesmo documento, trazer alterações recentes e reconciliar as linhas, sem force push.
- Ownership de documentos globais deve ser coordenado em ACTIVE_WORK. Agentes não devem alterar o mesmo arquivo de integração simultaneamente sem revisão.
- Não sobrescrever logs anteriores; acrescentar log por tarefa e apontar para a fonte.
- Se o roadmap ou estado global não puder ser atualizado por limitação de ferramenta, **declarar a entrega documental incompleta** com patch proposto; não alegar que foi atualizada.

## Checklist para revisão do PR

- [ ] ROADMAP_MF2.md modificado corretamente (ou log declara ausência de mudança porque tarefa era estritamente sem efeito sobre roadmap).
- [ ] Log Markdown presente no mesmo PR, com SHA, testes e limites.
- [ ] Status da análise separado do status de execução.
- [ ] Gate não promovido sem prova.
- [ ] Decisions/IDEA_REGISTER atualizados quando mudanças de direção.
- [ ] CURRENT_STATE alterado apenas pelo integrador após prova de integração.
- [ ] Links, branch e SHA conferidos; nenhum segredo/pessoal incluído.
