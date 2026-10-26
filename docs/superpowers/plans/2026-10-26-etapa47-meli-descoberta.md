# Etapa 4.7 — Mercado Livre Discovery Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar repeticao de catalogos 404 e consultas HTTP 429 no Mercado Livre preservando as regras editoriais de 25% e vendedor verde.

**Architecture:** Adicionar cache local de negativos com expiracao e persistencia atomica, serializar intervalo de requisicoes entre instancias da fonte, propagar sinal de limite 429 ate o preview e usar backoff do painel existente.

**Tech Stack:** TypeScript Node 24, `tsx`, Node test/assert, filesystem JSON e GitHub Actions Windows/Linux.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa47-meli-descoberta-design.md`

## Global Constraints

- Branch isolada `fix/mercadolivre-descoberta-etapa47`, base PR #44. Nao tocar nem reiniciar `C:\\projeto01` ou `C:\\afiliados-v2-homologacao`.
- Nenhuma requisicao OAuth, Meli ou WhatsApp real durante TDD/CI; usar token mock.
- Nao alterar `.env`, contatos, credenciais, perfis Chrome, filas nem dados locais.
- MIN_DISCOUNT_PERCENT=25 e MERCADOLIVRE_QUERIES_PER_RUN=1 sao inalteraveis nesta etapa.
- Nao iniciar monitores nem enviar mensagens; PR draft, nao mesclar ou implantar.
- Cache tem somente IDs publicos de catalogo sem anuncios confirmados HTTP 404, TTL 30 min, max 500.

## Review Focus

- HTTP 404 seguido de nova rodada: segunda busca deve pular apenas o catalogo 404, nao outros.
- HTTP 429 em anuncios/reputacoes: nao continuar consultas nem validar vendedor como verde.
- 404 envelhecido, JSON malformado, diretorio sem permissao: recuperar sem corromper arquivos.
- Duas instancias simultaneas: ritmo global respeitado sem chamadas em rajada.
- Desconto inferior a 25%, vendedor sem reputacao verde, cupom estimado: nao virar oferta elegivel.

---

### Task 1 — Preparar worktree, baseline e RED

**Files:** criar `tests/mercadolivre-resiliencia.mts`.

- [ ] Worktree separado no C: a partir do SHA de PR #44, sem .env nem data.
- [ ] Criar teste de segunda rodada que deve pular URL de catalogo que recebeu HTTP 404 na primeira, com cache temporario em `os.tmpdir()`.
- [ ] Criar teste de propagacao HTTP 429 no endpoint de publicacoes e reputacao, sem retry da propria fonte e sem consultar produtos restantes.
- [ ] Criar teste de ritmo entre duas instancias simultaneas.
- [ ] Executar RED, documentar falhas observadas do codigo atual.

### Task 2 — Cache 404 seguro

**Files:** criar `src/fontes/mercadolivre/cache-catalogo-404.ts`, modificar `src/fontes/mercadolivre/api.ts`.

- [ ] Criar helper `CacheCatalogo404` com `contem(id)`, `registrar(id)`, `persistir()`, arquivo configuravel em testes e padrao `data/mercadolivre-catalogo-404.json`.
- [ ] TTL 30 min, limite 500, IDs com prefixo MLB, validar JSON e nao registrar resultados 200/erro/transiente.
- [ ] Persistencia atomica com arquivo temporario e rename; falhas nao devem bloquear a busca.
- [ ] Integrar em `buscar()`, salvar em `finally` inclusive quando limite interromper; logs agregados.
- [ ] Adicionar testes de expiracao, arquivo corrompido e desconto/vendedor verde.
- [ ] Executar GREEN e regressao de descoberta existente.

### Task 3 — Ritmo global e 429 fail-fast

**Files:** criar/editar `src/fontes/mercadolivre/controle-requisicoes.ts`, `src/fontes/mercadolivre/api.ts`, `src/robo/mercadolivre-preview.ts`.

- [ ] Substituir intervalo por instancia por reserva temporal compartilhada entre instancias, com piso 250ms.
- [ ] Ao primeiro HTTP 429, lancar `MercadoLivreLimiteRequisicoes` (sem retry) e propagar de `buscarPublicacoes` e `carregarReputacoes`.
- [ ] Em `mercadolivre-preview.ts`, registrar `HTTP 429: limite de requisicoes`, terminar com codigo 5 para o backoff do painel (existente), sem modificar OAuth.
- [ ] Executar GREEN da suite de resiliencia, tipos e testes de auth/descoberta.

### Task 4 — CI, revisao e PR

**Files:** criar `.github/workflows/mercadolivre-etapa47.yml` e `docs/ETAPA47_MELI_BUSCA_SEGURA.md`, ledger.

- [ ] CI Linux/Windows com npm ci, TypeScript, audit, resiliencia mock, descoberta, OAuth mock, central, captura/consentimento.
- [ ] Revisar diff para garantir apenas API/preview/helper/testes/docs/CI, sem `.env` ou dados.
- [ ] Abrir draft PR #45 base `chore/instalacao-segura-windows-etapa46`, confirmar checks no SHA final.
- [ ] Registrar que a instalacao atual no ACER nao foi modificada; nenhuma mensagem ou busca real.
