# Meu Financeiro — v0.6.0 💜

Desktop Windows 64 bits com Electron, React/TypeScript e SQLite local. Integração somente leitura com Meu Pluggy.

## Novidades v0.6

- Criar categorias personalizadas (nome e cor), renomear categorias personalizadas não padrão, editar cores.
- Regras automáticas por descrição: `contém`, `começa com` ou `exato`; prioridade numérica e escopo banco/manual/ambos.
- Aplicação imediata das regras às movimentações bancárias já sincronizadas, sem alterar o extrato original.
- Correção individual das categorias bancárias, preservada após nova sincronização, com opção de voltar ao automático.
- Novos lançamentos manuais e CSV sem categoria aplicam as regras; lançamentos antigos mantêm a classificação até serem editados.
- Na tela Transações, filtrar entre movimentações bancárias e manuais e corrigir categorias.
- Dashboard e orçamentos consultam dados bancários confirmados **ou** manuais, nunca somam as fontes automaticamente.
- Dados e credenciais bancárias permanecem locais. Regras não usam IA paga.

## Instalação

Recomendado: baixar o instalador da [Release v0.6.0](https://github.com/JoaoVittorLi/meu-financeiro/releases/tag/v0.6.0) do repositório privado. Não precisa de Python nem Node instalado.

## Desenvolvimento

```powershell
npm install
npm run test
npm start
```

## Segurança e backups

1. Antes de atualizar, abra **Configurações → Backup completo SQLite** e guarde em uma pasta segura.
2. Instale a v0.6 sem excluir a pasta de dados `%APPDATA%/Meu Financeiro`.
3. Confirme as categorias/regras e o histórico após a instalação.
4. **O backup SQLite contém as categorias e regras. O backup JSON exporta apenas lançamentos manuais/orçamentos, não regras.**
5. `Client Secret` continua protegido pelo Windows fora do SQLite. Nunca compartilhe credenciais no GitHub ou no chat.

Limitações: o motor financeiro ainda não concilia automaticamente transações manuais/bancárias; movimentações pendentes não entram nos indicadores bancários. A exclusão de uma categoria com registros/regras associados é bloqueada para evitar perda silenciosa. As categorias padrão podem mudar de cor, mas não de nome.
