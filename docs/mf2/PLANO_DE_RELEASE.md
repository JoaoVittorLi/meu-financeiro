# Plano de integração e release — Primeiro EXE Windows completo

**Decisão atual:** o primeiro EXE deve incluir D01–D05, IA I2-A/B/C/D/E, D05 14×61 e 67 SVG, além de execução pessoal **supervisionada** e testada. **Sem build antecipado da RC antiga.**

## Owners e limites de edição

| Owner | PR/issue | Responsabilidade | Não editar |
|---|---|---|---|
| Executor D05 | [PR #81](https://github.com/JoaoVittorLi/meu-financeiro/pull/81), [issue #74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) | E1/E2/E3, schema, serviço, assets, UI D05, migração/testes | `main`, branch #76, MAIN/preload/IA sem coordenação |
| Designer | [PR #57](https://github.com/JoaoVittorLi/meu-financeiro/pull/57), [#70](https://github.com/JoaoVittorLi/meu-financeiro/issues/70) | Fonte visual **já aprovada** e aceite fiel; bugs dirigidos | Reabrir taxonomia aprovada sem solicitação |
| Executor Inteligência | [#79](https://github.com/JoaoVittorLi/meu-financeiro/pull/79), [#80](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | I2-D/E entregues; correções pontuais se integrador detectar falhas | Refazer I2-A/B/C, iniciar I2-F |
| Integrador | [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | Conectar branches, MAIN/preload, gateway IA pessoal, segurança, matriz e SHA final | Fazer CI, build pago ou merge `main` sem proprietário |
| Proprietário | [#65 QA](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) | Executar/autorizar CircleCI e aceite final | Testar builds antigos como se fossem finais |

## Dependências críticas

```text
PR #76 (D01-D04 + I2-A/B/C) ---------+
PR #79 (I2-D) -> #80 (I2-E Quality) -+--> Integrador #76 --> QA completo --> EXE
PR #57 design D05 aprovado ----------+           ^
PR #81 D05 E1/E2 -> E3 UI real -------+-----------+
                         D05 resolver + escrita pessoal supervisionada
```

### Condições de aceite

- **D05 E1:** migração aditiva/idempotente/rollback; backup e restore; pais e filhos por IDs estáveis; registros legados `subcategoryId=null`; perfis real/demo isolados; 630+ movimentos sintéticos; FKs íntegras.
- **D05 E2:** CRUD e resolução pai/filho, overrides bancários sem alterar origem, splits em centavos, regras e planejamento/orçamentos; API/IPC MAIN autorizada, nenhuma SQL no renderer; revisão de lotes com IDs e `previewVersion`.
- **D05 E3:** renderer Electron completo fiel ao PR #57, 67 SVGs locais, seletor no ícone, ponto azul revisão POSTED, PENDING separado, filtros/bulk/criação manual, dark/light, keyboard/foco/Escape e reduced-motion, screenshots reais 1366×768 e 1920×1080.
- **I2-D/E:** importar 4 módulos de runtime + 2 arquivos de testes, reutilizando I2-A/B/C; `qualityScan/Detail/Draft/Compose` é a via exclusiva de sugestão proativa; não permitir bypass por rotas I2-D antigas; validação account/owner/grant e falhas stale/partial; adapter D05 para `categoryId + subcategoryId`.
- **IA pessoal:** confirmação **por humano no host MAIN** e autorização granular por perfil/fonte/conta/período/ação; prévia fiel; revalidação antes do commit; recibos idempotentes e rollback/recovery real. `IC-READ` não dá direito de escrita. Não usar executor sintético em DB pessoal.
- **Financeiro:** sem perdas; PENDING/POSTED e duplicidades corretos; splits e transfer/ignore não distorcem entradas/saídas; saldo não equivale a diferença de fluxos; orçamento zero; restauro e repetição sem aplicar duas vezes.
- **Disponibilidade:** cada recurso deve estar `CODE_PRESENT`, `UI_CONNECTED`, `TESTED`, com estados de erro honestos; não declarar algo concluído por cópia de módulo ou mock.

## Ordem dos gates CircleCI — usuário executa, após SHA novo e congelado

| Gate | run_preflight | run_windows_qa | run_windows_build | Condição |
|---|---|---|---|---|
| Linux | `true` | `false` | `false` | Nova candidata consolidada após integração |
| Electron Windows QA | `false` | `true` | `false` | Linux PASS no SHA |
| Windows EXE | `false` | `false` | `true` | QA PASS + autorização do proprietário |

**Observação:** workflows Windows podem rodar preflight Linux como dependência; validar definição atual de `.circleci/config.yml`. Devolver URL/ID, SHA efetivo, PASS/FAIL, logs, hashes e capturas. Se corrigir código, **SHA muda e os gates relevantes devem ser repetidos**. Não trocar versões no meio do aceite.

## Não fazer

- Nada de EXE parcial; o primeiro EXE só sai após o escopo aprovado e testes.
- Nenhum merge em `main` por este processo; cada executor usa PR Draft e Integrador reconcilia.
- Nada de migração em dados reais para fazer teste, ativar Pluggy/Cloudflare/LLM ou API paga por suposição.
- Não confundir preview Cloudflare automático com QA Electron, nem V8 mock com SQLite do app.
