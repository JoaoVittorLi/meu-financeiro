# Meu Financeiro 1.0.0 — RELEASE NOTES (RASCUNHO / NÃO PUBLICADO)

> **NÃO É UMA VERSÃO DISPONÍVEL.** Preparação de escopo e comunicação. O código da candidata segue em `0.9.5-beta.8`; PR #96 Draft, HEAD `2ce62fe4fde7e60df327be3bfa03f47dcc7fbfff`. Não há tag `v1.0.0`, instalador stable homologado, data ou GitHub Release aprovado.

## Escopo previsto a homologar

- Controle financeiro local em Windows x64 com lançamentos manuais e histórico bancário de leitura autorizada.
- Visão Geral, Movimentações D05, Orçamentos, Planejamento, Simulador de compra, Contas e Inteligência.
- Catálogo D05 de **14 categorias, 61 subcategorias e 67 ícones SVG**, com classificação por IDs e revisão.
- D01–D05 e refinamentos B01–B05, incluindo Hoje V6 Pulso, Conversar V5 e Plano de Ação V5.
- Inteligência I2-A/B/C/D/E e investigação financeira I3-01, com leitura pessoal escopada, evidências e estados parciais.
- Segurança Electron 45 com preload bundled, SQLite local e canal experimental segregado. No stable futuro, backup pré-migração online que inclui WAL e preserva snapshots anteriores.

Tudo acima descreve **código presente na candidata**; release notes finais só poderão dizer "incluído na 1.0.0" após gates do [plano](PLANO_DE_RELEASE.md).

## Limitações divulgadas

- **IA pessoal: sem execução de alterações financeiras.** Há revisão e previews, mas `approvedForPersonal:()=>false`. Uma versão que exija escrita IA para 1.0 depende de decisão explícita do proprietário; não anunciar como implementada.
- **Pulso Financeiro:** projeção de caixa real não é fornecida sem saldo disponível e agenda verificados pelo IC-READ. Dados sintéticos ou simples diferença de fluxos não substituem saldo.
- **Bancos:** Pluggy depende de credenciais/cofre e consentimento no canal permitido; sincronização offline/atraso/cobertura parcial impactam saldos.
- **RC experimental:** perfil isolado; Pluggy, IA externa e cloud pessoal **desativados**. Não compartilhar arquivos entre RC e stable.
- **Cloudflare/mobile:** plataforma separada; cutover pessoal e paridade migratória não homologados para o desktop 1.0.
- **Segurança dos dados:** SQLite/backups não são criptografados pelo app; cofre Pluggy é separado e protegido pelo Windows. Nenhuma garantia de pagamento ou saldo em tempo real.

## Requisitos e atualização

- Plataforma alvo: **Windows x64**; backend Electron **45.2.3**. QA também exige **Node 22.23.4 / npm 10.9.9** para reproduzir testes do código, mas usuários do futuro EXE não precisarão instalar Node.
- **Não instalar esta candidata sobre perfil pessoal ainda.** Somente após GO, conferir hash/proveniência do instalador, verificar localização do perfil histórico, backup SQLite consistente e plano de rollback.
- Migração de DB v7 e seleção de perfil stable devem ser testadas em VM com SQLite/WAL/cofre **sintéticos**, não dados reais.

## Evidência necessária para publicar as notas

QA Node/SQLite, TypeScript, preload/ASAR, F08, Electron/Windows, identidade stable empacotada, revisão visual B01–B05, continuidade Pluggy offline, log da falha Windows e aceite humano na [#71](https://github.com/JoaoVittorLi/meu-financeiro/issues/71). Após aprovação, preencher **SHA, versão final, data, hash do EXE e link do GitHub Release**, retirar o aviso de rascunho e não omitir limitações.
