# Meu Financeiro — migração cloud-first (pré-v1.0)

## Princípio

A única fonte de verdade para os registros financeiros será o banco gerenciado na Cloudflare.
O Windows e o Android serão clientes, e **não** manterão bases financeiras independentes.
Isso implica que consultas e edições financeiras exigem conexão com a internet. Não prometer uso financeiro completo offline.
A aplicação e o sistema operacional ainda podem ter cache de arquivos estáticos, mas não devem persistir extratos ou saldos no disco local.

## Situação atual (piloto)

- `mobile-push` já publica o PWA de notificações no Worker.
- `/sync.html` prova escrita e leitura entre dispositivos, sem dados financeiros.
- `/api/sync/...` oferece API com revisão por registro, operações atômicas e recusas HTTP 409 em conflitos.
- `FINANCE_SYNC_ENABLED` deve **permanecer ausente**. Financeiro real não tem migração nem validação de esquema completas.
- O Electron v0.9.4 ainda usa SQLite local. Nunca apagar ou desativar os dados locais nesta fase.

## Domínios a migrar, preservando as mesmas regras

1. Contas bancárias, posições de saldo, instituições e sincronização bancária via backend.
2. Extrato imutável (identificador do provedor, conta, data, descrição e valor originais).
3. Categorias, emojis, regras automáticas e correções individuais.
4. Revisão, divisão de compras, destinatários e conciliacão de lançamentos.
5. Transações manuais e vínculos sem duplicação de caixa.
6. Planejamento, recorrências, parcelas, pagamentos parciais e projeção diária.
7. Orçamentos (gastos/receitas), reservas, limites e relatórios por período.
8. Simular compra com mesmo motor financeiro central.
9. Avisos push, configurações, fila persistente e histórico de entrega.

## Segurança obrigatória antes dos dados financeiros

- Proteger o Worker com **Cloudflare Access**, restrito à identidade do proprietário, além da sessão atual.
- Validar JWT de identidade ou operar exclusivamente por trás do Access protegido; não confiar em campos de identidade enviados pelo cliente.
- Manter credenciais de Pluggy no servidor, em segredos ou armazenamento criptografado. Nunca no HTML, JS estático, GitHub ou logs.
- Validar as formas e valores dos registros no backend, com valores monetários em centavos.
- Revisão explícita de permissões, limites de requisição, retenção, backup independente e recuperação.
- Transações bancárias originais não podem ser editadas pela interface; categorias e títulos são metadados separados.
- O aplicativo desktop deve consultar o mesmo serviço remoto; configurações e dados locais não podem ser uma segunda fonte de verdade.

## Migração segura do SQLite instalado

1. Gerar backup completo verificado e mantê-lo fora da nuvem para recuperação emergencial.
2. Exportar dados validados do banco original em uma representação sem segredos bancários.
3. Migrar em lotes idempotentes, preservando identificadores, vínculos, categorias e revisões.
4. Conferir contagens, somas, datas e projeções no servidor vs. base local antes de alterar o Windows.
5. Bloquear escrita local e ativar clientes remotos em ambos dispositivos **somente após** a conferência.
6. Revogar o cliente antigo e manter backup de emergência; limpar cópias locais somente após confirmação.

## Sem divergência entre dispositivos

- Toda escrita requer revisão conhecida; conflitos retornam 409 com versão remota.
- Não usar dois bancos financeiros ativos nem somar importações de duas fontes.
- Entregas automáticas da integração bancária têm chave idempotente (instituição/conta/transação).
- O servidor é responsável pelos cálculos e pelas regras financeiras.
- O cliente atualiza ao retomar foco e após alterações; uma atualização do PC deve chegar ao celular sem reiniciar o app.
- Conflito não pode ser resolvido por `last-write-wins` silencioso.

## Critérios de aceite antes da v1.0

- Uma mudança de categoria feita no Android aparece no Windows sem recriação nem duplicação.
- Um compromisso criado no Windows aparece no Android e altera a mesma previsão.
- Revisão, divisão, conciliação e status de pagamento permanecem iguais em ambos.
- Dois dispositivos editando simultaneamente recebem feedback de conflito; nenhum registro é perdido.
- Reconexão Open Finance e ingestão repetida não duplicam movimentações nem contagens.
- Dados bancários e credenciais não ficam salvos como base independente no PC.
- Push de limites 50%, 80% e 100%, vencimento, saldo em risco e resumo semanal usa exclusivamente dados centrais.
- Alerta no horário silencioso permanece na fila para emissão após 08:00; sem repetição de evento.
- Backups e restauração verificados com um conjunto de dados de teste e, depois, com contagens/somas reais.
- Todas as áreas do PWA disponíveis no Windows com layout responsivo e acessível.

## O próximo entregável

Implementar a autenticação reforçada e esquema financeiro central com validação de todas as entidades; iniciar migração em modo leitura usando dados fictícios.
Apenas depois ligar a integração bancária, testar consistência e migrar o desktop.
