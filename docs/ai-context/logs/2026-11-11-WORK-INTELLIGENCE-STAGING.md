# Work — preparação da Inteligência e gates locais

Base `ce8dd04669a474957dc2d6c1107bc91d862031fc`; branch `feat/mf2-work-intelligence-staging-20261112`. Rodada B explicitamente autorizada na missão Work; sem merge, release ou produção.

- Clone separado; Node 22.23.4 e npm 10.9.9 isolados; checkout antigo e instalação preservados.
- Base: TypeScript/compile/F08/proveniência PASS, 420/420 suíte Node/SQLite, 1/1 ASAR.
- Feature: radar fictício, respostas determinísticas/histórico temporário, drawer compartilhado e ajuste de limite simulado com autorização/idempotência/revisão. Motor financeiro e IPC reutilizados. Entrada explícita na aba Hoje; sem escrita ou IA externa.
- Branch: 431/431 testes (11 novos), tipos/compile/F08/ASAR PASS. Três regressões de ordem CSS foram detectadas e corrigidas sem relaxar testes.
- Electron smoke tentou executar binário real; bloqueado por socket Unix antes do CDP. Chromium também falhou; navegador cloud não alcança servidor do terminal. Sem screenshots e sem prova Windows.
- WORK-AUDIT-01: discrepância de categorias de despesa dividida no resumo atual da Inteligência, reproduzida em Node contra motor compartilhado. Correção futura separada.
- Gates G0/G9 NÃO HOMOLOGADOS. CircleCI, Windows build, instalador, PWA e Production NÃO EXECUTADOS.

Handoff completo: [WORK-CHECKPOINT](../reviews/2026-11-11-WORK-CHECKPOINT.md). Evidências: [diretório Work](../evidence/2026-11-11-work/). O registro final de proveniência e PR será acrescentado após commit verificável.

Commit funcional `fb56ddc`: `provenance:create` e `provenance:verify` PASS no checkout limpo. Manifesto e logs brutos versionados na atualização documental posterior, sem mudar renderer.
