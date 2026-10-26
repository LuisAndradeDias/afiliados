# SDD ledger — plan: docs/superpowers/plans/2026-10-26-etapa42-dominios.md

**Ambiente:** execução pelo conector GitHub/Actions, sem worktree de disco local. A branch `refactor/dominios-v2-etapa42` isola cada commit da produção.

Pre-flight: Task 1 produz helpers consumidos por `server.ts`. Task 2 e Task 3 compartilham `captacao/.../server.mjs`, com integrações sequenciais e autorização centralizada; nenhuma rota POST migrada.

Task 1: complete — RED no run 40338899455 (módulo `amazon-tag.js` ausente), GREEN na CI 40339220061 (teste de domínios passou); TypeScript e integração posteriores verdes no run 40340498266.

Task 2: complete — RED no run 40339451770 (módulo `consultas/gestao.mjs` ausente); GREEN na CI 40339694823 com guarda Host/Origin/POST e consulta GET/HEAD.

Task 3: complete — RED no run 40340051279 (módulo `consultas/campanhas.mjs` ausente); GREEN no run 40340498266 após integração de 12 GET/HEAD e preservação de rate limits.

Task 4: concluída em branch isolada — RED→GREEN observado, CI final antes da revisão em 40340986028 (todas as etapas passaram); documentação e PR draft #40 criados; diff revisada pelo implementador. Revisão independente requerida antes de merge.

Task 3: Ruling: separar testes de campanhas em `consultas-campanhas.test.mjs`, em vez de ampliar o arquivo único de gestão — simplifica diagnóstico e reduz acoplamento; custo se equivocado: mais um arquivo e um comando na CI.

Task 4: Ruling: criar a CI antes de implementar os módulos para observar os testes RED via Actions — não havia checkout local isolado; custo se equivocado: histórico de runs vermelhos esperados na branch experimental.

Final: Ruling: nenhuma rota POST/WhatsApp foi extraída nesta etapa — exigiria testes operacionais de processos Chrome e segurança das filas no Windows; custo se equivocado: o servidor legado continua grande até a Etapa 4.3.

**Revisão:** testes de no-network/consentimento e portas 3030/3045 incluídos. Nenhum merge/deploy aprovado.

Final review: self-review (no subagent tool). Inspecionados patches de `server.ts`, `server.mjs`, OAuth, DTOs e testes no PR #40. Não foram detectadas diferenças de contrato nos caminhos cobertos. Autoria e revisão pela mesma pessoa têm menor independência; requer revisão humana adicional antes de produção.

Final: minor (deferred): o arquivo `server.mjs` continua concentrando POSTs/rate limits; o deslocamento de transições de envio exige um contrato testável separado (Etapa 4.3).

Final: minor (deferred): `npm ci` informou 1 vulnerabilidade alta — pacote/impacto ainda não classificados, sem correção automática via `--force`.
