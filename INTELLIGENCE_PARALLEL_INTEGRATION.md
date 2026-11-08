# Meu Financeiro — integração paralela da tela Inteligência

## Escopo e proteção do desenvolvimento

Em 07/11/2026 o proprietário informou que outra conversa desenvolve em paralelo a área Inteligência com IA. O planejamento dessa frente é uma tela própria, rota interna "intelligence", com as seções Hoje, Conversar e Plano de ação, além de IA contextual nas áreas financeiras. Sua implementação ainda precisa ser integrada ao PWA após homologação.

Esta PR #1 (branch safety/cloud-migration-preflight-20261107) NÃO implementa nem altera a tela de IA. O trabalho financeiro desta etapa fica em mobile-push/ e shared/. Não sobrescrever os arquivos reservados à frente IA: src/intelligence-view.ts, src/intelligence-panel.ts, novos electron/ai-*, ou as alterações dessa frente em src/app.ts, app/style.css, tsconfig.json, electron/preload.cjs e electron/main.cjs.

## Contrato para a união das duas frentes

1. Reservar a rota "intelligence" (não "assistant", já usada pelo Simular compra no Windows). Ao concluir, adicionar à navegação Windows e PWA numa mesma versão compatível, preferencialmente usando componentes compartilhados.
2. O modelo de IA não é o motor contábil: não pode alterar saldo, confirmar pagamento, criar dívida, quitar compromisso ou vincular transferência automaticamente. Qualquer ação depende de confirmação explícita e operação transacional auditável.
3. Contexto econômico em tokens: fornecer ao modelo indicadores agregados do período solicitado, flags de qualidade e referências aos dados necessários. Nunca enviar automaticamente as 630 transações, as 17 tabelas ou histórico completo por pergunta. Utilizar seleção de campos, limites e paginação.
4. O contexto pode se apoiar em módulos do Preview como /api/finance/period-summary e /api/bank/reference-audit, mas esses resultados ainda NÃO são certificação de saldo disponível ou migração definitiva.
5. Chaves de IA e Pluggy ficam no servidor; nunca em recursos do PWA ou no GitHub. Aplicar autenticação de proprietário Cloudflare Access e sessão privada para dados pessoais.
6. Inteligência é opcional: orçamento, gráficos, planejamento e simulador precisam funcionar sem serviço de IA. Limitar gastos com resumos determinísticos, versões de dados e cache curto invalidável.
7. Não guardar uma segunda base financeira offline para a IA enquanto a única fonte cloud estiver pendente de homologação.
8. Dar transparência da origem e atualização dos números usados pelo modelo, e deixar claramente separadas sugestões de IA e informações bancárias verificadas.

## Coordenação de branches e entrega

- Frente PWA/paridade: PR #1, Preview protegido, sem merge em main ou cutover.
- Frente Inteligência: branch/PR próprios para evitar commits concorrentes em arquivos compartilhados.
- Na integração: revisar diff das duas PRs, resolver conflitos em branch específica, testar o mesmo contrato/versão no Windows e Android e só então promover.
- Esta documentação é de coordenação: a área Inteligência ainda não está implementada nesta PR e não deve ser apresentada ao usuário como pronta.
