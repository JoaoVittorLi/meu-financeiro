# D05 V1.2 — Subcategorias Premium · protótipo e status

**Status:** `PROTOTYPING / WAITING_FEEDBACK`. O proprietário pediu adicionar subcategorias e ícones vetoriais vinculados; **a taxonomia e a tela ainda requerem aprovação final**. O backend/SQLite **NÃO foi alterado** nesta missão de design. Implementação real é bloqueante: [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74). Design base: [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70).

## Demonstração

[prototype-subcategories.html](prototype-subcategories.html) é um HTML standalone de D05 V1.2 com **14 grupos e 61 subcategorias**, ícones SVG próprios, cor tonal individual, agregação em pais, linha de movimentação com nome do filho e valor vermelho/verde, seletor de subcategoria, criação local e reconfirmação de reclassificação demonstrativa.

**É demonstração, não dados do usuário:** 13 lançamentos sintéticos internos; sem chamadas SQL/IPC, sem Cloudflare, sem gravação e sem alegar criação real de filho. O HTML não é executado no Electron. Para a visualização local, abrir como HTML em navegador compatível; o link GitHub pode mostrar o código-fonte, não renderizar a experiência.

## Documentos obrigatórios

- [SUBCATEGORY_TAXONOMY_V1.json](SUBCATEGORY_TAXONOMY_V1.json): 14 categorias + 61 filhos, ID estável, parentId, iconKey, hue.
- [SUBCATEGORY_SVG_REGISTRY_V1.json](SUBCATEGORY_SVG_REGISTRY_V1.json): 67 desenhos de traço vetorial, todas as chaves contempladas; registro de **protótipo**, não artefato de produção.
- [ICON_SYSTEM_SUBCATEGORIES.md](ICON_SYSTEM_SUBCATEGORIES.md): tokens, cores por filho, contrastes, escolhas de identidade, fallback.
- [SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md](SUBCATEGORIES_IMPLEMENTATION_CONTRACT.md): auditoria SQLite/Typescript e contrato obrigatório de migração/CRUD/IPC/regras/IA/orçamentos.
- [SUBCATEGORY_EXECUTOR_HANDOFF.md](SUBCATEGORY_EXECUTOR_HANDOFF.md): E1 persistência, E2 serviços/regras, E3 UI e integração.
- [SUBCATEGORY_QA.md](SUBCATEGORY_QA.md): testes efetivamente executados e gates de engenharia restantes.
- [issue de Engenharia #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74): item de roadmap que **não pode ser fechado com apenas o design**.

## Comportamento demonstrado

1. Escolher categoria-mãe na lateral → catálogo de filhos filtrado; clique filho → lista mostra só aquela subcategoria.
2. `Sem subcategoria` é um **filtro virtual**, associado a `subcategoryId = null`, nunca ID inventado.
3. Cada subcategoria tem `iconKey`, `hue` e fundo próprio; alternar light/dark preserva contraste.
4. `Nova subcategoria` vincula rascunho ao pai selecionado, valida duplicata case/acento, escolhe SVG e tom; cria somente na memória local.
5. `Personalizar ícone` (após selecionar um filho) altera aparência local, sem recategorizar lançamentos.
6. Selecionar movimentação → categoria pai → filho elegível → prévia/reconfirmação com checkbox inicialmente desmarcada → mudança **somente nesta demonstração**.
7. Alterar pai limpa o filho, evita associação inválida; app real precisa validar também no backend.
8. Receita/despesa/transfers por natureza e status, sem usar cor do ícone para mudar valor; PENDING fica fora de entradas/saídas confirmadas.

## Bloqueios para declarar concluído

**Não** implementar SQLite/IPC, não testar Electron real, não homologar migração, não presumir que os 61 filhos são dados reais ou que a IA já consegue ler/gravar essa hierarquia. O usuário pediu explicitamente que isso **seja codificado**: conferir [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74).

A versão permanece em revisão até o proprietário validar a família visual e a taxonomia. O Arquiteto decide integração em branch funcional e QA sem riscos.
