# Afiliados 2.0 — Etapa 4.2: domínios isolados

**Branch:** `refactor/dominios-v2-etapa42` (dependência: `refactor/modulos-http-v2`, PR #39).

## O que passou a estar separado

```text
src/painel/
  server.ts                         Integração, estado, OAuth state, monitor e ações
  dominios/
    amazon-tag.ts                   Extrai/valida tracking ID Amazon
    mercadolivre-oauth.ts           Valida redirect, constrói URL OAuth, troca código com fetch injetável
    scripts-robo.ts                 Lista fechada de scripts Playwright/WhatsApp/Amazon/Meli

captacao/caca-promos-vip/src/
  server.mjs                        Fronteira Host/Origin/CSRF/loopback, ações e rate limits
  consultas/
    gestao.mjs                      GET/HEAD contatos, detalhe, resumo e denúncias
    campanhas.mjs                   GET/HEAD de 12 rotas de campanhas, filas e estado
```

### Contratos preservados

- Geração do `state` OAuth continua no servidor em memória e **após** validação das credenciais/redirect. Tokens Mercado Livre continuam salvos pelo código original, nunca pela biblioteca de URLs.
- `trocarCodigoMercadoLivre` recebe `fetchImpl` opcional para teste com resposta fictícia; produção usa `fetch` normal.
- A lista de sete scripts mantém os caminhos atuais. `arquivoDoRobo` não executa processo; é apenas um registro de seleção fechado.
- Rotas administrativas extraídas **não fazem autenticação** e não respondem diretamente por HTTP. Só são chamadas depois de `acessoCampanhasLocais` em `server.mjs`, que continua exigindo `127.0.0.1`, Host exato, `sec-fetch-site`, Origin e `x-cpv-local` quando aplicável.
- As consultas de gestão preservam filtros, paginação, mensagem HTTP de erro (400 do wrapper) e composição de filas/denúncias.
- As consultas de campanhas preservam DTO, GET/HEAD e status 404 nos detalhes inválidos.
- Buscar contato rápido, validação de template Meta, **todas** as rotas POST, envio, conciliação, bloqueio/reativação, descadastro e sync Netlify continuam sob controle direto dos servidores legados.
- Nenhum dado ou sessão foram copiados para uma nova API central; não há proxy entre 3030 e 3045.

## TDD e CI

Tests:
- `tests/painel-dominios.mts`: normalização de tags, validação redirect, query OAuth/state, HTTP token por `fetch` fictício, scripts permitidos e entradas adversárias.
- `captacao/caca-promos-vip/tests/consultas-dominios.test.mjs`: contatos, detalhes, resumo, denúncias, filtros, HEAD/POST/Host/Origin.
- `captacao/caca-promos-vip/tests/consultas-campanhas.test.mjs`: 12 DTOs, erros 404, fallback das ações, HTML/Host de acesso e HEAD.
- `.github/workflows/refactor-dominios-v2.yml`: suites novas + typecheck + testes HTTP/consentimento/campanhas, Mercado Livre refresh e WhatsApp auto-send (ambos mockados), smoke Chrome headless.

Executamos o ciclo **RED** (ausência dos novos módulos) e **GREEN** (testes novos e de regressão). Ver execução mais recente na aba Actions da branch `refactor/dominios-v2-etapa42`.

## Atenções e decisão de publicação

- Os testes não validam a operação real de login, autorização remota Mercado Livre ou envio WhatsApp. Esses fluxos precisam de validação supervisionada no Windows correto, em ambiente de teste e com rollback.
- O `npm ci` do GitHub Actions reportou **uma vulnerabilidade de severidade alta** em alguma dependência. Não foi aplicada atualização destrutiva como `npm audit fix --force`; identificar pacote e corrigir separadamente antes de produção.
- A instalação `C:\projeto01` e perfis, arquivos `.env`, dados, contatos e logs não foram alterados. Nada foi publicado.
- PRs são empilhados: primeiro #38 (visual), depois #39 (transporte HTTP), depois o PR desta etapa.

## Próxima etapa sugerida (4.3)

Definir e testar contratos dos estados e transições de execução Amazon/Meli e da fila WhatsApp antes de mover temporizadores e rotas POST. Isso exigirá teste de concorrência, duplicação, tentativa incerta, reenvio e confirmação de entrega, sem uso de contatos reais.
