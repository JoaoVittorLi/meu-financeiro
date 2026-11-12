# Q1 — homologação real e candidata Windows

Execução explicitamente autorizada pelo proprietário. Base `d52df2adcef6d105dc92480714639dece7448985` do PR #47, contém #46/a7f132a; HEADs consultados e preservados. Branch isolada `qa/mf2-q1-integrated-windows-20261112`.

## Evidência inicial e correções

Computer Use no Electron real, sem emulação de imagens/viewport. Perfil temporário `mf-d1-electron-q1-*`, caminho confirmado pela API e integridade SQLite antes das operações. Rede HTTP externa bloqueada no perfil sintético. Nenhum banco/instalação pessoal acessado.

- Visão geral: ocultar/restaurar valores e hover normal → hover → retorno; vermelho das despesas preservado. Sem defeito semântico nesse hover; estilos computados em `before-styles.json`.
- Movimentações: busca sem resultado, limpar filtros, filtros avançados e formulário; lançamento manual 42,15 confirmado no SQLite.
- Planejamento: criação 120,00, agenda, calendário e projeção; persistência confirmada após reinício.
- Orçamentos: editar limite Alimentação de100 para50; B3 passou de84% para168%, saturado/vermelho, sem inventar percentual para limite zero.
- Simulador: análise 600 em6 parcelas, aviso por saldo desconhecido; mudar valor invalida resultado e bloqueia planejar até recalcular. Corrigida borda verde herdada pelo alerta unknown/caution (agora warning; danger permanece red).
- Contas: filtro de referência desconhecida, sem converter desconhecido em zero.
- Configurações: aparência/dados e recuperação; backup diário apresentado. Restore da instalação pessoal não executado.
- Inteligência: quatro sugestões reais do SQLite sintético (alta/alta/média/baixa), exemplos manuais e ambiguidade; PIX genérico não sugerido.
- Defeito reproduzido: escolher outra conta deixava os registros antigos selecionáveis. Agora limpa lista, seleção, prévia e confirmação, exige aplicar filtros; descarta respostas antigas por revisão de filtro e sequência de requisição. Regressões verificam essa corrida.
- Central: atalhos por seção com foco, seleção somente elegível da página, paginação junto aos filtros, região de tabela acessível/rolável e cabeçalho fixo; prévias longas têm rolagem limitada. Sem regras globais de hover.
- Marca recortada em1366: espaço recuperado por gap/margem locais. Captura posterior real1366×768.

## Recuperação antes de confirmação

`CategoryReviewBackupGate` só é criado com serviço de perfil sintético. Destino decidido no main. Valida autorização/consentimento/digest antes do backup, grava cópia temporária, verifica formato/schema/quick_check e SHA256, publica cópia e só então confirma. O serviço revalida o estado sob BEGIN IMMEDIATE. Recibo registra identificador/hash/tamanho, sem caminho vindo do renderer. Concorrência do mesmo comando compartilha operação; replay não gera novo backup. Falha de disco, stale durante backup e falha SQLite não aplicam a ação. Cópia verificada permanece para recuperação quando confirmação é recusada. Não existe nova ativação no perfil pessoal.

Primeira rodada após código: 499/499 Node/SQLite PASS, incluindo6 regressões de backup/restore e3 de interface. Gate de janela adicionado após essa rodada. Validação do commit final e QA nativo seguintes serão registrados abaixo; não declarar homologação por esta documentação.

## Evidências

Arquivos reais em [pasta Q1](../evidence/2026-11-12-q1/). `captures.json` registra dimensões efetivas, tema e estágio; primeiras capturas pedidas1366×768 tinham767px e janela maximizada1920×1032: os metadados preservam o tamanho real. Não representam capturas1080. Imagens são JPEG nativos preservados, sem composição. Estágio inicial não representa SHA final; comparações finais serão identificadas explicitamente.

## Pendências desta etapa

Reteste810a2bc: edição mostra antes/depois, grava Transporte, pausa e reativa; revisão individual somente de estado confirmada. Expandir do drawer abre de fato o chat principal preservando frase, resposta e contexto. Temas claro/escuro em1366×768 e1920×1080 reais (F11 nativo para1080), oito áreas escuras verificadas. Normal→hover→retorno da despesa escura conserva vermelho. CSS computado do alerta unknown: borda rgb(245,188,99), igual warning; marca clientWidth=scrollWidth108. Sem overflow horizontal nessa viewport.

Backup completo salvo pela UI em arquivo temporário de258048 bytes, toast confirmado. Diálogo de restauração selecionou esse arquivo sintético e chegou à confirmação; cancelado. Restore automático e falhas verificados em testes SQLite. Ao seguir o contrato do restore foi detectado outro defeito: serviços locais mantinham o handle fechado após substituição de `db`. Rebinding e invalidação de sessão implementados no sucesso e recuperação de falha, com guard de concorrência durante backup supervisionado. Teste usa o handler de produção extraído do main, diálogos controlados e restore SQLite real, sem apresentar isso como Computer Use de restore completo.

QA em f2d7381: classificação individual, regra futura, lote de2 (37,80), undo, adiar e negar executados pela UI. SQLite antes/depois do undo exportado; somente os dois overrides do lote removidos, classificação individual da outra conta preservada. Chat principal recebeu a frase literal solicitada e abriu Central. Drawer mostrou a mesma conversa e criou prévia de desfazer sem executar. Encontrados dois defeitos adicionais e corrigidos: edição de regra com0 afetados não identificava antes/depois; Expandir fechava drawer mas mantinha Central aberta em vez de exibir chat. Cancelamento feito sem confirmar essa prévia. Acrescentados detalhes da regra, aviso de prévia pendente no chat principal e regressões. Rolagem da prévia agora evita sobreposição do menu. Handoff de histórico aplica filtro e foca a fila diretamente.

Primeiro smoke IPC recusou corretamente o lote após introduzirmos evidência manual divergente (Alimentação/Transporte). Teste reorganizado: lote antes da divergência; depois exige recusa explícita por baixa confiança. Não relaxado o guard do produto.

QA funcional da Central final, capturas claro/escuro, gates completos no commit, Draft PR e plano Windows. Nenhum CircleCI/EXE/instalador/deploy/merge executado.
