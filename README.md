# Afiliados

Central local para localizar ofertas, validar links de afiliado, preparar conteúdo e revisar o envio no WhatsApp.

## Estado atual

O projeto possui dois fluxos ativos:

- **Amazon**: coleta via navegador, rotação de categorias, score por promoção/comissão, aplicação do Tracking ID e preparação no WhatsApp.
- **Mercado Livre**: coleta via API oficial, filtro de publicação nova + vendedor verde, geração automática do link pelo Gerador de Links oficial através de uma extensão local do Chrome, validação do link e preparação no mesmo fluxo do WhatsApp. O modo manual continua disponível como fallback.

O envio continua dependendo de confirmação humana no painel.

## Stack

- Node.js + TypeScript
- Playwright com Google Chrome
- API oficial do Mercado Livre
- Persistência local em arquivos JSON/TXT
- Painel local em `http://localhost:3030`

## Estrutura

- `src/afiliados/`: regras de links de afiliado.
- `src/fontes/`: coletores Amazon e Mercado Livre.
- `src/ofertas/`: score, comissão, rotação e histórico.
- `src/mensagens/`: formatação das mensagens.
- `src/publicadores/`: pacote e arquivo de publicação.
- `src/robo/`: fluxos executáveis.
- `src/painel/`: servidor e interface local.
- `data/`: estado da máquina, sessões e histórico; não vai para o GitHub.
- `docs/PROJECT_MAP.md`: mapa detalhado da arquitetura e dos fluxos.

## Instalação

```bash
npm ci
npm run typecheck
npm run painel
```

Depois abra:

```text
http://localhost:3030
```

No Windows, também existe `Abrir Painel.bat`.

## Comandos principais

```bash
npm run painel
npm run typecheck

npm run whatsapp:preview
npm run whatsapp:login
npm run whatsapp:preparar

npm run mercadolivre:test
npm run mercadolivre:preview
npm run mercadolivre:whatsapp

npm run automatico
```

## Amazon

Configure `AMAZON_ASSOCIATE_TAG` pelo painel ou no `.env`.

O fluxo normal é:

1. **Nova oferta Amazon**.
2. O sistema busca, pontua e escolhe a melhor oferta disponível.
3. O Tracking ID é aplicado ao link.
4. Foto + mensagem são preparadas no WhatsApp.
5. Você revisa e confirma **Enviar agora** ou **Enviar + próxima Amazon**.

A comissão exibida é uma estimativa baseada na categoria de busca.

## Mercado Livre

O fluxo normal é:

1. Autorize a API Mercado Livre no painel.
2. Clique em **Buscar oferta ML**.
3. Instale uma vez a extensão local em `browser-extension/mercadolivre-affiliate` usando `chrome://extensions/` → **Modo do desenvolvedor** → **Carregar sem compactação**.
4. Quando o painel mostrar **Automação Meli conectada**, clique em **Gerar link automaticamente**.
5. O painel abre Afiliados no mesmo navegador. A extensão localiza o Gerador de Links oficial, cola a URL do produto, clica em gerar e devolve o `meli.la`/`/sec/` ao painel.
6. O backend valida o link oficial e o salva na oferta atual.
7. Clique em **Preparar Mercado Livre no WhatsApp**.
8. Revise foto + legenda e confirme o envio.

Se a extensão não estiver ativa ou o Mercado Livre alterar o layout, o botão volta ao modo manual: abre Afiliados e copia a URL do produto para você gerar e colar o link no painel.

O projeto não fabrica parâmetros de afiliado do Mercado Livre e não trata uma URL normal de produto como link com comissão.

## Reputação e elegibilidade Mercado Livre

A coleta atual:

- usa `/products/search` com paginação;
- consulta publicações do produto;
- mantém somente itens novos;
- consulta vendedores em lote;
- considera verde somente `4_light_green` ou `5_green`;
- aplica desconto mínimo e cooldown;
- limita a cadência de chamadas para reduzir `429`.

## WhatsApp

A sessão persistente fica em:

```text
data/whatsapp-profile/
```

O pacote atual fica em:

```text
data/ultima-oferta-whatsapp.json
data/ultima-mensagem-whatsapp.txt
```

Ao confirmar o envio no painel, a oferta é registrada no histórico.

## Histórico e repetição

O histórico fica em:

```text
data/historico-ofertas.json
```

As chaves são separadas por plataforma, por exemplo:

```text
amazon:B0...
mercado-livre:MLB...
```

Os tempos padrão são controlados por:

```env
OFFER_PREVIEW_COOLDOWN_MINUTES=120
OFFER_COOLDOWN_HOURS=24
```

## Configuração local

Credenciais e sessões nunca devem ser commitadas.

Use `.env.example` como referência e mantenha localmente:

- Amazon Tracking ID
- grupo do WhatsApp
- credenciais OAuth Mercado Livre
- tokens Mercado Livre
- sessões do WhatsApp/Chrome

Consulte `docs/PROJECT_MAP.md` para o mapa completo do projeto.

## Extensão local para links Mercado Livre

Instalação rápida no Windows:

```text
Instalar Automacao Meli.bat
```

Ou manualmente:

1. Abra `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione `C:\projeto01\browser-extension\mercadolivre-affiliate`.

A extensão não lê cookies, senhas nem tokens. Ela automatiza somente a interface visível do Gerador de Links e conversa com o painel local em `127.0.0.1:3030`.
