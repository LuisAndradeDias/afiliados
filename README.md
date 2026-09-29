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

## WhatsApp - preparação de mensagem

O comando abaixo busca ofertas da Amazon, aplica o desconto mínimo,
seleciona a melhor candidata e gera a mensagem pronta para WhatsApp:

```bash
npm run whatsapp:preview
```

A mensagem também é salva em:

`data/ultima-mensagem-whatsapp.txt`

Se `AMAZON_ASSOCIATE_TAG` estiver configurada, o link recebe a tag
de Associado. Sem tag, o projeto usa o link normal do produto.

O envio automático para grupos comuns do WhatsApp não é ativado nesta
etapa. O próximo módulo será o publicador, separado do motor de ofertas,
para que possamos escolher entre integração oficial quando elegível e
automação assistida do WhatsApp Web.

## Robô automático

O comando abaixo executa buscas repetidas, aplica os filtros e gera a melhor
candidata em `data/ultima-mensagem-whatsapp.txt`:

```bash
npm run automatico
```

Por segurança, esta etapa ainda funciona em modo preview e não envia mensagens
ao WhatsApp. Para testar apenas um ciclo, defina `RUN_ONCE=true` no `.env`.

Você pode pesquisar várias expressões com:

```env
AMAZON_QUERIES=ofertas,echo dot,air fryer
AMAZON_LIMIT=15
MIN_DISCOUNT_PERCENT=20
COLLECT_INTERVAL_MINUTES=10
```

Se nenhuma oferta atingir o desconto mínimo, o programa informa quantos produtos
foram analisados e qual foi o melhor desconto encontrado.

## Login do WhatsApp Web

Para autenticar o WhatsApp no projeto:

```bash
npm run whatsapp:login
```

O comando abre o Google Chrome usando um perfil separado em
`data/whatsapp-profile`. Se aparecer o QR Code, escaneie com o celular,
aguarde as conversas carregarem e então feche a janela do Chrome.

A sessão fica salva localmente e não é enviada ao GitHub.
Nos próximos módulos, esse mesmo perfil será reutilizado para localizar
o grupo configurado e preparar o envio.

## Preparar mensagem no grupo

Depois de gerar uma oferta e autenticar o WhatsApp, execute:

```bash
npm run whatsapp:preparar -- "Nome exato do grupo"
```

O programa abre o WhatsApp Web usando a sessão salva, pesquisa o grupo,
abre a conversa e preenche `data/ultima-mensagem-whatsapp.txt` no campo
de mensagem. Ele não pressiona Enter e não clica no botão Enviar.

Você revisa o conteúdo no Chrome e faz o envio manualmente.
Também é possível salvar o nome em `WHATSAPP_GROUP_NAME` no `.env` e
executar apenas `npm run whatsapp:preparar`.
