# Etapa 4.2 — Domain Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Extrair regras puras Amazon/Meli/WhatsApp e consultas administrativas de Captação em módulos coesos, sem mudar autenticação ou envio.

**Architecture:** Serviços de domínio pequenos e funções de consulta retornam DTO sem escrever na resposta. Os servidores atuais preservam autorização, estado e ações, delegando somente após a checagem local.

**Tech Stack:** Node.js 24, TypeScript NodeNext, ESM .mjs, GitHub Actions, `node:test`, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa42-dominios-design.md`

## Global Constraints

- Não mexer na máquina Windows, dados, credenciais, perfis Chrome ou contatos.
- Não chamar funções de disparo WhatsApp/Meli OAuth real nos testes; injetar `fetch`.
- Preservar status, corpo HTTP, controle Host/Origin/CSRF e retorno HEAD das rotas atuais.
- Branch baseada em `refactor/modulos-http-v2`, PR draft empilhado.
- Não instalar PostgreSQL, nem conectar serviços pagos.

## Review Focus

- Host adversário com `/api/local/gestao/contatos` deve continuar 403.
- POST desconhecido, mesmo tendo rota GET homônima, deve continuar passando pelo fluxo de métodos anterior, nunca execução de consulta.
- Entrada inválida no OAuth (redirect HTTP, callback errado, secret ausente) não deve gerar URL válida.
- Rate limits em `rapido/contatos` e `convite/validacao` continuam no servidor original.
- Fluxos de envio WhatsApp e sincronização de opt-out não podem ser invocados por testes da Etapa 4.2.

---

### Task 1: Domínios de Ofertas

**Files:**
- Create: `tests/painel-dominios.mts`
- Create: `src/painel/dominios/amazon-tag.ts`
- Create: `src/painel/dominios/mercadolivre-oauth.ts`
- Create: `src/painel/dominios/scripts-robo.ts`
- Modify: `src/painel/server.ts`

**Interfaces:**
- `normalizarTagAmazon(valor: string): string`; `validarTagAmazon(tag: string): boolean`.
- `redirectMercadoLivreEhValido(valor: string): boolean`.
- `credenciaisMercadoLivreConfiguradas(id?: string, secret?: string): boolean`.
- `criarUrlAutorizacaoMercadoLivre(input: { clientId: string; clientSecret?: string; redirectUri: string; state: string }): string`.
- `trocarCodigoMercadoLivre(input: { code: string; clientId?: string; clientSecret?: string; redirectUri: string; fetchImpl?: typeof fetch }): Promise<TokenMercadoLivre>`.
- `arquivoDoRobo(nome: string): string`, com lista exata de 7 processos.

- [x] Criar testes que falhem antes da implementação: tags extraídas da URL, tag inválida, state OAuth, redirect, ausência de secret, resposta HTTP rejeitada via `fetch` fictício, whitelist de scripts.
- [x] Executar `npx tsx --test tests/painel-dominios.mts`. Expected: **FAIL**, módulos ainda inexistentes.
- [x] Implementar três módulos e trocar somente funções auxiliares equivalentes no `server.ts`.
- [x] Executar `npx tsx --test tests/painel-dominios.mts` e `npm run typecheck`. Expected: **PASS**.
- [x] Commit e revisão de URLs: OAuth, webhooks, APIs, WhatsApp devem permanecer no servidor.

### Task 2: Consultas de Gestão (Captação)

**Files:**
- Create: `captacao/caca-promos-vip/tests/consultas-dominios.test.mjs`
- Create: `captacao/caca-promos-vip/src/consultas/gestao.mjs`
- Modify: `captacao/caca-promos-vip/src/server.mjs`

**Interfaces:** `consultarGestaoLocal({ pathname, busca, gestaoContatos, convitesUnicos, denuncias, respostasBotoes, controleWhatsapp, sincronizacaoNetlify }): {status:number, body: object}|null`.

- [x] Teste primeiro: 4 GET/HEAD (`contatos`, `contato`, `resumo`, `denuncias`), busca, paginação, desconhecida→null, Host não autorizado→403.
- [x] Executar `node --test captacao/caca-promos-vip/tests/consultas-dominios.test.mjs`. Expected: **FAIL** antes do módulo.
- [x] Implementar um roteador de leitura puro (somente DTO). Chamar após `acessoCampanhasLocais` e dentro do bloco `try`.
- [x] Executar teste + `node --test captacao/caca-promos-vip/tests/campanhas-local.test.mjs`. Expected: **PASS**.

### Task 3: Consultas de Campanhas (Captação)

**Files:**
- Create: `captacao/caca-promos-vip/src/consultas/campanhas.mjs`
- Modify: `captacao/caca-promos-vip/tests/consultas-dominios.test.mjs`
- Modify: `captacao/caca-promos-vip/src/server.mjs`

**Interfaces:** `consultarCampanhasLocais({ pathname, busca, campanhas, convitesUnicos, denuncias, sincronizacaoNetlify, contatoResumo, controleWhatsapp, conexaoWhatsapp, configMeta, resumoMeta }): {status:number,body:object}|null`.

- [x] Adicionar testes que falham para GET/HEAD de 12 rotas já existentes, campanha inexistente→404, rota desconhecida→null; nenhuma ação POST.
- [x] Executar teste. Expected: **FAIL**, módulo ainda inexistente.
- [x] Extrair somente rotas GET sem rate limit nem chamadas externas. Manter `rapido/contatos` e `convite/validacao` no servidor.
- [x] Executar testes de consultas, HTTP, consentimento e campanha. Expected: **PASS**.

### Task 4: CI, documentação, revisão e PR

**Files:**
- Create: `.github/workflows/refactor-dominios-v2.yml`
- Modify: `docs/ETAPA4_MODULOS_HTTP.md` somente se necessário.
- Create: `docs/ETAPA42_DOMINIOS.md`

- [x] CI: typecheck, testes de domínios e consultas, regressão CRM/campanhas, visual headless sem envios.
- [x] Aguardar run e inspecionar log de cada etapa; corrigir falhas pela causa e reexecutar.
- [x] Revisar diff da branch e notas de segurança/rollback pelo próprio implementador; revisão independente ainda necessária antes de merge.
- [x] Criar PR **draft** #40 contra `refactor/modulos-http-v2` somente após CI verde.

## Pendências fora da execução automatizada

- [ ] Revisão independente da diff por outro desenvolvedor antes do merge.
- [ ] Checar a dependência com vulnerabilidade alta apontada pelo npm audit.
- [ ] Validar a operação em Windows sem envios verdadeiros antes de qualquer implantação.
