# Afiliados

Motor para localizar, avaliar e futuramente divulgar promoções de programas de afiliados.

## Stack inicial

- Node.js + TypeScript
- Playwright para fontes que precisem de navegador
- Zod para validação de dados
- SQLite será usado para histórico de preços e ofertas

## Estrutura

- `src/fontes`: conectores de lojas e plataformas
- `src/ofertas`: regras de desconto e score
- `src/banco`: persistência e histórico
- `src/robo`: orquestração das buscas
- `data`: banco e dados locais

## Comandos

`npm install` instala as dependências.

`npm run dev` executa a aplicação.

`npm run collect` executa somente o buscador.

`npm run typecheck` valida o TypeScript.

A fonte `mock` existe apenas para validar o fluxo antes de conectarmos a primeira plataforma real.
