# Shopee Integrada — Plano de Implementação (Etapa 4.8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a Shopee visual e funcional para links manuais dentro da Central atual, sem depender da conta ou disparar WhatsApp.

**Architecture:** UI estática com tokens existentes + serviço local de rascunhos com validação, persistência e endpoints limitados de loopback. API Shopee oficial fica indisponível até conta autorizada.

**Tech Stack:** Node 24, TypeScript/tsx, HTML/CSS/vanilla JS, node:test, Windows ACER.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa48-shopee-design.md`.

## Restrições

- Não modificar o robô WhatsApp, grupo, monitor e fila real; sem envio automático, sem credenciais Shopee fictícias.
- Worktree isolada C:, sem .env nem dados pessoais.
- Respeitar identidade visual e navegação Central existente; links de marketplace por allowlist HTTPS.
- Shopee terceira plataforma no mesmo grupo **quando** a integração de envio for ativada no futuro; não alegar que já envia.
- PR draft empilhado, CI e rollout com backup/rollback e supervisão, nunca tocar C:\projeto01.

## Task 1 — TDD núcleo

**Files:** criar `tests/shopee-rascunhos.mts` e `src/painel/shopee-rascunhos.ts`.

- [ ] Testes RED de URL Shopee legítima, subdomínio falso, http/credenciais no URL, preço e título, confirmação.
- [ ] Implementar `normalizarRascunhoShopee(input): RascunhoNovo` e `criarRepositorioShopee(path)` com `listar()`, `salvar()`, `excluir()`; gravação atômica e limite 100.
- [ ] Testes RED→GREEN persistência, duplicidade, reload e corrupção de JSON.

## Task 2 — Rotas HTTP locais

**Files:** criar `src/painel/shopee-http.ts`, modificar `src/painel/server.ts`, criar `tests/shopee-http.mts`.

- [ ] Testar rotas de GET/POST/DELETE com servidor de teste e arquivo temporário, negação de Origin e Sec-Fetch-Site suspeitos, JSON inválido, corpo grande, método errado.
- [ ] Implementar roteador `responderRotaShopee({req,res,pathname,raiz})`, chamar antes do fallback 404 do servidor real.
- [ ] Confirmar ausência de POST a APIs de afiliados/WhatsApp.

## Task 3 — UI e navegação

**Files:** `src/painel/public/shopee.html`, `shopee.css`, `shopee.js`; modificar `central.html`, `index.html`, `rotas-visuais.ts`; teste `tests/shopee-ui.mts`.

- [ ] RED estrutura de página, estilo e nav, estado honesto da API e controles que não enviam.
- [ ] Implementar página profissional Shopee, form com título/URL afiliado/preço e confirmação, lista de rascunhos com cópia/exclusão, estados vazios, status, acessibilidade.
- [ ] Atualizar cards/navegação Central e Ofertas; rotas exatas e asset whitelist. Testar contrato preservado.

## Task 4 — Verificar e integrar com segurança

**Files:** criar `.github/workflows/shopee-etapa48.yml`, `docs/ETAPA48_SHOPEE_PREPARADA.md` e ledger.

- [ ] `npm ci`, TypeScript, `node --test` suíte Shopee + regressões Central/Meli/WhatsApp, npm audit e teste smoke HTTP.
- [ ] Auditar diff, GH draft PR #46 base #45, CI Windows/Linux; sem commit de credenciais.
- [ ] Se seguro, cópia de arquivos somente de UI/backend validada, backup C: e reinício 3030 controlado com monitores/autoenvio off; 3040 e instalacao antiga intocados.
