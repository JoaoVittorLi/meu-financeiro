# Refinamento visual e navegação — Computer Use, 12/11/2026

Branch `fix/mf2-review-layout-navigation-20261112`, base PR #46 / `a7f132aa7b522279a6f71c46ae33bfdfb702aec9`. PR empilhado para separar UX da escrita supervisionada. HEAD final é o da branch/PR deste log. Instalação pessoal não foi alterada; nova sessão Electron de desenvolvimento com fixture sintética temporária validada. Dependências imutáveis do lockfile reutilizadas por junction entre checkouts; arquivos de produto e perfis separados.

## Problemas observados, mudanças e verificação real

1. **Formulário de leitura:** antes, checkbox acima do texto, mês com altura nativa reduzida e ações comprimidas. A captura real no tema claro e a referência escura mostraram o desalinhamento. Depois: grid isolado com Fonte/mês de 42px, checkbox ao lado da descrição, intervalo entre campos e ação; variantes de uma coluna para drawer e viewport menor, foco visível e color-scheme nativo claro/escuro. Nenhuma permissão/callback/consulta foi alterada.
2. **Navegação com rolagem herdada:** Orçamentos rolado → Simular Compra escondia o título de destino. A primeira tentativa de correção no elemento `.main-area` passou pelo teste isolado, mas **falhou no Computer Use real**, pois quem rola é o documento. Corrigido para `document.scrollingElement.scrollTo`, após o commit de estado e somente ao mudar de área. Repetido no Electron: origem rolada aproximadamente 600px → Simulador abre com título, descrição e premissas no topo. Abertura da Central também usa esse scroller. O teste passou a representar o contêiner correto. Sem transição de movimento nessa navegação, inclusive em reduced-motion.

Computer Use confirmou a URL de arquivo do **checkout visual**, diferente da instalação pessoal. Electron 45.2.3, janela nativa aproximadamente 1486×933. Capturas reais de antes/depois e dos temas claro/escuro foram exibidas nesta conversa. Sem HTML demonstrativo, imagens geradas, montagem, emulação de viewport, injeção de CSS de QA ou uso de capturas da instalação como prova da candidata.

## Regressão funcional integrada

O código funcional final #46/a7f132a foi carregado nesta sessão. Central no tema escuro exibiu a evidência alta da CAFETERIA FLORESTA e a baixa da LOJA HORIZONTE, agora com divergência explícita Compras/Lazer. Prévia futura e confirmação executadas pela UI; leitura direta somente do SQLite sintético comprovou 1 regra e **zero overrides em cafe-4/cafe-5**. A aprovação permaneceu auditada. Captura de prévia escura mostrou conta/natureza/padrão/categoria/prioridade e a segunda decisão independente para o histórico.

Na rodada anterior, registrada no log funcional, foram inspecionadas as oito áreas no tema claro, despesas em normal/ponteiro/retorno, aprovação futura, lote retroativo R$ 37,80, desfazer e comando natural no chat. Esta rodada acrescenta o layout final em claro/escuro, ambiguidade e aprovação das fontes finais e regressão real da navegação. Não representa E2E completo de cada operação das oito áreas.

## Testes e limites

Windows local; Node 22.23.4/npm 10.9.9. `npm run test:db`: **490/490 PASS**, sem skip; tipos, compilação canônica, F08/11 entradas e **1/1 ASAR PASS**. Um teste novo executa o método real de navegação após setState, confere a chegada ao topo, os aliases e preservação da posição na mesma área. Log TAP no diretório de evidências deste refinamento. Proveniência será criada e verificada no commit limpo antes de publicar.

Não foram alteradas animações/cores do hover V1.3 ou geometria B3. O vermelho permaneceu correto na inspeção da candidata; não houve evidência que justificasse substituir a borda semântica. B3 zero limite foi observado sem mudar a semântica. Comparação de geometria alternativa, ciclo completo dark/light das oito áreas, escalas 100/125%, contraste instrumental e QA completo de teclado/reduced-motion continuam pendentes; não declarar homologação global. O CSS novo não adiciona animações.

Sem CircleCI Windows, EXE, merge, deploy, IA externa ou operação financeira pessoal. Escrita supervisionada continua bloqueada fora do perfil sintético. Reversão: reverter o commit visual e recompilar; não exige alteração de banco. Próximo gate: revisão dos dois Drafts e QA complementar nas escalas/cenários pendentes antes de aprovar uma candidata Windows.
