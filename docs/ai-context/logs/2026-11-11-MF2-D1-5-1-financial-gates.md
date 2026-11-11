# MF2 — D1.5.1: fechamento financeiro pré-Windows

**Data:** 11/11/2026. **Owner:** Executor 2. **Repo:** `JoaoVittorLi/meu-financeiro`. **PR:** [#36](https://github.com/JoaoVittorLi/meu-financeiro/pull/36) draft. **Branch:** `fix/mf2-d1-5-premium-interactions-20261111`. **Base:** `d513c2be3f9b0cd018aed0b71f46ce8747a6556c`. **Commit funcional:** `1bd18db6d1393825fab04a1623ce3a9c03a849cf`. Este log é anterior ao HEAD documental; reconsultar branch antes de compilar.

## Escopo autorizado e causa
Revisão técnica do Arquiteto (PR #35): P1-01, entrada BRL com `Math.round(x*100)` podia aceitar frações de centavo; P1-02, `isManualLinked` dependia do snapshot do renderer e `save('real')` apagava/reinseria lançamentos e posteriormente `pruneInvalidManualLinks` podia **desvincular silenciosamente**. A D1.5 visual e o remake foram preservados; sem expandir funcionalidades.

## Arquivos alterados

- `src/app.ts`: `parsePositiveBRLInput` com formato BRL explícito, centavos inteiros e limite DB 100.000.000.000; `saveEntry` + `saveManualDetail` usam função sem `Math.round` de entrada. Mensagem exibe exemplo, recusa casas extras, expoentes, agrupamento confuso, zero/negativo/overflow. `parseMoney` permanece para importações legadas e os outros fluxos existentes.
- `electron/db.cjs`: `assertLinkedManualChangesAllowed(incoming)` consulta `bank_manual_links` e transações financeiras locais reais, dentro de `BEGIN IMMEDIATE`. Antes do primeiro `DELETE`, bloqueia ausência de lançamento vinculado e mudança do triplo (amount, date, kind). Lança erro claro; o `catch` de `save` invoca `ROLLBACK`, protegendo todas as tabelas e links. Não alterou DDL, contas Pluggy, `pruneInvalidManualLinks`, restoreBackup nem migração.
- `tests/d1-5-1-money-input.test.cjs`: 5 contratos funcionais de formato BRL, valores limites, rejeições, uso em ambos os editores e compatibilidade com CSV/budget.
- `tests/d1-5-1-sqlite-links.test.cjs`: 10 testes da **classe FinanceDB real com SQLite** para vínculo existente sem snapshot bancário no renderer, exclusão, valor/data/tipo, descrição/categoria, reinstância, isolamento real/demo, unlink explícito, backup SQLite e import JSON destrutiva. Testes criados no repo; ainda pendem execução em Node oficial e checkout.
- `tests/d1-5-manual-edit.test.cjs`: ajuste de transpile em harness V8 para assinatura tipada do helper novo.

## Evidências desta sessão (não confundir)

- **11 vetores BRL** na implementação candidata rodados no motor V8 em isolamento (formatos aceitos/rejeitados).
- **18/18 PASS** na execução de callbacks exatos da nova suíte BRL + suíte manual D1.5 preexistente, em V8 com mocks dos módulos Core Node e leitura de `src/app.ts` do blob proposto. **NÃO É o `node --test` oficial**.
- **6/6 PASS** com o **Node v22.16.0 e `node:sqlite` NATIVO**, em script de reprodução isolado que usa a mesma consulta SQL e a mesma política da guarda proposta e transações `BEGIN IMMEDIATE/ROLLBACK`. Cenários: bloqueio de excluir, valor, data, tipo; permissão de descrição/categoria; unlink explícito. **NÃO É a classe `FinanceDB` integral**. Os novos 10 testes específicos da classe de produção não foram executados.
- **Sintaxe JS V8 PASS** para `electron/db.cjs` e os dois novos arquivos de teste. Parser com vetores observados, sem usar dados reais.
- **NÃO EXECUTADOS NESTE SHA:** `npm ci`, `npm run test:types`, `npm run test:db`, `npm run compile`, `node scripts/renderer-provenance.cjs check-bundle`, `npm run test:asar`, Electron com perfil temporário, Windows GUI, capturas hover/temas, persistência via UI/restart, NSIS/Portable ou SHA256. Faltam checkout privado e toolchain pin: terminal tem Node 22.16.0/npm 10.9.2, projeto exige Node 22.23.4/npm 10.9.9. DNS github.com indisponível no terminal.

## Riscos, sem desviar do escopo
1. O `save('real')` genérico agora retorna erro caso um backup JSON tente retirar/alterar lançamento concíliado; a ação correta exige **desvincular explicitamente**. Backup SQLite integral + restauração autorizada usam rota independente, preservada.
2. `pruneInvalidManualLinks` continua reagindo a atualizações legítimas do extrato bancário, como já fazia; esta missão não alterou esse processo.
3. O renderer pode exibir botão Excluir se o snapshot estiver desatualizado, mas o backend impede a gravação e apresenta erro; risco de UX não bloqueia integridade, mas deve ser conferido no Windows.
4. Build e imagem não foram vistos nesta sessão. Não inferir homologação do PR pai. Sem release, deploy Cloudflare, main ou dados pessoais alterados.

## Próxima entrega e gate
A revisão de código está no PR #36, mas a D1.5.1 **AINDA NÃO É ENTREGA BINÁRIA**. Executar **uma** pipeline CircleCI `windows_on_demand` no HEAD mais recente da branch, parâmetros `run_preflight=false`, `run_windows_build=true`. Config e Checkout Branch iguais `fix/mf2-d1-5-premium-interactions-20261111`. No Linux `npm ci` + TS/SQLite (incluindo novos 10 testes)/compile/F08/ASAR; no Windows smoke Electron real, matriz 32 imagens, manual persistente em perfil fictício, erros e backup/restauração, NSIS+Portable e SHA256. Validar sha, versão, tamanhos, links diretos e hashes. Qualquer erro novo deve ser corrigido especificamente antes de nova execução. Propriedade: nenhuma inclusão de marca MF, IA, A-D7, emojis migrados ou PWA nesta missão.
