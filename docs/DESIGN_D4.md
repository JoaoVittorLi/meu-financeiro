# D4 — Inteligência e alinhamento da PWA

Código de revisão sobre os lotes D1/D2/D3. Branch de revisão prevista: `design/despezzas-d1-d4`, baseada em `fix/asar-windows-nested-paths` no commit `44fb1b04828dded9ba5e7944e7650f23a99bfa0d`. Não é uma versão instalada ou um deployment.

## Resultado

- Inteligência e painel contextual receberam a mesma linguagem neutra das telas financeiras, nos dois temas.
- Rascunho pode ser escrito no painel, fechado/reaberto e levado para Conversar. Continua local e não enviado. O fluxo de testes fictícios existente permanece no Laboratório, com seus controles e consentimentos.
- O painel captura página, período e descrição dos filtros ao abrir, antes de fechar detalhes. Planejamento usa seu mês, Orçamentos usa o mês do orçamento, revisão identifica todos os períodos e Configurações não recebe um período bancário arbitrário.
- A descrição local de contexto não inclui transações, credenciais ou saldos. Não é um contrato de envio financeiro: inferência com dados reais continua fora desta entrega.
- Hoje/Conversar/Plano de ação receberam relações acessíveis entre abas/painéis e navegação por setas, Home e End.
- PWA ganhou Configurações com aparência por dispositivo e orientações sobre recuperação/notificações, conforme suas capacidades atuais. Não oferece backup SQLite fictício.
- Painel flutuante da PWA agora prepara rascunho local na tela Inteligência, preservando texto e página de origem. Não usa armazenamento persistente para o rascunho nem acrescenta endpoint de inferência.

## Verificações

- TypeScript 5.8.3: checagem de tipos e compilação concluídas sem erros usando a cópia oficial já disponível na auditoria complementar. O renderer gerado desta revisão usa essa versão declarada no projeto, substituindo a emissão local anterior com TS 6.
- 68 testes desktop focados aprovados; não representam aprovação da suíte desktop completa ou do instalador.
- 129 testes da Worker/PWA aprovados.
- Inteligência: três abas × dois temas × três larguras (1366/390/320), com teste de teclado, preservação do rascunho, contexto e abertura/fechamento do painel.
- PWA: oito áreas × dois temas × três larguras, sem erros JavaScript ou overflow horizontal da página. Assets são reais, mas endpoints foram interceptados por uma fixture de acesso expirado (401); isso verifica também a navegação sem sessão válida, não dados autenticados.
- Nessa fixture, abrir o painel não fez novas requisições; preparar rascunho não fez POST nem envio de inferência. Dados financeiros ou credenciais pessoais não foram usados.
- Cópias do CSS e do comportamento de aparência seguem compartilhadas por Windows/PWA. Sintaxe dos scripts e `git diff --check` aprovados.

Evidências locais: `../audit-review-temp/design-d4-tests.log`, `design-pwa-unit-tests.log`, `check-d4-fixtures.cjs`, `check-pwa-design.cjs`, `design-d4-browser-results.json` e `design-pwa-browser-results.json`. Testes permanentes novos: `tests/design-d4.test.cjs`.

## Empacotamento e pendências reais

Este ambiente não tem Electron, electron-builder ou @electron/asar instalados, e a instalação de dependências da rede está restrita. Por isso não foi gerado EXE nem executado o teste físico de ASAR nesta etapa. Os gates existentes foram preservados.

A revisão deve passar pela pipeline declarada no CircleCI com `run_windows_build=true`, incluindo seu preflight obrigatório, testes de ASAR e build Windows. Nenhum novo workflow, marcador de cobrança ou parâmetro foi alterado para contornar esses gates. Confirmar sucesso e artefatos do SHA exato antes de disponibilizar instalador. O pacote precisa ainda de smoke no Electron e verificação da instalação.

Ainda faltam: PWA autenticada com dados reais, equivalência de conteúdo entre todas as áreas, navegação móvel definitiva, zoom/leitores de tela e homologação empacotada. Não houve cutover, alteração de autenticação, mudança financeira de SQLite ou nova inferência real.
