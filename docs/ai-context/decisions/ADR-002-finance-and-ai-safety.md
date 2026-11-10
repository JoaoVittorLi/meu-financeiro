# ADR-002 — Integridade financeira, migração cloud e IA como cliente autorizado

**Data:** 09/11/2026  
**Status:** princípio arquitetural 2.0; cutover e inferência bancária real **não autorizados nem homologados**.

## Problema

Windows SQLite e Cloudflare Preview têm estados parcialmente conciliados. A IA desktop usa contexto de demonstração. Iniciar escrita financeira ou cloud cutover antes dos gates poderia duplicar registros ou comprometer histórico.

## Decisão

1. SQLite original preservado até conciliação individualizada, recuperação testada e autorização de migração.
2. Integração Pluggy read-only; original bancário e overlays pessoais separados.
3. Núcleo financeiro determinístico com aritmética exata, revisões e idempotência.
4. Comandos por APIs validadas; mudanças multiárea devem preparar diff, verificar versões, pedir confirmação, executar transação e registrar resultado.
5. IA recebe apenas contexto mínimo autorizado, com data, fonte, qualidade, custo controlado e fallback seguro.
6. Proibidos pagamentos, transferências e ordens financeiras automáticas no escopo 2.0.
7. As flags de migração financeira e publicação Cloudflare Production são gates específicos, não parâmetros usados para "fazer o teste passar".

## Consequências

Pode retardar funcionalidades de IA e paridade, mas impede que protótipos sejam confundidos com dinheiro real. Frontend deve saber exibir indisponível/desatualizado em vez de construir números fictícios.
