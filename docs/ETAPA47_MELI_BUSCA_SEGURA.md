# Etapa 4.7 — Busca resiliente de ofertas Mercado Livre

Data: 26/10/2026
Base: PR #44. Branch: `fix/mercadolivre-descoberta-etapa47`.
Ambiente: worktree isolado `C:\afiliados-v2-etapa47` no ACER; NAO instalado na versao em uso.

## Problema confirmado

O Mercado Livre retornava HTTP 200 em `/users/me` e dezenas de catalogos em
`/products/search`, mas parte significativa dos produtos nao tinha anuncios
disponiveis (`/products/{id}/items` => HTTP 404). Em amostra supervisionada:
7/10 catalogos de air fryer sem publicacoes, 24 anuncios novos dos outros
3 catalogos, 7 com algum desconto; 15/20 vendedores tinham reputacao verde.
O HTTP 429 apareceu quando consultas sucessivas ultrapassaram o limite da
API. O robô antigo continuava pedindo um ID 404 a cada rodada, reiniciava
seu intervalo por categoria e tentava novamente 429 ate quatro vezes.

## Alteracoes

1. `src/fontes/mercadolivre/cache-catalogo-404.ts`
   - Cache persistente local somente de IDs publicos de catalogos cujo
     endpoint de publicacoes respondeu **exatamente HTTP 404**.
   - TTL 30 minutos, maximo 500 IDs; dados gravados atomicamente em
     `data/mercadolivre-catalogo-404.json` na pasta em que o robo for executado.
   - HTTP 200, 401, 403, 429, falha de rede e vendedores nao verificados
     **nunca** geram entrada negativa. JSON invalido nao paralisa a busca.
   - O arquivo contem somente ID de produto e timestamp: nenhum dado
     pessoal, senha, token ou telefone.

2. `src/fontes/mercadolivre/api.ts`
   - Intervalo entre requisicoes compartilhado por instancias de busca
     no mesmo processo, piso 250 ms (continua aceitando
     `MERCADOLIVRE_REQUEST_INTERVAL_MS` original, padrao 500 ms).
   - Ao primeiro HTTP 429, encerra a rodada sem retry. O erro tipado
     passa pelas consultas de produtos, publicacoes e reputacao.
   - Nenhuma busca parcial e considerada sucesso apos limite na pagina 2+.
   - Resumo em logs somente de contagens (catalogos consultados, novos
     404, IDs pulados do cache, vendedores verdes e descontos minimos).
   - Renova OAuth apenas conforme o fluxo existente; nenhuma modificacao
     nas credenciais ou no mecanismo rotativo de refresh token.

3. `src/robo/mercadolivre-preview.ts`
   - Em limite: `MERCADOLIVRE_RATE_LIMIT: HTTP 429 limite de requisicoes`,
     processo termina com codigo 5, permitindo ao painel detectar a
     limitacao e respeitar o backoff existente (8 minutos por padrao).

4. `tests/mercadolivre-resiliencia.mts`
   - Busca 404 repetida em processos/instancias, expirar apos 30 min.
   - Proibicao de retry 429 em catalogo e reputacao.
   - Ritmo entre duas instancias simultaneas.
   - HTTP 429 na segunda pagina nao devolve oferta parcial.
   - Cache corrompido e vendedor sem nivel verde sao rejeitados.
   - Todos os requests sao mocks com token ficticio; nenhuma chamada
     para API real do Mercado Livre ou WhatsApp.

## Regras de qualidade preservadas

Na instalacao do ACER foram mantidos:
- `MIN_DISCOUNT_PERCENT=25`
- `MERCADOLIVRE_QUERIES_PER_RUN=1`
- Prioridade em eletronicos/eletrodomesticos e economia real.
- Somente reputacao `4_light_green` ou `5_green`.
- Cupons genericos estimados nao criam descontos ficticios.
- Historico antiduplicacao e consentimento do WhatsApp inalterados.

Nao amplia paginas automaticamente nem diminui criterios apenas para
obter mais ofertas; algumas rodadas ainda podem terminar vazias.

## Evidencia de testes locais (Windows ACER)

- TDD RED: 4 de 5 testes iniciais falharam conforme previsto; o
  teste de nao aceitar vendedor sem reputacao verde passou.
- Correcao do teste fixture: ele passou a usar produto prioritario real
  (air fryer), para testar cache sem falha falsa de elegibilidade editorial.
- RED adicional: 429 na segunda pagina era tratado como consulta normal.
- TDD GREEN: 8/8 testes de resiliencia apos a correcao, incluindo
  HTTP 200 vazio sem cache e falha de gravacao do cache sem interromper a busca.
- Testes existentes de descoberta Mercado Livre e token OAuth ficticio: OK.
- Dominio timers/painel/rotas: 10/10; Central: 4/4;
  consentimento e WhatsApp incerto: 11/11.
- `npm.cmd run typecheck`: OK.
- `npm.cmd audit --audit-level=high`: 0 vulnerabilidades.
- `git diff --check`: OK.
- CI em Windows + Ubuntu no workflow `.github/workflows/mercadolivre-etapa47.yml`.

## Instalacao e rollback

**Nao fazer copia dos arquivos sobre a versao ativa durante os testes.**
Pasta de desenvolvimento: `C:\afiliados-v2-etapa47`.
Painel ACER ativo: `C:\afiliados-v2-homologacao` portas 3030 e 3040,
com monitor alternado/Meli e autoenvio WhatsApp desligados.
Instalacao antiga e backup preservados: `C:\projeto01` e
`C:\BackupsAfiliados`.

A versao com cache so entra em execucao apos revisar PRs e autorizar
implantacao controlada, preservar OAuth sincronizado entre as copias,
fazer teste de inicializacao sem envio, e manter rollback disponivel.
