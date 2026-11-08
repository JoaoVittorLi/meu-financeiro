# Entrega 3 — Memória, contexto econômico e consumo de tokens

**Branch de desenvolvimento:** `feat/inteligencia-e3-contexto-memoria-uso`
**Base unificada:** `integration/v0.9.5-beta.1-inteligencia-circleci` (commit `c8476c39`).
**Nova versão desktop:** **0.9.5-beta.2**.
**Estado:** código implementado, verificação estática parcial; **build e homologação CircleCI pendentes**.

## O que foi implementado

1. **Motor único de contexto**, em `shared/ai-context.mjs`, importado pela aplicação Electron e pelo Worker do PWA. Recebe exclusivamente casos fictícios predefinidos; não consulta SQLite, Pluggy, contas nem extratos. Respeita limites de caracteres e rejeita consentimento inválido.
2. **Memórias manuais aprovadas**, em `electron/ai-personal.cjs`, protegidas por `safeStorage` no Windows, vinculadas ao identificador de conta ChatGPT e gravadas fora do diretório do projeto. Aceitam preferência, objetivo e restrição; máximo de 12 locais e 8 por análise, cada uma até 180 caracteres. O usuário pode adicionar, excluir ou limpar todas. Textos que aparentam conter senhas, tokens e sequências de números sensíveis são rejeitados.
3. **Consentimento explícito por teste**: enviar memórias está **desativado por padrão**. Se marcado, as memórias aprovadas entram como contexto de usuário, sempre rotuladas como notas e sem substituir instruções permanentes. O teste continua usando somente dados financeiros fictícios. Um botão mostra exatamente a pergunta fictícia e as memórias que seriam encaminhadas antes de qualquer chamada.
4. **Registro local de uso**, sem salvar o conteúdo das respostas ou prompts no arquivo de métricas: mantém até 60 respostas concluídas, com tokens de entrada, saída e raciocínio informados pela resposta. Não representa a franquia disponível do ChatGPT nem garante economia/cobrança proporcional. Se a gravação falhar, a resposta permanece válida e a interface informa que o histórico não foi salvo.
5. **Formatador Markdown seguro** de negrito, listas e tabelas no desktop, sem `innerHTML`, HTML remoto ou URLs executáveis.
6. **PWA (Preview protegido)** usa o mesmo contrato e fornece a prévia da pergunta fictícia por `GET /api/ai/demo-preview?caseId=...`. Essa rota exige sessão da aplicação e Cloudflare Access, calcula localmente no Worker e **não chama o GPT**. Nenhuma memória ou token OAuth do desktop é transferido.
7. Mantém a política GPT-6.1 Sol, apenas Low e Medium, `store:false`, `stream:true`, no máximo três testes de inferência por sessão, zero retries automáticos e nenhum fallback pago.

## O que continua bloqueado

- **Dados bancários reais não são enviados ao modelo**. O app não cria ferramentas de leitura de finanças para a IA nesta etapa.
- Memórias **não sincronizam** entre Windows e PWA; a identidade única cloud ainda precisa ser homologada antes de qualquer persistência remota.
- O campo de pergunta livre continua sendo **rascunho, não enviado**. Somente os três cenários fictícios são executáveis no GPT nesta entrega.
- A interface não aceita sugestões da IA que alterem despesas, saldos, orçamentos ou transações.
- Nenhuma migração de SQLite local ou deploy Cloudflare Production foi executado.
- Nenhum workflow GitHub Actions foi acionado.

## Privacidade e identidade

As memórias são gravadas em `chatgpt-personal.enc` sob `app.getPath('userData')`, fora do repositório, usando o serviço seguro do Electron/Windows. Estão separadas de `chatgpt-session.enc`. Uma conta ChatGPT diferente não lê nem substitui silenciosamente memórias da conta anterior. A opção de excluir memórias remove o conteúdo aprovado; o histórico de métricas não armazena mensagens nem credenciais.

**Aviso:** memórias aprovadas podem conter dados pessoais fornecidos manualmente. Não coloque valores de conta, documentos, senhas ou segredos nesse recurso. Quando usar memórias, confirme o que aparece em **Ver contexto antes de enviar**.

## Arquivos alterados ou adicionados

- `shared/ai-context.mjs`, `shared/ai-policy.mjs`
- `electron/ai-personal.cjs`, `electron/ai-client.cjs`, `electron/main.cjs`, `electron/preload.cjs`
- `src/ai-markdown.ts`, `src/app.ts`, `src/intelligence-view.ts`, `src/intelligence-integration.ts`, `tsconfig.json`
- `app/intelligence.css`, `package.json`
- `mobile-push/src/worker.js`, `mobile-push/public/finance-ai.js`, `mobile-push/public/finance.css`
- `tests/ai-e3.test.cjs`, `tests/ai-ui.test.cjs`, `mobile-push/test/ai-policy.test.js`

## Testes e validação

Os testes E3 usam **apenas mocks locais**, sem `fetch` real ou credenciais. Cobrem consentimento, cofre criptografado, isolamento de contas, recusa de segredos, limites, contexto sem acesso bancário, registro de tokens, três casos de demonstração e PWA sem execução remota.

Para validar o Windows via CircleCI:
1. Abrir o projeto `JoaoVittorLi/meu-financeiro` no CircleCI.
2. Em **Trigger Pipeline**, selecionar **`feat/inteligencia-e3-contexto-memoria-uso`** (a branch já possui `.circleci/config.yml`).
3. Adicionar `run_windows_build` com tipo **Boolean** e valor **true**.
4. Quando `build_windows` passar, abrir **Artifacts → MeuFinanceiro-Windows** e baixar:
   - `MeuFinanceiro-Instalador-0.9.5-beta.2-x64.exe`
   - `MeuFinanceiro-Portable-0.9.5-beta.2-x64.exe`
   - `SHA256.txt`.
5. Fazer backup do banco SQLite antes da instalação. Validar que as seis telas, auditoria E1, dados locais e Inteligência continuam preservados.
6. Em Inteligência, verificar que o teste fictício funciona **sem memórias** por padrão. Adicionar uma memória inofensiva de preferência, clicar **Ver contexto antes de enviar** e, apenas se desejar, marcar a opção para incluir a memória no teste. Verificar métricas locais após a resposta.
7. No PWA protegido, verificar que a seção Inteligência consegue visualizar contexto fictício, mas não solicita credenciais e não tenta executar GPT.

O CircleCI executa `npm run test:types` e `npm run dist:windows`. Os testes de Worker/PWA devem ser executados também antes de qualquer deploy de Preview, sem tocar Production.

**Critério de conclusão:** build CircleCI aprovado, exatamente dois EXEs + SHA256 em Artifacts, instalação Windows validada pelo usuário e testes E3 aprovados. Até lá, **a entrega é candidata, não uma versão homologada**.

## Continuidade

Entrega 4: fontes financeiras somente leitura após autorização cloud; motor de agregações por período/categoria com IDs/valores conciliados, evidências e revisão; memórias cloud somente após login compartilhado verificado e política explícita de exclusão. Nunca inferir saldo ou despesas de dados incompletos.
