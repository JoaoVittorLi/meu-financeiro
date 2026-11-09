# Registro de lacunas, bloqueios e gates

**Status inicial apurado em 09/11/2026; atualizar após cada marco.** Cada item associa problema, entrega e evidência de saída.

| ID | Lacuna | Marco | Evidência para encerrar |
| --- | --- | --- | --- |
| C01 | main 0.9.4 e desenvolvimento distribuído em 16 PRs draft | MF2-00 | Plano de integração + baseline identificado, sem perda |
| C02 | EXE U3 não testado no Windows | MF2-00 | CircleCI SHA exato, 2 EXEs+SHA256, smoke instalado |
| C03 | U1–U3 desktop ≠ PWA | MF2-03 | E2E de paridade das jornadas e dados |
| C04 | SQLite e Cloudflare sem cutover homologado | MF2-01 | Comparadores completos, restore, permissão de cutover |
| C05 | Regras financeiras só parcialmente compartilhadas | MF2-02 | Golden tests Windows/PWA e fontes únicas |
| C06 | IA demo, sem operações financeiras reais autorizadas | MF2-09 | Ferramentas auditadas e fluxo de confirmação |
| C07 | Limites orçamentários atuais não são envelope/rollover | MF2-07 | Persistência e testes de alocação/rollover |
| C08 | Projeções sem modelo completo de saldo seguro | MF2-06 | Previsão determinística com cobertura visível |
| C09 | PRs encadeados, conflitos possíveis com Work paralelo | MF2-00 | Inventário e decisão por PR, single-writer |
| C10 | Release Windows/PWA coordenada não homologada | MF2-10 | Mesmo contrato/SHA, teste de atualização/rollback |
| C11 | CI depende de instalações sem lockfile no runner | MF2-00 | Estratégia de dependências/reprodutibilidade revisada |
| C12 | Design premium ainda não unificado com personalização | MF2-04 | Layouts responsivos e configurações persistidas |
| C13 | Diferenciais: classificação, recorrências, anomalias | MF2-05 | Regras e provas de não sobrescrita |
| C14 | Metas/dívidas e carteira patrimonial completas | MF2-07/08 | Modelos, testes e relatórios conciliados |
| C15 | Work ativo pode conter código não publicado | MF2-00 | Checkpoint de branch/sha/uncommitted e ownership |

## Significado de gate

- **G0** baseline, preflight+Windows build e smoke, gestão de PRs.
- **G1** conciliação cloud, controle de conflito, backup/restore e autorização.
- **G2** motor financeiro compartilhado e golden tests.
- **G3** paridade funcional/visual Windows-PWA (U4).
- **G4** dashboard modular premium, sem cálculo fictício.
- **G5** classificação/regras/recorrências íntegras.
- **G6** previsão/caixa/saldo seguro e laboratório testados.
- **G7** orçamentos, metas e dívidas rastreáveis.
- **G8** patrimônio, investimentos básicos e relatórios.
- **G9** IA operacional com consentimento e auditoria.
- **G10** release final seguro e coordenado.

**Estado de todos os gates:** não homologados neste processo de documentação. A existência de implementação parcial não destrava gates financeiros.

## Evidência mínima para aprovar item

Identidade da revisão; comando e ambiente; resultado e link; teste integrado quando relevante; screenshot real ou limitação explicada; implicação para dados; eventual rollback; aprovação do integrador. Se algum requisito crítico não for observável, registrar **NÃO HOMOLOGADO**, nunca assumir sucesso.
