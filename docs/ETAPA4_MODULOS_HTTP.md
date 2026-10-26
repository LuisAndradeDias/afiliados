# Afiliados 2.0 — Etapa 4.1: separação do transporte HTTP

> Estado: implementação em **branch isolada**, sem deploy, sem alterações nos dados ou na instalação local.
> Esta branch depende de `refactor/unificar-paineis-v2` (PR #38).

## Objetivo

Separar as interfaces HTTP dos motores de automação sem alterar os contratos de ofertas,
captacao autorizada, OAuth do Mercado Livre, WhatsApp Web, WhatyGo ou Netlify.

## Nova organização

```text
src/painel/
  server.ts                    -> motor existente, OAuth, estado e ações
  rotas-visuais.ts             -> GET /, /ofertas, /central, assets allowlisted

captacao/caca-promos-vip/src/
  server.mjs                   -> composição de serviços, rotas e regras administrativas
  http/
    ativos.mjs                 -> CSS, JS e planilha-modelo estáticos permitidos
    respostas.mjs              -> cabeçalhos, CSP, JSON, HTML e respostas texto
    corpos.mjs                 -> leitura JSON e de corpo assinado com limites de bytes
    origem-sessao.mjs          -> leitura de Origin e token de sessão
```

### Ofertas

- O servidor principal chama `responderRotaVisual` apenas após as rotas específicas de OAuth, webhooks e imagens.
- Uma *allowlist exata* impede acesso a arquivos locais por caminhos arbitrários.
- GET `/` e GET `/ofertas` devolvem a mesma tela existente; GET `/central` devolve o cockpit.
- Todas as rotas API (`/api/status`, `/api/action`, Meli, Instagram) permanecem sob o servidor anterior, sem proxy para a Captacao.
- Funções de envio, intervalos, associação e automação não foram movidas nem alteradas.

### Captação

- O servidor apenas importa os novos helpers, em vez de declarar esses utilitários em seu corpo.
- `acessoCampanhasLocais` **não foi alterada**, preservando comparação exata de `Host`, `Origin`, loopback, `sec-fetch-site` e `x-cpv-local`.
- A validação do token administrativo e do `x-cpv-admin` segue intacta.
- `codigoHtml` preserva CSP, proteção contra iframe, políticas de referrer e cache; ativos CSS/JS continuam sem upload.
- O manifesto de ativos só lê caminhos fixos do projeto. Nenhum usuário pode fornecer nome de arquivo via URL.
- O fluxo de consentimento e as rotas públicas `/sair`, `/denunciar`, `/c/` não mudaram.

## Validação executada em CI isolada

Arquivo: `.github/workflows/refactor-http-v2.yml`.

- `npm run typecheck`
- `npm run test:central-unificada`
- `npx tsx --test tests/rotas-visuais.mts`
- `node --test captacao/caca-promos-vip/tests/http-modulos.test.mjs`
- `node --test captacao/caca-promos-vip/tests/afiliados-v2.test.mjs`
- `node --test captacao/caca-promos-vip/tests/consentimento.test.mjs captacao/caca-promos-vip/tests/campanhas-local.test.mjs`
- `node captacao/caca-promos-vip/tests/afiliados-v2-visual.mjs`

Em todos os testes, os dados de trabalho são temporários. Não executar campanhas, OAuth real ou envio de WhatsApp. A CI tem proteção de concorrência e somente permissões de leitura do repositório.

## Verificação do Windows (leitura, sem alterações)

- Conexão ao dispositivo denominado **ACER**, conta Desktop Commander associada à conta 14.
- Foi localizado `C:\projeto01`, atualmente na branch `feat/convites-whatsapp-web-supervisionado` em commit `ce707cc`.
- Existe conteúdo não versionado em `data/` e em experimentos da extensão lateral da captação.
- **Nada foi copiado, removido, sincronizado, compilado ou implantado nesse computador** durante a fase 4.1.
- Esse ACER pode ser a instalação antiga, portanto não considerar que seja o PC novo sem identificação e confirmação adicionais. Não atualizar automaticamente a máquina.

## Próximas subetapas

1. Criar contratos de serviços de domínio com injeção de dependências e testes para eventos de ofertas e fila; **não** mover as operações sensíveis de uma vez.
2. Isolar o estado mutável e os timers do monitor Amazon/Meli em um módulo de aplicação, mantendo o ciclo de publicação e a confirmação WhatsApp.
3. Separar os endpoints da captação por domínio (`contatos`, `campanhas`, `respostas`, `denuncias`) sob a mesma política local.
4. Consolidar a navegação e os processos **sem** gateway público de dados pessoais; validar todas as chamadas localmente em ambiente temporário.
5. Confirmar qual Windows é o PC novo, preparar backup no disco C:, revalidar serviços, perfil Chrome, Meli OAuth e WhatsApp em testes manuais supervisionados.
6. Mesclar PRs empilhados na ordem correta, após revisão e plano de reversão, sem instalar PostgreSQL ou usar API oficial paga.

## Rollback e limites

A branch-base PR #38 não foi alterada; a nova arquitetura está somente em
`refactor/modulos-http-v2`. Reverter esse PR restaura as rotas originais do
servidor de Ofertas e os helpers HTTP que estavam embutidos no servidor da Captação.
Não mexer em `.env`, chaves, `dados/`, `data/`, cookies, grupos, perfis Chrome,
lotes de contatos nem logs de envio.
