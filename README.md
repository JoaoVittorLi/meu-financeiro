# Meu Financeiro v0.9.1 💜

Aplicativo financeiro pessoal **Windows x64**, com Electron, React/TypeScript e SQLite local. Integração bancária **somente leitura** via Meu Pluggy.

## Novidades v0.9.1

- **Simular compra** usa o **mesmo motor diário** da Central de Planejamento, sem gravar dívidas fictícias. Compara saldos com/sem compra, compromissos por vencimento, reserva configurada e até 60 parcelas com juros mensais.
- A simulação examina pelo menos 90 dias seguintes, e continua até 30 dias após a última parcela. O teste inclui saldos negativos, períodos críticos e reservas comprometidas.
- O aplicativo sinaliza **qualidade da referência bancária**: leitura antiga (24+ horas), saldo incompleto ou leitura recente mas sem data bancária efetiva comprovada. Uma consulta recente à API **não** significa que todas as operações já entraram no saldo.
- Indicadores de receitas, despesas e categorias bancárias consultam **todo o histórico local** usando agregados por data. A lista navegável ainda mostra no máximo 2.500 operações mais recentes.
- **Movimentações** reúne a antiga caixa de revisão como aba; a segunda página de simulação foi eliminada. Planejamento continua com sua linha do tempo.
- Transações já vinculadas a um planejamento deixam de aparecer duplicadas na visão consolidada; a opção de ver extrato bancário mantém o lançamento original acessível.
- Avisos **não destrutivos** de registros bancários potencialmente duplicados entre conexões diferentes (mesmo nome de conta, descrição, valor e data próxima), com opção de ignorar alerta. Não mescla nem exclui automaticamente.
- Sugestões de conciliação deixam de utilizar percentuais de confiança não calibrados; usam qualificações descritivas. Confirmação manual continua obrigatória.

## Como usar

1. Faça backup completo na versão atual antes de instalar a v0.9.1.
2. Abra **Planejamento** e confirme seus compromissos futuros, pagamentos e possíveis vínculos bancários.
3. Entre em **Simular compra**, escolha valor, prazo, juros e primeira data de pagamento.
4. Compare o menor saldo dos cenários e leia os avisos. Uma projeção **não confirma** capacidade de pagamento.
5. Abra **Movimentações → A revisar** para conferir categorias e identificar possíveis registros repetidos.

## Execução para desenvolvedores

```powershell
npm install
npm test
npm start
```

Para Windows, o GitHub Actions gera instalador NSIS e portátil. O app **não** usa servidor próprio nem necessita Python/Node instalado no PC do usuário.

## Limitações e segurança

- O SQLite e backups completos contêm dados financeiros pessoais **sem criptografia própria**. Guarde-os em local seguro. Segredos de integração bancária são mantidos no cofre do Windows, separados do banco.
- A Pluggy nem sempre fornece uma data inequívoca de atualização efetiva do saldo. Os horários de sincronização refletem a consulta, não necessariamente todas as operações lançadas pelo banco.
- Receitas incertas são excluídas da projeção conservadora. Compromissos futuros são **somente os cadastrados**, não detectamos automaticamente despesas esquecidas.
- Recorrências ainda geram um número finito de ocorrências, até 36. Novas parcelas do simulador podem ser até 60, mas **não** são lançadas na contabilidade até o usuário confirmar manualmente um planejamento.
- Em grandes históricos, a lista bancária mostra até 2.500 movimentações recentes; os indicadores por período usam agregados de **todos os registros salvos**. Não implica que o banco forneceu histórico completo.
- O detector de possíveis duplicatas é conservador e pode ter falsos positivos/negativos; **não** remove registros.
- Transferências e estornos precisam ser classificados corretamente; o app não pode deduzi-los de maneira infalível. O dashboard não soma indiscriminadamente o histórico manual ao bancário.
- Todos os valores monetários e testes do motor são expressos em centavos inteiros. Não compartilhe credenciais bancárias ou dados pessoais no repositório.


## v0.9.1 — Linha do tempo contínua e tipografia
- Gráfico de linha mensal do primeiro ao último dia, com marcador móvel e slider de acesso contínuo por teclado, mouse ou toque.
- Variação de saldo em R$ ante o dia anterior, destacada em verde, rosa ou neutro.
- Dias anteriores ao saldo de referência: estimativas históricas reconstruídas, desenhadas com traço pontilhado e aviso; não equivalem a saldos bancários confirmados.
- Dias atuais e futuros: projeções usando o motor de planejamento já existente.
- Tipografia secundária redesenhada em hierarquia moderna e com fontes de sistema offline; não são carregadas fontes externas.
