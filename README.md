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

## Amazon - modo de teste

Enquanto não houver conta de Associado e acesso à Creators API, o projeto possui
um coletor de desenvolvimento via navegador. Ele lê resultados públicos de busca,
não cria link de afiliado e não tenta contornar CAPTCHA ou bloqueios anti-bot.

Configure opcionalmente:

```env
AMAZON_QUERY=echo pop
AMAZON_LIMIT=10
```

Execute:

```bash
npm run amazon:test
```

O resultado contém ASIN, título, preço atual, preço anterior quando disponível,
desconto calculado e URL do produto. Esse modo existe para validar nosso pipeline
e não deve ser tratado como a integração de produção.

Quando a conta estiver elegível, a fonte Amazon será substituída pela Creators API,
mantendo a mesma interface `FonteDeOfertas`. Assim, filtros, histórico, score e
divulgação não precisarão ser reescritos.
