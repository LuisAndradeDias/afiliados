# SDD ledger — Etapa 4.5 segurança

Plano: `docs/superpowers/plans/2026-10-26-etapa45-seguranca.md`.
Base: PR #42 `chore/homologacao-windows-etapa44`; PR desta etapa: #43 (draft).
Ambiente: Windows ACER, worktree independente `C:\afiliados-etapa45-seguranca`, sem `.env` nem `data/`.

## Resultados por tarefa

**Task 1, RED:** foram criados testes para impedir dependência direta Zod sem uso, lockfile residual e imports `from 'zod'` em código próprio. `node --test tests/dependencias-seguranca.mts` retornou **1 PASS / 2 FAIL**, porque o manifest e lock continham Zod. Essa falha inicial foi a esperada e reproduziu a causa rastreada pelo npm audit.

**Task 2, GREEN:** `npm.cmd uninstall zod --ignore-scripts --no-audit --no-fund` editou apenas `package.json` e `package-lock.json`. O mesmo teste passou **3/3**; `npm.cmd ls zod --all` confirmou `(empty)` (código 1 esperado para não encontrado). `npm.cmd ci --ignore-scripts` e `npm.cmd run typecheck` passaram. Auditorias npm de produção e completa: **found 0 vulnerabilities**, exit 0 em ambas.

**Task 3, testes e CI:** Windows: **13 + 30 + 4 + 3 = 50** testes `node:test` passaram; CLI de refresh/token Meli e função pura de autoenvio também aprovadas. Sem browser/WhatsApp reais; mock de Chrome e dados fictícios. CI GitHub Actions [40364198107](https://github.com/LuisAndradeDias/afiliados/actions/runs/40364198107): finalizou **success** com audit, tipos, contratos, worker mock e consentimento. Workflow próprio em `.github/workflows/seguranca-etapa45.yml`.

**Task 4, revisão/PR:** os PRs #38–#42 estavam abertos, todos rascunho e não mesclados; revisão autoral da lista de arquivos e dos caminhos tocados. `main` é a default branch. A branch-base do PR #38, `feat/convites-whatsapp-web-supervisionado`, possui **58 commits à frente de main**, 0 atrás e 194 arquivos distintos no comparador GitHub. A integração de toda a cadeia requer revisão de base, mesmo com o PR #43 verde. PR draft #43 aberto sobre #42.

## Rulings

- **Ruling:** remover Zod, não atualizar major 3→4 — nenhuma importação direta no código de primeira parte; menor risco sem tocar em esquemas, filas, WhatsApp, Meli. Custo se falso: alguma importação dinâmica não rastreada poderá exigir reposição; testes e auditoria fazem bloqueio explícito.
- **Ruling:** não examinar o conteúdo completo de 4 bundles OCR/Tesseract `.wasm.js` com correspondência textual “zod” — são vendor gerados, não imports; custo se falso: requer auditoria separada de dependências externas se um bundle for substituído.
- **Ruling:** usar GitHub connector para publicar commits, pois o Git local do worktree não tinha `user.name/user.email` configurados. Custo: commits individuais para manifesto/lock/teste/workflow/docs. Não foi alterada identidade global nem `C:\projeto01`.
- **Ruling:** **não fazer merge**. PRs anteriores em rascunho, instalação definitiva não conectada, sem revisão independente humana.

## Pendências externas

- [ ] Revisão independente de implementação, principalmente rotas e fila WhatsApp dos PRs #38–#41.
- [ ] Confirmar computador Windows novo de produção e preparar backup local validado.
- [ ] Homologar OAuth Meli real, Chrome WhatsApp e portas com usuário presente, sem disparar mensagens de teste.
- [ ] Resolver processo de integração da base `feat/... ` para `main` antes de publicar qualquer versão.

Conclusão: **correção auditada e testada em ambiente isolado**, não implantação operacional.
