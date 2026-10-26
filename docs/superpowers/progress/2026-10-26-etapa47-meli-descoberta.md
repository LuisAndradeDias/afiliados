# SDD ledger — Etapa 4.7 Mercado Livre seguro

Plano: `docs/superpowers/plans/2026-10-26-etapa47-meli-descoberta.md`.
Spec: `docs/superpowers/specs/2026-10-26-etapa47-meli-descoberta-design.md`.
Base: PR #44; branch atual `fix/mercadolivre-descoberta-etapa47`.
Ambiente: ACER, worktree de desenvolvimento `C:\afiliados-v2-etapa47`; Node 24 e npm.cmd 11. O painel em `C:\afiliados-v2-homologacao` nao foi modificado.

## Pre-flight

- O arquivo `src/fontes/mercadolivre/api.ts` concentrava os bugs: `ultimaRequisicaoEm` era propriedade da instancia, 429 era repetido quatro vezes, 429 em reputacao e publicacoes podia ser engolido, e 429 em segunda pagina era tratado como retorno parcial.
- `src/robo/mercadolivre-preview.ts` ja possuia backoff por logs no painel, mas precisava mensagem/classificacao de limite confiavel.
- Cache 404 precisa ser chamado tanto na consulta da API quanto no diagnostico de ofertas; as mudancas de API/preview compartilham o tipo `MercadoLivreLimiteRequisicoes`.
- Nenhuma alteracao em `.env`, envios, banco, cookies, backup, perfil Chrome ou OAuth. A conta real do Mercado Livre **nao** foi consultada durante desenvolvimento e CI.

## Task 1 — Testes RED

- Criado `tests/mercadolivre-resiliencia.mts` com token ficticio e `globalThis.fetch` inteiramente substituido.
- RED inicial: 4/5 falhas. Os erros demonstraram 404 repetido em segunda rodada, 429 repetido/engolido em publicacao e vendedor, ritmo sem compartilhamento. A rejeicao de vendedor amarelo ja funcionava.
- Fixture inicialmente nao elegivel por titulo generico, corrigido para air fryer de verdade (produto prioritario) e economia comprovada, sem alterar codigo de producao.
- RED adicional: 429 na segunda pagina nao interrompia a rodada e retornava amostra parcial como sucesso.

## Task 2 — Cache negativo 404

- Adicionado `src/fontes/mercadolivre/cache-catalogo-404.ts`, TTL 30 min, max 500, somente IDs publicos, JSON v1 e rename atomico, falha de IO fail-open.
- Integrado a `MercadoLivreApiFonte.buscar()`. Marca apenas 404 de `/products/{id}/items`; 200 com array vazio nao e cacheado.
- Resumo de contadores agregados em log, sem dados de conta.

## Task 3 — Ritmo/429

- Ritmo global sincroniza chamadas entre varias instancias da fonte no mesmo processo, preservando configuracao minima historica 250ms.
- Primeiro HTTP 429 gera erro `MERCADOLIVRE_LIMITE_REQUISICOES`, sem retentativas; a mesma regra vale em reputacao e em paginas subsequentes.
- Preview trata HTTP 429 com exit code 5 e linha `limite de requisicoes` que o painel ja reconhece, evitando continuar o fluxo de publicacao.

## Task 4 — Validações e CI

- Windows ACER: testes de resiliencia **8/8**, contratos Meli descoberta e OAuth mock aprovados; dominio/timer/painel **10/10**, Central **4/4**, consentimento/WhatsApp incerto **11/11**. Todos sem envios e sem rede de API real.
- `npm.cmd run typecheck`: sucesso. `npm.cmd audit --audit-level=high`: `found 0 vulnerabilities`. `git diff --check`: sucesso.
- CI declarada para `windows-latest` e `ubuntu-latest` com `npm ci --ignore-scripts` e os mesmos contratos.
- PR deve ficar em DRAFT, empilhado sobre #44, sem merge e sem substituir codigo de `C:\afiliados-v2-homologacao`.

## Rulings e compromissos

- **Ruling:** nao diminuir o filtro `MIN_DISCOUNT_PERCENT=25`, apesar de rodadas vazias; custo: menos ofertas candidatas, qualidade preservada.
- **Ruling:** nao aumentar categorias/paginas por rodada e nao fazer retry imediato de 429; custo: busca menos agressiva, menos bloqueios API.
- **Ruling:** so persistir 404 expresso em publicacoes por 30 minutos; custo: produto recem-publicado pode esperar ate TTL para reconsulta.
- **Ruling:** nao implementar API alternativa nao documentada; custo: depender do endpoint de catalogo oficial disponivel.
- **Ruling:** executar testes apenas em worktree isolado; custo: versao ativa continua sem este patch ate revisao e autorizacao.

## Bloqueios de ativacao

- [ ] Revisao independente PRs #38-#45, inclusive branch-base +58 commits.
- [ ] Checagem de CI final Windows e Ubuntu no SHA do PR #45.
- [ ] Homologacao de busca somente leitura, controlada no ACER, depois do merge/aprovacao (nao fazer envios).
- [ ] Autorizacao para deploy/rollback, preserving config OAuth rotativo em ambas instalacoes.
