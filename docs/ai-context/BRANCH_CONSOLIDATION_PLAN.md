# MF2-00 — Plano seguro de consolidação de branches

**Verificação via GitHub:** 09/11/2026 • **Status:** PREPARADO, não homologado nem mesclado na main.  
**Documento de análise operacional:** este plano não autoriza merges em cadeia nem cutover financeiro.  
**Candidata preparada:** \`integration/mf2-baseline-candidate-20261109\`, nascida do PR #17, SHA \`b3a53eaef9544cf8a86dee01d3565d8414c476d3\`.  
**Revisões-base:** \`main\` e0d5131 (v0.9.4); PR #16 \`design/despezzas-d1-d4\` c535cb0; PR #17 documentação e Rodada A b3a53ea.

## 1. Achado principal

O projeto não tem 17 implementações independentes esperando merge. Há uma **linhagem principal encadeada** e algumas frentes antigas **divergentes**. A documentação PR #17 é descendente direta de \`design/despezzas-d1-d4\` (#16). O código U1–U3, cloud/IA já incorporados à linhagem e a documentação da Rodada A podem ser usados como **uma única base candidata sem mesclar todos os PRs individualmente**.

### Gráfico simplificado (ancestralidade comprovada)

\`\`\`text
main v0.9.4
   ├─ safety/cloud-migration-preflight (#1)
   │     └─ integration/v0.9.5-beta.1-inteligencia-circleci (#6)
   │          └─ feat/inteligencia-e3 (#7)
   │               └─ feat/inteligencia-e4 (#8)
   │                    └─ fixes UI/redesign (#9→#15)
   │                         └─ design/despezzas-d1-d4 (#16)
   │                              └─ docs/mf2-multi-agent-context (#17)
   │                                   └─ integration/mf2-baseline-candidate (candidata, sem merge)
   │
   ├─ feat/inteligencia-interface-e1 (#2) — divergente
   ├─ ci/circleci-windows-manual (#4) — divergente
   └─ outras branches E2/CI (#3/#5) — divergentes da candidata
\`\`\`

**Atenção:** "divergente" significa diferença de **histórico Git**, não significa necessariamente que o comportamento da branch esteja faltando na candidata. A PR #6 trouxe integrações e pode conter código equivalente com commits diferentes.

## 2. Comparações de ancestralidade já verificadas

Comparado cada branch como \`base\` com \`head=docs/mf2-multi-agent-context-20261109\` (SHA b3a53ea):

| Branch-base | Status do compare | Conclusão |
| --- | --- | --- |
| main | ahead, behind=0 | Linha candidata contém main como ancestral |
| safety/cloud-migration-preflight-20261107 (#1) | ahead, behind=0 | Já está na ancestralidade |
| integration/v0.9.5-beta.1-inteligencia-circleci (#6) | ahead, behind=0 | Já está na ancestralidade |
| fix/asar-windows-nested-paths (#15) | ahead, behind=0 | Já está na ancestralidade |
| design/despezzas-d1-d4 (#16) | ahead, behind=0 | Já está na ancestralidade |
| docs/mf2-market-benchmark-deep-dive-20261109 | ahead, behind=0 | Branch auxiliar de análise antiga; não utilizar como base canônica |
| feat/inteligencia-interface-e1 (#2) | diverged | Verificar equivalência antes de encerrar |
| feat/inteligencia-e2-chatgpt-shared (#3) | diverged | Verificar equivalência antes de encerrar |
| ci/circleci-windows-manual (#4) | diverged | Verificar equivalência antes de encerrar |
| ci/circleci-inteligencia-e1-e2 (#5) | diverged | Verificar equivalência antes de encerrar |

**Não** executar merge #2/#3/#4/#5 só porque são divergentes. Primeiro comparar conteúdo/contratos com o código da candidata. Por exemplo:
- #2: rota/UX Inteligência e teste \`tests/ai-ui.test.cjs\`; código equivalente pode ter sido integrado manualmente.
- #3/#5: OAuth/PKCE, Electron AI, shared/ai-policy e CI; verificar versões, configurações e testes sem retroceder proteção ou qualidade.
- #4: \`.circleci/config.yml\` e \`build-windows.ps1\`; comparar scripts e workflow atual; nunca substituir pipeline posterior por versão antiga.
- #1/#6–#16: já ancestrais; **não** cherry-pick novamente.

## 3. O que foi feito neste checkpoint

- Foi criada **uma branch candidata não destrutiva**, a partir do HEAD publicado do PR #17, para servir de base de consolidação após a análise. Nenhum dos PRs existentes foi fechado/mesclado e a main não foi alterada.
- Esta branch deve permanecer **CANDIDATA, não VALIDADA** até terminar MF2-00 (CI, smoke, integridade e exame de paridade). Código e documentação estão na mesma linhagem.
- A branch auxiliar \`docs/mf2-market-benchmark-deep-dive-20261109\` foi criada anteriormente para não conflitar com Work; ainda não contém implementação de produto; **não é frente de execução** e deverá ser arquivada/encerrada somente após confirmação de conteúdo equivalente.
- Preservar branches históricas durante a auditoria, para recuperação e proveniência.

## 4. Próximos passos obrigatórios antes de consolidar de verdade

### C0 — Congelar inventário, não a produção
Rechecar GitHub e Work local: SHA, \`git status\`, branches e arquivos locais não publicados; pedir checkpoint. Se houver mudanças úteis fora da candidata, **salvá-las primeiro** em branch própria e log.

### C1 — Comparação de equivalência
Montar matriz das branches divergentes (#2/#3/#4/#5), arquivo/funcionalidade/teste, estado em candidata, risco de trazer código antigo, decisão: **PRESENTE / FALTA / SUBSTITUÍDO / EM CONFLITO / NÃO VERIFICADO**. Zero merges cegos.

### C2 — Testar candidata
Reexecutar preflight Linux, TypeScript/SQLite/Node, testes PWA e ASAR no SHA exato da candidata; CircleCI Windows NSIS+portable+SHA256; smoke Windows isolado com dados sintéticos. Se a documentação extra não modifica o runtime, ainda é preciso testar o SHA candidato, não herdar sucesso do PR #15.

### C3 — Escolher baseline integrada
Após C0–C2, o Chat arquiteto revisa e o usuário aprova a promoção. Recomendações:
- Manter branch de integração exclusiva para reunir código/testes/docs e iniciar MF2-01.
- Não mudar o histórico da main até haver baseline comprovada.
- Se o PR #17 ainda estiver draft, não o "mesclar por conveniência"; só fazê-lo quando não houver trabalho ativo na branch e houver revisão.
- Atualizar bases/descrições de PRs ou encerrar PRs históricos como **superseded**, preservando links, **depois** de confirmar funcionalidade equivalente e registrar decisão.
- Não apagar branches com código potencialmente único.

### C4 — Declaração de baseline
Registrar em CURRENT_STATE por integrador: commit, testes executados, CI e artifact/instalação, frontends, riscos, rollback e versão. **Só então** marcar G0 homologado e permitir MF2-01 conforme dependências.

## 5. Critérios para dizer que as branches estão unificadas

- Uma branch de integração identificada, com código funcional, documentação e testes reproduzíveis.
- Nenhuma função única das branches divergentes perdida.
- Histórico de PRs preservado e não duplicado.
- Arquivos de CI/IA/Cloudflare coerentes com o código e sem regressão.
- Instalação Windows e PWA testados segundo seus gates.
- Docs e roadmap atualizados com evidência, não com afirmação genérica.
- Nenhum merge na main, cutover, deploy ou operação financeira ocorrerá automaticamente pela consolidação.

**Decisão atual:** consolidar em candidata é válido; **merge/promover/fechar PRs ainda é pendente de inspeção e autorização após MF2-00**.
