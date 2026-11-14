# Meu Financeiro 2.0 — estado atual (fonte de referência)

> **Atualizado em 14/11/2026 após o Gate 1 de integração.** Este é o painel documental do PR #82 (Draft), **sem merge na main**. Antes de iniciar testes, confira o HEAD vivo do [PR #76](https://github.com/JoaoVittorLi/meu-financeiro/pull/76).  
> **Decisão do proprietário:** somente um EXE experimental completo, após D01–D05, I2-A/B/C/D/E, testes oficiais e autorização explícita. **CircleCI, QA Windows e build somente pelo proprietário**.

## Candidata de código integrada

**PR único:** [#76 — RC-ALL-FULL](https://github.com/JoaoVittorLi/meu-financeiro/pull/76), branch `integration/mf2-rc-all-01-i2a-20261113`.

**HEAD de integração publicado:** `25621fb002cc95c212cd12ff48996f92ba8483a7`. É um SHA fixo: revalidar antes do preflight.

**Estado comprovado:** `D01-D05+I2-A/B/C/D/E CODE_INTEGRATED` / `UI_PARTIALLY_FUNCTIONAL` / `LINUX_NOT_RUN` / `PERSONAL_AI_WRITES_DISABLED` / `WINDOWS_NOT_RUN` / `NO_GO_EXE`.

## Matriz de frentes e evidências

| Entrega | Fonte e estado no PR #76 | TESTED no HEAD | Observação de disponibilidade |
|---|---|---|---|
| D01–D04 + 26 renderers | Cadeia #54→#60→#63→#68→#73 mantida no #76 | NOT_RUN | UI pré-existente preservada |
| I2-A / IC2-READ-QUERY | Backend/IPC/chat no #76 | NOT_RUN | Somente leitura, grants e perfil |
| I2-B/I2-C | #75/#78 importados no #76 | NOT_RUN | Categorias e laboratório sintético; nenhuma escrita financeira pessoal pela IA |
| D05 E1/E2/E3 | #81 HEAD `316a818fcdd6a6227e3d00352de0822d1c3d5017`, 19 arquivos incorporados via ancestry exata | NOT_RUN | SQLite v7, 14 pais, 61 filhos, 67 SVG, React16, MAIN/preload/UI |
| I2-D | #79 HEAD `fd5aca036ae96ca3aef99be752a2bfdeb9750688` | NOT_RUN | Módulos exclusivos importados, via gateway de qualidade E |
| I2-E | #80 HEAD `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1` | NOT_RUN | Quality Gate obrigatório, conta MAIN, evidência/seleção D05 por IDs na Central de Revisão |
| Escrita pessoal supervisionada separada de I2-C | `electron/d05-personal-gate.cjs` e IPC nomeado no #76 | NOT_RUN | Backend com preview/nonce/backup/COMMIT/recibo/recovery; **flag MAIN `approvedForPersonal:()=>false`**, sem liberação real |
| CSV D05 | `src/d05-csv.ts` e `src/app.ts` integrados | NOT_RUN | Prévia completa, SHA256, duplicatas, proteção de fórmula e backup manual obrigatório |
| QA oficial Linux + Windows | [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) | NOT_RUN | Nenhuma prova oficial de compilação no SHA atual; screenshots reais indisponíveis |
| Primeiro EXE Windows | [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) | NO-GO | Nenhum instalador autorizado, gerado ou homologado |

**Matriz técnica por funcionalidade:** [RC_ALL_FULL_GATE1_MATRIX_20261114.md](https://github.com/JoaoVittorLi/meu-financeiro/blob/integration/mf2-rc-all-01-i2a-20261113/docs/ai-context/RC_ALL_FULL_GATE1_MATRIX_20261114.md).

## Bloqueios até GO

1. **Préflight Linux no HEAD da RC ainda não executado.** `test:types`, `test:db`, `compile`, proveniência/F08 e ASAR precisam PASS em Node oficial, inclusive 21 testes D05, 48 I2-D/E e regressões completas. Há **105 arquivos** de testes Node versionados no GitHub, mas versão não significa PASS.
2. **QA Electron Windows real** 1366×768 e 1920×1080 em claro/escuro e screenshots autênticos NOT_RUN; verificar 67 SVGs, seletor, indicadores, POSTED/PENDING, persistência, filtros e lote.
3. **Escritas pessoais reais/bancárias por IA desligadas até homologação e nova autorização.** A D05 individual e o lote exibem prévias, mas commits em dados reais não devem ser anunciados como disponíveis. O backend de supervisão não deve ser confundido com autorização do proprietário.
4. **Nem todos os controles de regras, splits e planejamento D05 são formulários independentes na E3.** Serviços SQLite/IPC existem; a UI precisa homologação dirigida para declarar paridade.
5. **CSV necessita QA de importação/restore e segurança** (inclui backup manual; não há recibo atômico próprio da importação CSV).
6. **Banco experimental** isolado do Windows instalado (`MeuFinanceiro-RC-ALL-01-Experimental`, appId próprio), offline em packaged; sem importação bancária automática, nenhum deploy/LLM pago.
7. Issue [#74](https://github.com/JoaoVittorLi/meu-financeiro/issues/74) continua **OPEN/BLOQUEANTE** até QA. PR #81 é fonte de código; **não iniciar novas features**.

## SHAs de fontes confirmados em 14/11/2026

| PR | SHA |
|---|---|
| [#76 integração final](https://github.com/JoaoVittorLi/meu-financeiro/pull/76) | `25621fb002cc95c212cd12ff48996f92ba8483a7` |
| [#81 D05](https://github.com/JoaoVittorLi/meu-financeiro/pull/81) | `316a818fcdd6a6227e3d00352de0822d1c3d5017` |
| [#79 I2-D](https://github.com/JoaoVittorLi/meu-financeiro/pull/79) | `fd5aca036ae96ca3aef99be752a2bfdeb9750688` |
| [#80 I2-E](https://github.com/JoaoVittorLi/meu-financeiro/pull/80) | `c56675d02f6d1b5ac9074fb9039aad3d74ff81e1` |
| [#57 Design D05](https://github.com/JoaoVittorLi/meu-financeiro/pull/57) | `f93497a86a50470ed3e86bd4c3e3250b2396ab5a` |

## Próximo passo e proprietários dos gates

**Ação única imediata do proprietário:** CircleCI branch `integration/mf2-rc-all-01-i2a-20261113` e SHA do PR #76 acima:

```yaml
run_preflight: true
run_windows_qa: false
run_windows_build: false
```

Devolver URL+ID da pipeline, SHA real `CIRCLE_SHA1`, PASS/FAIL por etapa e primeira falha completa. Em caso de FAIL, corrigir apenas regressões concretas no mesmo #76 e publicar outro SHA, sem novas features. QA Windows somente após Linux PASS e nova autorização. Build NSIS/Portable somente após QA/GO e outra autorização explícita.

**Coordenação de código:** [#49](https://github.com/JoaoVittorLi/meu-financeiro/issues/49) · **QA:** [#65](https://github.com/JoaoVittorLi/meu-financeiro/issues/65) · **Release:** [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71) · **Documentos e trilha:** [PR #82](https://github.com/JoaoVittorLi/meu-financeiro/pull/82).

> **Não confundir:** parser V8 e comparação GitHub PASS não representam Node, SQLite, TypeScript, Electron ou EXE PASS. Sem merge main, CI autônomo, produção, importação pessoal ou API paga.
