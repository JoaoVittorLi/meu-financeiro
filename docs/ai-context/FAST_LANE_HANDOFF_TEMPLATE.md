# MF2 Fast Lane — formato curto de handoff entre os executores

**Issue central:** https://github.com/JoaoVittorLi/meu-financeiro/issues/49. **Base de código:** PR #48 / 810a2bc (só mudar por decisão do integrador). **Documentos:** FAST_LANE_20261112.md, INTELLIGENCE_UI_CONTRACT_V1.md, FAST_LANE_BACKLOG.md.

## Mensagem de check-in para comentário no issue

**[R | I] INÍCIO / CHECKPOINT / CONTRATO / BLOQUEIO / PRONTO**

- **Branch + SHA:** ...
- **PR Draft:** ...
- **Fatia do backlog:** P0.1 / P0.2 / ...
- **Contratos UI-xx e IC-xx usados:** ...
- **O que existe funcionalmente:** ...
- **Onde a UI consulta e onde age:** ... (ou, para I, payloads, funções e handlers disponíveis)
- **Arquivos alterados / ownership:** ...
- **Testes realmente rodados + ambiente:** ...
- **Screenshots Electron (R) / logs sintéticos (I):** ...
- **Compatibilidade da outra frente:** pronto para consumir / requer contrato / adapter em desenvolvimento
- **Bloqueio ou decisão necessária:** ...
- **Próximo pequeno resultado:** ...

Postar nos pontos de handoff; não encher issue de narração sem código. Uma mensagem de chat sem link no GitHub **não** conta como comunicação entre executores.

## Pedido de contrato novo

**CONTRACT-CHANGE PROPOSED — IC-v1 → v2**
- ID do card e jornada;
- Origem existente ou endpoint novo;
- Exemplo de payload tipado (todos os campos críticos, source, asOf, coverage, capability);
- Estados/permissão/erro;
- Ação, prévia, confirmação, recibo, undo;
- Mudanças compatíveis e impacto no outro executor;
- Teste e ordem de integração.

**Aceitação:** somente o integrador aprova e versiona o contrato; R pode seguir usando estado indisponível até integração.

## Checklist de PR por fatia

- [ ] Base/HEAD corretos; consultei #49 e HEAD do outro.
- [ ] Entrega é uma jornada, não somente design solto ou motor oculto.
- [ ] IDs UI-xx e IC-xx mapeados; nada fictício no perfil pessoal.
- [ ] Testes próprios passam; falhas/não executados explicitados.
- [ ] Renderer produzido canonicamente, se afetado; bundle gerado é resolvido no integrador.
- [ ] Screenshot real para mudança visível ou log/contrato de serviço para backend.
- [ ] ROADMAP_MF2 atualizado na linha da própria fatia, log curto em docs/ai-context/logs/, sem promover CURRENT_STATE.
- [ ] PR Draft aberto e linkado no issue #49, sem merge na main.
- [ ] Data, contrato e próximo passo visíveis ao outro executor.

## Regra para integrador

No primeiro par de PRs compatíveis, criar branch de integração própria; trazer serviço + UI, compilar, regenerar app/app.js, testar Node/SQLite/TypeScript/F08/ASAR, executar Electron sintético quando acessível, validar cada card/handler e publicar PR Draft integrado. Não aprovar release por screenshots ou suites isoladas.