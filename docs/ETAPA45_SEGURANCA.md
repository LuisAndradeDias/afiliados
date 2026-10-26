# Afiliados 2.0 — Etapa 4.5: correção de segurança e regressão

Data: 2026-10-26
Branch: `fix/seguranca-zod-etapa45` (base PR #42).
Status: validado em worktree isolado; NÃO implantado em produção.

## Causa confirmada

A auditoria anterior sinalizou Zod HIGH: memória excessiva ao validar coleções grandes (versões afetadas `<4.6.6`). O projeto declarava `zod: ^3.24.2` e instalava `3.25.76`.

Uma busca nos arquivos versionados e um teste de importação confirmaram que **nenhum módulo da aplicação importa Zod**. Ocorrências textuais de “zod” em quatro `.wasm.js` de OCR são trechos de código compilado de terceiros, não uma dependência `zod` de runtime. Atualizar a Zod 4 criaria risco de breaking change sem benefício funcional.

## Alterações reais

- `package.json`: remover somente a dependência direta não utilizada `zod`.
- `package-lock.json`: sincronizar via `npm.cmd uninstall zod --ignore-scripts --no-audit --no-fund`.
- `tests/dependencias-seguranca.mts`: detectar futuras declarações diretas, restos no lockfile e importações reais da biblioteca nos arquivos próprios.
- `.github/workflows/seguranca-etapa45.yml`: instalar pelo lock sem scripts, bloquear HIGH/CRITICAL via npm audit, validar tipos e rodar regressão segura.
- Nenhum servidor, worker, WhatsApp, OAuth, banco ou UI foi alterado.

## Ambiente Windows isolado

- Apenas ACER da conta Desktop Commander 14 disponível. NÃO presumir que é o Windows novo.
- Worktree em `C:\afiliados-etapa45-seguranca`, criado a partir da branch de documentação #42; origem: repositório de homologação `C:\afiliados-homologacao-v2`.
- Worktree inicialmente sem `.env` ou `data/`. `C:\projeto01` não foi modificado; estado dos diretórios locais não rastreados `data/` e `experimentos/` foi preservado.
- Node v24.19.0, npm.cmd v11.17.0. Sem instalar PostgreSQL, Chrome de produção ou API oficial paga.

## TDD observado

**RED:** `node --test tests/dependencias-seguranca.mts` inicialmente 1 aprovado / 2 falhas, especificamente manifest e lockfile ainda contendo a dependência.

**GREEN após remover Zod:** 3/3 testes de segurança aprovados, incluindo a varredura de fontes.

## Evidências de validação no Windows

- `npm.cmd ci --ignore-scripts --no-audit --no-fund`: instalação limpa aprovada.
- `npm.cmd audit --omit=dev --audit-level=high`: **found 0 vulnerabilities**, exit 0.
- `npm.cmd audit --audit-level=high`: **found 0 vulnerabilities**, exit 0 (inclui dev).
- `npm.cmd ls zod --all`: `(empty)` (npm pode retornar código 1 quando lista uma dependência ausente; ausência foi intencional).
- `npm.cmd run typecheck`: exit 0.
- `node --import tsx --test tests/dependencias-seguranca.mts tests/monitor-agendamento.mts tests/painel-dominios.mts tests/rotas-visuais.mts`: 13/13.
- Suites de Captação (`http-modulos`, `consultas-dominios`, `consultas-campanhas`, `convites-web-manual`, `whatsapp-incerto`, `whatsapp-worker-supervisionado`, `consentimento`, `campanhas-local`): 30/30.
- `npm.cmd run test:central-unificada`: 4/4.
- Mercado Livre token mock/refresh e OAuth bridge loopback: sucesso, incluindo 3/3 testes de callback.
- `node --import tsx tests/whatsapp-auto-send.mts`: decisões puras aprovadas, sem envio.
- `git diff --check`: exit 0.

**Total de testes `node:test` com contagem nesta sessão:** 13 + 30 + 4 + 3 = 50 aprovados. Os dois testes CLI adicionais (Meli token e autoenvio) foram aprovados separadamente. Não houve autenticação real, acesso a WhatsApp ou disparo de mensagens.

## Revisão da cadeia de PRs

PRs #38, #39, #40, #41 e #42 estavam abertos em rascunho, não mesclados, sem bloqueio de merge reportado pelo GitHub. A base do #38 é `feat/convites-whatsapp-web-supervisionado`, **não** a branch principal `main` — verificar a ancestralidade antes da integração final com a produção. Demais PRs estão empilhados em ordem: #38 → #39 → #40 → #41 → #42 → PR da etapa 4.5.

Revisão autoral e testes não substituem **revisão independente**. Não marcar a implantação como aprovada apenas pela CI.

## Rollback e bloqueios de produção

- Reverter apenas o PR da etapa 4.5 para restaurar `package.json` e `package-lock.json` anteriores, caso alguma integração fora dos testes necessite Zod.
- O worktree não é a instalação operacional; NÃO copiar `.env` ou perfil WhatsApp para ele.
- Antes de implantar: revisão independente, compatibilizar PR base com `main`, identificar PC novo, backup local protegido no C: e homologação de Meli/WhatsApp com usuário presente.
- Nenhum merge, deploy ou envio de campanha nesta etapa.
