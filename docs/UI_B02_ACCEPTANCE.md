# Meu Financeiro — B02: categoria editável na tabela de movimentações

**Candidata:** Windows `0.9.5-beta.4`.
**Base exata:** B00/B01, branch `fix/category-overlay-b00-b01`, commit `b421f4fe76452a00f118214f5ca0c390c4f0677b`.
**Branch:** `feat/transaction-category-edit-b02`, PR empilhado sobre B00/B01, não sobre `main`.

## Escopo funcional

- A categoria de cada linha em **Movimentações** e **A revisar** deixa de ser um `span` passivo e passa a ser um botão nativo com rótulo acessível (descrição, data, conta e valor).
- Ao clicar ou pressionar Enter/Espaço, abre o **drawer de detalhes da transação correta**, com o foco diretamente no seletor de categoria principal (banco) ou categoria do lançamento (manual).
- Fechar o drawer devolve o foco à categoria da linha, seguindo o mecanismo já existente de retorno de foco.
- A gravação continua pelo **mesmo serviço existente**, usando `accountId + externalId` no banco e `id` nos lançamentos manuais. Clicar na categoria **não grava nada** e não altera seleção em lote.
- Uma compra dividida mantém sua seção de split no drawer. O botão da categoria abre o campo **principal**; a edição de partes continua separada, com necessidade de salvar a divisão.
- Indicador visual discreto de edição e foco de teclado. Não há nova dependência, editor paralelo de banco ou mudança de taxonomia.

## Proteções e compatibilidade

- Sem alteração de SQLite, dados pessoais, segredos, Pluggy, políticas do motor, Worker/PWA, Cloudflare, flags ou `main`.
- `package.json` e os três rótulos de versão no `src/app.ts` foram atualizados para `0.9.5-beta.4` para identificar o **próximo** EXE, não a compilação B00/B01 que já está em andamento.
- A PWA não recebe nova UI neste ticket; a equivalência de edição móvel permanece no roadmap específico da PWA.
- Este PR depende de B00/B01; se B00/B01 mudar, revalidar a base e os testes antes de compilar.

## Aceite automatizado planejado

`tests/transaction-category-edit.test.cjs` avalia:
1. botão semântico e nome acessível;
2. transações de contas distintas com **mesmo** `externalId`/descrição não trocam de identidade;
3. lançamento manual usa o fluxo próprio;
4. foco no seletor e retorno à célula após fechar;
5. handlers bancário/manual preservados, split e seleção em lote independentes;
6. versão Windows beta.4 e cadeia de proveniência B00 mantidas.

Executar `npm run test:types` e `npm run test:db`, além do preflight completo Linux/PWA existente. **Nenhum resultado de teste é alegado até executar os comandos.**

## Homologação Windows após a próxima compilação manual CircleCI

- Acionar branch `feat/transaction-category-edit-b02` com `run_windows_build=true` **somente quando o usuário decidir**.
- `preflight_linux` deve estar verde **antes** de `build_windows`; falhas bloqueiam artifacts.
- Verificar EXE instalador + EXE portátil + `SHA256.txt`, com mesma versão e commit, e `verify-asar` aprovado.
- Testar com perfil SQLite descartável: clique e Enter/Espaço na categoria, Esc fecha apenas popup antes do drawer, foco retorna à célula, zero persistência ao apenas abrir, persistência correta após escolher, duas contas com IDs iguais, lançamento manual, split, filtros e checkbox de lote.
- Testar estado vazio, 1366×768 e zoom 150/200%, falha simulada de persistência sem falso sucesso.
- Antes de instalar em perfil pessoal, conferir backup do SQLite. Portable **não é isolado** por padrão.
- Só considerar homologado após evidência do EXE no Windows; não publicar Release, não mesclar `main` nem alterar cloud automaticamente.

**Status deste documento:** plano e implementação de fonte da B02, aguardando testes e próxima compilação. 
