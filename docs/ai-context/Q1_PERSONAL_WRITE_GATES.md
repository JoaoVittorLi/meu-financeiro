# Q1 — liberação gradual da categorização pessoal

**Escrita pessoal permanece bloqueada.** A candidata prova o fluxo em SQLite fictício; não prova compatibilidade com o banco pessoal existente, que não foi aberto. Nenhuma nova flag de liberação pessoal foi criada.

| Gate | Evidência Q1 | Falta antes da liberação pessoal |
| --- | --- | --- |
| Backup antes da ação | Gate sintético verifica SQLite/hash antes de confirmar; falha bloqueia escrita; concorrência/replay e restore testados | Destino pessoal aprovado, espaço em disco, retenção, hashes sem carregar bancos grandes inteiros em memória, recuperação ensaiada em cópia autorizada e recibo vinculando backup |
| Compatibilidade/migração | Tabelas supervisionadas só são criadas no sintético; migração de coluna é aditiva; perfil normal não recebe schema de revisão | Inventário de versão/schema **em cópia autorizada**, migração aditiva versionada e transacional, comparação antes/depois de saldos, bruto, overrides, notas, splits e vínculos; nenhum teste destrutivo no original |
| Precedência e correções humanas | Regras exatas por conta/natureza/rowid futuro; conflitos bloqueados; overrides manuais prevalecem e reimportação sintética é idempotente | Fixtures representativas autorizadas, incluindo IDs repetidos/reutilizados, estornos, PENDING→POSTED e mudanças de descrição/valor em importação real; sem generalizar PIX ou semelhança de nomes |
| Consentimento | Grant por sessão/origem, expiração, prévia/digest e confirmação específica; chat não grava sozinho | Contrato pessoal separado do consentimento sintético, fonte/conta/período/quantidade visíveis, renovação após restart/restore e autorização explícita do proprietário para ativação |
| Reversão/auditoria | Classificação e revisão têm undo condicionado ao fingerprint; regra ainda não aplicada pode ser desfeita; regra já aplicada requer pausa com prévia | Política explícita para edição/pausa/reativação/exclusão e decisões, hoje sem undo automático; retenção do histórico, restore de cópia e conflitos pós-reimportação ensaiados |
| Recuperação de falha | Transação SQLite com rollback; backup verificado; main refaz serviços e invalida grants após restore/recoveredDb; impede restore concorrente com confirmação | Ensaio de interrupção de processo/disco cheio/permissão negada em cópia pessoal autorizada, inclusive reabertura, migração e restauração; pacote instalado em ambiente isolado |
| Privacidade/conversa | Revisão sintética usa conversa em memória; não persiste respostas/grants no histórico pessoal | Decidir retenção, exclusão/exportação e proteção do histórico pessoal local (atualmente não é cofre criptografado); não enviar dados bancários a IA externa sem consentimento/contrato/custo separados |
| Interface e distribuição | Oito áreas nativas, claro/escuro, confirmação verificável, seleção elegível e paginação | Revisão do #48, build autorizado em SHA fixo, hashes/ASAR/proveniência, smoke do binário isolado e decisão humana de liberação |

## Etapas propostas, cada uma com decisão própria

1. **Leitura local:** permitir sugestões com fonte/conta/período autorizados; nenhuma escrita, nenhuma inferência externa. Revisar justificativas, exemplos e ambiguidades com dados representativos permitidos.
2. **Uma regra futura em uma conta:** prévia exata, backup e consentimento; histórico intacto. Verificar nova importação, reimportação, natureza, pausa e correção manual antes de ampliar.
3. **Classificação individual:** mesma cadeia de proteção, recibo e desfazer. Recusar prévia stale e alteração posterior ao fingerprint.
4. **Lote pequeno:** começar com até10 elegíveis numa conta, ampliar até100 somente após evidência. Excluir baixa confiança, manuais, splits, vínculos, transfer/ignore e PENDING; revalidar tudo na confirmação.

Não liberar escrita pessoal apenas trocando o guard sintético. Build Windows e desbloqueio pessoal são decisões diferentes. Orçamentos, Planejamento e Metas inteligentes completos permanecem fora desta missão.
