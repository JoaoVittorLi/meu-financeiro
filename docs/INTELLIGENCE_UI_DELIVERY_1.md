# Entrega IA-1 — interface da Inteligência

**Data:** 07/11/2026  
**Branch:** `feat/inteligencia-interface-e1`  
**Base:** `e0d5131` (main, v0.9.4)  
**Status:** protótipo navegável, exclusivamente frontend.

## Implementado

- Item **Inteligência** sob um novo agrupamento na navegação, preservando as seis páginas existentes.
- Área Inteligência com **Hoje**, **Conversar** e **Plano de ação**.
- Três cartões ilustrativos em Hoje, explícitos como dados fictícios.
- Campo de pergunta para **preparação local** de texto. Não envia dados, não consulta GPT e não simula respostas reais.
- Três exemplos de planos de ação com detalhes expansíveis e link para preparar perguntas.
- Painel contextual em seis áreas pelo cabeçalho; atalho adicional no detalhe das movimentações.
- Área de configuração inicial em Configurações, sem solicitar credenciais.
- Estilos isolados em `app/intelligence.css`, respeitando tema escuro, tipografia e adaptação responsiva.
- Testes estáticos em `tests/ai-ui.test.cjs`.

## Fora do escopo (não implementado)

- Sign in with ChatGPT e OAuth.
- GPT-6.1 Sol, raciocínio Low/Medium, streaming ou consumo de tokens.
- Acesso real à conta bancária pela IA.
- Memória, histórico de conversas, análise de investimentos e sugestões executáveis.
- Escritas financeiras e migração cloud.

## Segurança

A prévia opera sem requisições externas e não recebe credenciais. Os cartões usam apenas exemplos sem valores reais. Ao clicar em uma pergunta contextual, a string predefinida é copiada para o campo de rascunho da área Inteligência; referências completas a transações não são transferidas. As movimentações bancárias originais permanecem inalteradas.

Nenhum segredo, token, esquema ou banco financeiro foi alterado. A chave `FINANCE_SYNC_ENABLED` não deve ser habilitada nesta fase.

## Testes e validação manual

Na raiz do projeto:

```powershell
npm install
npm run compile
npm run test:db
npm start
```

Conferir manualmente:
1. Navegação entre as seis áreas originais, Inteligência e Configurações.
2. Três abas e expansão/recolhimento de exemplo no Plano de ação.
3. Preparação de perguntas sem envio nem respostas inventadas.
4. Botão Inteligência contextual no cabeçalho de cada área original.
5. Atalho em um detalhe de movimentação: fecha o drawer anterior antes de abrir o contextual.
6. Abertura e fechamento do assistente contextual pelo botão e pelo fundo.
7. Comportamento visual no desktop e em larguras menores.
8. Simular compra continua funcional; rota interna `assistant` preservada.

**Atenção:** o GitHub Actions está com limite esgotado. Não executar workflow de release automaticamente nem mesclar na `main` antes dos testes. O instalador Windows deve ser gerado localmente após a validação.

## Próxima entrega

IA-2 — teste de autenticação com Sign in with ChatGPT e GPT-6.1 Sol Low/Medium, com dados totalmente fictícios e sem uso de API paga. A elegibilidade do aplicativo privado e as permissões da conta ainda precisam ser confirmadas.
