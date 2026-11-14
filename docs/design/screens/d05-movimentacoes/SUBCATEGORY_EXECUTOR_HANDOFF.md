> **Aprovação do proprietário (13/11/2026):** “Muito bem! [...] categorias e subcategorias [...] 100% aprovadas.” Congeladas as **14 categorias-pai, 61 subcategorias, pictogramas SVG e cores**. **Isso NÃO significa código funcional implementado**. Executor deve concluir issue #74 com SQLite/IPC/IA, migração e QA. [Relatório dos problemas identificados](BUG_REPORT_AND_IMPLEMENTATION_GATES.md).

# HANDOFF AO EXECUTOR — D05-SUBCAT · Backend obrigatório + interface premium

**Urgência:** subcategorias são funcionalidade do produto, **não apenas estilo visual**. Issue de implementação [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74). Design D05 [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) **com taxonomia e ícones aprovados; tela completa continua em revisão**. PR design [#57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57); branch `design/mf2-screen-by-screen-20261113`.

## Documentos canônicos

1. [SUBCATEGORY_TAXONOMY_V1.json](SUBCATEGORY_TAXONOMY_V1.json) — **APROVADOS** 14 pais / 61 filhos, nomes, ícones, cores e associações; implementar no banco (ainda não implementado).
2. [ICON_SYSTEM_SUBCATEGORIES.md](ICON_SYSTEM_SUBCATEGORIES.md) — desenho vetorial premium, tonalidades por filho, contraste, identidade visual, classes CSS.
3. [SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md](SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md) — auditoria real de `electron/db.cjs` e `src/app.ts`, migration, IPC, tipos, regras, orçamento, IA e testes.
4. [PROTOTYPE_SUBCATEGORIES.md](PROTOTYPE_SUBCATEGORIES.md) — interface e interação de catálogo (após publicação da rodada).
5. [issue #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) — checklist bloqueante E1/E2/E3, só fechar com código funcional.

## Regras de coordenação

- O usuário executa os preflights CircleCI; **não executar** builds pagos no lugar dele. Quando QA solicitar pipeline, dar **branch, SHA, flags `run_preflight` / `run_windows_build` e resultados que deve devolver** após consultar a configuração atual. Não inventar SHA.
- Esta é a fila de engenharia a iniciar **após o Arquiteto verificar HEADs e conflitos atuais**, principalmente codepaths de Categorias, Inteligência e integração.
- Não juntar migration com entrega visual sem cobertura de regressões; usar branch e PR Draft próprios, sem merge em `main`, sem EXE experimental antes de autorização.

## Checkpoints

**E1 — Modelo e persistência**: schema de pai+filho, IDs estáveis, migração aditiva e idempotente, CRUD e vínculos para manual/banco/splits/regras/planning, fallback `subcategoryId=null` em registros antigos, testes de integridade/backup.

**E2 — Serviços/regras/autorização**: IPC/desktop bridge, read resolver para filtros pai/filho, regras direcionadas para subcategoria, conferência de afetados + previewVersion, invariantes de perfil e conciliação; IA pode propor mas não aplicar escrita pessoal por conta própria.

**E3 — UI e icon system**: componente vetorial registry `iconKey` com cores distintas e derivadas da família, picker hierárquico e criação/edição, filtros, badges, relatório por subcategoria, drilldowns D01–D05 + planejamento/orçamentos; QA 1366/1920 em claro/escuro com capturas reais.

## Atenção ao legado

`categories(name PK)` e `category_rules(category)` são bases existentes; migrar preservando FKs e comportamento de renomeação. No `package.json` consultado não existe dependência Lucide; implementar SVGs locais de forma licenciada/autorada. Não substituir valores `emoji` já persistidos sem migração/back-compat e proteção contra perda. Não migrar histórias de transações para filhos a partir de nomes comuns/IA sem confirmação específica. Na conta real, `IC-READ` não concede `IC-CATS`/escrita.

## Aceite de entrega

- [ ] PR com commit SHA/arquivos, tabela exata das alterações DB/IPC/renderer, migração com rollback e fixture legada.
- [ ] Demonstrar cadastro real de filho no SQLite e reaplicação após restart/restore, além de vínculos em movimentações e regras.
- [ ] Caso end-to-end: categoria Alimentação/Delivery atribuída a iFood em modo sintético; reabrir; filtrar pai e filho; criar regra para próximas compras com confirmação; garantir que resultados não duplicam.
- [ ] Caso legado: tx antiga `Alimentação` permanece com filho nulo, agregada ao pai, sem perda de orçamento/conta/rule.
- [ ] Testes de 630+ movimentações sintéticas, renomeação, split, conflitos, backup/restore, perfil real/demo e preflight CI quando autorizado.
- [ ] Evidência real dark/light do aplicativo; ícone vetorial para cada filho escolhido, texto AA e sem card negativo invisível.
- [ ] `PASS/FAIL/NOT_RUN` por gate; se não executou Electron, não declarar homologado.

**Lembrete obrigatório:** V1.2 visual e catálogo são propostas; o escopo E1–E3 não pode ser encerrado por apenas aprovar mock. Arquiteto/Integrador deve manter issue #74 aberta até **código + migração + testes reais**.
